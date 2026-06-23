import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import ListingsPage from './pages/ListingsPage';
import ProfilePage from './pages/ProfilePage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/listings" element={<ListingsPage />} />
        <Route path="/profile/:id" element={<ProfilePage />} />
      </Routes>
    </BrowserRouter>
  );
}

// BrowserRouter provides the routing context for the whole app.
// Routes looks at the current URL and renders the first matching Route.
// Route path="/profile/:id" matches any URL like /profile/1, /profile/2, etc.
//   The :id part is a dynamic segment — React Router captures whatever is
//   there and makes it available via useParams() inside ProfilePage.
// The Navigate at "/" redirects the root URL to /profile/1 so the app
//   has a sensible default when opened without a specific worker id.