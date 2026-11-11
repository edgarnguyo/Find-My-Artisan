const { logError } = require('../monitoring');
// The routes promised in openapi.yaml. Every response here is checked against
// that file, so field names and types must match it exactly.
const express = require('express');
const router = express.Router();
const db = require('../db');
const { toDbTime, fromDbTime, busyByArtisan, overlapsExistingBlock, JOB_PARTNERS } = require('../availability');

// The database stores the job title ("Plumber"); the contract promises the
// trade ("plumbing").
const TRADES = {
  Plumber: 'plumbing',
  Electrician: 'electrical',
  Carpenter: 'carpentry',
  Painter: 'painting',
};

const COUNTIES = require('../counties');
const { verifiedSql } = require('../verified');

// verified is worked out from time on the site and reviews (see verified.js).
const SELECT_ARTISANS = `
  SELECT a.id, a.name, a.skill, a.county, a.location, a.phone, a.hourly_rate_kes,
         ${verifiedSql('a')} AS verified
  FROM artisans a`;

// The mapping step: database row in, contract shape out (ArtisanSummary).
// busy is this artisan's list from busyByArtisan(); an empty list means free throughout.
function toArtisanSummary(row, busy = []) {
  return {
    id: row.id,
    name: row.name,
    trade: TRADES[row.skill] || row.skill.toLowerCase(),
    // location holds only the area, e.g. 'Embakasi'.
    area: row.location,
    county: row.county,
    // MySQL sends BOOLEAN as 1/0; the contract says true/false.
    verified: Boolean(row.verified),
    busy,
  };
}

// Full profile (Artisan): the summary plus phone and rate. The contract's
// optional verification (certificate details) is never sent: verified is
// earned from time on the site and reviews, so there is no certificate.
function toArtisan(row, busy = []) {
  const artisan = { ...toArtisanSummary(row, busy), phone: row.phone };
  if (row.hourly_rate_kes !== null) artisan.hourlyRateKes = Number(row.hourly_rate_kes);
  return artisan;
}

function sendError(res, status, code, message) {
  res.status(status).json({ code, message });
}

// GET /artisans?trade=plumbing&county=Nairobi
router.get('/', async (req, res) => {
  const { trade, county } = req.query;

  // ?county=a&county=b arrives as an array; each filter takes one value.
  if ([trade, county].some(v => v !== undefined && typeof v !== 'string')) {
    return sendError(res, 400, 'invalid_query', 'Each query parameter can be given only once.');
  }

  if (county !== undefined && !COUNTIES.some(c => c.toLowerCase() === county.toLowerCase())) {
    return sendError(res, 400, 'invalid_query', 'county must be a known Kenyan county name.');
  }

  try {
    const [rows] = await db.query(`${SELECT_ARTISANS} ORDER BY a.id`);
    const busy = await busyByArtisan();
    let artisans = rows.map(row => toArtisanSummary(row, busy[row.id]));

    if (trade !== undefined) {
      artisans = artisans.filter(a => a.trade === trade.toLowerCase());
    }
    if (county !== undefined) {
      artisans = artisans.filter(a => a.county.toLowerCase() === county.toLowerCase());
    }

    res.status(200).json(artisans);
  } catch (err) {
    logError(err);
    sendError(res, 500, 'server_error', 'Failed to fetch artisans.');
  }
});

// GET /artisans/5
router.get('/:id', async (req, res) => {
  // MySQL would read '5abc' as 5, so only plain whole numbers are real ids.
  if (!/^\d+$/.test(req.params.id)) {
    return sendError(res, 404, 'not_found', `No artisan with id ${req.params.id}.`);
  }
  try {
    const [rows] = await db.query(`${SELECT_ARTISANS} WHERE a.id = ?`, [req.params.id]);
    if (rows.length === 0) {
      return sendError(res, 404, 'not_found', `No artisan with id ${req.params.id}.`);
    }
    const busy = await busyByArtisan(rows[0].id);
    res.status(200).json(toArtisan(rows[0], busy[rows[0].id]));
  } catch (err) {
    logError(err);
    sendError(res, 500, 'server_error', 'Failed to fetch artisan.');
  }
});

// ---------------------------------------------------------------------------
// Week 6: availability blocks (artisan-only writes)
// ---------------------------------------------------------------------------

// A date-time as the contract means it: "2026-09-14T09:00:00Z" or with an offset
// like "+03:00". A time zone is required, otherwise "09:00" is ambiguous.
const DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

