import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { fetchMyBookings, cancelBooking, answerQuote } from '../api/workers';
import { useAsync } from '../hooks/useAsync';
import { useAuth } from '../lib/authContext';
import Avatar from '../components/Avatar';
import BookingQuote from '../components/BookingQuote';
import ReviewForm from '../components/ReviewForm';
import { kenyaClock } from '../lib/kenyaTime';
import { formatKes, capitalize } from '../lib/format';

const TABS = [
  { key: 'active',    label: 'Upcoming',  match: s => s === 'pending' || s === 'confirmed' },
  { key: 'completed', label: 'Completed', match: s => s === 'completed' },
  { key: 'cancelled', label: 'Cancelled & Declined', match: s => s === 'cancelled' || s === 'declined' },
];

// value is a plain date ('2026-10-22'), which JavaScript reads as midnight UTC.
// Formatting it in UTC too keeps it the same day on any computer.
function formatDate(value) {
  return new Date(value).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  });
}

export default function MyBookingsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState('active');
  const [reloadKey, setReloadKey] = useState(0);
  const [cancelling, setCancelling] = useState(null);
  // The completed booking whose review form is open, or null.
  const [reviewing, setReviewing] = useState(null);
  // The quote being answered right now: { id, decision } or null.
  const [answering, setAnswering] = useState(null);

  // Bookings belong to clients. An artisan's id could match some client's id,
  // so only ask for bookings when the signed-in user really is a client.
  const isClient = user.role === 'client';
  const load = useCallback(
    () => (isClient ? fetchMyBookings(user.id) : Promise.resolve([])),
    [isClient, user.id]
  );
  const { data: bookings, error, loading } = useAsync(load, [reloadKey, user.id]);

  async function handleCancel(id) {
    setCancelling(id);
    try {
      await cancelBooking(id, user.id);
      setReloadKey(k => k + 1);
    } catch (err) {
      alert(`Could not cancel: ${err.message}`);
    } finally {
      setCancelling(null);
    }
  }

  async function handleAnswer(booking, decision) {
    if (decision === 'declined' && !window.confirm('Decline this quote? The artisan can send you a new one.')) return;
    setAnswering({ id: booking.id, decision });
    try {
      await answerQuote(booking.id, user.id, decision, booking.quote.version);
    } catch (err) {
      // Most likely the artisan sent a new quote meanwhile: reload to show it.
      alert(`Could not save your answer: ${err.message}`);
    } finally {
      setAnswering(null);
      setReloadKey(k => k + 1);
    }
  }

  if (!isClient) {
    return (
      <main className="bookings-page">
        <header className="bookings-header">
          <h1>My Bookings</h1>
          <p className="bookings-sub">
            Bookings are made by clients. You are signed in as an artisan ({user.email}).{' '}
            <Link to="/dashboard">See the Jobs Booked with You</Link>
          </p>
        </header>
      </main>
    );
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
        <h1>My Bookings</h1>
        <p className="bookings-sub">Signed in as {user.email}</p>
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
          <Link to="/listings" className="btn-primary">Find an Artisan</Link>
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
                <p className="booking-row-job">{capitalize(booking.job)}</p>
                <p className="booking-row-when">
                  {formatDate(booking.date)} at {booking.time.slice(0, 5)}
                  {booking.endsAt && `–${kenyaClock(booking.endsAt)}`}
                </p>
                {booking.budget && (
                  <p className="booking-row-budget">Budget: {formatKes(booking.budget)}</p>
                )}
                {booking.quote ? (
                  <BookingQuote quote={booking.quote} viewer="client">
                    {booking.quote.status === 'sent' &&
                      (booking.status === 'pending' || booking.status === 'confirmed') && (
                      <div className="quote-actions">
                        <button
                          className="booking-action"
                          onClick={() => handleAnswer(booking, 'accepted')}
                          disabled={answering?.id === booking.id}
                        >
                          {answering?.id === booking.id && answering.decision === 'accepted' ? 'Accepting…' : 'Accept Quote'}
                        </button>
                        <button
                          className="link-button"
                          onClick={() => handleAnswer(booking, 'declined')}
                          disabled={answering?.id === booking.id}
                        >
                          {answering?.id === booking.id && answering.decision === 'declined' ? 'Declining…' : 'Decline'}
                        </button>
                      </div>
                    )}
                  </BookingQuote>
                ) : (booking.status === 'pending' || booking.status === 'confirmed') && (
                  <p className="booking-quote-waiting">The artisan will send a quote once they've looked at the job.</p>
                )}

                {booking.review && (
                  <p className="booking-review">
                    You rated this{' '}
                    <span className="review-stars" aria-label={`${booking.review.rating} out of 5 stars`}>
                      {'★'.repeat(booking.review.rating) + '☆'.repeat(5 - booking.review.rating)}
                    </span>
                    {booking.review.comment && ` · “${booking.review.comment}”`}
                  </p>
                )}

                {reviewing === booking.id && (
                  <ReviewForm
                    booking={booking}
                    clientId={user.id}
                    onCancel={() => setReviewing(null)}
                    onDone={() => {
                      setReviewing(null);
                      setReloadKey(k => k + 1);
                    }}
                  />
                )}
              </div>

              <div className="booking-row-side">
                <span className={`status-pill status-${booking.status}`}>
                  {capitalize(booking.status)}
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
                {booking.status === 'completed' && !booking.review && reviewing !== booking.id && (
                  <button className="booking-action" onClick={() => setReviewing(booking.id)}>
                    Leave a Review
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
