const db = require('./db');

// Runs fn(conn) as one transaction: what it saves is kept only if it finishes
// without an error; otherwise all of it is undone, so the database never holds
// half a change (say, a block saved for a booking that was never accepted).
async function inTransaction(fn) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = { inTransaction };
