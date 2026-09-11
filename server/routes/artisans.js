const express = require('express');
const router = express.Router();
const db = require('../db');

// GET all artisans
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM artisans ORDER BY id');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch artisans' });
  }
});

module.exports = router;
