# Security Audit — Week 9

Find My Artisan (Team 1). Audited 27 October 2026.

This server answers two kinds of request:

- **The partner API**: the `/artisans` routes in `openapi.yaml`. Meditrac
  (Team 2, our downstream partner) calls these from their server.
- **The website's own routes**: `/profiles`, `/clients`, `/login`, `/bookings`,
  `/stats`, `/partner`. Only our React site calls these, from the browser.

The Week 9 work (API keys, rate limit) covers the partner API. The audit below
covers both, because they run in the same server and share the same database.

## 1. Keys (Part A and B)

### Who gets a key

| Consumer | Where the key lives | Why |
|---|---|---|
| `meditrac` | Render's environment (`API_KEYS`), and our local `server/.env` for testing their integration | Our only downstream partner |
| `local` | `server/.env` on each teammate's computer (`local-dev-key`, the value in `.env.example`) | Running the server locally. It is public, so it is **never** set on Render |
| `jest` | Set by `server/jest.setup.js` for the test run only | Tests never need a real partner's key |

Each consumer has its own key, in the form `API_KEYS=name:key,name:key`. The
name shows in the log and is the rate limit's bucket, so one key can be removed
without breaking the others. Meditrac's key (48 random hex characters, from
`npm run key:new`) goes to them only by direct message, never in the class
channel or the repository.

### The rule

Every `/artisans` route needs a valid `X-API-Key`, GETs included. No key or an
unknown key gets `401 {"code":"unauthorized", ...}` and the route never runs.
Keys are compared with `crypto.timingSafeEqual` on SHA-256 hashes, so the time
a wrong guess takes doesn't reveal how much of it was right.

What is left open, and why:

- **`/docs`** (Swagger UI): it only shows `openapi.yaml`, which is already
  public in the repository. "Try it out" still needs a key.
- **Browser preflights** (`OPTIONS`): a browser sends these before the real
  request and never puts a custom header on them, so `cors()` answers them before
  the key check. They return CORS headers only, never data.
- **The website's routes**: they can't use an API key. Any key in the React
  code is readable by anyone who opens the browser's developer tools, so it
  would protect nothing. These routes need user sign-in instead (see finding 6).

### Proof

Local server with the limit lowered to 3 a minute and a throwaway key
(`PORT=5098 RATE_LIMIT_PER_MINUTE=3 API_KEYS=demo:<random key> node index.js`):

```text
$ curl -i http://localhost:5098/artisans                           # no key
HTTP/1.1 401 Unauthorized
{"code":"unauthorized","message":"Send your API key in the X-API-Key header."}

$ curl -i -H "X-API-Key: wrong" http://localhost:5098/artisans
HTTP/1.1 401 Unauthorized
{"code":"unauthorized","message":"That API key is not valid."}

$ for i in 1 2 3 4 5; do curl -s -o /dev/null -w "%{http_code} " -H "X-API-Key: <demo key>" http://localhost:5098/artisans; done
200 200 200 429 429

$ curl -i -H "X-API-Key: <demo key>" http://localhost:5098/artisans   # 6th request
HTTP/1.1 429 Too Many Requests
RateLimit-Limit: 3
RateLimit-Remaining: 0
Retry-After: 57
Content-Type: application/json; charset=utf-8
{"code":"rate_limited","message":"Too many requests: the limit is 3 a minute. Try again in 57 seconds."}
```

The server's log for the same requests names the caller but never the key:

```text
[api] API keys loaded for: demo (48 characters)
[api] 401 no key: GET /artisans
[api] 401 unknown key: GET /artisans
[api] demo GET /artisans → 200
[api] demo GET /artisans → 200
[api] demo GET /artisans → 200
[api] 429 demo: GET /artisans
[api] 429 demo: GET /artisans
```

## 2. Rate limit (Part C)

**60 requests a minute per key**, set by `RATE_LIMIT_PER_MINUTE` (60 if unset).

Why 60, not the handout's 100: Meditrac's needs (API_NEEDS.md) are all "per
page load". One page load of theirs makes one or two calls to us (the artisan
list, then one profile). 60 a minute is one call a second, sustained, which is
far above what a person clicking through their pages produces, but a loop with
a bug in it hits the limit within a minute and stops. Our database is a free
hosted plan, and `GET /artisans` reads every artisan plus their busy times, so a
lower ceiling protects it more than it costs Meditrac. If they need more, it is
one environment variable to change for everyone.

Limits of this limiter: the counts live in the server's memory, so they reset
when Render restarts the server, and they would be wrong if we ran two copies.
We run one copy, so this is fine for now. A shared store such as Redis fixes
both.

## 3. Self-audit (Part D)

Each check, what I looked at, and what I found. "Fixed" items are in this
week's commit and have a test.

### Partner API (`/artisans`)

