// A limit on wrong passwords at POST /login, per IP address, so passwords
// can't be guessed without end.
//
// Only wrong attempts (401) count: people who sign in fine are never slowed
// down. Once an address has had `maxFailures` wrong attempts in a window, every
// sign-in from it gets 429 until the window ends, even with the right password,
// so a guesser can't tell when they've found it.
//
// Like the API key limit, the counts are in this server's memory: a restart
// clears them, and two copies of the server would each count separately.

/**
 * maxFailures wrong passwords per address in each windowMs.
 * On Render the address comes from the proxy's X-Forwarded-For (see "trust
 * proxy" in app.js); without that every visitor would share Render's address.
 */
function createLoginLimit({ maxFailures = 10, windowMs = 15 * 60 * 1000 } = {}) {
  // ip → { windowStart, failures }
  const byIp = new Map();

  function entryFor(ip, now) {
    let entry = byIp.get(ip);
    if (!entry || now - entry.windowStart >= windowMs) {
      entry = { windowStart: now, failures: 0 };
      byIp.set(ip, entry);
    }
    return entry;
  }

  return function loginLimit(req, res, next) {
    const now = Date.now();
    const ip = req.ip ?? 'unknown';

    // Drop finished windows now and then, so the map can't grow without end.
    if (byIp.size > 10_000) {
      for (const [key, e] of byIp) if (now - e.windowStart >= windowMs) byIp.delete(key);
    }

    const entry = byIp.get(ip);
    if (entry && now - entry.windowStart < windowMs && entry.failures >= maxFailures) {
      const retryAfter = Math.ceil((entry.windowStart + windowMs - now) / 1000);
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({
        error: `Too many wrong sign-in attempts. Try again in ${Math.ceil(retryAfter / 60)} minutes.`,
      });
    }

    // Count it once /login has answered, and only if the password was wrong.
    res.on('finish', () => {
      if (res.statusCode === 401) entryFor(ip, Date.now()).failures += 1;
    });
    next();
  };
}

// The limit the server uses: 10 wrong passwords per address in 15 minutes,
// unless LOGIN_FAILURES_PER_15_MIN says otherwise (the tests raise it).
const loginLimit = createLoginLimit({
  maxFailures: Number(process.env.LOGIN_FAILURES_PER_15_MIN) || 10,
});

module.exports = { createLoginLimit, loginLimit };
