import { get } from '../lib/api.js';
import { setPageTitle } from '../components/Layout.js';

interface AuditLogEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  details: Record<string, unknown> | null;
  createdAt: string;
  user: { id: string; email: string; firstName: string; lastName: string } | null;
}

const ACTION_OPTIONS = [
  '', 'ASSESSMENT_CREATED', 'ASSESSMENT_COMPLETED', 'PHOTO_CAPTURED',
  'SIGNAL_EXTRACTED', 'QUESTION_ANSWERED', 'PATTERN_MATCHED',
  'RECOMMENDATION_GENERATED', 'SAFETY_FLAG_RAISED', 'PROVIDER_APPROVED',
  'PROVIDER_OVERRIDDEN', 'CATALOG_UPDATED', 'USER_INVITED', 'USER_DEACTIVATED',
  'SETTINGS_CHANGED',
];

export function renderAuditLog(container: HTMLElement): () => void {
  container.innerHTML = '<div class="admin-page">Loading audit log...</div>';
  setPageTitle('Audit Log');

  let state = {
    action: '',
    userId: '',
    from: '',
    to: '',
    page: 1,
    limit: 50,
  };

  async function load() {
    const params = new URLSearchParams();
    if (state.action) params.set('action', state.action);
    if (state.userId) params.set('userId', state.userId);
    if (state.from) params.set('from', new Date(state.from).toISOString());
    if (state.to) params.set('to', new Date(state.to).toISOString());
    params.set('page', String(state.page));
    params.set('limit', String(state.limit));

    const data = await get<{ logs: AuditLogEntry[]; total: number; page: number; limit: number }>(`/admin/audit-logs?${params.toString()}`);
    render(data);
  }

  function render(data: { logs: AuditLogEntry[]; total: number; page: number; limit: number }) {
    const page = document.createElement('div');
    page.className = 'admin-page';

    const filters = document.createElement('div');
    filters.className = 'admin-filters';
    filters.innerHTML = `
      <div class="admin-form-row">
        <label>Action</label>
        <select id="audit-action"></select>
      </div>
      <div class="admin-form-row">
        <label>From</label>
        <input id="audit-from" type="date" />
      </div>
      <div class="admin-form-row">
        <label>To</label>
        <input id="audit-to" type="date" />
      </div>
      <button class="admin-btn admin-btn-primary" id="audit-apply" style="height:34px;align-self:flex-end">Apply Filters</button>
      <button class="admin-btn admin-btn-secondary" id="audit-export" style="height:34px;align-self:flex-end">Export CSV</button>
    `;

    const actionSelect = filters.querySelector<HTMLSelectElement>('#audit-action')!;
    for (const opt of ACTION_OPTIONS) {
      const el = document.createElement('option');
      el.value = opt;
      el.textContent = opt ? formatAction(opt) : 'All Actions';
      if (opt === state.action) el.selected = true;
      actionSelect.appendChild(el);
    }
    filters.querySelector<HTMLInputElement>('#audit-from')!.value = state.from;
    filters.querySelector<HTMLInputElement>('#audit-to')!.value = state.to;

    filters.querySelector<HTMLButtonElement>('#audit-apply')!.addEventListener('click', () => {
      state.action = actionSelect.value;
      state.from = filters.querySelector<HTMLInputElement>('#audit-from')!.value;
      state.to = filters.querySelector<HTMLInputElement>('#audit-to')!.value;
      state.page = 1;
      load().catch((err) => alert(err instanceof Error ? err.message : 'Failed to load'));
    });

    filters.querySelector<HTMLButtonElement>('#audit-export')!.addEventListener('click', () => {
      exportCsv(data.logs);
    });

    page.appendChild(filters);

    const tableWrap = document.createElement('div');
    tableWrap.className = 'admin-table-container';

    if (data.logs.length === 0) {
      tableWrap.innerHTML = '<div class="admin-empty">No audit logs match your filters</div>';
    } else {
      const table = document.createElement('table');
      table.className = 'admin-table';
      table.innerHTML = `
        <thead>
          <tr>
            <th>Time</th>
            <th>Action</th>
            <th>User</th>
            <th>Entity</th>
            <th>Details</th>
          </tr>
        </thead>
        <tbody></tbody>
      `;
      const tbody = table.querySelector('tbody')!;
      for (const log of data.logs) {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${formatDate(log.createdAt)}</td>
          <td><span class="admin-badge admin-badge-neutral">${formatAction(log.action)}</span></td>
          <td>${log.user ? `${log.user.firstName} ${log.user.lastName}` : 'System'}</td>
          <td>${log.entityType}${log.entityId ? `<br><code style="font-size:11px;color:var(--text-3)">${log.entityId.slice(0, 8)}</code>` : ''}</td>
          <td style="font-size:12px;color:var(--text-2);max-width:240px;overflow:hidden;text-overflow:ellipsis">${log.details ? JSON.stringify(log.details).slice(0, 80) : '—'}</td>
        `;
        tbody.appendChild(tr);
      }
      tableWrap.appendChild(table);
    }
    page.appendChild(tableWrap);

    const pagination = document.createElement('div');
    pagination.className = 'admin-pagination';
    const totalPages = Math.ceil(data.total / data.limit);
    pagination.innerHTML = `
      <span>Page ${data.page} of ${totalPages} (${data.total} total)</span>
      <div class="admin-pagination-buttons">
        <button class="admin-btn admin-btn-sm admin-btn-secondary" id="audit-prev" ${data.page <= 1 ? 'disabled' : ''}>Previous</button>
        <button class="admin-btn admin-btn-sm admin-btn-secondary" id="audit-next" ${data.page >= totalPages ? 'disabled' : ''}>Next</button>
      </div>
    `;
    pagination.querySelector<HTMLButtonElement>('#audit-prev')!.addEventListener('click', () => {
      if (data.page > 1) {
        state.page = data.page - 1;
        load().catch((err) => alert(err instanceof Error ? err.message : 'Failed to load'));
      }
    });
    pagination.querySelector<HTMLButtonElement>('#audit-next')!.addEventListener('click', () => {
      if (data.page < totalPages) {
        state.page = data.page + 1;
        load().catch((err) => alert(err instanceof Error ? err.message : 'Failed to load'));
      }
    });
    page.appendChild(pagination);

    container.innerHTML = '';
    container.appendChild(page);
  }

  load().catch((err) => {
    container.innerHTML = `<div class="admin-page"><div class="admin-login-error">${err instanceof Error ? err.message : 'Failed to load audit log'}</div></div>`;
  });

  return () => {
    container.innerHTML = '';
  };
}

function formatAction(action: string): string {
  return action.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function exportCsv(logs: AuditLogEntry[]) {
  const headers = ['Time', 'Action', 'User', 'Entity Type', 'Entity ID', 'Details'];
  const rows = logs.map((l) => [
    l.createdAt,
    l.action,
    l.user ? `${l.user.firstName} ${l.user.lastName} (${l.user.email})` : 'System',
    l.entityType,
    l.entityId || '',
    l.details ? JSON.stringify(l.details) : '',
  ]);
  const csv = [headers.join(','), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
