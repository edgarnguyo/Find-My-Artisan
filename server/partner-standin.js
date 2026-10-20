// A stand-in for Kanairo-Klean's API, for building and testing while their server
// is off. It answers GET /materials with the example rows from their README, and
// checks the Bearer token and the type filter the way their contract says.
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

const app = express();

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

app.listen(PORT, () => {
  console.log(`Kanairo-Klean stand-in on http://localhost:${PORT} (not the real partner)`);
});
