import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/authContext";

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  const isActive = (path) => location.pathname === path;

  async function handleSignOut() {
    await signOut();
    setMenuOpen(false);
    navigate("/");
  }

  return (
    <nav className="navbar">
      <Link to="/" className="navbar-logo">
        Find My Artisan
      </Link>

      <button
        className="hamburger"
        aria-label="Toggle menu"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((prev) => !prev)}
      >
        <span></span>
        <span></span>
        <span></span>
      </button>

      <ul className={`nav-links${menuOpen ? " open" : ""}`}>
        <li>
          <Link
            to="/"
            className={`nav-link${isActive("/") ? " active" : ""}`}
            onClick={() => setMenuOpen(false)}
          >
            Home
          </Link>
        </li>
        <li>
          <Link
            to="/listings"
            className={`nav-link${isActive("/listings") ? " active" : ""}`}
            onClick={() => setMenuOpen(false)}
          >
            Find Artisans
          </Link>
        </li>
        {user?.role === "client" && (
          <li>
            <Link
              to="/my-bookings"
              className={`nav-link${isActive("/my-bookings") ? " active" : ""}`}
              onClick={() => setMenuOpen(false)}
            >
              My bookings
            </Link>
          </li>
        )}
        {user?.role === "artisan" && (
          <li>
            <Link
              to="/dashboard"
              className={`nav-link${isActive("/dashboard") ? " active" : ""}`}
              onClick={() => setMenuOpen(false)}
            >
              Dashboard
            </Link>
          </li>
        )}
        {user ? (
          <>
            <li>
              <Link
                to="/account"
                className={`nav-link nav-email${isActive("/account") ? " active" : ""}`}
                title={`${user.email}: account settings`}
                onClick={() => setMenuOpen(false)}
              >
                {/* The email on wide screens; "Account" in the phone menu. */}
                <span className="nav-email-text">{user.email}</span>
                <span className="nav-account-text">Account</span>
              </Link>
            </li>
            <li>
              <button type="button" className="nav-cta" onClick={handleSignOut}>
                Sign out
              </button>
            </li>
          </>
        ) : (
          <li>
            <Link
              to="/signin"
              className="nav-cta"
              onClick={() => setMenuOpen(false)}
            >
              Sign in
            </Link>
          </li>
        )}
      </ul>
    </nav>
  );
}
