# What the React + Express + MySQL lab teaches

The lab builds one feature: a web page that shows rows stored in a database.
That takes three separate parts, and the lesson is what each one does and how
they pass data to each other.

In this project the lab's `students` table became `artisans`. The lab's page is
http://localhost:5001/artisans-table, built by
`react-app/src/components/ArtisansTable.jsx`.

- [Part 1: The components](#part-1-the-components)
  1. [MySQL: the database](#1-mysql-the-database)
  2. [Express: the backend API](#2-express-the-backend-api)
  3. [React: the frontend](#3-react-the-frontend)
- [Part 2: How they work together](#part-2-how-they-work-together)

---

## Part 1: The components

### 1. MySQL: the database

**MySQL** is a program that stores data in tables on disk and answers requests
written in **SQL** (Structured Query Language). Data in MySQL stays there after
servers restart or the computer turns off.

- A **table** is a set of rows that all have the same columns.
- A **row** is one record, such as one artisan.
- A **column** is one piece of information every row has, such as `name`.

```sql
CREATE TABLE clients (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE
);

INSERT INTO clients (name, email) VALUES ('Amina Yusuf', 'amina@example.com');

SELECT id, name FROM clients;   -- returns: 1 | Amina Yusuf
```

| Keyword | Meaning |
|---|---|
| `INT`, `VARCHAR(100)` | The column holds a whole number / text up to 100 characters |
| `PRIMARY KEY` | No two rows can share this value, so it identifies exactly one row |
| `AUTO_INCREMENT` | MySQL fills in the next number (1, 2, 3...) for each new row |
| `NOT NULL` | The column can't be left empty |
| `UNIQUE` | No two rows can have the same value, e.g. two accounts with one email |

**Where it is:** `server/schema.sql` creates the database, the tables
(`artisans`, `clients`, `bookings`, `languages`, `work_history`, `reviews`) and
the 23 sample artisans.

**Why a database is needed:** React's data disappears when the page reloads,
and each visitor has their own copy. Data in MySQL is kept permanently and is
the same for everyone who uses the site.

`schema.sql` runs only when you run it (`mysql -u root < schema.sql`). It does
not run when someone uses the website; that data arrives through Express.

---

### 2. Express: the backend API

**Express** is a Node.js library for writing a **server**: a program that waits
on a **port** for **HTTP requests** and sends back a response.

- A **port** is a number that tells the computer which program a request is
  for. This project's server uses port 5001 and MySQL uses 3306. (The lab uses
  5000 for Express and 3000 for React.)
- An **HTTP request** is a message with a **method** and a **URL path**, for
  example `GET /artisans`.
- A **route** is a method + path, plus the function that runs when a request
  matches them.
- An **API** (Application Programming Interface) is the set of routes other
  programs can call.
- **JSON** (JavaScript Object Notation) is the text format the API replies in:
  `[{"id":1,"name":"Wanjiru Kamau"}]`.

| Method | Used to | Example in this project |
|---|---|---|
| `GET` | Read data | `GET /artisans` |
| `POST` | Create something new | `POST /clients` (sign-up) |
| `PATCH` | Change part of something | `PATCH /bookings/7/cancel` |

A route from `server/routes/artisans.js`:

```js
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT id, name, skill FROM artisans ORDER BY id');
    res.json(rows);                  // 200 OK + the rows as JSON
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch artisans' });
  }
});
```

- `req` (request) holds what the browser sent: `req.params`, `req.query`, `req.body`.
- `res` (response) sends the answer back: `res.json(...)`, `res.status(...)`.
- `try/catch` catches a failed query, so the browser gets a clear error
  instead of a request that never finishes.

**Status codes** tell the browser how the request went:

| Code | Meaning | When this API sends it |
|---|---|---|
| 200 | OK | Data returned |
| 201 | Created | A new row was inserted |
| 400 | Bad request | A required field is missing |
| 401 | Unauthorized | Wrong email or password |
| 404 | Not found | No artisan with that id |
| 409 | Conflict | That email already has an account |
| 500 | Server error | The query failed |

#### The smaller pieces Express uses

| Piece | What it does | Why it's there |
|---|---|---|
| `server/index.js` | Creates the app, adds `cors()` and `express.json()`, attaches each route file to a path (`app.use('/artisans', artisanRoutes)`), serves the React site, starts listening on the port | It's the program `npm run dev` starts |
| `server/routes/*.js` | One file per table, each with its routes | Keeps each table's code in one place |
| `server/db.js` + **mysql2** | Creates a **connection pool**: up to 10 open connections to MySQL that routes take turns using | Opening a new connection for every request is slow |
| `server/.env` + **dotenv** | Keeps settings like `DB_PASSWORD` outside the code; the code reads `process.env.DB_PASSWORD` | `.env` is in `.gitignore`, so the password never reaches GitHub |
| **cors** | Adds a response header saying other origins may read the reply | Needed when the page and the API are on different ports (see Part 2) |
| `express.json()` | Turns the JSON text of a POST body into the object `req.body` | Without it, `req.body` is `undefined` |
| `express.static(folder)` | Sends back files from a folder when their path is requested | Lets the same server hand out the built React site |
| **nodemon** | Restarts the server whenever you save a server `.js` file | You don't have to stop and start it by hand |
| `?` placeholders | `db.query('... WHERE id = ?', [id])` sends the values separately from the SQL | Text typed into a form can't run as SQL (SQL injection) |

---

### 3. React: the frontend

**React** is a JavaScript library for building a page out of **components**. A
component is a function that returns what should appear on screen. React runs
in the browser.

The browser can't run React's JSX (`<table>` inside JavaScript) directly.
**Vite** is the build tool that turns the code in `react-app/src` into plain
HTML, JavaScript and CSS files the browser can run.

The lab's component, as used in `ArtisansTable.jsx` (shortened):

```jsx
export default function ArtisansTable() {
  const [artisans, setArtisans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('http://localhost:5001/artisans')
      .then((res) => {
        if (!res.ok) throw new Error('Network response was not ok');
        return res.json();
      })
      .then((data) => { setArtisans(data); setLoading(false); })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, []);

  if (loading) return <p>Loading artisans...</p>;
  if (error) return <p>Error: {error}</p>;

  return (
    <table>
      <tbody>
        {artisans.map((artisan) => (
          <tr key={artisan.id}>
            <td>{artisan.name}</td>
            <td>{artisan.skill}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

| Part | What it is | Why it's used here |
|---|---|---|
| `useState([])` | **State**: a value React remembers between redraws. Calling the setter (`setArtisans`) changes it and makes React draw the component again | The data arrives after the first draw, so the component must be able to redraw with it |
| three states | `artisans`, `loading`, `error` | A request is always waiting, failed, or done; each needs different output |
| `useEffect(() => {...}, [])` | An **effect**: code React runs *after* drawing. The empty `[]` means run once, when the component first appears | Fetching inside the component body would run on every redraw: fetch → setState → redraw → fetch again, forever |
| `fetch(url)` | The browser's function for sending an HTTP request. It returns a **Promise**, a value that arrives later, handled with `.then` | It's how React reaches Express |
| `res.json()` | Turns the JSON text into a JavaScript array | So `.map` can loop over it |
| `.map(...)` | Makes one `<tr>` for each item in the array | One table row per database row |
| `key={artisan.id}` | A unique label for each row | React uses it to tell rows apart when the list changes |

The rest of the site works the same way. Every call to Express is in
`react-app/src/api/` (`workers.js` for artisans and bookings, `auth.js` for
sign-up and sign-in), so components don't repeat `fetch` code.

---

## Part 2: How they work together

### Why Express sits between the browser and MySQL

The browser can't talk to MySQL directly:

- MySQL doesn't use HTTP, the only way a web page can send requests.
- Connecting to MySQL needs the database password. Anything in React code is
  downloaded to every visitor's browser, so the password would be public.

Express sits in between. It holds the password (in `.env`), decides which
queries are allowed, and gives the browser only the results.

### The lab's two servers, and this project's one

**In the lab**, React and Express are two programs in two terminals: React's
development server on port 3000 sends the page, and Express on port 5000 sends
the data.

**In this project**, one Express server on port 5001 sends both:

```
                     ┌───────────────── Express, localhost:5001 ─────────────────┐
Browser  ── GET / ─▶ │ express.static → react-app/dist/index.html + JS + CSS     │
         ◀─ page ─── │                                                           │
                     │                                                           │  SQL   ┌────────────────┐
         ── GET ───▶ │ /artisans → routes/artisans.js → db.query(...)  ──────┼──────▶ │ MySQL :3306    │
         /artisans…  │                                                           │ ◀───── │ find_my_artisan│
         ◀─ JSON ─── │ res.json(rows)                                            │  rows  └────────────────┘
                     └───────────────────────────────────────────────────────────┘
```

How it does that, in `server/index.js`:

1. The API routes are attached first, so data requests reach them.
2. `express.static(reactBuild)` sends any real file from `react-app/dist`,
   such as `/assets/index-abc123.js`.
3. For any other `GET`, such as `/listings` or `/profile/3`, it sends
   `index.html`. Those addresses aren't files; React Router reads the address in
   the browser and shows the right page.

`npm run dev` in `server/` runs two things side by side: `nodemon index.js` (the
server) and `vite build --watch`, which rebuilds `react-app/dist` each time a
React file is saved. That's why the terminal lines start with `[api]` or
`[react]`, and why you refresh the browser to see a React change.

### Why `cors()` is in the lab

An **origin** is the protocol + host + port of a page, e.g.
`http://localhost:3000`. The browser treats `localhost:3000` and
`localhost:5000` as different origins. By default it won't let a page read a
reply from a different origin, a rule called the **same-origin policy**.

In the lab, the page comes from port 3000 and the data from 5000, so
`app.use(cors())` is required: it adds the header
`Access-Control-Allow-Origin: *`, telling the browser the reply may be read.

In this project the page and the data both come from port 5001, the same
origin, so the browser wouldn't block anything. `cors()` stays in `index.js`
so the lab's two-server setup (`npm run dev` inside `react-app/`, on port 5173)
still works.

### Reading data (GET): the lab's data flow

What happens when you open http://localhost:5001/artisans-table, and what the data
looks like at each step:

| # | Where | What happens | The data |
|---|---|---|---|
| 0 | Express | Sends `index.html` and the built JavaScript; the browser starts React, and React Router shows the `/artisans-table` page | The page's files |
| 1 | React | `ArtisansTable` draws for the first time; `loading` is `true` | "Loading artisans..." |
| 2 | React | `useEffect` runs and calls `fetch('http://localhost:5001/artisans')` | An HTTP request: `GET /artisans` |
| 3 | Express | `index.js` sees the path starts with `/artisans` and hands the request to `routes/artisans.js` | |
| 4 | Express | The route borrows a connection from the pool and runs the query | `SELECT ... FROM artisans ORDER BY id` |
| 5 | MySQL | Finds the rows and sends them back | 23 rows |
| 6 | Express | `res.json(rows)` turns the rows into JSON text and sends it with status 200 | `[{"id":1,"name":"Wanjiru Kamau",...}, ...]` |
| 7 | React | `res.json()` turns the text into an array; `setArtisans(data)` and `setLoading(false)` update state | A JavaScript array of 23 objects |
| 8 | React | State changed, so React draws again; `.map` makes one `<tr>` per artisan | The table on screen |

Because the page asks the database every time it loads, a change in MySQL shows
up after a refresh without editing any code:

```bash
mysql -u root find_my_artisan -e "UPDATE artisans SET rating = 5.0 WHERE id = 1;"
```

### Saving data (POST): lab exercise 4

The same chain runs in the other direction when a form saves data. Signing up
as a client:

| # | Where | What happens | The data |
|---|---|---|---|
| 1 | React | `SignInPage.jsx` keeps each field in state and, on submit, checks the required fields are filled | |
| 2 | React | `api/auth.js` sends the form with `fetch(..., { method: 'POST', body: JSON.stringify(details) })` | `POST /clients` with `{"name":"Amina","email":"amina@example.com","password":"secret1",...}` |
| 3 | Express | `express.json()` turns the body into `req.body` | `req.body.name === "Amina"` |
| 4 | Express | `routes/clients.js` checks the fields, then checks the email isn't already used | `400` or `409` if not |
| 5 | MySQL | The route runs the insert with `?` placeholders | `INSERT INTO clients (name, email, password, phone, location) VALUES (?, ?, ?, ?, ?)` |
| 6 | Express | Replies with the new row's id (`result.insertId`) | `201` + `{"id":1,"name":"Amina","role":"client"}` |
| 7 | React | `AuthProvider.jsx` saves that user in `localStorage` and in state, so the navbar shows you signed in | |

To confirm the row was saved, open http://localhost:5001/clients. That's a
`GET` route reading the same table the `POST` just wrote to.

In this lab version passwords are saved exactly as typed, to keep it simple. A
real site stores a **hash** instead: a scrambled version that can't be turned
back into the password.

### When something breaks: which link failed

Each error points at one link in the chain. The lab's troubleshooting table,
applied to this project:

| You see | Broken link | Check |
|---|---|---|
| The browser can't open `localhost:5001` at all | The server | Is `npm run dev` running in `server/`? |
| "The React site is not built yet" | Express → React build | Wait for `[react] ... built in`, then refresh |
| `Error: Failed to fetch` / `could not reach the API` | React → Express | Is the server running? Does the URL use port 5001? |
| `CORS policy` error in the browser console | React → Express | Only happens when the page comes from another port: is `app.use(cors())` above the routes? |
| `Cannot GET /clients` (or another API path) | Inside Express | Does the path match `app.use(...)` in `index.js` plus the route in the route file? |
| `ECONNREFUSED` or `Access denied` in the terminal | Express → MySQL | Is MySQL running? Are the values in `server/.env` right? |
| Status 500 in the browser, error in the terminal | Express → MySQL | Read the SQL error the route printed: wrong table or column name? |
| Table shows but is empty | MySQL | Does the table have rows? `SELECT * FROM artisans;` |

### Why the lab tests the backend on its own first

Step 6 opens the API's URL (here http://localhost:5001/artisans) in the
browser before writing any React. That URL uses only Express and MySQL.

- If the JSON appears, Express and MySQL work, so any later problem is in React.
- If it doesn't, the problem is in Express or MySQL, and React can't be the cause.

Testing one link at a time tells you where to look instead of guessing across
all three parts.

---

## What you should be able to explain after the lab

- What MySQL, Express and React each do, and which port each runs on.
- Why the browser needs Express in between instead of connecting to MySQL.
- What a route is, and the difference between `GET` and `POST`.
- What `db.js`, `.env`, `cors()` and `express.json()` are for.
- Why `useEffect` has `[]`, and why a component tracks `loading` and `error`.
- The steps data takes from a MySQL row to a table row on screen, and back
  again when a form is submitted.
- How one Express server can send both the React site and the data, and why the
  lab needs `cors()` when they're on two ports.
- How to tell which part is broken from the error you see.
