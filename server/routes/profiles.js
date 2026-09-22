const express = require('express');
const router = express.Router();
const db = require('../db');

// Every column except email and password, which must never be sent to the browser.
const COLUMNS = `id, name, skill, verified, price, photo, location, county, bio, rating,
  job_success, hours_per_week, total_earnings, jobs_completed, hours_worked`;

// Website-only routes, not part of openapi.yaml: the profile pages need photos,
// bios, prices, reviews and so on, which the contract doesn't include.

// GET all artisans
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(`SELECT ${COLUMNS} FROM artisans ORDER BY id`);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch artisans' });
  }
});

// GET one artisan, with their languages, work history and reviews
router.get('/:id', async (req, res) => {
  try {
    const [artisans] = await db.query(`SELECT ${COLUMNS} FROM artisans WHERE id = ?`, [req.params.id]);
    if (artisans.length === 0) {
      return res.status(404).json({ error: 'Artisan not found' });
    }
    const artisan = artisans[0];

    const [languages] = await db.query(
      'SELECT name, level FROM languages WHERE artisan_id = ?',
      [artisan.id]
    );
    const [workHistory] = await db.query(
      'SELECT title, rating, date_range, price, price_type FROM work_history WHERE artisan_id = ?',
      [artisan.id]
    );
    const [reviews] = await db.query(
      'SELECT author, rating, comment FROM reviews WHERE artisan_id = ?',
      [artisan.id]
    );

    res.json({ ...artisan, languages, work_history: workHistory, reviews });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch artisan' });
  }
});

// POST a new artisan (the sign-up form, "An artisan")
router.post('/', async (req, res) => {
  const { name, email, password, skill, location, county, phone, price, bio } = req.body;

  if (!name || !email || !password || !skill || !location || !county || !phone) {
    return res.status(400).json({ error: 'Name, email, password, skill, area, county and phone are required' });
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
      'INSERT INTO artisans (name, email, password, skill, location, county, phone, price, bio) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [name, email, password, skill, location, county, phone, price || null, bio || null]
    );

    res.status(201).json({ id: result.insertId, name, email, role: 'artisan' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create artisan' });
  }
});

module.exports = router;
