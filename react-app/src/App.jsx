import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ProfilePage from './pages/ProfilePage';

// BrowserRouter provides the routing context for the whole app.
// Routes looks at the current URL and renders the first matching Route.
// Route path="/profile/:id" matches any URL like /profile/1, /profile/2, etc.
//   The :id part is a dynamic segment — React Router captures whatever is
//   there and makes it available via useParams() inside ProfilePage.
// The Navigate at "/" redirects the root URL to /profile/1 so the app
//   has a sensible default when opened without a specific worker id.

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/profile/:id" element={<ProfilePage />} />
        <Route path="/" element={<Navigate to="/profile/1" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
