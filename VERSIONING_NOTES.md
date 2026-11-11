# Versioning Notes — Week 13

Find My Artisan (Team 1). Our v2 for Meditrac (Team 2, downstream), and our move to
Kanairo-Klean's v2 (Team 13, upstream).

## 1. Our breaking change

**The change.** `POST /artisans/{id}/reviews` now answers `403 no_job` unless the
artisan has logged a **finished job for your team** on their dashboard (its end
time has passed, or they marked it complete). In v1 a partner could review any
artisan at any time.

**Why it is worth a break.** Reviews feed the `verified` badge that Meditrac uses
for vetting. With no job rule, any key could post reviews for artisans it never
hired, as many as it liked (left open in `SECURITY_AUDIT.md`). The job rule makes
every API review come from a real job.

**Why it is breaking.** Code that worked yesterday can fail today without the
caller changing anything: a review Meditrac posted for an artisan with no job
logged for Meditrac now gets `403` instead of `201`. In the handout's table this is
"change what a status code means".

**How we got here.** We first shipped this rule straight into the API (PRs #20 and
#24), with no version. That is exactly the mistake Week 13 is about: Meditrac's
review calls could start failing with no warning. So in this lab the rule moved
to **v2**, and the old rule came back as **v1** at the URLs Meditrac already
calls.

**Version numbers.** The URL version (`/v2`) is new. The contract in `openapi.yaml`
went from 2.3.0 to 3.0.0, because a breaking change raises the major number.

## 2. Prediction: which line of Meditrac's code fails

Nothing fails today: Meditrac calls `/artisans`, which is v1 and still takes the
review. Their review call starts failing when they move it to
`/v2/artisans/{id}/reviews` for an artisan with no finished job logged for
Meditrac. Their code then gets `403 no_job` where it expects `201`.

_TODO: the exact file and line in Meditrac's code that posts the review and checks
its status (ask them), and whether it shows a `403` to their user or fails quietly._

## 3. How it was built (Parts B and C)

| File | What it does |
|---|---|
| `server/routes/artisans.js` | v2, unchanged: the current router, with the job rule. It only exports a few helpers at the end, so v1 checks fields the same way |
| `server/routes/artisansV1.js` | v1, frozen: the old review POST (valid fields, the artisan exists, no job needed), then `router.use(current)` for every other route |
| `server/deprecate.js` | Adds `Deprecation`, `Sunset` and `Link` headers |
| `server/app.js` | Mounts `/v2/artisans`, `/v1/artisans` and the old `/artisans`, all behind `requireApiKey`. Both v1 addresses carry the deprecation headers |
| `server/__tests__/versions.test.js` | 12 tests: v1's exact field names and error shape; `/artisans` = `/v1/artisans`; v1 takes a review with no job, and only the posting key can edit it; v2 answers `403 no_job` with no job and `201` after a finished job; v2 checks fields like v1; v2 needs a key; headers on v1, not on v2 |
| `server/__tests__/artisans.test.js` | The existing job-rule tests now post to `/v2/artisans`, where the rule lives |
| `openapi.yaml` | Describes v2 and says how v1 differs. Version 3.0.0 |

The log needed no change. `monitoring.js` already reads `req.path` before a mounted
router strips its prefix, so `/v1/...`, `/v2/...` and `/artisans/...` log as
different paths. `/stats` shows them as different rows.

**Evidence that v1's reads didn't change.** `evidence/week13/v1_before.json` was
saved from `main` before any code change, and `v1_after.json` after. It holds
`GET /artisans`, `GET /artisans/1` and `GET /artisans/999999`, with status and
body. `diff` printed nothing. The review POST is covered by the tests above.

**What v1 keeps from the later fixes.** A v1 review still records the key that
posted it, so only that key can edit or delete it, and partners still can't move or
delete jobs logged for them. Those fixes change no response for a well-behaved
caller, so they stay in both versions.

**Sunset date: Tuesday 24 November 2026.** That's thirteen days after the notice.
Meditrac's change is small (handle `403 no_job`, and ask artisans to log jobs).
v1 keeps running after the date until `/stats` shows no more v1 calls from
Meditrac.

## 4. Kanairo-Klean's v2 (Part E)

Their notice came on 2026-11-11. Their only change is that `GET /collection-locations`
and `GET /materials` wrap the list as `{ "data": [...], "count": N }`.

Where it would have broken us (their question 2):
- `server/kanairo.js`, `fetchMaterials`: `Array.isArray(materials)` fails on the
  wrapped body and throws `PartnerUnavailable`. The Materials page would quietly show
  the saved copy (`stale: true`).
- `server/routes/partner.js`, `GET /collection-locations`: the same check, so the
  scrap drop-off form would get `502`.

What we changed:
- `server/kanairoVersions.js` is the one place that knows both shapes. Each version
  has a `prefix` (`''` or `/v2`) and a `list(body)` that returns a plain array, or
  throws with the reason if the shape is wrong.
- Both call sites use `partnerVersion()`, which picks the version from
  `PARTNER_VERSION` in `.env` (v1 if left out). Moving across, or back, is one word.
- `POST /collection-locations/{id}/drop-offs` is unchanged in their notice, so it
  keeps its path.
- `server/__tests__/kanairoVersions.test.js`: both parsers give the same list; an
  empty v2 list is `[]`; the wrong parser throws; on v2 our routes call
  `/v2/materials` and `/v2/collection-locations` and return `stale: false`; a
  v1-shaped answer while on v2 is a logged `502`, not quiet saved data.

_TODO, when their server is up (on 2026-11-11 their ngrok URL answered
`ERR_NGROK_3200`, offline, then `ERR_NGROK_8012`, tunnel up but their server not
answering):_
1. _`curl` their `/v2/collection-locations` and `/v2/materials` and compare the result
   with their notice._
2. _Set `PARTNER_VERSION=v2` in `server/.env` and on Render. Restart, then check that
   `/partner/materials` says `"stale": false` and that the terminal has no
   `unexpected v2 shape` line._
3. _Switch back to v1 and then to v2 again. Both should work._
4. _Ask Kanairo to confirm our calls show on `GET /v2/...` in their `/stats`._

## 5. Who still uses our v1 (Part F)

_TODO after deploying: `curl -s -H "X-API-Key: <our key>" https://find-my-artisan.onrender.com/stats`.
Note the counts and caller labels on the `POST /artisans/:id/reviews` and
`POST /v1/artisans/:id/reviews` rows, and whether we could switch v1 off today._

## 6. Reflection (write this yourself, 150–250 words)

_TODO: in your own words:_
1. _What it was like to receive Kanairo's change, how you found out, and what you did first._
2. _What their notice did well and what was missing._
3. _Read our notice as Meditrac. What would you change?_
4. _As the API owner next time, one thing you would do differently. (Shipping the job
   rule without a version first is a real example.)_
