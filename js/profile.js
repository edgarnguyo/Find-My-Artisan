const params = new URLSearchParams(window.location.search);
const rawId  = params.get("id");
const id     = rawId ? parseInt(rawId, 10) : 1;

const worker = WORKERS.find(w => w.id === id);

if (!worker) {
  document.body.innerHTML = `
    <div style="text-align:center;padding:4rem;font-family:system-ui">
      <h1>Worker not found</h1>
      <p>No artisan with id ${id} exists. <a href="profile.html">Go to default</a></p>
    </div>`;
  throw new Error(`No worker with id ${id}`);
}

const nameEl     = document.getElementById("worker-name");
const badgeEl    = document.getElementById("worker-badge");
const photoEl    = document.getElementById("worker-photo");
const skillEl    = document.getElementById("worker-skill");
const locationEl = document.getElementById("worker-location");
const ratingEl   = document.getElementById("worker-rating");
const successEl  = document.getElementById("worker-success");
const priceEl    = document.getElementById("worker-price");
const bioEl      = document.getElementById("worker-bio");
const reviewsEl  = document.getElementById("reviews-list");

photoEl.src = worker.photo;
photoEl.alt = `Photo of ${worker.name}`;

nameEl.insertBefore(
  document.createTextNode(worker.name + " "),
  badgeEl
);

if (!worker.verified) {
  badgeEl.classList.add("hidden");
}

skillEl.textContent    = worker.skill;
locationEl.textContent = "📍 " + worker.location;
ratingEl.textContent   = `⭐ ${worker.rating} rating`;
successEl.textContent  = `${worker.jobSuccess}% job success`;
priceEl.textContent    = worker.price;
bioEl.textContent      = worker.bio;

document.getElementById("stat-success").textContent      = `${worker.jobSuccess}%`;
document.getElementById("stat-jobs").textContent          = worker.jobsCompleted;
document.getElementById("stat-hours").textContent         = worker.hoursWorked.toLocaleString();
document.getElementById("stat-earnings").textContent      = worker.totalEarnings;
document.getElementById("stat-availability").textContent  = worker.hoursPerWeek;
document.getElementById("stat-languages").textContent     = worker.languages
  .map(lang => `${lang.name} (${lang.level})`)
  .join(", ");

const verificationEl = document.getElementById("stat-verification");
verificationEl.textContent = worker.verified ? "✓ ID verified" : "Not yet verified";
if (worker.verified) {
  verificationEl.classList.add("stats-verified");
}

const SKILL_PHOTOS = {
  Electrician: [
    { keyword: "electrical,panel", lock: 101 },
    { keyword: "circuitbreaker", lock: 103 },
  ],
  Plumber: [
    { keyword: "plumber,tools", lock: 205 },
    { keyword: "pipewrench", lock: 206 },
  ],
  Carpenter: [
    { keyword: "carpentrytools", lock: 305 },
    { keyword: "woodshop", lock: 306 },
  ],
  Painter: [
    { keyword: "paintcans", lock: 406 },
    { keyword: "paintdrip", lock: 413 },
  ],
};

const galleryGrid = document.getElementById("profile-gallery-grid");
const galleryPhotos = SKILL_PHOTOS[worker.skill] || SKILL_PHOTOS.Electrician;

galleryPhotos.forEach((photo) => {
  const tile = document.createElement("div");
  tile.className = "profile-gallery-tile";
  tile.innerHTML = `
    <img src="https://loremflickr.com/500/500/${photo.keyword}/all?lock=${photo.lock}" alt="${worker.skill} work sample" />
  `;
  galleryGrid.appendChild(tile);
});

const historySection = document.getElementById("profile-history");
const historyList = document.getElementById("history-list");

if (worker.workHistory && worker.workHistory.length > 0) {
  historySection.classList.remove("hidden");

  worker.workHistory.forEach(job => {
    const item = document.createElement("li");
    item.className = "history-item";

    const stars = "★".repeat(job.rating) + "☆".repeat(5 - job.rating);

    item.innerHTML = `
      <div class="history-top">
        <h3 class="history-title">${job.title}</h3>
        <span class="history-price">${job.price}</span>
      </div>
      <div class="history-meta">
        <span class="history-stars">${stars}</span>
        <span class="history-date">${job.dateRange}</span>
        <span class="history-type">${job.priceType}</span>
      </div>
    `;

    historyList.appendChild(item);
  });
}

