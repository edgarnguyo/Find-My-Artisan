import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { RATING_OPTIONS } from "../data/ratings";

// stats comes from GET /stats, or is null while it loads (shown as a dash).
export default function Hero({ stats }) {
  const [location, setLocation] = useState("");
  const [skill, setSkill] = useState("All");
  const [minRating, setMinRating] = useState("");
  const navigate = useNavigate();

  function handleSearch(e) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (location) params.set("location", location);
    if (skill && skill !== "All") params.set("skill", skill);
    if (minRating) params.set("minRating", minRating);
    navigate(`/listings?${params.toString()}`);
  }

  return (
    <section className="hero" id="home">
      <div className="hero-top">
        <div className="hero-media">
          <img
            src="https://picsum.photos/seed/artisan-hero/1600/900"
            alt=""
            className="hero-bg"
          />
          <div className="hero-overlay"></div>
        </div>

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
      </div>

      <form className="hero-search" onSubmit={handleSearch}>
        <div className="hero-search-field">
          <label htmlFor="hero-search-location">Location</label>
          <select
            id="hero-search-location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          >
            <option value="">Any location</option>
            <option>Nairobi</option>
            <option>Mombasa</option>
            <option>Kisumu</option>
            <option>Nakuru</option>
          </select>
        </div>
        <div className="hero-search-field">
          <label htmlFor="hero-search-skill">Skill</label>
          <select
            id="hero-search-skill"
            value={skill}
            onChange={(e) => setSkill(e.target.value)}
          >
            <option value="All">Any skill</option>
            <option>Electrician</option>
            <option>Plumber</option>
            <option>Carpenter</option>
            <option>Painter</option>
          </select>
        </div>
        <div className="hero-search-field">
          <label htmlFor="hero-search-rating">Rating</label>
          <select
            id="hero-search-rating"
            value={minRating}
            onChange={(e) => setMinRating(e.target.value)}
          >
            {RATING_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn-primary hero-search-btn">
          Search artisans
        </button>
      </form>

      <div className="hero-stats">
        <div className="stat">
          <span className="stat-number">{stats ? stats.verifiedArtisans : "—"}</span>
          <span className="stat-label">Verified artisans</span>
        </div>
        <div className="stat">
          <span className="stat-number">
            {stats?.averageRating != null ? `${stats.averageRating.toFixed(1)}★` : "—"}
          </span>
          <span className="stat-label">
            Average of {stats ? stats.reviewCount.toLocaleString() : "all"} reviews
          </span>
        </div>
        <div className="stat">
          <span className="stat-number">{stats ? stats.jobsCompleted.toLocaleString() : "—"}</span>
          <span className="stat-label">Jobs completed</span>
        </div>
      </div>
    </section>
  );
}
