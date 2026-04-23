import './styles/admin.css';
import { getToken, setToken } from './lib/api.js';
import { setUser, getUser, isSuperUser } from './lib/auth.js';
import { renderLayout } from './components/Layout.js';
import { renderLogin } from './pages/Login.js';
import { renderDashboard } from './pages/Dashboard.js';
import { renderCatalogManager } from './pages/CatalogManager.js';
import { renderProviderManager } from './pages/ProviderManager.js';
import { renderSettings } from './pages/Settings.js';
import { renderAuditLog } from './pages/AuditLog.js';

const app = document.getElementById('app')!;

let currentCleanup: (() => void) | null = null;

function cleanup() {
  if (currentCleanup) {
    currentCleanup();
    currentCleanup = null;
  }
}

function renderRoute() {
  cleanup();

  const hash = window.location.hash || '#dashboard';
  const token = getToken();

  // Try to restore session on first load
  if (!token && hash !== '#login') {
    // Show login if no token
    window.location.hash = '#login';
    return;
  }

  if (hash === '#login') {
    if (token && getUser()) {
      window.location.hash = '#dashboard';
      return;
    }
    currentCleanup = renderLogin(app);
    return;
  }

  if (!token || !getUser() || !isSuperUser()) {
    setToken(null);
    setUser(null);
    window.location.hash = '#login';
    return;
  }

  const content = document.createElement('div');

  switch (hash) {
    case '#dashboard':
      currentCleanup = renderDashboard(content);
      break;
    case '#catalog':
      currentCleanup = renderCatalogManager(content);
      break;
    case '#providers':
      currentCleanup = renderProviderManager(content);
      break;
    case '#settings':
      currentCleanup = renderSettings(content);
      break;
    case '#audit':
      currentCleanup = renderAuditLog(content);
      break;
    default:
      window.location.hash = '#dashboard';
      return;
  }

  currentCleanup = composeCleanups(
    renderLayout(app, content),
    currentCleanup || (() => {})
  );
}

function composeCleanups(a: () => void, b: () => void): () => void {
  return () => {
    a();
    b();
  };
}

async function initSession() {
  const token = getToken();
  if (!token) return;

  try {
    const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000'}/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      setToken(null);
      setUser(null);
      return;
    }
    const json = await res.json();
    if (json.user?.role === 'SUPER_USER') {
      setUser(json.user);
    } else {
      setToken(null);
      setUser(null);
    }
  } catch {
    setToken(null);
    setUser(null);
  }
}

initSession().then(() => {
  renderRoute();
});

window.addEventListener('hashchange', renderRoute);
