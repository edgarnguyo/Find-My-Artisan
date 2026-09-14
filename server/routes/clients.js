const express = require('express');
const router = express.Router();
const db = require('../db');

// GET all clients with their login email. For checking sign-ups during development.
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT c.id, c.user_id, c.name, u.email, c.phone, c.location, c.created_at
       FROM clients c
       JOIN users u ON u.id = c.user_id
       ORDER BY c.id`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch clients' });
  }
});

module.exports = router;
