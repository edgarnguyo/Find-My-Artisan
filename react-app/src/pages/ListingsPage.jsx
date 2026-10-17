import { useState } from "react";
import { useSearchParams } from "react-router-dom";

import WorkerCard from "../components/WorkerCard";
import SearchBar from "../components/SearchBar";
import FilterButtons from "../components/FilterButtons";

import { fetchWorkers } from "../api/workers";
import { useAsync } from "../hooks/useAsync";
import { RATING_OPTIONS } from "../data/ratings";

const SKILLS = ["All", "Plumber", "Electrician", "Carpenter", "Painter"];

// Each sort puts artisans without that value (no reviews, no hourly rate) last.
const SORTS = {
  recommended: { label: "Recommended", compare: () => 0 },
  rating: {
    label: "Highest rated",
    compare: (a, b) =>
      (b.rating ?? -1) - (a.rating ?? -1) || b.reviewCount - a.reviewCount,
  },
  price: {
    label: "Lowest hourly rate",
    compare: (a, b) =>
      (a.hourlyRateKes ?? Infinity) - (b.hourlyRateKes ?? Infinity),
  },
};

function ListingsPage() {
  const [searchParams] = useSearchParams();
  const initialLocation = searchParams.get("location") || "";
  const initialSkill = searchParams.get("skill");
  const initialRating = searchParams.get("minRating") ?? "";

  const [searchTerm, setSearchTerm] = useState(initialLocation);
  const [activeFilter, setActiveFilter] = useState(
    SKILLS.includes(initialSkill) ? initialSkill : "All"
  );
  const [minRating, setMinRating] = useState(
    RATING_OPTIONS.some((o) => o.value === initialRating) ? initialRating : ""
  );
  const [sort, setSort] = useState("recommended");

  const { data: workers, error, loading } = useAsync(fetchWorkers);

  const filteredWorkers = (workers ?? []).filter((worker) => {
    const matchesSearch =
      worker.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      worker.skill.toLowerCase().includes(searchTerm.toLowerCase()) ||
      worker.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
      worker.county.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesSkill =
      activeFilter === "All" ||
      worker.skill === activeFilter;

    // Artisans with no reviews have no rating, so a minimum leaves them out.
    const matchesRating =
      minRating === "" ||
      (worker.rating !== null && worker.rating >= Number(minRating));

    return matchesSearch && matchesSkill && matchesRating;
  });
  // sort() changes the array it's given; filter() above already made a copy.
  filteredWorkers.sort(SORTS[sort].compare);

  return (
    <main className="listings-page">
      <h1>Find Skilled Artisans</h1>

      <SearchBar
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
      />

      <FilterButtons
        activeFilter={activeFilter}
        setActiveFilter={setActiveFilter}
      />

      <div className="listings-controls">
        <label>
          Rating
          <select value={minRating} onChange={(e) => setMinRating(e.target.value)}>
            {RATING_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>
        <label>
          Sort by
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            {Object.entries(SORTS).map(([key, s]) => (
              <option key={key} value={key}>{s.label}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="worker-grid">
        {loading ? (
          [...Array(6)].map((_, index) => (
            <div
              key={index}
              className="skeleton-card"
            ></div>
          ))
        ) : error ? (
          <p>Could not load artisans: {error.message}</p>
        ) : filteredWorkers.length > 0 ? (
          filteredWorkers.map((worker) => (
            <WorkerCard
              key={worker.id}
              worker={worker}
            />
          ))
        ) : (
          <p>No artisans found.</p>
        )}
      </div>
    </main>
  );
}

export default ListingsPage;
