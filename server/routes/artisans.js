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

module.exports = router;
