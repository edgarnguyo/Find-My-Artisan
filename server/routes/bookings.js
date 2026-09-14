const express = require('express');
const router = express.Router();
const db = require('../db');
const { optionalAuth, requireAuth } = require('../auth');

// POST a booking. Guests may book; a signed-in user's booking is linked to them.
// Body: { artisanId, name, contact, date: 'YYYY-MM-DD', time: 'HH:MM', budget, job }
router.post('/', optionalAuth, async (req, res) => {
  const { artisanId, name, contact, date, time, budget, job } = req.body ?? {};
  if (!artisanId || !name || !contact || !date || !time || !job) {
    return res.status(400).json({ error: 'artisanId, name, contact, date, time and job are required' });
  }

  try {
    // The user id comes from the verified token, never from the request body,
    // so nobody can create a booking under someone else's account.
    const userId = req.user?.id ?? null;

    const [result] = await db.query(
      `INSERT INTO bookings (artisan_id, user_id, name, contact, booking_date, booking_time, budget, job)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [artisanId, userId, name, contact, date, time, budget || null, job]
    );
    res.status(201).json({ id: result.insertId, status: 'pending' });
  } catch (err) {
    if (err.code === 'ER_NO_REFERENCED_ROW_2') {
      // Two foreign keys can fail here; the constraint name in the message says which.
      return err.message.includes('bookings_user_fk')
        ? res.status(401).json({ error: 'This account no longer exists. Sign in again.' })
        : res.status(404).json({ error: 'No artisan with that id' });
    }
    if (err.code === 'ER_TRUNCATED_WRONG_VALUE' || err.code === 'ER_DATA_TOO_LONG') {
      return res.status(400).json({ error: 'Check the date, time and field lengths' });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to create booking' });
  }
});

// GET the signed-in user's bookings, newest first.
// WHERE user_id = ? is what keeps other people's bookings private.
router.get('/mine', requireAuth, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT b.id, b.status, b.job, b.budget, b.contact, b.created_at,
              DATE_FORMAT(b.booking_date, '%Y-%m-%d') AS booking_date,
              TIME_FORMAT(b.booking_time, '%H:%i:%s') AS booking_time,
              a.id AS artisan_id, a.name AS artisan_name,
              a.skill AS artisan_skill, a.location AS artisan_location
       FROM bookings b
       JOIN artisans a ON a.id = b.artisan_id
       WHERE b.user_id = ?
       ORDER BY b.created_at DESC, b.id DESC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// PATCH cancel one of your own bookings. Cancelling is the only change allowed.
router.patch('/:id/cancel', requireAuth, async (req, res) => {
  try {
    const [result] = await db.query(
      "UPDATE bookings SET status = 'cancelled' WHERE id = ? AND user_id = ?",
      [req.params.id, req.user.id]
    );
    // 0 rows: the booking doesn't exist or belongs to someone else. Answer the same
    // way in both cases so the response doesn't reveal other people's bookings.
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
