const express = require('express');
const router = express.Router();
const db = require('../db');

// GET all users
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM users ORDER BY created_at');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// POST a new user.
// Body: { id, email, name, role, artisan } where id/email come from the Supabase
// account, role is 'client' or 'artisan', and artisan = { skill, location, price, bio }
// is only sent for artisans.
router.post('/', async (req, res) => {
  const { id, email, name, role = 'client', artisan } = req.body ?? {};

  if (!id || !email) {
    return res.status(400).json({ error: 'id and email are required' });
  }
  if (role !== 'client' && role !== 'artisan') {
    return res.status(400).json({ error: "role must be 'client' or 'artisan'" });
  }
  if (role === 'artisan' && (!name || !artisan?.skill || !artisan?.location)) {
    return res.status(400).json({ error: 'Artisans need a name, skill and location' });
  }

  // An artisan needs two rows: users and artisans. A transaction makes them
  // all-or-nothing, so a failed second insert can't leave a user with no profile.
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // The ? placeholders send the values separately from the SQL text, so input
    // containing quotes or SQL is stored as plain text, never run.
    await conn.query(
      'INSERT INTO users (id, email, name, role) VALUES (?, ?, ?, ?)',
      [id, email, name || null, role]
    );

    let artisanId = null;
    if (role === 'artisan') {
      const [result] = await conn.query(
        'INSERT INTO artisans (user_id, name, skill, location, price, bio) VALUES (?, ?, ?, ?, ?, ?)',
        [id, name, artisan.skill, artisan.location, artisan.price || null, artisan.bio || null]
      );
      artisanId = result.insertId;
    }

    await conn.commit();
    res.status(201).json({ id, email, name: name || null, role, artisanId });
  } catch (err) {
    await conn.rollback();
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'That user is already saved' });
    }
    if (err.code === 'ER_DATA_TOO_LONG') {
      return res.status(400).json({ error: 'One of the fields is too long' });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to save user' });
  } finally {
    conn.release();
  }
});

module.exports = router;
