# Deprecation notice: Find My Artisan API v1 (reviews)

To: Meditrac (Team 2)    From: Find My Artisan (Team 1)    Date: 2026-11-11

## Summary

v1 of the Find My Artisan API is deprecated. v2 is live now, at `/v2/artisans/...`.
The only difference: in v2, `POST /v2/artisans/{id}/reviews` only works once the
artisan has logged a finished job for Meditrac. v1 will stop working on Tuesday
24 November 2026. Please move before then.

## What is changing

- `POST /artisans/{id}/reviews` → `POST /v2/artisans/{id}/reviews`.
- In v2 the review is accepted only when the artisan has a **finished job logged for
  Meditrac** on their Find My Artisan dashboard: its end time has passed, or the
  artisan marked it complete. Otherwise you get **`403`** with
  `{ "code": "no_job", "message": "..." }`.
- The request body and the 201 response are the same as v1.

**Not changing:** every other endpoint and response (`GET /artisans`,
`GET /artisans/{id}`, availability, `PATCH`/`DELETE` of your reviews), the request
body, the error format `{ "code", "message" }`, your API key, and the rate limit.
Every other `/v2/artisans/...` path answers exactly like v1.

## Why

A review should come from a real job. Today a review can be posted for any
artisan, with no booking behind it. Reviews count towards the `verified` badge
that you use for vetting, so tying each review to a finished job keeps that badge
trustworthy.

## Before and after

v1 `POST /artisans/3/reviews`, artisan 3 has no job logged for Meditrac

    { "author": "Meditrac — Westlands branch", "rating": 5 }
    → 201 Created

v2 `POST /v2/artisans/3/reviews`, the same request

    { "author": "Meditrac — Westlands branch", "rating": 5 }
    → 403 { "code": "no_job",
            "message": "You can review an artisan once a job with them has finished. Ask the artisan to log the job on Find My Artisan, or to mark it complete there." }

v2, after the artisan logged the job for Meditrac and it finished

    → 201 Created, the same Review as v1:
    { "id": 58, "artisanId": 3, "author": "Meditrac — Westlands branch", "rating": 5,
      "comment": null, "createdAt": "2026-11-11T10:30:00Z" }

## How to migrate

1. Call `/v2/artisans/...` instead of `/artisans/...`. Same key, same body, same filters.
2. Handle `403 no_job` on a review: show your user the message, which says what to
   do. It is not a server fault, so don't retry it.
3. When you book an artisan by phone, ask them to log the job for Meditrac on their
   dashboard, or to mark it complete when the work is done.
4. Test it, then tell us, so we can see your calls on `POST /v2/artisans/:id/reviews`
   in our log and `/stats`.

Before changing any code, you can see the new check with (artisan 3 has no job
logged for Meditrac):

    curl -X POST -H "X-API-Key: <your-key>" -H "Content-Type: application/json" \
      -d '{"author":"test","rating":5}' https://find-my-artisan.onrender.com/v2/artisans/3/reviews

(It answers `403 no_job`, and writes nothing.)

## Timeline

- 2026-11-11 (today): v2 is live. v1 still works at `/v1/artisans/...` and at the old
  `/artisans/...`, and every v1 response now carries `Deprecation: true`,
  `Sunset: Tue, 24 Nov 2026 00:00:00 GMT` and `Link: </v2/artisans>; rel="successor-version"`.
- 2026-11-24: the sunset date. v1 keeps answering after it, until our `/stats`
  shows no more v1 calls from you. We'll tell you before we turn it off.

## Questions

Message us any time. We'll reply within _<time>_.

**Please reply once you've read this, so we know it arrived.**
