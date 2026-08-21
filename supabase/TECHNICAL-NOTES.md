# How the database works — the technical layer

Notes on what was actually built for Find My Artisan, and why each decision was
made that way. Every code block below is real code from this repo, with the
file path above it. Companion to `README.md`, which covers the setup steps.

**The files this describes**

```
supabase/
    migrations/0001_init.sql     the schema (DDL)
    seed.sql                     the data  (DML)
react-app/src/
    lib/supabaseClient.js        the connection
    api/workers.js               every query the app makes
    hooks/useAsync.js            loading / error / data plumbing
    components/BookingForm.jsx   the only write path
    pages/ListingsPage.jsx       list read
    pages/ProfilePage.jsx        single read with joins
```

---

## 1. What a Postgres server actually is

PostgreSQL is a **server process** that listens on a TCP port (default `5432`)
and speaks a wire protocol. It is not a file your app opens. Clients connect
over a socket, authenticate, and send SQL.

A connection string encodes all of that:

```
postgresql://user:password@host:5432/database
```

Inside one server there are multiple **databases**; inside a database,
**schemas**; inside a schema, tables. The default schema is `public` — that is
why the policies say `grant usage on schema public`.

`createdb find_my_artisan` creates a database inside the Postgres server
running locally. `psql -d find_my_artisan` opens a connection to it.

## 2. DDL vs DML

Two categories of SQL, and the distinction is why there are two files:

- **DDL** (Data Definition Language) — `CREATE TABLE`, `ALTER TABLE`, `DROP`.
  Changes *structure*.
- **DML** (Data Manipulation Language) — `INSERT`, `SELECT`, `UPDATE`,
  `DELETE`. Changes *rows*.

`migrations/0001_init.sql` is DDL. `seed.sql` is DML. Structure is versioned
and shared; data is environment-specific.

## 3. Choosing column types

Types are constraints, not labels. Picking wrong costs you later.

**`supabase/migrations/0001_init.sql`**

```sql
create table if not exists workers (
    id             serial primary key,
    name           text    not null,
    skill          text    not null,
    verified       boolean not null default false,
    price          text,
    photo          text,
    location       text    not null,
    bio            text,
    rating         numeric(2,1),
    job_success    integer,
    hours_per_week text,
    total_earnings text,
    jobs_completed integer default 0,
    hours_worked   integer default 0,
    created_at     timestamptz not null default now()
);
```

`numeric(2,1)` means 2 total digits, 1 after the decimal — exactly `0.0` to
`9.9`. This is **exact decimal**, not binary floating point. With `real` or
`double precision`, `4.8` would store as `4.7999999523162842` and equality
comparisons would silently fail. Proof it round-trips:

```
 id |      name      | rating | job_success
----+----------------+--------+-------------
  1 | Wanjiru Kamau  |    4.8 |         100
  5 | Njeri Kariuki  |    4.9 |         100
 23 | Samuel Kimutai |    4.0 |          87
```

The `bookings` table is where the date and time types matter:

**`supabase/migrations/0001_init.sql`**

```sql
create table if not exists bookings (
    id           serial primary key,
    worker_id    integer not null references workers(id) on delete cascade,
    name         text    not null,
    contact      text    not null,
    booking_date date    not null,
    booking_time time    not null,
    budget       text,
    job          text    not null,
    status       text    not null default 'pending',
    created_at   timestamptz not null default now()
);
```

| Column | Type | Reason |
|---|---|---|
| `booking_date` | `date` | No time component. Comparable with `<`, `>`, indexable, sortable. A `text` date sorts as a string — `"10/01"` before `"2/01"`. |
| `booking_time` | `time` | Wall-clock time with no date. |
| `created_at` | `timestamptz` | Stores UTC internally, converts on retrieval. **Always `timestamptz`, never `timestamp`** — the latter has no timezone and is ambiguous. |
| `verified` | `boolean` | Three states in SQL: `true`, `false`, `null`. `not null default false` removes the third. |
| `status` | `text` + default | `'pending'` is set server-side, so the browser cannot create a pre-approved booking. |
| `price` | `text` | Deliberate: `"KES 2,500 – 7,000 / job"` is a human-readable range, not a number you compute with. To filter by price later, split into `price_min integer` / `price_max integer`. |

