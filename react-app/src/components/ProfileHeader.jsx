import Avatar from "./Avatar";
import { formatKes } from "../lib/format";

export default function ProfileHeader({ worker }) {
  return (
    <header className="profile-header">
      <Avatar name={worker.name} className="profile-photo" />
      <div className="profile-info">
        <h1 className="profile-name">
          {worker.name}
          {worker.verified && (
            <span className="badge">✓ Verified</span>
          )}
        </h1>
        <p className="profile-skill">{worker.skill}</p>
        <p className="profile-location">
          <span className="profile-meta-label">Location:</span> {worker.location}, {worker.county}
        </p>

        <div className="profile-header-meta">
          {/* rating is the average of the reviews: null until there is one. */}
          <span className="profile-rating">
            {worker.rating != null
              ? `Rating: ${worker.rating.toFixed(1)} · ${worker.reviewCount} review${worker.reviewCount === 1 ? "" : "s"}`
              : "New Artisan"}
          </span>
          {worker.jobSuccess != null && (
            <span className="profile-success">{worker.jobSuccess}% job success</span>
          )}
          {worker.price && <span className="profile-price">{formatKes(worker.price)}</span>}
        </div>
      </div>

      <a href="#booking" className="btn-primary profile-header-cta">
        Request This Artisan
      </a>
    </header>
  );
}
