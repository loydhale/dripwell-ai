import { renderLandingPage } from './pages/LandingPage.js';
import { renderProviderView } from './pages/ProviderView.js';
import { setToken, setUser } from './lib/auth.js';
import './styles/landing.css';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

const app = document.getElementById('app');
if (!app) {
  throw new Error('App container not found');
}
const appEl = app;

async function init() {
  // Check for impersonation token in URL hash
  const hash = window.location.hash;
  const impersonateMatch = hash.match(/impersonate=([^&]+)/);

  if (impersonateMatch) {
    const token = decodeURIComponent(impersonateMatch[1]);
    // Clear the hash to avoid leaking the token in history
    history.replaceState(null, '', window.location.pathname + window.location.search);

    // Validate token and get user info
    try {
      const res = await fetch(`${API_BASE}/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        throw new Error('Invalid impersonation token');
      }
      const json = await res.json();
      if (json.user?.role !== 'PROVIDER') {
        throw new Error('Token is not for a provider');
      }
      setToken(token);
      setUser(json.user);
    } catch (err) {
      appEl.innerHTML = `<div style="padding:40px;text-align:center;font-family:system-ui,sans-serif;">
        <h2>Impersonation failed</h2>
        <p>${err instanceof Error ? err.message : 'Unable to verify token'}</p>
        <a href="/" style="color:#0f766e;">Go home</a>
      </div>`;
      return;
    }
  }

  // Check if we have an active impersonation session
  const user = (() => {
    try {
      return JSON.parse(sessionStorage.getItem('dw_auth_user') || 'null');
    } catch {
      return null;
    }
  })();
  const token = sessionStorage.getItem('dw_auth_token');

  if (user && token && user.role === 'PROVIDER') {
    renderProviderView(appEl);
  } else {
    renderLandingPage(appEl);
  }
}

init().catch((err) => {
  console.error('Init failed:', err);
  appEl.innerHTML = '<div style="padding:40px;text-align:center;">Failed to load app</div>';
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker
    .register('/sw.js')
    .catch((err) => {
      console.error('Service worker registration failed:', err);
    });
}
