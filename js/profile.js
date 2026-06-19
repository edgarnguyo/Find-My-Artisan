// ─────────────────────────────────────────────
//  profile.js  —  Week 1 vanilla JS
//  Runs after the DOM is ready (scripts are at
//  the bottom of body, so HTML exists by the
//  time this file executes).
// ─────────────────────────────────────────────

// ── 1. READ THE WORKER ID FROM THE URL ────────
// window.location.search is the query string portion of the URL —
// everything from the "?" onward. Example:
//   URL: profile.html?id=2
//   window.location.search → "?id=2"
//
// URLSearchParams parses that string into key/value pairs so you
// can read individual values by name without splitting strings yourself.
//   new URLSearchParams("?id=2").get("id") → "2"  (always a string)
//
// If no id is in the URL (page opened directly), we default to 1.
const params = new URLSearchParams(window.location.search);
const rawId  = params.get("id");
const id     = rawId ? parseInt(rawId, 10) : 1;
// parseInt converts the string "2" to the number 2.
// The second argument (10) is the radix — base 10 (decimal).
// Always pass it; without it, parseInt can misread strings like "08".


// ── 2. FIND THE MATCHING WORKER ───────────────
// WORKERS comes from mockData.js, which attached it to window.
// Array.find() loops through the array and returns the first element
// for which the callback returns true. If nothing matches, it returns
// undefined. Example:
//   [1,2,3].find(n => n > 1)  →  2
const worker = WORKERS.find(w => w.id === id);

if (!worker) {
  // If the id isn't in our data, bail early with a visible error.
  document.body.innerHTML = `
    <div style="text-align:center;padding:4rem;font-family:system-ui">
      <h1>Worker not found</h1>
      <p>No artisan with id ${id} exists. <a href="profile.html">Go to default</a></p>
    </div>`;
  throw new Error(`No worker with id ${id}`);
  // throw stops the rest of the script from running.
}


// ── 3. POPULATE THE PAGE ──────────────────────
// document.getElementById returns the one element that has that id
// attribute. This is how JavaScript reaches into the HTML you wrote
// and changes it. Example:
//   document.getElementById("worker-name").textContent = "Grace"
//   → the <h1 id="worker-name"> now reads "Grace"

// textContent sets the visible text inside an element.
// It treats the value as plain text, so it won't interpret < > as HTML —
// that prevents XSS (someone injecting malicious HTML via the data).

// src and alt are attributes on the <img>, not text nodes, so we
// set them via the .src and .alt properties instead.

const nameEl   = document.getElementById("worker-name");
const badgeEl  = document.getElementById("worker-badge");
const photoEl  = document.getElementById("worker-photo");
const skillEl  = document.getElementById("worker-skill");
const locationEl = document.getElementById("worker-location");
const priceEl  = document.getElementById("worker-price");
const bioEl    = document.getElementById("worker-bio");
const reviewsEl = document.getElementById("reviews-list");

// Photo
photoEl.src = worker.photo;
photoEl.alt = `Photo of ${worker.name}`;

// Name — the badge span is inside the h1, so we set only the text node
// before the span. We do that by inserting a text node directly.
nameEl.insertBefore(
  document.createTextNode(worker.name + " "),
  badgeEl   // insert before the badge span so it reads: "Grace ✓ Verified"
);

// Hide the badge if the worker is not verified
if (!worker.verified) {
  badgeEl.classList.add("hidden");
}

skillEl.textContent    = worker.skill;
locationEl.textContent = "📍 " + worker.location;
priceEl.textContent    = worker.price;
bioEl.textContent      = worker.bio;


// ── 4. BUILD REVIEW CARDS ─────────────────────
// forEach is an array method that calls a function once per element.
// It doesn't return a new array (unlike map); it's used purely for
// side effects — in this case, building and appending DOM nodes.

worker.reviews.forEach(review => {
  // Create a new <div> in memory (not yet on the page).
  const card = document.createElement("div");
  card.className = "review-card";

  // starsFromRating: repeat the ★ character `rating` times.
  // "★".repeat(4) → "★★★★"
  const stars = "★".repeat(review.rating) + "☆".repeat(5 - review.rating);

  // innerHTML sets the HTML content of an element.
  // We use it here (not textContent) because we want to create child
  // elements inside the card. The data comes from our own mockData,
  // not user input, so XSS risk is negligible here. In a real app with
  // server data you'd create each child element individually.
  card.innerHTML = `
    <div class="review-stars">${stars}</div>
    <div class="review-author">${review.author}</div>
    <p class="review-comment">${review.comment}</p>
  `;

  // appendChild adds the card to the end of the reviews container.
  reviewsEl.appendChild(card);
});


