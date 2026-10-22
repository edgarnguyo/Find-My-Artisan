// Calls to our upstream partner, Kanairo-Klean (Team 13). Their contract is
// openapi.yaml in github.com/berur874/Kanairo-cleaan (v1.1.0). Used by
// routes/partner.js (the Materials page, scrap drop-offs) and routes/bookings.js
// (pricing the materials on a booking).
//
// Only this server calls Kanairo. If the browser did, the partner's token would
// sit in the page's JavaScript where anyone can read it.

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

/**
 * Kanairo's materials in stock, renamed to the camelCase our site uses:
 * [{ id, name, type, quantityKg, pricePerKgKes }]. `type` filters to one
 * MaterialType. Throws PartnerUnavailable when there is no usable list.
 */
async function fetchMaterials(type) {
  const { status, body: materials } = await callPartner(
    type ? `/materials?type=${encodeURIComponent(type)}` : '/materials'
  );
  if (status !== 200) throw new PartnerUnavailable();
  if (!Array.isArray(materials)) {
    console.error('Kanairo-Klean GET /materials: expected an array, got', typeof materials);
    throw new PartnerUnavailable();
  }

  const missing = MATERIAL_FIELDS.filter(field => materials.some(m => m[field] === undefined));
  if (missing.length) {
    console.error('Kanairo-Klean GET /materials: some materials have no', missing.join(', '));
  }

  return materials.map(m => ({
    id: m.material_id,
    name: m.name,
    type: m.type,
    quantityKg: m.quantity_kg,
    pricePerKgKes: m.unit_price_kes,
  }));
}

module.exports = { MATERIAL_TYPES, UNAVAILABLE, PartnerUnavailable, callPartner, fetchMaterials };
