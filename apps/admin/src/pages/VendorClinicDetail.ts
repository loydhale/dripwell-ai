import { get, post, impersonateStart as apiImpersonateStart } from '../lib/api.js';
import { impersonateStart as authImpersonateStart } from '../lib/auth.js';
import { setPageTitle } from '../components/Layout.js';

interface Provider {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  lastLoginAt: string | null;
}

interface RecentAssessment {
  id: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  providerName: string;
}

interface ClinicDetail {
  id: string;
  name: string;
  slug: string;
  state: string;
  medicalDirector: string;
  isActive: boolean;
  createdAt: string;
  providers: Provider[];
  recentAssessments: RecentAssessment[];
  catalogSize: number;
}

export function renderVendorClinicDetail(container: HTMLElement): () => void {
  container.innerHTML = '<div class="admin-page">Loading clinic...</div>';
  setPageTitle('Clinic Detail');

  const hash = window.location.hash;
  const match = hash.match(/[?&]id=([^&]+)/);
  const clinicId = match ? match[1] : null;

  if (!clinicId) {
    container.innerHTML = '<div class="admin-page"><div class="admin-login-error">No clinic selected</div></div>';
    return () => {};
  }

  loadData(clinicId).then((data) => {
    renderContent(container, data, clinicId);
  }).catch((err) => {
    container.innerHTML = `<div class="admin-page"><div class="admin-login-error">${err instanceof Error ? err.message : 'Failed to load clinic'}</div></div>`;
  });

  return () => {
    container.innerHTML = '';
  };
}

async function loadData(clinicId: string): Promise<ClinicDetail> {
  const res = await get<{ clinic: ClinicDetail }>(`/vendor/clinics/${clinicId}`);
  return res.clinic;
}

function renderContent(container: HTMLElement, data: ClinicDetail, clinicId: string) {
  const page = document.createElement('div');
  page.className = 'admin-page';

  // Header
  const header = document.createElement('div');
  header.className = 'admin-actions';
  header.style.alignItems = 'center';
  header.innerHTML = `
    <button class="admin-btn admin-btn-sm admin-btn-secondary" id="clinic-back">&larr; Back</button>
    <div style="flex:1"></div>
    <button class="admin-btn admin-btn-sm admin-btn-primary" id="clinic-impersonate">Impersonate Super User</button>
  `;
  header.querySelector<HTMLButtonElement>('#clinic-back')!.addEventListener('click', () => {
    window.location.hash = '#vendor-dashboard';
  });
  header.querySelector<HTMLButtonElement>('#clinic-impersonate')!.addEventListener('click', async () => {
    try {
      const res = await post<{ token: string; user: { id: string; email: string; firstName: string; lastName: string; role: string; tenantId: string | null } }>(`/vendor/impersonate/${clinicId}`, {});
      apiImpersonateStart(res.token);
      authImpersonateStart(res.user, data.name);
      window.location.hash = '#dashboard';
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Impersonation failed');
    }
  });
  page.appendChild(header);

  // Clinic info card
  const info = document.createElement('div');
  info.className = 'admin-card-grid';
  info.style.gridTemplateColumns = 'repeat(auto-fill, minmax(180px, 1fr))';
  info.appendChild(makeCard('Name', data.name, ''));
  info.appendChild(makeCard('State', data.state, ''));
  info.appendChild(makeCard('Medical Director', data.medicalDirector, ''));
  info.appendChild(makeCard('Status', data.isActive ? 'Active' : 'Inactive', ''));
  info.appendChild(makeCard('Created', formatDate(data.createdAt), ''));
  info.appendChild(makeCard('Catalog Size', String(data.catalogSize), ''));
  page.appendChild(info);

  // Providers section
  const providersTitle = document.createElement('h2');
  providersTitle.style.fontSize = '16px';
  providersTitle.style.fontWeight = '600';
  providersTitle.style.color = 'var(--ink)';
  providersTitle.style.marginTop = '28px';
  providersTitle.style.marginBottom = '16px';
  providersTitle.textContent = 'Providers';
  page.appendChild(providersTitle);

  const providersWrap = document.createElement('div');
  providersWrap.className = 'admin-table-container';

  if (data.providers.length === 0) {
    providersWrap.innerHTML = '<div class="admin-empty">No providers</div>';
  } else {
    const table = document.createElement('table');
    table.className = 'admin-table';
    table.innerHTML = `
      <thead>
        <tr><th>Name</th><th>Email</th><th>Status</th><th>Last Login</th></tr>
      </thead>
      <tbody></tbody>
    `;
    const tbody = table.querySelector('tbody')!;
    for (const p of data.providers) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${escapeHtml(p.firstName)} ${escapeHtml(p.lastName)}</td>
        <td>${escapeHtml(p.email)}</td>
        <td>${p.isActive ? '<span class="admin-badge admin-badge-success">Active</span>' : '<span class="admin-badge admin-badge-danger">Inactive</span>'}</td>
        <td>${p.lastLoginAt ? formatDate(p.lastLoginAt) : '—'}</td>
      `;
      tbody.appendChild(tr);
    }
    providersWrap.appendChild(table);
  }
  page.appendChild(providersWrap);

  // Recent assessments section
  const assessTitle = document.createElement('h2');
  assessTitle.style.fontSize = '16px';
  assessTitle.style.fontWeight = '600';
  assessTitle.style.color = 'var(--ink)';
  assessTitle.style.marginTop = '28px';
  assessTitle.style.marginBottom = '16px';
  assessTitle.textContent = 'Recent Assessments';
  page.appendChild(assessTitle);

  const assessWrap = document.createElement('div');
  assessWrap.className = 'admin-table-container';

  if (data.recentAssessments.length === 0) {
    assessWrap.innerHTML = '<div class="admin-empty">No recent assessments</div>';
  } else {
    const table = document.createElement('table');
    table.className = 'admin-table';
    table.innerHTML = `
      <thead>
        <tr><th>ID</th><th>Status</th><th>Provider</th><th>Started</th><th>Completed</th></tr>
      </thead>
      <tbody></tbody>
    `;
    const tbody = table.querySelector('tbody')!;
    for (const a of data.recentAssessments) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><code style="font-size:12px;color:var(--text-3)">${a.id.slice(0, 8)}</code></td>
        <td>${statusBadge(a.status)}</td>
        <td>${escapeHtml(a.providerName)}</td>
        <td>${formatDate(a.startedAt)}</td>
        <td>${a.completedAt ? formatDate(a.completedAt) : '—'}</td>
      `;
      tbody.appendChild(tr);
    }
    assessWrap.appendChild(table);
  }
  page.appendChild(assessWrap);

  container.innerHTML = '';
  container.appendChild(page);
}

function makeCard(label: string, value: string, delta: string): HTMLElement {
  const card = document.createElement('div');
  card.className = 'admin-card';
  card.innerHTML = `
    <div class="admin-card-label">${escapeHtml(label)}</div>
    <div class="admin-card-value">${escapeHtml(value)}</div>
    <div class="admin-card-delta">${escapeHtml(delta)}</div>
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
  };
  return map[status] || `<span class="admin-badge admin-badge-neutral">${escapeHtml(status)}</span>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
