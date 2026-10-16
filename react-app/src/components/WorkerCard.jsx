import { Link } from "react-router-dom";
import Avatar from "./Avatar";

function WorkerCard({ worker }) {
  return (
    <Link
      to={`/profile/${worker.id}`}
      className="worker-card"
      style={{
        textDecoration: "none",
        color: "inherit"
      }}
    >
      <Avatar name={worker.name} className="worker-image" />

      <h3>{worker.name}</h3>

      <span className="skill-badge">
        {worker.skill}
      </span>

      <div className="worker-meta">
        {/* rating is the average of the reviews: null until there is one. */}
        <p className="worker-rating">
          ⭐ {worker.rating != null ? `${worker.rating.toFixed(1)} (${worker.reviewCount})` : "New"}
        </p>
        {worker.jobSuccess != null && (
          <p className="worker-success">{worker.jobSuccess}% job success</p>
        )}
        <p className="worker-price">{worker.price}</p>
        <p className="worker-location">{worker.location}, {worker.county}</p>
        {worker.verified && (
          <p className="worker-verified">✓ Verified</p>
        )}
      </div>
    </Link>
  );
}

export default WorkerCard;