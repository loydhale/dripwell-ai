import './styles/admin.css';
import { getToken, setToken, initTokens, impersonateStop as apiImpersonateStop } from './lib/api.js';
import { setUser, getUser, isSuperUser, isVendor, initImpersonation, impersonateStop as authImpersonateStop } from './lib/auth.js';
import { renderLayout } from './components/Layout.js';
import { renderLogin } from './pages/Login.js';
import { renderDashboard } from './pages/Dashboard.js';
import { renderCatalogManager } from './pages/CatalogManager.js';
import { renderProviderManager } from './pages/ProviderManager.js';
import { renderSettings } from './pages/Settings.js';
import { renderAuditLog } from './pages/AuditLog.js';
import { renderVendorDashboard } from './pages/VendorDashboard.js';
import { renderVendorClinicDetail } from './pages/VendorClinicDetail.js';
import { renderVendorPatterns } from './pages/VendorPatterns.js';
import { renderVendorAuditLog } from './pages/VendorAuditLog.js';
import { renderVendorHealth } from './pages/VendorHealth.js';
import { renderAssessmentDetail } from './pages/AssessmentDetail.js';
import { renderFeedbackForm } from './pages/FeedbackForm.js';
import { renderFeedbackKanban } from './pages/FeedbackKanban.js';

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
      window.location.hash = isVendor() ? '#vendor-dashboard' : '#dashboard';
      return;
    }
    currentCleanup = renderLogin(app);
    return;
  }

  if (!token || !getUser() || (!isSuperUser() && !isVendor())) {
    setToken(null);
    setUser(null);
    window.location.hash = '#login';
    return;
  }

  const content = document.createElement('div');

  // Vendor routes
  if (isVendor()) {
    switch (hash) {
      case '#vendor-dashboard':
        currentCleanup = renderVendorDashboard(content);
        break;
      case '#vendor-patterns':
        currentCleanup = renderVendorPatterns(content);
        break;
      case '#vendor-audit':
        currentCleanup = renderVendorAuditLog(content);
        break;
      case '#vendor-health':
        currentCleanup = renderVendorHealth(content);
        break;
      case '#vendor-feedback':
        currentCleanup = renderFeedbackKanban(content);
        break;
      default:
        if (hash.startsWith('#vendor-clinic')) {
          currentCleanup = renderVendorClinicDetail(content);
        } else {
          window.location.hash = '#vendor-dashboard';
          return;
        }
    }

    currentCleanup = composeCleanups(
      renderLayout(app, content),
      currentCleanup || (() => {})
    );
    return;
  }

  // Super user routes
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
    case '#feedback':
      currentCleanup = renderFeedbackForm(content);
      break;
    default:
      if (hash.startsWith('#assessment-detail')) {
        currentCleanup = renderAssessmentDetail(content);
        break;
      }
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
  initTokens();
  initImpersonation();
  const token = getToken();
  if (!token) return;

  try {
    const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000'}/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      setToken(null);
      setUser(null);
      apiImpersonateStop();
      authImpersonateStop();
      return;
    }
    const json = await res.json();
    if (json.user?.role === 'SUPER_USER' || json.user?.role === 'SYSTEM_ADMIN') {
      setUser(json.user);
    } else {
      setToken(null);
      setUser(null);
      apiImpersonateStop();
      authImpersonateStop();
    }
  } catch {
    setToken(null);
    setUser(null);
    apiImpersonateStop();
    authImpersonateStop();
  }
}

initSession().then(() => {
  renderRoute();
});

window.addEventListener('hashchange', renderRoute);
