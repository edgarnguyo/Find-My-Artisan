# Demo Day Run Sheet: Find My Artisan (Team 1)

Six minutes: 3 demo, 2 questions, 1 handover. No slides. Everything is shown live.
Ring order: Kanairo-Klean (Team 13) → **us** → Meditrac (Team 2).

---

## The day before (with Meditrac)

- [ ] `./demo.sh check` against Render ends in **PASS**
- [ ] Fresh clone in a new folder: `cd server && npm install && npm test` is green
- [ ] One real call each way today: Meditrac calls our `/artisans`, we call Kanairo `/materials`
- [ ] Meditrac has our live URL `https://find-my-artisan.onrender.com` and a working key
- [ ] Agree the fallback (below), and who speaks during their call
- [ ] Practise once, out loud, with a timer

**Use our own key for the demo, not Meditrac's.** Their calls then show a different
`caller` in the log from ours, so the room can see which line is theirs.

## 10 minutes before our slot

1. Wake Render: run `./demo.sh check` once (the first call after a sleep takes about a minute).
2. **Window 1:** Render dashboard → find-my-artisan → **Logs**. Make it big.
3. **Window 2:** terminal, run `clear`. Keep `.env` closed and nothing scrolled back.
4. **Browser tabs:** Swagger docs (edgarnguyo.github.io/Find-My-Artisan), repo README, the website's Materials page.
5. Run `./demo.sh`. It asks for the key with nothing shown, then waits for Enter.

## The three minutes

| Time | Press / show | Say |
|---|---|---|
| 0:00 | (nothing) | "We're Team 1, Find My Artisan. Our needs statement: *Meditrac needs our API to vet artisans in order to determine who can carry out tasks at their pharmacies.*" |
| 0:15 | (nothing) | "We call Kanairo-Klean for scrap prices. Meditrac calls us to find and rate artisans." |
| 0:25 | Enter → **READ** | "One artisan: Wanjiru, electrician, verified. `busy` is empty, so she's free for the next 14 days." |
| 0:40 | Enter → **WRITE**, Enter → proof | "POST books two hours on her: 201 and a new id. Read her again, and the time is now in `busy`. That's what Meditrac uses to plan a job." |
| 1:00 | Enter → **401** | "Same request, no key: 401. That's our Week 9 key check." |
| 1:10 | Enter → **404** | "An id that doesn't exist: 404, not a crash." |
| 1:20 | Enter → **403** | "A review for an artisan this key never hired is refused, so partners can't post fake reviews." |
| 1:30 | Swagger tab, then Logs window | "Docs are here, and every endpoint has Try it out. 215 tests pass. And this is our log: one line per request, no keys in it." |
| 1:45 | Enter → **/stats** | "Live numbers since the server started." |
| 2:00 | **Meditrac calls us.** Point at the Logs window | "That line is Meditrac, live: `GET /artisans`, 200, their key name, never the key." |
| 2:40 | Enter → clean-up (204) | (Silent. It removes the demo busy time.) |
| 2:45 | (nothing) | **One honest sentence:** "Versioning isn't built: no v2 yet. And our rate-limit counts live in memory, so a restart clears them. Next we'd move them to Redis." |
| 3:00 | | "Questions?" |

**Running over?** Cut the 1:30 tour. Never cut Meditrac's call.

## If something breaks

Say what you see, then use the fallback:

| You see | Say | Do |
|---|---|---|
| Hangs for a minute | "Render is waking from sleep. The first call takes about a minute." | Wait. If it's still hanging after 90 s, use the fallback. |
| 502 / 503 / no answer | "Our server isn't answering." | **Fallback:** show the log lines from yesterday's real Meditrac call and say clearly they're saved, not live. |
| Meditrac's call doesn't appear | "Their request hasn't reached us, so it's on the way or their side." | Ask them what status they got. Then use the fallback. |
| A key shows on screen | Keep going | Straight after: rotate it on Render and tell Meditrac. |

Never fake a live call.

## Questions we should expect

| Question | Answer |
|---|---|
| Why is POST not idempotent but PATCH is? | Two identical POSTs make two reviews. PATCH sets values, so sending the same PATCH twice leaves the same review. |
| Why a busy list, not slots? | Peer review suggested slots. In Week 6 we listed only booked times for the next 14 days: anything not listed is free, so Meditrac plans from our data without booking through us. |
| What bug did your tests catch? | Anyone with a key could delete a booked busy block, so the artisan looked free and could be double-booked. Booked blocks now answer 404; `bookings.test.js` checks it. |
| Rate limit? | 60 requests a minute per key. Request 61 gets 429 with `Retry-After`. |
| What if Kanairo is down? | 2000 ms timeout, 2 retries (200 ms, 400 ms), then the last saved prices with `stale: true` and a banner. Worst case is a 6.6 s wait, never an error. |
| What pattern did monitoring show? | The first request took about 26 ms vs about 3 ms after, because it opens the database connection; later ones reuse it. |
| Where are the keys? | `server/.env` and Render's settings. `.env` is git-ignored and has never been committed. |
| Did a stranger try your README? | (Fill in the Week 8 blind-test result before the day. If there wasn't one, say so.) |
| Versioning? | Not done. Say so, and say what v2 would change and how you'd warn Meditrac. |

Don't know an answer? Say so, and say how you'd find out.

## After class

- [ ] Feedback for every other team in the shared form
- [ ] `RETROSPECTIVE.md` written by you alone: 600–900 words, four sections, dates and status codes
- [ ] `git status` shows no `.env` or `*.log`, then commit and push
