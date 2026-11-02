# Week 12 local evidence

These are measurements from real HTTP requests to the modified Express app on
an isolated local seeded MariaDB database, on 2 November 2026. They are not
deployed-server measurements or actual ring-partner traffic.

- `request-sample.jsonl`: all 343 completed-request records from the run.
- `traffic-summary.json`: the two 60-request runs, a 200-request burst, privacy
  scan result and scope of the controlled upstream failure.
- `stats-after-mixed.json`: baseline after probes, homepage checks and mixed traffic.
- `stats-after-burst.json`: after deliberate rate-limit traffic.
- `stats-after-controlled-failure.json`: after one deliberate 502 with upstream
  settings unset. The actual upstream partner was never called.

Each stats snapshot excludes the `/stats` request currently being answered.
The log therefore has one more record than the final snapshot's `total`.
Fingerprints identify ephemeral local keys without containing their values.
The keys and privacy markers were checked against the raw recording with zero
matches before this evidence was saved. Raw `.log` files remain ignored.

Predictions, interpretation, limits, alert design and the outstanding actual
partner run are documented in [MONITORING_NOTES.md](../../MONITORING_NOTES.md).
