const express = require('express');
const router = express.Router();
const db = require('../db');
const { kenyaToDbTime, fromDbTime, overlapsExistingBlock } = require('../availability');
const { inTransaction } = require('../transaction');
const { UNAVAILABLE, PartnerUnavailable, fetchMaterials } = require('../kanairo');
const { requireSignIn } = require('../session');

// Every booking route needs someone signed in (session.js), and takes the
// client or artisan from the session (req.account), never from an id the
// browser sends. A booking that isn't yours answers 404, as if it weren't there.
const signedIn = requireSignIn();
const signedInClient = requireSignIn('client');
const signedInArtisan = requireSignIn('artisan');

// Which status an artisan may move a booking to, from which status. A request
// starts as pending; the artisan accepts or declines it, and marks an accepted
// job completed once it's done. Anything else (completing a job never accepted,
// re-opening a declined one) is refused.
const ARTISAN_MOVES = {
  confirmed: ['pending'],
  declined: ['pending'],
  completed: ['confirmed'],
};

// What the booking form sends: <input type="date"> and <input type="time">.
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^\d{2}:\d{2}(:\d{2})?$/;

// A booking can list up to this many Kanairo-Klean materials for its estimate.
const MAX_MATERIALS = 10;

/**
 * Checks the optional materials list on a new booking: [{ materialId, quantityKg }].
 * Returns an error message, or null when it's fine (or missing).
 */
function materialsError(materials) {
  if (materials === undefined) return null;
  if (!Array.isArray(materials) || materials.length > MAX_MATERIALS) {
    return `materials must be a list of at most ${MAX_MATERIALS} items`;
  }
  const seen = new Set();
  for (const item of materials) {
    const { materialId, quantityKg } = item ?? {};
    if (typeof materialId !== 'string' || !materialId || materialId.length > 50) {
      return 'Each material needs a materialId';
    }
    // DECIMAL(8, 2) holds up to 999999.99.
    if (typeof quantityKg !== 'number' || !(quantityKg > 0) || quantityKg >= 1e6) {
      return 'Each material needs a quantityKg above 0 and below 1,000,000';
    }
    if (seen.has(materialId)) return `${materialId} is listed twice`;
    seen.add(materialId);
  }
  return null;
}

// '2026-10-22 07:00:00' (UTC, from MySQL) as Kenya time: '10:00'.
function kenyaClock(dbTime) {
  return new Date(fromDbTime(dbTime)).toLocaleTimeString('en-GB', {
    timeZone: 'Africa/Nairobi', hour: '2-digit', minute: '2-digit',
  });
}

