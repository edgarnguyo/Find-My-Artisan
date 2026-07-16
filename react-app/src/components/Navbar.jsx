import { useState } from "react";
import { Link, useLocation } from "react-router-dom";

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  const isActive = (path) => location.pathname === path;

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
        <li>
          <Link
            to="/listings"
            className="nav-cta"
            onClick={() => setMenuOpen(false)}
          >
            Get Started
          </Link>
        </li>
      </ul>
    </nav>
  );
}
