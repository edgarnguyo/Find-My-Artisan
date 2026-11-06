# Resilience Notes (Week 11)

Find My Artisan calls one upstream partner, **Kanairo-Klean** (Team 13), from our
server (`server/kanairo.js`). The feature from Week 10 that users see is the
**Materials page** (`/materials` on the website, backed by `GET /partner/materials`).
That page is our version of the handout's `/upcoming` route. The same calls also
feed the artisan's quote form and the scrap drop-off form.

What changed this week:

- **Timeout:** every call to Kanairo gives up after 2000 ms (`AbortSignal.timeout`).
- **Retries:** `server/resilientFetch.js` retries a GET at most 2 times (3 attempts
  in all), waiting 200 ms and then 400 ms between attempts. It retries only after a
  timeout, a failed connection, or a 429/500/502/503/504. A 429's `Retry-After`
  is honoured, up to 5 s. A 400/401/403/404 is never retried. Writes are never
  retried: that covers the drop-off `POST`, which could otherwise report the
  same scrap to Kanairo twice.
- **Fallback:** the Materials route keeps the last good list for each filter in
  memory. When Kanairo can't be reached it answers
  `{ data, stale: true, asOf }`, and the page shows a banner: "Showing saved
  prices from 12:09:47. Kanairo-Klean is not responding, so these may be out of
  date." With nothing saved, the page shows "Kanairo-Klean is unavailable right
  now. Try again later." and a Try again button.
- **Quotes stay live.** The fallback is for browsing only. When an artisan sends
  a quote, our server still prices it from a fresh Kanairo list (`routes/bookings.js`).
  If that fails, the artisan is told to send a labour-only quote. A quote saved
  with an old price would be a promise made on wrong numbers.

## The stand-in

The handout's `flaky-partner.js` serves `/tasks` on port 4000. We already had a
stand-in for Kanairo in this repo (`server/partner-standin.js`, port 5050) with
their real data shape and Bearer-token check. So we added the handout's four
modes to it instead: `curl http://localhost:5050/__mode/slow` (also `ok`,
`flaky`, `error`). Only GETs misbehave, as in the handout.

## Part A: before (Week 10 code, 2026-11-04)

| Test | Result |
|---|---|
| Stand-in, `ok`, called directly (5 calls) | 0.5 to 6 ms |
| Materials route, `ok` (3 loads) | 200 in 1.5 to 36 ms (the first is the slowest) |
| `slow` | **Hung for 10.0 s**, then 200. No timeout, so the page waited as long as the partner did |
| `flaky` (3 loads) | **502, 502, 200**. The page failed 2 loads out of 3, though a second try would have worked |

## Part F1: what we tested after the change

All results are from the stand-in on 2026-11-04, timed with `curl` against our
server on port 5001. The log column is our server's terminal output.

| Failure | What the user saw | What our log said |
|---|---|---|
| Partner normal (`ok`) | Live list, no banner, 1 to 6 ms | nothing |
| Partner **slow** (10 s), live list loaded earlier | Saved list **with the banner**, after **6.6 s** | `attempt 1 failed (timeout), retrying in 200 ms`, `attempt 2 failed (timeout), retrying in 400 ms`, `call failed: timeout` (now `{"level":"error","code":"timeout"}`, see below), `serving materials saved at 2026-11-04T09:08:31.967Z` |
| Partner **slow**, our server just restarted (nothing saved) | "Kanairo-Klean is unavailable right now. Try again later." after **6.6 s**, with a Try again button | the same two retry lines, then `call failed: timeout` |
| Partner **flaky** (503, 503, then OK) | Live list, no banner, after **0.61 s**. The user never saw a failure | `attempt 1 failed (status 503)…`, `attempt 2 failed (status 503)…`, then nothing |
| Partner **erroring** (always 500) | Saved list with the banner, after 0.61 s | two retry lines (`status 500`), then `GET /materials returned 500`, `serving materials saved at …`. Exactly 2 retries, so no loop |
| Partner **stopped** (stand-in killed) | Saved list with the banner, after 0.61 s ([screenshot](evidence/week11/partner-stopped-saved-data.jpg)). After a server restart, the unavailable message ([screenshot](evidence/week11/partner-stopped-nothing-saved.jpg)) | `attempt 1 failed (ECONNREFUSED)…`, `attempt 2 failed (ECONNREFUSED)…`, `call failed: ECONNREFUSED` |
| **Wrong token** (our choice) | Unavailable message after 0.05 s | `Kanairo-Klean GET /materials returned 401`. **One** call, no retries: asking again with a wrong token gets the same 401 |
| Partner back (`ok`) after the failures | Live list again, banner gone, no code changed | nothing |

Since Week 12 merged, the final "call failed" line is a JSON record from
`logError` in `server/monitoring.js`, for example
`{"time":"…","level":"error","code":"ECONNREFUSED"}`. `logError` was extended
so a timeout is recorded as `"code":"timeout"` rather than `internal_error`.
The retry lines are unchanged.

The token never appears in any of these lines. The automated test "never puts
the token in the retry or failure log" checks this.

Automated tests: `server/__tests__/resilience.test.js` (21 tests) covers each rule:

- the timeout fires
- a 503 is retried
- retries stop after 2
- 400/401/403/404 are not retried
- POST/PUT/PATCH/DELETE are not retried
- waits are 200 ms, then 400 ms
- `Retry-After` is honoured, capped at 5 s
- the saved list is served with `stale: true`
- nothing saved gives a 502

`partner.test.js` and `booking-quotes.test.js` still pass (50 tests).

## Part F2: our numbers, and why

| Setting | Value | Why |
|---|---|---|
| Timeout | **2000 ms** | Kanairo is hosted on an ngrok tunnel. Real answers took **0.70 to 1.16 s** in the Part E drill. Before their app was up, ngrok alone took 0.59 to 0.70 s. The handout's 1500 ms is for calls that normally take under 0.5 s, and it would leave only 0.34 s of room over our slowest real answer. 2000 ms is about twice a normal call and well under a user's patience for one attempt |
| Retries | **2** | The handout's cap. Covers the flaky case (two failures, then success), and means at most 3 hits on Kanairo per page load |
| Delay | **200 ms, then 400 ms** | Short enough not to be felt. Growing, so a struggling partner gets breathing room |
| Worst case | **3 × 2000 + 200 + 400 = 6600 ms** | Measured as 6.61 s and 6.63 s in the slow drill. That only happens when every attempt times out. A stopped partner (refused connection) or a 5xx gives up in about **0.6 s**, almost all of it the two waits |

Is 6.6 s acceptable? Only just, for a page people browse rather than a checkout.
It beats the 10 s or more they waited before, and they then get prices rather
than an error. Real answers from Kanairo took up to 1.16 s, so a lower timeout would cut off
normal calls. 2000 ms stays.

## Part F3: what a real user would get without this code

An artisan in Gikomba opens the Materials page to check today's price for HDPE
pipe before quoting a plumbing job. Kanairo's laptop is on a slow connection, so
with the Week 10 code the page shows "Loading materials…" for 10 seconds or
more. Most people would give up and go back to the dashboard before it finished.
If Kanairo is restarting, two loads in three end in "unavailable", so they press
Try again and get errors for something that would have worked on a second try.
Now they get the live prices within a second through a blip. If Kanairo is
really down, they get the last prices with a banner saying how old they are,
which is enough to plan a quote and come back later.

## Part F4: what we did not build

A **circuit breaker** would notice that Kanairo has failed several times in a
row and stop calling it for a while, answering from the saved list straight
away and only trying again now and then. Users would then wait 0.6 to 6.6 s
less during a long outage, and Kanairo would get no traffic while it recovers.
Ours still makes up to 3 attempts on every page load.

Also not built: the saved list lives in memory, so it is lost when our server
restarts (Render restarts it on every deploy and after it sleeps). Collection
yards (`GET /partner/collection-locations`) get the timeout and retries but no
saved copy. If they fail, the drop-off form shows its own unavailable message.

## Part E: real-partner drill

Run against Kanairo-Klean's real server (their ngrok address), with the token
they issued us in `server/.env`. Team 13 stopped and restarted their server
for us when asked.

| Step | When (EAT) | What the user saw | What our log said |
|---|---|---|---|
| Normal | 2026-11-04 20:37 | Live list (6 materials, Aluminium 390 kg, not the stand-in's 430), no banner. 0.30 to 0.71 s through our server ([screenshot](evidence/week11/real-partner-1-live.jpg)) | nothing |
| Partner stopped | 2026-11-05 | Saved list **with the banner**, in **0.52 to 0.63 s** ([screenshot](evidence/week11/real-partner-2-stopped.jpg)) | `Kanairo-Klean GET /materials returned 404`, `the answer was not JSON (status 404)`, `serving materials saved at 2026-11-04T17:37:01.118Z` |
| Partner back | 2026-11-06 11:53 | Live list again, banner gone, no code changed. 0.28 to 0.71 s ([screenshot](evidence/week11/real-partner-3-back.jpg)) | nothing |

Direct calls to their server with our token took **0.70 to 1.16 s** (6 calls
over the drill), so the 2000 ms timeout leaves room for a bad moment.

What the real partner taught us that the stand-in didn't:

- **A stopped partner behind ngrok is not a refused connection.** ngrok answers
  for them with a 404 HTML page (header `ngrok-error-code: ERR_NGROK_3200`,
  "endpoint offline"). A 404 is never retried, so each page load made **one**
  call, not three. Our fallback still worked, and quickly, because a non-JSON
  answer counts as unusable. The cost: during a short restart on their side, we
  don't try a second time. Treating `ERR_NGROK_3200` as retryable would fix that,
  but we left it: during a real outage it would only add load and wait time.
- **The banner hid how old the data was.** The list saved on Nov 4 was still
  being shown on Nov 5 as "saved prices from 20:37:01". With no date, a list
  more than a day old looked like it was from earlier today. Fixed: the banner
  now adds the date when the list isn't from today ("Nov 4, 8:37:01 PM").
- **Hits per page load:** at most 1 while they were down (the 404 is not
  retried), and 1 while they were up. Never a burst, so we stayed well within
  any limit on their side. We didn't see their terminal; this count comes from
  our own log.

Not checked: calls from Meditrac, our downstream partner, to us. Their retries
would show on our hosted server (Render), not on this local drill.

`PARTNER_URL` in `server/.env` now points at Kanairo's real server, not the
stand-in.