Note `booking_date` / `booking_time` rather than `date` / `time` — those are
SQL type names, and using them as bare column names forces quoting everywhere.

## 4. Constraints

A constraint is a rule Postgres enforces on every write. It rejects bad data at
the database level, so no application bug can bypass it.

**`supabase/migrations/0001_init.sql`**

```sql
create table if not exists reviews (
    id         serial primary key,
    worker_id  integer not null references workers(id) on delete cascade,
    author     text    not null,
    rating     integer not null check (rating between 1 and 5),
    comment    text,
    created_at timestamptz not null default now()
);
```

Three constraints on `rating` alone:

- `not null` — value must be present
- `check (...)` — arbitrary boolean expression, evaluated per row on insert and update
- the type itself — `integer` rejects `'abc'`

Inserting `rating = 7` raises an error and rolls back.

Now compare that to the validation in the form:

**`react-app/src/components/BookingForm.jsx`**

```js
function validate() {
  const newErrors = {};
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const phonePattern = /^[\d\s+()-]{7,}$/;

  if (name.trim() === '') {
    newErrors.name = 'Please enter your name.';
  }
  if (contact.trim() === '') {
    newErrors.contact = 'Please enter your email or phone number.';
  } else if (!emailPattern.test(contact) && !phonePattern.test(contact)) {
    newErrors.contact = 'Enter a valid email (name@domain.com) or phone (min 7 digits).';
  }
  if (date.trim() === '') {
    newErrors.date = 'Please choose a preferred date.';
  } else {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (new Date(date) < today) {
      newErrors.date = 'Date cannot be in the past.';
    }
  }
  ...
  return newErrors;
}
```

These two do different jobs. `validate()` is a *convenience* — it gives a
useful message next to the right field before a round trip. The `not null` and
`check` constraints are the actual guarantee. Client-side validation is a UX
feature, never a security or integrity feature: anyone can open devtools and
POST to the REST endpoint directly, skipping this function entirely.

Worth noticing what is **not** currently enforced in the database: `job` is
`not null` but has no minimum length, and `booking_date` has no
`check (booking_date >= current_date)`. The "no past dates" rule exists only in
React right now. Adding it as a constraint would be a one-line `0002`
migration.

## 5. Keys and referential integrity

```sql
id serial primary key,
```

`serial` is not a real type. It is shorthand that expands to three things:

```sql
CREATE SEQUENCE workers_id_seq;
id integer NOT NULL DEFAULT nextval('workers_id_seq');
ALTER SEQUENCE workers_id_seq OWNED BY workers.id;
```

A **sequence** is a separate counter object. That is why `seed.sql` inserts
explicit ids:

**`supabase/seed.sql`**

```sql
insert into workers (id, name, skill, verified, price, photo, location, bio,
                     rating, job_success, hours_per_week, total_earnings,
                     jobs_completed, hours_worked) values
  (1, 'Wanjiru Kamau', 'Electrician', true, 'KES 2,500 – 7,000 / job', ...),
  (2, 'Kiptoo Ruto', 'Electrician', true, 'KES 2,200 – 6,800 / job', ...),
  ...
  (23, 'Samuel Kimutai', 'Painter', false, 'KES 2,000 – 7,500 / job', ...);
```

and must end with:

**`supabase/seed.sql`**

```sql
select setval('workers_id_seq', (select max(id) from workers));
```

Because the seed supplies ids 1–23 directly, `nextval` was never called and the
sequence is still at 1. Without that `setval`, the *next* worker inserted
normally would get `id = 1` and fail with a duplicate key error. This is the
single most common seeding bug.

The ids have to be explicit here, because `languages`, `work_history`, and
`reviews` all reference them in the same file:

