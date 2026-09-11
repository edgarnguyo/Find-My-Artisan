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

// GET one artisan with their languages, work history and reviews
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [[artisan]] = await db.query('SELECT * FROM artisans WHERE id = ?', [id]);
    if (!artisan) {
      return res.status(404).json({ error: 'Artisan not found' });
    }

    // The three queries don't depend on each other, so run them at the same time.
    const [[languages], [workHistory], [reviews]] = await Promise.all([
      db.query('SELECT name, level FROM languages WHERE artisan_id = ? ORDER BY id', [id]),
      db.query(
        'SELECT title, rating, date_range, price, price_type FROM work_history WHERE artisan_id = ? ORDER BY id',
        [id]
      ),
      db.query('SELECT author, rating, comment, created_at FROM reviews WHERE artisan_id = ? ORDER BY id', [id]),
    ]);

    res.json({ ...artisan, languages, work_history: workHistory, reviews });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch artisan' });
  }
});

module.exports = router;
