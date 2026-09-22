# Where we are: Weeks 1–4 (checked 22 Sep 2026)

Each week's handout checklist is listed below with what the repo actually has.
✅ done · ⚠️ done but not as the handout asks · ❌ missing

## Week 1: Team, repo, charter

| Handout item | Status | What's in the repo |
|---|---|---|
| Team formed, roles, ring position | ✅ | Edgar (lead), Ian (backend), Cedric (frontend). Ring: Team 13 → us (Team 1) → Meditrac (Team 2) |
| Repo created, existing app imported | ✅ | github.com/edgarnguyo/Find-My-Artisan |
| Non-owner push proved with `CONTRIBUTORS.md` | ❌ | No `CONTRIBUTORS.md` anywhere |
| `TEAM_CHARTER.md` at the repo root | ⚠️ | It's at `react-app/Team_Charter.md`: wrong folder and wrong name casing. Has team info, app summary and the Part B audit |

## Week 2: API needs

| Handout item | Status | What's in the repo |
|---|---|---|
| `API_NEEDS.md` at the root | ⚠️ | File is named `API_Needs.md` |
| 3–6 needs statements in the Part D format | ✅ | 4 upstream (Team 13), 4 downstream |
| Downstream consumer labelled correctly | ⚠️ | Section is headed "Team 1", which is us. It should say Meditrac (Team 2). `ENDPOINT_LIST.md` already records this correction |
| Each need checked against the Week 1 audit, gaps flagged | ❌ | No Part E check in the file |
| Reflection paragraph | ❌ | Not found |

## Week 3: Endpoint list

| Handout item | Status | What's in the repo |
|---|---|---|
| `ENDPOINT_LIST.md` with Method / Path / Purpose / Maps to Need | ✅ | 5 endpoints: 2 GETs for Meditrac, POST/PATCH/DELETE availability for our artisans |
| Every need has an endpoint | ✅ | Needs 1–4 all mapped |
| ≥ 5 endpoints, ≥ 1 write | ✅ | 5 endpoints, 3 writes |
| Peer review received and addressed | ✅ | Group 3's 4 points each marked fixed / superseded |
| Committed and pushed | ⚠️ | `main` still has the **old booking version**. The updated version (your Downloads copy) is in this worktree, not yet committed. The `/v1` prefix has been removed as you asked, and review point 4 (versioning) now says it wasn't applied |

## Week 4: OpenAPI contract

| Handout item | Status | What's in the repo |
|---|---|---|
| `openapi.yaml` covers every endpoint | ⚠️ | Updated version matches the 5 endpoints, but only in this worktree. `main` has the old `/workers` + `/bookings` contract |
| Types, required fields, examples | ✅ | Every schema is typed and has an example |
| Validated in Swagger Editor with 0 errors | ❓ | Can't confirm from the files. Paste it into editor.swagger.io once |
| `CONTRACT_QUESTIONS.md` (3 questions on Team 13's contract) | ❌ | Missing. Needs Team 13's `openapi.yaml`, which isn't in the repo |

## The gap that matters for Weeks 5–6

The contract and the code describe **different APIs**:

| | Contract (`openapi.yaml`) | Code (`server/routes/artisans.js`) + database |
|---|---|---|
| Paths | `/artisans`, `/artisans/{id}`, `/artisans/{id}/availability[/{blockId}]` | `/api/artisans`, `/api/artisans/:id`, plus `/api/bookings`, `/api/clients`, `/api/login` |
| Artisan id | `string`, format `uuid` | `INT` (1, 2, 3…) |
| Field names | `trade`, `county`, `availableToday`, `phone`, `hourlyRateKes`, `verification{…}` | `skill`, `location` ("Westlands, Nairobi"), `price` (text range), no phone, no hourly rate, no certificate data |
| Availability | Computed from availability blocks | No blocks table |
| Errors | `{ code, message }` | `{ error }` |

Week 5 is exactly about closing this gap: build the GETs so they return what the contract promises, and record any contract changes in `CONTRACT_DEVIATIONS.md`. Week 6 builds the three availability writes.

## Small fixes to do before Week 5 (your call)

1. Move `react-app/Team_Charter.md` to `TEAM_CHARTER.md` at the root.
2. Rename `API_Needs.md` to `API_NEEDS.md`, change "Team 1" to "Meditrac (Team 2)", and add the Part E gap check and reflection.
3. Add `CONTRIBUTORS.md` (a teammate should push it, since that's the point of the step).
4. Get Team 13's contract and write `CONTRACT_QUESTIONS.md`.
5. Commit the updated `ENDPOINT_LIST.md` and `openapi.yaml`.

## One open decision before building Week 5

The website already uses `/api/artisans` with the old field names. Without `/v1`, the contract endpoints need a home:

- **Option A:** make `/api/artisans` return the contract shape and update the React app to read the new names. One API.
- **Option B:** leave the website's routes alone and put the contract endpoints under another prefix. Less work, but two APIs for the same data.

## Update (same day)

Done: items 1, 2 (except the reflection, which the team has to write) and 5, plus Option A,
Week 5 and Week 6. Still open: `CONTRIBUTORS.md` (a teammate pushes it), the API_NEEDS
reflection, `CONTRACT_QUESTIONS.md` (needs Team 13's contract), and telling Meditrac about
`CONTRACT_DEVIATIONS.md`.
