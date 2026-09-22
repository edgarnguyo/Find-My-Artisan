Members: Edgar Nguyo, Cedric Ngari, Ian Mbaya
Github: https://github.com/edgarnguyo/Find-My-Artisan.git
Ring: Team 13 (upstream, materials) → **Team 1 (us, Find My Artisan)** → Team 2 / Meditrac (downstream)

| Method | Path                                                              | Purpose                                                                                             | Maps to Need                                                                                                     |
| ------ | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| GET    | `/artisans?trade=plumbing&county=Nairobi&availableToday=true`   | Return a list of artisans, filterable by trade, location, and same-day availability                  | #1 "source artisans" and #4 "schedule maintenance jobs" — the `availableToday` filter is how Meditrac finds someone now, without us running a scheduling system |
| GET    | `/artisans/{id}`                                                 | Return one artisan's full profile: trades, rate, verification status, and contact phone number       | #2 "book artisans" and #3 "vet artisans" — we hand over verification and contact details; the booking itself is a phone call, not an API call |
| POST   | `/artisans/{id}/reviews`                                         | Meditrac rates an artisan (1–5, optional comment) after a phone-booked job is done                     | #3 "vet artisans" — reviews from real pharmacy jobs inform later vetting; feedback only, no booking record is created |
| POST   | `/artisans/{id}/availability`                                    | Artisan marks themselves unavailable for a time window, once a job is agreed by phone                 | Artisan-only — not part of Meditrac's contract; supports the `availableToday` field above                       |
| PATCH  | `/artisans/{id}/availability/{blockId}`                          | Artisan adjusts the window on an existing block (job time shifted)                                     | Artisan-only — not part of Meditrac's contract                                                                   |
| DELETE | `/artisans/{id}/availability/{blockId}`                          | Artisan removes a block entirely (job fell through, not just moved)                                    | Artisan-only — not part of Meditrac's contract                                                                   |

6 endpoints: 2 reads and 1 write (reviews) used by Meditrac, 3 writes used only by our own
artisans. Meditrac still never creates or edits a booking — see "Design pivot" and "Reviews" below.

## Peer review — Group 3, 31 Aug 2026

Applied to the booking-API version of this file that existed at the time. Kept here as the
graded record of feedback received and addressed; superseded where noted below.

**1. "Use PATCH instead of PUT if you are only updating a few fields."**
Fixed at the time — PUT on `/bookings/{id}` became PATCH. *Superseded: `/bookings/{id}` no longer
exists in either verb, see Design pivot.*

**2. "Row 3 vs Row 6: both rows mention cancelling. Stick to one method."**
Fixed at the time — cancelling moved to DELETE alone, PATCH restricted to edits. *Superseded: both
verbs are gone along with the booking resource.*

**3. "`availability` is an abstract noun — represent it as `slots` or `schedules`."**
Fixed at the time, to `slots`. *Superseded: no slots endpoint remains; availability is now the
`availableToday` field on the artisan resource itself, which is a boolean state, not a noun that
needed pluralizing.*

**4. "There is also the issue of versioning."**
Not applied: paths carry no version prefix. The contract's `info.version: 1.0.0` records the
version instead.

## Design pivot: from booking API to discovery API (this revision)

Every earlier version of this file had `/bookings` endpoints — POST to create, PATCH to
reschedule, DELETE to cancel. Our lecturer flagged this directly: Meditrac should *consume our
data*, not *interconnect* with our system by writing into it. Working through what that means
concretely:

- **Booking happens off-API.** Meditrac finds an artisan through `GET /artisans`, opens their
  profile, and calls the phone number in `GET /artisans/{id}`. The actual booking is a real
  phone call, not an HTTP request — so there is no booking resource on our side for Meditrac to
  create, read, or cancel.
- **Two fields carry weight that used to belong to a whole booking subsystem.** `phone` (new, on
  the single-artisan response only, not the list) is what makes "book artisans" possible at all
  without a POST. `availableToday` (new, a plain boolean the artisan sets on their own profile) is
  what makes "schedule maintenance jobs" possible without a slots/scheduling engine — it answers
  "who's free right now," which is the only kind of scheduling question a same-day equipment
  failure actually asks.
- **This is the "genuinely everything is read-only" case the Week 3 handout names directly**
  ("if genuinely everything is read-only, flag this to your instructor rather than inventing a
  fake write endpoint just to hit the minimum"). We are flagging it here rather than padding the
  table with a write endpoint nobody needs.

Need #3, "vet artisans," had no endpoint at all in an earlier trimmed draft — restored via
`GET /artisans/{id}`, which also gives need #1 its single-item half. Vetting stays a read:
nothing on our side changes when Meditrac inspects an artisan.

## Ring-position correction

Earlier drafts of this file, the openapi.yaml contract, and the slide deck referred to our
downstream consumer as "Team 1", copying a mislabeled header in API_NEEDS.md. Team 1 is **us**
— Find My Artisan. Our upstream partner (second-hand materials) is Team 13. Our actual downstream
consumer, the one issuing all four booking/vetting/scheduling needs, is **Meditrac (Team 2)** —
which fits their own domain, since Meditrac manages pharmacies and pharmacies are exactly who
needs artisans for maintenance work. Every reference to "Team 1" above as the consumer should be
read as Meditrac.

## Artisan-side availability management — NOT part of Meditrac's contract

These three exist because `availableToday` needs a real source of truth instead of a boolean
someone has to remember to flip. It is now **computed**: true unless the artisan has a block
covering right now. The artisan calls POST right after agreeing a job on the phone; nobody at
Meditrac ever calls any of these three — they're in the table above for a complete picture of
our API surface, but Meditrac's actual contract is the two GET rows only.

PATCH and DELETE cover different cases, not the same one twice: PATCH means the job is still
happening but the time moved; DELETE means the job isn't happening at all, so the block itself
should never have existed.

## Busy windows for the next 14 days (added in Week 6)

`GET /artisans/{id}` also returns `busy`: the windows the artisan is booked over the next 14
days. `availableToday` alone only answers "free right now?", which covers a same-day failure but
not maintenance planned a week ahead (need #4). It's read from the same availability blocks, so
no new endpoint was needed.

## Reviews — the one write Meditrac uses (added in Week 6)

Find My Artisan added `POST /artisans/{id}/reviews` so that Meditrac can rate an artisan after a
job. It does not reverse the design pivot: a review is feedback about an artisan, not a booking,
and Meditrac holds no record on the Find My Artisan side that it later edits or cancels. It serves
need #3 directly, because later vetting can draw on ratings from real pharmacy jobs.
