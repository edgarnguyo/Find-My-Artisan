import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './lib/AuthProvider';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import RequireAuth from './components/RequireAuth';
import LandingPage from './pages/LandingPage';
import ListingsPage from './pages/ListingsPage';
import ProfilePage from './pages/ProfilePage';
import SignInPage from './pages/SignInPage';
import MyBookingsPage from './pages/MyBookingsPage';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Navbar />
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/listings" element={<ListingsPage />} />
          <Route path="/profile/:id" element={<ProfilePage />} />
          <Route path="/signin" element={<SignInPage />} />
          <Route
            path="/bookings"
            element={
              <RequireAuth>
                <MyBookingsPage />
              </RequireAuth>
            }
          />
        </Routes>
        <Footer />
      </AuthProvider>
    </BrowserRouter>
  );
}
