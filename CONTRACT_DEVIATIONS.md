# Contract deviations

Changes made to `openapi.yaml` after it was handed to Meditrac (Team 2), and why.
Meditrac has to be told about each one directly.

## Week 5: GET endpoints

| # | What changed | Why the original didn't hold up |
|---|---|---|
| 1 | Artisan `id` (and every `{id}` path parameter) changed from `string` / `uuid` to `integer`. | Our database gives artisans whole-number ids (1, 2, 3…) with `AUTO_INCREMENT`, and the website, bookings and reviews all point at those numbers. Switching every table to UUIDs would be a rewrite for no gain to Meditrac, since an id only has to be unique. |
| 2 | `servers` now lists `http://localhost:5001` first, so the endpoints are at `http://localhost:5001/artisans`, and so on. `info.version` is 1.2.0. | Find My Artisan first put the API under `/api` (version 1.1.0) to keep it apart from the website's page addresses. The team then decided the contract's own paths should be the real URLs, with no extra prefix. No route on the server uses `/api` any more; the website's pages at `/artisans` and `/bookings` moved to `/artisans-table` and `/my-bookings`. Only the base URL changed; every path in the file is the same. The local entry also lets Swagger UI's "Try it out" reach the running server. |
| 3 | The `availableToday` query parameter's description now says "free right now" and that it must be `true` or `false`. | The old wording ("marked themselves available") contradicted the schema, which already said the value is computed from availability blocks. Values other than `true`/`false` now get a 400. |
| 4 | Example values replaced with real rows from our database (e.g. id 1, Wanjiru Kamau, electrical). | The Week 4 handout asks for real data, and the old examples (Samuel Kariuki, refrigeration) don't exist in our database. |

Not a contract change, but worth knowing: artisans who sign up on the website
must now enter a phone number, because the contract marks `phone` as required.

## Week 6: write endpoints

| # | What changed | Why the original didn't hold up |
|---|---|---|
| 5 | `blockId` and the block's `id` / `artisanId` changed from `uuid` to `integer`. | Same reason as #1: MySQL `AUTO_INCREMENT` ids. |
| 6 | POST `/artisans/{id}/availability` gained a `404` response. | The contract only listed 201 and 400, but a block for an artisan who doesn't exist can't be created. Returning 400 would say the body was wrong when it's the id. |
| 7 | PATCH `/artisans/{id}/availability/{blockId}` gained a `400` response. | The contract only listed 200 and 404, but a PATCH can send a bad date, an empty body, or move `end` before `start`. Those have to be rejected. |
| 8 | `info.description` no longer says "this contract has no write endpoints". | It contradicted the three write endpoints in the same file. Meditrac's side is still read-only; the writes are for our artisans. |
| 9 | New endpoint `POST /artisans/{id}/reviews` (201 / 400 / 404) with schemas `ReviewCreate` and `Review`. `info.version` raised to 1.1.0. | Find My Artisan found that the contract gave Meditrac no way to report back on an artisan after a job, which left vetting (need #3) with no data from real jobs. The new endpoint is an addition, so nothing Meditrac already built against stops working. |

Not a contract change: a body that isn't valid JSON now gets the contract's
`{ code, message }` error with 400, instead of Express's HTML error page.