**`supabase/seed.sql`**

```sql
insert into languages (worker_id, name, level) values
  (1, 'English', 'Fluent'),
  (1, 'Swahili', 'Native'),
  (2, 'English', 'Fluent'),
  ...
```

`primary key` itself is two constraints plus a structure: `not null` +
`unique` + an automatically created B-tree index.

The foreign key:

```sql
worker_id integer not null references workers(id) on delete cascade,
```

Postgres **rejects** any `reviews` row whose `worker_id` does not exist in
`workers`. Orphan rows become impossible. `on delete cascade` defines what
happens when the parent is deleted — children go too. Alternatives:

- `on delete restrict` — refuse to delete the parent while children exist
- `on delete set null` — keep the child, null out the reference (column must be nullable)

Cascade is right here: a review of a deleted artisan is meaningless.

The same cascade is what lets the seed be re-runnable:

**`supabase/seed.sql`**

```sql
truncate table reviews, work_history, languages, bookings, workers restart identity cascade;
```

`restart identity` resets the sequences; `cascade` follows the foreign keys.

## 6. Indexes

**`supabase/migrations/0001_init.sql`**

```sql
create index if not exists languages_worker_id_idx    on languages(worker_id);
create index if not exists work_history_worker_id_idx on work_history(worker_id);
create index if not exists reviews_worker_id_idx      on reviews(worker_id);
create index if not exists bookings_worker_id_idx     on bookings(worker_id);
create index if not exists workers_skill_idx          on workers(skill);
```

Without an index, `select * from reviews where worker_id = 1` performs a
**sequential scan** — reads every row and tests each. O(n). With a B-tree
index it is a tree descent, roughly O(log n).

Postgres indexes primary keys automatically but **not** foreign keys. Since
every profile page query filters by `worker_id`, those four indexes are the
ones that matter. At 29 reviews it is irrelevant; at 2.9 million it is the
difference between 1ms and 4 seconds.

Inspect the planner's decision:

```bash
psql -d find_my_artisan -c "explain analyze select * from reviews where worker_id = 1;"
```

## 7. Normalization — the actual rule

The old mock data had arrays nested inside objects:

**`react-app/src/data/mockData.js`** (kept as the seed source; the app no
longer imports it)

```js
{
  id: 1,
  name: "Wanjiru Kamau",
  skill: "Electrician",
  languages: [
    { name: "English", level: "Fluent" },
    { name: "Swahili", level: "Native" },
  ],
  reviews: [
    { author: "Kevin O.", rating: 5, comment: "Fixed my fuse box same day." },
  ],
}
```

**First normal form** requires that no column holds a repeating group. The fix
is to move each repeating group into its own table pointing back with a foreign
key — which is exactly what `languages`, `work_history`, and `reviews` are:

```sql
create table if not exists languages (
    id        serial primary key,
    worker_id integer not null references workers(id) on delete cascade,
    name      text    not null,
    level     text    not null
);
```

Gained: you can query across all workers' reviews at once
(`select avg(rating) from reviews`), constrain each review individually, and
add one without rewriting the worker row.

Cost: reassembling the original object shape requires a join — section 10.

## 8. Migrations — the mechanics

A migration is an **ordered, immutable, append-only** sequence of DDL files:

```
supabase/migrations/
    0001_init.sql
```

Three properties make it work:

1. **Ordered** — the numeric prefix defines apply order. `0002` may depend on `0001`.
2. **Immutable** — once applied anywhere, never edit it. To change something,
   write `0002_add_column.sql`. Editing an applied migration means your
   database and your teammate's silently diverge.
3. **Idempotent where possible** — every statement in `0001_init.sql` uses
   `if not exists`, so a re-run is harmless.

This is what makes the schema reproducible. A teammate clones the repo, runs
the migrations in order, and has a byte-identical structure. Clicking
"New Table" in a dashboard produces a database nobody else can reproduce.

## 9. Row Level Security — the mechanism

