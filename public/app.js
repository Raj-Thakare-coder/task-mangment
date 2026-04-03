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
  const views = document.querySelectorAll('.view-panel');
  views.forEach(v => v.classList.add('hidden'));
  
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => item.classList.remove('active'));
  
  const targetView = document.getElementById(`view-${view}`);
  if (targetView) targetView.classList.remove('hidden');
  
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
  const container = document.getElementById('notes-list');
  if (!container) return;
  
  container.innerHTML = notes.map(note => `
    <div class="note-item">
      <div class="note-header">
        <h3>${escapeHtml(note.title)}</h3>
        <button class="btn-small" onclick="deleteNote(${note.id})">Delete</button>
      </div>
      <p>${escapeHtml(note.content)}</p>
      <small>${new Date(note.created_at).toLocaleDateString()}</small>
    </div>
  `).join('');
}

async function createNote() {
  const title = document.getElementById('note-title')?.value.trim();
  const content = document.getElementById('note-content')?.value.trim();
  
  if (!title || !content) {
    alert('Title and content required');
    return;
  }
  
  try {
    const res = await fetch('/api/notes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ title, content })
    });
    
    if (!res.ok) throw new Error('Failed to create note');
    
    document.getElementById('note-title').value = '';
    document.getElementById('note-content').value = '';
    
    loadNotes();
  } catch (err) {
    console.error(err);
    alert(err.message);
  }
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
  const profileContent = document.getElementById('profile-content');
  if (!profileContent || !currentUser) return;
  
  profileContent.innerHTML = `
    <div class="profile-card">
      <h2>${escapeHtml(currentUser.name)}</h2>
      <p><strong>Email:</strong> ${escapeHtml(currentUser.email)}</p>
      <button class="btn-primary" onclick="handleLogout()">Sign out</button>
    </div>
  `;
}

// ═══════════════════════════════════════════════════════════════════════
// API Console
// ═══════════════════════════════════════════════════════════════════════

function getApiToken() {
  return authToken || 'No token';
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
    showScreen('app');
    showView('notes');
  } else {
    showScreen('auth');
  }
});
