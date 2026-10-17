import { Link } from "react-router-dom";

const CITIES = [
  { name: "Nairobi", seed: "nairobi-city" },
  { name: "Mombasa", seed: "mombasa-city" },
  { name: "Kisumu", seed: "kisumu-city" },
  { name: "Nakuru", seed: "nakuru-city" },
];

// workers is the landing page's list of artisans, or null while it loads.
export default function LocationsGrid({ workers }) {
  const locations = CITIES.map((city) => ({
    ...city,
    count: (workers ?? []).filter((worker) =>
      worker.county === city.name
    ).length,
  }));

  return (
    <section className="locations" id="locations">
      <div className="section-header">
        <span className="section-eyebrow">Where We Work</span>
        <h2 className="section-title">Popular Locations</h2>
        <p className="section-sub">
          Artisans ready to help across Kenya's biggest cities.
        </p>
      </div>

      <div className="locations-grid">
        {locations.map((location) => (
          <Link
            key={location.name}
            to={`/listings?location=${location.name}`}
            className="location-card"
          >
            <img
              src={`https://picsum.photos/seed/${location.seed}/500/500`}
              alt={location.name}
            />
            <span className="location-info">
              <span className="location-name">{location.name}</span>
              <span className="location-count">{location.count} artisans</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
