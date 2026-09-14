import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/authContext';

/**
 * Sends signed-out visitors to the sign-in page before showing a page that
 * needs an account, and remembers where they were going.
 */
export default function RequireAuth({ children }) {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/signin" replace state={{ from: location.pathname }} />;
  }

  return children;
}
