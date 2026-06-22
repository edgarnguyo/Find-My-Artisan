// src/pages/ListingsPage.jsx

import { useState, useEffect } from "react";

import WorkerCard from "../components/WorkerCard";
import SearchBar from "../components/SearchBar";
import FilterButtons from "../components/FilterButtons";

import { WORKERS } from "../data/mockData";

function ListingsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  const filteredWorkers = WORKERS.filter((worker) => {
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
    <div className="listings-page">
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
        {isLoading ? (
          [...Array(6)].map((_, index) => (
            <div
              key={index}
              className="skeleton-card"
            ></div>
          ))
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
    </div>
  );
}

export default ListingsPage;