function isDateTime(value) {
  if (typeof value !== 'string') return false;
  const match = DATE_TIME.exec(value);
  if (!match || Number.isNaN(Date.parse(value))) return false;
  // JavaScript quietly turns 30 February into 2 March, so check the day exists.
  const [, year, month, day] = match.map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDate() === day;
}

// The mapping step for AvailabilityBlock.
function toBlock(row) {
  return {
    id: row.id,
    artisanId: row.artisan_id,
    start: fromDbTime(row.start_at),
    end: fromDbTime(row.end_at),
    createdAt: fromDbTime(row.created_at),
  };
}

const isId = value => /^\d+$/.test(value);

async function artisanExists(id) {
  const [rows] = await db.query('SELECT id FROM artisans WHERE id = ?', [id]);
  return rows.length > 0;
}

// POST /artisans/1/availability   body: { "start": "...", "end": "..." }
// From the artisan's dashboard (/profiles), the body may also have
// "forPartner": "meditrac", marking the time as a job booked by that team.
// Partners' API calls can't set it, or a partner could log its own jobs and
// review anyone.
async function createBlock(req, res) {
  const artisanId = req.params.id;
  const { start, end } = req.body ?? {};
  const forPartner = req.consumer ? undefined : req.body?.forPartner;

  // 1. Validate. Nothing is written unless every check passes.
  if (start === undefined || end === undefined) {
    return sendError(res, 400, 'invalid_body', 'start and end are required.');
  }
  if (!isDateTime(start) || !isDateTime(end)) {
    return sendError(res, 400, 'invalid_body', 'start and end must be date-times like 2026-09-14T09:00:00Z.');
  }
  if (Date.parse(end) <= Date.parse(start)) {
    return sendError(res, 400, 'invalid_body', 'end must be after start.');
  }
  if (forPartner != null && !JOB_PARTNERS.includes(forPartner)) {
    return sendError(res, 400, 'invalid_body', `forPartner must be one of: ${JOB_PARTNERS.join(', ')}.`);
  }

  try {
    // 2. The artisan has to exist.
    if (!isId(artisanId) || !(await artisanExists(artisanId))) {
      return sendError(res, 404, 'not_found', `No artisan with id ${artisanId}.`);
    }
    if (await overlapsExistingBlock(artisanId, toDbTime(start), toDbTime(end))) {
      return sendError(res, 400, 'invalid_body', 'This window overlaps an existing block.');
    }

    // 3. Write, then read the new row back so the response shows what was saved.
    const [result] = await db.query(
      'INSERT INTO availability_blocks (artisan_id, start_at, end_at, created_at, for_partner) VALUES (?, ?, ?, ?, ?)',
      [artisanId, toDbTime(start), toDbTime(end), toDbTime(new Date()), forPartner ?? null]
    );
    const [rows] = await db.query('SELECT * FROM availability_blocks WHERE id = ?', [result.insertId]);
    res.status(201).json(toBlock(rows[0]));
  } catch (err) {
    logError(err);
    sendError(res, 500, 'server_error', 'Failed to create availability block.');
  }
}
router.post('/:id/availability', createBlock);

// Finds a block that belongs to this artisan, or null. Blocks made by accepting
// a booking (booking_id set) are never found: they are the client's booked time,
// so only the booking itself can move or free them. Otherwise anyone could free
// an artisan's booked hours by DELETE-ing ids one by one.
// fromPartner: the call came with a partner's API key. Jobs logged for a partner
// (for_partner set) are then not found either: a partner that could move its
// job into the past could unlock reviews itself. Only the artisan changes them.
async function findBlock(artisanId, blockId, fromPartner = false) {
  if (!isId(artisanId) || !isId(blockId)) return null;
  const [rows] = await db.query(
    `SELECT * FROM availability_blocks
     WHERE id = ? AND artisan_id = ? AND booking_id IS NULL AND (? = FALSE OR for_partner IS NULL)`,
    [blockId, artisanId, fromPartner]
  );
  return rows[0] ?? null;
}

