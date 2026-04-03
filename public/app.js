const express = require('express');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = 3000;
const JWT_SECRET = 'dev-secret-key-change-in-production';
const DATA_FILE = path.join(__dirname, 'data.json');

function createDefaultStore() {
  return {
    users: [],
    notes: []
  };
}

function loadStore() {
  if (!fs.existsSync(DATA_FILE)) {
    const initialStore = createDefaultStore();
    fs.writeFileSync(DATA_FILE, JSON.stringify(initialStore, null, 2));
    return initialStore;
  }

  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      users: Array.isArray(parsed.users) ? parsed.users : [],
      notes: Array.isArray(parsed.notes) ? parsed.notes : []
    };
  } catch {
    const fallbackStore = createDefaultStore();
    fs.writeFileSync(DATA_FILE, JSON.stringify(fallbackStore, null, 2));
    return fallbackStore;
  }
}

function saveStore() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2));
}

function nextId(items) {
  return items.reduce((maxId, item) => Math.max(maxId, Number(item.id) || 0), 0) + 1;
}

function sanitizeUser(user) {
  if (!user) return null;
  const { password, ...safeUser } = user;
  return safeUser;
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function getUserByEmail(email) {
  const normalizedEmail = normalizeEmail(email);
  return store.users.find((user) => user.email === normalizedEmail) || null;
}

function getUserById(id) {
  return store.users.find((user) => user.id === Number(id)) || null;
}

function getNotesForUser(userId) {
  return store.notes
    .filter((note) => note.user_id === Number(userId))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

let store = loadStore();

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function authGuard(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    req.user = jwt.verify(auth.slice(7), JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  }
  next();
});

// ─── Auth Routes ─────────────────────────────────────────────────────────────
app.post('/api/auth/register', async (req, res) => {
  const { name, email, password } = req.body;
  const cleanName = String(name || '').trim();
  const cleanEmail = normalizeEmail(email);

  if (!cleanName || !cleanEmail || !password) {
    return res.status(400).json({ error: 'Name, email and password are required' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  if (getUserByEmail(cleanEmail)) {
    return res.status(409).json({ error: 'Email already registered' });
  }

  const hashed = await bcrypt.hash(password, 10);
  const user = {
    id: nextId(store.users),
    name: cleanName,
    email: cleanEmail,
    password: hashed,
    created_at: new Date().toISOString()
  };

  store.users.push(user);
  saveStore();

  const safeUser = sanitizeUser(user);
  const token = jwt.sign({ id: safeUser.id, email: safeUser.email }, JWT_SECRET, { expiresIn: '7d' });
  return res.status(201).json({ user: safeUser, token });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const user = getUserByEmail(email);

  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const match = await bcrypt.compare(password, user.password);
  if (!match) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const safeUser = sanitizeUser(user);
  const token = jwt.sign({ id: safeUser.id, email: safeUser.email }, JWT_SECRET, { expiresIn: '7d' });
  return res.json({ user: safeUser, token });
});

app.get('/api/auth/me', authGuard, (req, res) => {
  const user = getUserById(req.user.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  return res.json({ user: sanitizeUser(user) });
});

// ─── CRUD Routes (Notes) ─────────────────────────────────────────────────────
app.post('/api/notes', authGuard, (req, res) => {
  const { title, content = '', category = 'General' } = req.body;
  const cleanTitle = String(title || '').trim();

  if (!cleanTitle) {
    return res.status(400).json({ error: 'Title is required' });
  }

  const now = new Date().toISOString();
  const note = {
    id: nextId(store.notes),
    user_id: Number(req.user.id),
    title: cleanTitle,
    content: String(content || ''),
    category: String(category || 'General'),
    created_at: now,
    updated_at: now
  };

  store.notes.push(note);
  saveStore();
  return res.status(201).json({ note });
});

app.get('/api/notes', authGuard, (req, res) => {
  return res.json({ notes: getNotesForUser(req.user.id) });
});

app.get('/api/notes/:id', authGuard, (req, res) => {
  const noteId = Number(req.params.id);
  const note = store.notes.find((item) => item.id === noteId && item.user_id === Number(req.user.id));

  if (!note) {
    return res.status(404).json({ error: 'Note not found' });
  }

  return res.json({ note });
});

app.put('/api/notes/:id', authGuard, (req, res) => {
  const { title, content = '', category = 'General' } = req.body;
  const cleanTitle = String(title || '').trim();
  const noteId = Number(req.params.id);

  if (!cleanTitle) {
    return res.status(400).json({ error: 'Title is required' });
  }

  const note = store.notes.find((item) => item.id === noteId && item.user_id === Number(req.user.id));
  if (!note) {
    return res.status(404).json({ error: 'Note not found' });
  }

  note.title = cleanTitle;
  note.content = String(content || '');
  note.category = String(category || 'General');
  note.updated_at = new Date().toISOString();

  saveStore();
  return res.json({ note });
});

app.delete('/api/notes/:id', authGuard, (req, res) => {
  const noteId = Number(req.params.id);
  const index = store.notes.findIndex((item) => item.id === noteId && item.user_id === Number(req.user.id));

  if (index === -1) {
    return res.status(404).json({ error: 'Note not found' });
  }

  store.notes.splice(index, 1);
  saveStore();
  return res.status(204).send();
});

// ─── Fallback ─────────────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n🚀 Server running at http://localhost:${PORT}`);
  console.log(`📦 Data file: data.json`);
  console.log(`🔐 JWT Secret: ${JWT_SECRET}\n`);
});