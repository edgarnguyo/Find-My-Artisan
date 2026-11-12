// A stand-in for Kanairo-Klean's API, for building and testing while their server
// is off. It answers with the example rows from their README, and checks the
// Bearer token and each input the way their contract says:
//   GET /v2/materials, GET /v2/collection-locations (v2: lists wrapped as { data, count }),
//   POST /collection-locations/{location_id}/drop-offs (still v1)
//
// Run it with `npm run partner:standin` inside server/, then set in server/.env:
//   PARTNER_URL=http://localhost:5050
//   PARTNER_API_KEY=<the same value as STANDIN_TOKEN below, or "standin-token">
// Once Kanairo is live, point PARTNER_URL and PARTNER_API_KEY at them instead.
const express = require('express');

const PORT = 5050;
const TOKEN = process.env.STANDIN_TOKEN || 'standin-token';
const TYPES = ['metal', 'plastic', 'paper', 'glass', 'e-waste'];

const MATERIALS = [
  { material_id: 'ALU', name: 'Aluminium', type: 'metal', quantity_kg: 430, unit_price_kes: 85 },
  { material_id: 'EWASTE', name: 'E-Waste', type: 'e-waste', quantity_kg: 640, unit_price_kes: 120 },
  { material_id: 'GLASS', name: 'Clear Glass', type: 'glass', quantity_kg: 290, unit_price_kes: 8.5 },
  { material_id: 'HDPE', name: 'HDPE Plastic', type: 'plastic', quantity_kg: 1100, unit_price_kes: 35 },
  { material_id: 'PAPER', name: 'Cardboard', type: 'paper', quantity_kg: 3200, unit_price_kes: 12 },
  { material_id: 'PET', name: 'PET Plastic', type: 'plastic', quantity_kg: 2840, unit_price_kes: 28.5 },
];

const LOCATIONS = [
  { location_id: '1', name: 'Dandora', area: 'Dandora', county: 'Nairobi', is_active: true },
  { location_id: '2', name: 'Gikomba', area: 'Gikomba', county: 'Nairobi', is_active: true },
  { location_id: '3', name: 'Industrial Area', area: 'Industrial Area', county: 'Nairobi', is_active: true },
  { location_id: '6', name: 'Eastleigh', area: 'Eastleigh', county: 'Nairobi', is_active: true },
  { location_id: '8', name: 'Ruiru', area: 'Ruiru', county: 'Kiambu', is_active: true },
];

// Drop-offs received while the stand-in runs. Lost when it stops.
const dropOffs = [];

const app = express();
app.use(express.json());

// Week 11: how the stand-in misbehaves, switched without restarting it:
//   curl http://localhost:5050/__mode/slow
//   ok    = answers normally
//   slow  = answers after 10 seconds
//   flaky = fails with 503 twice, then works on the third call
//   error = always fails with 500
// Only the GET routes misbehave. Drop-offs (POST) always behave, since our
// server never retries a write.
let mode = 'ok';
let calls = 0;

app.get('/__mode/:m', (req, res) => {
  if (!['ok', 'slow', 'flaky', 'error'].includes(req.params.m)) {
    return res.status(400).json({ message: 'mode must be ok, slow, flaky or error' });
  }
  mode = req.params.m;
  calls = 0;
  console.log(`stand-in mode: ${mode}`);
  res.json({ mode });
});

app.use(async (req, res, next) => {
  if (req.method !== 'GET') return next();
  calls += 1;
  console.log(`GET ${req.path} (call ${calls}, mode ${mode})`);
  if (mode === 'slow') await new Promise(r => setTimeout(r, 10000));
  if (mode === 'flaky' && calls % 3 !== 0) {
    return res.status(503).json({ code: 503, message: 'Try again' });
  }
  if (mode === 'error') return res.status(500).json({ code: 500, message: 'Internal error' });
  next();
});

app.use((req, res, next) => {
  if (req.get('Authorization') !== `Bearer ${TOKEN}`) {
    return res.status(401).json({ code: 401, message: 'Missing or invalid API token' });
  }
  next();
});

// Kanairo's v2 lists come wrapped as { data, count } (checked live, 12 Nov 2026).
const list = items => ({ data: items, count: items.length });

app.get('/v2/materials', (req, res) => {
  const { type } = req.query;
  if (type !== undefined && !TYPES.includes(type)) {
    return res.status(400).json({ code: 400, message: `type must be one of: ${TYPES.join(', ')}` });
  }
  res.json(list(type ? MATERIALS.filter(m => m.type === type) : MATERIALS));
});

app.get('/v2/collection-locations', (req, res) => {
  res.json(list(LOCATIONS));
});

app.post('/collection-locations/:id/drop-offs', (req, res) => {
  if (!LOCATIONS.some(l => l.location_id === req.params.id)) {
    return res.status(404).json({ code: 404, message: `Collection location ${req.params.id} not found` });
  }
  const { material_type, quantity_kg, source, notes } = req.body ?? {};
  if (material_type === undefined || quantity_kg === undefined || source === undefined) {
    return res.status(400).json({ code: 400, message: 'material_type, quantity_kg and source are required' });
  }
  if (!TYPES.includes(material_type)) {
    return res.status(400).json({ code: 400, message: `material_type must be one of: ${TYPES.join(', ')}` });
  }
  if (typeof quantity_kg !== 'number' || !(quantity_kg > 0)) {
    return res.status(400).json({ code: 400, message: 'quantity_kg must be a number greater than 0' });
  }
  if (typeof source !== 'string' || source.length < 1 || source.length > 120) {
    return res.status(400).json({ code: 400, message: 'source must be 1 to 120 characters' });
  }
  if (notes !== undefined && (typeof notes !== 'string' || notes.length < 1)) {
    return res.status(400).json({ code: 400, message: 'notes must be non-empty text' });
  }

  const dropOff = {
    drop_off_id: `drop-${String(dropOffs.length + 1).padStart(4, '0')}`,
    location_id: req.params.id,
    material_type,
    quantity_kg,
    source,
    ...(notes !== undefined && { notes }),
    status: 'pending',
    created_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
  };
  dropOffs.push(dropOff);
  console.log('stand-in drop-off:', dropOff.drop_off_id, dropOff.source);
  res.status(201).json(dropOff);
});

app.listen(PORT, () => {
  console.log(`Kanairo-Klean stand-in on http://localhost:${PORT} (not the real partner)`);
});
