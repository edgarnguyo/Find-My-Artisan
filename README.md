# Find My Artisan API

Find My Artisan lists skilled tradespeople in Kenya: electricians, plumbers,
carpenters and painters. This API gives other systems read access to those
artisans (who they are, where they work, whether they have earned the verified badge,
and when they are already booked), and lets a caller leave a review after a job.
It was built for Meditrac, a pharmacy team that uses it to find and vet artisans
for maintenance work, but anyone can call it.

| | |
|---|---|
| Base URL | `https://find-my-artisan.onrender.com` |
| Browsable docs (every endpoint, with "Try it out") | https://edgarnguyo.github.io/Find-My-Artisan/ |
| Contract | [`openapi.yaml`](openapi.yaml) |

## Quickstart

Copy, paste, run. Nothing to install and nothing to sign up for.

```bash
curl https://find-my-artisan.onrender.com/artisans/1
```

You get back one artisan:

```json
{"id":1,"name":"Wanjiru Kamau","trade":"electrical","area":"Westlands","county":"Nairobi","verified":true,"busy":[],"phone":"+254712000001","hourlyRateKes":900}
```

Two things that can catch you out:

- **The first request can take about a minute.** The server sleeps after 15
  minutes without traffic and wakes on the next request. Wait for it; later
  requests answer in under a second.
