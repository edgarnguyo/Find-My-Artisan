const express = require('express');
const router = express.Router();
const db = require('../db');
const { busyByArtisan, fromDbTime } = require('../availability');

// Every column except email and password, which must never be sent to the browser.
// The artisans.rating column is a fixed number from the sample data, so the
// rating is worked out from the reviews instead: their average to one decimal,
// or NULL (shown as "New") when there are none yet. jobs_completed adds the
// jobs finished through the site to the count the artisan started with.
const COLUMNS = `id, name, skill, verified, price, photo, location, county, bio,
  (SELECT ROUND(AVG(r.rating), 1) FROM reviews r WHERE r.artisan_id = artisans.id) AS rating,
  (SELECT COUNT(*) FROM reviews r WHERE r.artisan_id = artisans.id) AS review_count,
  job_success, hours_per_week, total_earnings, hours_worked,
  jobs_completed + (SELECT COUNT(*) FROM bookings b
                    WHERE b.artisan_id = artisans.id AND b.status = 'completed') AS jobs_completed`;

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
    // Newest first, so a client's new review is at the top.
    const [reviews] = await db.query(
      'SELECT author, rating, comment FROM reviews WHERE artisan_id = ? ORDER BY id DESC',
      [artisan.id]
    );

    // The same 14-day busy list Meditrac gets from GET /artisans/:id.
    const busy = await busyByArtisan(artisan.id);

    res.json({ ...artisan, languages, work_history: workHistory, reviews, busy: busy[artisan.id] ?? [] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch artisan' });
  }
});

// GET the artisan's own busy times that haven't ended yet, for their dashboard.
// Unlike the contract's busy list, each one has its id (so it can be removed
// with DELETE /artisans/:id/availability/:blockId) and, if it was made by
// accepting a booking, that booking's id and job.
router.get('/:id/availability', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT availability_blocks.id, availability_blocks.start_at, availability_blocks.end_at,
              availability_blocks.booking_id, bookings.job
       FROM availability_blocks
       LEFT JOIN bookings ON bookings.id = availability_blocks.booking_id
       WHERE availability_blocks.artisan_id = ? AND availability_blocks.end_at > UTC_TIMESTAMP()
       ORDER BY availability_blocks.start_at`,
      [req.params.id]
    );
    res.json(rows.map(row => ({
      id: row.id,
      start: fromDbTime(row.start_at),
      end: fromDbTime(row.end_at),
      bookingId: row.booking_id,
      job: row.job,
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch busy times' });
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