// GET /bookings: the signed-in client's bookings, or the signed-in artisan's.
// The old ?clientId= / ?artisanId= still work, but only for your own id:
// anyone else's is 403.
router.get('/', signedIn, async (req, res) => {
  const { id, role } = req.account;
  const asked = role === 'client' ? req.query.artisanId : req.query.clientId;
  const own = role === 'client' ? req.query.clientId : req.query.artisanId;
  if (asked !== undefined || (own !== undefined && own !== String(id))) {
    return res.status(403).json({ error: 'You can only see your own bookings' });
  }
  const clientId = role === 'client' ? id : null;
  const artisanId = role === 'artisan' ? id : null;

  try {
    // JOINs add the artisan's name, skill and location, the end of the time
    // the artisan blocked out when accepting, and the client's review of the
    // job (both NULL until there is one).
    const [rows] = await db.query(
      `SELECT bookings.*, artisans.name AS artisan_name,
              artisans.skill AS artisan_skill, artisans.location AS artisan_location,
              availability_blocks.end_at AS block_end,
              reviews.rating AS review_rating, reviews.comment AS review_comment
       FROM bookings
       JOIN artisans ON artisans.id = bookings.artisan_id
       LEFT JOIN availability_blocks ON availability_blocks.booking_id = bookings.id
       LEFT JOIN reviews ON reviews.booking_id = bookings.id
       WHERE ${clientId ? 'bookings.client_id' : 'bookings.artisan_id'} = ?
       ORDER BY bookings.id DESC`,
      [clientId || artisanId]
    );
    // For an artisan, also the scrap they reported to Kanairo-Klean from each
    // job, so the dashboard shows it and offers only materials not yet sent.
    const scrapByBooking = {};
    if (artisanId) {
      const [scrap] = await db.query(
        `SELECT id, booking_id, kanairo_drop_off_id, location_id, location_name,
                material_type, quantity_kg, status, created_at
         FROM scrap_drop_offs WHERE artisan_id = ? ORDER BY id`,
        [artisanId]
      );
      for (const s of scrap) (scrapByBooking[s.booking_id] ??= []).push(s);
    }

    // The material estimate each booking was made with, priced from Kanairo-Klean.
    const materialsByBooking = {};
    if (rows.length > 0) {
      const [materials] = await db.query(
        `SELECT booking_id, material_id, name, material_type, quantity_kg, price_per_kg_kes
         FROM booking_materials WHERE booking_id IN (?) ORDER BY id`,
        [rows.map(row => row.id)]
      );
      for (const m of materials) (materialsByBooking[m.booking_id] ??= []).push(m);
    }

    res.json(rows.map(row => ({
      ...row,
      block_end: row.block_end && fromDbTime(row.block_end),
      materials: materialsByBooking[row.id] ?? [],
      ...(artisanId && { scrap_drop_offs: scrapByBooking[row.id] ?? [] }),
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// POST a new booking (the "Request this artisan" form). Optional
// materials: [{ materialId, quantityKg }], Kanairo-Klean materials the client
// expects the job to need. This server looks up their prices at Kanairo, so
// the estimate can't be changed in the browser, and saves them with the booking.
// The client is whoever is signed in; a clientId in the body is ignored.
router.post('/', signedInClient, async (req, res) => {
  const { artisanId, name, contact, date, time, budget, job, materials = [] } = req.body ?? {};
  const clientId = req.account.id;

  if (!artisanId || !name || !contact || !date || !time || !job) {
    return res.status(400).json({ error: 'artisanId, name, contact, date, time and job are required' });
  }
  if (!DATE.test(date) || !TIME.test(time)) {
    return res.status(400).json({ error: 'date must look like 2026-10-22 and time like 10:00' });
  }
  const badMaterials = materialsError(req.body?.materials);
  if (badMaterials) return res.status(400).json({ error: badMaterials });

  try {
    // Only someone with a client account can book, so every request can be
    // tracked, cancelled and reviewed by the person who made it.
    const [clients] = await db.query('SELECT id FROM clients WHERE id = ?', [clientId]);
    if (clients.length === 0) {
      return res.status(400).json({ error: 'Sign in with a client account to book' });
    }

    // Refuse a start time that falls inside a window the artisan is busy.
    const start = kenyaToDbTime(date, time);
    const [clash] = await db.query(
      `SELECT start_at, end_at FROM availability_blocks
       WHERE artisan_id = ? AND start_at <= ? AND end_at > ?`,
      [artisanId, start, start]
    );
    if (clash.length > 0) {
      const { start_at, end_at } = clash[0];
      return res.status(409).json({
        error: `This artisan is busy from ${kenyaClock(start_at)} to ${kenyaClock(end_at)} that day. Please pick another time.`,
      });
    }

    // Price the materials last, so a request refused above costs no call to Kanairo.
    let priced = [];
    if (materials.length > 0) {
      let stock;
      try {
        stock = await fetchMaterials();
      } catch (err) {
        if (!(err instanceof PartnerUnavailable)) throw err;
        return res.status(502).json({
          error: `${UNAVAILABLE} Remove the materials to send the request without an estimate.`,
        });
      }
      const byId = new Map(stock.map(m => [m.id, m]));
      const gone = materials.find(item => !byId.has(item.materialId));
      if (gone) {
        return res.status(400).json({ error: `Kanairo-Klean no longer lists ${gone.materialId}. Remove it and try again.` });
      }
      priced = materials.map(({ materialId, quantityKg }) => ({ ...byId.get(materialId), quantityKg }));
    }

    // The booking and its materials are saved together or not at all.
    const bookingId = await inTransaction(async conn => {
      const [result] = await conn.query(
        `INSERT INTO bookings (artisan_id, client_id, name, contact, booking_date, booking_time, budget, job)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [artisanId, clientId, name, contact, date, time, budget || null, job]
      );
      if (priced.length > 0) {
        await conn.query(
          `INSERT INTO booking_materials
             (booking_id, material_id, name, material_type, quantity_kg, price_per_kg_kes)
           VALUES ?`,
          [priced.map(m => [result.insertId, m.id, m.name, m.type, m.quantityKg, m.pricePerKgKes])]
        );
      }
      return result.insertId;
    });

    res.status(201).json({
      id: bookingId,
      status: 'pending',
      materials: priced.map(m => ({
        materialId: m.id, name: m.name, type: m.type, quantityKg: m.quantityKg, pricePerKgKes: m.pricePerKgKes,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create booking' });
  }
});

// PATCH cancel a booking:  /bookings/7/cancel  (the signed-in client's own)
router.patch('/:id/cancel', signedInClient, async (req, res) => {
  const clientId = req.account.id;

  try {
    const cancelled = await inTransaction(async conn => {
      // "AND client_id = ?" only cancels the booking if it belongs to this client.
      // A job that is finished, declined or already cancelled can't be cancelled.
      const [result] = await conn.query(
        `UPDATE bookings SET status = 'cancelled'
         WHERE id = ? AND client_id = ? AND status IN ('pending', 'confirmed')`,
        [req.params.id, clientId]
      );
      if (result.affectedRows === 0) return false;
      // The artisan is free again at the time they had kept for this job.
      await conn.query('DELETE FROM availability_blocks WHERE booking_id = ?', [req.params.id]);
      return true;
    });
    if (!cancelled) {
      return sendWhyNotChanged(res, req.params.id, 'client_id', clientId);
    }
    res.json({ id: Number(req.params.id), status: 'cancelled' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to cancel booking' });
  }
});

// PATCH an artisan's answer:  /bookings/7/status  with  { status }, by the
// signed-in artisan. status is "confirmed", "declined" or "completed".
// Accepting ("confirmed") also needs endTime ("12:00", Kenya time): when the
// job will be over that day.
router.patch('/:id/status', signedInArtisan, async (req, res) => {
  const { status, endTime } = req.body ?? {};
  const artisanId = req.account.id;
  const allowedFrom = ARTISAN_MOVES[status];
  if (!allowedFrom) {
    return res.status(400).json({ error: 'status must be confirmed, declined or completed' });
  }
  if (status === 'confirmed') {
    return acceptBooking(req.params.id, artisanId, endTime, res);
  }

  try {
    // One UPDATE does the ownership check and the order check together:
    // it only changes a booking for this artisan that is in an allowed status.
    const [result] = await db.query(
      'UPDATE bookings SET status = ? WHERE id = ? AND artisan_id = ? AND status IN (?)',
      [status, req.params.id, artisanId, allowedFrom]
    );
    if (result.affectedRows === 0) {
      return sendWhyNotChanged(res, req.params.id, 'artisan_id', artisanId);
    }
    res.json({ id: Number(req.params.id), status });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update booking' });
  }
});

// POST a client's review of a finished job:  /bookings/7/review
// with  { rating, comment }, by the signed-in client. Only the client who booked can review,
// only once the artisan has marked the job completed, and only once per job,
// so every website review comes from someone who really hired the artisan.
router.post('/:id/review', signedInClient, async (req, res) => {
  const { rating, comment } = req.body ?? {};
  const clientId = req.account.id;

  // Number.isInteger rejects "5" (a string) and 4.5, not just values out of range.
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'rating must be a whole number from 1 to 5' });
  }
  if (comment != null && (typeof comment !== 'string' || comment.length > 1000)) {
    return res.status(400).json({ error: 'comment must be text of at most 1000 characters' });
  }

  try {
    // The JOIN gets the client's name, which is shown as the review's author.
    const [rows] = await db.query(
      `SELECT bookings.artisan_id, bookings.status, clients.name AS client_name
       FROM bookings JOIN clients ON clients.id = bookings.client_id
       WHERE bookings.id = ? AND bookings.client_id = ?`,
      [req.params.id, clientId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    const booking = rows[0];
    if (booking.status !== 'completed') {
      return res.status(409).json({ error: 'You can review a job once the artisan has marked it completed' });
    }

    const [result] = await db.query(
      `INSERT INTO reviews (artisan_id, booking_id, author, rating, comment, created_at, from_api)
       VALUES (?, ?, ?, ?, ?, UTC_TIMESTAMP(), FALSE)`,
      [booking.artisan_id, req.params.id, booking.client_name, rating, comment?.trim() || null]
    );
    res.status(201).json({ id: result.insertId, rating, comment: comment?.trim() || null });
  } catch (err) {
    // booking_id is UNIQUE, so MySQL itself refuses a second review of a job.
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'You have already reviewed this job' });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to save review' });
  }
});

// Accepting saves the job's time as an availability block, so the artisan shows
// as busy then: on the profile page, to the booking form, and to Meditrac's
// GET /artisans. The block and the new status are saved together or not at all.
async function acceptBooking(bookingId, artisanId, endTime, res) {
  if (typeof endTime !== 'string' || !TIME.test(endTime)) {
    return res.status(400).json({ error: 'endTime is required when accepting, like 12:00' });
  }

  try {
    // Returns [status code, body] so every outcome leaves the transaction the same way.
    const [code, body] = await inTransaction(async conn => {
      // FOR UPDATE locks this booking until the transaction ends, so the client
      // can't cancel it halfway through being accepted.
      const [rows] = await conn.query(
        `SELECT booking_date, booking_time, status FROM bookings
         WHERE id = ? AND artisan_id = ? FOR UPDATE`,
        [bookingId, artisanId]
      );
      if (rows.length === 0) return [404, { error: 'Booking not found' }];
      const booking = rows[0];
      if (booking.status !== 'pending') {
        return [409, { error: `This booking is ${booking.status} and can't be changed that way` }];
      }

      const start = kenyaToDbTime(booking.booking_date, booking.booking_time);
      const end = kenyaToDbTime(booking.booking_date, endTime);
      // Both are 'YYYY-MM-DD HH:MM:SS', so comparing the text compares the times.
      if (end <= start) {
        return [400, { error: `endTime must be after the job starts at ${booking.booking_time.slice(0, 5)}` }];
      }
      if (await overlapsExistingBlock(artisanId, start, end, null, conn)) {
        return [409, { error: "You're already busy during part of that time. Free it up first, or choose an earlier end time." }];
      }

      await conn.query(
        `INSERT INTO availability_blocks (artisan_id, booking_id, start_at, end_at, created_at)
         VALUES (?, ?, ?, ?, UTC_TIMESTAMP())`,
        [artisanId, bookingId, start, end]
      );
      await conn.query("UPDATE bookings SET status = 'confirmed' WHERE id = ?", [bookingId]);
      return [200, { id: Number(bookingId), status: 'confirmed' }];
    });
    res.status(code).json(body);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to accept booking' });
  }
}

// An UPDATE that changed nothing either found no booking for this person (404)
// or found one in the wrong status for that change (409).
// ownerColumn is a fixed column name from this file, never from the request.
async function sendWhyNotChanged(res, bookingId, ownerColumn, ownerId) {
  const [rows] = await db.query(
    `SELECT status FROM bookings WHERE id = ? AND ${ownerColumn} = ?`,
    [bookingId, ownerId]
  );
  if (rows.length === 0) {
    return res.status(404).json({ error: 'Booking not found' });
  }
  res.status(409).json({ error: `This booking is ${rows[0].status} and can't be changed that way` });
}

module.exports = router;
