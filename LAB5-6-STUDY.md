# Weeks 5 & 6: study notes

The concepts from the two handouts, in order, each with an example from this project.
The questions at the end of each week check that you understood.

---

# Week 5: API Build I, from contract to running code

## 1. The contract is the test

**Contract:** `openapi.yaml`, the written promise of what each endpoint accepts and returns.

**Why:** Meditrac never sees your code, only your responses. A response that "looks right" but
has a different field name breaks their code while yours keeps working, and nobody notices until
it fails for them.

**Habit:** verify against the file, not against your memory of the file.

## 2. Scope

- **Week 5:** only the GET endpoints in the contract.
- **Week 6:** the writes.

In this project, Week 5 means `GET /artisans` and `GET /artisans/{id}`.

## 3. The mapping step

**Definition:** code between the database and the response that converts a row into the contract's shape.

It's needed because a database row almost never matches the contract. Typical differences:

| Problem | Example here | Fix |
|---|---|---|
| Different name | `skill` vs `trade` | Rename in the mapper |
| Different value format | `"Plumber"` vs `"plumbing"` | Look it up in a table (`TRADES`) |
| Wrong type | `verified: 1` vs `true` | `Boolean(row.verified)` |
| Number sent as text | `"900"` vs `900` | `Number(...)` |
| Date as a raw driver value | a Date object vs `"2027-03-01"` | `dateStrings: true` in `db.js` |
| Extra internal columns | `email`, `password`, `created_at` | Leave them out of the mapper |

```js
// row from MySQL:      { id: 1, skill: 'Electrician', verified: 1, county: 'Nairobi', ... }
// what the API sends:  { id: 1, trade: 'electrical', verified: true, county: 'Nairobi', ... }
```

## 4. Status codes for reads

| Case | Code |
|---|---|
| Found | 200 |
| List with no matches | 200 with `[]`, because an empty list is still a valid answer |
| No item with that id | 404 |
| Bad query value (e.g. `county=Atlantis`) | 400 |

Only returning the success case is the most common gap. Every endpoint has at least two outcomes.

## 5. Verifying (Part C)

Do this for each endpoint as soon as it works, not at the end:

1. Swagger UI → the endpoint → **Try it out** → **Execute**.
2. Put the response next to the schema and check:
   - [ ] every field name is exact (`hourlyRateKes`, not `hourly_rate_kes`)
   - [ ] every type is right (string / number / boolean / date string)
   - [ ] no extra fields
   - [ ] no missing required fields
   - [ ] the status code matches this case

## 6. When code and contract disagree (Part D)

There are two honest options:

- **Fix the code:** the usual answer. The contract was reasonable; the code didn't match it yet.
- **Fix the contract:** only when building showed the contract was wrong. Then record it in `CONTRACT_DEVIATIONS.md` and tell your downstream partner, because they built against the old version.

Example here: ids were UUIDs in the contract but whole numbers in MySQL, and the whole app depends on those numbers. Changing the contract was the smaller, correct change, so it's deviation #1.

"No deviations" is also a valid entry. The file is required either way.

## Week 5 questions

1. Your SQL returns `{ job_success: "96" }` but the contract says `jobSuccess: integer`. Name the two things wrong.
2. `GET /artisans?trade=roofing` matches nobody. 200 or 404? Why?
3. Why is `/artisans/5abc` checked explicitly in our code? (Hint: what does MySQL do with `'5abc'`?)
4. When is changing `openapi.yaml` the right fix, and what must you do right after?

---

# Week 6: API Build II, writes, validation and real state changes

## 1. Why writes are different

- **A bad read** is wrong once. Fix the bug and the next request is fine.
- **A bad write** is saved permanently. A garbage row stays in the table after the bug is fixed.

That's why the order is **validate first, write second**.

## 2. Validation: three checks, in order

For each write endpoint, take the checklist from the contract's `requestBody`:

1. **Present?** Are the required fields there?
2. **Right type?** A number where the contract says string isn't close enough.
3. **Usable?** Present and the right type can still be invalid: an empty string, a date that doesn't exist, `end` before `start`.

If any check fails, send **400** with a clear message and **stop** (`return`). Nothing is written.

