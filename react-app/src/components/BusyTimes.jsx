import { useState, useCallback } from 'react';
import { fetchBusyTimes, addBusyTime, removeBusyTime } from '../api/workers';
import { useAsync } from '../hooks/useAsync';
import { fromKenya, kenyaClock, kenyaDate, kenyaDayLabel } from '../lib/kenyaTime';

/**
 * The artisan's own busy times on their dashboard. Accepted jobs appear here by
 * themselves; the artisan can also block out time for work agreed elsewhere.
 * Clients see these times on the profile page and can't book into them, and
 * Meditrac sees them in the API's busy list.
 *
 * reloadKey changes when the dashboard accepts a job, so the list refreshes.
 */
export default function BusyTimes({ artisanId, reloadKey }) {
  const [ownKey, setOwnKey] = useState(0);
  const [date, setDate] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(null);

  const load = useCallback(() => fetchBusyTimes(artisanId), [artisanId]);
  const { data: blocks, error, loading } = useAsync(load, [artisanId, reloadKey, ownKey]);

  async function handleAdd(e) {
    e.preventDefault();
    setFormError(null);
    if (!date || !from || !to) {
      setFormError('Choose a date, a start time and an end time.');
      return;
    }
    if (to <= from) {
      setFormError('The end time must be after the start time.');
      return;
    }
    if (date < kenyaDate(new Date())) {
      setFormError('That date has already passed.');
      return;
    }

    setSaving(true);
    try {
      await addBusyTime(artisanId, fromKenya(date, from), fromKenya(date, to));
      setDate('');
      setFrom('');
      setTo('');
      setOwnKey(k => k + 1);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(blockId) {
    setRemoving(blockId);
    try {
      await removeBusyTime(artisanId, blockId);
      setOwnKey(k => k + 1);
    } catch (err) {
      alert(`Could not remove it: ${err.message}`);
    } finally {
      setRemoving(null);
    }
  }

  return (
    <section className="busy-times">
      <h2>When You're Busy</h2>
      <p className="bookings-sub">
        Clients can't request you at these times (Kenya time). Accepted jobs are added
        for you; add other work here yourself.
      </p>

      {loading ? (
        <p className="bookings-sub">Loading…</p>
      ) : error ? (
        <p className="error">Could not load your busy times: {error.message}</p>
      ) : blocks.length === 0 ? (
        <p className="bookings-sub">Nothing yet: you show as free.</p>
      ) : (
        <ul className="busy-list">
          {blocks.map(block => (
            <li key={block.id}>
              <span>
                <strong>
                  {kenyaDayLabel(block.start)}, {kenyaClock(block.start)}–{kenyaClock(block.end)}
                </strong>
                <span className="busy-reason">
                  {block.bookingId ? `Booked job: ${block.job}` : 'Marked busy'}
                </span>
              </span>
              {/* A booked job's time is freed by the booking being cancelled, not here. */}
              {!block.bookingId && (
                <button
                  className="link-button"
                  onClick={() => handleRemove(block.id)}
                  disabled={removing === block.id}
                >
                  {removing === block.id ? 'Removing…' : 'Remove'}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <form className="busy-form" onSubmit={handleAdd} noValidate>
        <div className="field">
          <label htmlFor="busy-date">Date</label>
          <input id="busy-date" type="date" value={date} onChange={e => setDate(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="busy-from">From</label>
          <input id="busy-from" type="time" value={from} onChange={e => setFrom(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="busy-to">To</label>
          <input id="busy-to" type="time" value={to} onChange={e => setTo(e.target.value)} />
        </div>
        <button type="submit" className="booking-action" disabled={saving}>
          {saving ? 'Saving…' : 'Mark busy'}
        </button>
      </form>
      {formError && <small className="error">{formError}</small>}
    </section>
  );
}
