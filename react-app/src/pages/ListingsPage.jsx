import { useState } from "react";
import { useSearchParams } from "react-router-dom";

import WorkerCard from "../components/WorkerCard";
import SearchBar from "../components/SearchBar";
import FilterButtons from "../components/FilterButtons";

import { fetchWorkers } from "../api/workers";
import { useAsync } from "../hooks/useAsync";

const SKILLS = ["All", "Plumber", "Electrician", "Carpenter", "Painter"];

// Minimum rating a worker must reach to stay in the list.
const RATINGS = [
  { value: 0,   label: "Any rating" },
  { value: 3,   label: "3.0+" },
  { value: 4,   label: "4.0+" },
  { value: 4.5, label: "4.5+" },
];

const SORTS = [
  { value: "rating",  label: "Highest rated" },
  { value: "success", label: "Best success rate" },
  { value: "jobs",    label: "Most jobs completed" },
  { value: "name",    label: "Name (A–Z)" },
];

function compareBy(sort) {
  switch (sort) {
    // An unrated artisan sorts last rather than as a zero, so a new profile is
    // not presented as a bad one.
    case "rating":
      return (a, b) => (b.rating ?? -1) - (a.rating ?? -1);
    case "success":
      return (a, b) => (b.jobSuccess ?? -1) - (a.jobSuccess ?? -1);
    case "jobs":
      return (a, b) => (b.jobsCompleted ?? 0) - (a.jobsCompleted ?? 0);
    default:
      return (a, b) => a.name.localeCompare(b.name);
  }
}

function ListingsPage() {
  const [searchParams] = useSearchParams();
  const initialLocation = searchParams.get("location") || "";
  const initialSkill = searchParams.get("skill");

  const [searchTerm, setSearchTerm] = useState(initialLocation);
  const [activeFilter, setActiveFilter] = useState(
    SKILLS.includes(initialSkill) ? initialSkill : "All"
  );
  const [minRating, setMinRating] = useState(0);
  const [sort, setSort] = useState("rating");

  const { data: workers, error, loading } = useAsync(fetchWorkers);

  const filteredWorkers = (workers ?? []).filter((worker) => {
    const matchesSearch =
      worker.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      worker.skill.toLowerCase().includes(searchTerm.toLowerCase()) ||
      worker.location.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesSkill =
      activeFilter === "All" ||
      worker.skill === activeFilter;

    const matchesRating =
      minRating === 0 || (worker.rating ?? 0) >= minRating;

    return matchesSearch && matchesSkill && matchesRating;
  })
    .sort(compareBy(sort));

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

      <div className="listing-controls">
        <label className="listing-control">
          <span>Minimum rating</span>
          <select
            value={minRating}
            onChange={(event) => setMinRating(Number(event.target.value))}
          >
            {RATINGS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="listing-control">
          <span>Sort by</span>
          <select value={sort} onChange={(event) => setSort(event.target.value)}>
            {SORTS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        {!loading && (
          <p className="listing-count">
            {filteredWorkers.length} artisan
            {filteredWorkers.length === 1 ? "" : "s"}
          </p>
        )}
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
