import { get } from '../lib/api.js';
import { setPageTitle } from '../components/Layout.js';

interface HealthData {
  totalAssessmentsToday: number;
  activeClinics: number;
  totalClinics: number;
  totalProviders: number;
  healthScore: number;
  aiTokenUsageEstimate: number;
}

export function renderVendorHealth(container: HTMLElement): () => void {
  container.innerHTML = '<div class="admin-page">Loading health metrics...</div>';
  setPageTitle('Platform Health');

  loadData().then((data) => {
    renderContent(container, data);
  }).catch((err) => {
    container.innerHTML = `<div class="admin-page"><div class="admin-login-error">${err instanceof Error ? err.message : 'Failed to load health metrics'}</div></div>`;
  });

  return () => {
    container.innerHTML = '';
  };
}

async function loadData(): Promise<HealthData> {
  const res = await get<{ health: HealthData }>('/vendor/health');
  return res.health;
}

function renderContent(container: HTMLElement, data: HealthData) {
  const page = document.createElement('div');
  page.className = 'admin-page';

  const header = document.createElement('div');
  header.className = 'admin-actions';
  header.innerHTML = `<h2 style="font-size:16px;font-weight:600;color:var(--ink);margin:0">Platform Health</h2>`;
  page.appendChild(header);

  const grid = document.createElement('div');
  grid.className = 'admin-card-grid';

  grid.appendChild(makeCard('Assessments Today', String(data.totalAssessmentsToday), 'All tenants'));
  grid.appendChild(makeCard('Active Clinics', `${data.activeClinics} / ${data.totalClinics}`, 'Tenants with active status'));
  grid.appendChild(makeCard('Total Providers', String(data.totalProviders), 'Across all clinics'));
  grid.appendChild(makeCard('Health Score', `${data.healthScore}%`, 'Proxy estimate (24h, lower is better)'));
  grid.appendChild(makeCard('AI Token Estimate', formatTokens(data.aiTokenUsageEstimate), 'Last 24 hours'));

  page.appendChild(grid);

  // Explanation
  const note = document.createElement('div');
  note.style.marginTop = '20px';
  note.style.padding = '16px';
  note.style.background = 'var(--bg-3)';
  note.style.borderRadius = '8px';
  note.style.fontSize = '13px';
  note.style.color = 'var(--text-2)';
  note.innerHTML = `
    <strong style="color:var(--ink)">About these metrics</strong><br><br>
    <strong>Health Score</strong> is a proxy estimate based on safety flags and abandoned assessments in the last 24 hours.
    It is not a true HTTP error rate but gives a directional signal of platform friction (lower is better).<br><br>
    <strong>AI Token Estimate</strong> assumes ~4,000 tokens per assessment session (photo analysis + recommendation generation).
    This is a rough estimate for cost tracking, not an exact billing metric.
  `;
  page.appendChild(note);

  container.innerHTML = '';
  container.appendChild(page);
}

function makeCard(label: string, value: string, delta: string): HTMLElement {
  const card = document.createElement('div');
  card.className = 'admin-card';
  card.innerHTML = `
    <div class="admin-card-label">${label}</div>
    <div class="admin-card-value">${value}</div>
    <div class="admin-card-delta">${delta}</div>
  `;
  return card;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
