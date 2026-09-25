# Week 6 explained: write endpoints with validation

**The goal of the lab:** a bad write stays in the database. So you validate first and write
second, and you prove it by sending bad input on purpose.

The three write endpoints are all in `server/routes/artisans.js`, under the "Week 6" comment.
All three are artisan-only; Meditrac never calls them.

| Endpoint | What it does | Success |
|---|---|---|
| `POST /artisans/{id}/availability` | Artisan agreed a job by phone: mark them busy from `start` to `end` | 201 + the new block |
| `PATCH /artisans/{id}/availability/{blockId}` | The job's time moved: change `start` and/or `end` | 200 + the updated block |
| `DELETE /artisans/{id}/availability/{blockId}` | The job fell through: remove the block | 204, no body |

## 1. Validate first

Every handler checks in this order and stops at the first failure. Nothing reaches the database until all the checks pass.

1. **Present?** `start` and `end` are required on POST. PATCH needs at least one of them.
2. **Right type?** Each must be a string in date-time format, e.g. `"2026-09-14T09:00:00Z"`.
   - It must include a time zone (`Z` or `+03:00`). Without one, `09:00` could mean two different times.
   - `isDateTime()` also rejects dates that don't exist. JavaScript quietly turns `2026-02-30` into 2 March, so the function checks the day itself.
3. **Usable?** `end` must be after `start`, and the window can't overlap another block for the same artisan.

```js
if (start === undefined || end === undefined) {
  return sendError(res, 400, 'invalid_body', 'start and end are required.');
}
```

The `return` is what matters here: it sends the 400 and leaves the handler, so the `INSERT` below never runs.

**Overlap check.** Two windows overlap when each one starts before the other ends:

```sql
WHERE artisan_id = ? AND start_at < :newEnd AND end_at > :newStart
```

## 2. Check that the thing exists (404)

- **POST:** the artisan must exist.
- **PATCH / DELETE:** the block must exist and belong to that artisan (`WHERE id = ? AND artisan_id = ?`).
  - So `PATCH /artisans/4/availability/1` gets a 404 when block 1 belongs to artisan 3.
- Why check first: without it, an `UPDATE` that matches no rows still "succeeds", and you'd send 200 for nothing. The handout calls this a silent success.

## 3. Idempotency (Week 3 rule)

**Idempotent** means sending the same request twice leaves the same end state as sending it once.

- **PATCH sets absolute values.** `{"end": "…13:00Z"}` sets end to 13:00; it doesn't add an hour. Sending it twice gives the same block (tested: same response both times).
- **DELETE:** the first call returns 204; the second returns 404 because the block is gone. The end state is the same: no block.
- **POST isn't idempotent.** Sending it twice would create two blocks. Here the second call gets a 400 instead, because it overlaps the first.

## 4. Times and time zones

MySQL `DATETIME` has no time zone, so every time is converted to UTC before it's saved:

```js
toDbTime('2026-10-01T09:00:00+03:00')   // '2026-10-01 06:00:00'
fromDbTime('2026-10-01 06:00:00')       // '2026-10-01T06:00:00Z'  (contract format)
```

This is also why the `busy` query compares against `UTC_TIMESTAMP()` and not `NOW()`.

## 5. Bad JSON

If someone sends `not json`, `express.json()` fails before your route runs. The error
handler at the bottom of `server/index.js` turns that into the contract's
`{ "code": "invalid_body", ... }` with status 400, instead of an HTML error page.

## 6. Tests run (Part D: good input and bad input)

| Request | Expected | Got |
|---|---|---|
| POST missing `end` | 400 | 400 |
| POST `start: 123` (wrong type) | 400 | 400 |
| POST `"2026-10-01 09:00"` (no T, no zone) | 400 | 400 |
| POST 30 February | 400 | 400 |
| POST end before start | 400 | 400 |
| POST artisan 999 | 404 | 404 |
| POST body `not json` | 400 | 400 |
| Rows in the table after all the bad requests | 0 | 0 |
| POST valid window | 201, then `GET /artisans/3` lists it in `busy` | ✓ |
| POST the same window again | 400 overlap | 400 |
| PATCH `{}` | 400 | 400 |
| PATCH end moved before start | 400 | 400 |
| PATCH block 999 / someone else's block | 404 | 404 |
| PATCH valid, sent twice | 200, same result both times | ✓ |
| DELETE, then DELETE again | 204, then 404 | ✓, and it disappeared from `busy` |

