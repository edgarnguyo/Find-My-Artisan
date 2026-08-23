import { useState } from 'react';
import { setBookingStatus } from '../api/artisan';

const TABS = [
  { key: 'requests',  label: 'Requests',  match: s => s === 'pending' },
  { key: 'upcoming',  label: 'Upcoming',  match: s => s === 'confirmed' },
  { key: 'completed', label: 'Completed', match: s => s === 'completed' },
  { key: 'cancelled', label: 'Cancelled', match: s => s === 'cancelled' },
];

function formatDate(value) {
  return new Date(value).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

/**
 * The artisan's side of the booking lifecycle: accept a request, mark the work
 * done, or turn it down. The matching policy is what actually permits this —
 * a client can only ever move a booking to 'cancelled'.
 */
export default function ArtisanBookings({ bookings, onChanged }) {
  const [tab, setTab] = useState('requests');
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [completing, setCompleting] = useState(null);
  const [finalPrice, setFinalPrice] = useState('');

  const active = TABS.find(t => t.key === tab);
  const visible = bookings.filter(b => active.match(b.status));

  async function move(id, status, price = null) {
    setBusy(id);
    setError(null);
    try {
      await setBookingStatus(id, status, price);
      setCompleting(null);
      setFinalPrice('');
      onChanged?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="dash-card">
      <h2>Bookings</h2>

      <div className="bookings-tabs">
        {TABS.map(t => (
          <button
            key={t.key}
            type="button"
            className={`bookings-tab${tab === t.key ? ' active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
            <span className="tab-count">{bookings.filter(b => t.match(b.status)).length}</span>
          </button>
        ))}
      </div>

      {error && <small className="error">{error}</small>}

      {visible.length === 0 ? (
        <p className="dash-empty">Nothing here yet.</p>
      ) : (
        <div className="bookings-list">
          {visible.map(booking => (
            <article key={booking.id} className="booking-row">
              <div className="booking-row-main">
                <h3>{booking.clientName}</h3>
                <p className="booking-row-skill">
                  {booking.contact}
                  {!booking.userId && ' · guest booking'}
                </p>
                <p className="booking-row-job">{booking.job}</p>
                <p className="booking-row-when">
                  {formatDate(booking.date)} at {booking.time.slice(0, 5)}
                  {booking.agreedPrice !== null && ` · quoted ${booking.agreedPrice}`}
                  {booking.finalPrice !== null && ` · charged ${booking.finalPrice}`}
                </p>
              </div>

              <div className="booking-row-side">
                <span className={`status-pill status-${booking.status}`}>{booking.status}</span>

                {booking.status === 'pending' && (
                  <>
                    <button
                      type="button"
                      className="btn-primary small"
                      disabled={busy === booking.id}
                      onClick={() => move(booking.id, 'confirmed')}
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      className="link-button"
                      disabled={busy === booking.id}
                      onClick={() => move(booking.id, 'cancelled')}
                    >
                      Decline
                    </button>
                  </>
                )}

                {booking.status === 'confirmed' && completing !== booking.id && (
                  <>
                    <button
                      type="button"
                      className="btn-primary small"
                      onClick={() => setCompleting(booking.id)}
                    >
                      Mark completed
                    </button>
                    <button
                      type="button"
                      className="link-button"
                      disabled={busy === booking.id}
                      onClick={() => move(booking.id, 'cancelled')}
                    >
                      Cancel
                    </button>
                  </>
                )}

                {completing === booking.id && (
                  <div className="complete-box">
                    <label htmlFor={`final-${booking.id}`}>Final price charged</label>
                    <input
                      id={`final-${booking.id}`}
                      type="number"
                      min="0"
                      step="0.01"
                      value={finalPrice}
                      onChange={e => setFinalPrice(e.target.value)}
                    />
                    <button
                      type="button"
                      className="btn-primary small"
                      disabled={busy === booking.id}
                      onClick={() => move(booking.id, 'completed', finalPrice)}
                    >
                      {busy === booking.id ? 'Saving…' : 'Confirm completed'}
                    </button>
                    <button
                      type="button"
                      className="link-button"
                      onClick={() => { setCompleting(null); setFinalPrice(''); }}
                    >
                      Back
                    </button>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
