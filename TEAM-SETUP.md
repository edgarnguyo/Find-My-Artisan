# Getting the app running

Everything below is a one-time setup. After this, `npm run dev` is all you need.

We share **one Supabase project** (Edgar's), so the database is already
created, seeded, and configured. You do not need a Supabase account.

## 0. If you are on Windows

Run every command on its **own line**. Windows PowerShell 5.1 (the one that
ships with Windows) does not support `&&`, and chaining with it fails to parse:

```
The token '&&' is not a valid statement separator in this version.
```

A `ParserError` means nothing ran at all, not that it half-worked.

Also: **do not keep the repo inside OneDrive.** OneDrive syncs the `.git`
folder while git is writing to it, which causes locked files, files that
appear modified for no reason, and occasionally a corrupted index. Somewhere
like `C:\Users\<you>\Projects\Find-My-Artisan` is safer.

## 1. Get the code

```bash
git switch main
git pull
```

If you have unfinished work on your own branch, bring main into it instead:

```bash
git switch person-a          # or person-b
git merge main
```

See "If you get merge conflicts" below.

## 2. Install dependencies

There is a new package (`@supabase/supabase-js`), so this step is required
even if you have run the app before.

```bash
cd react-app
npm install
```

## 3. Create your environment file

From inside `react-app/`:

```bash
cp .env.example .env.local
```

Open `react-app/.env.local` and paste in the two values Edgar sends you:

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

Three things people get wrong here:

- It must be `react-app/.env.local`, **not** the repo root. Vite only reads
  env files from the directory it runs in.
- Edit `.env.local`, **not** `.env.example`. `.env.example` is a committed
  template with placeholder values; real values there would be published.
- Never commit `.env.local`. It is gitignored — keep it that way.

## 4. Run it

```bash
npm run dev
```

Open http://localhost:5173.

## What changed in this version

Worker data no longer comes from `src/data/mockData.js`. It comes from a
PostgreSQL database through Supabase.

The practical consequence for your code: **data now arrives asynchronously.**
Anything that used to be

```js
import { WORKERS } from '../data/mockData';
const worker = WORKERS.find(w => w.id === id);
```

is now a request with loading, error, and not-found states:

```js
import { fetchWorkerById } from '../api/workers';
import { useAsync } from '../hooks/useAsync';

const { data: worker, error, loading } = useAsync(() => fetchWorkerById(id), [id]);
```

Every query the app makes lives in `src/api/workers.js`. Add new ones there
rather than calling `supabase` directly from a component.

Bookings are stored in the database instead of `localStorage`, and there are
now user accounts — sign up, then `/bookings` shows the artisans you booked.

## If you get merge conflicts

Most likely in `ListingsPage.jsx`, `ProfilePage.jsx`, `BookingForm.jsx`, or
`Navbar.jsx` — those changed the most.

```
<<<<<<< HEAD
  your version
=======
  the incoming version from main
>>>>>>> main
```

VS Code shows buttons above the conflict: **Accept Current Change** (keep
yours), **Accept Incoming Change** (keep theirs), **Accept Both Changes**.
They are shortcuts for editing by hand — check the result is what you
actually want, especially when both sides added imports and you need both.

Read the whole file afterwards: one file often has several conflicts, and the
red squiggles everywhere are usually one unresolved marker breaking the
parser, not many separate bugs.

Edit the file so it contains what you actually want, delete all three marker
lines, then:

```bash
git add <the-file>
git commit
```

Check you did not leave any markers behind:

```bash
git diff --check
```

To start over: `git merge --abort`.

`GIT-NOTES.md` in the repo root has more on this.

## Troubleshooting

**`Failed to resolve import "@supabase/supabase-js"`**
You skipped step 2. Run `npm install` inside `react-app/`.

**`Missing Supabase credentials`**
Step 3 went wrong, or you created the file while the dev server was running.
Vite reads env vars only at startup — stop it with Ctrl-C and run
`npm run dev` again.

**Artisans do not load, console shows a network error**
Check the URL and key in `.env.local` for stray spaces or quotes. The values
go in bare, with no quotation marks.

**Signup says the email address is invalid**
Tell Edgar. It means email confirmation got switched back on in the Supabase
dashboard.

## Reference

- `supabase/README.md` — how the database is set up
- `supabase/TECHNICAL-NOTES.md` — why the schema looks the way it does
- `GIT-NOTES.md` — git commands and workflow
