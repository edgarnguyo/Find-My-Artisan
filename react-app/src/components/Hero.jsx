// src/components/Hero.jsx
// Person A owns this component.
//
// The Hero is the first thing users see — it needs to immediately explain
// what the product does and give them a clear next action (CTA button).
// The CTA links to /listings via React Router's <Link>, keeping navigation
// inside the SPA instead of doing a full page reload.

import { Link } from "react-router-dom";

export default function Hero() {
  return (
    <section className="hero" id="home">
      <div className="hero-content">
        <span className="hero-eyebrow">Trusted artisans, near you</span>
        <h1 className="hero-heading">
          Find skilled hands for every job at home
        </h1>
        <p className="hero-sub">
          Connect with verified plumbers, electricians, carpenters, and painters
          in your neighbourhood. Browse profiles, read reviews, and book in
          minutes.
        </p>
        <div className="hero-actions">
          <Link to="/listings" className="btn-primary">
            Browse Artisans
          </Link>
          <a href="#how-it-works" className="btn-secondary">
            See how it works
          </a>
        </div>
      </div>

      <div className="hero-stats">
        <div className="stat">
          <span className="stat-number">200+</span>
          <span className="stat-label">Verified artisans</span>
        </div>
        <div className="stat">
          <span className="stat-number">4.8★</span>
          <span className="stat-label">Average rating</span>
        </div>
        <div className="stat">
          <span className="stat-number">1,000+</span>
          <span className="stat-label">Jobs completed</span>
        </div>
      </div>
    </section>
  );
}
