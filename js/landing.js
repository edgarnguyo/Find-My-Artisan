// ============================================================
//  landing.js — vanilla version of Person A's React components
//  (Navbar, WorkerPreview, Footer).
// ============================================================

// ── Navbar: hamburger toggle ──
// React used useState(menuOpen) + a ternary to add/remove the "open" class.
// In vanilla JS there's no state variable — classList.toggle() reads the
// class that's already on the element and flips it, which is the DOM's
// own way of storing that same "is it open" boolean.
const hamburger = document.getElementById("hamburger");
const navLinks = document.getElementById("nav-links");

hamburger.addEventListener("click", () => {
  const isOpen = navLinks.classList.toggle("open");
  hamburger.setAttribute("aria-expanded", isOpen);
});

// ── Footer: dynamic year ──
document.getElementById("footer-year").textContent =
  `© ${new Date().getFullYear()} Find My Artisan. Built for the web.`;

// ── Worker preview: fetch + render ──
// Same intent as WorkerPreview.jsx's useEffect: call the randomuser.me API
// to demonstrate a real async fetch, but display our own curated
// Kenyan-context name/photo pairs instead of the fetched (non-Kenyan) ones.
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
    // The fetch succeeded — data.results confirms the API responded,
    // but we render our own Kenyan-context cards rather than the fetched ones.
    renderPreviewCards(data.results.length);
  })
  .catch(() => {
    previewGrid.classList.add("hidden");
    previewError.classList.remove("hidden");
  });
