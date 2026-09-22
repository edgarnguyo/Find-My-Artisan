# Getting the app running

Everything below is a one-time setup. After this, one command starts the app.

The app runs entirely on your own computer: a React front end and an Express
API, both served by **one server** on http://localhost:5001, plus a MySQL
database. Accounts and bookings you create exist only on your machine.
`LAB-EXPLAINED.md` explains what each part does and how they connect.

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

The front end and the server each have their own packages, so install both.
Run this even if you have run the app before: Supabase was removed and the
server has new packages.

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

One terminal, left running:

```bash
cd server
npm run dev
```

This starts the Express server and builds the React site into
`react-app/dist`. Wait until the terminal shows both `[api] Server running on
port 5001` and `[react] ... built in`, then open **http://localhost:5001**.

When you save a change to a React file, the site is rebuilt automatically
(`[react] ... built in` appears again). Refresh the browser to see it. Saving a
server file restarts the server.

In VS Code you can do the same with Run and Debug → **Run lab in VS Code** → F5.

To run it without rebuilding on save (for example for a demo):

```bash
cd server
npm run build
npm start
```

## What changed in this version

Supabase is gone. Everything lives in MySQL, and one Express server hands the
browser both the React site and the data:

```
Browser  --http://localhost:5001-->  Express  --SQL-->  MySQL
           pages from react-app/dist
           data from /artisans, /clients…
```

| Lab step | In this project |
|---|---|
| Step 1–2: server folder, `.env`, `.gitignore` | `server/` |
| Step 3: `db.js` and the SQL | `server/db.js`, `server/schema.sql` |
| Step 4: `index.js` | `server/index.js` |
| Step 5: route files | `server/routes/artisans.js`, `clients.js`, `bookings.js`, `login.js` |
| Step 7: React component that fetches | `react-app/src/components/ArtisansTable.jsx` (page `/artisans-table`) |
| Step 8: run both servers | One server: Express also sends the built React files |
| Exercise 3: a second table and route | `clients` table, `/clients` |
| Exercise 4: POST route + form that inserts | sign-up form → `POST /clients` or `POST /profiles`; booking form → `POST /bookings` |

- **Every request goes through `src/api/`.** `workers.js` has artisans and
  bookings, `auth.js` has sign-up and sign-in. Add new calls there rather than
  calling `fetch` from a component.
- **Sign-up** inserts a row into `clients` or `artisans`. **Sign-in**
  (`POST /login`) looks the email up and checks the password, then returns
  the user, which React keeps in `localStorage`.
- Passwords are saved as typed, to keep the lab simple. Don't reuse a real
  password when testing.
- To see what was saved: http://localhost:5001/clients and
  http://localhost:5001/artisans.
- `react-app/dist` is generated by the build and gitignored; never edit it.

Data still arrives asynchronously, so a lookup has loading, error, and
not-found states:

```js
import { fetchWorkerById } from '../workers';
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

**The page says "The React site is not built yet"**
The first build hasn't finished. Wait for `[react] ... built in` in the
terminal and refresh. If it never appears, run `npm install` in `react-app/`.

**A React change doesn't show up**
Check the terminal printed `[react] ... built in` after you saved, then refresh
the browser.

**`could not reach the API at http://localhost:5001`**
The server isn't running. Start it (step 4).

**`ECONNREFUSED` or `Access denied for user 'root'` in the terminal**
MySQL isn't running, or `DB_PASSWORD` in `server/.env` is wrong. Fix it, then
stop the server with Ctrl-C and run `npm run dev` again; `.env` is only read at
startup.

**`Table 'find_my_artisan.clients' doesn't exist`**
The database hasn't been set up. Run step 3's `source schema.sql` command.

**`EADDRINUSE: address already in use :::5001`**
Another copy of the server is still running. Stop it first.

**`Failed to resolve import` or `Cannot find module`**
You skipped step 2 for that folder. Run `npm install` inside it.

**Prices show `â€“` instead of `–`**
The data was loaded with the wrong character encoding. Run step 3's
`source schema.sql` command again.

## Reference

- `LAB-EXPLAINED.md` — what the lab teaches: each part, then how they work together
- `server/index.js` — the one server: API routes, then the React site
- `server/schema.sql` — every table and the sample data
- `server/routes/` — the API endpoints (`artisans`, `clients`, `login`, `bookings`)
- `GIT-NOTES.md` — git commands and workflow
