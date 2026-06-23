// src/components/WorkerPreview.jsx
// Person A owns this component.
//
// useEffect + API Fetch (Week 2 requirement):
//   useEffect runs AFTER the component first renders.
//   Inside it, we fetch from randomuser.me and map the response into
//   a shape that matches our WORKERS schema (name, photo, skill, location).
//   The cleanup function (the return inside useEffect) cancels the fetch
//   if the component unmounts before the response arrives — avoids a
//   "can't set state on unmounted component" warning.

import { useState, useEffect } from "react";
import { Link } from "react-router-dom";

const SKILLS = ["Electrician", "Plumber", "Carpenter", "Painter"];

export default function WorkerPreview() {
  const [previewWorkers, setPreviewWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const controller = new AbortController();

    async function fetchWorkers() {
      try {
        const res = await fetch(
          "https://randomuser.me/api/?results=3&seed=artisan",
          { signal: controller.signal }
        );
        if (!res.ok) throw new Error("Network response was not ok");
        const data = await res.json();

        // Map randomuser shape → our worker shape
        const mapped = data.results.map((user, i) => ({
          id: `preview-${i}`,
          name: `${user.name.first} ${user.name.last}`,
          photo: user.picture.large,
          skill: SKILLS[i % SKILLS.length],
          location: `${user.location.city}, ${user.location.country}`,
          rating: (4.3 + i * 0.2).toFixed(1),
        }));

        setPreviewWorkers(mapped);
      } catch (err) {
        if (err.name !== "AbortError") {
          setError("Could not load preview — showing sample artisans.");
        }
      } finally {
        setLoading(false);
      }
    }

    fetchWorkers();

    // Cleanup: abort the fetch if this component unmounts first
    return () => controller.abort();
  }, []); // Empty dependency array → runs only on mount

  return (
    <section className="worker-preview-section" id="artisans">
      <div className="section-header">
        <span className="section-eyebrow">Featured artisans</span>
        <h2 className="section-title">Meet some of our community</h2>
      </div>

      {loading && (
        <div className="preview-grid">
          {[1, 2, 3].map((n) => (
            <div key={n} className="preview-skeleton" />
          ))}
        </div>
      )}

      {error && <p className="preview-error">{error}</p>}

      {!loading && !error && (
        <div className="preview-grid">
          {previewWorkers.map((worker) => (
            <div key={worker.id} className="preview-card">
              <img
                src={worker.photo}
                alt={worker.name}
                className="preview-photo"
              />
              <div className="preview-info">
                <h3 className="preview-name">{worker.name}</h3>
                <span className="skill-badge">{worker.skill}</span>
                <p className="preview-location">📍 {worker.location}</p>
                <p className="preview-rating">⭐ {worker.rating}</p>
              </div>
            </div>
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
