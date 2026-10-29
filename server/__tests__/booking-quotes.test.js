// Automated tests for an artisan's quote on a booking: the artisan sends it
// (PUT /bookings/:id/quote) with labour and Kanairo-Klean materials priced by
// this server, the client accepts or declines it (PATCH), and GET /bookings
// sends it back. Booking requests themselves carry no materials any more.
// Neither the database nor Kanairo is needed: db.query, db.getConnection and
// global.fetch are replaced with fakes, so nothing here touches real data.
const request = require('supertest');
const app = require('../app');
const db = require('../db');

const realFetch = global.fetch;
const env = { ...process.env };

const KANAIRO_MATERIALS = [
  { material_id: 'HDPE', name: 'HDPE Plastic', type: 'plastic', quantity_kg: 1100, unit_price_kes: 35 },
  { material_id: 'ALU', name: 'Aluminium', type: 'metal', quantity_kg: 430, unit_price_kes: 85 },
];

const quote = { artisanId: 1, labourKes: 1500, materials: [{ materialId: 'HDPE', quantityKg: 20 }] };

function partnerAnswers(status, body) {
  return jest.fn().mockResolvedValue(
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
  );
}

// A fake database holding booking 7 for artisan 1, in `status`, with a quote
// in `quoteStatus` (null for none). Returns the statements run inside the
// transaction, so a test can check what was saved.
function fakeDatabase({ status = 'pending', quoteStatus = null } = {}) {
  const booking = async (sql, params) => {
    if (sql.includes('FROM bookings LEFT JOIN booking_quotes')) {
      return params[1] === 1 ? [[{ status, quote_status: quoteStatus }]] : [[]];
    }
    if (sql.includes('SELECT version')) return [[{ version: quoteStatus ? 2 : 1 }]];
    return [{ affectedRows: 1 }];
  };
  jest.spyOn(db, 'query').mockImplementation(booking);
  const saved = [];
  const conn = {
    beginTransaction: jest.fn(),
    commit: jest.fn(),
    rollback: jest.fn(),
    release: jest.fn(),
    query: jest.fn(async (sql, params) => {
      saved.push({ sql, params });
      return booking(sql, params);
    }),
  };
  jest.spyOn(db, 'getConnection').mockResolvedValue(conn);
  // Only the writes: the checks inside the transaction are reads.
  return { writes: () => saved.filter(q => !q.sql.trim().startsWith('SELECT')) };
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

describe('POST /bookings', () => {
  it('saves a request without materials and never calls Kanairo', async () => {
    const queries = [];
    jest.spyOn(db, 'query').mockImplementation(async (sql, params) => {
      queries.push({ sql, params });
      if (sql.includes('FROM clients')) return [[{ id: 5 }]];
      if (sql.includes('INSERT INTO bookings')) return [{ insertId: 42 }];
      return [[]]; // no busy-time clash
    });
    global.fetch = jest.fn();

    const res = await request(app).post('/bookings').send({
      artisanId: 1, clientId: 5, name: 'Test Client', contact: '0712000000',
      date: '2030-01-01', time: '09:00', job: 'Fix the kitchen sink',
      // Sent by an old copy of the page: ignored, the artisan prices the job.
      materials: [{ materialId: 'HDPE', quantityKg: 20 }],
    });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ id: 42, status: 'pending' });
    expect(queries.some(q => q.sql.includes('booking_materials'))).toBe(false);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe('PUT /bookings/:id/quote', () => {
  it("saves the quote with each material at Kanairo's price", async () => {
    const fake = fakeDatabase();
    global.fetch = partnerAnswers(200, KANAIRO_MATERIALS);

    const res = await request(app).put('/bookings/7/quote').send({
      ...quote,
      // A price sent from the browser is ignored: the server asks Kanairo.
      materials: [{ materialId: 'HDPE', quantityKg: 20, pricePerKgKes: 1 }],
      notes: '  Includes the waste pipe.  ',
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      bookingId: 7,
      labourKes: 1500,
      notes: 'Includes the waste pipe.',
      status: 'sent',
      version: 1,
      materials: [{ materialId: 'HDPE', name: 'HDPE Plastic', type: 'plastic', quantityKg: 20, pricePerKgKes: 35 }],
    });
    const [quoteInsert, materialsDelete, materialsInsert] = fake.writes();
    expect(quoteInsert.sql).toMatch(/INSERT INTO booking_quotes[\s\S]*ON DUPLICATE KEY UPDATE/);
    expect(quoteInsert.params).toEqual(['7', 1500, 'Includes the waste pipe.']);
    // Sending again replaces the old lines instead of adding to them.
    expect(materialsDelete.sql).toMatch(/DELETE FROM booking_materials/);
    expect(materialsInsert.params).toEqual([[['7', 'HDPE', 'HDPE Plastic', 'plastic', 20, 35]]]);
    expect(global.fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer test-token');
  });

  it('saves a labour-only quote without calling Kanairo', async () => {
    const fake = fakeDatabase();
    global.fetch = jest.fn();

    const res = await request(app).put('/bookings/7/quote').send({ artisanId: 1, labourKes: 2000 });

    expect(res.status).toBe(200);
    expect(res.body.materials).toEqual([]);
    expect(fake.writes()).toHaveLength(2); // the quote, and clearing old lines
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('lets the artisan change a quote the client declined', async () => {
    fakeDatabase({ quoteStatus: 'declined' });
    global.fetch = partnerAnswers(200, KANAIRO_MATERIALS);

    const res = await request(app).put('/bookings/7/quote').send(quote);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'sent', version: 2 });
  });

  it.each([
    ['no artisanId', { artisanId: undefined }, /artisanId/],
    ['labour as text', { labourKes: '1500' }, /labourKes/],
    ['negative labour', { labourKes: -1 }, /labourKes/],
    ['nothing to charge', { labourKes: 0, materials: [] }, /labour charge, materials, or both/],
    ['materials not a list', { materials: { materialId: 'HDPE', quantityKg: 2 } }, /must be a list/],
    ['zero kg', { materials: [{ materialId: 'HDPE', quantityKg: 0 }] }, /quantityKg/],
    ['the same material twice', { materials: [{ materialId: 'HDPE', quantityKg: 2 }, { materialId: 'HDPE', quantityKg: 3 }] }, /twice/],
    ['notes too long', { notes: 'x'.repeat(501) }, /notes/],
  ])('rejects %s with 400 before calling Kanairo', async (_, fields, message) => {
    fakeDatabase();
    global.fetch = jest.fn();

    const res = await request(app).put('/bookings/7/quote').send({ ...quote, ...fields });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(message);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it.each([
    ["another artisan's booking", { artisanId: 2 }, {}, 404, /not found/],
    ['a completed job', {}, { status: 'completed' }, 409, /completed/],
    ['a quote the client accepted', {}, { quoteStatus: 'accepted' }, 409, /accepted/],
  ])('refuses %s before calling Kanairo', async (_, fields, booking, status, message) => {
    const fake = fakeDatabase(booking);
    global.fetch = jest.fn();

    const res = await request(app).put('/bookings/7/quote').send({ ...quote, ...fields });

    expect(res.status).toBe(status);
    expect(res.body.error).toMatch(message);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(fake.writes()).toHaveLength(0);
  });

  it("rejects a material Kanairo doesn't list and saves nothing", async () => {
    const fake = fakeDatabase();
    global.fetch = partnerAnswers(200, KANAIRO_MATERIALS);

    const res = await request(app).put('/bookings/7/quote').send({
      ...quote,
      materials: [{ materialId: 'COPPER', quantityKg: 2 }],
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/no longer lists COPPER/);
    expect(fake.writes()).toHaveLength(0);
  });

  it('answers 502 and saves nothing when Kanairo is down', async () => {
    const fake = fakeDatabase();
    const err = new TypeError('fetch failed');
    err.cause = { code: 'ECONNREFUSED' };
    global.fetch = jest.fn().mockRejectedValue(err);

    const res = await request(app).put('/bookings/7/quote').send(quote);

    expect(res.status).toBe(502);
    expect(res.body.error).toMatch(/unavailable.*labour only/);
    expect(fake.writes()).toHaveLength(0);
  });
});

describe('PATCH /bookings/:id/quote', () => {
  const answer = { clientId: 5, decision: 'accepted', version: 2 };

  it("saves the client's answer to the version they saw", async () => {
    const update = jest.spyOn(db, 'query').mockResolvedValue([{ affectedRows: 1 }]);

    const res = await request(app).patch('/bookings/7/quote').send(answer);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ bookingId: 7, status: 'accepted', version: 2 });
    expect(update.mock.calls[0][1]).toEqual(['accepted', '7', 5, ['pending', 'confirmed'], 2]);
  });

  it.each([
    ['no clientId', { clientId: undefined }, /clientId/],
    ['an unknown decision', { decision: 'maybe' }, /decision/],
    ['no version', { version: undefined }, /version/],
  ])('rejects %s with 400', async (_, fields, message) => {
    const res = await request(app).patch('/bookings/7/quote').send({ ...answer, ...fields });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(message);
  });

  // When nothing changed, the second query says why.
  it.each([
    ['no quote yet', [], 404, /No quote/],
    ['a cancelled booking', [{ booking_status: 'cancelled', quote_status: 'sent', quote_version: 2 }], 409, /cancelled/],
    ['a newer quote', [{ booking_status: 'pending', quote_status: 'sent', quote_version: 3 }], 409, /new quote/],
    ['an answered quote', [{ booking_status: 'pending', quote_status: 'declined', quote_version: 2 }], 409, /already declined/],
  ])('refuses %s', async (_, why, status, message) => {
    jest.spyOn(db, 'query')
      .mockResolvedValueOnce([{ affectedRows: 0 }])
      .mockResolvedValueOnce([why]);

    const res = await request(app).patch('/bookings/7/quote').send(answer);

    expect(res.status).toBe(status);
    expect(res.body.error).toMatch(message);
  });
});

describe('GET /bookings', () => {
  it('sends each booking with its quote, and null when there is none', async () => {
    const queries = [];
    jest.spyOn(db, 'query').mockImplementation(async (sql, params) => {
      queries.push({ sql, params });
      if (sql.includes('FROM booking_materials')) {
        return [[{
          booking_id: 7, material_id: 'HDPE', name: 'HDPE Plastic', material_type: 'plastic',
          quantity_kg: '20.00', price_per_kg_kes: '35.00',
        }]];
      }
      return [[
        {
          id: 7, block_end: null, quote_labour_kes: '1500.00', quote_notes: null, quote_status: 'sent',
          quote_version: 1, quote_sent_at: '2030-01-01 06:00:00', quote_answered_at: null,
        },
        { id: 8, block_end: null, quote_status: null },
      ]];
    });

    const res = await request(app).get('/bookings?clientId=5');

    expect(res.status).toBe(200);
    expect(res.body[0].quote).toEqual({
      labour_kes: '1500.00',
      notes: null,
      status: 'sent',
      version: 1,
      sent_at: '2030-01-01T06:00:00Z',
      answered_at: null,
      materials: [expect.objectContaining({ material_id: 'HDPE', price_per_kg_kes: '35.00' })],
    });
    expect(res.body[0]).not.toHaveProperty('quote_status');
    expect(res.body[1].quote).toBeNull();
    // Materials are only read for quoted bookings: older rows were client guesses.
    expect(queries.find(q => q.sql.includes('FROM booking_materials')).params).toEqual([[7]]);
  });
});
