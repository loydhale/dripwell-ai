import { get, put, post } from '../lib/api.js';
import { setPageTitle } from '../components/Layout.js';

interface FeedbackItem {
  id: string;
  tenantId: string;
  tenantName: string;
  submitterId: string;
  submitterName: string;
  type: string;
  title: string;
  description: string;
  urgency: string;
  status: string;
  category: string | null;
  decision: string | null;
  priority: string | null;
  assignedTo: string | null;
  assignedToName: string | null;
  notes: string | null;
  promotedTaskId: string | null;
  createdAt: string;
  updatedAt: string;
}

const COLUMNS = [
  { key: 'BACKLOG', label: 'Backlog / Not Started' },
  { key: 'IN_PROGRESS', label: 'In Progress' },
  { key: 'DONE', label: 'Done' },
  { key: 'WONT_DO', label: "Won't Do" },
] as const;

const CATEGORY_OPTIONS = [
  { value: '', label: 'All Categories' },
  { value: 'SOFTWARE_ISSUE', label: 'Software Issue' },
  { value: 'PROCESS_ISSUE', label: 'Process Issue' },
  { value: 'DOCUMENTATION', label: 'Documentation' },
  { value: 'OTHER', label: 'Other' },
];

const DECISION_OPTIONS = [
  { value: '', label: 'All Decisions' },
  { value: 'DO_IT', label: 'Do It' },
  { value: 'DONT_DO_IT', label: "Don't Do It" },
  { value: 'MAYBE', label: 'Maybe' },
  { value: 'NEEDS_MORE_INFO', label: 'Needs More Info' },
];

const PRIORITY_OPTIONS = [
  { value: '', label: 'All Priorities' },
  { value: 'P0', label: 'P0 (critical)' },
  { value: 'P1', label: 'P1 (important)' },
  { value: 'P2', label: 'P2 (nice to have)' },
];

let allItems: FeedbackItem[] = [];
let currentFilters = {
  category: '',
  decision: '',
  priority: '',
  tenantId: '',
  search: '',
};

export function renderFeedbackKanban(container: HTMLElement): () => void {
  container.innerHTML = '<div class="admin-page">Loading board...</div>';
  setPageTitle('Feedback Board');

  loadBoard(container);

  return () => {
    container.innerHTML = '';
  };
}

async function loadBoard(container: HTMLElement) {
  try {
    const res = await get<{ items: FeedbackItem[]; total: number }>('/vendor/feedback?limit=200');
    allItems = res.items;
    renderBoard(container);
  } catch (err) {
    container.innerHTML = `<div class="admin-page"><div class="admin-login-error">${err instanceof Error ? err.message : 'Failed to load board'}</div></div>`;
  }
}

function renderBoard(container: HTMLElement) {
  const page = document.createElement('div');
  page.className = 'admin-page';

  const toolbar = document.createElement('div');
  toolbar.className = 'admin-actions';
  toolbar.style.gap = '8px';
  toolbar.style.flexWrap = 'wrap';
  toolbar.innerHTML = `
    <input type="text" id="fb-search" placeholder="Search feedback..." style="min-width:180px" />
    <select id="fb-category">${CATEGORY_OPTIONS.map(o => `<option value="${o.value}">${o.label}</option>`).join('')}</select>
    <select id="fb-decision">${DECISION_OPTIONS.map(o => `<option value="${o.value}">${o.label}</option>`).join('')}</select>
    <select id="fb-priority">${PRIORITY_OPTIONS.map(o => `<option value="${o.value}">${o.label}</option>`).join('')}</select>
    <button id="fb-refresh" class="admin-btn admin-btn-sm admin-btn-secondary">Refresh</button>
  `;

  page.appendChild(toolbar);

  const board = document.createElement('div');
  board.id = 'kanban-board';
  board.className = 'kanban-board';
  page.appendChild(board);

  const detailPanel = document.createElement('div');
  detailPanel.id = 'kanban-detail';
  detailPanel.className = 'kanban-detail';
  detailPanel.style.display = 'none';
  page.appendChild(detailPanel);

  container.innerHTML = '';
  container.appendChild(page);

  attachFilterListeners(container);
  refreshBoard(container);
}

