const { logError } = require('../monitoring');
const express = require('express');
const router = express.Router();
const db = require('../db');

const { MATERIAL_TYPES, UNAVAILABLE, PartnerUnavailable, callPartner, fetchMaterials } = require('../kanairo');
const { requireSignIn } = require('../session');
const { partnerVersion } = require('../kanairoVersions');

// Website-only: data from our upstream partner, Kanairo-Klean (Team 13). The
// page asks this server, and kanairo.js adds the token from server/.env.

// Week 11: the last list Kanairo sent for each filter ('' = all types), as
// { data, asOf }. Shown, labelled as saved, when Kanairo can't be reached.
// Kept in memory for speed, and in the partner_saved_lists table so it
// survives a restart: Render's free plan restarts the server after it sits idle.
const lastGood = new Map();

// Tests run against the same database as the live site, so their lists are
// saved under their own keys and never replace the real saved prices.
const KEY_PREFIX = process.env.NODE_ENV === 'test' ? 'test:' : '';

// MySQL DATETIME(3) text '2026-11-08 16:14:05.123' <-> ISO '2026-11-08T16:14:05.123Z'.
const toDbTime = iso => iso.replace('T', ' ').replace('Z', '');
const fromDbTime = text => `${text.replace(' ', 'T')}Z`;

// Saving is a backup, so a database problem is logged and the live list is
// still sent: the user shouldn't lose it because the copy couldn't be kept.
async function saveList(key, saved) {
  lastGood.set(key, saved);
  try {
    await db.query(
      `INSERT INTO partner_saved_lists (list_key, data, saved_at) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE data = VALUES(data), saved_at = VALUES(saved_at)`,
      [KEY_PREFIX + key, JSON.stringify(saved.data), toDbTime(saved.asOf)]
    );
  } catch (err) {
    logError(err);
  }
}

// The saved list for this filter, or undefined. Memory first; after a restart
// memory is empty, so the copy in the database is used and kept in memory.
async function findSavedList(key) {
  if (lastGood.has(key)) return lastGood.get(key);
  try {
    const [[row]] = await db.query(
      'SELECT data, saved_at FROM partner_saved_lists WHERE list_key = ?',
      [KEY_PREFIX + key]
    );
    if (!row) return undefined;
    const saved = { data: JSON.parse(row.data), asOf: fromDbTime(row.saved_at) };
    lastGood.set(key, saved);
    return saved;
  } catch (err) {
    logError(err);
    return undefined;
  }
}

// GET /partner/materials?type=metal
// Answers { data: [materials], stale, asOf }. stale is true when Kanairo
// couldn't be reached and data is the copy saved at asOf.
router.get('/materials', async (req, res) => {
  const { type } = req.query;
  if (type !== undefined && !MATERIAL_TYPES.includes(type)) {
    return res.status(400).json({ error: `type must be one of: ${MATERIAL_TYPES.join(', ')}` });
  }

  const key = type ?? '';
  let data;
  try {
    data = await fetchMaterials(type);
  } catch (err) {
    // kanairo.js has already logged why (timeout, ECONNREFUSED, a status...).
    if (!(err instanceof PartnerUnavailable)) logError(err);
    const saved = await findSavedList(key);
    if (saved) {
      console.error(`Kanairo-Klean: serving materials saved at ${saved.asOf}`);
      return res.json({ data: saved.data, stale: true, asOf: saved.asOf });
    }
    return res.status(502).json({ error: UNAVAILABLE });
  }

  const saved = { data, asOf: new Date().toISOString() };
  await saveList(key, saved);
  res.json({ data, stale: false, asOf: saved.asOf });
});

// For the tests, so each one starts with nothing saved: clears memory and the
// tests' own rows (the live site's saved lists are left alone).
router.forgetSavedMaterials = async () => {
  lastGood.clear();
  await db.query("DELETE FROM partner_saved_lists WHERE list_key LIKE 'test:%'");
};
// For the tests: forget memory only, as a server restart does.
router.forgetMemoryOnly = () => lastGood.clear();

// GET /partner/collection-locations: the yards that take scrap drop-offs.
// Kanairo lists only active ones, so is_active is left out.
router.get('/collection-locations', async (req, res) => {
  try {
    // Week 13: /collection-locations or /v2/collection-locations (kanairoVersions.js).
    const ver = partnerVersion();
    const { status, body } = await callPartner(`${ver.prefix}/collection-locations`);
    if (status !== 200) return res.status(502).json({ error: UNAVAILABLE });
    let locations;
    try {
      locations = ver.list(body);
    } catch (err) {
      console.error(`Kanairo-Klean GET /collection-locations: ${err.message}`);
      return res.status(502).json({ error: UNAVAILABLE });
    }
    res.json(
      locations.map(l => ({ id: l.location_id, name: l.name, area: l.area, county: l.county }))
    );
  } catch (err) {
    if (!(err instanceof PartnerUnavailable)) logError(err);
    res.status(502).json({ error: UNAVAILABLE });
  }
});

