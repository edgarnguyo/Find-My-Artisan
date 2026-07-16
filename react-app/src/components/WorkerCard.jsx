import { Link } from "react-router-dom";

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
      <img
        src={worker.photo}
        alt={worker.name}
        className="worker-image"
      />

      <h3>{worker.name}</h3>

      <span className="skill-badge">
        {worker.skill}
      </span>

      <div className="worker-meta">
        <p className="worker-rating">⭐ {worker.rating}</p>
        <p className="worker-success">{worker.jobSuccess}% job success</p>
        <p className="worker-price">{worker.price}</p>
        <p className="worker-location">{worker.location}</p>
        {worker.verified && (
          <p className="worker-verified">✓ Verified</p>
        )}
      </div>
    </Link>
  );
}

export default WorkerCard;