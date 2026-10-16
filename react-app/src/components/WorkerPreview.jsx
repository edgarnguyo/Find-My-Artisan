import { Link } from "react-router-dom";
import Avatar from "./Avatar";

// The three best-rated artisans: highest average review first, and more
// reviews first when two averages are the same. workers is null while loading.
function topRated(workers) {
  return workers
    .filter((worker) => worker.rating !== null)
    .sort((a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount)
    .slice(0, 3);
}

export default function WorkerPreview({ workers }) {
  return (
    <section className="worker-preview-section" id="artisans">
      <div className="section-header">
        <span className="section-eyebrow">Top rated</span>
        <h2 className="section-title">Artisans clients rate highest</h2>
      </div>

      {!workers ? (
        <div className="preview-grid">
          {[1, 2, 3].map((n) => (
            <div key={n} className="preview-skeleton" />
          ))}
        </div>
      ) : (
        <div className="preview-grid">
          {topRated(workers).map((worker) => (
            <Link key={worker.id} to={`/profile/${worker.id}`} className="preview-card">
              <Avatar name={worker.name} className="preview-photo" />
              <div className="preview-info">
                <h3 className="preview-name">{worker.name}</h3>
                <span className="skill-badge">{worker.skill}</span>
                <p className="preview-location">📍 {worker.location}, {worker.county}</p>
                <p className="preview-rating">
                  ⭐ {worker.rating.toFixed(1)} · {worker.reviewCount} review
                  {worker.reviewCount === 1 ? "" : "s"}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}

      <div className="preview-cta">
        <Link to="/listings" className="btn-primary">
          View all artisans
        </Link>
      </div>
    </section>
  );
}