This is the actual security boundary, so it is worth understanding properly.

Two independent permission systems stack.

**GRANT** is table-wide, per role. Supabase sets these up for `anon` already:

```sql
grant select on workers to anon;
```

**RLS policies** are per-row, evaluated as a boolean expression against each
row. The full block:

**`supabase/migrations/0001_init.sql`**

```sql
alter table workers      enable row level security;
alter table languages    enable row level security;
alter table work_history enable row level security;
alter table reviews      enable row level security;
alter table bookings     enable row level security;

-- Public catalogue data: anyone may read, nobody may write from the browser.
create policy "public read workers"      on workers      for select using (true);
create policy "public read languages"    on languages    for select using (true);
create policy "public read work_history" on work_history for select using (true);
create policy "public read reviews"      on reviews      for select using (true);

-- Bookings: anyone may create one, nobody may read them back from the browser.
create policy "anyone can create a booking" on bookings for insert with check (true);
```

Order of evaluation on any query:

1. Does the role have the GRANT? No → error `permission denied for table`.
2. Is RLS enabled? No → all rows returned.
3. Is there a matching policy? No → **zero rows**, silently. Not an error.
4. Policy exists → the `using` expression runs per row; rows returning false
   are invisible.

That step-3 distinction showed up in testing. A test role with no select grant
got `permission denied for table bookings`. In real Supabase the `anon` role
**does** have select granted by default, so it takes path 3 instead: an empty
array, no error.

Note there is **no** `alter table ... enable row level security` without a
matching set of policies — enabling RLS with zero policies makes a table
completely invisible, which is a common way to break a working app.

### `using` vs `with check`

- `using` filters rows being **read** (also which existing rows `update` /
  `delete` may touch)
- `with check` validates rows being **written**

An insert has no existing row to filter, so the booking policy takes
`with check`. And because there is **no select policy at all** on `bookings`,
inserts succeed but reads return nothing. That asymmetry is deliberate — it
makes the table write-only from a browser.

### The code consequence

**`react-app/src/api/workers.js`**

```js
/**
 * Insert a booking request.
 * RLS allows insert but not select on bookings, so we deliberately do not
 * chain .select() here — asking for the row back would return an error.
 */
export async function createBooking({ workerId, name, contact, date, time, budget, job }) {
  const { error } = await supabase.from('bookings').insert({
    worker_id: workerId,
    name,
    contact,
    booking_date: date,
    booking_time: time,
    budget: budget || null,
    job,
  });

  if (error) throw error;
}
```

PostgREST's insert defaults to returning the created row, which needs select
permission. `const { error } = ...` with no `.select()` is what keeps this
working.

### Why this must live in the database

The anon key ships to every browser. Anyone can read it out of the JS bundle
and call the REST API directly with `curl`. RLS is enforced by Postgres itself,
so it holds regardless of what client is talking.

## 10. How Supabase becomes an HTTP API

Supabase runs **PostgREST** in front of Postgres. It introspects the schema and
generates REST endpoints automatically. There is no backend code to write.

**`react-app/src/api/workers.js`**

```js
/** One worker with everything attached, or null if that id does not exist. */
export async function fetchWorkerById(id) {
  const { data, error } = await supabase
    .from('workers')
    .select('*, languages(name, level), work_history(*), reviews(*)')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data ? toWorker(data) : null;
}
```

becomes an HTTP request roughly like:

```
GET /rest/v1/workers?select=*,languages(name,level),work_history(*),reviews(*)&id=eq.1
apikey: <anon key>
```

PostgREST compiles that into a single SQL query with joins and JSON
aggregation, and returns nested JSON.

**The nested embedding only works because the foreign keys exist** — PostgREST
reads them from the system catalog to infer the relationship. No FK, no
`languages(...)` syntax.

`.maybeSingle()` returns one object instead of a one-element array, and `null`
rather than an error when nothing matches — which is what makes the
"Worker not found" branch in `ProfilePage.jsx` reachable. (`.single()` would
throw instead.)

