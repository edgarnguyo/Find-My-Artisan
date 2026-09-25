# Find My Artisan API: changes since the Week 4 contract

**To:** Meditrac (Team 2)
**From:** Find My Artisan (Team 1)
**Contract version:** 2.1.0 (attached `openapi-meditrac.yaml`, the endpoints Meditrac uses). This replaces every earlier copy Meditrac may have received (1.0.0 to 2.0.0).

Find My Artisan has built the API and, in doing so, changed the contract Meditrac
received in Week 4. The changes below are listed in order of how likely they are to
affect Meditrac's code.

## Changes that break code written against version 1.0.0

1. **Artisan ids are whole numbers, not UUIDs.**
   - `id` in both GET responses is an `integer` (e.g. `3`), and `/artisans/{id}` takes an integer.
   - Find My Artisan's database numbers artisans 1, 2, 3…, so a UUID can't be supplied.
2. **The base URL is the server itself, with no prefix.**
   - Local: `http://localhost:5001`.
   - The paths are exactly as written in the contract, e.g. `GET http://localhost:5001/artisans?county=Nairobi`.
3. **`availableToday` is gone, replaced by `busy`.**
   - The `availableToday` field and the `?availableToday=` filter no longer exist.
   - Every artisan, in the list and on the profile, now has `busy`: the times they're booked over the next 14 days, as `{ "start", "end" }` in UTC, earliest first.
   - **Any time not listed is free.** An empty list means they're free for the whole two weeks.

   ```json
   { "id": 3, "name": "Achieng Nyambura", "trade": "plumbing",
     "area": "Embakasi", "county": "Nairobi", "verified": true,
     "busy": [ { "start": "2026-09-24T06:00:00Z", "end": "2026-09-24T10:00:00Z" } ] }
   ```

## New

4. **`POST /artisans/{id}/reviews`**: Meditrac can now rate an artisan after a job.
   - Body: `author` (required string), `rating` (required whole number 1–5), `comment` (optional string, up to 1000 characters).
   - Responses:
     - 201 with the saved review
     - 400 for a missing or invalid field
     - 404 for an unknown artisan
   - The review appears on the artisan's public profile. It's feedback only; no booking is created.

   ```bash
   curl -X POST http://localhost:5001/artisans/3/reviews \
     -H "Content-Type: application/json" \
     -d '{"author":"Meditrac — Westlands branch","rating":5,"comment":"Fixed the sink the same day."}'
   ```
5. **`area` on every artisan**: the part of the county they work in, e.g. `"area": "Embakasi"` with `"county": "Nairobi"`.
   - Use `?county=` to narrow the list, then `area` to pick someone near the pharmacy.
   - There's no `?area=` filter: areas are free text typed by artisans, so exact matching would miss results.

6. **`PATCH` and `DELETE /artisans/{id}/reviews/{reviewId}`**: Meditrac can correct or remove a review it posted.
   - `reviewId` is the `id` returned when the review was created.
   - PATCH: send only the fields being changed (`author`, `rating`, `comment`). `"comment": null` removes the comment. Responses: 200 with the updated review, 400 for no fields or an invalid value, 404 if not found.
   - DELETE: 204 with no body, or 404 if not found.
   - Only reviews created through the API can be changed or removed. The reviews already on Find My Artisan's site return 404.

## Clarifications (no code change needed)

7. **`county`** must be one of Kenya's 47 county names, case-insensitive. An unknown county returns 400.
8. **Every error has the same body**: `{ "code": "...", "message": "..." }`. The codes are `invalid_query`, `invalid_body` and `not_found`.
9. **The examples** in the contract are now real records from Find My Artisan's database.

## Not in this contract

The attached file contains only the endpoints Meditrac uses. Find My Artisan's full API
(`openapi.yaml`) also has three `/artisans/{id}/availability` endpoints, which only Find My
Artisan's own artisans use to record when they're booked.

Find My Artisan asks Meditrac to confirm receipt and to raise any questions about these changes.
