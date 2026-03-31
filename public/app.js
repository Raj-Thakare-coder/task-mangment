// ═══════════════════════════════════════════════════════════════════
//  NoteStack — Frontend App (app.js)
//  Covers: Auth, CRUD, ORM interaction, Client-Server communication
// ═══════════════════════════════════════════════════════════════════

// ── State ─────────────────────────────────────────────────────────
let token       = localStorage.getItem('ns_token') || null;
let currentUser = null;
let allNotes    = [];
let editingId   = null;
let filterCat   = 'all';
let searchQuery = '';

// ── Boot ──────────────────────────────────────────────────────────
(async () => {
  if (token) {
    try {
      const res = await api('GET', '/api/auth/me');
      currentUser = res.user;
      showApp();
    } catch {
      token = null;
      localStorage.removeItem('ns_token');
      showAuth();
    }
  } else {
    showAuth();
  }
})();

// ── Screens ───────────────────────────────────────────────────────
function showAuth() {
  const authScreen = document.getElementById('auth-screen');
  const appScreen = document.getElementById('app-screen');

  authScreen.classList.remove('hidden');
  authScreen.classList.add('active');

  appScreen.classList.remove('active');
  appScreen.classList.add('hidden');
}

function showApp() {
  const authScreen = document.getElementById('auth-screen');
  const appScreen = document.getElementById('app-screen');

  authScreen.classList.remove('active');
  authScreen.classList.add('hidden');

  appScreen.classList.remove('hidden');
  appScreen.classList.add('active');

  populateSidebar();
  loadNotes();
  showView('notes');
}

// ── Auth Tab Switch ───────────────────────────────────────────────
function switchAuthTab(tab) {
  document.querySelectorAll('.auth-tab').forEach((t, i) => {
    t.classList.toggle('active', (i === 0 && tab === 'login') || (i === 1 && tab === 'register'));
  });
  document.getElementById('login-form').classList.toggle('hidden', tab !== 'login');
  document.getElementById('register-form').classList.toggle('hidden', tab !== 'register');
}

// ── Register ─────────────────────────────────────────────────────
async function handleRegister() {
  const name     = v('reg-name');
  const email    = v('reg-email');
  const password = v('reg-password');
  const errEl    = document.getElementById('reg-error');
  errEl.classList.add('hidden');

  if (!name || !email || !password) return showErr(errEl, 'All fields are required.');

  try {
    const res = await api('POST', '/api/auth/register', { name, email, password });
    token = res.token;
    currentUser = res.user;
    localStorage.setItem('ns_token', token);
    toast('Account created! Welcome, ' + currentUser.name, 'success');
    showApp();
  } catch (err) {
    showErr(errEl, err.message);
  }
}

// ── Login ─────────────────────────────────────────────────────────
async function handleLogin() {
  const email    = v('login-email');
  const password = v('login-password');
  const errEl    = document.getElementById('login-error');
  errEl.classList.add('hidden');

  if (!email || !password) return showErr(errEl, 'Email and password are required.');

  try {
    const res = await api('POST', '/api/auth/login', { email, password });
    token = res.token;
    currentUser = res.user;
    localStorage.setItem('ns_token', token);
    toast('Welcome back, ' + currentUser.name + '!', 'success');
    showApp();
  } catch (err) {
    showErr(errEl, err.message);
  }
}

// ── Logout ────────────────────────────────────────────────────────
function handleLogout() {
  token = null;
  currentUser = null;
  allNotes = [];
  localStorage.removeItem('ns_token');
  showAuth();
}

// ── Sidebar ───────────────────────────────────────────────────────
function populateSidebar() {
  document.getElementById('sidebar-name').textContent  = currentUser.name;
  document.getElementById('sidebar-email').textContent = currentUser.email;
  document.getElementById('sidebar-avatar').textContent = currentUser.name[0].toUpperCase();
}

// ── View Switching ────────────────────────────────────────────────
function showView(view) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('view-' + view).classList.add('active');
  document.querySelector(`[data-view="${view}"]`)?.classList.add('active');

  if (view === 'profile') populateProfile();
}

// ── Notes: Load ───────────────────────────────────────────────────
async function loadNotes() {
  try {
    const res = await api('GET', '/api/notes');
    allNotes = res.notes;
    renderNotes();
  } catch (err) {
    toast('Failed to load notes: ' + err.message, 'error');
  }
}

