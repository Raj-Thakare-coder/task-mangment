'use strict'; // RajStack Frontend

let authToken = localStorage.getItem('authToken') || null;
let currentUser = null;
let notes = [];
let isSubmitting = false;

function showScreen(screen) {
  console.log('Switching to screen:', screen);
  const authEl = document.getElementById('auth-screen');
  const appEl = document.getElementById('app-screen');

  if (screen === 'auth') {
    if (authEl) {
      authEl.classList.add('active');
      authEl.classList.remove('hidden');
      console.log('Auth screen activated');
    }
    if (appEl) {
      appEl.classList.remove('active');
      appEl.classList.add('hidden');
    }
  } else {
    if (authEl) {
      authEl.classList.remove('active');
      authEl.classList.add('hidden');
    }
    if (appEl) {
      appEl.classList.add('active');
      appEl.classList.remove('hidden');
      console.log('App screen activated');
    }
  }
}

function showView(view) {
  console.log('Switching to view:', view);
  const views = document.querySelectorAll('.view');
  views.forEach(v => { v.classList.add('hidden'); v.classList.remove('active'); });

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

async function handleRegister() {
  if (isSubmitting) return;
  const name = document.getElementById('reg-name').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  const errorEl = document.getElementById('reg-error');

  if (!name || !email || password.length < 6) {
    errorEl.textContent = 'All fields required. Password min 6 chars.';
    errorEl.classList.remove('hidden');
    return;
  }

  isSubmitting = true;
  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Registration failed');

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
  } finally {
    isSubmitting = false;
  }
}

async function handleLogin() {
  if (isSubmitting) return;
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errorEl = document.getElementById('login-error');

  if (!email || !password) {
    errorEl.textContent = 'Email and password required';
    errorEl.classList.remove('hidden');
    return;
  }

  isSubmitting = true;
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');

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
  } finally {
    isSubmitting = false;
  }
}

function handleLogout() {
  authToken = null;
  currentUser = null;
  localStorage.removeItem('authToken');
  showScreen('auth');
  switchAuthTab('login');
}

async function loadNotes() {
  if (!authToken) return;
  try {
    const res = await fetch('/api/notes', {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    if (!res.ok) {
      console.error('Failed to load notes:', res.status);
      return;
    }
    const data = await res.json();
    notes = data.notes || [];
    renderNotes();
  } catch (err) {
    console.error('Error loading notes:', err);
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
    const errorEl = document.getElementById('modal-error');
    errorEl.textContent = err.message;
    errorEl.classList.remove('hidden');
  }
}

function saveNote() { createNote(); }

function deleteNote(id) {
  if (!confirm('Delete this note?')) return;
  fetch(`/api/notes/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${authToken}` } })
    .then((res) => {
      if (!res.ok) throw new Error('Delete failed');
      loadNotes();
    })
    .catch((err) => alert(err.message));
}

function loadProfile() {
  if (!currentUser) return;
  document.getElementById('profile-name').textContent = currentUser.name || '—';
  document.getElementById('profile-email').textContent = currentUser.email || '—';
  document.getElementById('profile-id').textContent = currentUser.id || '—';
  document.getElementById('profile-joined').textContent = currentUser.created_at ? new Date(currentUser.created_at).toLocaleDateString() : '—';
  document.getElementById('stat-notes').textContent = notes.length;
  document.getElementById('stat-token').textContent = 'Active';
}

function updateSidebar() {
  if (!currentUser) return;
  document.getElementById('sidebar-avatar').textContent = currentUser.name?.[0]?.toUpperCase() || 'U';
  document.getElementById('sidebar-name').textContent = currentUser.name || 'User';
  document.getElementById('sidebar-email').textContent = currentUser.email || '';
}

function escapeHtml(text) { const div = document.createElement('div'); div.textContent = text; return div.innerHTML; }

function openModal() { document.getElementById('modal-overlay').classList.remove('hidden'); }
function closeModal(event) { if (!event || event.target.id === 'modal-overlay') { document.getElementById('modal-overlay').classList.add('hidden'); document.getElementById('modal-error').classList.add('hidden'); } }

function filterNotes(category, btn) { const els = document.querySelectorAll('.filter-btn'); els.forEach(e => e.classList.remove('active')); btn.classList.add('active'); }
function searchNotes(query) { const low = String(query).toLowerCase(); const filtered = notes.filter(n => n.title.toLowerCase().includes(low) || n.content.toLowerCase().includes(low)); notes = filtered; renderNotes(); }
function clearLog() { const logEl = document.getElementById('api-log'); if (logEl) logEl.innerHTML = '<div class="log-placeholder">// Cleared</div>'; }

function apiTest(method, endpoint, body = null) {
  const logEl = document.getElementById('api-log');
  const options = { method, headers: { Authorization: `Bearer ${authToken}` } };
  if (body) { options.headers['Content-Type'] = 'application/json'; options.body = JSON.stringify(body); }
  fetch(endpoint, options)
    .then(res => res.json())
    .then(data => {
      if (logEl) logEl.innerHTML = `<div class="log-entry"><span class="log-method ${method.toLowerCase()}">${method}</span><span class="log-endpoint">${endpoint}</span><pre>${JSON.stringify(data, null, 2)}</pre></div>`;
    }).catch(err => { if (logEl) logEl.textContent = err.message; });
}

function apiTestOne() { if (!notes.length) return alert('Create a note first'); apiTest('GET', `/api/notes/${notes[0].id}`); }
function apiTestUpdate() { if (!notes.length) return alert('Create a note first'); apiTest('PUT', `/api/notes/${notes[0].id}`, { title: 'Updated', content: 'Updated content', category: 'General' }); }
function apiTestDelete() { if (!notes.length) return alert('Create a note first'); apiTest('DELETE', `/api/notes/${notes[0].id}`); }

function getApiToken() { return authToken || 'No token'; }

document.addEventListener('DOMContentLoaded', () => {
  console.log('Page loaded, authToken:', !!authToken);
  if (authToken) {
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${authToken}` } })
      .then(r => r.json())
      .then(data => {
        if (data.user) {
          currentUser = data.user;
          updateSidebar();
          showScreen('app');
          showView('notes');
        } else {
          throw new Error('No user data');
        }
      })
      .catch(err => {
        console.error('Failed to load user:', err);
        authToken = null;
        localStorage.removeItem('authToken');
        showScreen('auth');
      });
  } else {
    console.log('No auth token, showing login');
    showScreen('auth');
  }
});
