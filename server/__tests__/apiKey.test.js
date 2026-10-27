// The X-API-Key check on the partner routes (/artisans), and that the website's
// own routes and browsers' CORS preflights still work without a key.
const express = require('express');
const request = require('supertest');
const app = require('../app');
const db = require('../db');
const { TEST_API_KEY } = require('../jest.setup');
const { createApiKeyCheck, parseKeys } = require('../apiKey');

afterAll(async () => {
  await db.end();
});

describe('the key check on /artisans', () => {
  it('turns away a request with no key: 401 in the Error shape', async () => {
    const res = await request(app).get('/artisans');

    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      code: 'unauthorized',
      message: 'Send your API key in the X-API-Key header.',
    });
  });

  it('turns away a wrong key with 401', async () => {
    const res = await request(app).get('/artisans/1').set('X-API-Key', 'not-a-real-key');

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ code: 'unauthorized', message: 'That API key is not valid.' });
  });

  it('checks writes too, before the body is even looked at', async () => {
    const res = await request(app).post('/artisans/1/reviews').send({ author: 'x', rating: 5 });
    expect(res.status).toBe(401);
  });

  it('lets a valid key through to the route', async () => {
    const res = await request(app).get('/artisans/999999').set('X-API-Key', TEST_API_KEY);

    // The route's own 404, so the key check passed.
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('not_found');
    expect(res.headers['ratelimit-limit']).toBe('100000');
  });

  it('answers a valid key with 200 and the artisan list', async () => {
    const res = await request(app).get('/artisans').set('X-API-Key', TEST_API_KEY);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(Object.keys(res.body[0]).sort()).toEqual(
      ['area', 'busy', 'county', 'id', 'name', 'trade', 'verified'].sort()
    );
  });

  it('never sends an email or password with a full profile', async () => {
    const res = await request(app).get('/artisans/1').set('X-API-Key', TEST_API_KEY);

    expect(res.status).toBe(200);
    expect(res.body).not.toHaveProperty('email');
    expect(res.body).not.toHaveProperty('password');
  });

  it("answers a browser's preflight without a key, with CORS headers", async () => {
    const res = await request(app)
      .options('/artisans')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'GET')
      .set('Access-Control-Request-Headers', 'X-API-Key');

    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBeDefined();
  });
});

describe('error responses give nothing away', () => {
  it('answers a body over 100 kB with JSON, not a stack trace', async () => {
    const res = await request(app)
      .post('/artisans/1/reviews')
      .set('X-API-Key', TEST_API_KEY)
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ author: 'a'.repeat(200_000), rating: 5 }));

    expect(res.status).toBe(413);
    expect(res.body).toEqual({ code: 'body_too_large', message: 'Request body must be under 100 kB.' });
    expect(res.text).not.toMatch(/node_modules|at \w+ \(/);
  });
});

describe('the website needs no key', () => {
  it('serves its own routes without one', async () => {
    const res = await request(app).get('/stats');
    expect(res.status).toBe(200);
  });

  it('reaches the busy-time route through /profiles without a key', async () => {
    const res = await request(app)
      .post('/profiles/999999/availability')
      .send({ start: '2030-01-01T09:00:00Z', end: '2030-01-01T10:00:00Z' });

    // Same code as the partner route: a 404 for the missing artisan, not a 401.
    expect(res.status).toBe(404);
  });
});

describe('createApiKeyCheck', () => {
  // A small app with its own check, so the limit can be tiny.
  function appWith(options) {
    const lines = [];
    const small = express();
    small.use(createApiKeyCheck({ log: line => lines.push(line), ...options }));
    small.get('/', (req, res) => res.json({ consumer: req.consumer }));
    return { small, lines };
  }

  it('reads name:key pairs and skips broken ones', () => {
    expect(parseKeys(' meditrac:abc , kanairo:d:e ,broken, :nokey')).toEqual([
      { name: 'meditrac', key: 'abc' },
      { name: 'kanairo', key: 'd:e' },
    ]);
    expect(parseKeys(undefined)).toEqual([]);
  });

  it('knows which team is calling', async () => {
    const { small } = appWith({ keys: 'meditrac:m-key,kanairo:k-key' });
    const res = await request(small).get('/').set('X-API-Key', 'k-key');
    expect(res.body).toEqual({ consumer: 'kanairo' });
  });

  it('sends 429 with Retry-After once a key passes its limit, per key', async () => {
    const { small } = appWith({ keys: 'meditrac:m-key,kanairo:k-key', perMinute: 2 });

    expect((await request(small).get('/').set('X-API-Key', 'm-key')).status).toBe(200);
    const second = await request(small).get('/').set('X-API-Key', 'm-key');
    expect(second.status).toBe(200);
    expect(second.headers['ratelimit-remaining']).toBe('0');

    const third = await request(small).get('/').set('X-API-Key', 'm-key');
    expect(third.status).toBe(429);
    expect(third.body.code).toBe('rate_limited');
    const wait = Number(third.headers['retry-after']);
    expect(wait).toBeGreaterThan(0);
    expect(wait).toBeLessThanOrEqual(60);

    // Meditrac's traffic doesn't use up Kanairo's allowance.
    expect((await request(small).get('/').set('X-API-Key', 'k-key')).status).toBe(200);
  });

  it('turns everyone away when no keys are set up', async () => {
    const { small, lines } = appWith({ keys: '' });
    expect((await request(small).get('/').set('X-API-Key', 'anything')).status).toBe(401);
    expect(lines[0]).toMatch(/API_KEYS is not set/);
  });

  it('logs who called and the status, but never a key', async () => {
    const { small, lines } = appWith({ keys: 'meditrac:secret-m-key' });
    await request(small).get('/').set('X-API-Key', 'secret-m-key');
    await request(small).get('/').set('X-API-Key', 'guessed-key');

    expect(lines.join('\n')).toMatch(/meditrac GET \/ → 200/);
    expect(lines.join('\n')).toMatch(/401 unknown key/);
    expect(lines.join('\n')).not.toMatch(/secret-m-key|guessed-key/);
  });
});
