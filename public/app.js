'use strict'; // RajStack Frontend

// ═══════════════════════════════════════════════════════════════════════
// Global State
// ═══════════════════════════════════════════════════════════════════════

let authToken = localStorage.getItem('authToken') || null;
let currentUser = null;
let notes = [];

// ═══════════════════════════════════════════════════════════════════════
// DOM & View Management
// ═══════════════════════════════════════════════════════════════════════

const authScreen = document.getElementById('auth-screen');
const appScreen = document.getElementById('app-screen');

function showScreen(screen) {
  authScreen.classList.toggle('hidden', screen !== 'auth');
  appScreen.classList.toggle('hidden', screen !== 'app');
}

function showView(view) {
  const views = document.querySelectorAll('.view');
  views.forEach(v => v.classList.add('hidden'));
  views.forEach(v => v.classList.remove('active'));
  
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => item.classList.remove('active'));
  
  const targetView = document.getElementById(`view-${view}`);
  if (targetView) {
    targetView.classList.remove('hidden');
    targetView.classList.add('active');
  }
  
  const activeNav = document.querySelector(`[data-view="${view}"]`);
  if (activeNav) activeNav.classList.add('active');
  
  if (view === 'notes') loadNotes();
  if (view === 'profile') loadProfile();
}

function switchAuthTab(tab) {
  const tabs = document.querySelectorAll('.auth-tab');
  const forms = document.querySelectorAll('.auth-form');
  
  tabs.forEach(t => t.classList.remove('active'));
  forms.forEach(f => f.classList.add('hidden'));
  
  document.querySelector(`[onclick*="'${tab}'"]`)?.classList.add('active');
  document.getElementById(`${tab}-form`)?.classList.remove('hidden');
}

// ═══════════════════════════════════════════════════════════════════════
// Authentication
// ═══════════════════════════════════════════════════════════════════════

async function handleRegister() {
  const name = document.getElementById('reg-name').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  const errorEl = document.getElementById('reg-error');
  
  if (!name || !email || password.length < 6) {
    errorEl.textContent = 'All fields required. Password min 6 chars.';
    errorEl.classList.remove('hidden');
    return;
  }
  
  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });
    
    const data = await res.json();
    
    if (!res.ok) {
      throw new Error(data.message || 'Registration failed');
    }
    
    authToken = data.token;
    localStorage.setItem('authToken', authToken);
    currentUser = data.user;
    
    document.getElementById('reg-name').value = '';
    document.getElementById('reg-email').value = '';
    document.getElementById('reg-password').value = '';
    errorEl.classList.add('hidden');
    
    updateSidebar();
    showScreen('app');
    showView('notes');
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.classList.remove('hidden');
  }
}

async function handleLogin() {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errorEl = document.getElementById('login-error');
  
  if (!email || !password) {
    errorEl.textContent = 'Email and password required';
    errorEl.classList.remove('hidden');
    return;
  }
  
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    
    const data = await res.json();
    
    if (!res.ok) {
      throw new Error(data.message || 'Login failed');
    }
    
    authToken = data.token;
    localStorage.setItem('authToken', authToken);
    currentUser = data.user;
    
    document.getElementById('login-email').value = '';
    document.getElementById('login-password').value = '';
    errorEl.classList.add('hidden');
    
    updateSidebar();
    showScreen('app');
    showView('notes');
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.classList.remove('hidden');
  }
}

function handleLogout() {
  authToken = null;
  currentUser = null;
  localStorage.removeItem('authToken');
  
  document.getElementById('login-email').value = '';
  document.getElementById('login-password').value = '';
  document.getElementById('reg-name').value = '';
  document.getElementById('reg-email').value = '';
  document.getElementById('reg-password').value = '';
  
  showScreen('auth');
  switchAuthTab('login');
}

// ═══════════════════════════════════════════════════════════════════════
// Notes CRUD
// ═══════════════════════════════════════════════════════════════════════

