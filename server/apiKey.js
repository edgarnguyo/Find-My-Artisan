// API keys for the partner API (the /artisans routes in openapi.yaml).
// Each team that calls us gets its own key, sent in the X-API-Key header.
// Keys live only in server/.env (or Render's environment), never in git.
//
//   API_KEYS=meditrac:<long random key>,kanairo:<another key>
//
// The name before the colon says who is calling. It shows in the log and is
// the bucket for the rate limit, so one team's traffic never uses up another's
// allowance, and one key can be removed without touching the rest.
const crypto = require('crypto');

const HEADER = 'X-API-Key';

// "meditrac:abc,kanairo:def" → [{ name: 'meditrac', key: 'abc' }, ...]
function parseKeys(text = '') {
  return text
    .split(',')
    .map(pair => pair.trim())
    .filter(Boolean)
    // A pair without a colon has no name, so it is skipped rather than guessed at.
    .filter(pair => pair.includes(':'))
    .map(pair => {
      const colon = pair.indexOf(':');
      return { name: pair.slice(0, colon).trim(), key: pair.slice(colon + 1).trim() };
    })
    .filter(({ name, key }) => name && key);
}

// Compares fixed-length hashes with timingSafeEqual. A plain === stops at the
// first wrong character, so how long it takes leaks how much of a guess was right.
const hash = text => crypto.createHash('sha256').update(text).digest();

function findConsumer(consumers, sentKey) {
  const sent = hash(sentKey);
  return consumers.find(c => crypto.timingSafeEqual(hash(c.key), sent)) ?? null;
}

function sendError(res, status, code, message) {
  res.status(status).json({ code, message });
}

/**
 * Middleware that lets a request through only with a known key, and at most
 * perMinute requests per key in each one-minute window.
 * Mount it AFTER cors(): a browser's preflight (OPTIONS) carries no key, and
 * cors() has to answer it before this check would turn it away with a 401.
 */
function createApiKeyCheck({ keys = '', perMinute = 60, log = console.log } = {}) {
  const consumers = parseKeys(keys);
  // name → { windowStart, count }. In memory, so it resets when the server restarts.
  const usage = new Map();

  if (consumers.length === 0) {
    log(`[api] API_KEYS is not set, so every /artisans request will get 401.`);
  } else {
    // Names and key lengths only, so a mistyped value can be spotted in the
    // log (a quote, a missing character) without the key ever being printed.
    const loaded = consumers.map(c => {
      const quoted = /^["']|["']$/.test(c.name) || /^["']|["']$/.test(c.key);
      return `${c.name} (${c.key.length} characters${quoted ? ', has a quote mark' : ''})`;
    });
    log(`[api] API keys loaded for: ${loaded.join(', ')}`);
  }

  return function requireApiKey(req, res, next) {
    // The path without the query string, e.g. "GET /artisans/3".
    const where = `${req.method} ${req.originalUrl.split('?')[0]}`;
    const sentKey = req.get(HEADER);

    if (!sentKey) {
      log(`[api] 401 no key: ${where}`);
      return sendError(res, 401, 'unauthorized', `Send your API key in the ${HEADER} header.`);
    }
    const consumer = findConsumer(consumers, sentKey);
    if (!consumer) {
      // Log that a key was wrong, never the key itself.
      log(`[api] 401 unknown key: ${where}`);
      return sendError(res, 401, 'unauthorized', 'That API key is not valid.');
    }

    // Fixed window: count requests since the window began; start a new one each minute.
    const now = Date.now();
    let entry = usage.get(consumer.name);
    if (!entry || now - entry.windowStart >= 60_000) {
      entry = { windowStart: now, count: 0 };
      usage.set(consumer.name, entry);
    }
    entry.count += 1;

    res.set('RateLimit-Limit', String(perMinute));
    res.set('RateLimit-Remaining', String(Math.max(0, perMinute - entry.count)));

    if (entry.count > perMinute) {
      const retryAfter = Math.ceil((entry.windowStart + 60_000 - now) / 1000);
      res.set('Retry-After', String(retryAfter));
      log(`[api] 429 ${consumer.name}: ${where}`);
      return sendError(
        res,
        429,
        'rate_limited',
        `Too many requests: the limit is ${perMinute} a minute. Try again in ${retryAfter} seconds.`
      );
    }

    // Log once the route has answered, so the line has the status code.
    res.on('finish', () => log(`[api] ${consumer.name} ${where} → ${res.statusCode}`));
    req.consumer = consumer.name;
    next();
  };
}

// The check the server uses, set up from the environment.
const requireApiKey = createApiKeyCheck({
  keys: process.env.API_KEYS,
  perMinute: Number(process.env.RATE_LIMIT_PER_MINUTE) || 60,
  // Jest sets NODE_ENV=test; a line per request would bury the test results.
  log: process.env.NODE_ENV === 'test' ? () => {} : console.log,
});

module.exports = { HEADER, parseKeys, createApiKeyCheck, requireApiKey };