PostgREST executes the query as the `anon` role, so every RLS policy applies.
The API surface is wide; the data surface is exactly what the policies allow.

### The naming boundary

SQL convention is `snake_case`; the React components were written against the
`camelCase` shape of `mockData.js`. Rather than rename props across a dozen
components, the translation happens in one place:

**`react-app/src/api/workers.js`**

```js
function toWorker(row) {
  return {
    id: row.id,
    name: row.name,
    skill: row.skill,
    verified: row.verified,
    price: row.price,
    photo: row.photo,
    location: row.location,
    bio: row.bio,
    rating: row.rating === null ? null : Number(row.rating),
    jobSuccess: row.job_success,
    hoursPerWeek: row.hours_per_week,
    totalEarnings: row.total_earnings,
    jobsCompleted: row.jobs_completed,
    hoursWorked: row.hours_worked,
    languages: (row.languages ?? []).map(l => ({ name: l.name, level: l.level })),
    workHistory: (row.work_history ?? []).map(h => ({
      title: h.title,
      rating: h.rating,
      dateRange: h.date_range,
      price: h.price,
      priceType: h.price_type,
    })),
    reviews: (row.reviews ?? []).map(r => ({
      author: r.author,
      rating: r.rating,
      comment: r.comment,
    })),
  };
}
```

One detail that is easy to miss: `Number(row.rating)`. PostgREST returns
`numeric` as a **string** (`"4.8"`), because JavaScript numbers cannot
represent arbitrary-precision decimals. Without that conversion,
`worker.rating.toFixed(1)` throws, and `rating > 4.5` compares a string.

The `?? []` guards matter too — `fetchWorkers` does not embed the child tables,
so those keys are `undefined` there.

## 11. Where the anon key fits

**`react-app/src/lib/supabaseClient.js`**

```js
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    'Missing Supabase credentials. Copy react-app/.env.example to react-app/.env.local ' +
    'and fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, then restart the dev server.'
  );
}

export const supabase = createClient(url, anonKey);
```

Vite substitutes `import.meta.env.VITE_*` at **build time** — the literal
string is baked into the bundle. The `VITE_` prefix is a safety mechanism: only
prefixed variables are exposed, so a `DATABASE_PASSWORD` in the same file
cannot leak by accident.

The explicit `throw` exists because the failure is otherwise invisible: with
`undefined` credentials, `createClient` succeeds and every query fails later
with an opaque network error. Failing loudly at import time points straight at
the cause.

The anon key is a JWT identifying the *role*, not a user. It is public by
design. Its safety depends entirely on the RLS policies being correct.

The `service_role` key is the opposite: it **bypasses RLS entirely**. It
belongs only on a server you control, never in a Vite env var, because anything
`VITE_`-prefixed is in the bundle by definition.

**`react-app/.gitignore`**

```
node_modules
.env.local
.env
```

`.env.example` is committed with placeholders; `.env.local` holds the real
values and never enters git.

## 12. Async, and why the component shape changed

`import { WORKERS }` resolved at build time — synchronous, always present. A
network request is none of those things. Every fetch has three possible states
and the UI must handle all three.

**`react-app/src/hooks/useAsync.js`**

```js
import { useState, useEffect } from 'react';

const INITIAL = { data: null, error: null, loading: true };

/**
 * Runs an async function once (or again whenever `deps` change) and tracks the
 * three states every database request has: loading, error, and data.
 */
export function useAsync(fn, deps = []) {
  const depsKey = JSON.stringify(deps);
  const [state, setState] = useState(INITIAL);
  const [lastKey, setLastKey] = useState(depsKey);

  // deps changed: drop the previous result and go back to loading before the
  // new request starts, so callers never render stale data for the new deps.
  if (lastKey !== depsKey) {
    setLastKey(depsKey);
    setState(INITIAL);
  }

  useEffect(() => {
    let cancelled = false;

    fn()
      .then(data => {
        if (!cancelled) setState({ data, error: null, loading: false });
      })
      .catch(error => {
        if (!cancelled) setState({ data: null, error, loading: false });
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depsKey]);

  return state;
}
```