function attachFilterListeners(container: HTMLElement) {
  const search = container.querySelector<HTMLInputElement>('#fb-search');
  const category = container.querySelector<HTMLSelectElement>('#fb-category');
  const decision = container.querySelector<HTMLSelectElement>('#fb-decision');
  const priority = container.querySelector<HTMLSelectElement>('#fb-priority');
  const refresh = container.querySelector<HTMLButtonElement>('#fb-refresh');

  const apply = () => {
    currentFilters = {
      category: category?.value || '',
      decision: decision?.value || '',
      priority: priority?.value || '',
      tenantId: '',
      search: search?.value || '',
    };
    refreshBoard(container);
  };

  search?.addEventListener('input', apply);
  category?.addEventListener('change', apply);
  decision?.addEventListener('change', apply);
  priority?.addEventListener('change', apply);
  refresh?.addEventListener('click', () => loadBoard(container));
}

function filterItems(items: FeedbackItem[]): FeedbackItem[] {
  return items.filter((item) => {
    if (currentFilters.category && item.category !== currentFilters.category) return false;
    if (currentFilters.decision && item.decision !== currentFilters.decision) return false;
    if (currentFilters.priority && item.priority !== currentFilters.priority) return false;
    if (currentFilters.search) {
      const q = currentFilters.search.toLowerCase();
      const text = `${item.title} ${item.description} ${item.tenantName}`.toLowerCase();
      if (!text.includes(q)) return false;
    }
    return true;
  });
}

function refreshBoard(container: HTMLElement) {
  const board = container.querySelector<HTMLElement>('#kanban-board');
  if (!board) return;

  const filtered = filterItems(allItems);

  board.innerHTML = '';
  board.style.display = 'grid';
  board.style.gridTemplateColumns = 'repeat(4, 1fr)';
  board.style.gap = '12px';
  board.style.marginTop = '16px';

  for (const col of COLUMNS) {
    const colEl = document.createElement('div');
    colEl.className = 'kanban-column';
    colEl.dataset.status = col.key;
    colEl.style.background = '#f8f9fa';
    colEl.style.borderRadius = '6px';
    colEl.style.padding = '8px';
    colEl.style.minHeight = '200px';

    const header = document.createElement('div');
    header.className = 'kanban-column-header';
    header.textContent = col.label;
    header.style.fontWeight = '600';
    header.style.fontSize = '13px';
    header.style.marginBottom = '8px';
    header.style.color = '#495057';
    colEl.appendChild(header);

    const count = filtered.filter((i) => i.status === col.key).length;
    const countBadge = document.createElement('span');
    countBadge.textContent = String(count);
    countBadge.style.marginLeft = '6px';
    countBadge.style.background = '#dee2e6';
    countBadge.style.borderRadius = '10px';
    countBadge.style.padding = '2px 8px';
    countBadge.style.fontSize = '11px';
    header.appendChild(countBadge);

    const cards = document.createElement('div');
    cards.className = 'kanban-cards';
    cards.style.display = 'flex';
    cards.style.flexDirection = 'column';
    cards.style.gap = '8px';

    for (const item of filtered.filter((i) => i.status === col.key)) {
      cards.appendChild(renderCard(item, container));
    }

    colEl.appendChild(cards);
    board.appendChild(colEl);

    // drop zone
    colEl.addEventListener('dragover', (e) => {
      e.preventDefault();
      colEl.style.background = '#e9ecef';
    });
    colEl.addEventListener('dragleave', () => {
      colEl.style.background = '#f8f9fa';
    });
    colEl.addEventListener('drop', (e) => {
      e.preventDefault();
      colEl.style.background = '#f8f9fa';
      const id = e.dataTransfer?.getData('text/plain');
      if (id) {
        moveCard(id, col.key, container);
      }
    });
  }
}

