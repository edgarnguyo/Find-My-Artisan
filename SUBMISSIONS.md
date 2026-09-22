# Submission files: synopsis for review

One section per week: the file each handout asks for, what it contains now, and what's still open.

---

## Week 1: `TEAM_CHARTER.md` (+ `CONTRIBUTORS.md`)

**Handout asks for:**

1. Team name, members and starting roles
2. A one-paragraph app summary
3. The Part B audit (resources + actions)
4. The ring position

**What's in the file:**

1. **Team:** Find My Artisan, Group 1.
   - Edgar Nguyo: Team Lead / Coordinator
   - Ian Mbaya: Backend / Database
   - Cedric Ngari: Frontend
2. **Summary:** clients find artisans (electrical, plumbing…) by profession, location and rating. They view profiles and availability, book, and review. Artisans manage their profile, portfolio, availability and job status.
3. **Audit:**
   - Resources: artisan info, user info, job info (price, success rate, type, photos, bookings with status).
   - Actions: register / edit / delete accounts, publish portfolio, search, view availability, book, view own bookings, mark work complete, rate.
4. **Ring (added today):** Team 13 → us (Team 1) → Meditrac (Team 2).

**Open:** `CONTRIBUTORS.md` doesn't exist. A teammate other than the repo owner must create and push it; that push is the proof of access.

---

## Week 2: `API_NEEDS.md`

**Handout asks for:** 3–6 needs statements in the Part D format, plus one reflection paragraph on what surprised you in the partner interview.

**What's in the file:**

- **Our needs from Team 13 (upstream):**
  1. Locations of second-hand items
  2. Cost of raw materials
  3. Filtered access to materials
  4. A way to log scrap after a job
- **Meditrac's needs from us (downstream):**
  1. Source artisans
  2. Book artisans
  3. Vet artisans
  4. Schedule artisans
- Each need lists freshness, volume and auth.
- **Correction note:** Team 1 is us; the consumer is Meditrac.
- **Part E check against the Week 1 audit:** two gaps flagged. There was no artisan phone (needed for booking) and no certificate data (needed for vetting). Both were added to the contract.

**Open:** the reflection paragraph is a placeholder. Write it yourselves; it's graded as your own words.

---

## Week 3: `ENDPOINT_LIST.md`

**Handout asks for:**

- A Method / Path / Purpose / Maps to Need table
- ≥ 5 endpoints, at least 1 write
- Every need covered
- Peer review addressed

**What's in the file:**

| Method | Path | For |
|---|---|---|
| GET | `/artisans?trade=&county=` | Meditrac: needs 1 and 4 (each artisan's `busy` bookings) |
| GET | `/artisans/{id}` | Meditrac: needs 2 and 3 (phone + verification) |
| POST | `/artisans/{id}/reviews` | Meditrac: need 3 (rate after a job) |
| POST | `/artisans/{id}/availability` | Our artisans only |
| PATCH | `/artisans/{id}/availability/{blockId}` | Our artisans only |
| DELETE | `/artisans/{id}/availability/{blockId}` | Our artisans only |

- **Peer review (Group 3):**
  - Points 1–3 were fixed at the time, then superseded by the redesign.
  - Point 4 (versioning) is marked "not applied", since `/v1` was removed at your request.
- **"Design pivot" section:** booking happens by phone, so Meditrac's side is read-only (the lecturer's feedback).
- **Availability:** `busy` lists each artisan's bookings (date and time) for the next 14 days, read from the blocks.

---

## Week 4: `openapi.yaml` + `CONTRACT_QUESTIONS.md`

**Handout asks for:**

- A full contract (types, required fields, examples) that passes Swagger Editor with zero errors
- 3 questions on your upstream partner's contract

**What's in `openapi.yaml`:**

- All 6 endpoints (reviews added in Week 6, version 1.1.0).
- **Schemas:** `ArtisanSummary`, `Artisan` (adds `phone`, `hourlyRateKes`, `verification`), `AvailabilityBlockCreate`, `AvailabilityBlockUpdate`, `AvailabilityBlock`, and `Error { code, message }`.
- Examples are real rows from your database.
- **Server:** `http://localhost:5001`.
- It parses and renders in Swagger UI at `/docs`.

**Open:**

- Paste it into editor.swagger.io once to confirm zero errors.
- `CONTRACT_QUESTIONS.md` doesn't exist. It needs Team 13's `openapi.yaml`.

---

## Weeks 5 and 6: code + `CONTRACT_DEVIATIONS.md`

**Handout asks for:**

- **Week 5:** every GET implemented and verified field by field against the contract, with correct 200 / 404.
- **Week 6:** every write implemented, validation returning 400 before any write, 201 / 200 / 204 / 404 correct, and tested with bad input.
- **Both weeks:** `CONTRACT_DEVIATIONS.md` recording any contract changes.

**Code:**

- **`server/routes/artisans.js`:**
  - The 2 GETs with the mapping step.
  - The 3 availability writes and the reviews write, each validating first.
- **`server/schema.sql` (bottom):**
  - New columns: `county`, `phone`, `hourly_rate_kes`.
  - New tables: `verifications` and `availability_blocks`.
- **`server/index.js`:**
  - Swagger UI at `/docs`.
  - `/profiles`, a website-only route for photos and reviews.
  - JSON error handler.
- **React:** reads from `/profiles`; artisan sign-up asks for a phone number.

**`CONTRACT_DEVIATIONS.md`:**

| # | Change |
|---|---|
| 1, 4 | ids are integers, not UUIDs |
| 2 | `availableToday` description fixed (superseded by #10) |
| 3 | Examples use real data |
| 5 | POST availability can return 404; PATCH can return 400 |
| 6 | New `POST /artisans/{id}/reviews`; "no write endpoints" sentence removed; version 1.1.0 |
| 7 | Endpoints at `http://localhost:5001/artisans`, no `/api` prefix anywhere; version 1.2.0 |
| 8 | `GET /artisans/{id}` returns `busy` (next 14 days); version 1.3.0 |
| 9 | Every artisan has `area` (e.g. Embakasi); version 1.4.0 |
| 10 | `availableToday` removed; `busy` on every artisan; version 2.0.0 |

**Open:** tell Meditrac about these changes directly. The handout requires it.

**Supporting files (not graded):**

- `LAB-STATUS.md`: the gap check
- `LAB5-EXPLAINED.md` and `LAB6-EXPLAINED.md`: what changed and why
- `LAB5-6-STUDY.md`: learning notes

---

## Before you push: checklist

- [ ] Write the reflection in `API_NEEDS.md`
- [ ] A teammate pushes `CONTRIBUTORS.md`
- [ ] Write `CONTRACT_QUESTIONS.md` once you have Team 13's contract
- [ ] `openapi.yaml` shows zero errors in editor.swagger.io
- [ ] Send Meditrac `openapi.yaml` (v2.0.0) and `CHANGES_FOR_MEDITRAC.md`
- [ ] Merge this branch to `main` and push (the handouts grade what's on GitHub)
