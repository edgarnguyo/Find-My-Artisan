// The routes promised in openapi.yaml. Every response here is checked against
// that file, so field names and types must match it exactly.
const express = require('express');
const router = express.Router();
const db = require('../db');

// The database stores the job title ("Plumber"); the contract promises the
// trade ("plumbing").
const TRADES = {
  Plumber: 'plumbing',
  Electrician: 'electrical',
  Carpenter: 'carpentry',
  Painter: 'painting',
};

const COUNTIES = [
  'Baringo', 'Bomet', 'Bungoma', 'Busia', 'Elgeyo-Marakwet', 'Embu', 'Garissa',
  'Homa Bay', 'Isiolo', 'Kajiado', 'Kakamega', 'Kericho', 'Kiambu', 'Kilifi',
  'Kirinyaga', 'Kisii', 'Kisumu', 'Kitui', 'Kwale', 'Laikipia', 'Lamu', 'Machakos',
  'Makueni', 'Mandera', 'Marsabit', 'Meru', 'Migori', 'Mombasa', "Murang'a",
  'Nairobi', 'Nakuru', 'Nandi', 'Narok', 'Nyamira', 'Nyandarua', 'Nyeri',
  'Samburu', 'Siaya', 'Taita-Taveta', 'Tana River', 'Tharaka-Nithi', 'Trans Nzoia',
  'Turkana', 'Uasin Gishu', 'Vihiga', 'Wajir', 'West Pokot',
];

// available_today is 1 unless a block in availability_blocks covers right now.
// UTC_TIMESTAMP() because the blocks are stored in UTC.
const SELECT_ARTISANS = `
  SELECT a.id, a.name, a.skill, a.county, a.location, a.verified, a.phone, a.hourly_rate_kes,
         v.issuing_body, v.certificate_id, v.expires_on,
         NOT EXISTS (
           SELECT 1 FROM availability_blocks b
           WHERE b.artisan_id = a.id
             AND b.start_at <= UTC_TIMESTAMP() AND b.end_at > UTC_TIMESTAMP()
         ) AS available_today
  FROM artisans a
  LEFT JOIN verifications v ON v.artisan_id = a.id`;

// The mapping step: database row in, contract shape out (ArtisanSummary).
function toArtisanSummary(row) {
  return {
    id: row.id,
    name: row.name,
    trade: TRADES[row.skill] || row.skill.toLowerCase(),
    // Artisans who signed up after the county column was added only have location.
    county: row.county || row.location.split(',').pop().trim(),
    // MySQL sends BOOLEAN as 1/0; the contract says true/false.
    verified: Boolean(row.verified),
    availableToday: Boolean(row.available_today),
  };
}

// Full profile (Artisan): the summary plus phone, rate and certificate.
function toArtisan(row) {
  const artisan = { ...toArtisanSummary(row), phone: row.phone };
  if (row.hourly_rate_kes !== null) artisan.hourlyRateKes = Number(row.hourly_rate_kes);
  // The contract says verification is present only when verified is true.
  if (artisan.verified && row.certificate_id) {
    artisan.verification = {
      issuingBody: row.issuing_body,
      certificateId: row.certificate_id,
      expiresOn: row.expires_on,
    };
  }
  return artisan;
}

function sendError(res, status, code, message) {
  res.status(status).json({ code, message });
}