// ── 5. BOOKING FORM ───────────────────────────

const form         = document.getElementById("booking-form");
const confirmation = document.getElementById("confirmation");

// Grab the error <small> elements by id once, reuse them below.
const nameError    = document.getElementById("name-error");
const contactError = document.getElementById("contact-error");
const jobError     = document.getElementById("job-error");

// A helper that clears all error messages before each new validation pass.
function clearErrors() {
  nameError.textContent    = "";
  contactError.textContent = "";
  jobError.textContent     = "";
}

// validate() inspects each field and writes a message to the matching
// error element if it fails. Returns true only if every field is valid.
function validate(name, contact, job) {
  let valid = true;

  if (name.trim() === "") {
    nameError.textContent = "Please enter your name.";
    valid = false;
  }

  // We accept either a phone number (digits, spaces, +, min 7 chars)
  // OR an email address. We test the contact value against both patterns.
  //
  // A regular expression (regex) is a pattern that describes a set of strings.
  // /pattern/.test(string) returns true if the string matches the pattern.
  //   /^[^\s@]+@[^\s@]+\.[^\s@]+$/ — a simple email pattern:
  //     ^ start  [^\s@]+ one or more chars that aren't space or @
  //     @ literal @
  //     [^\s@]+ domain part  \. literal dot  [^\s@]+$ TLD
  //   /^[\d\s+()\-]{7,}$/ — phone: digits, spaces, +, (), -, at least 7 chars
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const phonePattern = /^[\d\s+()\-]{7,}$/;

  if (contact.trim() === "") {
    contactError.textContent = "Please enter your email or phone number.";
    valid = false;
  } else if (!emailPattern.test(contact) && !phonePattern.test(contact)) {
    contactError.textContent = "Enter a valid email (name@domain.com) or phone (min 7 digits).";
    valid = false;
  }

  if (job.trim() === "") {
    jobError.textContent = "Please describe the job.";
    valid = false;
  }

  return valid;
}

// The "submit" event fires when the user clicks the submit button OR
// presses Enter inside the form. addEventListener attaches a function
// to run when that event occurs on this element.
//
// event.preventDefault() cancels the browser's default submit behaviour,
// which would reload (or navigate) the page. We want to stay on the page
// and handle it ourselves.
form.addEventListener("submit", function(event) {
  event.preventDefault();

  // Read the current value of each input.
  const name    = document.getElementById("name").value;
  const contact = document.getElementById("contact").value;
  const job     = document.getElementById("job").value;

  clearErrors();

  if (validate(name, contact, job)) {
    // All fields passed — hide the form, show the confirmation message.
    form.classList.add("hidden");
    confirmation.classList.remove("hidden");
  }
  // If validate returned false, the error messages are already set —
  // the form stays visible so the user can fix their input.
});


// ── 6. DEV CONTROL (remove before final demo if you like) ────
// A quick jump tool so you can test each worker without needing
// a listings page to link to you. It lives at the bottom of the
// page and is styled inline so it doesn't need extra CSS.
const devBar = document.createElement("div");
devBar.style.cssText = `
  position: fixed; bottom: 0; left: 0; right: 0;
  background: #1e293b; color: #fff;
  padding: 8px 16px; font-family: monospace; font-size: 13px;
  display: flex; gap: 8px; align-items: center;
`;
devBar.innerHTML = `<span>DEV: jump to worker</span>`;

WORKERS.forEach(w => {
  const btn = document.createElement("button");
  btn.textContent = `#${w.id} ${w.name.split(" ")[0]}`;
  btn.style.cssText = `
    background: #2563eb; color: #fff; border: none;
    border-radius: 4px; padding: 4px 10px; cursor: pointer;
    font-size: 12px;
  `;
  // Navigating to the same page with a different ?id= reloads and
  // runs all the JS again with the new worker.
  btn.addEventListener("click", () => {
    window.location.href = `profile.html?id=${w.id}`;
  });
  devBar.appendChild(btn);
});

document.body.appendChild(devBar);