```js
if (start === undefined || end === undefined) {
  return sendError(res, 400, 'invalid_body', 'start and end are required.');
}
```

## 3. Status codes for writes

| Outcome | Code |
|---|---|
| POST created something | 201 Created |
| PUT / PATCH updated it | 200 OK |
| DELETE removed it | 204 No Content (no body) |
| Input failed validation | 400 Bad Request |
| Update/delete an id that doesn't exist | 404 Not Found |

Express sends 200 unless you set the code, so set it explicitly on every route.

## 4. Check it exists before changing it

An `UPDATE ... WHERE id = 999` that matches no rows doesn't raise an error; it just changes nothing.
If you don't check first, you return 200 for an update that never happened.
The same applies to DELETE.

In our code, `findBlock(artisanId, blockId)` runs first and returns 404 if there's no match.
It also checks that the block belongs to that artisan.

## 5. The POST response uses the mapping step too

The new record goes back to the caller in the contract's shape, the same as in Week 5.
Here, `toBlock()` turns `start_at` / `created_at` into `start` / `createdAt` in `...Z` format.

## 6. Idempotency (from Week 3)

**Definition:** a request is idempotent if sending it twice leaves the same end state as sending it once.

| Verb | Idempotent? | Here |
|---|---|---|
| GET | Yes | Reads never change anything |
| PUT / PATCH | Should be | PATCH `{"end":"13:00"}` sets end to 13:00. Sending it twice gives the same block |
| DELETE | Yes (end state) | First call 204, second 404; either way, the block is gone |
| POST | No | Two POSTs would make two blocks. Ours rejects the second one as an overlap |

A PATCH/PUT must set an absolute value ("end is 13:00"), never a relative one ("add an hour").

## 7. Testing with bad input (Part D)

An endpoint only tested with correct input has been demonstrated, not verified. For each write:

1. **Valid request:** check the status, then **re-fetch with GET** to confirm the data really changed.
2. **Invalid request on purpose:** missing field, wrong type, nonexistent id. Expect 400/404, never a silent 200.

Also check:

- [ ] nothing partial or garbage is saved after a rejected request (we counted rows: 0)
- [ ] the same PATCH twice gives the same state

The full table of tests we ran is in `LAB6-EXPLAINED.md`, section 6.

## 8. Handout's common problems → where our code handles each

| Problem | In our code |
|---|---|
| Everything returns 200 | `res.status(201)`, `res.status(204)` set explicitly |
| PUT on a missing id creates a record | `findBlock` → 404 before any `UPDATE` |
| DELETE says success but the row remains | `DELETE ... WHERE id = ?` uses the id `findBlock` returned; tested by re-fetching |
| Same PUT twice gives different results | PATCH sets absolute times |
| Validation copy-pasted into each route | Partly shared (`isDateTime`, `sendError`); fine for this week's scope |

## Week 6 questions

1. Why must the 400 check use `return`? What happens without it?
2. PATCH `/artisans/4/availability/1` where block 1 belongs to artisan 3: what code, and why?
3. `"2026-02-30T09:00:00Z"`: which of the three checks catches it, and why doesn't `Date.parse` alone?
4. Is "DELETE twice → 204 then 404" a violation of idempotency? Explain.
5. After a successful POST, what request proves the write really happened?

---

## Answers

**Week 5**

1. The name is wrong (snake_case instead of camelCase), and the type is wrong (text instead of a number).
2. 200 with `[]`. The request was valid and nothing matched. 404 means the thing at that URL doesn't exist.
3. MySQL converts `'5abc'` to `5`, so it would return artisan 5 for a nonsense id.
4. When the contract itself was wrong, not just built differently. Right after, record it in `CONTRACT_DEVIATIONS.md` and tell your downstream partner.

**Week 6**

1. Without `return`, the code keeps running and writes the bad data anyway. Express would also try to send a second response and throw an error.
2. 404. That block doesn't exist for artisan 4, and a caller must not be able to change another artisan's blocks through the wrong URL.
3. Check 3 (usable). `Date.parse` quietly rolls it over to 2 March, so the day has to be checked separately.
4. No. Idempotency is about the end state (no block), not the response code.
5. A GET, e.g. `GET /artisans/3`, whose `busy` list now includes the new block's start and end.
