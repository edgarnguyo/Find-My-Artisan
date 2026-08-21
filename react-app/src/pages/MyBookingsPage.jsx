import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { fetchMyBookings, cancelBooking } from '../api/workers';
import { useAsync } from '../hooks/useAsync';
import { useAuth } from '../lib/authContext';
import Avatar from '../components/Avatar';

const TABS = [
  { key: 'active',    label: 'Upcoming',  match: s => s === 'pending' || s === 'confirmed' },
  { key: 'completed', label: 'Completed', match: s => s === 'completed' },
  { key: 'cancelled', label: 'Cancelled', match: s => s === 'cancelled' },
];

function formatDate(value) {
  return new Date(value).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

export default function MyBookingsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState('active');
  const [reloadKey, setReloadKey] = useState(0);
  const [cancelling, setCancelling] = useState(null);

  const load = useCallback(() => fetchMyBookings(), []);
  const { data: bookings, error, loading } = useAsync(load, [reloadKey, user?.id]);

  async function handleCancel(id) {
    setCancelling(id);
    try {
      await cancelBooking(id);
      setReloadKey(k => k + 1);
    } catch (err) {
      alert(`Could not cancel: ${err.message}`);
    } finally {
      setCancelling(null);
    }
  }

  const active = TABS.find(t => t.key === tab);
  const visible = (bookings ?? []).filter(b => active.match(b.status));

  const countFor = key => {
    const spec = TABS.find(t => t.key === key);
    return (bookings ?? []).filter(b => spec.match(b.status)).length;
  };

  return (
    <main className="bookings-page">
      <header className="bookings-header">
        <h1>My bookings</h1>
        <p className="bookings-sub">Signed in as {user?.email}</p>
      </header>

      <div className="bookings-tabs">
        {TABS.map(t => (
          <button
            key={t.key}
            className={`bookings-tab${tab === t.key ? ' active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
            {!loading && <span className="tab-count">{countFor(t.key)}</span>}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="bookings-list">
          {[...Array(3)].map((_, i) => <div key={i} className="skeleton-card" />)}
        </div>
      ) : error ? (
        <p className="error">Could not load your bookings: {error.message}</p>
      ) : visible.length === 0 ? (
        <div className="bookings-empty">
          <p>No {active.label.toLowerCase()} bookings yet.</p>
          <Link to="/listings" className="btn-primary">Find an artisan</Link>
        </div>
      ) : (
        <div className="bookings-list">
          {visible.map(booking => (
            <article key={booking.id} className="booking-row">
              <Avatar name={booking.worker?.name ?? '?'} className="booking-avatar" />

              <div className="booking-row-main">
                <h2>
                  {booking.worker ? (
                    <Link to={`/profile/${booking.worker.id}`}>{booking.worker.name}</Link>
                  ) : (
                    'Artisan removed'
                  )}
                </h2>
                <p className="booking-row-skill">
                  {booking.worker?.skill}
                  {booking.worker?.location && ` · ${booking.worker.location}`}
                </p>
                <p className="booking-row-job">{booking.job}</p>
                <p className="booking-row-when">
                  {formatDate(booking.date)} at {booking.time.slice(0, 5)}
                  {booking.budget && ` · budget ${booking.budget}`}
                </p>
              </div>

              <div className="booking-row-side">
                <span className={`status-pill status-${booking.status}`}>
                  {booking.status}
                </span>
                {(booking.status === 'pending' || booking.status === 'confirmed') && (
                  <button
                    className="link-button"
                    onClick={() => handleCancel(booking.id)}
                    disabled={cancelling === booking.id}
                  >
                    {cancelling === booking.id ? 'Cancelling…' : 'Cancel'}
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
