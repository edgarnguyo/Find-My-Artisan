import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { fetchArtisanBookings, setBookingStatus } from '../api/workers';
import { useAsync } from '../hooks/useAsync';
import { useAuth } from '../lib/authContext';
import Avatar from '../components/Avatar';
import BookingMaterials from '../components/BookingMaterials';
import BusyTimes from '../components/BusyTimes';
import ScrapDropOffForm from '../components/ScrapDropOffForm';
import { kenyaClock } from '../lib/kenyaTime';
import { formatKes, capitalize } from '../lib/format';

// A booking moves pending -> confirmed -> completed, or pending -> declined.
// A client can cancel it while it's pending or confirmed.
const TABS = [
  { key: 'requests',  label: 'Requests',  match: s => s === 'pending' },
  { key: 'upcoming',  label: 'Upcoming',  match: s => s === 'confirmed' },
  { key: 'completed', label: 'Completed', match: s => s === 'completed' },
  { key: 'closed',    label: 'Declined & Cancelled', match: s => s === 'declined' || s === 'cancelled' },
];

// The buttons each status gets. confirm is the question asked first, for the
// changes that can't be undone. askEndTime: accepting first asks when the job
// will be over, so that time can be kept free for it.
const ACTIONS = {
  pending: [
    { status: 'confirmed', label: 'Accept', busyLabel: 'Accepting…', askEndTime: true },
    { status: 'declined', label: 'Decline', busyLabel: 'Declining…',
      confirm: 'Decline this request? The client will see it as declined.' },
  ],
  confirmed: [
    { status: 'completed', label: 'Mark Complete', busyLabel: 'Saving…',
      confirm: 'Mark this job as completed?' },
  ],
};

// value is a plain date ('2026-10-22'), which JavaScript reads as midnight UTC.
// Formatting it in UTC too keeps it the same day on any computer.
function formatDate(value) {
  return new Date(value).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  });
}

// A first guess at when the job ends: two hours after it starts, but the same day.
function guessEndTime(time) {
  const hour = Math.min(Number(time.slice(0, 2)) + 2, 23);
  return `${String(hour).padStart(2, '0')}${hour === 23 ? ':59' : time.slice(2, 5)}`;
}

// The booking form takes an email or a phone number in one field.
function contactHref(contact) {
  return contact.includes('@') ? `mailto:${contact}` : `tel:${contact.replace(/[^\d+]/g, '')}`;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState('requests');
  const [reloadKey, setReloadKey] = useState(0);
  // The booking and button being saved right now: { id, status } or null.
  const [saving, setSaving] = useState(null);
  // The request being accepted, while the artisan picks its end time:
  // { id, endTime } or null.
  const [accepting, setAccepting] = useState(null);

  // Client and artisan ids come from different tables and can be the same
  // number, so only ask for an artisan's bookings when this really is one.
  const isArtisan = user.role === 'artisan';
  const load = useCallback(
    () => (isArtisan ? fetchArtisanBookings() : Promise.resolve([])),
    [isArtisan]
  );
  const { data: bookings, error, loading } = useAsync(load, [reloadKey, user.id]);

  async function handleAction(booking, action, endTime) {
    if (action.askEndTime && endTime === undefined) {
      setAccepting({ id: booking.id, endTime: guessEndTime(booking.time) });
      return;
    }
    if (action.confirm && !window.confirm(action.confirm)) return;
    setSaving({ id: booking.id, status: action.status });
    try {
      await setBookingStatus(booking.id, action.status, endTime);
      setAccepting(null);
      setReloadKey(k => k + 1);
    } catch (err) {
      // Most likely the client cancelled in the meantime: reload to show that.
      alert(`Could not update the booking: ${err.message}`);
      setReloadKey(k => k + 1);
    } finally {
      setSaving(null);
    }
  }

  if (!isArtisan) {
    return (
      <main className="bookings-page">
        <header className="bookings-header">
          <h1>Artisan Dashboard</h1>
          <p className="bookings-sub">
            This page is for artisans. You are signed in as a client ({user.email}).{' '}
            <Link to="/my-bookings">See Your Bookings</Link>
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
        <h1>Your Jobs</h1>
        <p className="bookings-sub">
          Signed in as {user.email} · <Link to="/dashboard/profile">Edit Your Profile &amp; Portfolio</Link>
          {' · '}<Link to={`/profile/${user.id}`}>View Your Public Profile</Link>
        </p>
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
        <p className="error">Could not load your jobs: {error.message}</p>
      ) : visible.length === 0 ? (
        <div className="bookings-empty">
          <p>
            {tab === 'requests'
              ? 'No new requests. Clients book you from your profile page.'
              : `No ${active.label.toLowerCase()} jobs yet.`}
          </p>
        </div>
      ) : (
        <div className="bookings-list">
          {visible.map(booking => (
            <article key={booking.id} className="booking-row">
              <Avatar name={booking.clientName} className="booking-avatar" />

              <div className="booking-row-main">
                <h2>{booking.clientName}</h2>
                <p className="booking-row-skill">
                  <a href={contactHref(booking.contact)}>{booking.contact}</a>
                </p>
                <p className="booking-row-job">{capitalize(booking.job)}</p>
                <p className="booking-row-when">
                  {formatDate(booking.date)} at {booking.time.slice(0, 5)}
                  {booking.endsAt && `–${kenyaClock(booking.endsAt)}`}
                </p>
                {booking.budget && (
                  <p className="booking-row-budget">Budget: {formatKes(booking.budget)}</p>
                )}
                <BookingMaterials materials={booking.materials} />

                {booking.status === 'completed' && (
                  <ScrapDropOffForm
                    bookingId={booking.id}
                    reports={booking.scrapDropOffs}
                    onReported={() => setReloadKey(k => k + 1)}
                  />
                )}

                {accepting?.id === booking.id && (
                  <form
                    className="accept-form"
                    onSubmit={e => {
                      e.preventDefault();
                      handleAction(booking, ACTIONS.pending[0], accepting.endTime);
                    }}
                  >
                    <label htmlFor={`end-${booking.id}`}>Job Will Be Over by</label>
                    <input
                      id={`end-${booking.id}`}
                      type="time"
                      value={accepting.endTime}
                      onChange={e => setAccepting({ id: booking.id, endTime: e.target.value })}
                      required
                    />
                    <button type="submit" className="booking-action" disabled={saving?.id === booking.id}>
                      {saving?.id === booking.id ? 'Accepting…' : 'Confirm'}
                    </button>
                    <button type="button" className="link-button" onClick={() => setAccepting(null)}>
                      Back
                    </button>
                  </form>
                )}
              </div>

              <div className="booking-row-side">
                <span className={`status-pill status-${booking.status}`}>
                  {capitalize(booking.status)}
                </span>
                {accepting?.id !== booking.id && (ACTIONS[booking.status] ?? []).map(action => (
                  <button
                    key={action.status}
                    className={action.status === 'declined' ? 'link-button' : 'booking-action'}
                    onClick={() => handleAction(booking, action)}
                    disabled={saving?.id === booking.id}
                  >
                    {saving?.id === booking.id && saving.status === action.status
                      ? action.busyLabel
                      : action.label}
                  </button>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}

      <BusyTimes artisanId={user.id} reloadKey={reloadKey} />
    </main>
  );
}
