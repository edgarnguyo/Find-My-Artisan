// A stand-in for Kanairo-Klean's API, for building and testing while their server
// is off. It answers with the example rows from their README, and checks the
// Bearer token and each input the way their contract (v1.1.0) says:
//   GET /materials, GET /collection-locations,
//   POST /collection-locations/{location_id}/drop-offs
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

app.use((req, res, next) => {
  if (req.get('Authorization') !== `Bearer ${TOKEN}`) {
    return res.status(401).json({ code: 401, message: 'Missing or invalid API token' });
  }
  next();
});

app.get('/materials', (req, res) => {
  const { type } = req.query;
  if (type !== undefined && !TYPES.includes(type)) {
    return res.status(400).json({ code: 400, message: `type must be one of: ${TYPES.join(', ')}` });
  }
  res.json(type ? MATERIALS.filter(m => m.type === type) : MATERIALS);
});

app.get('/collection-locations', (req, res) => {
  res.json(LOCATIONS);
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