- **On Windows PowerShell, type `curl.exe` instead of `curl`.** In PowerShell,
  `curl` is a different command with different options. For the requests below
  that send a JSON body, the easiest route on Windows is the "Try it out" button
  on the [docs page](https://edgarnguyo.github.io/Find-My-Artisan/), or Git Bash.

You can also paste the URL into a browser's address bar: the two `GET` endpoints
work there.

## Authentication

There is none yet. Send no token, no key and no extra header: every request in
this README works exactly as written.

Authentication is planned for Week 9. When it lands, this section will say what
to send and where to get it.

## Endpoints

| Method | Path | What it does |
|---|---|---|
| `GET` | `/artisans` | List artisans, optionally filtered by `trade` and `county` |
| `GET` | `/artisans/{id}` | One artisan's full profile, including phone and hourly rate |
| `POST` | `/artisans/{id}/reviews` | Leave a review of an artisan |
| `PATCH` | `/artisans/{id}/reviews/{reviewId}` | Change a review you posted |
| `DELETE` | `/artisans/{id}/reviews/{reviewId}` | Remove a review you posted |
| `POST` | `/artisans/{id}/availability` | Mark an artisan as booked for a time window |
| `PATCH` | `/artisans/{id}/availability/{blockId}` | Change that window |
| `DELETE` | `/artisans/{id}/availability/{blockId}` | Remove that window |

The sample data has 23 artisans with ids 1 to 23. Anyone who signs up on the
website as an artisan gets the next id, so the list can be longer than that.

## Examples

Every response below was copied from a real request. They are shown exactly as
the API sends them: JSON on one line.

### List artisans

Both filters are optional and can be combined. Neither is case-sensitive.

- `trade` is one of `electrical`, `plumbing`, `carpentry`, `painting`. A trade
  nobody practises returns an empty list `[]`, not an error.
- `county` is the name of a Kenyan county, such as `Nairobi`, `Mombasa`,
  `Kisumu` or `Nakuru`. A name that is not a Kenyan county returns a `400`.

```bash
curl "https://find-my-artisan.onrender.com/artisans?trade=plumbing&county=Nairobi"
```

`200 OK`

```json
[{"id":3,"name":"Achieng Nyambura","trade":"plumbing","area":"Embakasi","county":"Nairobi","verified":false,"busy":[]},{"id":4,"name":"Kevin Mwangi","trade":"plumbing","area":"Ngong Road","county":"Nairobi","verified":false,"busy":[]}]
```

Your list may have more entries than this one: it grows when someone signs up
as a plumber in Nairobi.

Keep the quotes around the URL. Without them the shell treats `&` as the end of
the command and drops the second filter.

`busy` lists the times the artisan is booked in the next 14 days, earliest
first. Any time not listed is free, and `[]` means nothing is booked. A booked
artisan looks like this:

```json
"busy":[{"start":"2026-10-20T06:00:00Z","end":"2026-10-20T10:00:00Z"}]
```

All times are UTC.

### Get one artisan

```bash
curl https://find-my-artisan.onrender.com/artisans/1
```

`200 OK`

```json
{"id":1,"name":"Wanjiru Kamau","trade":"electrical","area":"Westlands","county":"Nairobi","verified":true,"busy":[],"phone":"+254712000001","hourlyRateKes":900}
```

`phone` is only on this full profile, not in the list.

`verified` is earned on the site, not checked against a certificate: it is
`true` once an artisan has been signed up for at least 30 days and has at least
3 reviews averaging 4.3 or more. It is worked out on every request, so it can
turn `false` again if the average drops. The contract's optional
`verification` object (certificate details) is therefore never sent.

### Leave a review

`author` (text, up to 100 characters) and `rating` (a whole number from 1 to 5)
are required. `comment` (text, up to 1000 characters) is optional.

```bash
curl -X POST https://find-my-artisan.onrender.com/artisans/3/reviews \
  -H "Content-Type: application/json" \
  -d '{"author": "Meditrac - Westlands branch", "rating": 5, "comment": "Fixed the leaking sink the same afternoon."}'
```

`201 Created`

```json
{"id":242,"artisanId":3,"author":"Meditrac - Westlands branch","rating":5,"comment":"Fixed the leaking sink the same afternoon.","createdAt":"2026-10-12T13:59:13Z"}
```

**Note the `id` in your own response.** It will not be 242. The next two
requests need it.

### Change a review

Send only the fields you are changing. Replace `242` with the `id` you got back
when you posted the review.

```bash
curl -X PATCH https://find-my-artisan.onrender.com/artisans/3/reviews/242 \
  -H "Content-Type: application/json" \
  -d '{"rating": 4}'
```

`200 OK`

```json
{"id":242,"artisanId":3,"author":"Meditrac - Westlands branch","rating":4,"comment":"Fixed the leaking sink the same afternoon.","createdAt":"2026-10-12T13:59:13Z"}
```

Only reviews posted through this API can be changed or removed. The reviews that
came with the sample data return `404`.

### Remove a review

Replace `242` with your review's `id`.

```bash
curl -i -X DELETE https://find-my-artisan.onrender.com/artisans/3/reviews/242
```

`204 No Content`

A `204` has no body, so there is nothing to print. The `-i` makes curl show the
status line, which is how you can tell it worked. Running the same command again
returns `404`, because the review is gone.

### Mark an artisan as booked

`start` and `end` are both required, and each needs a time zone: either `Z` for
UTC or an offset such as `+03:00`. `end` has to be after `start`.

**Before you run this, replace `YYYY-MM-DD` with a date in the next 14 days**,
for example tomorrow. The server also accepts a date in the past, but a window
that has already ended never shows up in the artisan's `busy` list, so you
couldn't see that it worked.

```bash
curl -X POST https://find-my-artisan.onrender.com/artisans/1/availability \
  -H "Content-Type: application/json" \
  -d '{"start": "YYYY-MM-DDT06:00:00Z", "end": "YYYY-MM-DDT10:00:00Z"}'
```

`201 Created`, with your date in place of `YYYY-MM-DD`:

```json
{"id":17,"artisanId":1,"start":"YYYY-MM-DDT06:00:00Z","end":"YYYY-MM-DDT10:00:00Z","createdAt":"2026-10-12T13:59:21Z"}
```

Two windows for the same artisan cannot overlap. **If someone has already booked
this exact window, you get the `400` below.** Pick a different date and send it
again.

```json
{"code":"invalid_body","message":"This window overlaps an existing block."}
```

Note the `id` in your response for the next two requests.

### Change a booked window

Send `start`, `end`, or both. Replace `17` with your block's `id`, and
`YYYY-MM-DD` with the same date you used above.

```bash
curl -X PATCH https://find-my-artisan.onrender.com/artisans/1/availability/17 \
  -H "Content-Type: application/json" \
  -d '{"end": "YYYY-MM-DDT12:00:00Z"}'
```

`200 OK`

```json
{"id":17,"artisanId":1,"start":"YYYY-MM-DDT06:00:00Z","end":"YYYY-MM-DDT12:00:00Z","createdAt":"2026-10-12T13:59:21Z"}
```

### Remove a booked window

Replace `17` with your block's `id`.

```bash
curl -i -X DELETE https://find-my-artisan.onrender.com/artisans/1/availability/17
```

`204 No Content`, with no body.

## Errors

A failed request returns a `4xx` or `5xx` status and a JSON body with exactly
two fields:

```json
{"code":"not_found","message":"No artisan with id 9999."}
```

`code` is a fixed word your program can check. `message` is a sentence for a
person to read, and its wording may change.

| Status | `code` | When |
|---|---|---|
| `400` | `invalid_query` | A query parameter has a bad value |
| `400` | `invalid_body` | The JSON body is missing a field, has a wrong value, or is not valid JSON |
| `404` | `not_found` | No artisan, review or block has that id |
| `500` | `server_error` | Something failed on our side |

A successful request returns `200`, `201` or `204`. So the status code alone
tells you whether it worked: anything starting with `2` did.

Real examples of each:

```bash
curl https://find-my-artisan.onrender.com/artisans/9999
```

`404 Not Found`

```json
{"code":"not_found","message":"No artisan with id 9999."}
```

```bash
curl "https://find-my-artisan.onrender.com/artisans?county=Atlantis"
```

`400 Bad Request`

```json
{"code":"invalid_query","message":"county must be a known Kenyan county name."}
```

```bash
curl -X POST https://find-my-artisan.onrender.com/artisans/3/reviews \
  -H "Content-Type: application/json" \
  -d '{"author": "Meditrac - Westlands branch", "rating": 9}'
```

`400 Bad Request`

```json
{"code":"invalid_body","message":"rating must be a whole number from 1 to 5."}
```

**If you get HTML back instead of JSON, the path is wrong.** The same server
also serves the Find My Artisan website, so an address that is not one of the
eight endpoints above returns a web page. Check the spelling, for example
`/artisans/3/reviews` and not `/artisans/3/review`.

## Run it locally

You only need this if you want your own copy. The hosted URL above needs no
setup.

You need [Node.js](https://nodejs.org) 22.12 or newer and MySQL 8 or newer,
with MySQL running. Run each command on its own line.

```bash
git clone https://github.com/edgarnguyo/Find-My-Artisan.git
```

```bash
cd Find-My-Artisan/server
```

```bash
npm install
```

```bash
cp .env.example .env
```

If your MySQL `root` user has a password, open `server/.env` now and put it
after `DB_PASSWORD=`. If it has none, leave the file as it is.

```bash
mysql -u root -p -e "source schema.sql"
```

This asks for the MySQL password; press Enter if there is none. It creates the
`find_my_artisan` database, its tables and the 23 sample artisans.

```bash
npm start
```

When the terminal shows `Server running on port 5001`, open a second terminal
and try it:

```bash
curl http://localhost:5001/artisans/1
```

Every example in this README works locally if you swap
`https://find-my-artisan.onrender.com` for `http://localhost:5001`. The docs
page, with "Try it out", is at http://localhost:5001/docs.

To stop the server, press Ctrl-C.

### If it doesn't work

A database problem does not stop the server from starting. It shows up on the
first request: the API answers `500` with `{"code":"server_error", ...}`, and
the real cause is printed in the terminal where the server is running. Look
there.

| The server's terminal shows | Cause | Fix |
|---|---|---|
| `Cannot find module` (at start) | `npm install` was skipped or ran in the wrong folder | Run it inside `server/` |
| `EADDRINUSE: address already in use :::5001` (at start) | Another copy is already running | Stop that one first |
| `Access denied for user 'root'` | Wrong MySQL password | Fix `DB_PASSWORD` in `server/.env` |
| `ECONNREFUSED` | MySQL is not running | Start MySQL |
| `Unknown database 'find_my_artisan'` | The `schema.sql` step was skipped | Run it |

After changing `server/.env`, stop the server with Ctrl-C and run `npm start`
again. The file is only read at startup.

### The website

The repository also holds the Find My Artisan website, a React app in
`react-app/` that the same server sends to browsers. The API does not need it.
To build it, run `npm install` and then `npm run build` inside `react-app/`,
and open http://localhost:5001. [TEAM-SETUP.md](TEAM-SETUP.md) has the full
developer setup.

#### Scrap Materials page (our upstream partner)

The website's **Materials** page shows second-hand materials in stock at
Kanairo-Klean (Team 13), with prices per kg, from their live API. The browser
asks our server (`GET /partner/materials`, optional `?type=`), and our server
calls Kanairo with the token, so the token never reaches the browser. This route
is website-only and not part of our contract.

Artisans can also report scrap left over from a completed job, from the
**Completed** tab of their dashboard ("Report Leftover Scrap"). Our server checks
the job is theirs and finished, then sends it to one of Kanairo's collection
yards (`GET /partner/collection-locations`, `POST /partner/drop-offs`). A copy
of each report is kept in the `scrap_drop_offs` table, so the dashboard lists
what was already sent, and each material can be reported once per job.

When a client books a Plumber or Electrician, the booking form has an optional
**Materials** section: Kanairo's live prices for the materials that trade uses
(plastic and metal for plumbers, metal and e-waste for electricians), a kg box
for each, and a running total. Kanairo sells no wood or paint, so carpenters and
painters don't get the section. The form sends only material ids and kg with
`POST /bookings` (`materials: [{ materialId, quantityKg }]`); our server looks up
each price at Kanairo itself, so the estimate can't be changed in the browser,
and saves it in the `booking_materials` table with that day's price. The client
(My Bookings) and the artisan (dashboard) both see the estimate on the request.
If Kanairo is down, the form says so and the request can still be sent without
an estimate.

All of these need two values in `server/.env` (placeholders are in `.env.example`):

- `PARTNER_URL`: Kanairo-Klean's base URL
- `PARTNER_API_KEY`: the token they sent us privately (never commit it)

Without them, or while Kanairo's server is off, the page says the prices are
unavailable and the rest of the site keeps working. To try the page without
Kanairo, run their example data on port 5050 in another terminal:

```bash
npm run partner:standin
```

then set `PARTNER_URL=http://localhost:5050` and `PARTNER_API_KEY=standin-token`.

## More

- [`openapi.yaml`](openapi.yaml): the contract, with every field and its type
- [`CONTRACT_DEVIATIONS.md`](CONTRACT_DEVIATIONS.md): each change made to the contract, and why
- `npm test` inside `server/`: automated tests for every endpoint (they add and
  remove rows in the database named in `server/.env`)
