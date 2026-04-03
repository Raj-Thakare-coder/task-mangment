# RajStack — Full-Stack Demo App

A complete full-stack web application demonstrating:
- **User Authentication** (Register, Login, JWT)
- **CRUD Operations** (Create, Read, Update, Delete Notes)
- **Database connectivity via ORM** (SQLite + better-sqlite3)
- **Client–Server interaction** (REST API + fetch)

---

## Project Structure

```
fullstack-app/
├── server.js          ← Express server, routes, ORM models, JWT auth
├── package.json       ← Dependencies
├── data.db            ← SQLite database (auto-created on first run)
└── public/
    ├── index.html     ← Single-page application shell
    ├── style.css      ← All styles
    └── app.js         ← Frontend logic (auth, CRUD, API console)
```

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Start server
npm start

# 3. Open browser
http://localhost:3000
```

For auto-reload during development:
```bash
npm run dev
```

---

## API Endpoints

### Auth
| Method | Route | Description |
|--------|-------|-------------|
| POST | /api/auth/register | Create account |
| POST | /api/auth/login | Sign in, returns JWT |
| GET  | /api/auth/me | Get current user (auth required) |

### Notes (CRUD)
| Method | Route | Description |
|--------|-------|-------------|
| POST   | /api/notes | Create note |
| GET    | /api/notes | Read all notes |
| GET    | /api/notes/:id | Read one note |
| PUT    | /api/notes/:id | Update note |
| DELETE | /api/notes/:id | Delete note |

All `/api/notes` routes require `Authorization: Bearer <token>` header.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vanilla HTML, CSS, JavaScript (ES6+) |
| Backend | Node.js + Express |
| Auth | JWT (jsonwebtoken) + bcrypt |
| Database | SQLite (via better-sqlite3) |
| ORM style | Model objects wrapping prepared statements |

---

## How It Works

### Authentication Flow
1. Client sends `{ name, email, password }` to `POST /api/auth/register`
2. Server hashes password with bcrypt (10 salt rounds)
3. User stored in SQLite via ORM model
4. JWT signed and returned to client
5. Client stores JWT in `localStorage`
6. All protected requests include `Authorization: Bearer <token>`
7. `authGuard` middleware verifies JWT on every protected route

### CRUD Flow
1. Client sends request with JWT in header
2. `authGuard` middleware verifies token
3. Route handler validates request body
4. ORM model (prepared statement) executes DB query
5. Result returned as JSON with appropriate HTTP status

### ORM Layer
The app uses a lightweight ORM-style pattern:
```js
const Note = {
  findAll:  db.prepare('SELECT * FROM notes WHERE user_id = ?'),
  create:   db.prepare('INSERT INTO notes (user_id, title, ...) VALUES (...)'),
  update:   db.prepare('UPDATE notes SET title = ? WHERE id = ? AND user_id = ?'),
  delete:   db.prepare('DELETE FROM notes WHERE id = ? AND user_id = ?'),
};

// Usage (like Sequelize/Prisma):
const notes = Note.findAll.all(userId);
const note  = Note.create.run(userId, title, content, category);
```
