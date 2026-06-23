// src/components/Navbar.jsx
// Person A owns this component.
//
// Props:
//   activePage — string like "home" | "listings" that highlights the right link.
//
// Key concepts used here:
//   useState — tracks whether the hamburger menu is open on mobile.
//   classList.toggle equivalent — we conditionally apply the "open" class via
//     a ternary so React controls the DOM instead of us touching it directly.

import { useState } from "react";
import { Link, useLocation } from "react-router-dom";

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  // useLocation() tells us the current URL path so we can highlight
  // the active nav link without receiving an activePage prop.
  const location = useLocation();

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="navbar">
      <Link to="/" className="navbar-logo">
        Find My Artisan
      </Link>

      {/* Hamburger button — only visible on mobile via CSS */}
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

      {/* Nav links — the "open" class is toggled by menuOpen state */}
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
