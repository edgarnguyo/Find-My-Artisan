const express = require('express');
const router = express.Router();
const db = require('../db');

// GET all accounts, with the name from their client or artisan profile.
// For checking sign-ups during development. password_hash is deliberately not
// selected: hashes never leave the server.
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT u.id, u.email, u.role, COALESCE(c.name, a.name) AS name, u.created_at
       FROM users u
       LEFT JOIN clients c ON c.user_id = u.id
       LEFT JOIN artisans a ON a.user_id = u.id
       ORDER BY u.id`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

module.exports = router;