// PATCH /artisans/1/availability/7   body: { "end": "..." } (either or both fields)
router.patch('/:id/availability/:blockId', async (req, res) => {
  const { id: artisanId, blockId } = req.params;
  const { start, end } = req.body ?? {};

  if (start === undefined && end === undefined) {
    return sendError(res, 400, 'invalid_body', 'Send start, end, or both.');
  }
  if ((start !== undefined && !isDateTime(start)) || (end !== undefined && !isDateTime(end))) {
    return sendError(res, 400, 'invalid_body', 'start and end must be date-times like 2026-09-14T09:00:00Z.');
  }

  try {
    const block = await findBlock(artisanId, blockId, Boolean(req.consumer));
    if (!block) {
      return sendError(res, 404, 'not_found', `No availability block with id ${blockId}.`);
    }

    // A field that wasn't sent keeps its current value.
    const newStart = start !== undefined ? toDbTime(start) : block.start_at;
    const newEnd = end !== undefined ? toDbTime(end) : block.end_at;
    if (newEnd <= newStart) {
      return sendError(res, 400, 'invalid_body', 'end must be after start.');
    }
    if (await overlapsExistingBlock(artisanId, newStart, newEnd, block.id)) {
      return sendError(res, 400, 'invalid_body', 'This window overlaps an existing block.');
    }

    // Sets absolute values, so sending the same PATCH twice gives the same result.
    await db.query(
      'UPDATE availability_blocks SET start_at = ?, end_at = ? WHERE id = ?',
      [newStart, newEnd, block.id]
    );
    const [rows] = await db.query('SELECT * FROM availability_blocks WHERE id = ?', [block.id]);
    res.status(200).json(toBlock(rows[0]));
  } catch (err) {
    logError(err);
    sendError(res, 500, 'server_error', 'Failed to update availability block.');
  }
});

// DELETE /artisans/1/availability/7
async function deleteBlock(req, res) {
  const { id: artisanId, blockId } = req.params;

  try {
    const block = await findBlock(artisanId, blockId, Boolean(req.consumer));
    if (!block) {
      return sendError(res, 404, 'not_found', `No availability block with id ${blockId}.`);
    }
    await db.query('DELETE FROM availability_blocks WHERE id = ?', [block.id]);
    // 204 means success with no body, so send() with nothing.
    res.status(204).send();
  } catch (err) {
    logError(err);
    sendError(res, 500, 'server_error', 'Failed to delete availability block.');
  }
}
router.delete('/:id/availability/:blockId', deleteBlock);

// ---------------------------------------------------------------------------
// Reviews: Meditrac rates an artisan after a job logged for Meditrac has finished, and can
// fix or remove its own reviews.
// ---------------------------------------------------------------------------

// The mapping step for Review.
function toReview(row) {
  return {
    id: row.id,
    artisanId: row.artisan_id,
    author: row.author,
    rating: row.rating,
    comment: row.comment,
    createdAt: fromDbTime(row.created_at),
  };
}

// Checks the review fields that were sent. On POST, author and rating are
// required; on PATCH (partial = true) any field may be left out, but not all
// of them. Returns an error message, or null when everything is valid.
function reviewProblem({ author, rating, comment }, partial = false) {
  if (!partial && (author === undefined || rating === undefined)) {
    return 'author and rating are required.';
  }
  if (partial && author === undefined && rating === undefined && comment === undefined) {
    return 'Send author, rating, comment, or any combination of them.';
  }
  if (author !== undefined && (typeof author !== 'string' || author.trim() === '' || author.length > 100)) {
    return 'author must be a non-empty string of at most 100 characters.';
  }
  // Number.isInteger rejects "5" (a string) and 4.5, not just values out of range.
  if (rating !== undefined && (!Number.isInteger(rating) || rating < 1 || rating > 5)) {
    return 'rating must be a whole number from 1 to 5.';
  }
  if (comment !== undefined && comment !== null && (typeof comment !== 'string' || comment.length > 1000)) {
    return 'comment must be a string of at most 1000 characters.';
  }
  return null;
}

// Finds a review of this artisan that this key posted through the API, or null.
// Reviews from the website (from_api = FALSE) and reviews another partner's key
// posted are never found, so they answer 404 as if they weren't there.
async function findApiReview(artisanId, reviewId, consumer) {
  if (!isId(artisanId) || !isId(reviewId)) return null;
  const [rows] = await db.query(
    'SELECT * FROM reviews WHERE id = ? AND artisan_id = ? AND from_api = TRUE AND api_consumer = ?',
    [reviewId, artisanId, consumer]
  );
  return rows[0] ?? null;
}

