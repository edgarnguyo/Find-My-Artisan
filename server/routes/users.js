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

// POST a new user: { id, email } of the Supabase account that was just created
router.post('/', async (req, res) => {
  const { id, email } = req.body ?? {};
  if (!id || !email) {
    return res.status(400).json({ error: 'id and email are required' });
  }

  try {
    // The ? placeholders send the values separately from the SQL text, so an
    // email containing quotes or SQL is stored as plain text, never run.
    await db.query('INSERT INTO users (id, email) VALUES (?, ?)', [id, email]);
    res.status(201).json({ id, email });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'That user is already saved' });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to save user' });
  }
});

module.exports = router;
