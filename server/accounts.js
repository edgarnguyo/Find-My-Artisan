// Password changes and account deletion, shared by clients (routes/clients.js)
// and artisans (routes/profiles.js). Both need the current password, so a
// request carrying only someone's id can't take over or delete their account.
const db = require('./db');

// Each account kind's table. The name comes from here, never from the request.
const TABLES = { client: 'clients', artisan: 'artisans' };

// Same rule as sign-up.
const MIN_PASSWORD = 6;

// 'ok', 'missing' (no such account) or 'wrong'. Compared in JavaScript like
// /login does: === is case-sensitive, MySQL's = is not. Sample artisans have no
// password (NULL), so nothing matches for them.
async function checkPassword(kind, id, password, conn = db) {
  const [rows] = await conn.query(`SELECT password FROM ${TABLES[kind]} WHERE id = ?`, [id]);
  if (rows.length === 0) return 'missing';
  return typeof password === 'string' && rows[0].password === password ? 'ok' : 'wrong';
}

// Sends the answer for a failed checkPassword and returns true, or returns
// false when the password was right.
function sentPasswordProblem(res, result) {
  if (result === 'missing') {
    res.status(404).json({ error: 'Account not found' });
    return true;
  }
  if (result === 'wrong') {
    res.status(403).json({ error: 'That password is wrong' });
    return true;
  }
  return false;
}

// The handler for PATCH /clients/:id/password and PATCH /profiles/:id/password,
// with { currentPassword, newPassword }.
function changePasswordRoute(kind) {
  return async (req, res) => {
    const { currentPassword, newPassword } = req.body ?? {};
    if (typeof newPassword !== 'string' || newPassword.length < MIN_PASSWORD) {
      return res.status(400).json({ error: `The new password must be at least ${MIN_PASSWORD} characters` });
    }
    try {
      const result = await checkPassword(kind, req.params.id, currentPassword);
      if (sentPasswordProblem(res, result)) return;
      // Saved as typed, like sign-up. Hashing passwords comes with Week 9's auth.
      await db.query(`UPDATE ${TABLES[kind]} SET password = ? WHERE id = ?`, [newPassword, req.params.id]);
      res.json({ id: Number(req.params.id), changed: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to change password' });
    }
  };
}

module.exports = { checkPassword, sentPasswordProblem, changePasswordRoute };