// ── Notes: Render ─────────────────────────────────────────────────
function renderNotes() {
  const grid  = document.getElementById('notes-grid');
  const empty = document.getElementById('notes-empty');

  let filtered = allNotes;
  if (filterCat !== 'all') filtered = filtered.filter(n => n.category === filterCat);
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(n =>
      n.title.toLowerCase().includes(q) || (n.content || '').toLowerCase().includes(q)
    );
  }

  if (filtered.length === 0) {
    grid.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }

  empty.classList.add('hidden');
  grid.innerHTML = filtered.map(note => `
    <div class="note-card" data-cat="${note.category}" onclick="openEditModal(${note.id})">
      <div class="note-header">
        <span class="note-title">${esc(note.title)}</span>
        <span class="note-cat cat-${note.category}">${note.category}</span>
      </div>
      <p class="note-content">${esc(note.content || 'No content')}</p>
      <div class="note-footer">
        <span class="note-date">${formatDate(note.created_at)}</span>
        <div class="note-actions">
          <button class="icon-btn" title="Edit" onclick="event.stopPropagation(); openEditModal(${note.id})">✎</button>
          <button class="icon-btn danger" title="Delete" onclick="event.stopPropagation(); deleteNote(${note.id})">✕</button>
        </div>
      </div>
    </div>
  `).join('');
}

// ── Notes: Filter & Search ────────────────────────────────────────
function filterNotes(cat, btn) {
  filterCat = cat;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderNotes();
}

function searchNotes(q) {
  searchQuery = q;
  renderNotes();
}

// ── Notes: Modal ──────────────────────────────────────────────────
function openModal() {
  editingId = null;
  document.getElementById('modal-title').textContent = 'New Note';
  document.getElementById('modal-save-btn').textContent = 'Save Note';
  document.getElementById('note-title').value   = '';
  document.getElementById('note-content').value = '';
  document.getElementById('note-category').value = 'General';
  document.getElementById('modal-error').classList.add('hidden');
  document.getElementById('modal-overlay').classList.remove('hidden');
  setTimeout(() => document.getElementById('note-title').focus(), 50);
}

function openEditModal(id) {
  const note = allNotes.find(n => n.id === id);
  if (!note) return;
  editingId = id;
  document.getElementById('modal-title').textContent = 'Edit Note';
  document.getElementById('modal-save-btn').textContent = 'Update Note';
  document.getElementById('note-title').value   = note.title;
  document.getElementById('note-content').value = note.content || '';
  document.getElementById('note-category').value = note.category;
  document.getElementById('modal-error').classList.add('hidden');
  document.getElementById('modal-overlay').classList.remove('hidden');
}

function closeModal(e) {
  if (e && e.target !== document.getElementById('modal-overlay')) return;
  document.getElementById('modal-overlay').classList.add('hidden');
}

// ── Notes: CREATE / UPDATE ────────────────────────────────────────
async function saveNote() {
  const title    = v('note-title');
  const content  = v('note-content');
  const category = document.getElementById('note-category').value;
  const errEl    = document.getElementById('modal-error');
  errEl.classList.add('hidden');

  if (!title) return showErr(errEl, 'Title is required.');

  try {
    if (editingId) {
      // UPDATE
      const res = await api('PUT', `/api/notes/${editingId}`, { title, content, category });
      const idx = allNotes.findIndex(n => n.id === editingId);
      if (idx !== -1) allNotes[idx] = res.note;
      toast('Note updated!', 'success');
    } else {
      // CREATE
      const res = await api('POST', '/api/notes', { title, content, category });
      allNotes.unshift(res.note);
      toast('Note created!', 'success');
    }
    document.getElementById('modal-overlay').classList.add('hidden');
    renderNotes();
  } catch (err) {
    showErr(errEl, err.message);
  }
}

// ── Notes: DELETE ─────────────────────────────────────────────────
async function deleteNote(id) {
  if (!confirm('Delete this note?')) return;
  try {
    await api('DELETE', `/api/notes/${id}`);
    allNotes = allNotes.filter(n => n.id !== id);
    renderNotes();
    toast('Note deleted.', 'success');
  } catch (err) {
    toast('Error: ' + err.message, 'error');
  }
}

