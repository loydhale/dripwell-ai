import { get } from '../lib/api.js';
import { setPageTitle } from '../components/Layout.js';

interface Clinic {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  activeProviders: number;
  assessmentsThisMonth: number;
  lastActiveAt: string | null;
  catalogSize: number;
}

export function renderVendorDashboard(container: HTMLElement): () => void {
  container.innerHTML = '<div class="admin-page">Loading clinics...</div>';
  setPageTitle('Clinic Overview');

  loadData().then((clinics) => {
    renderContent(container, clinics);
  }).catch((err) => {
    container.innerHTML = `<div class="admin-page"><div class="admin-login-error">${err instanceof Error ? err.message : 'Failed to load clinics'}</div></div>`;
  });

  return () => {
    container.innerHTML = '';
  };
}

async function loadData(): Promise<Clinic[]> {
  const res = await get<{ clinics: Clinic[] }>('/vendor/clinics');
  return res.clinics;
}

function renderContent(container: HTMLElement, clinics: Clinic[]) {
  const page = document.createElement('div');
  page.className = 'admin-page';

  const header = document.createElement('div');
  header.className = 'admin-actions';
  header.innerHTML = `<h2 style="font-size:16px;font-weight:600;color:var(--ink);margin:0">All Clinics</h2>`;
  page.appendChild(header);

  const tableWrap = document.createElement('div');
  tableWrap.className = 'admin-table-container';

  if (clinics.length === 0) {
    tableWrap.innerHTML = '<div class="admin-empty">No clinics yet</div>';
  } else {
    const table = document.createElement('table');
    table.className = 'admin-table';
    table.innerHTML = `
      <thead>
        <tr>
          <th>Clinic</th>
          <th>Status</th>
          <th>Providers</th>
          <th>Assessments (month)</th>
          <th>Catalog</th>
          <th>Last Active</th>
          <th></th>
        </tr>
      </thead>
      <tbody></tbody>
    `;
    const tbody = table.querySelector('tbody')!;

    for (const c of clinics) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>
          <div style="font-weight:600">${escapeHtml(c.name)}</div>
          <div style="font-size:12px;color:var(--text-3)">${escapeHtml(c.slug)}</div>
        </td>
        <td>${c.isActive ? '<span class="admin-badge admin-badge-success">Active</span>' : '<span class="admin-badge admin-badge-danger">Inactive</span>'}</td>
        <td>${c.activeProviders}</td>
        <td>${c.assessmentsThisMonth}</td>
        <td>${c.catalogSize}</td>
        <td>${c.lastActiveAt ? formatDate(c.lastActiveAt) : '—'}</td>
        <td><button class="admin-btn admin-btn-sm admin-btn-secondary" data-id="${c.id}">View</button></td>
      `;
      const viewBtn = tr.querySelector<HTMLButtonElement>(`button[data-id="${c.id}"]`)!;
      viewBtn.addEventListener('click', () => {
        window.location.hash = `#vendor-clinic?id=${c.id}`;
      });
      tbody.appendChild(tr);
    }
    tableWrap.appendChild(table);
  }

  page.appendChild(tableWrap);

  container.innerHTML = '';
  container.appendChild(page);
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
    hour: '2-digit',
    minute: '2-digit',
  });
}
