const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// The secret signs sign-in tokens. Anyone who has it could forge a token for any
// account, so it never leaves the server. JWT_SECRET in .env wins; otherwise a
// random secret is created once and kept in server/.jwt-secret (gitignored), so
// restarting the server doesn't sign everybody out.
function loadSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;

  const file = path.join(__dirname, '.jwt-secret');
  try {
    const saved = fs.readFileSync(file, 'utf8').trim();
    if (saved) return saved;
  } catch {
    // No file yet: fall through and create one.
  }
  const secret = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(file, `${secret}\n`, { mode: 0o600 });
  return secret;
}

const SECRET = loadSecret();

// A JWT is three base64 parts: header.payload.signature. The payload is readable
// by anyone, so it only holds the id, email and role, never the password. The
// signature is what stops anyone from editing it.
function signToken(user) {
  return jwt.sign(
    { sub: String(user.id), email: user.email, role: user.role },
    SECRET,
    { expiresIn: '7d' }
  );
}

// Returns undefined when no token was sent, null when the token is invalid or
// expired, and { id, email, role } when it checks out.
function userFromRequest(req) {
  const header = req.get('Authorization') || '';
  if (!header.startsWith('Bearer ')) return undefined;

  try {
    const payload = jwt.verify(header.slice('Bearer '.length), SECRET, { algorithms: ['HS256'] });
    return { id: Number(payload.sub), email: payload.email, role: payload.role };
  } catch {
    return null;
  }
}

// For routes anyone may use: a signed-in caller gets req.user, a guest gets null.
function optionalAuth(req, res, next) {
  const user = userFromRequest(req);
  if (user === null) return res.status(401).json({ error: 'Your session has expired. Sign in again.' });
  req.user = user ?? null;
  next();
}

// For routes that only make sense for a signed-in user.
function requireAuth(req, res, next) {
  const user = userFromRequest(req);
  if (!user) return res.status(401).json({ error: 'Sign in first' });
  req.user = user;
  next();
}

module.exports = { signToken, optionalAuth, requireAuth };