| # | Check | What I looked at | Found | Result |
|---|---|---|---|---|
| 1 | Sensitive fields | `toArtisanSummary`, `toArtisan`, `toBlock`, `toReview` in `routes/artisans.js`; the SQL in `SELECT_ARTISANS` | Every response is built from a named list of fields; no handler does `res.json(row)`. `email` and `password` are never selected. A full profile has `phone` and `hourlyRateKes`: the contract promises them, and Meditrac needs the phone number to arrange a job | Nothing wrong. New test checks a full profile has no `email` or `password` |
| 2 | Other people's data: busy blocks | `findBlock`, used by PATCH and DELETE `/artisans/:id/availability/:blockId` | **Problem.** It found any block of that artisan, including the ones made when the artisan accepts a client's booking. A key holder could free a booked job's time by deleting block ids one by one, and the website's `/profiles/:id/availability/:blockId` (same code, no key) let anyone do it. The website's dashboard hides the delete button on those blocks, but the server never checked | **Fixed**: `findBlock` now only finds blocks with no `booking_id`; a booked block answers `404`, as if it weren't there. Test: `bookings.test.js`, "won't let a booked block be moved or deleted by its id" |
| 3 | Other people's data: reviews | `findApiReview` | Website reviews (`from_api = FALSE`) can't be edited or deleted through the API, which is right. But any key holder can PATCH or DELETE any review posted through the API, not just the ones that key posted. Today Meditrac is the only key on Render, so every API review is theirs | **Not fixed yet.** Before a second partner gets a key, add an `api_consumer` column to `reviews`, fill it from `req.consumer` on POST, and match it in `findApiReview`. It needs a schema change on the hosted database, so it waits for the team |
| 4 | Error messages | Every `catch` block; `app.js`'s error handlers; a 200 kB body sent to POST `/artisans/1/reviews` | Route errors send fixed text (`"Failed to create review."`); the real error only goes to the server log. **Problem:** a body over Express's 100 kB limit skipped our handler. Locally it answered with an HTML page holding the full stack trace and this computer's file paths (`/Users/.../node_modules/raw-body/index.js:163`). On Render (production mode) it was HTML saying "Payload Too Large", with no trace, but still not our `Error` shape | **Fixed**: a last error handler in `app.js` answers every remaining error as JSON with fixed text: `413 {"code":"body_too_large", ...}`, and `500 {"code":"server_error", ...}` for anything unexpected. It never sends `err.message`. Test: `apiKey.test.js`, "answers a body over 100 kB with JSON, not a stack trace" |
| 5 | Extra fields on writes | POST/PATCH reviews, POST/PATCH availability | Each handler destructures only its own fields (`{ author, rating, comment }`, `{ start, end }`). `id`, `artisanId` (from the URL), `from_api` (always `TRUE`) and `createdAt` (server clock) can't be set from the body. All SQL uses `?` placeholders | Nothing wrong |
| 6 | Keys in the wrong place | `git log --all -p` searched for `API_KEYS=`, `PARTNER_API_KEY=` and `DB_PASSWORD=`; files ever added named `.env`; `.gitignore`; README; server logs | History only has placeholders (`<long random key>`, `local-dev-key`, `replace-with-the-token-kanairo-sent-us`, empty `DB_PASSWORD=`). No `.env` was ever committed; `server/.gitignore` ignores it. README uses `$API_KEY` and `<your-api-key>`. `render.yaml` marks every secret `sync: false`. The log prints names and key lengths, never keys, and a test checks that | Nothing wrong |

### The website's routes

These aren't part of the Week 9 partner API, but they return data from the same
database, so I read them the same way.

| # | Check | Found | Result |
|---|---|---|---|
| 7 | Sensitive fields | `/profiles` selects a fixed column list that leaves out `email` and `password`. `/clients/:id` and `/login` never return the password | Nothing wrong |
| 8 | Other people's data | **Problem.** The site has no sign-in session. `/login` returns the account's id, the browser keeps it, and later requests send it back as `clientId` / `artisanId` or in the URL. The server trusts it. So, without signing in, anyone can: read any client's name, email and phone (`GET /clients/:id`); list any client's or artisan's bookings with contact details (`GET /bookings?clientId=`); edit any artisan's profile (`PATCH /profiles/:id`); accept, decline or cancel bookings by sending the other person's id. Password change and account deletion are safe: they need the current password | **Not fixed this week.** It needs real sign-in: a session or signed token issued by `/login`, checked on every website route, with the id taken from the session instead of the request. That changes every website route and the React app, so it is its own piece of work, planned next |
| 9 | Passwords | Stored as typed (plain text) in `clients.password` and `artisans.password` | **Not fixed this week**, same piece of work as 8: hash with bcrypt on sign-up and password change, compare with `bcrypt.compare` on sign-in |
| 10 | Rate limit | `/login` and sign-up have no limit, so passwords can be guessed without end | **Not fixed this week.** Part of 8: a per-IP limit on `/login` |
| 11 | Extra fields on writes | `PATCH /profiles/:id` only takes the keys listed in `EDITABLE`; `PATCH /clients/:id` only `name`, `phone`, `location`; the column name never comes from the request | Nothing wrong |

## 4. Tests (Part E)

New tests this week, on top of the Week 7 suite:

- `apiKey.test.js`: no key → `401`; wrong key → `401`; a write with no key →
  `401` before the body is read; **a valid key → `200` with the artisan list**;
  a full profile has no `email` or `password`; a 200 kB body → `413` JSON with
  no stack trace; `429` with `Retry-After` after the limit, counted per key; the
  log never contains a key.
- `bookings.test.js`: a booked block can't be changed or deleted through
  `/artisans` or `/profiles` (`404`, block unchanged).

The whole suite passes (see the commit).
