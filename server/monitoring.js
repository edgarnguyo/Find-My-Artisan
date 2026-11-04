const crypto = require('crypto');

const round = n => Math.round(n * 10) / 10;

// Set by authentication only after a key has been verified (including for 429s).
function who(req) {
  if (!req.apiKey) return 'none';
  return 'key-' + crypto.createHash('sha256').update(req.apiKey).digest('hex').slice(0, 6);
}

// A factory keeps each test/server's counters separate. No persistence is intended:
// these figures describe one process, since its last restart.
function createMonitoring({ log = console.log, now = () => process.hrtime.bigint() } = {}) {
  const stats = {
    startedAt: new Date().toISOString(),
    total: 0, clientErrors: 0, serverErrors: 0, totalMs: 0,
    routes: Object.create(null),
  };

  function monitor(req, res, next) {
    const start = now();
    // Capture before a mounted router temporarily removes its prefix.
    const path = req.path;
    res.on('finish', () => {
      const ms = Number(now() - start) / 1e6;
      log(JSON.stringify({
        time: new Date().toISOString(), method: req.method, path,
        status: res.statusCode, ms: round(ms), caller: who(req),
      }));

      // IDs share one row; rejected/unmatched requests share '(no route)'.
      const route = req.route ? req.baseUrl + req.route.path : '(no route)';
      const label = `${req.method} ${route}`;
      const r = stats.routes[label] ||= {
        count: 0, clientErrors: 0, serverErrors: 0, totalMs: 0, maxMs: 0,
      };
      stats.total += 1;
      stats.totalMs += ms;
      r.count += 1;
      r.totalMs += ms;
      r.maxMs = Math.max(r.maxMs, ms);
      if (res.statusCode >= 500) {
        stats.serverErrors += 1;
        r.serverErrors += 1;
      } else if (res.statusCode >= 400) {
        stats.clientErrors += 1;
        r.clientErrors += 1;
      }
    });
    next();
  }

  function statsHandler(req, res) {
    const routes = Object.create(null);
    for (const [label, r] of Object.entries(stats.routes)) {
      routes[label] = {
        count: r.count, clientErrors: r.clientErrors, serverErrors: r.serverErrors,
        avgMs: round(r.totalMs / r.count), maxMs: round(r.maxMs),
      };
    }
    res.json({
      startedAt: stats.startedAt,
      uptimeSeconds: Math.round(process.uptime()),
      total: stats.total,
      clientErrors: stats.clientErrors,
      serverErrors: stats.serverErrors,
      errorRatePercent: stats.total ? round(stats.serverErrors / stats.total * 100) : 0,
      avgMs: stats.total ? round(stats.totalMs / stats.total) : 0,
      routes,
    });
  }

  return { monitor, statsHandler };
}

// Raw database errors can contain interpolated SQL, passwords and request data.
// Keep only known diagnostic codes, never error messages, SQL or stack traces.
const SAFE_CODES = new Set([
  'ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNRESET',
  'ER_ACCESS_DENIED_ERROR', 'ER_BAD_DB_ERROR', 'ER_NO_SUCH_TABLE',
  'ER_BAD_FIELD_ERROR', 'ER_DUP_ENTRY', 'ER_LOCK_DEADLOCK',
]);
function logError(err) {
  const code = err?.cause?.code || err?.code;
  console.error(JSON.stringify({
    time: new Date().toISOString(), level: 'error',
    code: SAFE_CODES.has(code) ? code : 'internal_error',
  }));
}

const monitoring = createMonitoring({
  log: process.env.NODE_ENV === 'test' ? () => {} : line => console.log(line),
});

module.exports = { ...monitoring, createMonitoring, logError };
