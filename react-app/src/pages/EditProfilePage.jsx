import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { fetchWorkerById } from '../api/workers';
import { useAsync } from '../hooks/useAsync';
import { useAuth } from '../lib/authContext';
import ProfileEditForm from '../components/ProfileEditForm';
import PortfolioManager from '../components/PortfolioManager';

// An artisan's own profile details and portfolio, reached from the dashboard.
export default function EditProfilePage() {
  const { user } = useAuth();
  const isArtisan = user.role === 'artisan';
  const load = useCallback(
    () => (isArtisan ? fetchWorkerById(user.id) : Promise.resolve(null)),
    [isArtisan, user.id]
  );
  const { data: worker, error, loading } = useAsync(load, [user.id]);

  return (
    <main className="bookings-page">
      <header className="bookings-header">
        <h1>Your Profile</h1>
        <p className="bookings-sub">
          <Link to="/dashboard">Back to Your Jobs</Link>
          {isArtisan && (
            <>
              {' · '}
              <Link to={`/profile/${user.id}`}>See It as Clients Do</Link>
            </>
          )}
        </p>
      </header>

      {!isArtisan ? (
        <p className="bookings-sub">This page is for artisans. You are signed in as a client.</p>
      ) : loading ? (
        <div className="skeleton-card" />
      ) : error ? (
        <p className="error">Could not load your profile: {error.message}</p>
      ) : !worker ? (
        <p className="error">Your artisan profile could not be found.</p>
      ) : (
        <>
          <ProfileEditForm worker={worker} />
          <PortfolioManager artisanId={worker.id} initialItems={worker.portfolio} />
        </>
      )}
    </main>
  );
}