function renderCard(item: FeedbackItem, container: HTMLElement): HTMLElement {
  const card = document.createElement('div');
  card.className = 'kanban-card';
  card.draggable = true;
  card.dataset.id = item.id;
  card.style.background = '#fff';
  card.style.border = '1px solid #dee2e6';
  card.style.borderRadius = '4px';
  card.style.padding = '10px';
  card.style.cursor = 'grab';
  card.style.fontSize = '13px';

  const typeLabel = escapeHtml(item.type.replace('_', ' '));
  const urgencyClass =
    item.urgency === 'high'
      ? 'admin-badge-danger'
      : item.urgency === 'medium'
        ? 'admin-badge-warning'
        : 'admin-badge-success';

  card.innerHTML = `
    <div style="font-weight:600;margin-bottom:4px">${escapeHtml(item.title)}</div>
    <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:6px">
      <span class="admin-badge" style="font-size:11px">${typeLabel}</span>
      <span class="admin-badge ${urgencyClass}" style="font-size:11px">${escapeHtml(item.urgency)}</span>
      ${item.priority ? `<span class="admin-badge" style="font-size:11px">${escapeHtml(item.priority)}</span>` : ''}
    </div>
    <div style="color:var(--text-3);font-size:12px">${escapeHtml(item.tenantName)} &middot; ${formatDate(item.createdAt)}</div>
  `;

  card.addEventListener('dragstart', (e) => {
    e.dataTransfer?.setData('text/plain', item.id);
    card.style.opacity = '0.5';
  });
  card.addEventListener('dragend', () => {
    card.style.opacity = '1';
  });
  card.addEventListener('click', () => {
    openDetail(item, container);
  });

  return card;
}

async function moveCard(id: string, newStatus: string, container: HTMLElement) {
  const item = allItems.find((i) => i.id === id);
  if (!item || item.status === newStatus) return;

  // Promote prompt for software issues moving to In Progress
  if (newStatus === 'IN_PROGRESS' && item.category === 'SOFTWARE_ISSUE' && !item.promotedTaskId) {
    const taskId = prompt('Promote to task? Enter task/issue ID, or Cancel to skip:');
    if (taskId && taskId.trim()) {
      try {
        await post(`/vendor/feedback/${id}/promote`, { taskId: taskId.trim() });
        item.promotedTaskId = taskId.trim();
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Promotion failed');
        return;
      }
    } else {
      // still update status even if no promotion
      try {
        await put(`/vendor/feedback/${id}`, { status: newStatus });
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Update failed');
        return;
      }
    }
  } else {
    try {
      await put(`/vendor/feedback/${id}`, { status: newStatus });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Update failed');
      return;
    }
  }

  item.status = newStatus;
  refreshBoard(container);
  const detail = container.querySelector<HTMLElement>('#kanban-detail');
  if (detail && detail.style.display !== 'none') {
    openDetail(item, container);
  }
}

