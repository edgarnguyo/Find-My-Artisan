import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAsync } from '../hooks/useAsync';
import { useAuth } from '../lib/authContext';
import { fetchMyWorker, fetchBookingsForMyWorker } from '../api/artisan';
import WorkerProfileForm from '../components/WorkerProfileForm';
import AvailabilityEditor from '../components/AvailabilityEditor';
import PortfolioManager from '../components/PortfolioManager';
import ArtisanBookings from '../components/ArtisanBookings';

/**
 * Everything an artisan can do with their own listing.
 *
 * The account exists before the listing does, so this page has two shapes: a
 * single create form until a worker row exists, and the full dashboard after.
 */
export default function ArtisanDashboardPage() {
  const { user, profile } = useAuth();
  const [reloadKey, setReloadKey] = useState(0);

  const loadWorker = useCallback(() => fetchMyWorker(), []);
  const { data: worker, error, loading } = useAsync(loadWorker, [reloadKey, user?.id]);

  const loadBookings = useCallback(
    () => (worker ? fetchBookingsForMyWorker(worker.id) : Promise.resolve([])),
    [worker]
  );
  const { data: bookings, error: bookingsError } = useAsync(loadBookings, [worker?.id, reloadKey]);

  const reload = () => setReloadKey(k => k + 1);

  if (profile && profile.role !== 'artisan') {
    return (
      <main className="dash-page">
        <h1>Artisan dashboard</h1>
        <p>
          This account is registered as a client. Create an artisan account to
          list your trade, or <Link to="/listings">find an artisan</Link>.
        </p>
      </main>
    );
  }

  if (loading) {
    return <main className="dash-page"><p>Loading your dashboard…</p></main>;
  }

  if (error) {
    return (
      <main className="dash-page">
        <h1>Something went wrong</h1>
        <p className="error">Could not load your listing: {error.message}</p>
      </main>
    );
  }

  return (
    <main className="dash-page">
      <header className="dash-header">
        <h1>Artisan dashboard</h1>
        {worker && (
          <p className="dash-sub">
            <Link to={`/profile/${worker.id}`}>View your public profile</Link>
            {' · '}
            {worker.jobsCompleted} job{worker.jobsCompleted === 1 ? '' : 's'} completed
            {worker.rating !== null && ` · ${worker.rating}★`}
            {worker.jobSuccess !== null && ` · ${worker.jobSuccess}% success`}
          </p>
        )}
      </header>

      {!worker ? (
        <WorkerProfileForm onSaved={reload} />
      ) : (
        <div className="dash-grid">
          <div className="dash-column">
            {bookingsError ? (
              <p className="error">Could not load bookings: {bookingsError.message}</p>
            ) : (
              <ArtisanBookings bookings={bookings ?? []} onChanged={reload} />
            )}
            <PortfolioManager worker={worker} onChanged={reload} />
          </div>

          <div className="dash-column">
            <WorkerProfileForm key={worker.id} worker={worker} onSaved={reload} />
            <AvailabilityEditor key={`avail-${reloadKey}`} worker={worker} onSaved={reload} />
          </div>
        </div>
      )}
    </main>
  );
}