// POST /partner/drop-offs: an artisan reports scrap left over from a completed job.
// Body: { bookingId, locationId, locationName?, materialType, quantityKg, notes? },
// from the signed-in artisan (session.js); an artisanId in the body is ignored.
// Sent on to Kanairo's POST /collection-locations/{location_id}/drop-offs, and a
// copy kept in scrap_drop_offs so the dashboard shows it and it isn't sent twice.
router.post('/drop-offs', requireSignIn('artisan'), async (req, res) => {
  const artisanId = req.account.id;
  const { bookingId, locationId, locationName, materialType, quantityKg, notes } = req.body ?? {};

  // Validate first, so a mistake costs no call to Kanairo. The limits are theirs.
  if (!bookingId) {
    return res.status(400).json({ error: 'bookingId is required' });
  }
  if (typeof locationId !== 'string' || !locationId || locationId.length > 50) {
    return res.status(400).json({ error: 'Choose a collection yard' });
  }
  // Only shown on the dashboard, so it isn't checked against Kanairo's list.
  if (locationName !== undefined && (typeof locationName !== 'string' || locationName.length > 100)) {
    return res.status(400).json({ error: 'locationName must be text of at most 100 characters' });
  }
  if (!MATERIAL_TYPES.includes(materialType)) {
    return res.status(400).json({ error: `materialType must be one of: ${MATERIAL_TYPES.join(', ')}` });
  }
  // DECIMAL(8, 2) holds up to 999999.99.
  if (typeof quantityKg !== 'number' || !(quantityKg > 0) || quantityKg >= 1e6) {
    return res.status(400).json({ error: 'quantityKg must be a number above 0 and below 1,000,000' });
  }
  if (notes !== undefined && (typeof notes !== 'string' || notes.length > 500)) {
    return res.status(400).json({ error: 'notes must be text of at most 500 characters' });
  }

  // The row reserved for this report, removed again if Kanairo doesn't accept it.
  let reservedId = null;
  const release = async () => {
    if (reservedId) await db.query('DELETE FROM scrap_drop_offs WHERE id = ?', [reservedId]);
  };

  try {
    // Only the artisan who did the job, and only once it's completed: the scrap
    // has to come from a real finished job on our site.
    const [[booking]] = await db.query(
      `SELECT bookings.status, artisans.skill
       FROM bookings JOIN artisans ON artisans.id = bookings.artisan_id
       WHERE bookings.id = ? AND bookings.artisan_id = ?`,
      [bookingId, artisanId]
    );
    if (!booking) return res.status(404).json({ error: 'No job of yours has that id' });
    if (booking.status !== 'completed') {
      return res.status(409).json({ error: 'Scrap can only be reported for a completed job' });
    }

    // Kanairo's notes must be at least 1 character when sent, so a blank isn't sent.
    const trimmedNotes = notes?.trim() || null;

    // Reserve the row BEFORE calling Kanairo. The UNIQUE key on (booking_id,
    // material_type) makes a second report of the same material fail here, so
    // a double click or a second tab can't send Kanairo the same scrap twice.
    try {
      const [result] = await db.query(
        `INSERT INTO scrap_drop_offs
           (booking_id, artisan_id, location_id, location_name, material_type, quantity_kg, notes, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'sending')`,
        [bookingId, artisanId, locationId, locationName ?? null, materialType, quantityKg, trimmedNotes]
      );
      reservedId = result.insertId;
    } catch (err) {
      if (err.code !== 'ER_DUP_ENTRY') throw err;
      return res.status(409).json({ error: `You already reported ${materialType} for this job` });
    }

    // Kanairo's free-text "who is dropping this off", at most 120 characters.
    const source = `Find My Artisan, ${booking.skill.toLowerCase()} job #${bookingId}`.slice(0, 120);

    const { status, body } = await callPartner(
      `/collection-locations/${encodeURIComponent(locationId)}/drop-offs`,
      {
        method: 'POST',
        body: {
          material_type: materialType,
          quantity_kg: quantityKg,
          source,
          ...(trimmedNotes && { notes: trimmedNotes }),
        },
      }
    );

    if (status === 201) {
      await db.query(
        'UPDATE scrap_drop_offs SET kanairo_drop_off_id = ?, status = ? WHERE id = ?',
        [body.drop_off_id, body.status, reservedId]
      );
      return res.status(201).json({
        id: body.drop_off_id,
        locationId: body.location_id,
        materialType: body.material_type,
        quantityKg: body.quantity_kg,
        status: body.status,
        createdAt: body.created_at,
      });
    }

    // Not accepted: free the row so the artisan can try again.
    await release();
    // Their 404: the yard closed after the form loaded its list.
    if (status === 404) {
      return res.status(404).json({ error: 'That collection yard is no longer taking drop-offs. Pick another.' });
    }
    // Their 400 after our own checks passed means the two sides read the
    // contract differently. Show their reason; it belongs in the integration log.
    if (status === 400) {
      return res.status(400).json({ error: `Kanairo-Klean refused it: ${body?.message ?? 'invalid drop-off'}` });
    }
    res.status(502).json({ error: UNAVAILABLE });
  } catch (err) {
    if (!(err instanceof PartnerUnavailable)) logError(err);
    try {
      await release();
    } catch (releaseErr) {
      logError(releaseErr);
    }
    res.status(502).json({ error: UNAVAILABLE });
  }
});

module.exports = router;
