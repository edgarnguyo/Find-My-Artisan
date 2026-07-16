const hamburger = document.getElementById("hamburger");
const navLinks = document.getElementById("nav-links");

hamburger.addEventListener("click", () => {
  const isOpen = navLinks.classList.toggle("open");
  hamburger.setAttribute("aria-expanded", isOpen);
});

document.getElementById("footer-year").textContent =
  `© ${new Date().getFullYear()} Find My Artisan. Built for the web.`;

const heroSearch = document.getElementById("hero-search");

heroSearch.addEventListener("submit", (e) => {
  e.preventDefault();
  const location = document.getElementById("hero-search-location").value;
  const skill = document.getElementById("hero-search-skill").value;
  const params = new URLSearchParams();
  if (location) params.set("location", location);
  if (skill && skill !== "All") params.set("skill", skill);
  window.location.href = `listings.html?${params.toString()}`;
});

const CITY_COUNT_IDS = {
  Nairobi: "location-count-nairobi",
  Mombasa: "location-count-mombasa",
  Kisumu: "location-count-kisumu",
  Nakuru: "location-count-nakuru",
};

Object.entries(CITY_COUNT_IDS).forEach(([city, id]) => {
  const count = WORKERS.filter((worker) => worker.location.includes(city)).length;
  document.getElementById(id).textContent = `${count} artisans`;
});

const SKILLS = ["Electrician", "Plumber", "Carpenter", "Painter"];
const LOCATIONS = ["Nairobi", "Mombasa", "Kisumu", "Nakuru"];
const DISPLAY_WORKERS = [
  { name: "Achieng Otieno", photo: "https://randomuser.me/api/portraits/women/30.jpg" },
  { name: "Njoroge Mwangi", photo: "https://randomuser.me/api/portraits/men/70.jpg" },
  { name: "Akinyi Chebet", photo: "https://randomuser.me/api/portraits/women/36.jpg" },
];

const previewGrid = document.getElementById("preview-grid");
const previewError = document.getElementById("preview-error");

function renderPreviewCards(count) {
  previewGrid.innerHTML = "";
  for (let i = 0; i < count; i++) {
    const worker = DISPLAY_WORKERS[i];
    const rating = (4.3 + i * 0.2).toFixed(1);

    const card = document.createElement("div");
    card.className = "preview-card";
    card.innerHTML = `
      <img class="preview-photo" src="${worker.photo}" alt="${worker.name}" />
      <div class="preview-info">
        <h3 class="preview-name">${worker.name}</h3>
        <span class="skill-badge">${SKILLS[i % SKILLS.length]}</span>
        <p class="preview-location">📍 ${LOCATIONS[i % LOCATIONS.length]}</p>
        <p class="preview-rating">⭐ ${rating}</p>
      </div>
    `;
    previewGrid.appendChild(card);
  }
}

fetch("https://randomuser.me/api/?results=3&seed=artisan")
  .then((res) => {
    if (!res.ok) throw new Error("Network response was not ok");
    return res.json();
  })
  .then((data) => {
    renderPreviewCards(data.results.length);
  })
  .catch(() => {
    previewGrid.classList.add("hidden");
    previewError.classList.remove("hidden");
  });
