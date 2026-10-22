// Automated tests for the materials estimate on a booking: POST /bookings with
// a materials list is priced at Kanairo-Klean and saved with the booking, and
// GET /bookings sends it back. Neither the database nor Kanairo is needed:
// db.query, db.getConnection and global.fetch are replaced with fakes, so
// nothing here touches real data.
const request = require('supertest');
const app = require('../app');
const db = require('../db');

const realFetch = global.fetch;
const env = { ...process.env };

const KANAIRO_MATERIALS = [
  { material_id: 'HDPE', name: 'HDPE Plastic', type: 'plastic', quantity_kg: 1100, unit_price_kes: 35 },
  { material_id: 'ALU', name: 'Aluminium', type: 'metal', quantity_kg: 430, unit_price_kes: 85 },
];

const booking = {
  artisanId: 1,
  clientId: 5,
  name: 'Test Client',
  contact: '0712000000',
  date: '2030-01-01',
  time: '09:00',
  job: 'Fix the kitchen sink',
};

function partnerAnswers(status, body) {
  return jest.fn().mockResolvedValue(
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
  );
}

// A fake database where client 5 exists and the artisan is free. Returns the
// statements run inside the transaction, so a test can check what was saved.
function fakeDatabase() {
  jest.spyOn(db, 'query').mockImplementation(async sql => {
    if (sql.includes('FROM clients')) return [[{ id: 5 }]];
    return [[]]; // no busy-time clash
  });
  const saved = [];
  const conn = {
    beginTransaction: jest.fn(),
    commit: jest.fn(),
    rollback: jest.fn(),
    release: jest.fn(),
    query: jest.fn(async (sql, params) => {
      saved.push({ sql, params });
      return [{ insertId: 42 }];
    }),
  };
  jest.spyOn(db, 'getConnection').mockResolvedValue(conn);
  return saved;
}

beforeEach(() => {
  process.env.PARTNER_URL = 'http://partner.test';
  process.env.PARTNER_API_KEY = 'test-token';
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  global.fetch = realFetch;
  process.env = { ...env };
  jest.restoreAllMocks();
});

afterAll(() => db.end());

describe('POST /bookings with materials', () => {
  it("saves the booking with each material at Kanairo's price", async () => {
    const saved = fakeDatabase();
    global.fetch = partnerAnswers(200, KANAIRO_MATERIALS);

    const res = await request(app).post('/bookings').send({
      ...booking,
      // A price sent from the browser is ignored: the server asks Kanairo.
      materials: [{ materialId: 'HDPE', quantityKg: 20, pricePerKgKes: 1 }],
    });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      id: 42,
      status: 'pending',
      materials: [{ materialId: 'HDPE', name: 'HDPE Plastic', type: 'plastic', quantityKg: 20, pricePerKgKes: 35 }],
    });
    const [, materialsInsert] = saved;
    expect(materialsInsert.sql).toMatch(/INSERT INTO booking_materials/);
    expect(materialsInsert.params).toEqual([[[42, 'HDPE', 'HDPE Plastic', 'plastic', 20, 35]]]);
    expect(global.fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer test-token');
  });

  it('books without calling Kanairo when no materials are sent', async () => {
    const saved = fakeDatabase();
    global.fetch = jest.fn();

    const res = await request(app).post('/bookings').send(booking);

    expect(res.status).toBe(201);
    expect(res.body.materials).toEqual([]);
    expect(saved).toHaveLength(1); // only the booking
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it.each([
    ['not a list', { materialId: 'HDPE', quantityKg: 2 }, /must be a list/],
    ['no id', [{ quantityKg: 2 }], /materialId/],
    ['zero kg', [{ materialId: 'HDPE', quantityKg: 0 }], /quantityKg/],
    ['kg as text', [{ materialId: 'HDPE', quantityKg: '2' }], /quantityKg/],
    ['the same material twice', [{ materialId: 'HDPE', quantityKg: 2 }, { materialId: 'HDPE', quantityKg: 3 }], /twice/],
    ['more than 10', Array.from({ length: 11 }, (_, i) => ({ materialId: `M${i}`, quantityKg: 1 })), /at most 10/],
  ])('rejects %s with 400 before calling Kanairo', async (_, materials, message) => {
    fakeDatabase();
    global.fetch = jest.fn();

    const res = await request(app).post('/bookings').send({ ...booking, materials });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(message);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("rejects a material Kanairo doesn't list and saves nothing", async () => {
    const saved = fakeDatabase();
    global.fetch = partnerAnswers(200, KANAIRO_MATERIALS);

    const res = await request(app).post('/bookings').send({
      ...booking,
      materials: [{ materialId: 'COPPER', quantityKg: 2 }],
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/no longer lists COPPER/);
    expect(saved).toHaveLength(0);
  });

  it('answers 502 and saves nothing when Kanairo is down', async () => {
    const saved = fakeDatabase();
    const err = new TypeError('fetch failed');
    err.cause = { code: 'ECONNREFUSED' };
    global.fetch = jest.fn().mockRejectedValue(err);

    const res = await request(app).post('/bookings').send({
      ...booking,
      materials: [{ materialId: 'HDPE', quantityKg: 2 }],
    });

    expect(res.status).toBe(502);
    expect(res.body.error).toMatch(/unavailable.*Remove the materials/);
    expect(saved).toHaveLength(0);
  });
});

describe('GET /bookings', () => {
  it('sends each booking with its saved materials', async () => {
    jest.spyOn(db, 'query').mockImplementation(async sql => {
      if (sql.includes('FROM booking_materials')) {
        return [[{
          booking_id: 7, material_id: 'HDPE', name: 'HDPE Plastic', material_type: 'plastic',
          quantity_kg: '20.00', price_per_kg_kes: '35.00',
        }]];
      }
      return [[{ id: 7, block_end: null }, { id: 8, block_end: null }]];
    });

    const res = await request(app).get('/bookings?clientId=5');

    expect(res.status).toBe(200);
    expect(res.body[0].materials).toEqual([expect.objectContaining({ material_id: 'HDPE', price_per_kg_kes: '35.00' })]);
    expect(res.body[1].materials).toEqual([]);
  });
});
