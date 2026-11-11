// Week 13: Kanairo-Klean's v1 and v2 list shapes give our code the same thing,
// and the wrong parser fails loudly. Then the real routes, with a fake partner,
// on PARTNER_VERSION=v2.
const request = require('supertest');
const app = require('../app');
const db = require('../db');
const partnerRoutes = require('../routes/partner');
const { versions } = require('../kanairoVersions');

const material = { material_id: 'ALU', name: 'Aluminium', type: 'metal', quantity_kg: 390, unit_price_kes: 85 };
const yard = { location_id: '1', name: 'Dandora', area: 'Dandora', county: 'Nairobi', is_active: true };
const v1Body = [material];
const v2Body = { data: [material], count: 1 };

describe('the parsers', () => {
  it('v1 and v2 give our code exactly the same list', () => {
    expect(versions.v1.list(v1Body)).toEqual([material]);
    expect(versions.v2.list(v2Body)).toEqual([material]);
  });

  it('an empty v2 list is an empty list, not an error', () => {
    expect(versions.v2.list({ data: [], count: 0 })).toEqual([]);
  });

  it('the wrong parser fails loudly, not quietly', () => {
    expect(() => versions.v1.list(v2Body)).toThrow('unexpected v1 shape');
    expect(() => versions.v2.list(v1Body)).toThrow('unexpected v2 shape');
  });
});

describe('the routes on PARTNER_VERSION=v2', () => {
  const realFetch = global.fetch;
  const env = { ...process.env };

  function partnerAnswers(body) {
    return jest.fn().mockResolvedValue(
      new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
    );
  }

  beforeEach(() => {
    process.env.PARTNER_URL = 'http://partner.test';
    process.env.PARTNER_API_KEY = 'test-token';
    process.env.PARTNER_RETRY_DELAY_MS = '1';
    process.env.PARTNER_VERSION = 'v2';
    partnerRoutes.forgetSavedMaterials();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    global.fetch = realFetch;
    process.env = { ...env };
    jest.restoreAllMocks();
  });

  afterAll(() => db.end());

  it('GET /partner/materials calls /v2/materials and reads body.data', async () => {
    global.fetch = partnerAnswers(v2Body);
    const res = await request(app).get('/partner/materials?type=metal');

    expect(String(global.fetch.mock.calls[0][0])).toBe('http://partner.test/v2/materials?type=metal');
    expect(res.status).toBe(200);
    expect(res.body.stale).toBe(false);
    expect(res.body.data).toEqual([{ id: 'ALU', name: 'Aluminium', type: 'metal', quantityKg: 390, pricePerKgKes: 85 }]);
  });

  it('GET /partner/collection-locations calls /v2/collection-locations and reads body.data', async () => {
    global.fetch = partnerAnswers({ data: [yard], count: 1 });
    const res = await request(app).get('/partner/collection-locations');

    expect(String(global.fetch.mock.calls[0][0])).toBe('http://partner.test/v2/collection-locations');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ id: '1', name: 'Dandora', area: 'Dandora', county: 'Nairobi' }]);
  });

  it('a v1-shaped answer while on v2 is a clear failure, logged with the reason', async () => {
    global.fetch = partnerAnswers(v1Body);
    const res = await request(app).get('/partner/materials');

    expect(res.status).toBe(502);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('unexpected v2 shape'));
  });
});
