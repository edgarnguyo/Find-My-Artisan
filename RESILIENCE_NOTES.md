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
| Partner **slow** (10 s), live list loaded earlier | Saved list **with the banner**, after **6.6 s** | `attempt 1 failed (timeout), retrying in 200 ms`, `attempt 2 failed (timeout), retrying in 400 ms`, `call failed: timeout`, `serving materials saved at 2026-11-04T09:08:31.967Z` |
| Partner **slow**, our server just restarted (nothing saved) | "Kanairo-Klean is unavailable right now. Try again later." after **6.6 s**, with a Try again button | the same two retry lines, then `call failed: timeout` |
| Partner **flaky** (503, 503, then OK) | Live list, no banner, after **0.61 s**. The user never saw a failure | `attempt 1 failed (status 503)…`, `attempt 2 failed (status 503)…`, then nothing |
| Partner **erroring** (always 500) | Saved list with the banner, after 0.61 s | two retry lines (`status 500`), then `GET /materials returned 500`, `serving materials saved at …`. Exactly 2 retries, so no loop |
| Partner **stopped** (stand-in killed) | Saved list with the banner, after 0.61 s ([screenshot](evidence/week11/partner-stopped-saved-data.jpg)). After a server restart, the unavailable message ([screenshot](evidence/week11/partner-stopped-nothing-saved.jpg)) | `attempt 1 failed (ECONNREFUSED)…`, `attempt 2 failed (ECONNREFUSED)…`, `call failed: ECONNREFUSED` |
| **Wrong token** (our choice) | Unavailable message after 0.05 s | `Kanairo-Klean GET /materials returned 401`. **One** call, no retries: asking again with a wrong token gets the same 401 |
| Partner back (`ok`) after the failures | Live list again, banner gone, no code changed | nothing |

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
| Timeout | **2000 ms** | Kanairo is hosted on an ngrok tunnel. Five calls to it on 2026-11-04 took **0.59 to 0.70 s** just to come back from ngrok (their app was off, so ngrok answered 404). A real answer will be at least that long. The handout's 1500 ms is for calls that normally take under 0.5 s, and it leaves too little room over 0.7 s. 2000 ms is about 3× a normal call and well under a user's patience for one attempt |
| Retries | **2** | The handout's cap. Covers the flaky case (two failures, then success), and means at most 3 hits on Kanairo per page load |
| Delay | **200 ms, then 400 ms** | Short enough not to be felt. Growing, so a struggling partner gets breathing room |
| Worst case | **3 × 2000 + 200 + 400 = 6600 ms** | Measured as 6.61 s and 6.63 s in the slow drill. That only happens when every attempt times out. A stopped partner (refused connection) or a 5xx gives up in about **0.6 s**, almost all of it the two waits |

Is 6.6 s acceptable? Only just, for a page people browse rather than a checkout.
It beats the 10 s or more they waited before, and they then get prices rather
than an error. When we can time real answers from Kanairo's app, we would like
the timeout lower. If those answers come back in under 0.5 s, 1500 ms brings the
worst case to 5.1 s.

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

## Part E: real-partner drill (still to do)

**Not done yet.** On 2026-11-04 Kanairo's ngrok address answered, but their app
behind it was off (ngrok returned 404 for `/materials`). So the drill with their
real server could not be run. To finish it, agree a 10-minute window with Team 13
and do the following:

1. Point `PARTNER_URL` and `PARTNER_API_KEY` in `server/.env` at their real server
   and token. Load the Materials page and expect live data.
2. Ask them to stop their server. Within 6.6 s, expect the saved list with the
   banner.
3. Ask them to restart it. Reload: live data again, banner gone, no code changed.
4. Watch their terminal: at most 3 hits per page load.
5. Check our own log for Meditrac's bursts of 3 (their retries). Make sure those
   stay under our Week 9 limit.

Record the results in the table above. `PARTNER_URL` must stay pointed at them
afterwards, not at the stand-in.
