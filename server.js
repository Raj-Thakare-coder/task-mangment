const express = require('express');
const path = require('path');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = 3000;
const JWT_SECRET = 'dev-secret-key-change-in-production';

// ─── Database Setup (ORM-like wrapper) ───────────────────────────────────────
const db = new Database('./data.db');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    content TEXT,
    category TEXT DEFAULT 'General',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

// Simple ORM-like model layer
const User = {
  findByEmail: db.prepare('SELECT * FROM users WHERE email = ?'),
  findById:    db.prepare('SELECT id, name, email, created_at FROM users WHERE id = ?'),
  create:      db.prepare('INSERT INTO users (name, email, password) VALUES (?, ?, ?)'),
};

const Note = {
  findAll:    db.prepare('SELECT * FROM notes WHERE user_id = ? ORDER BY created_at DESC'),
  findOne:    db.prepare('SELECT * FROM notes WHERE id = ? AND user_id = ?'),
  create:     db.prepare('INSERT INTO notes (user_id, title, content, category) VALUES (?, ?, ?, ?)'),
  update:     db.prepare('UPDATE notes SET title = ?, content = ?, category = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?'),
  delete:     db.prepare('DELETE FROM notes WHERE id = ? AND user_id = ?'),
};

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// JWT Auth Guard
function authGuard(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  try {
    req.user = jwt.verify(auth.slice(7), JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Request logger middleware
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  }
  next();
});

// ─── Auth Routes ─────────────────────────────────────────────────────────────

// POST /api/auth/register
app.post('/api/auth/register', async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password)
    return res.status(400).json({ error: 'Name, email and password are required' });

  if (password.length < 6)
    return res.status(400).json({ error: 'Password must be at least 6 characters' });

  if (User.findByEmail.get(email))
    return res.status(409).json({ error: 'Email already registered' });

  const hashed = await bcrypt.hash(password, 10);
  const result = User.create.run(name, email, hashed);
  const user = User.findById.get(result.lastInsertRowid);

  const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
  res.status(201).json({ user, token });
});

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ error: 'Email and password are required' });

  const user = User.findByEmail.get(email);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(401).json({ error: 'Invalid credentials' });

  const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
  const { password: _, ...safeUser } = user;
  res.json({ user: safeUser, token });
});

// GET /api/auth/me
app.get('/api/auth/me', authGuard, (req, res) => {
  const user = User.findById.get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user });
});

// ─── CRUD Routes (Notes) ─────────────────────────────────────────────────────

// CREATE — POST /api/notes
app.post('/api/notes', authGuard, (req, res) => {
  const { title, content = '', category = 'General' } = req.body;
  if (!title) return res.status(400).json({ error: 'Title is required' });

  const result = Note.create.run(req.user.id, title, content, category);
  const note = Note.findOne.get(result.lastInsertRowid, req.user.id);
  res.status(201).json({ note });
});

// READ ALL — GET /api/notes
app.get('/api/notes', authGuard, (req, res) => {
  const notes = Note.findAll.all(req.user.id);
  res.json({ notes });
});

// READ ONE — GET /api/notes/:id
app.get('/api/notes/:id', authGuard, (req, res) => {
  const note = Note.findOne.get(req.params.id, req.user.id);
  if (!note) return res.status(404).json({ error: 'Note not found' });
  res.json({ note });
});

// UPDATE — PUT /api/notes/:id
app.put('/api/notes/:id', authGuard, (req, res) => {
  const { title, content = '', category = 'General' } = req.body;
  if (!title) return res.status(400).json({ error: 'Title is required' });

  const existing = Note.findOne.get(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: 'Note not found' });

  Note.update.run(title, content, category, req.params.id, req.user.id);
  const updated = Note.findOne.get(req.params.id, req.user.id);
  res.json({ note: updated });
});

// DELETE — DELETE /api/notes/:id
app.delete('/api/notes/:id', authGuard, (req, res) => {
  const existing = Note.findOne.get(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: 'Note not found' });

  Note.delete.run(req.params.id, req.user.id);
  res.status(204).send();
});

// ─── Fallback ─────────────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n🚀 Server running at http://localhost:${PORT}`);
  console.log(`📦 SQLite DB: data.db`);
  console.log(`🔐 JWT Secret: ${JWT_SECRET}\n`);
});
