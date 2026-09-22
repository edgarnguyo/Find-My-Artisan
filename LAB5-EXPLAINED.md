# Week 5 explained: GET endpoints that match the contract

**The goal of the lab:** `openapi.yaml` is a promise to Meditrac. This week, every GET in it
had to return exactly what it promises: the same field names, the same types, and the right
status codes.

## 1. What was wrong before

The contract and the code described two different APIs:

| Contract said | Code sent |
|---|---|
| `trade: "plumbing"` | `skill: "Plumber"` |
| `county: "Nairobi"` | `location: "Westlands, Nairobi"` |
| `verified: true` | `verified: 1` (MySQL has no true/false type) |
| `phone`, `hourlyRateKes`, `verification{…}` | not stored at all |
| `availableToday` | not stored at all |
| error `{ code, message }` | error `{ error }` |

## 2. Database changes (`server/schema.sql`, bottom of the file)

- **New columns on `artisans`:** `county`, `phone`, `hourly_rate_kes`.
  - Why: the contract promises these fields, and data that isn't stored can't be returned.
  - The file adds each column only if it's missing, so it's still safe to run again.
- **`location` now holds only the area** (`"Embakasi"`, not `"Embakasi, Nairobi"`). The county has its own column, so storing it twice was redundant. `schema.sql` fills `county` from the old text first, then trims `location`. Artisan sign-up asks for the area and picks the county from a list of the 47 counties.
- **New table `verifications`:** one certificate per verified artisan (issuing body, certificate id, expiry date).
  - Why a separate table: only verified artisans have a certificate. That's a separate fact about an artisan, and the contract sends it as a separate object.
- **New table `availability_blocks`:** Week 6 fills it. Week 5 only reads it, to work out `availableToday`.

Apply the changes by running this from `server/`:

```bash
mysql -u root < schema.sql
```

## 3. The mapping step (`server/routes/artisans.js`)

**Mapping** means converting a database row into the shape the contract promises before sending it.

```js
// database row: { skill: 'Plumber', verified: 1, location: 'Embakasi', county: 'Nairobi' }
function toArtisanSummary(row) {
  return {
    trade: TRADES[row.skill],          // 'Plumber' -> 'plumbing'
    area: row.location,                 // 'Embakasi' (added later)
    county: row.county,                 // 'Nairobi'
    verified: Boolean(row.verified),    // 1 -> true
    availableToday: Boolean(row.available_today),
    ...
  };
}
```

Why it matters: Meditrac's code reads `artisan.trade`. If you send `skill`, their code
gets `undefined`, and nothing on your side shows an error.

Two type traps the lab warns about, and the fix used for each:

- **Numbers:** MySQL sends `DECIMAL` values as text (`"900"`). `Number(...)` turns them into a real number.
- **Dates:** `db.js` has `dateStrings: true`, so `expires_on` comes out as `"2027-03-01"` and not as a JavaScript Date.

**`availableToday` is computed, not stored.** The SQL asks whether any block covers the current time:

```sql
NOT EXISTS (SELECT 1 FROM availability_blocks b
            WHERE b.artisan_id = a.id
              AND b.start_at <= UTC_TIMESTAMP() AND b.end_at > UTC_TIMESTAMP())
```

**`busy` (added later) looks ahead 14 days.** A block is listed if it hasn't ended yet and starts within 14 days:

```sql
WHERE artisan_id = ? AND end_at > UTC_TIMESTAMP()
  AND start_at < UTC_TIMESTAMP() + INTERVAL 14 DAY
```

`end_at > now`, not `start_at > now`, so a job already under way is still shown.

## 4. Status codes

| Request | Status | Why |
|---|---|---|
| `GET /artisans` | 200 + list | Success. An empty list is still a 200, because "no matches" isn't an error |
| `GET /artisans?county=Atlantis` | 400 | The contract says an invalid county gets 400 |
| `GET /artisans?availableToday=yes` | 400 | Only `true` / `false` are valid |
| `GET /artisans/1` | 200 + profile | Success |
| `GET /artisans/999` or `/5abc` | 404 | No artisan with that id. `5abc` is checked explicitly because MySQL would read it as `5` |

## 5. Option A: one API at `/artisans`

- `/artisans` now follows the contract exactly. The lab says to send no extra fields, so it has no photos, bios or reviews.
- The website still needs those extras. They moved to a **website-only** route, `/profiles`, which is the old code renamed. Artisan sign-up moved to `POST /profiles` too.
- No route has an `/api` prefix: the contract's router is mounted at `/artisans`, exactly the contract's paths, and the website's routes are `/profiles`, `/clients`, `/login` and `/bookings`. Page addresses can't reuse those names, so the React demo table moved from `/artisans` to `/artisans-table` and the bookings page from `/bookings` to `/my-bookings`.
- Artisan sign-up now asks for a phone number, because the contract marks `phone` as required.

## 6. Verifying: Swagger UI at http://localhost:5001/docs

The server now serves Swagger UI from `openapi.yaml` (packages `swagger-ui-express` and `yaml`).
For each endpoint: click it, then **Try it out** → **Execute**. Compare the response to the schema
further down the same page, field by field.

## 7. Contract changes

Recorded in `CONTRACT_DEVIATIONS.md`, #1–#4:

- ids are integers, not UUIDs;
- the endpoints sit at `/artisans` on `http://localhost:5001`, with no `/api` prefix (#2);
- the `availableToday` description was corrected;
- the examples now use real data.

Tell Meditrac about each of these.
