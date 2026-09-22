const express = require('express');
const router = express.Router();
const db = require('../db');

// GET one client's bookings:  /bookings?clientId=5
router.get('/', async (req, res) => {
  const { clientId } = req.query;
  if (!clientId) {
    return res.status(400).json({ error: 'clientId is required' });
  }

  try {
    // JOIN adds the artisan's name, skill and location to each booking.
    const [rows] = await db.query(
      `SELECT bookings.*, artisans.name AS artisan_name,
              artisans.skill AS artisan_skill, artisans.location AS artisan_location
       FROM bookings
       JOIN artisans ON artisans.id = bookings.artisan_id
       WHERE bookings.client_id = ?
       ORDER BY bookings.id DESC`,
      [clientId]
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
    const [result] = await db.query(
      "UPDATE bookings SET status = 'cancelled' WHERE id = ? AND client_id = ?",
      [req.params.id, clientId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    res.json({ id: Number(req.params.id), status: 'cancelled' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to cancel booking' });
  }
});

module.exports = router;
