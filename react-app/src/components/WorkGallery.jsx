import { Link } from "react-router-dom";

// The newest photos artisans have added to their portfolios. Hidden until
// there is at least one, rather than filling the space with stock photos.
export default function WorkGallery({ items }) {
  if (!items || items.length === 0) return null;

  return (
    <section className="gallery-section" id="gallery">
      <div className="section-header">
        <span className="section-eyebrow">Recent work</span>
        <h2 className="section-title">A look at finished jobs</h2>
        <p className="section-sub">From the portfolios of artisans on the platform.</p>
      </div>

      <div className="gallery-grid">
        {items.map((item) => (
          <Link key={item.id} to={`/profile/${item.artisanId}`} className="gallery-tile">
            <img src={item.imageUrl} alt={item.title} loading="lazy" />
            <span className="gallery-caption">
              {item.title} · {item.artisanName}, {item.skill}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
