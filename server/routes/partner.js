const express = require('express');
const router = express.Router();
const db = require('../db');

// Website-only: data from our upstream partner, Kanairo-Klean (Team 13). Their
// contract is openapi.yaml in github.com/berur874/Kanairo-cleaan (v1.1.0).
//
// The browser never calls Kanairo itself. If it did, the partner's token would sit
// in the page's JavaScript where anyone can read it. So the page asks this server,
// and this server adds the token from server/.env.

// The fixed list from their contract (MaterialType). Checked here so a bad value
// gets our own 400 instead of using up a call to the partner.
const MATERIAL_TYPES = ['metal', 'plastic', 'paper', 'glass', 'e-waste'];

// Their required Material fields. If one is missing, the page would show a blank
// instead of an error, so the terminal says which field to look for.
const MATERIAL_FIELDS = ['material_id', 'name', 'type', 'quantity_kg', 'unit_price_kes'];

const UNAVAILABLE = 'Kanairo-Klean is unavailable right now. Try again later.';

// Thrown by callPartner when no usable answer came back: the settings are
// missing, nothing answered, or the answer wasn't JSON.
class PartnerUnavailable extends Error {}

/**
 * Call Kanairo-Klean and return { status, body }. `path` is their path, like
 * '/materials'. Throws PartnerUnavailable when there is no usable answer, after
 * logging why. A 4xx or 5xx answer is returned, not thrown: each route decides
 * what that status means for the page.
 */
async function callPartner(path, { method = 'GET', body } = {}) {
  // Read on every request, not at startup, so the tests can change them.
  const partnerUrl = process.env.PARTNER_URL;
  const partnerKey = process.env.PARTNER_API_KEY;
  if (!partnerUrl || !partnerKey) {
    console.error('Kanairo-Klean: PARTNER_URL or PARTNER_API_KEY is not set in server/.env');
    throw new PartnerUnavailable();
  }

  const url = new URL(path, partnerUrl);
  const label = `Kanairo-Klean ${method} ${url.pathname}${url.search}`;

  let r;
  try {
    r = await fetch(url, {
      method,
      headers: {
        // Their README's header, not the X-API-Key in the lab handout.
        Authorization: `Bearer ${partnerKey}`,
        // ngrok's free plan answers a first visit with an HTML warning page
        // unless this header is sent. Their hosted URL is on ngrok.
        'ngrok-skip-browser-warning': 'true',
        ...(body && { 'Content-Type': 'application/json' }),
      },
      body: body && JSON.stringify(body),
    });
  } catch (err) {
    // fetch throws when no response came back at all. err.cause.code says why:
    // ECONNREFUSED = nothing listening at that address (server off, wrong port),
    // ENOTFOUND = the hostname doesn't exist (misspelt, or the ngrok URL changed).
    console.error('Kanairo-Klean call failed:', err.cause?.code || err.message);
    throw new PartnerUnavailable();
  }

  // Log the status, never the token.
  if (!r.ok) console.error(`${label} returned ${r.status}`);

  try {
    return { status: r.status, body: await r.json() };
  } catch {
    // ngrok's "endpoint offline" page is HTML, not JSON.
    console.error(`${label}: the answer was not JSON (status ${r.status})`);
    throw new PartnerUnavailable();
  }
}

// GET /partner/materials?type=metal
router.get('/materials', async (req, res) => {
  const { type } = req.query;
  if (type !== undefined && !MATERIAL_TYPES.includes(type)) {
    return res.status(400).json({ error: `type must be one of: ${MATERIAL_TYPES.join(', ')}` });
  }

  try {
    const { status, body: materials } = await callPartner(
      type ? `/materials?type=${encodeURIComponent(type)}` : '/materials'
    );
    if (status !== 200) return res.status(502).json({ error: UNAVAILABLE });
    if (!Array.isArray(materials)) {
      console.error('Kanairo-Klean GET /materials: expected an array, got', typeof materials);
      return res.status(502).json({ error: UNAVAILABLE });
    }

    const missing = MATERIAL_FIELDS.filter(field => materials.some(m => m[field] === undefined));
    if (missing.length) {
      console.error('Kanairo-Klean GET /materials: some materials have no', missing.join(', '));
    }

    // Only what the page shows, renamed to the camelCase our site uses.
    res.json(
      materials.map(m => ({
        id: m.material_id,
        name: m.name,
        type: m.type,
        quantityKg: m.quantity_kg,
        pricePerKgKes: m.unit_price_kes,
      }))
    );
  } catch (err) {
    if (!(err instanceof PartnerUnavailable)) console.error(err);
    res.status(502).json({ error: UNAVAILABLE });
  }
});

// GET /partner/collection-locations: the yards that take scrap drop-offs.
// Kanairo lists only active ones, so is_active is left out.
router.get('/collection-locations', async (req, res) => {
  try {
    const { status, body: locations } = await callPartner('/collection-locations');
    if (status !== 200 || !Array.isArray(locations)) {
      return res.status(502).json({ error: UNAVAILABLE });
    }
    res.json(
      locations.map(l => ({ id: l.location_id, name: l.name, area: l.area, county: l.county }))
    );
  } catch (err) {
    if (!(err instanceof PartnerUnavailable)) console.error(err);
    res.status(502).json({ error: UNAVAILABLE });
  }
});

// POST /partner/drop-offs: an artisan reports scrap left over from a completed job.
// Body: { artisanId, bookingId, locationId, locationName?, materialType, quantityKg, notes? }
// Sent on to Kanairo's POST /collection-locations/{location_id}/drop-offs, and a
// copy kept in scrap_drop_offs so the dashboard shows it and it isn't sent twice.
router.post('/drop-offs', async (req, res) => {
  const { artisanId, bookingId, locationId, locationName, materialType, quantityKg, notes } = req.body ?? {};

  // Validate first, so a mistake costs no call to Kanairo. The limits are theirs.
  if (!artisanId || !bookingId) {
    return res.status(400).json({ error: 'artisanId and bookingId are required' });
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
    if (!(err instanceof PartnerUnavailable)) console.error(err);
    try {
      await release();
    } catch (releaseErr) {
      console.error('Could not remove the unsent scrap report', reservedId, releaseErr.message);
    }
    res.status(502).json({ error: UNAVAILABLE });
  }
});

module.exports = router;