Three details worth reading closely.

**The cancellation flag.** If a component unmounts before the promise resolves,
calling `setState` on it is a bug — and with one in-flight request per
navigation, a race where an older slow response overwrites a newer fast one.
The function returned from `useEffect` runs on unmount and on every deps
change, flipping `cancelled` so the stale response is discarded.

**Resetting during render, not in an effect.** Navigating `/profile/1` →
`/profile/2` reuses the same component instance. The `if (lastKey !== depsKey)`
block runs during render, so the reset happens *before* React paints — worker 1
never appears under worker 2's URL. Doing this in an effect instead would paint
the stale data for one frame, and React's lint rule
`react-hooks/set-state-in-effect` flags it.

**`JSON.stringify(deps)`.** `useEffect` compares dependencies by reference, so
a fresh array each render would re-fire forever. Serializing to a string gives
value comparison.

### Using it — the single read

**`react-app/src/pages/ProfilePage.jsx`**

```jsx
export default function ProfilePage() {
  const { id } = useParams();
  const { data: worker, error, loading } = useAsync(
    () => fetchWorkerById(id),
    [id]
  );

  if (loading) {
    return (
      <main className="profile">
        <p>Loading artisan…</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="profile">
        <h1>Something went wrong</h1>
        <p>Could not load this artisan: {error.message}</p>
      </main>
    );
  }

  if (!worker) {
    return (
      <main className="profile">
        <h1>Worker not found</h1>
        <p>No artisan with id {id} exists.</p>
      </main>
    );
  }

  return ( /* ...the real page... */ );
}
```

Four outcomes, not one: loading, failed, succeeded-but-empty, succeeded. The
mock-data version only ever had the last two.

### Using it — the list

**`react-app/src/pages/ListingsPage.jsx`**

```jsx
const { data: workers, error, loading } = useAsync(fetchWorkers);

const filteredWorkers = (workers ?? []).filter((worker) => {
  const matchesSearch =
    worker.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    worker.skill.toLowerCase().includes(searchTerm.toLowerCase()) ||
    worker.location.toLowerCase().includes(searchTerm.toLowerCase());

  const matchesSkill =
    activeFilter === "All" ||
    worker.skill === activeFilter;

  return matchesSearch && matchesSkill;
});
```

```jsx
{loading ? (
  [...Array(6)].map((_, index) => <div key={index} className="skeleton-card" />)
) : error ? (
  <p>Could not load artisans: {error.message}</p>
) : filteredWorkers.length > 0 ? (
  filteredWorkers.map((worker) => <WorkerCard key={worker.id} worker={worker} />)
) : (
  <p>No artisans found.</p>
)}
```

The `?? []` matters: `data` is `null` on the first render, and `null.filter` throws.

The skeleton cards used to be driven by a fake `setTimeout(..., 2000)`
pretending to load. They are now tied to a real request.

Filtering happens **in the browser** here, over all 23 workers. At larger scale
you would push it into the query — `.eq('skill', activeFilter)` and
`.ilike('location', '%' + term + '%')` — so Postgres uses `workers_skill_idx`
and returns only matching rows.

### The write path

**`react-app/src/components/BookingForm.jsx`**

```js
async function handleSubmit(e) {
  e.preventDefault();
  const newErrors = validate();

  if (Object.keys(newErrors).length > 0) {
    setErrors(newErrors);
    return;
  }

  setErrors({});
  setSendError(null);
  setSending(true);

  try {
    await createBooking({
      workerId: worker.id,
      name,
      contact,
      date,
      time,
      budget,
      job,
    });
    setSubmitted(true);
  } catch (err) {
    setSendError(err.message);
  } finally {
    setSending(false);
  }
}
```