// ── API Console ───────────────────────────────────────────────────
async function apiTest(method, path, body) {
  const logEl = document.getElementById('api-log');
  if (logEl.querySelector('.log-placeholder')) logEl.innerHTML = '';

  const entry = document.createElement('div');
  entry.className = 'log-entry';

  // Show request
  const bodyStr = body ? '\n  Body: ' + JSON.stringify(body, null, 2) : '';
  entry.innerHTML = `
    <div class="log-req">→ ${method} ${path}</div>
    <div class="log-header-line">  Authorization: Bearer ${token ? token.slice(0, 20) + '…' : 'none'}</div>
    ${body ? `<div class="log-body">  Body: ${JSON.stringify(body)}</div>` : ''}
    <div class="log-header-line">  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─</div>
  `;
  logEl.appendChild(entry);
  logEl.scrollTop = logEl.scrollHeight;

  const start = Date.now();
  try {
    const res = await apiRaw(method, path, body);
    const ms  = Date.now() - start;
    const json = res.status === 204 ? null : await res.json().catch(() => null);

    const resLine = document.createElement('div');
    resLine.className = res.ok ? 'log-res-ok' : 'log-res-err';
    resLine.textContent = `← ${res.status} ${res.statusText}  (${ms}ms)`;
    entry.appendChild(resLine);

    if (json) {
      const bodyLine = document.createElement('div');
      bodyLine.className = 'log-res-body';
      bodyLine.textContent = '  ' + JSON.stringify(json, null, 2).replace(/\n/g, '\n  ');
      entry.appendChild(bodyLine);
    }

    // Refresh notes if a CRUD action was performed
    if (path.startsWith('/api/notes') && (method !== 'GET')) loadNotes();

  } catch (err) {
    const errLine = document.createElement('div');
    errLine.className = 'log-res-err';
    errLine.textContent = '✗ Network error: ' + err.message;
    entry.appendChild(errLine);
  }

  logEl.scrollTop = logEl.scrollHeight;
}

async function apiTestOne() {
  const id = allNotes[0]?.id;
  if (!id) { toast('Create a note first!', 'error'); return; }
  await apiTest('GET', `/api/notes/${id}`);
}

async function apiTestUpdate() {
  const id = allNotes[0]?.id;
  if (!id) { toast('Create a note first!', 'error'); return; }
  await apiTest('PUT', `/api/notes/${id}`, { title: 'Updated via API Console', content: 'Edited at ' + new Date().toLocaleTimeString(), category: 'Work' });
}

async function apiTestDelete() {
  const id = allNotes[allNotes.length - 1]?.id;
  if (!id) { toast('Create a note first!', 'error'); return; }
  await apiTest('DELETE', `/api/notes/${id}`);
}

function clearLog() {
  document.getElementById('api-log').innerHTML = '<div class="log-placeholder">// Log cleared</div>';
}

// ── Profile ───────────────────────────────────────────────────────
function populateProfile() {
  document.getElementById('profile-name').textContent   = currentUser.name;
  document.getElementById('profile-email').textContent  = currentUser.email;
  document.getElementById('profile-id').textContent     = '#' + currentUser.id;
  document.getElementById('profile-joined').textContent = formatDate(currentUser.created_at);
  document.getElementById('stat-notes').textContent     = allNotes.length;

  // Decode JWT parts
  if (token) {
    const parts = token.split('.');
    try {
      const header  = JSON.parse(atob(parts[0]));
      const payload = JSON.parse(atob(parts[1]));
      document.getElementById('jwt-header').textContent  = JSON.stringify(header);
      document.getElementById('jwt-payload').textContent = JSON.stringify(payload);
    } catch { /* ignore */ }
  }
}

// ── HTTP Helper ───────────────────────────────────────────────────
async function api(method, path, body) {
  const res = await apiRaw(method, path, body);
  if (res.status === 204) return {};
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Request failed');
  return json;
}

async function apiRaw(method, path, body) {
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {})
    }
  };
  if (body) opts.body = JSON.stringify(body);
  return fetch(path, opts);
}

// ── Utilities ─────────────────────────────────────────────────────
function v(id) { return document.getElementById(id).value.trim(); }
function esc(str) { return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function showErr(el, msg) { el.textContent = msg; el.classList.remove('hidden'); }
function formatDate(dt) { return dt ? new Date(dt).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' }) : '—'; }

let toastTimer;
function toast(msg, type='success') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast ' + type;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.className = 'toast hidden', 3000);
}

// Enter key submits forms
document.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    if (!document.getElementById('login-form').classList.contains('hidden')) handleLogin();
    else if (!document.getElementById('register-form').classList.contains('hidden')) handleRegister();
  }
});
