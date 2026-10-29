const express = require('express');
const router = express.Router();
const db = require('../db');
const { kenyaToDbTime, fromDbTime, overlapsExistingBlock } = require('../availability');
const { inTransaction } = require('../transaction');
const { UNAVAILABLE, PartnerUnavailable, fetchMaterials } = require('../kanairo');

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

// A quote can list up to this many Kanairo-Klean materials.
const MAX_MATERIALS = 10;

// A quote can be changed while the job is still going ahead.
const QUOTABLE = ['pending', 'confirmed'];

/**
 * Checks a quote's materials list: [{ materialId, quantityKg }].
 * Returns an error message, or null when it's fine.
 */
function materialsError(materials) {
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

// GET one client's bookings:   /bookings?clientId=5
// GET one artisan's bookings:  /bookings?artisanId=3
router.get('/', async (req, res) => {
  const { clientId, artisanId } = req.query;
  if (!clientId === !artisanId) {
    return res.status(400).json({ error: 'Send either clientId or artisanId' });
  }

  try {
    // JOINs add the artisan's name, skill, area and county, the end of the time
    // the artisan blocked out when accepting, and the client's review of the
    // job (both NULL until there is one).
    const [rows] = await db.query(
      `SELECT bookings.*, artisans.name AS artisan_name,
              artisans.skill AS artisan_skill, artisans.location AS artisan_location,
              artisans.county AS artisan_county,
              availability_blocks.end_at AS block_end,
              reviews.rating AS review_rating, reviews.comment AS review_comment,
              booking_quotes.labour_kes AS quote_labour_kes, booking_quotes.notes AS quote_notes,
              booking_quotes.status AS quote_status, booking_quotes.version AS quote_version,
              booking_quotes.sent_at AS quote_sent_at, booking_quotes.answered_at AS quote_answered_at
       FROM bookings
       JOIN artisans ON artisans.id = bookings.artisan_id
       LEFT JOIN availability_blocks ON availability_blocks.booking_id = bookings.id
       LEFT JOIN reviews ON reviews.booking_id = bookings.id
       LEFT JOIN booking_quotes ON booking_quotes.booking_id = bookings.id
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

    // The materials on each artisan's quote, priced from Kanairo-Klean when
    // it was sent. Only bookings with a quote: older rows were client guesses.
    const materialsByBooking = {};
    const quoted = rows.filter(row => row.quote_status).map(row => row.id);
    if (quoted.length > 0) {
      const [materials] = await db.query(
        `SELECT booking_id, material_id, name, material_type, quantity_kg, price_per_kg_kes
         FROM booking_materials WHERE booking_id IN (?) ORDER BY id`,
        [quoted]
      );
      for (const m of materials) (materialsByBooking[m.booking_id] ??= []).push(m);
    }

    res.json(rows.map(({
      quote_labour_kes, quote_notes, quote_status, quote_version, quote_sent_at, quote_answered_at, ...row
    }) => ({
      ...row,
      block_end: row.block_end && fromDbTime(row.block_end),
      quote: quote_status ? {
        labour_kes: quote_labour_kes,
        notes: quote_notes,
        status: quote_status,
        version: quote_version,
        sent_at: fromDbTime(quote_sent_at),
        answered_at: quote_answered_at && fromDbTime(quote_answered_at),
        materials: materialsByBooking[row.id] ?? [],
      } : null,
      ...(artisanId && { scrap_drop_offs: scrapByBooking[row.id] ?? [] }),
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// POST a new booking (the "Request this artisan" form). The client doesn't
// price materials: the artisan sends a quote once they've seen the job
// (PUT /bookings/:id/quote).
router.post('/', async (req, res) => {
  const { artisanId, clientId, name, contact, date, time, budget, job } = req.body;

  if (!artisanId || !clientId || !name || !contact || !date || !time || !job) {
    return res.status(400).json({ error: 'artisanId, clientId, name, contact, date, time and job are required' });
  }
  if (!DATE.test(date) || !TIME.test(time)) {
    return res.status(400).json({ error: 'date must look like 2026-10-22 and time like 10:00' });
  }
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

    const [result] = await db.query(
      `INSERT INTO bookings (artisan_id, client_id, name, contact, booking_date, booking_time, budget, job)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [artisanId, clientId, name, contact, date, time, budget || null, job]
    );
    res.status(201).json({ id: result.insertId, status: 'pending' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create booking' });
  }
});

// PUT the artisan's quote for a job:  /bookings/7/quote
// with  { artisanId, labourKes, materials: [{ materialId, quantityKg }], notes? }
// Sent from the dashboard after the artisan has seen the job. This server looks
// up each material's price at Kanairo-Klean, so the quote can't be changed in
// the browser. Sending again replaces the quote (until the client accepts it)
// and asks the client to answer again.
router.put('/:id/quote', async (req, res) => {
  const { artisanId, labourKes, materials = [], notes } = req.body;

  if (!artisanId) {
    return res.status(400).json({ error: 'artisanId is required' });
  }
  // DECIMAL(10, 2) holds up to 99,999,999.99.
  if (typeof labourKes !== 'number' || !(labourKes >= 0) || labourKes >= 1e8) {
    return res.status(400).json({ error: 'labourKes must be a number from 0 to 99,999,999' });
  }
  const badMaterials = materialsError(materials);
  if (badMaterials) return res.status(400).json({ error: badMaterials });
  if (labourKes === 0 && materials.length === 0) {
    return res.status(400).json({ error: 'A quote needs a labour charge, materials, or both' });
  }
  if (notes != null && (typeof notes !== 'string' || notes.length > 500)) {
    return res.status(400).json({ error: 'notes must be text of at most 500 characters' });
  }

  try {
    // Check the booking before calling Kanairo, so a refused quote costs no call.
    const refusal = await whyNotQuotable(req.params.id, artisanId);
    if (refusal) return res.status(refusal[0]).json(refusal[1]);

    let priced = [];
    if (materials.length > 0) {
      let stock;
      try {
        stock = await fetchMaterials();
      } catch (err) {
        if (!(err instanceof PartnerUnavailable)) throw err;
        return res.status(502).json({
          error: `${UNAVAILABLE} You can still send a quote for labour only.`,
        });
      }
      const byId = new Map(stock.map(m => [m.id, m]));
      const gone = materials.find(item => !byId.has(item.materialId));
      if (gone) {
        return res.status(400).json({ error: `Kanairo-Klean no longer lists ${gone.materialId}. Remove it and try again.` });
      }
      priced = materials.map(({ materialId, quantityKg }) => ({ ...byId.get(materialId), quantityKg }));
    }

    // The quote and its materials are saved together or not at all. The
    // booking is checked again under a lock: the Kanairo call took time, and
    // the client may have cancelled, or accepted the old quote, meanwhile.
    const [code, body] = await inTransaction(async conn => {
      const again = await whyNotQuotable(req.params.id, artisanId, conn);
      if (again) return again;

      const cleanNotes = notes?.trim() || null;
      // A first quote is version 1; each new one adds 1 and waits for a new answer.
      await conn.query(
        `INSERT INTO booking_quotes (booking_id, labour_kes, notes, status, version, sent_at)
         VALUES (?, ?, ?, 'sent', 1, UTC_TIMESTAMP())
         ON DUPLICATE KEY UPDATE labour_kes = VALUES(labour_kes), notes = VALUES(notes),
           status = 'sent', version = version + 1, sent_at = UTC_TIMESTAMP(), answered_at = NULL`,
        [req.params.id, labourKes, cleanNotes]
      );
      await conn.query('DELETE FROM booking_materials WHERE booking_id = ?', [req.params.id]);
      if (priced.length > 0) {
        await conn.query(
          `INSERT INTO booking_materials
             (booking_id, material_id, name, material_type, quantity_kg, price_per_kg_kes)
           VALUES ?`,
          [priced.map(m => [req.params.id, m.id, m.name, m.type, m.quantityKg, m.pricePerKgKes])]
        );
      }
      const [[{ version }]] = await conn.query(
        'SELECT version FROM booking_quotes WHERE booking_id = ?', [req.params.id]
      );
      return [200, {
        bookingId: Number(req.params.id),
        labourKes,
        notes: cleanNotes,
        status: 'sent',
        version,
        materials: priced.map(m => ({
          materialId: m.id, name: m.name, type: m.type, quantityKg: m.quantityKg, pricePerKgKes: m.pricePerKgKes,
        })),
      }];
    });
    res.status(code).json(body);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save quote' });
  }
});

// PATCH the client's answer to a quote:  /bookings/7/quote
// with  { clientId, decision: 'accepted' | 'declined', version }
// version is the quote the client saw. If the artisan has sent a new one
// since, nothing changes and the client is asked to look again.
router.patch('/:id/quote', async (req, res) => {
  const { clientId, decision, version } = req.body;

  if (!clientId) {
    return res.status(400).json({ error: 'clientId is required' });
  }
  if (decision !== 'accepted' && decision !== 'declined') {
    return res.status(400).json({ error: 'decision must be accepted or declined' });
  }
  if (!Number.isInteger(version)) {
    return res.status(400).json({ error: 'version is required: the quote you are answering' });
  }

  try {
    // One UPDATE checks it all: the booking is this client's and still going
    // ahead, and the quote is the one they saw and still waiting for an answer.
    const [result] = await db.query(
      `UPDATE booking_quotes
       JOIN bookings ON bookings.id = booking_quotes.booking_id
       SET booking_quotes.status = ?, booking_quotes.answered_at = UTC_TIMESTAMP()
       WHERE booking_quotes.booking_id = ? AND bookings.client_id = ?
         AND bookings.status IN (?) AND booking_quotes.status = 'sent' AND booking_quotes.version = ?`,
      [decision, req.params.id, clientId, QUOTABLE, version]
    );
    if (result.affectedRows > 0) {
      return res.json({ bookingId: Number(req.params.id), status: decision, version });
    }

    // Nothing changed: say why.
    const [rows] = await db.query(
      `SELECT bookings.status AS booking_status, booking_quotes.status AS quote_status,
              booking_quotes.version AS quote_version
       FROM bookings LEFT JOIN booking_quotes ON booking_quotes.booking_id = bookings.id
       WHERE bookings.id = ? AND bookings.client_id = ?`,
      [req.params.id, clientId]
    );
    const row = rows[0];
    if (!row || !row.quote_status) {
      return res.status(404).json({ error: 'No quote found for this booking' });
    }
    if (!QUOTABLE.includes(row.booking_status)) {
      return res.status(409).json({ error: `This booking is ${row.booking_status}, so its quote can't be answered` });
    }
    if (row.quote_version !== version) {
      return res.status(409).json({ error: 'The artisan has sent a new quote. Look at it again before answering.' });
    }
    res.status(409).json({ error: `You have already ${row.quote_status} this quote` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save your answer' });
  }
});

// Why this artisan can't quote for this booking now, as [status code, body],
// or null when they can. With conn (inside a transaction), FOR UPDATE locks the
// booking and its quote until the transaction ends.
async function whyNotQuotable(bookingId, artisanId, conn = db) {
  const lock = conn === db ? '' : ' FOR UPDATE';
  const [rows] = await conn.query(
    `SELECT bookings.status, booking_quotes.status AS quote_status
     FROM bookings LEFT JOIN booking_quotes ON booking_quotes.booking_id = bookings.id
     WHERE bookings.id = ? AND bookings.artisan_id = ?${lock}`,
    [bookingId, artisanId]
  );
  if (rows.length === 0) return [404, { error: 'Booking not found' }];
  const { status, quote_status } = rows[0];
  if (!QUOTABLE.includes(status)) {
    return [409, { error: `This booking is ${status}, so it can't be quoted` }];
  }
  if (quote_status === 'accepted') {
    return [409, { error: 'The client has accepted your quote, so it can no longer be changed' }];
  }
  return null;
}

// PATCH cancel a booking:  /bookings/7/cancel  with  { clientId }
router.patch('/:id/cancel', async (req, res) => {
  const { clientId } = req.body;

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

// PATCH an artisan's answer:  /bookings/7/status  with  { artisanId, status }
// status is "confirmed", "declined" or "completed". Accepting ("confirmed")
// also needs endTime ("12:00", Kenya time): when the job will be over that day.
router.patch('/:id/status', async (req, res) => {
  const { artisanId, status, endTime } = req.body;

  if (!artisanId) {
    return res.status(400).json({ error: 'artisanId is required' });
  }
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
// with  { clientId, rating, comment }. Only the client who booked can review,
// only once the artisan has marked the job completed, and only once per job,
// so every website review comes from someone who really hired the artisan.
router.post('/:id/review', async (req, res) => {
  const { clientId, rating, comment } = req.body;

  if (!clientId) {
    return res.status(400).json({ error: 'clientId is required' });
  }
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