The old version called a synchronous `saveBookingRequest()` that pushed onto a
`localStorage` array — it could not fail, so there was nothing to handle. A
network write can fail, so it needs `try` / `catch` / `finally`, a `sending`
flag to disable the button against double-submits, and a `sendError` to show
when it goes wrong:

```jsx
{sendError && (
  <small className="error">
    Could not send your request: {sendError}
  </small>
)}

<button type="submit" className="submit-btn" disabled={sending}>
  {sending ? 'Sending…' : 'Send request'}
</button>
```

`localStorage` was per-browser: a booking made on one laptop was invisible
everywhere else, including to the artisan. That is the concrete reason the
table exists.

## 13. Verifying a schema — the method

Each step tests something different. Worth repeating whenever you build one.

```bash
createdb find_my_artisan
psql -d find_my_artisan -v ON_ERROR_STOP=1 -f supabase/migrations/0001_init.sql
psql -d find_my_artisan -v ON_ERROR_STOP=1 -f supabase/seed.sql
```

`-v ON_ERROR_STOP=1` matters: by default `psql` continues after an error, so a
broken migration can appear to succeed. This aborts on the first failure.

**1. Row counts against the source.** Catches truncated or duplicated inserts.

```sql
select 'workers '     || (select count(*) from workers)
    || ' | languages '|| (select count(*) from languages)
    || ' | history '  || (select count(*) from work_history)
    || ' | reviews '  || (select count(*) from reviews);
```

```
workers 23 | languages 48 | history 35 | reviews 29
```

matching `mockData.js` exactly.

**2. Type round-trip.** Ratings come back `4.8`, not `4.799999`. Section 3.

**3. Relationships.** Catches broken foreign keys.

```sql
select w.name,
       (select count(*) from languages    l where l.worker_id = w.id) as languages,
       (select count(*) from work_history h where h.worker_id = w.id) as history,
       (select count(*) from reviews      r where r.worker_id = w.id) as reviews
from workers w where w.id = 1;
```

```
     name      | languages | history | reviews
---------------+-----------+---------+---------
 Wanjiru Kamau |         2 |       2 |       3
```

**4. RLS under a real non-superuser role.** The step people skip. Your own psql
session is superuser, and **superusers bypass RLS entirely** — testing policies
as yourself proves nothing.

```sql
create role anon_test nologin;
grant usage on schema public to anon_test;
grant select on workers, languages, work_history, reviews to anon_test;
grant insert on bookings to anon_test;
grant usage on sequence bookings_id_seq to anon_test;

set role anon_test;

select count(*) from workers;                    -- 23, allowed
insert into bookings (worker_id, name, contact, booking_date, booking_time, job)
  values (1, 'Edgar', '0712345678', '2026-09-01', '10:00', 'Fix leaking pipe');
                                                 -- INSERT 0 1, allowed
select count(*) from bookings;                   -- blocked

reset role;
```

The insert succeeding and the read-back failing is the whole design working.
Clean up afterwards:

```sql
drop owned by anon_test;
drop role anon_test;
delete from bookings;
```

`drop owned by` is required first — a role holding grants cannot be dropped.

## 14. What this leaves open

**Live average rating.** `workers.rating` is a static seeded column, so a new
review will not move it:

```sql
create view worker_ratings as
select w.id,
       round(avg(r.rating), 1) as rating,
       count(r.id)             as review_count
from workers w
left join reviews r on r.worker_id = w.id
group by w.id;
```

PostgREST exposes views as endpoints too, so the client change is small.

**Constraints that currently live only in React.** The "no past dates" rule
belongs in a `0002` migration:

```sql
alter table bookings add constraint bookings_not_in_past
  check (booking_date >= current_date);
```

**Auth.** Every policy currently says `using (true)`. Once login exists,
policies become expressions over `auth.uid()` — for example, a worker seeing
only their own bookings:

```sql
create policy "workers read own bookings" on bookings for select
  using (worker_id in (select id from workers where user_id = auth.uid()));
```

That is the payoff for putting the rules in the database rather than in React:
adding auth changes policies, not components.
