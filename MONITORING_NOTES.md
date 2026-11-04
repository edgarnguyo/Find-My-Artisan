# Week 12: monitoring Find My Artisan

## Predictions recorded before generating traffic

1. `GET /artisans` will be the slowest read endpoint on average. It reads a
   list of artisans and their availability rather than one profile. The public
   homepage's `GET /site-stats` may also be expensive because it aggregates
   several tables.
2. `GET /artisans/:id` will produce the most client errors in the planned mix,
   because it deliberately includes a missing ID. Requests without a key will
   be rejected before reaching a route and appear under `GET (no route)`.
   These are 4xx client errors, not evidence of server failure.

## Measurement setup and evidence

Measured on 2 November 2026, 12:52:57-12:53:08 EAT (09:52:57-09:53:08 UTC).
The real Express app served HTTP requests on localhost using an isolated
MariaDB 10.4 database populated from `server/schema.sql`, and a built React
website. No deployed data or real upstream partner was used. Predictions above
were written before this run.

There were three phases, recorded under `evidence/week12/`:

1. Probes of valid, wrong and absent keys, a query containing privacy markers,
   malformed JSON containing a password marker, a CORS preflight, the homepage,
   ten public homepage-stat requests, then two runs of 60 random requests each.
   The second run used a different local key to simulate a second caller.
2. A 200-request burst with the original key, without the usual 50 ms pause.
3. One deliberately induced upstream-unavailable response: `/partner/materials`
   with partner settings unset. No request was sent to the actual partner.

`traffic-summary.json` contains the script summaries. `request-sample.jsonl`
contains all 343 completed-request JSON records, including 200, 401, 404, 429
and the controlled 502. The three `stats-*.json` files preserve the snapshots.
The full `server/requests.log` recording is ignored by Git.

## Predictions versus observed figures

The first snapshot, before the burst or injected failure, showed **139 completed
requests, 63 client errors, no server errors, 0% server error rate and 1.8 ms
overall average**. It excludes the `/stats` call being answered.

| Route label in the snapshot | Count | 4xx | 5xx | Average ms | Maximum ms |
|---|---:|---:|---:|---:|---:|
| `GET /artisans/` | 47 | 0 | 0 | 2.7 | 26.4 |
| `GET /artisans/:id` | 37 | 20 | 0 | 1.7 | 2.7 |
| `GET /site-stats/` | 10 | 0 | 0 | 1.8 | 3.1 |
| `GET (no route)` | 43 | 42 | 0 | 0.9 | 6.8 |
| `POST (no route)` | 1 | 1 | 0 | 4.1 | 4.1 |
| `OPTIONS (no route)` | 1 | 0 | 0 | 0.6 | 0.6 |

The trailing slash in `/artisans/` and `/site-stats/` comes from a mounted
router's root pattern; different artisan IDs still share `/artisans/:id`.

The list endpoint prediction was supported among the successful read endpoints:
`GET /artisans/` averaged 2.7 ms versus 1.7 ms for individual profiles and 1.8 ms
for homepage figures. Its 26.4 ms maximum was much slower than its mean.
The single malformed-body POST averaged 4.1 ms, so it was technically the slowest
row overall, but a sample of one rejected request cannot establish a general
endpoint-performance pattern.

The missing-ID prediction was supported among requests that reached a route:
20 of 37 `/artisans/:id` requests were 404s, about **54.1%**. However, early
rejections/unmatched paths produced more client errors in aggregate: 42 in
`GET (no route)`. That row also contains one successful homepage response;
`(no route)` means no Express route pattern was available, not necessarily an
error. The 401 probes were deliberate tests, not evidence of malicious probing.

## A real pattern, its possible cause, and the next check

One list request took **26.4 ms** while its 47-request average was **2.7 ms**.
This is consistent with initial connection/pool or cache warm-up, but the data
does not prove the cause. Next I would separate the first request from warmed
requests, compare repeated runs on the same dataset, and time the SQL queries
individually. Then I would increase the dataset to check how list latency scales.
I would not use these localhost measurements as a production latency promise.

The two 60-request scripts returned:

- Owner: **30 x 200, 13 x 401, 17 x 404**.
- Simulated second caller: **32 x 200, 7 x 401, 21 x 404**.

The burst returned **8 x 200, 36 x 401, 3 x 404 and 153 x 429**, with no network
failures. Its key had already spent part of its 60-request allowance. The next
snapshot showed **340 requests, 255 client errors and still 0 server errors**.
This demonstrates why a high client-error count is not the same as server
failure. The observer key could still read stats after the owner was limited.

For the controlled upstream failure, `/partner/materials` returned 502 once.
The final snapshot showed **342 completed requests, 255 client errors, 1 server
error and 0.3% error rate**: `1 / 342 * 100 = 0.292...%`, rounded to one decimal.
The unrounded per-route counts remain available, so a low-volume failure is
still visible even if a percentage rounds down. The log has 343 records because
the final `/stats` request finishes after its own snapshot is constructed.

## Privacy verification

The recording had **zero matches** for all three ephemeral valid keys, the
deliberately wrong key, and the email/password/token privacy markers. Each
request record contained exactly `time`, `method`, `path`, `status`, `ms`,
`caller`, with no query string or body. Verified callers had distinct hashed
fingerprints; missing/invalid keys had `none`. A rate-limited verified caller
kept its fingerprint. `.env` and `requests.log` are ignored.

Raw database exception dumps were also replaced by safe diagnostic codes,
because those exceptions can contain SQL with user-supplied values.

## Production alert and user-facing behavior

Alert the maintainer if `errorRatePercent` stays **above 2% for five minutes**,
and investigate the per-route `serverErrors` plus matching request logs. The
current metric is cumulative since restart, so an external watcher would need
to poll it to establish that duration. For a production five-minute error-rate
alert, I would instead calculate the change in `serverErrors` divided by the
change in `total` over that window, handle restarts via `startedAt`, and require
at least 20 requests so a tiny sample does not dominate.

While someone investigates an upstream failure, the site should continue to
show artisan profiles and existing bookings, explain that material prices are
temporarily unavailable, and allow labour-only quotes. It should not invent
prices or claim that a failed scrap drop-off succeeded. Those degradation paths
already exist; the optional cached-fallback counter is not applicable because
there is no `/upcoming` cache route in this app.

## Ring-partner traffic and publication status

The implementation and local evidence were published to the GitHub
`person-a` branch on 2 November 2026 through VS Code, after all 194 tests and
the website build passed again in the original project folder.

**Still pending:** actual ring-partner traffic after deployment. The user
confirmed that the partner will run the script then. A local second key proves
caller separation but is not a substitute for the partner's run.

After the branch is deployed:

1. Give the partner their own issued key privately. Ask them to run
   `traffic.js` with the deployed `API` URL and `N=60`.
2. Save their status summary and confirm their distinct caller fingerprint in
   server logs. Do not copy their key into this document.
3. Save a fresh `/stats` snapshot and update this reflection with the partner's
   measured figures and any difference from the local findings.
4. Verify that no secrets or raw `.log`/`.env` files are staged, then publish the
   evidence update. The lab is not fully submitted until this step is finished.
