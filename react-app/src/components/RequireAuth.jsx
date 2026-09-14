import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/authContext';

/**
 * Gate for pages that need an account. This is a convenience, not security —
 * the real protection is the API: GET /api/bookings/mine only returns rows whose
 * user_id matches the signed-in token. Removing this component would show an
 * empty list, not somebody else's data.
 */
export default function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  // Wait until the saved token has been checked, or a refresh would bounce a
  // signed-in user to the sign-in page for a moment.
  if (loading) {
    return <main className="bookings-page"><p>Loading…</p></main>;
  }

  if (!user) {
    return <Navigate to="/signin" replace state={{ from: location.pathname }} />;
  }

  return children;
}
