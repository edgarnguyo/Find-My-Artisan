// src/components/FilterButtons.jsx

const skills = [
  "All",
  "Plumber",
  "Electrician",
  "Carpenter",
  "Painter"
];

function FilterButtons({
  activeFilter,
  setActiveFilter
}) {
  return (
    <div className="filter-container">
      {skills.map((skill) => (
        <button
          key={skill}
          className={
            activeFilter === skill
              ? "filter-btn active"
              : "filter-btn"
          }
          onClick={() =>
            setActiveFilter(skill)
          }
        >
          {skill}
        </button>
      ))}
    </div>
  );
}

export default FilterButtons;