## 7. Contract changes

Recorded in `CONTRACT_DEVIATIONS.md`, #4–#5:

- block ids are integers (#4);
- POST gained a 404 and PATCH gained a 400 (#5).

The "no write endpoints" sentence in the description was removed with the reviews endpoint (#6).

---

## 8. Addition: `POST /artisans/{id}/reviews` (the write Meditrac uses)

**Why it was added:** the three availability writes are for your artisans only. This gives
Meditrac a write of its own that fits the "consume, don't interconnect" feedback: it's
feedback about an artisan, not a booking.

**Validation, in the same three steps:**

1. **Present?** `author` and `rating` are required.
2. **Right type?**
   - `author` must be a string.
   - `rating` must be a whole number. `Number.isInteger("5")` is `false`, so the string `"5"` is rejected, and so is `4.5`.
   - `comment`, if sent, must be a string.
3. **Usable?**
   - `author` can't be only spaces, and is at most 100 characters (the column is `VARCHAR(100)`).
   - `rating` must be from 1 to 5.
   - `comment` is at most 1000 characters.

After validation, the artisan must exist (404). Then the review is saved and returned with 201.

| Request | Expected | Got |
|---|---|---|
| Missing `author` | 400 | 400 |
| `author: "   "` | 400 | 400 |
| `rating: "5"` / `4.5` / `6` | 400 | 400 |
| `comment: 42` | 400 | 400 |
| Artisan 999 | 404 | 404 |
| Rows added after the bad requests | 0 | 0 |
| Valid, with and without a comment | 201 (comment `null` when left out) | ✓, and the review shows on `/profiles/3` |

It's recorded in `CONTRACT_DEVIATIONS.md` as #6. Meditrac gets `CHANGES_FOR_MEDITRAC.md` with the new `openapi.yaml`.

---

## 9. Addition: PATCH and DELETE for reviews

| Endpoint | What it does | Success |
|---|---|---|
| `PATCH /artisans/{id}/reviews/{reviewId}` | Change any of `author`, `rating`, `comment`; `"comment": null` clears the comment | 200 + the updated review |
| `DELETE /artisans/{id}/reviews/{reviewId}` | Remove the review | 204, no body |

**Validation is shared with POST.** `reviewProblem()` holds the checks once. POST calls it
normally (author and rating required); PATCH calls it with `partial = true`, so fields may be
left out, but not all of them.

**The existence check has one extra condition.** `findApiReview()` looks for the review with
`WHERE id = ? AND artisan_id = ? AND from_api = TRUE`:

- `artisan_id = ?`: a review can only be reached through its own artisan's URL.
- `from_api = TRUE`: only reviews posted through the API. The sample reviews that come with the
  site have `from_api = FALSE`, so they return 404 and can't be changed or removed from outside.
  (There's no login, so this is the only way to protect them.)

`schema.sql` adds the `from_api` column, and its reset of the sample reviews now skips
`from_api = TRUE` rows, so re-running it doesn't wipe Meditrac's reviews.

**Idempotency:** PATCH sets values rather than adding to them, so the same PATCH twice gives the
same review. DELETE twice gives 204 then 404, with the same end state: no review.

| Request | Expected | Got |
|---|---|---|
| PATCH `{}` | 400 | 400 |
| PATCH `rating: "4"` / `0` | 400 | 400 |
| PATCH `author: "  "` | 400 | 400 |
| PATCH `comment: 42` | 400 | 400 |
| PATCH body `not json` | 400 | 400 |
| PATCH review 999999 | 404 | 404 |
| PATCH a review through another artisan's URL | 404 | 404 |
| PATCH a sample review (`from_api = FALSE`) | 404 | 404 |
| PATCH `rating: 4`, sent twice | 200, same result both times | ✓ |
| PATCH `comment: null` | 200, comment is `null` | ✓ |
| DELETE a sample review / wrong artisan / `abc` | 404 | 404, and the sample review is still there |
| DELETE, then DELETE again | 204, then 404 | ✓ |
| Review count before and after all the tests | unchanged | 29 / 29 |
