import { useState } from "react";
import { useSearchParams } from "react-router-dom";

import WorkerCard from "../components/WorkerCard";
import SearchBar from "../components/SearchBar";
import FilterButtons from "../components/FilterButtons";

import { fetchWorkers } from "../api/workers";
import { useAsync } from "../hooks/useAsync";

const SKILLS = ["All", "Plumber", "Electrician", "Carpenter", "Painter"];

function ListingsPage() {
  const [searchParams] = useSearchParams();
  const initialLocation = searchParams.get("location") || "";
  const initialSkill = searchParams.get("skill");

  const [searchTerm, setSearchTerm] = useState(initialLocation);
  const [activeFilter, setActiveFilter] = useState(
    SKILLS.includes(initialSkill) ? initialSkill : "All"
  );

  const { data: workers, error, loading } = useAsync(fetchWorkers);

  const filteredWorkers = (workers ?? []).filter((worker) => {
    const matchesSearch =
      worker.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      worker.skill.toLowerCase().includes(searchTerm.toLowerCase()) ||
      worker.location.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesSkill =
      activeFilter === "All" ||
      worker.skill === activeFilter;

    return matchesSearch && matchesSkill;
  });

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
