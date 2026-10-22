// Demo data: gives the artisans varied busy times over the next 14 days, so the
// profiles' availability calendars (and the API's busy lists) don't all say
// "Free". Times are worked out from today, so run it again before a demo.
//
//   npm run demo:availability            replace the demo busy times
//   npm run demo:availability -- --remove   take them all out again
//
// It writes to the database in server/.env, which may be the hosted one.
//
// Demo blocks are marked by created_at = DEMO_MARK, a date no real block can
// have (real ones get the time they were added). That's how a rerun or --remove
// finds them without touching busy times artisans or bookings added for real.
require('dotenv').config({ quiet: true });
const db = require('./db');
const { toDbTime } = require('./availability');

const DEMO_MARK = '2000-01-01 00:00:00';

// Kenya is UTC+3 all year. A Kenya date ('2026-10-22') `days` from today.
function kenyaDay(days) {
  const now = new Date(Date.now() + 3 * 60 * 60 * 1000);
  now.setUTCDate(now.getUTCDate() + days);
  return now.toISOString().slice(0, 10);
}

// One busy window, in Kenya time: [day offset, from, to].
const window = (days, from, to) => [
  new Date(`${kenyaDay(days)}T${from}:00+03:00`),
  new Date(`${kenyaDay(days)}T${to}:00+03:00`),
];

// Busy from an hour ago to three hours from now, on the quarter hour.
function rightNow() {
  const quarter = 15 * 60 * 1000;
  const start = Math.floor((Date.now() - 60 * 60 * 1000) / quarter) * quarter;
  return [new Date(start), new Date(start + 4 * 60 * 60 * 1000)];
}

// The patterns, given out in turn by artisan id. Three of the nine are empty, so
// about a third of the artisans stay free for the whole 14 days.
const PATTERNS = [
  { name: 'free', windows: () => [] },
  { name: 'busy right now, one more job later', windows: () => [rightNow(), window(4, '09:00', '12:00')] },
  { name: 'booked solid for 5 days', windows: () => [0, 1, 2, 3, 4].map(d => window(d, '08:00', '18:00')) },
  { name: 'a few jobs', windows: () => [window(1, '09:00', '13:00'), window(3, '14:00', '17:00'), window(8, '10:00', '15:00')] },
  { name: 'free', windows: () => [] },
  { name: 'mornings all week', windows: () => [1, 2, 3, 4, 5, 6].map(d => window(d, '08:00', '12:00')) },
  { name: 'one job next week', windows: () => [window(9, '10:00', '16:00')] },
  { name: 'busy most of next week', windows: () => [7, 8, 9, 10, 11].map(d => window(d, '08:00', '17:00')) },
  { name: 'free', windows: () => [] },
];

async function main() {
  const remove = process.argv.includes('--remove');
  console.log(`Database: ${process.env.DB_HOST}/${process.env.DB_NAME}`);

  const [removed] = await db.query('DELETE FROM availability_blocks WHERE created_at = ?', [DEMO_MARK]);
  console.log(`Removed ${removed.affectedRows} earlier demo busy times.`);
  if (remove) return;

  const [artisans] = await db.query('SELECT id, name FROM artisans ORDER BY id');
  let added = 0;
  let skipped = 0;
  for (const artisan of artisans) {
    const pattern = PATTERNS[artisan.id % PATTERNS.length];
    for (const [start, end] of pattern.windows()) {
      // Never on top of a real busy time (a booking or one the artisan added).
      const [clash] = await db.query(
        'SELECT id FROM availability_blocks WHERE artisan_id = ? AND start_at < ? AND end_at > ?',
        [artisan.id, toDbTime(end), toDbTime(start)]
      );
      if (clash.length) {
        skipped += 1;
        continue;
      }
      await db.query(
        'INSERT INTO availability_blocks (artisan_id, start_at, end_at, created_at) VALUES (?, ?, ?, ?)',
        [artisan.id, toDbTime(start), toDbTime(end), DEMO_MARK]
      );
      added += 1;
    }
    console.log(`  ${String(artisan.id).padStart(3)}  ${artisan.name.padEnd(24)} ${pattern.name}`);
  }
  console.log(`Added ${added} demo busy times${skipped ? ` (${skipped} skipped: a real one was there)` : ''}.`);
}

main()
  .catch(err => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => db.end());
