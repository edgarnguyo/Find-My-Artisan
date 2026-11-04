const crypto = require('crypto');
const express = require('express');
const request = require('supertest');
const { createMonitoring, logError } = require('../monitoring');
const { createApiKeyCheck } = require('../apiKey');

function fixture(perMinute = 100) {
  const lines = [];
  let ticks = 0n;
  const monitoring = createMonitoring({
    log: line => lines.push(JSON.parse(line)),
    now: () => (ticks += 10_000_000n),
  });
  const app = express();
  app.use(monitoring.monitor);
  app.use(express.json());
  app.use(createApiKeyCheck({ keys: 'owner:owner-secret,partner:partner-secret', perMinute, log: () => {} }));
  app.get('/stats', monitoring.statsHandler);
  const router = express.Router();
  router.get('/:id', (req, res) => res.status(req.params.id === '999' ? 404 : 200).json({ id: req.params.id }));
  app.use('/artisans', router);
  app.get('/failure', (req, res) => res.status(503).end());
  app.use((err, req, res, next) => res.status(err.status || 500).end());
  return { app, lines };
}

test('one safe JSON record per response, including 401 and 429, with caller fingerprints', async () => {
  const { app, lines } = fixture(1);
  await request(app).get('/artisans/1?email=private@example.com').set('X-API-Key', 'owner-secret');
  await request(app).get('/artisans/2').set('X-API-Key', 'owner-secret');
  await request(app).get('/artisans/1').set('X-API-Key', 'wrong-secret');
  await request(app).get('/artisans/1');
  await request(app).get('/artisans/1').set('X-API-Key', 'partner-secret');

  expect(lines.map(l => l.status)).toEqual([200, 429, 401, 401, 200]);
  expect(lines[0]).toEqual({
    time: expect.any(String), method: 'GET', path: '/artisans/1', status: 200, ms: 10,
    caller: 'key-' + crypto.createHash('sha256').update('owner-secret').digest('hex').slice(0, 6),
  });
  expect(Number.isNaN(Date.parse(lines[0].time))).toBe(false);
  expect(lines[1].caller).toBe(lines[0].caller);
  expect(lines[2].caller).toBe('none');
  expect(lines[3].caller).toBe('none');
  expect(lines[4].caller).not.toBe(lines[0].caller);
  expect(JSON.stringify(lines)).not.toMatch(/owner-secret|partner-secret|wrong-secret|email|private@example/);
});

test('accurate totals, separate error classes, route grouping, timings and self-counting', async () => {
  const { app } = fixture();
  const get = path => request(app).get(path).set('X-API-Key', 'owner-secret');
  const initial = (await get('/stats')).body;
  expect(initial).toMatchObject({ total: 0, avgMs: 0, errorRatePercent: 0, routes: {} });
  await get('/artisans/1');
  await get('/artisans/2');
  await get('/artisans/999');
  await get('/failure');
  await get('/missing');
  await request(app).get('/artisans/1');
  const stats = (await get('/stats')).body;
  expect(stats).toMatchObject({
    total: 7, clientErrors: 3, serverErrors: 1, errorRatePercent: 14.3, avgMs: 10,
    startedAt: expect.any(String), uptimeSeconds: expect.any(Number),
    routes: {
      'GET /artisans/:id': { count: 3, clientErrors: 1, serverErrors: 0, avgMs: 10, maxMs: 10 },
      'GET (no route)': { count: 2, clientErrors: 2, serverErrors: 0, avgMs: 10, maxMs: 10 },
      'GET /failure': { count: 1, serverErrors: 1 },
      'GET /stats': { count: 1 },
    },
  });
  expect(stats.routes).not.toHaveProperty('GET /artisans/1');
  expect((await get('/stats')).body.total).toBe(8);
  expect((await request(fixture().app).get('/stats').set('X-API-Key', 'owner-secret')).body.total).toBe(0);
});

test('averages and maxima use unrounded durations, including nested route prefixes', async () => {
  const readings = [0n, 1_240_000n, 2_000_000n, 7_960_000n, 8_000_000n, 9_000_000n];
  const monitoring = createMonitoring({ log: () => {}, now: () => readings.shift() });
  const app = express();
  app.use(monitoring.monitor);
  const router = express.Router();
  router.get('/:id', (req, res) => res.end());
  app.use('/nested/artisans', router);
  app.get('/stats', monitoring.statsHandler);
  await request(app).get('/nested/artisans/1');
  await request(app).get('/nested/artisans/2');
  const stats = (await request(app).get('/stats')).body;
  expect(stats.avgMs).toBe(3.6);
  expect(stats.routes['GET /nested/artisans/:id']).toMatchObject({ count: 2, avgMs: 3.6, maxMs: 6 });
});

test('parser failures are observed without logging bodies, passwords or tokens', async () => {
  const { app, lines } = fixture();
  await request(app).post('/artisans').set('Content-Type', 'application/json')
    .send('{"password":"body-secret","token":"token-secret",');
  expect(lines).toHaveLength(1);
  expect(lines[0]).toMatchObject({ status: 400, caller: 'none', method: 'POST' });
  expect(JSON.stringify(lines)).not.toMatch(/body-secret|token-secret|password|token/);
});

test('exception diagnostics never dump SQL, messages, passwords, URLs or arbitrary codes', () => {
  const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
  try {
    logError({ code: 'ER_DUP_ENTRY', sql: "INSERT secret-password", message: 'private-email' });
    logError({ code: 'secret-token', message: 'https://host/?key=secret' });
    const records = spy.mock.calls.map(([line]) => JSON.parse(line));
    expect(records.map(r => r.code)).toEqual(['ER_DUP_ENTRY', 'internal_error']);
    expect(JSON.stringify(records)).not.toMatch(/secret|private-email|INSERT|https/);
  } finally {
    spy.mockRestore();
  }
});

test('the real app protects /stats and observes preflights and parser errors', async () => {
  const app = require('../app');
  const { TEST_API_KEY } = require('../jest.setup');
  expect((await request(app).get('/stats')).status).toBe(401);
  expect((await request(app).get('/stats').set('X-API-Key', 'wrong')).status).toBe(401);
  const first = await request(app).get('/stats').set('X-API-Key', TEST_API_KEY);
  expect(first.status).toBe(200);
  expect(first.body.total).toBe(2);
  await request(app).options('/artisans').set('Origin', 'http://localhost:5173')
    .set('Access-Control-Request-Method', 'GET');
  await request(app).post('/artisans').set('Content-Type', 'application/json').send('{');
  const second = await request(app).get('/stats').set('X-API-Key', TEST_API_KEY);
  expect(second.body.total).toBe(5);
  expect(second.body.clientErrors).toBe(3);
  expect(second.body.routes['OPTIONS (no route)'].count).toBe(1);
});
