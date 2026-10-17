import { Link } from "react-router-dom";
import { useAuth } from "../lib/authContext";

function formatDate(value) {
  // A plain date ('2026-03-14') is read as midnight UTC, so format it in UTC too.
  return new Date(value).toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
}

// The artisan's portfolio: past jobs they added from their dashboard.
export default function ProfileGallery({ worker }) {
  const { user } = useAuth();
  const isOwnProfile = user?.role === "artisan" && user.id === worker.id;
  const items = worker.portfolio;

  return (
    <section className="profile-gallery-card">
      <h2>Recent Work</h2>

      {items.length === 0 ? (
        <p className="gallery-empty">
          {isOwnProfile ? (
            <>
              No photos of your work yet.{" "}
              <Link to="/dashboard/profile">Add Some to Your Portfolio</Link>
            </>
          ) : (
            `${worker.name} hasn't added photos of their work yet.`
          )}
        </p>
      ) : (
        <div className="profile-gallery-grid">
          {items.map((item) => (
            <figure key={item.id} className="profile-gallery-item">
              <div className="profile-gallery-tile">
                <img src={item.imageUrl} alt={item.title} loading="lazy" />
              </div>
              <figcaption>
                <strong>{item.title}</strong>
                {item.workDate && <span className="gallery-date"> · {formatDate(item.workDate)}</span>}
                {item.description && <p>{item.description}</p>}
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </section>
  );
}
