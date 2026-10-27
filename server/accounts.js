// Password changes and account deletion, shared by clients (routes/clients.js)
// and artisans (routes/profiles.js). The routes using these only run for the
// signed-in owner of the account (requireOwnAccount in session.js), and both
// still ask for the current password, so someone at an unlocked computer
// can't take over or delete the account.
const db = require('./db');
const { newPasswordProblem, hashPassword, verifyPassword } = require('./passwords');

// Each account kind's table. The name comes from here, never from the request.
const TABLES = { client: 'clients', artisan: 'artisans' };

/** Saves a right password typed for a plain-text account as a hash instead. */
async function hashIfPlain(kind, id, typed, { needsHash }, conn = db) {
  if (needsHash) {
    await conn.query(`UPDATE ${TABLES[kind]} SET password = ? WHERE id = ?`, [await hashPassword(typed), id]);
  }
}

// 'ok', 'missing' (no such account) or 'wrong'. Sample artisans have no
// password (NULL), so nothing matches for them.
async function checkPassword(kind, id, password, conn = db) {
  const [rows] = await conn.query(`SELECT password FROM ${TABLES[kind]} WHERE id = ?`, [id]);
  if (rows.length === 0) return 'missing';
  const result = await verifyPassword(password, rows[0].password);
  if (!result.ok) return 'wrong';
  await hashIfPlain(kind, id, password, result, conn);
  return 'ok';
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
    const problem = newPasswordProblem(newPassword);
    if (problem) {
      return res.status(400).json({ error: problem.replace('Password', 'The new password') });
    }
    try {
      const result = await checkPassword(kind, req.params.id, currentPassword);
      if (sentPasswordProblem(res, result)) return;
      await db.query(`UPDATE ${TABLES[kind]} SET password = ? WHERE id = ?`, [
        await hashPassword(newPassword), req.params.id,
      ]);
      res.json({ id: Number(req.params.id), changed: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to change password' });
    }
  };
}

module.exports = { TABLES, hashIfPlain, checkPassword, sentPasswordProblem, changePasswordRoute };
