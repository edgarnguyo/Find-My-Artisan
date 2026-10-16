// Availability blocks: the times an artisan is busy. Shared by the contract
// routes (routes/artisans.js) and the website's booking and profile routes.
// Blocks are stored in UTC; the website's booking form works in Kenya time.
const db = require('./db');

// Stored in MySQL as UTC text '2026-09-14 09:00:00' (DATETIME has no time zone).
function toDbTime(value) {
  return new Date(value).toISOString().slice(0, 19).replace('T', ' ');
}

// And back out as the contract's '2026-09-14T09:00:00Z'.
function fromDbTime(value) {
  return value.replace(' ', 'T') + 'Z';
}

// A booking's date ('2026-10-22') and time ('10:00' or '10:00:00') are Kenya
// time, which is UTC+3 all year (Kenya has no daylight saving). Returns UTC
// in the database's format: '2026-10-22 07:00:00'.
function kenyaToDbTime(date, time) {
  return toDbTime(`${date}T${time.slice(0, 5)}:00+03:00`);
}

// Each artisan's booked windows from now to 14 days ahead, as { artisanId: [...] }.
// A window already under way still counts, hence end_at > now, not start_at > now.
// UTC_TIMESTAMP() because the blocks are stored in UTC.
async function busyByArtisan(artisanId = null) {
  const [rows] = await db.query(
    `SELECT artisan_id, start_at, end_at FROM availability_blocks
     WHERE end_at > UTC_TIMESTAMP()
       AND start_at < UTC_TIMESTAMP() + INTERVAL 14 DAY
       AND (? IS NULL OR artisan_id = ?)
     ORDER BY start_at`,
    [artisanId, artisanId]
  );
  const busy = {};
  for (const r of rows) {
    (busy[r.artisan_id] ??= []).push({ start: fromDbTime(r.start_at), end: fromDbTime(r.end_at) });
  }
  return busy;
}

// Two windows overlap when each starts before the other ends. On PATCH the
// block being changed is skipped, so it can't clash with its own old window.
// conn is the connection to ask: pass the transaction's one when inside one.
async function overlapsExistingBlock(artisanId, start, end, skipBlockId = null, conn = db) {
  const [rows] = await conn.query(
    `SELECT id FROM availability_blocks
     WHERE artisan_id = ? AND start_at < ? AND end_at > ? AND id <> ?`,
    [artisanId, end, start, skipBlockId ?? 0]
  );
  return rows.length > 0;
}

module.exports = { toDbTime, fromDbTime, kenyaToDbTime, busyByArtisan, overlapsExistingBlock };
