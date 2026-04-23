import { get } from '../lib/api.js';
import { setPageTitle } from '../components/Layout.js';

interface AnalyticsData {
  totalAssessments: number;
  thisWeek: number;
  thisMonth: number;
  acceptanceRate: number;
  overrideReasons: Array<{ reason: string; count: number }>;
  flagTiers: Array<{ tier: string; count: number }>;
}

export function renderAnalytics(container: HTMLElement): () => void {
  container.innerHTML = '<div class="admin-page">Loading analytics...</div>';
  setPageTitle('Analytics');

  async function load() {
    const data = await get<AnalyticsData>('/admin/analytics');
    render(data);
  }

  function render(data: AnalyticsData) {
    const page = document.createElement('div');
    page.className = 'admin-page';

    const grid = document.createElement('div');
    grid.className = 'admin-card-grid';
    grid.appendChild(makeCard('Total Assessments', String(data.totalAssessments), 'All time'));
    grid.appendChild(makeCard('This Week', String(data.thisWeek), 'Past 7 days'));
    grid.appendChild(makeCard('This Month', String(data.thisMonth), 'Past 30 days'));
    grid.appendChild(makeCard('Acceptance Rate', `${data.acceptanceRate}%`, 'Approved / Decided'));
    page.appendChild(grid);

    const row = document.createElement('div');
    row.style.display = 'grid';
    row.style.gridTemplateColumns = '1fr 1fr';
    row.style.gap = '20px';

    const overridesSection = document.createElement('div');
    overridesSection.className = 'admin-table-container';
    overridesSection.innerHTML = `
      <div style="padding:16px 16px 0;font-size:14px;font-weight:600;color:var(--ink)">Override Reasons</div>
      <table class="admin-table">
        <thead><tr><th>Reason</th><th style="text-align:right">Count</th></tr></thead>
        <tbody></tbody>
      </table>
    `;
    const overridesBody = overridesSection.querySelector('tbody')!;
    if (data.overrideReasons.length === 0) {
      overridesBody.innerHTML = '<tr><td colspan="2" class="admin-empty">No overrides yet</td></tr>';
    } else {
      for (const r of data.overrideReasons) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${formatReason(r.reason)}</td><td style="text-align:right;font-weight:600">${r.count}</td>`;
        overridesBody.appendChild(tr);
      }
    }
    row.appendChild(overridesSection);

    const flagsSection = document.createElement('div');
    flagsSection.className = 'admin-table-container';
    flagsSection.innerHTML = `
      <div style="padding:16px 16px 0;font-size:14px;font-weight:600;color:var(--ink)">Safety Flag Tiers</div>
      <table class="admin-table">
        <thead><tr><th>Tier</th><th style="text-align:right">Count</th></tr></thead>
        <tbody></tbody>
      </table>
    `;
    const flagsBody = flagsSection.querySelector('tbody')!;
    if (data.flagTiers.length === 0) {
      flagsBody.innerHTML = '<tr><td colspan="2" class="admin-empty">No flags yet</td></tr>';
    } else {
      for (const f of data.flagTiers) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${tierLabel(f.tier)}</td><td style="text-align:right;font-weight:600">${f.count}</td>`;
        flagsBody.appendChild(tr);
      }
    }
    row.appendChild(flagsSection);

    page.appendChild(row);

    container.innerHTML = '';
    container.appendChild(page);
  }

  load().catch((err) => {
    container.innerHTML = `<div class="admin-page"><div class="admin-login-error">${err instanceof Error ? err.message : 'Failed to load analytics'}</div></div>`;
  });

  return () => {
    container.innerHTML = '';
  };
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

function formatReason(reason: string): string {
  return reason.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function tierLabel(tier: string): string {
  const labels: Record<string, string> = {
    T1_INFO: 'Tier 1 — Info',
    T2_FOLLOWUP: 'Tier 2 — Follow-up',
    T3_URGENT: 'Tier 3 — Urgent',
  };
  return labels[tier] || tier;
}
