Members: Edgar Nguyo, Cedric Ngari, Ian Mbaya Github: https://github.com/edgarnguyo/Find-My-Artisan.git

|Method|Path|Purpose|Maps to Need|
|---|---|---|---|
|GET|/v1/artisans?trade=plumbing&county=Nairobi|Return a list of artisans, filterable by trade and location|#1 "needs data on our artisans to source artisans in order to carry out blue-collar jobs"|
|GET|/v1/artisans/{id}|Return one artisan's full profile, including trades, rates and verification details|#1 (single-item half) and #3 "needs our API to vet artisans"|
|GET|/v1/artisans/{id}/slots?from=2026-09-01&to=2026-09-07|Return the open booking slots for one artisan over a date range|#4 "needs our API to schedule artisans in order to carry out maintenance jobs"|
|POST|/v1/bookings|Create a booking that reserves one artisan for a job at a stated time and location|#2 "needs our API to book artisans in order to carry out future jobs"|
|GET|/v1/bookings/{id}|Return the current state of one booking (pending, confirmed, declined, completed)|#2 (the consumer needs to read back what it created)|
|PATCH|/v1/bookings/{id}|Change the time or job details of a booking that still stands — not cancellation|#4 (rescheduling a job that has already been placed)|
|DELETE|/v1/bookings/{id}|Cancel a booking, releasing the artisan's reserved slot|#2 (a booking the consumer created must be retractable)|
