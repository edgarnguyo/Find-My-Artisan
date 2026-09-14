const express = require('express');
const router = express.Router();
const db = require('../db');

// GET all clients (without the password, which must never be sent to the browser)
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, name, email, phone, location, created_at FROM clients ORDER BY id'
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch clients' });
  }
});

// POST a new client (the sign-up form, "A client")
router.post('/', async (req, res) => {
  const { name, email, password, phone, location } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email and password are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  try {
    // One email can't be both a client and an artisan, so check both tables.
    const [taken] = await db.query(
      'SELECT id FROM clients WHERE email = ? UNION SELECT id FROM artisans WHERE email = ?',
      [email, email]
    );
    if (taken.length > 0) {
      return res.status(409).json({ error: 'An account with that email already exists' });
    }

    // The ? placeholders keep the typed values separate from the SQL,
    // so nothing typed into the form can run as SQL.
    const [result] = await db.query(
      'INSERT INTO clients (name, email, password, phone, location) VALUES (?, ?, ?, ?, ?)',
      [name, email, password, phone || null, location || null]
    );

    res.status(201).json({ id: result.insertId, name, email, role: 'client' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create client' });
  }
});

module.exports = router;
