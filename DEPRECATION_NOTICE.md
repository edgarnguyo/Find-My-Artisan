# Deprecation notice: Find My Artisan API v1 (reviews)

To: Meditrac (Team 2)    From: Find My Artisan (Team 1)    Date: 2026-11-11

## Summary

v1 of the Find My Artisan API is deprecated. v2 is live now, at `/v2/artisans/...`.
The only difference is that `POST /v2/artisans/{id}/reviews` needs one more field,
`blockId`. v1 will stop working on Tuesday 17 November 2026. Please move before
then.

## What is changing

- `POST /artisans/{id}/reviews` → `POST /v2/artisans/{id}/reviews`, and the body
  needs **`blockId`**: the `id` of the availability block you booked for this job.
  It's the `id` our `POST /artisans/{id}/availability` returned to you.
- The block must belong to the same artisan and must have been booked through the
  API. If it doesn't, or `blockId` is missing, you get `400 invalid_body` with the
  reason.
- The 201 response adds `blockId` to the review. No other field changes.

**Not changing:** every other endpoint and response (`GET /artisans`,
`GET /artisans/{id}`, availability, `PATCH`/`DELETE` of reviews), the error format
`{ "code", "message" }`, your API key, and the rate limit. Every other `/v2/artisans/...`
path answers exactly like v1.

## Why

A review should come from a real job. Right now a review can be posted for any
artisan with no booking behind it. Reviews count towards the `verified` badge that
you use for vetting, so tying each review to a booked job keeps that badge
trustworthy.

## Before and after

v1 `POST /artisans/3/reviews`

    { "author": "Meditrac — Westlands branch", "rating": 5,
      "comment": "Fixed the leaking sink the same afternoon." }

v2 `POST /v2/artisans/3/reviews`

    { "blockId": 41, "author": "Meditrac — Westlands branch", "rating": 5,
      "comment": "Fixed the leaking sink the same afternoon." }

v2 response, `201 Created`

    { "id": 58, "artisanId": 3, "author": "Meditrac — Westlands branch", "rating": 5,
      "comment": "Fixed the leaking sink the same afternoon.",
      "createdAt": "2026-09-22T10:30:00Z", "blockId": 41 }

v2 without `blockId`, `400 Bad Request`

    { "code": "invalid_body",
      "message": "blockId is required in v2: the id of the booked availability block this review is about." }

## How to migrate

1. When you book an artisan's time with `POST /artisans/{id}/availability`, keep the
   `id` from the response with that job.
2. Call `/v2/artisans/...` instead of `/artisans/...`. Same key, same filters.
3. In the review body, add `"blockId": <that id>`.
4. Test it, then tell us, so we can see your calls on `POST /v2/artisans/:id/reviews`
   in our log and `/stats`.

Before changing any code, you can see the new check with:

    curl -X POST -H "X-API-Key: <your-key>" -H "Content-Type: application/json" \
      -d '{"author":"test","rating":5}' https://find-my-artisan.onrender.com/v2/artisans/3/reviews

(It answers `400 blockId is required`.)

## Timeline

- 2026-11-11 (today): v2 is live. v1 still works at `/v1/artisans/...` and at the old
  `/artisans/...`, and every v1 response now carries `Deprecation: true`,
  `Sunset: Tue, 17 Nov 2026 00:00:00 GMT` and `Link: </v2/artisans>; rel="successor-version"`.
- 2026-11-17: the sunset date. v1 keeps answering after it, until our `/stats`
  shows no more v1 calls from you. We'll tell you before we turn it off.

## Questions

Message us any time. We'll reply within _<time>_.

**Please reply once you've read this, so we know it arrived.**
