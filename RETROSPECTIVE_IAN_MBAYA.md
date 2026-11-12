# Individual Week 14 Retrospective — Ian Mbaya

## 1. My role

I worked mainly on the backend and database for Find My Artisan. The project lets Meditrac discover and vet artisans through an API, while our website and upstream integration use the same application data for artisan profiles, availability and related services.

## 2. What I contributed

My work covered several stages:

- **Planning and design:** I wrote the team charter, endpoint list and initial OpenAPI contract. These helped define what another system needed and clarified that Meditrac should discover artisans and contact them rather than create bookings in our system.
- **Build:** I helped move the early student demo to Express and MySQL, served artisan, review and booking data from the database, implemented GET endpoints, removed the /api prefix to match the contract, represented booked times as a busy list, and added a separate county field.
- **Database and deployment:** I added optional DB_SSL for hosted MySQL, wrote the Week 8 quickstart and docs page, and added hosting configuration. Later work included website sessions, bcrypt password handling and login rate limiting.
- **Integration:** I added the scrap report flow to Kanairo-Klean and saved a copy of each report. I also contributed to preserving partner price data across restarts.
- **Monitor:** In Week 12, I implemented structured request logging and the protected /stats endpoint, documented measurements and privacy checks, and saved local evidence.
- **Test and documentation:** The repository includes endpoint contract tests, monitoring.test.js, a quickstart, OpenAPI docs and MONITORING_NOTES.md. The ownership matrix assigns me the Week 9 login/accounts tests and Week 12 monitoring tests.

The rewritten Git history contains 22 non-merge commits from my account for the lab period, with author ianmbaya-ui <ian.mbaya@strathmore.edu>. Merge commits remain credited to the person who merged them.

## 3. What monitoring showed

I measured the Express application locally against an isolated seeded MariaDB database. The first snapshot had 139 completed requests, 63 client errors, no server errors and a 1.8 ms overall average. A deliberate 200-request burst raised the client error count to 255 while server errors remained at zero. A separate controlled upstream failure generated one 502 and made the 5xx error rate visible.

This helped me distinguish client errors, such as missing keys or missing records, from server failures. The log records request path, method, status, duration and a hashed caller fingerprint without recording keys, query strings or request bodies. /stats summarizes counts and timings for the lifetime of one server process.

These measurements are local evidence, not production performance claims. The second caller was simulated with a second local key, and actual ring-partner traffic was still pending in the monitoring notes.

## 4. What I learned

I learned that a useful API is more than routes connected to a database. It also needs a clear contract, careful mapping between database rows and response fields, validation, authentication, predictable errors and documentation a consumer can follow.

The monitoring work made me more careful about interpreting metrics. A high number of 4xx responses can come from deliberate invalid requests and does not by itself show the server is unhealthy. I also learned to avoid logging secrets or raw database errors, which can expose keys, SQL or user-supplied values.

## 5. What I would improve next

I would collect a real ring-partner traffic run after deployment and compare it with the local measurements. I would also measure repeated warm and cold requests separately, time database queries independently, and check how response times change with a larger dataset.

For production alerting, I would calculate the change in 5xx errors over a time window rather than alert on the lifetime cumulative percentage. I would account for server restarts and require a minimum request volume so one failure in a tiny sample does not dominate the alert.

## 6. Closing reflection

My contribution connected the project’s data model and backend API to another team’s needs, then added evidence about how the service behaves. This work showed me the value of keeping implementation, contract, tests and monitoring notes aligned. In future projects I would validate partner behavior with real traffic before describing an integration as complete.

## Repository evidence

- TEAM_CHARTER.md — team roles and planning
- ENDPOINT_LIST.md and openapi.yaml — API design and contract
- server/app.js and server/routes/artisans.js — Express routes and contract responses
- server/db.js and server/schema.sql — MySQL connection and data schema
- server/monitoring.js and server/monitoring.test.js — request logging, stats and tests
- MONITORING_NOTES.md and evidence/week12/ — setup, measurements, privacy checks and limits
- README.md — quickstart, authentication and API use
