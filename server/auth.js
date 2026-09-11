const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
// Fallback for the Supabase settings: React already has them in its .env.local.
// dotenv never overwrites a variable that is already set, so server/.env wins.
require('dotenv').config({
  path: path.join(__dirname, '..', 'react-app', '.env.local'),
  quiet: true,
});

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

// Sessions live in the browser; the server only checks tokens it is sent.
const supabase = url && key
  ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

// Signing in gives the browser an access token. React sends it as
// "Authorization: Bearer <token>", and Supabase tells us which user it belongs to.
// Returns undefined when no token was sent, null when the token is not valid.
async function userFromRequest(req) {
  const header = req.get('Authorization') || '';
  if (!header.startsWith('Bearer ')) return undefined;
  if (!supabase) throw new Error('Supabase URL/key missing: cannot check sign-in tokens');

  const { data, error } = await supabase.auth.getUser(header.slice('Bearer '.length));
  return error ? null : data.user;
}

// For routes anyone may use: a signed-in caller gets req.user, a guest gets null.
async function optionalAuth(req, res, next) {
  const user = await userFromRequest(req);
  if (user === null) return res.status(401).json({ error: 'Your session has expired. Sign in again.' });
  req.user = user ?? null;
  next();
}

// For routes that only make sense for a signed-in user.
async function requireAuth(req, res, next) {
  const user = await userFromRequest(req);
  if (!user) return res.status(401).json({ error: 'Sign in first' });
  req.user = user;
  next();
}

module.exports = { optionalAuth, requireAuth };