function openDetail(item: FeedbackItem, container: HTMLElement) {
  const detail = container.querySelector<HTMLElement>('#kanban-detail');
  if (!detail) return;

  detail.style.display = 'block';
  detail.style.marginTop = '16px';
  detail.style.background = '#fff';
  detail.style.border = '1px solid #dee2e6';
  detail.style.borderRadius = '6px';
  detail.style.padding = '16px';

  const typeLabel = escapeHtml(item.type.replace('_', ' '));

  detail.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <h3 style="margin:0;font-size:16px">${escapeHtml(item.title)}</h3>
      <button id="detail-close" class="admin-btn admin-btn-sm admin-btn-secondary">Close</button>
    </div>
    <div style="margin-bottom:12px">
      <span class="admin-badge">${typeLabel}</span>
      <span class="admin-badge ${item.urgency === 'high' ? 'admin-badge-danger' : item.urgency === 'medium' ? 'admin-badge-warning' : 'admin-badge-success'}">${escapeHtml(item.urgency)}</span>
    </div>
    <div style="margin-bottom:12px;color:var(--text-3)">${escapeHtml(item.tenantName)} &middot; ${escapeHtml(item.submitterName)} &middot; ${formatDate(item.createdAt)}</div>
    <div style="margin-bottom:16px;white-space:pre-wrap">${escapeHtml(item.description)}</div>

    <div style="display:grid;grid-template-columns:repeat(2, 1fr);gap:12px;margin-bottom:16px">
      <div>
        <label style="font-size:12px;color:var(--text-3);display:block;margin-bottom:4px">Category</label>
        <select id="detail-category" class="admin-form-control">
          <option value="">--</option>
          ${CATEGORY_OPTIONS.filter(o => o.value).map(o => `<option value="${o.value}" ${item.category === o.value ? 'selected' : ''}>${o.label}</option>`).join('')}
        </select>
      </div>
      <div>
        <label style="font-size:12px;color:var(--text-3);display:block;margin-bottom:4px">Decision</label>
        <select id="detail-decision" class="admin-form-control">
          <option value="">--</option>
          ${DECISION_OPTIONS.filter(o => o.value).map(o => `<option value="${o.value}" ${item.decision === o.value ? 'selected' : ''}>${o.label}</option>`).join('')}
        </select>
      </div>
      <div>
        <label style="font-size:12px;color:var(--text-3);display:block;margin-bottom:4px">Priority</label>
        <select id="detail-priority" class="admin-form-control">
          <option value="">--</option>
          ${PRIORITY_OPTIONS.filter(o => o.value).map(o => `<option value="${o.value}" ${item.priority === o.value ? 'selected' : ''}>${o.label}</option>`).join('')}
        </select>
      </div>
      <div>
        <label style="font-size:12px;color:var(--text-3);display:block;margin-bottom:4px">Assigned To</label>
        <input type="text" id="detail-assigned" class="admin-form-control" value="${escapeHtml(item.assignedTo || '')}" placeholder="User ID" />
      </div>
    </div>

    <div style="margin-bottom:16px">
      <label style="font-size:12px;color:var(--text-3);display:block;margin-bottom:4px">Notes</label>
      <textarea id="detail-notes" class="admin-form-control" rows="4">${escapeHtml(item.notes || '')}</textarea>
    </div>

    <div style="display:flex;gap:8px">
      <button id="detail-save" class="admin-btn admin-btn-primary">Save</button>
      ${item.promotedTaskId ? `<span class="admin-badge" style="align-self:center">Task: ${escapeHtml(item.promotedTaskId)}</span>` : ''}
    </div>
    <div id="detail-msg" style="margin-top:8px;font-size:13px"></div>
  `;

  detail.querySelector<HTMLButtonElement>('#detail-close')!.addEventListener('click', () => {
    detail.style.display = 'none';
    detail.innerHTML = '';
  });

  detail.querySelector<HTMLButtonElement>('#detail-save')!.addEventListener('click', async () => {
    const category = detail.querySelector<HTMLSelectElement>('#detail-category')!.value || undefined;
    const decision = detail.querySelector<HTMLSelectElement>('#detail-decision')!.value || undefined;
    const priority = detail.querySelector<HTMLSelectElement>('#detail-priority')!.value || undefined;
    const assignedTo = detail.querySelector<HTMLInputElement>('#detail-assigned')!.value || null;
    const notes = detail.querySelector<HTMLTextAreaElement>('#detail-notes')!.value || undefined;

    const msg = detail.querySelector<HTMLDivElement>('#detail-msg')!;
    msg.textContent = '';

    try {
      const res = await put<{ feedback: FeedbackItem }>(`/vendor/feedback/${item.id}`, {
        category,
        decision,
        priority,
        assignedTo,
        notes,
      });

      // update local item
      const idx = allItems.findIndex((i) => i.id === item.id);
      if (idx >= 0) {
        allItems[idx] = res.feedback;
      }

      msg.textContent = 'Saved.';
      msg.style.color = 'green';
      refreshBoard(container);
    } catch (err) {
      msg.textContent = err instanceof Error ? err.message : 'Save failed';
      msg.style.color = 'red';
    }
  });
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
