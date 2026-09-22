# Find My Artisan API: changes since the Week 4 contract

**To:** Meditrac (Team 2)
**From:** Find My Artisan (Team 1)
**Contract version:** 1.2.0 (attached `openapi.yaml`). This replaces 1.0.0 and any 1.1.0 copy Meditrac may have received.

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
   - (Version 1.1.0 briefly used an `/api` prefix. That has been removed.)

## New

3. **`POST /artisans/{id}/reviews`**: Meditrac can now rate an artisan after a job.
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

## Clarifications (no code change needed)

4. **`availableToday`** means "free right now": no job is booked over the current time. As a query parameter it only accepts `true` or `false`; anything else returns 400.
5. **`county`** must be one of Kenya's 47 county names, case-insensitive. An unknown county returns 400.
6. **Every error has the same body**: `{ "code": "...", "message": "..." }`. The codes are `invalid_query`, `invalid_body` and `not_found`.
7. **The examples** in the contract are now real records from Find My Artisan's database.

## Not for Meditrac

The three `/artisans/{id}/availability` endpoints are used only by Find My Artisan's own
artisans. They're in the file so the full API is documented.

Find My Artisan asks Meditrac to confirm receipt and to raise any questions about these changes.
