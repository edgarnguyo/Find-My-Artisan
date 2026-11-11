# Versioning Notes — Week 13

Find My Artisan (Team 1). Our v2 for Meditrac (Team 2, downstream), and our move to
Kanairo-Klean's v2 (Team 13, upstream).

## 1. Our breaking change

**The change.** In v2, `POST /v2/artisans/{id}/reviews` needs one more field,
`blockId`: the id of the availability block (the booked job) the review is about.
The block must belong to that artisan and must have been added through the API.

**Why it is worth a break.** Today any caller with a key can review any artisan,
any number of times, with no job behind it (left open in `SECURITY_AUDIT.md`). Reviews
feed the `verified` badge, so a review should point to a real booked job. Making a
field required is breaking: a v1 body sent to v2 now gets `400`.

**Kept small on purpose.** v2 only *checks* the block. It doesn't store it, so there
is no database change and v1's data stays exactly as it was. The limit: one block
can still be used for several reviews. Storing `blockId` with a unique key (one
review per job) would be the next step.

**Everything else is the same.** Every other `/v2/artisans` path falls through to
the v1 router (`server/routes/artisansV2.js`), so both versions read and write the
same data. The v2 201 response adds `blockId` to the Review shape. Adding a field
to a response is not breaking.

**Version numbers.** The URL version (`/v2`) is new. The contract in `openapi.yaml`
went from 2.2.0 to 3.0.0, because a required field is a breaking change.

## 2. Prediction: which line of Meditrac's code fails

Nothing fails today. Meditrac calls `/artisans`, and that still answers as v1.
Their review call fails when they switch its URL to `/v2/artisans/{id}/reviews`
and still send `{ author, rating, comment }`: our server answers `400
blockId is required in v2`.

_TODO: the exact file and line in Meditrac's code that builds the review body (ask
them), and whether they keep the `id` from their `POST /artisans/{id}/availability`
response. If they don't store it, they have nothing to send as `blockId`._

## 3. How it was built (Parts B and C)

| File | What it does |
|---|---|
| `server/routes/artisans.js` | v1, unchanged. Only exports its helpers (`v1Helpers`) at the end, so v2 checks the same way |
| `server/routes/artisansV2.js` | v2: the new review POST, then `router.use(v1)` for everything else |
| `server/deprecate.js` | Adds `Deprecation`, `Sunset` and `Link` headers |
| `server/app.js` | Mounts `/v2/artisans`, `/v1/artisans` and the old `/artisans`, all behind `requireApiKey`. Both v1 addresses carry the deprecation headers |
| `server/__tests__/versions.test.js` | 13 tests: v1's exact field names and error shape; `/artisans` = `/v1/artisans`; v1 still takes a review with no `blockId`; v2 rejects no/bad/someone else's `blockId` and accepts a valid one; v2 needs a key; headers on v1, not on v2 |
| `openapi.yaml` | `POST /v2/artisans/{id}/reviews` and `ReviewCreateV2`, version 3.0.0 |

The log needed no change. `monitoring.js` already reads `req.path` before a mounted
router strips its prefix, so `/v1/...`, `/v2/...` and `/artisans/...` log as
different paths. `/stats` shows them as different rows.

**Evidence that v1 didn't change.** `evidence/week13/v1_before.json` was saved before
any code change, and `v1_after.json` after. It holds `GET /artisans`,
`GET /artisans/1` and `GET /artisans/999999`, with status and body. `diff` printed
nothing.

**Sunset date: Tuesday 17 November 2026.** That's six days after the notice,
enough for Meditrac's change: store one id and send it in one request. v1 keeps
running after the date until `/stats` shows no more v1 calls from Meditrac, so the
sunset is announced, not forced.

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

_TODO, when their server is up (it answered `ERR_NGROK_3200`, endpoint offline, at
14:52 on 2026-11-11):_
1. _`curl` their `/v2/collection-locations` and `/v2/materials` and compare the result
   with their notice._
2. _Set `PARTNER_VERSION=v2` in `server/.env` and on Render. Restart, then check that
   `/partner/materials` says `"stale": false` and that the terminal has no
   `unexpected v2 shape` line._
3. _Switch back to v1 and then to v2 again. Both should work._
4. _Ask Kanairo to confirm our calls show on `GET /v2/...` in their `/stats`._

## 5. Who still uses our v1 (Part F)

_TODO after deploying: `curl -s -H "X-API-Key: <our key>" https://find-my-artisan.onrender.com/stats`.
Note the counts and caller labels on the `GET /artisans...` and `GET /v1/artisans...`
rows, and whether we could switch v1 off today._

## 6. Reflection (write this yourself, 150–250 words)

_TODO: in your own words:_
1. _What it was like to receive Kanairo's change, how you found out, and what you did first._
2. _What their notice did well and what was missing._
3. _Read our notice as Meditrac. What would you change?_
4. _As the API owner next time, one thing you would do differently._
