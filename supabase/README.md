# Supabase setup

## 1. Create the project (you must do this — it needs your account)

1. Go to https://supabase.com and sign in.
2. Create a new project. Pick a region close to Kenya (e.g. `eu-central-1`).
3. Wait for it to finish provisioning.

## 2. Create the tables

Supabase dashboard → **SQL Editor** → New query → paste the contents of
`migrations/0001_init.sql` → **Run**.

## 3. Load the data

Same place: paste `seed.sql` → **Run**. It clears the catalogue tables first,
so it is safe to re-run.

Check **Table Editor → workers**: you should see 23 rows.

## 4. Point React at the project

Dashboard → **Project Settings → API**. Copy the **Project URL** and the
**anon public** key, then:

```bash
cp react-app/.env.example react-app/.env.local
```

Fill in the two values in `.env.local` and restart `npm run dev`.
`.env.local` is gitignored — never commit it.

## Testing the SQL without Supabase

Both SQL files are plain PostgreSQL, so you can run them against a local
Postgres to check they work before touching the hosted project:

```bash
createdb find_my_artisan
psql -d find_my_artisan -v ON_ERROR_STOP=1 -f supabase/migrations/0001_init.sql
psql -d find_my_artisan -v ON_ERROR_STOP=1 -f supabase/seed.sql
```

You should get 23 workers, 48 languages, 35 work_history rows, 29 reviews.

This only tests the database. The React app talks to Supabase's REST API, not
raw Postgres, so it cannot point at a local database like this.

## What the RLS policies allow

| Table          | Read from the browser | Write from the browser |
| -------------- | --------------------- | ---------------------- |
| `workers`      | yes                   | no                     |
| `languages`    | yes                   | no                     |
| `work_history` | yes                   | no                     |
| `reviews`      | yes                   | no                     |
| `bookings`     | **no**                | insert only            |

Bookings are write-only from the browser on purpose: anyone can submit a
request, nobody can list other people's requests. Read them in the dashboard's
Table Editor, which bypasses RLS.

Because there is no select policy on `bookings`, the insert in
`react-app/src/api/workers.js` deliberately does **not** chain `.select()` —
asking for the inserted row back would come back as an error.

## Going deeper

`TECHNICAL-NOTES.md` explains the reasoning behind the schema: type choices,
constraints, sequences, indexes, how RLS is actually evaluated, and how
PostgREST turns the tables into an HTTP API.

## Where the data came from

`seed.sql` was generated from `react-app/src/data/mockData.js`. That file is
kept as the source of the seed data; the app no longer imports it.
