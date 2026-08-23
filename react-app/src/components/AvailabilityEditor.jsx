import { useState } from 'react';
import { saveMyAvailability } from '../api/artisan';

// weekday 0 = Monday, matching the database check constraint and the read-only
// AvailabilityCalendar shown on the public profile.
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function initialRows(availability) {
  return DAYS.map((_, weekday) => {
    const slot = availability.find(a => a.weekday === weekday);
    return {
      weekday,
      on: Boolean(slot),
      start: slot ? slot.start.slice(0, 5) : '08:00',
      end: slot ? slot.end.slice(0, 5) : '17:00',
    };
  });
}

/** The artisan's real weekly schedule — what clients see on the profile. */
export default function AvailabilityEditor({ worker, onSaved }) {
  const [rows, setRows] = useState(() => initialRows(worker.availability));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  function update(weekday, patch) {
    setRows(current =>
      current.map(row => (row.weekday === weekday ? { ...row, ...patch } : row))
    );
  }

  async function handleSave() {
    setError(null);
    setNotice(null);

    const chosen = rows.filter(r => r.on);
    const bad = chosen.find(r => r.end <= r.start);
    if (bad) {
      setError(`${DAYS[bad.weekday]}: the end time must be after the start time.`);
      return;
    }

    setSaving(true);
    try {
      await saveMyAvailability(
        worker.id,
        chosen.map(r => ({ weekday: r.weekday, start: r.start, end: r.end }))
      );
      setNotice('Availability saved.');
      onSaved?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="dash-card">
      <h2>Availability</h2>
      <p className="dash-hint">
        Tick the days you work and set your hours. Clients see exactly this on
        your profile.
      </p>

      <ul className="availability-editor">
        {rows.map(row => (
          <li key={row.weekday} className={`availability-row${row.on ? ' is-on' : ''}`}>
            <label className="availability-toggle">
              <input
                type="checkbox"
                checked={row.on}
                onChange={e => update(row.weekday, { on: e.target.checked })}
              />
              {DAYS[row.weekday]}
            </label>

            <input
              type="time"
              value={row.start}
              disabled={!row.on}
              aria-label={`${DAYS[row.weekday]} start time`}
              onChange={e => update(row.weekday, { start: e.target.value })}
            />
            <span className="availability-dash">–</span>
            <input
              type="time"
              value={row.end}
              disabled={!row.on}
              aria-label={`${DAYS[row.weekday]} end time`}
              onChange={e => update(row.weekday, { end: e.target.value })}
            />
          </li>
        ))}
      </ul>

      {error && <small className="error">{error}</small>}
      {notice && <div className="confirmation">{notice}</div>}

      <button type="button" className="submit-btn" onClick={handleSave} disabled={saving}>
        {saving ? 'Saving…' : 'Save availability'}
      </button>
    </section>
  );
}