worker.reviews.forEach(review => {
  const card = document.createElement("div");
  card.className = "review-card";

  const stars = "★".repeat(review.rating) + "☆".repeat(5 - review.rating);

  card.innerHTML = `
    <div class="review-stars">${stars}</div>
    <div class="review-author">${review.author}</div>
    <p class="review-comment">${review.comment}</p>
  `;

  reviewsEl.appendChild(card);
});

const form         = document.getElementById("booking-form");
const confirmation = document.getElementById("confirmation");

const nameError    = document.getElementById("name-error");
const contactError = document.getElementById("contact-error");
const dateError    = document.getElementById("date-error");
const timeError    = document.getElementById("time-error");
const jobError     = document.getElementById("job-error");

document.getElementById("budget").placeholder = `e.g. ${worker.price}`;

function clearErrors() {
  nameError.textContent    = "";
  contactError.textContent = "";
  dateError.textContent    = "";
  timeError.textContent    = "";
  jobError.textContent     = "";
}

function validate(name, contact, date, time, job) {
  let valid = true;

  if (name.trim() === "") {
    nameError.textContent = "Please enter your name.";
    valid = false;
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const phonePattern = /^[\d\s+()-]{7,}$/;

  if (contact.trim() === "") {
    contactError.textContent = "Please enter your email or phone number.";
    valid = false;
  } else if (!emailPattern.test(contact) && !phonePattern.test(contact)) {
    contactError.textContent = "Enter a valid email (name@domain.com) or phone (min 7 digits).";
    valid = false;
  }

  if (date.trim() === "") {
    dateError.textContent = "Please choose a preferred date.";
    valid = false;
  } else {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (new Date(date) < today) {
      dateError.textContent = "Date cannot be in the past.";
      valid = false;
    }
  }

  if (time.trim() === "") {
    timeError.textContent = "Please choose a preferred time.";
    valid = false;
  }

  if (job.trim() === "") {
    jobError.textContent = "Please describe the job.";
    valid = false;
  }

  return valid;
}

function saveBookingRequest(request) {
  const requests = JSON.parse(localStorage.getItem("bookingRequests") || "[]");
  requests.push(request);
  localStorage.setItem("bookingRequests", JSON.stringify(requests));
}

form.addEventListener("submit", function(event) {
  event.preventDefault();

  const name    = document.getElementById("name").value;
  const contact = document.getElementById("contact").value;
  const date    = document.getElementById("date").value;
  const time    = document.getElementById("time").value;
  const budget  = document.getElementById("budget").value;
  const job     = document.getElementById("job").value;

  clearErrors();

  if (validate(name, contact, date, time, job)) {
    saveBookingRequest({
      workerId: worker.id,
      workerName: worker.name,
      name,
      contact,
      date,
      time,
      budget,
      job,
      submittedAt: new Date().toISOString(),
    });
    form.classList.add("hidden");
    confirmation.classList.remove("hidden");
  }
});

const devBar = document.createElement("div");
devBar.style.cssText = `
  position: fixed; bottom: 0; left: 0; right: 0;
  background: #241d17; color: #fff;
  padding: 8px 16px; font-family: monospace; font-size: 13px;
  display: flex; gap: 8px; align-items: center; flex-wrap: wrap;
  max-height: 40vh; overflow-y: auto; z-index: 50;
`;
devBar.innerHTML = `<span>DEV: jump to worker</span>`;

WORKERS.forEach(w => {
  const btn = document.createElement("button");
  btn.textContent = `#${w.id} ${w.name.split(" ")[0]}`;
  btn.style.cssText = `
    background: #b1502f; color: #fff; border: none;
    border-radius: 4px; padding: 4px 10px; cursor: pointer;
    font-size: 12px;
  `;
  btn.addEventListener("click", () => {
    window.location.href = `profile.html?id=${w.id}`;
  });
  devBar.appendChild(btn);
});

document.body.appendChild(devBar);
