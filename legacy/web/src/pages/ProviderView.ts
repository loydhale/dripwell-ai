import { renderAssessmentFlow } from './AssessmentFlow.js';
import { renderImpersonationBanner } from '../components/ImpersonationBanner.js';
import { getToken, getUser, clearAuth } from '../lib/auth.js';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';
const ADMIN_URL = import.meta.env.VITE_ADMIN_URL || 'http://localhost:3001';

export function renderProviderView(container: HTMLElement): () => void {
  let cleanupBanner: (() => void) | null = null;
  let cleanupFlow: (() => void) | null = null;

  container.innerHTML = '';
  container.className = 'provider-view';

  const user = getUser();
  const token = getToken();

  if (!user || !token) {
    container.innerHTML = '<div class="provider-error">Not authenticated</div>';
    return () => {};
  }

  // Show impersonation banner
  cleanupBanner = renderImpersonationBanner(document.body, {
    providerName: `${user.firstName} ${user.lastName}`,
    onExit: () => {
      clearAuth();
      window.location.href = `${ADMIN_URL}/#providers`;
    },
  });

  const header = document.createElement('div');
  header.className = 'provider-header';
  header.innerHTML = `
    <h1>Provider Dashboard</h1>
    <p>Welcome, ${user.firstName} ${user.lastName}</p>
  `;

  const startBtn = document.createElement('button');
  startBtn.className = 'provider-start-btn';
  startBtn.textContent = 'Start New Assessment';
  startBtn.style.cssText = `
    padding: 12px 24px;
    font-size: 16px;
    background: #0f766e;
    color: #fff;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    margin-top: 16px;
  `;

  startBtn.addEventListener('click', async () => {
    startBtn.disabled = true;
    startBtn.textContent = 'Creating assessment...';
    try {
      const res = await fetch(`${API_BASE}/assessments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        throw new Error(`Failed to create assessment: ${res.status}`);
      }
      const json = await res.json();
      const assessmentId = json.assessment.id;

      // Clear header and start assessment flow
      header.style.display = 'none';
      startBtn.style.display = 'none';

      cleanupFlow = renderAssessmentFlow(
        container,
        { assessmentId, apiBaseUrl: API_BASE, token },
        {
          onComplete: () => {
            if (cleanupFlow) {
              cleanupFlow();
              cleanupFlow = null;
            }
            header.style.display = '';
            startBtn.style.display = '';
            startBtn.disabled = false;
            startBtn.textContent = 'Start New Assessment';
          },
          onCancel: () => {
            if (cleanupFlow) {
              cleanupFlow();
              cleanupFlow = null;
            }
            header.style.display = '';
            startBtn.style.display = '';
            startBtn.disabled = false;
            startBtn.textContent = 'Start New Assessment';
          },
        }
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create assessment');
      startBtn.disabled = false;
      startBtn.textContent = 'Start New Assessment';
    }
  });

  container.appendChild(header);
  container.appendChild(startBtn);

  return () => {
    if (cleanupBanner) {
      cleanupBanner();
      cleanupBanner = null;
    }
    if (cleanupFlow) {
      cleanupFlow();
      cleanupFlow = null;
    }
    container.innerHTML = '';
  };
}