// GET /api/artisans?trade=plumbing&county=Nairobi&availableToday=true
router.get('/', async (req, res) => {
  const { trade, county, availableToday } = req.query;

  // ?county=a&county=b arrives as an array; each filter takes one value.
  if ([trade, county, availableToday].some(v => v !== undefined && typeof v !== 'string')) {
    return sendError(res, 400, 'invalid_query', 'Each query parameter can be given only once.');
  }

  if (county !== undefined && !COUNTIES.some(c => c.toLowerCase() === county.toLowerCase())) {
    return sendError(res, 400, 'invalid_query', 'county must be a known Kenyan county name.');
  }
  if (availableToday !== undefined && availableToday !== 'true' && availableToday !== 'false') {
    return sendError(res, 400, 'invalid_query', 'availableToday must be true or false.');
  }

  try {
    const [rows] = await db.query(`${SELECT_ARTISANS} ORDER BY a.id`);
    let artisans = rows.map(toArtisanSummary);

    if (trade !== undefined) {
      artisans = artisans.filter(a => a.trade === trade.toLowerCase());
    }
    if (county !== undefined) {
      artisans = artisans.filter(a => a.county.toLowerCase() === county.toLowerCase());
    }
    if (availableToday !== undefined) {
      artisans = artisans.filter(a => a.availableToday === (availableToday === 'true'));
    }

    res.status(200).json(artisans);
  } catch (err) {
    console.error(err);
    sendError(res, 500, 'server_error', 'Failed to fetch artisans.');
  }
});

// GET /api/artisans/5
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
    res.status(200).json(toArtisan(rows[0]));
  } catch (err) {
    console.error(err);
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

// Stored in MySQL as UTC text '2026-09-14 09:00:00' (DATETIME has no time zone).
function toDbTime(value) {
  return new Date(value).toISOString().slice(0, 19).replace('T', ' ');
}

// And back out as the contract's '2026-09-14T09:00:00Z'.
function fromDbTime(value) {
  return value.replace(' ', 'T') + 'Z';
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

// Two windows overlap when each starts before the other ends. On PATCH the
// block being changed is skipped, so it can't clash with its own old window.
async function overlapsExistingBlock(artisanId, start, end, skipBlockId = null) {
  const [rows] = await db.query(
    `SELECT id FROM availability_blocks
     WHERE artisan_id = ? AND start_at < ? AND end_at > ? AND id <> ?`,
    [artisanId, end, start, skipBlockId ?? 0]
  );
  return rows.length > 0;
}

// POST /api/artisans/1/availability   body: { "start": "...", "end": "..." }
router.post('/:id/availability', async (req, res) => {
  const artisanId = req.params.id;
  const { start, end } = req.body ?? {};

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
      'INSERT INTO availability_blocks (artisan_id, start_at, end_at, created_at) VALUES (?, ?, ?, ?)',
      [artisanId, toDbTime(start), toDbTime(end), toDbTime(new Date())]
    );
    const [rows] = await db.query('SELECT * FROM availability_blocks WHERE id = ?', [result.insertId]);
    res.status(201).json(toBlock(rows[0]));
  } catch (err) {
    console.error(err);
    sendError(res, 500, 'server_error', 'Failed to create availability block.');
  }
});

// Finds a block that belongs to this artisan, or null.
async function findBlock(artisanId, blockId) {
  if (!isId(artisanId) || !isId(blockId)) return null;
  const [rows] = await db.query(
    'SELECT * FROM availability_blocks WHERE id = ? AND artisan_id = ?',
    [blockId, artisanId]
  );
  return rows[0] ?? null;
}

// PATCH /api/artisans/1/availability/7   body: { "end": "..." } (either or both fields)
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
    const block = await findBlock(artisanId, blockId);
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
    console.error(err);
    sendError(res, 500, 'server_error', 'Failed to update availability block.');
  }
});

// DELETE /api/artisans/1/availability/7
router.delete('/:id/availability/:blockId', async (req, res) => {
  const { id: artisanId, blockId } = req.params;

  try {
    const block = await findBlock(artisanId, blockId);
    if (!block) {
      return sendError(res, 404, 'not_found', `No availability block with id ${blockId}.`);
    }
    await db.query('DELETE FROM availability_blocks WHERE id = ?', [block.id]);
    // 204 means success with no body, so send() with nothing.
    res.status(204).send();
  } catch (err) {
    console.error(err);
    sendError(res, 500, 'server_error', 'Failed to delete availability block.');
  }
});

module.exports = router;
