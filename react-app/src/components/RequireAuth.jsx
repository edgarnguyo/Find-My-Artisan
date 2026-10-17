import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/authContext';

/**
 * Sends signed-out visitors to the sign-in page before showing a page that
 * needs an account, and remembers where they were going. Someone who has just
 * signed out (or deleted their account) on such a page goes home instead.
 */
export default function RequireAuth({ children }) {
  const { user, signedOut } = useAuth();
  const location = useLocation();

  if (!user) {
    if (signedOut) return <Navigate to="/" replace />;
    return <Navigate to="/signin" replace state={{ from: location.pathname }} />;
  }

  return children;
}
