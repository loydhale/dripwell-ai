import { get } from '../lib/api.js';
import { setPageTitle } from '../components/Layout.js';

interface RecentAssessment {
  id: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  provider: { id: string; firstName: string; lastName: string } | null;
  recommendations: { id: string; status: string }[];
}

interface OverrideReason {
  reason: string;
  count: number;
}

interface FlagTier {
  tier: string;
  count: number;
}

interface DashboardData {
  totalAssessments: number;
  thisWeek: number;
  thisMonth: number;
  acceptanceRate: number;
  assessments: RecentAssessment[];
  overrideReasons: OverrideReason[];
  flagTiers: FlagTier[];
}

export function renderDashboard(container: HTMLElement): () => void {
  container.innerHTML = '<div class="admin-page">Loading...</div>';
  setPageTitle('Dashboard');

  loadData().then((data) => {
    renderContent(container, data);
  }).catch((err) => {
    container.innerHTML = `<div class="admin-page"><div class="admin-login-error">${err instanceof Error ? err.message : 'Failed to load dashboard'}</div></div>`;
  });

  return () => {
    container.innerHTML = '';
  };
}

async function loadData(): Promise<DashboardData> {
  const analytics = await get<{ totalAssessments: number; thisWeek: number; thisMonth: number; acceptanceRate: number; overrideReasons: OverrideReason[]; flagTiers: FlagTier[] }>('/admin/analytics');
  const recent = await get<{ assessments: RecentAssessment[] }>('/admin/assessments/recent?limit=10');
  return {
    ...analytics,
    assessments: recent.assessments,
  };
}

function renderContent(container: HTMLElement, data: DashboardData) {
  const page = document.createElement('div');
  page.className = 'admin-page';

  const grid = document.createElement('div');
  grid.className = 'admin-card-grid';

  grid.appendChild(makeCard('Total Assessments', String(data.totalAssessments), 'All time'));
  grid.appendChild(makeCard('This Week', String(data.thisWeek), 'Past 7 days'));
  grid.appendChild(makeCard('This Month', String(data.thisMonth), 'Past 30 days'));
  grid.appendChild(makeCard('Acceptance Rate', `${data.acceptanceRate}%`, 'Approved vs decided'));
  page.appendChild(grid);

  const sectionTitle = document.createElement('h2');
  sectionTitle.style.fontSize = '16px';
  sectionTitle.style.fontWeight = '600';
  sectionTitle.style.color = 'var(--ink)';
  sectionTitle.style.marginBottom = '16px';
  sectionTitle.textContent = 'Recent Assessments';
  page.appendChild(sectionTitle);

  const tableWrap = document.createElement('div');
  tableWrap.className = 'admin-table-container';

  if (data.assessments.length === 0) {
    tableWrap.innerHTML = '<div class="admin-empty">No assessments yet</div>';
  } else {
    const table = document.createElement('table');
    table.className = 'admin-table';
    table.innerHTML = `
      <thead>
        <tr>
          <th>ID</th>
          <th>Provider</th>
          <th>Status</th>
          <th>Started</th>
          <th>Recommendation</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;
    const tbody = table.querySelector('tbody')!;

    for (const a of data.assessments) {
      const tr = document.createElement('tr');
      const rec = a.recommendations[0];
      tr.innerHTML = `
        <td><code style="font-size:12px;color:var(--text-3)">${a.id.slice(0, 8)}</code></td>
        <td>${a.provider ? `${a.provider.firstName} ${a.provider.lastName}` : '\u2014'}</td>
        <td>${statusBadge(a.status)}</td>
        <td>${formatDate(a.startedAt)}</td>
        <td>${rec ? statusBadge(rec.status) : '\u2014'}</td>
      `;
      tbody.appendChild(tr);
    }
    tableWrap.appendChild(table);
  }

  page.appendChild(tableWrap);

  // Analytics section
  const analyticsTitle = document.createElement('h2');
  analyticsTitle.style.fontSize = '16px';
  analyticsTitle.style.fontWeight = '600';
  analyticsTitle.style.color = 'var(--ink)';
  analyticsTitle.style.marginTop = '28px';
  analyticsTitle.style.marginBottom = '16px';
  analyticsTitle.textContent = 'Analytics';
  page.appendChild(analyticsTitle);

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

function statusBadge(status: string): string {
  const map: Record<string, string> = {
    IN_PROGRESS: '<span class="admin-badge admin-badge-neutral">In Progress</span>',
    PENDING_REVIEW: '<span class="admin-badge admin-badge-warning">Pending</span>',
    APPROVED: '<span class="admin-badge admin-badge-success">Approved</span>',
    OVERRIDDEN: '<span class="admin-badge admin-badge-warning">Overridden</span>',
    COMPLETED: '<span class="admin-badge admin-badge-success">Completed</span>',
    ABANDONED: '<span class="admin-badge admin-badge-danger">Abandoned</span>',
    PENDING: '<span class="admin-badge admin-badge-warning">Pending</span>',
    REJECTED: '<span class="admin-badge admin-badge-danger">Rejected</span>',
    MODIFIED: '<span class="admin-badge admin-badge-neutral">Modified</span>',
  };
  return map[status] || `<span class="admin-badge admin-badge-neutral">${status}</span>`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatReason(reason: string): string {
  return reason.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function tierLabel(tier: string): string {
  const labels: Record<string, string> = {
    T1_INFO: 'Tier 1 \u2014 Info',
    T2_FOLLOWUP: 'Tier 2 \u2014 Follow-up',
    T3_URGENT: 'Tier 3 \u2014 Urgent',
  };
  return labels[tier] || tier;
}
