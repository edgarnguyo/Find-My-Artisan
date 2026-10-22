const express = require('express');
const router = express.Router();
const db = require('../db');
const { busyByArtisan, fromDbTime } = require('../availability');
const COUNTIES = require('../counties');
const { inTransaction } = require('../transaction');
const { checkPassword, sentPasswordProblem, changePasswordRoute } = require('../accounts');
const { verifiedSql } = require('../verified');
const { createBlock, deleteBlock } = require('./artisans');

// Every column except email and password, which must never be sent to the browser.
// The artisans.rating column is a fixed number from the sample data, so the
// rating is worked out from the reviews instead: their average to one decimal,
// or NULL (shown as "New") when there are none yet. jobs_completed adds the
// jobs finished through the site to the count the artisan started with.
// verified is earned from time on the site and reviews (see verified.js).
const COLUMNS = `id, name, skill, ${verifiedSql('artisans')} AS verified, price, photo, location, county, bio, phone, hourly_rate_kes,
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

    // Newest first, like the reviews.
    const [portfolio] = await db.query(
      `SELECT id, title, description, image_url, work_date FROM portfolio_items
       WHERE artisan_id = ? ORDER BY id DESC`,
      [artisan.id]
    );

    // The same 14-day busy list Meditrac gets from GET /artisans/:id.
    const busy = await busyByArtisan(artisan.id);

    res.json({
      ...artisan, languages, work_history: workHistory, reviews, portfolio,
      busy: busy[artisan.id] ?? [],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch artisan' });
  }
});

// GET the artisan's own busy times that haven't ended yet, for their dashboard.
// Unlike the contract's busy list, each one has its id (so it can be removed
// with DELETE /profiles/:id/availability/:blockId) and, if it was made by
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

// The dashboard adds and removes busy times here. These run the same code as
// POST and DELETE /artisans/:id/availability, but without the partners' API
// key, which must never be put in the website's JavaScript.
router.post('/:id/availability', createBlock);
router.delete('/:id/availability/:blockId', deleteBlock);

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

// ---------------------------------------------------------------------------
// Phase 4: artisans edit their own profile and portfolio from the dashboard.
// ---------------------------------------------------------------------------

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const PORTFOLIO_LIMIT = 12;

// Text that must be present when sent: a non-empty string of at most max characters.
const isText = (value, max) => typeof value === 'string' && value.trim() !== '' && value.length <= max;

// Only https links, so a photo can't be served over an insecure connection and
// nothing like "javascript:..." ends up in the page.
function isHttpsUrl(value) {
  if (typeof value !== 'string' || value.length > 500) return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

// The profile fields an artisan can change, with the column each is saved in
// and the check its value must pass. Sending null clears an optional field.
const EDITABLE = {
  name: { column: 'name', ok: v => isText(v, 100) },
  location: { column: 'location', ok: v => isText(v, 100) },
  county: { column: 'county', ok: v => typeof v === 'string' && COUNTIES.includes(v) },
  phone: { column: 'phone', ok: v => isText(v, 20) },
  price: { column: 'price', ok: v => v === null || (typeof v === 'string' && v.length <= 50) },
  bio: { column: 'bio', ok: v => v === null || (typeof v === 'string' && v.length <= 2000) },
  hourlyRateKes: {
    column: 'hourly_rate_kes',
    ok: v => v === null || (Number.isInteger(v) && v >= 1 && v <= 100000),
  },
};

const MESSAGES = {
  name: 'name must be text of at most 100 characters',
  location: 'area must be text of at most 100 characters',
  county: 'county must be one of Kenya\'s 47 counties',
  phone: 'phone must be text of at most 20 characters',
  price: 'price must be text of at most 50 characters',
  bio: 'bio must be text of at most 2000 characters',
  hourlyRateKes: 'hourlyRateKes must be a whole number from 1 to 100000',
};

async function artisanExists(id) {
  const [rows] = await db.query('SELECT id FROM artisans WHERE id = ?', [id]);
  return rows.length > 0;
}

// PATCH /profiles/5  with any of { name, location, county, phone, price, bio, hourlyRateKes }
// Only the fields sent are changed. The skill isn't editable: the artisan's
// reviews and verified badge were earned in that trade.
router.patch('/:id', async (req, res) => {
  const body = req.body ?? {};
  const fields = Object.keys(body).filter(key => key in EDITABLE);

  if (fields.length === 0) {
    return res.status(400).json({ error: `Send at least one of: ${Object.keys(EDITABLE).join(', ')}` });
  }
  const bad = fields.find(key => !EDITABLE[key].ok(body[key]));
  if (bad) {
    return res.status(400).json({ error: MESSAGES[bad] });
  }

  try {
    if (!(await artisanExists(req.params.id))) {
      return res.status(404).json({ error: 'Artisan not found' });
    }
    // Column names come from EDITABLE in this file, never from the request;
    // the values go in as ? placeholders.
    const sets = fields.map(key => `${EDITABLE[key].column} = ?`).join(', ');
    const values = fields.map(key => (typeof body[key] === 'string' ? body[key].trim() || null : body[key]));
    await db.query(`UPDATE artisans SET ${sets} WHERE id = ?`, [...values, req.params.id]);

    const [rows] = await db.query(`SELECT ${COLUMNS} FROM artisans WHERE id = ?`, [req.params.id]);
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// POST /profiles/5/portfolio  with { title, imageUrl, description?, workDate? }
router.post('/:id/portfolio', async (req, res) => {
  const { title, imageUrl, description, workDate } = req.body ?? {};

  if (!isText(title, 100)) {
    return res.status(400).json({ error: 'title is required, at most 100 characters' });
  }
  if (!isHttpsUrl(imageUrl)) {
    return res.status(400).json({ error: 'imageUrl must be a link starting with https://' });
  }
  if (description != null && (typeof description !== 'string' || description.length > 500)) {
    return res.status(400).json({ error: 'description must be text of at most 500 characters' });
  }
  if (workDate != null && (typeof workDate !== 'string' || !DATE.test(workDate)
      || Number.isNaN(Date.parse(workDate)) || workDate > new Date().toISOString().slice(0, 10))) {
    return res.status(400).json({ error: 'workDate must be a date like 2026-05-14, not in the future' });
  }

  try {
    if (!(await artisanExists(req.params.id))) {
      return res.status(404).json({ error: 'Artisan not found' });
    }
    const [[{ count }]] = await db.query(
      'SELECT COUNT(*) AS count FROM portfolio_items WHERE artisan_id = ?',
      [req.params.id]
    );
    if (count >= PORTFOLIO_LIMIT) {
      return res.status(409).json({ error: `A portfolio holds up to ${PORTFOLIO_LIMIT} items. Remove one first.` });
    }

    const [result] = await db.query(
      `INSERT INTO portfolio_items (artisan_id, title, description, image_url, work_date)
       VALUES (?, ?, ?, ?, ?)`,
      [req.params.id, title.trim(), description?.trim() || null, imageUrl, workDate || null]
    );
    const [rows] = await db.query(
      'SELECT id, title, description, image_url, work_date FROM portfolio_items WHERE id = ?',
      [result.insertId]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add portfolio item' });
  }
});

// DELETE /profiles/5/portfolio/9
router.delete('/:id/portfolio/:itemId', async (req, res) => {
  try {
    // "AND artisan_id = ?" only removes the item if it's this artisan's.
    const [result] = await db.query(
      'DELETE FROM portfolio_items WHERE id = ? AND artisan_id = ?',
      [req.params.itemId, req.params.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Portfolio item not found' });
    }
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to remove portfolio item' });
  }
});

// PATCH /profiles/5/password  with { currentPassword, newPassword }
router.patch('/:id/password', changePasswordRoute('artisan'));

// DELETE /profiles/5  with { password }
// Refused while the artisan has requests or accepted jobs open, so no client's
// booking disappears without an answer. Otherwise the artisan and everything
// attached to them (past bookings, reviews, portfolio, busy times, scrap
// reports) is removed.
router.delete('/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const result = await checkPassword('artisan', id, req.body?.password);
    if (sentPasswordProblem(res, result)) return;

    const [[{ open }]] = await db.query(
      "SELECT COUNT(*) AS open FROM bookings WHERE artisan_id = ? AND status IN ('pending', 'confirmed')",
      [id]
    );
    if (open > 0) {
      return res.status(409).json({
        error: `You have ${open} open job${open === 1 ? '' : 's'}. Decline or complete ${open === 1 ? 'it' : 'them'} first.`,
      });
    }

    // Rows that point at the artisan (or at their bookings) go first: MySQL
    // won't delete a row something else still points at.
    await inTransaction(async conn => {
      for (const table of ['availability_blocks', 'reviews', 'portfolio_items',
        'languages', 'work_history', 'verifications', 'scrap_drop_offs', 'bookings']) {
        await conn.query(`DELETE FROM ${table} WHERE artisan_id = ?`, [id]);
      }
      await conn.query('DELETE FROM artisans WHERE id = ?', [id]);
    });
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

module.exports = router;
