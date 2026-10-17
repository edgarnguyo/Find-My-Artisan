const express = require('express');
const router = express.Router();
const db = require('../db');
const { kenyaToDbTime, fromDbTime, overlapsExistingBlock } = require('../availability');
const { inTransaction } = require('../transaction');

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
    res.json(rows.map(row => ({
      ...row,
      block_end: row.block_end && fromDbTime(row.block_end),
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// POST a new booking (the "Request this artisan" form)
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
