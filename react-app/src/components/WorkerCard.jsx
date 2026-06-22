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

      <p>⭐ {worker.rating}</p>

      <p>{worker.price}</p>

      <p>{worker.location}</p>

      {worker.verified && (
        <p>✓ Verified</p>
      )}
    </Link>
  );
}

export default WorkerCard;