// True when the artisan has logged a job for this partner that has finished:
// its end time has passed, or the artisan marked it complete on their dashboard
// (which ends it then). Bookings with partners happen by phone, so this busy
// time, tagged on the artisan's dashboard, is our only record that the partner
// hired them.
async function hasJobFor(artisanId, consumer) {
  const [rows] = await db.query(
    `SELECT id FROM availability_blocks
     WHERE artisan_id = ? AND for_partner = ? AND end_at <= UTC_TIMESTAMP() LIMIT 1`,
    [artisanId, consumer]
  );
  return rows.length > 0;
}

// POST /artisans/1/reviews   body: { "author": "...", "rating": 5, "comment": "..." }
router.post('/:id/reviews', async (req, res) => {
  const artisanId = req.params.id;
  const { author, rating, comment } = req.body ?? {};

  const problem = reviewProblem({ author, rating, comment });
  if (problem) return sendError(res, 400, 'invalid_body', problem);

  try {
    if (!isId(artisanId) || !(await artisanExists(artisanId))) {
      return sendError(res, 404, 'not_found', `No artisan with id ${artisanId}.`);
    }
    if (!(await hasJobFor(artisanId, req.consumer))) {
      return sendError(res, 403, 'no_job',
        'You can review an artisan once a job with them has finished. Ask the artisan to log the job on Find My Artisan, or to mark it complete there.');
    }

    const [result] = await db.query(
      `INSERT INTO reviews (artisan_id, author, rating, comment, created_at, from_api, api_consumer)
       VALUES (?, ?, ?, ?, ?, TRUE, ?)`,
      [artisanId, author.trim(), rating, comment?.trim() || null, toDbTime(new Date()), req.consumer]
    );
    const [rows] = await db.query('SELECT * FROM reviews WHERE id = ?', [result.insertId]);
    res.status(201).json(toReview(rows[0]));
  } catch (err) {
    logError(err);
    sendError(res, 500, 'server_error', 'Failed to create review.');
  }
});

// PATCH /artisans/1/reviews/7   body: any of { "author", "rating", "comment" }
router.patch('/:id/reviews/:reviewId', async (req, res) => {
  const { id: artisanId, reviewId } = req.params;
  const { author, rating, comment } = req.body ?? {};

  const problem = reviewProblem({ author, rating, comment }, true);
  if (problem) return sendError(res, 400, 'invalid_body', problem);

  try {
    const review = await findApiReview(artisanId, reviewId, req.consumer);
    if (!review) {
      return sendError(res, 404, 'not_found', `No review with id ${reviewId} for artisan ${artisanId}.`);
    }

    // A field that wasn't sent keeps its current value. Sending comment: null
    // clears it. Values are set, not added to, so the same PATCH twice gives the
    // same review.
    const newAuthor = author !== undefined ? author.trim() : review.author;
    const newRating = rating !== undefined ? rating : review.rating;
    const newComment = comment !== undefined ? (comment?.trim() || null) : review.comment;

    await db.query(
      'UPDATE reviews SET author = ?, rating = ?, comment = ? WHERE id = ?',
      [newAuthor, newRating, newComment, review.id]
    );
    const [rows] = await db.query('SELECT * FROM reviews WHERE id = ?', [review.id]);
    res.status(200).json(toReview(rows[0]));
  } catch (err) {
    logError(err);
    sendError(res, 500, 'server_error', 'Failed to update review.');
  }
});

// DELETE /artisans/1/reviews/7
router.delete('/:id/reviews/:reviewId', async (req, res) => {
  const { id: artisanId, reviewId } = req.params;

  try {
    const review = await findApiReview(artisanId, reviewId, req.consumer);
    if (!review) {
      return sendError(res, 404, 'not_found', `No review with id ${reviewId} for artisan ${artisanId}.`);
    }
    await db.query('DELETE FROM reviews WHERE id = ?', [review.id]);
    res.status(204).send();
  } catch (err) {
    logError(err);
    sendError(res, 500, 'server_error', 'Failed to delete review.');
  }
});

module.exports = router;
// The website's /profiles/:id/availability routes reuse these without an API key.
module.exports.createBlock = createBlock;
module.exports.deleteBlock = deleteBlock;
// Week 13: v1 (routes/artisansV1.js) reuses these so both versions check review
// fields the same way. Exporting them changes nothing about any response.
module.exports.helpers = { isId, artisanExists, reviewProblem, toReview, sendError };
