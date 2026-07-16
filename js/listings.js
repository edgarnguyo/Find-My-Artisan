const SKILLS = ["All", "Plumber", "Electrician", "Carpenter", "Painter"];

const initialParams = new URLSearchParams(window.location.search);
const initialLocation = initialParams.get("location") || "";
const initialSkill = initialParams.get("skill");

let searchTerm = initialLocation;
let activeFilter = SKILLS.includes(initialSkill) ? initialSkill : "All";
let isLoading = true;

const searchInput = document.getElementById("search-input");
const filterContainer = document.getElementById("filter-container");
const workerGrid = document.getElementById("worker-grid");

searchInput.value = searchTerm;

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
  const verifiedLine = worker.verified ? '<p class="worker-verified">✓ Verified</p>' : "";
  return `
    <a href="profile.html?id=${worker.id}" class="worker-card">
      <img src="${worker.photo}" alt="${worker.name}" class="worker-image" />
      <h3>${worker.name}</h3>
      <span class="skill-badge">${worker.skill}</span>
      <div class="worker-meta">
        <p class="worker-rating">⭐ ${worker.rating}</p>
        <p class="worker-success">${worker.jobSuccess}% job success</p>
        <p class="worker-price">${worker.price}</p>
        <p class="worker-location">${worker.location}</p>
        ${verifiedLine}
      </div>
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

searchInput.addEventListener("input", (e) => {
  searchTerm = e.target.value;
  renderWorkerGrid();
});

renderFilterButtons();
renderWorkerGrid();

setTimeout(() => {
  isLoading = false;
  renderWorkerGrid();
}, 2000);
