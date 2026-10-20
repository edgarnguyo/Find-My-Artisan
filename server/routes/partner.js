const express = require('express');
const router = express.Router();

// Website-only: data from our upstream partner, Kanairo-Klean (Team 13). Their
// contract is openapi.yaml in github.com/berur874/Kanairo-cleaan (v1.1.0).
//
// The browser never calls Kanairo itself. If it did, the partner's token would sit
// in the page's JavaScript where anyone can read it. So the page asks this server,
// and this server adds the token from server/.env.

// The fixed list from their contract (MaterialType). Checked here so a bad filter
// gets our own 400 instead of using up a call to the partner.
const MATERIAL_TYPES = ['metal', 'plastic', 'paper', 'glass', 'e-waste'];

// Their required Material fields. If one is missing, the page would show a blank
// instead of an error, so the terminal says which field to look for.
const MATERIAL_FIELDS = ['material_id', 'name', 'type', 'quantity_kg', 'unit_price_kes'];

const UNAVAILABLE = { error: 'Material prices from Kanairo-Klean are unavailable right now. Try again later.' };

// GET /partner/materials?type=metal
router.get('/materials', async (req, res) => {
  const { type } = req.query;
  if (type !== undefined && !MATERIAL_TYPES.includes(type)) {
    return res.status(400).json({ error: `type must be one of: ${MATERIAL_TYPES.join(', ')}` });
  }

  // Read on every request, not at startup, so the tests can change them.
  const partnerUrl = process.env.PARTNER_URL;
  const partnerKey = process.env.PARTNER_API_KEY;
  if (!partnerUrl || !partnerKey) {
    console.error('Kanairo-Klean: PARTNER_URL or PARTNER_API_KEY is not set in server/.env');
    return res.status(502).json(UNAVAILABLE);
  }

  const url = new URL('/materials', partnerUrl);
  if (type) url.searchParams.set('type', type);

  try {
    const r = await fetch(url, {
      headers: {
        // Their README's header, not the X-API-Key in the lab handout.
        Authorization: `Bearer ${partnerKey}`,
        // ngrok's free plan answers a first visit with an HTML warning page
        // unless this header is sent. Their hosted URL is on ngrok.
        'ngrok-skip-browser-warning': 'true',
      },
    });

    if (!r.ok) {
      // Log the status, never the token.
      console.error(`Kanairo-Klean GET ${url.pathname}${url.search} returned ${r.status}`);
      return res.status(502).json(UNAVAILABLE);
    }

    const materials = await r.json();
    if (!Array.isArray(materials)) {
      console.error('Kanairo-Klean GET /materials: expected an array, got', typeof materials);
      return res.status(502).json(UNAVAILABLE);
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
    // fetch throws when no response came back at all. err.cause.code says why:
    // ECONNREFUSED = nothing listening at that address (server off, wrong port),
    // ENOTFOUND = the hostname doesn't exist (misspelt, or the ngrok URL changed).
    console.error('Kanairo-Klean call failed:', err.cause?.code || err.message);
    res.status(502).json(UNAVAILABLE);
  }
});

module.exports = router;
