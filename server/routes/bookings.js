const express = require('express');
const router = express.Router();
const db = require('../db');

// Which status an artisan may move a booking to, from which status. A request
// starts as pending; the artisan accepts or declines it, and marks an accepted
// job completed once it's done. Anything else (completing a job never accepted,
// re-opening a declined one) is refused.
const ARTISAN_MOVES = {
  confirmed: ['pending'],
  declined: ['pending'],
  completed: ['confirmed'],
};

// GET one client's bookings:   /bookings?clientId=5
// GET one artisan's bookings:  /bookings?artisanId=3
router.get('/', async (req, res) => {
  const { clientId, artisanId } = req.query;
  if (!clientId === !artisanId) {
    return res.status(400).json({ error: 'Send either clientId or artisanId' });
  }

  try {
    // JOIN adds the artisan's name, skill and location to each booking.
    const [rows] = await db.query(
      `SELECT bookings.*, artisans.name AS artisan_name,
              artisans.skill AS artisan_skill, artisans.location AS artisan_location
       FROM bookings
       JOIN artisans ON artisans.id = bookings.artisan_id
       WHERE ${clientId ? 'bookings.client_id' : 'bookings.artisan_id'} = ?
       ORDER BY bookings.id DESC`,
      [clientId || artisanId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// POST a new booking (the "Request this artisan" form)
router.post('/', async (req, res) => {
  const { artisanId, clientId, name, contact, date, time, budget, job } = req.body;

  if (!artisanId || !name || !contact || !date || !time || !job) {
    return res.status(400).json({ error: 'artisanId, name, contact, date, time and job are required' });
  }

  try {
    const [result] = await db.query(
      `INSERT INTO bookings (artisan_id, client_id, name, contact, booking_date, booking_time, budget, job)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [artisanId, clientId || null, name, contact, date, time, budget || null, job]
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
    // "AND client_id = ?" only cancels the booking if it belongs to this client.
    // A job that is finished, declined or already cancelled can't be cancelled.
    const [result] = await db.query(
      `UPDATE bookings SET status = 'cancelled'
       WHERE id = ? AND client_id = ? AND status IN ('pending', 'confirmed')`,
      [req.params.id, clientId]
    );
    if (result.affectedRows === 0) {
      return sendWhyNotChanged(res, req.params.id, 'client_id', clientId);
    }
    res.json({ id: Number(req.params.id), status: 'cancelled' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to cancel booking' });
  }
});

// PATCH an artisan's answer:  /bookings/7/status  with  { artisanId, status }
// status is "confirmed", "declined" or "completed".
router.patch('/:id/status', async (req, res) => {
  const { artisanId, status } = req.body;

  if (!artisanId) {
    return res.status(400).json({ error: 'artisanId is required' });
  }
  const allowedFrom = ARTISAN_MOVES[status];
  if (!allowedFrom) {
    return res.status(400).json({ error: 'status must be confirmed, declined or completed' });
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
