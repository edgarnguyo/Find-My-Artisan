// ============================================================
//  listings.js — vanilla version of Person B's React components
//  (ListingsPage, WorkerCard, SearchBar, FilterButtons).
//
//  React kept three pieces of state: searchTerm, activeFilter, isLoading.
//  Vanilla JS has no state hooks, so we use three plain variables instead
//  and re-run render() ourselves whenever one of them changes — that's
//  the manual version of what useState's setter + re-render does for you.
// ============================================================

const SKILLS = ["All", "Plumber", "Electrician", "Carpenter", "Painter"];

let searchTerm = "";
let activeFilter = "All";
let isLoading = true;

const searchInput = document.getElementById("search-input");
const filterContainer = document.getElementById("filter-container");
const workerGrid = document.getElementById("worker-grid");

// ── Filter buttons ──
function renderFilterButtons() {
  filterContainer.innerHTML = "";
  SKILLS.forEach((skill) => {
    const btn = document.createElement("button");
    btn.textContent = skill;
    btn.className = "filter-btn" + (activeFilter === skill ? " active" : "");
    btn.addEventListener("click", () => {
      activeFilter = skill;
      renderFilterButtons();
      renderWorkerGrid();
    });
    filterContainer.appendChild(btn);
  });
}

// ── Worker grid ──
function getFilteredWorkers() {
  return WORKERS.filter((worker) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      worker.name.toLowerCase().includes(term) ||
      worker.skill.toLowerCase().includes(term) ||
      worker.location.toLowerCase().includes(term);

    const matchesSkill = activeFilter === "All" || worker.skill === activeFilter;

    return matchesSearch && matchesSkill;
  });
}

function workerCardHTML(worker) {
  const verifiedLine = worker.verified ? "<p>✓ Verified</p>" : "";
  return `
    <a href="profile.html?id=${worker.id}" class="worker-card">
      <img src="${worker.photo}" alt="${worker.name}" class="worker-image" />
      <h3>${worker.name}</h3>
      <span class="skill-badge">${worker.skill}</span>
      <p>⭐ ${worker.rating}</p>
      <p>${worker.price}</p>
      <p>${worker.location}</p>
      ${verifiedLine}
    </a>
  `;
}

function renderWorkerGrid() {
  if (isLoading) {
    workerGrid.innerHTML = Array(6)
      .fill('<div class="skeleton-card"></div>')
      .join("");
    return;
  }

  const filteredWorkers = getFilteredWorkers();

  if (filteredWorkers.length === 0) {
    workerGrid.innerHTML = '<p class="no-results">No artisans found.</p>';
    return;
  }

  workerGrid.innerHTML = filteredWorkers.map(workerCardHTML).join("");
}

// ── Search input ──
searchInput.addEventListener("input", (e) => {
  searchTerm = e.target.value;
  renderWorkerGrid();
});

// ── Initial render: same simulated loading delay as ListingsPage.jsx ──
renderFilterButtons();
renderWorkerGrid();

setTimeout(() => {
  isLoading = false;
  renderWorkerGrid();
}, 2000);
