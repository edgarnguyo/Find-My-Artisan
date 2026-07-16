import { Link } from "react-router-dom";
import { WORKERS } from "../data/mockData";

const CITIES = [
  { name: "Nairobi", seed: "nairobi-city" },
  { name: "Mombasa", seed: "mombasa-city" },
  { name: "Kisumu", seed: "kisumu-city" },
  { name: "Nakuru", seed: "nakuru-city" },
];

const LOCATIONS = CITIES.map((city) => ({
  ...city,
  count: WORKERS.filter((worker) => worker.location.includes(city.name)).length,
}));

export default function LocationsGrid() {
  return (
    <section className="locations" id="locations">
      <div className="section-header">
        <span className="section-eyebrow">Where we work</span>
        <h2 className="section-title">Popular locations</h2>
        <p className="section-sub">
          Artisans ready to help across Kenya's biggest cities.
        </p>
      </div>

      <div className="locations-grid">
        {LOCATIONS.map((location) => (
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
