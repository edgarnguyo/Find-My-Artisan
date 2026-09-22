# Contract deviations

Changes made to `openapi.yaml` after it was handed to Meditrac (Team 2), and why.
Meditrac has to be told about each one directly.

## Week 5: GET endpoints

| # | What changed | Why the original didn't hold up |
|---|---|---|
| 1 | Artisan `id` (and every `{id}` path parameter) changed from `string` / `uuid` to `integer`. | Our database gives artisans whole-number ids (1, 2, 3…) with `AUTO_INCREMENT`, and the website, bookings and reviews all point at those numbers. Switching every table to UUIDs would be a rewrite for no gain to Meditrac, since an id only has to be unique. |
| 2 | `servers` now lists `http://localhost:5001/api` first, and every URL has the `/api` prefix. | The same Express server also hosts the website, so the API sits under `/api` to keep it apart from page addresses like `/artisans`. The local entry also lets Swagger UI's "Try it out" reach the running server. |
| 3 | The `availableToday` query parameter's description now says "free right now" and that it must be `true` or `false`. | The old wording ("marked themselves available") contradicted the schema, which already said the value is computed from availability blocks. Values other than `true`/`false` now get a 400. |
| 4 | Example values replaced with real rows from our database (e.g. id 1, Wanjiru Kamau, electrical). | The Week 4 handout asks for real data, and the old examples (Samuel Kariuki, refrigeration) don't exist in our database. |

Not a contract change, but worth knowing: artisans who sign up on the website
must now enter a phone number, because the contract marks `phone` as required.

## Week 6: write endpoints

See below once Week 6 is done.