async function loadNotes() {
  if (!authToken) return;
  
  try {
    const res = await fetch('/api/notes', {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    if (!res.ok) throw new Error('Failed to load notes');
    
    notes = await res.json();
    renderNotes();
  } catch (err) {
    console.error(err);
  }
}

function renderNotes() {
  const container = document.getElementById('notes-grid');
  const emptyState = document.getElementById('notes-empty');
  
  if (!container) return;
  
  if (notes.length === 0) {
    container.innerHTML = '';
    emptyState.classList.remove('hidden');
    return;
  }
  
  emptyState.classList.add('hidden');
  container.innerHTML = notes.map(note => `
    <div class="note-card">
      <div class="note-card-header">
        <h3 class="note-title">${escapeHtml(note.title)}</h3>
        <button class="note-menu" onclick="deleteNote(${note.id})">✕</button>
      </div>
      <p class="note-content">${escapeHtml(note.content)}</p>
      <div class="note-footer">
        <span class="note-category">${note.category || 'General'}</span>
        <span class="note-date">${new Date(note.created_at).toLocaleDateString()}</span>
      </div>
    </div>
  `).join('');
}

async function createNote() {
  const title = document.getElementById('note-title')?.value.trim();
  const content = document.getElementById('note-content')?.value.trim();
  const category = document.getElementById('note-category')?.value || 'General';
  
  if (!title || !content) {
    const errorEl = document.getElementById('modal-error');
    errorEl.textContent = 'Title and content required';
    errorEl.classList.remove('hidden');
    return;
  }
  
  try {
    const res = await fetch('/api/notes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ title, content, category })
    });
    
    if (!res.ok) throw new Error('Failed to create note');
    
    document.getElementById('note-title').value = '';
    document.getElementById('note-content').value = '';
    document.getElementById('note-category').value = 'General';
    
    closeModal();
    loadNotes();
  } catch (err) {
    console.error(err);
    const errorEl = document.getElementById('modal-error');
    errorEl.textContent = err.message;
    errorEl.classList.remove('hidden');
  }
}

function openModal() {
  const modal = document.getElementById('modal-overlay');
  if (modal) modal.classList.remove('hidden');
}

function closeModal(event) {
  if (event && event.target.id !== 'modal-overlay') return;
  const modal = document.getElementById('modal-overlay');
  if (modal) modal.classList.add('hidden');
  document.getElementById('modal-error').classList.add('hidden');
}

async function deleteNote(id) {
  if (!confirm('Delete this note?')) return;
  
  try {
    const res = await fetch(`/api/notes/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    if (!res.ok) throw new Error('Failed to delete note');
    
    loadNotes();
  } catch (err) {
    console.error(err);
    alert(err.message);
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Profile
// ═══════════════════════════════════════════════════════════════════════

function loadProfile() {
  if (!currentUser || !authToken) return;
  
  document.getElementById('profile-name').textContent = currentUser.name || '—';
  document.getElementById('profile-email').textContent = currentUser.email || '—';
  document.getElementById('profile-id').textContent = currentUser.id || '—';
  document.getElementById('profile-joined').textContent = new Date(currentUser.created_at).toLocaleDateString() || '—';
  
  // Decode JWT for display
  try {
    const parts = authToken.split('.');
    if (parts[0]) {
      const header = JSON.parse(atob(parts[0]));
      document.getElementById('jwt-header').textContent = JSON.stringify(header);
    }
    if (parts[1]) {
      const payload = JSON.parse(atob(parts[1]));
      document.getElementById('jwt-payload').textContent = JSON.stringify(payload);
    }
  } catch (e) {
    console.log('JWT decode error:', e);
  }
  
  // Stats
  document.getElementById('stat-notes').textContent = notes.length;
  document.getElementById('stat-token').textContent = 'Active';
}

function updateSidebar() {
  if (!currentUser) return;
  
  const avatar = document.getElementById('sidebar-avatar');
  const name = document.getElementById('sidebar-name');
  const email = document.getElementById('sidebar-email');
  
  if (avatar) avatar.textContent = currentUser.name?.[0]?.toUpperCase() || 'U';
  if (name) name.textContent = currentUser.name || 'User';
  if (email) email.textContent = currentUser.email || '';
}

// ═══════════════════════════════════════════════════════════════════════
// API Console
// ═══════════════════════════════════════════════════════════════════════

function getApiToken() {
  return authToken || 'No token';
}

async function apiTest(method, endpoint, body = null) {
  const logEl = document.getElementById('api-log');
  const options = {
    method,
    headers: { 'Authorization': `Bearer ${authToken}` }
  };
  
  if (body) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }
  
  try {
    const res = await fetch(endpoint, options);
    const data = await res.json();
    
    const logEntry = document.createElement('div');
    logEntry.className = 'log-entry';
    logEntry.innerHTML = `
      <span class="log-method ${method.toLowerCase()}">${method}</span>
      <span class="log-endpoint">${endpoint}</span>
      <span class="log-status">${res.status}</span>
      <pre>${JSON.stringify(data, null, 2)}</pre>
    `;
    logEl.innerHTML = logEntry.innerHTML;
  } catch (err) {
    logEl.textContent = 'Error: ' + err.message;
  }
}

function apiTestOne() {
  if (notes.length === 0) {
    alert('Create a note first');
    return;
  }
  apiTest('GET', `/api/notes/${notes[0].id}`);
}

function apiTestUpdate() {
  if (notes.length === 0) {
    alert('Create a note first');
    return;
  }
  apiTest('PUT', `/api/notes/${notes[0].id}`, { title: 'Updated', content: 'Updated content' });
}

function apiTestDelete() {
  if (notes.length === 0) {
    alert('Create a note first');
    return;
  }
  apiTest('DELETE', `/api/notes/${notes[0].id}`);
}

function clearLog() {
  const logEl = document.getElementById('api-log');
  if (logEl) logEl.innerHTML = '<div class="log-placeholder">// Cleared</div>';
}

function filterNotes(category, btn) {
  const allBtns = document.querySelectorAll('.filter-btn');
  allBtns.forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  // Implementation: filter display by category
}

function searchNotes(query) {
  // Implementation: search notes by title/content
}

// ═══════════════════════════════════════════════════════════════════════
// Utilities
// ═══════════════════════════════════════════════════════════════════════

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ═══════════════════════════════════════════════════════════════════════
// Initialize
// ═══════════════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  if (authToken) {
    // Reload user info from auth endpoint
    fetch('/api/auth/me', {
      headers: { 'Authorization': `Bearer ${authToken}` }
    })
    .then(r => r.json())
    .then(data => {
      currentUser = data;
      updateSidebar();
      showScreen('app');
      showView('notes');
    })
    .catch(() => {
      authToken = null;
      localStorage.removeItem('authToken');
      showScreen('auth');
    });
  } else {
    showScreen('auth');
  }
});
