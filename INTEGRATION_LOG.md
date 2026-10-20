# Integration Log — Week 10

Find My Artisan (Team 1) calling our upstream partner, **Kanairo-Klean (Team 13)**,
and supporting our downstream partner, **Meditrac (Team 2)**.

- Partner contract: [`openapi.yaml` v1.1.0](https://github.com/berur874/Kanairo-cleaan/blob/main/openapi.yaml)
- Partner README: [Kanairo-cleaan/README.md](https://github.com/berur874/Kanairo-cleaan/blob/main/README.md)
- Feature: the website's **Materials** page (`/materials`). It lists scrap
  materials in stock at Kanairo-Klean, with prices per kg and a type filter.
  It meets API_NEEDS #2 (material costs) and #3 (filtered access to materials).
- Route: the page calls our `GET /partner/materials?type=`. Our server calls
  Kanairo's `GET /materials` with `Authorization: Bearer <token>`. The token comes
  from `server/.env` (`PARTNER_API_KEY`) and never reaches the browser.

## Part A — Preflight

| Item | Status |
|---|---|
| Partner base URL, server running | _TODO: URL used today, and the time it was confirmed up_ |
| Our token from Kanairo (theirs to us, not our own) | _TODO: received yes/no and when (never paste the token here)_ |
| Contract and README open | v1.1.0, links above |
| Live channel and contacts | _TODO: channel; our contact; their contact_ |
| Check-in slot | _TODO_ |

## Before the lab

The things below happened before the first call. They aren't bugs, but they shaped the integration.

- **Kanairo moved to contract v1.1.0** in response to our questions. Changes:
  - New `POST /collection-locations/{id}/drop-offs` that uses a free-text `source`; `/scrap-logs` is deprecated.
  - A fixed `MaterialType` list: metal, plastic, paper, glass, e-waste.
  - `county` on every location.
  - `unit_price_kes` is per kg.
  - A bad `/materials` filter returns `400`.
  - Only active locations are listed.
  - Server URLs are in the contract.
- **Not done by Kanairo: `location_id` on materials.** One material can be at
  several locations, so a single id doesn't fit. They proposed a
  `?location_id=` filter instead. _TODO: our answer._
- **Auth is `Authorization: Bearer`, not the handout's `X-API-Key`.** We followed
  their README, as the handout says to.
- **Their hosted URL is on ngrok's free plan.** ngrok can answer a first visit
  with an HTML warning page instead of JSON. Our server sends
  `ngrok-skip-browser-warning: true` so that page is skipped.
- **Built against a stand-in while waiting for their token.** `server/partner-standin.js`
  serves the example rows from their README, checks the Bearer token and checks
  the type filter. The plan is to switch `PARTNER_URL` to their real server
  once they send the token.

## Part B — First call outside our app

```bash
curl -i -H "Authorization: Bearer $TOKEN" <PARTNER_URL>/materials
```

_TODO: time; status line; does every item have `material_id`, `name`, `type`,
`quantity_kg` and `unit_price_kes`, with the contract's types? Paste the
response with the token removed._

## Bugs and surprises

One row per bug or surprise. Every row is something that actually happened.

| # | What broke (symptom) | Root cause | Fix | Whose code, and who fixed it |
|---|---|---|---|---|
| 1 | Partner-down message showed, but the "Try again" button under it was invisible | The button used `.btn-secondary`, which is styled white-on-transparent for the dark banner, so on the white card it was white on white | Switched it to `.btn-primary` | Ours, fixed by us (found while testing against the stand-in) |

## Tests on purpose

| Test | What happened |
|---|---|
| Partner stopped (stand-in off) | Page: "Material prices from Kanairo-Klean are unavailable right now." Our server stayed up and still answered `/docs` (200). Terminal: `Kanairo-Klean call failed: ECONNREFUSED`. _TODO: repeat with their real server stopped._ |
| Partner restarted | "Try again" (or a reload) showed the materials again, with no code change. _TODO: repeat with their real server._ |
| Unknown type (`/partner/materials?type=wood`) | Our server answers `400`, listing the five types, and does not call Kanairo (automated test) |
| Wrong token | _TODO: run against their server; expect their 401, our page shows the unavailable message, terminal logs `returned 401`_ |
| Field-shape check | _TODO: our server logs any required Material field that's missing; note whether their real response triggered it_ |

`server/__tests__/partner.test.js` covers the same cases with a fake partner:
- the token is sent as a Bearer token
- each material is mapped to our shape
- a bad type is rejected without a call to Kanairo
- partner down → 502
- partner 401 → 502
- missing settings → 502
- the token is never written to the log

## Part E — Supporting Meditrac (downstream)

_TODO: what Meditrac called, any 401/404/429 seen in our terminal, anything they
reported, and whether it was our bug or a contract ambiguity (and what we changed)._

## Demo checklist

1. Materials page shows live Kanairo data.
2. Kanairo stops → the page shows the unavailable message, and our server keeps running.
3. Kanairo restarts → "Try again" shows the data again.
