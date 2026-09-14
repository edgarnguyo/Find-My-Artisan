# Getting the app running

Everything below is a one-time setup. After this, starting the two servers is
all you need.

The app runs entirely on your own computer, the same way as the "Connecting a
React Frontend to a Database" lab: a React front end, an Express API, and a
MySQL database. Accounts and bookings you create exist only on your machine.

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

## Starting clean (do this if git is misbehaving)

`main` is the authoritative version of this project. If your local copy has
diverged — conflicts in dozens of files, "both added" everywhere, or git
refusing to switch branches — do not resolve them one by one. Reset to match
main instead.

**This permanently discards local work that is not on GitHub.** Copy the
folder somewhere else first if you are unsure.

Run these one per line:

```
git merge --abort
git fetch origin
git checkout -B main origin/main
git reset --hard origin/main
git clean -fd
```

`git clean -fd` removes leftover untracked files. It does not touch
`node_modules` or `server/.env`, which are gitignored.

Then continue from step 2 below (`npm install`).

Check it worked:

```
git log --oneline -5
git status
```

You should see the project's recent commit messages, and "working tree clean".

### Why this happens

If you see `AA` / "both added" on nearly every file, your local repository and
the GitHub one have no shared history — usually because the folder was set up
with `git init` and files copied in, rather than with `git clone`. Git then
treats every file as independently created by both sides, so there is nothing
sensible to merge. Resetting to `origin/main` is the fix; hand-resolving is
not.

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

The front end and the API each have their own packages, so install both. Run
this even if you have run the app before: Supabase was removed and the API uses
`bcryptjs` to hash passwords.

```bash
cd server
npm install
cd ../react-app
npm install
```

## 3. Set up MySQL

You need MySQL 8 or newer, installed and running.

- macOS: `brew install mysql`, then `brew services start mysql`
- Windows: install it with the MySQL Installer and let it run as a service

From inside `server/`, create your environment file:

```bash
cp .env.example .env
```

(PowerShell: `Copy-Item .env.example .env`)

Open `server/.env` and set `DB_PASSWORD` to your MySQL root password. Leave it
blank if root has no password. Never commit `.env`; it is gitignored.

Then, still inside `server/`, create the database, its tables and the 23 sample
artisans:

```bash
mysql -u root -p -e "source schema.sql"
```

Press Enter at the password prompt if root has no password. It is safe to run
again later: people who signed up and their bookings are kept.

## 4. Run it

Two terminals, both left running:

```bash
cd server
npm run dev
```

```bash
cd react-app
npm run dev
```

Wait for `Server running on port 5001` and `ready in ... ms`, then open
http://localhost:5173.

In VS Code you can do both at once instead: Run and Debug → **Run lab in VS
Code** → F5.

## What changed in this version

Supabase is gone. Everything lives in MySQL, and React reaches it only through
the Express API in `server/`, exactly as in the lab:

```
React (5173)  --fetch-->  Express (5001)  --SQL-->  MySQL
```

| Lab step | In this project |
|---|---|
| Step 1–2: server folder, `.env`, `.gitignore` | `server/` |
| Step 3: `db.js` and the SQL | `server/db.js`, `server/schema.sql` |
| Step 4: `index.js` | `server/index.js` |
| Step 5: route files | `server/routes/artisans.js`, `clients.js`, `bookings.js`, `login.js` |
| Step 7: React component that fetches | `react-app/src/components/ArtisansTable.jsx` (page `/artisans`) |
| Exercise 3: a second table and route | `clients` table, `/api/clients` |
| Exercise 4: POST route + form that inserts | sign-up form → `POST /api/clients` or `POST /api/artisans`; booking form → `POST /api/bookings` |

- **Every request goes through `src/api/`.** `workers.js` has artisans and
  bookings, `auth.js` has sign-up and sign-in. Add new calls there rather than
  calling `fetch` from a component.
- **Sign-up** hashes the password with bcrypt and inserts a row into `clients`
  or `artisans`. **Sign-in** (`POST /api/login`) checks the password with
  `bcrypt.compare` and returns the user, which React keeps in `localStorage`.
- To see what was saved: http://localhost:5001/api/clients and
  http://localhost:5001/api/artisans.

Data still arrives asynchronously, so a lookup has loading, error, and
not-found states:

```js
import { fetchWorkerById } from '../api/workers';
import { useAsync } from '../hooks/useAsync';

const { data: worker, error, loading } = useAsync(() => fetchWorkerById(id), [id]);
```

## If you get merge conflicts

Most likely in `ListingsPage.jsx`, `ProfilePage.jsx`, `BookingForm.jsx`,
`SignInPage.jsx` or `Navbar.jsx` — those changed the most.

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

**`could not reach the API at http://localhost:5001`**
The API isn't running. Start it (step 4, first terminal).

**`ECONNREFUSED` or `Access denied for user 'root'` in the API terminal**
MySQL isn't running, or `DB_PASSWORD` in `server/.env` is wrong. Fix it, then
stop the API with Ctrl-C and run `npm run dev` again; `.env` is only read at
startup.

**`Table 'find_my_artisan.clients' doesn't exist`**
The database hasn't been set up. Run step 3's `source schema.sql` command.

**`EADDRINUSE: address already in use :::5001`**
Another copy of the API is still running. Stop it first.

**`Failed to resolve import` or `Cannot find module`**
You skipped step 2 for that folder. Run `npm install` inside it.

**Prices show `â€“` instead of `–`**
The data was loaded with the wrong character encoding. Run step 3's
`source schema.sql` command again.

## Reference

- `server/schema.sql` — every table and the sample data
- `server/routes/` — the API endpoints (`artisans`, `clients`, `login`, `bookings`)
- `GIT-NOTES.md` — git commands and workflow
