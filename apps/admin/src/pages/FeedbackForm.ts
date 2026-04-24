import { post, get } from '../lib/api.js';
import { setPageTitle } from '../components/Layout.js';

interface FeedbackItem {
  id: string;
  type: string;
  title: string;
  description: string;
  urgency: string;
  status: string;
  createdAt: string;
}

export function renderFeedbackForm(container: HTMLElement): () => void {
  container.innerHTML = '<div class="admin-page">Loading...</div>';
  setPageTitle('Feedback');

  renderContent(container);
  loadHistory(container);

  return () => {
    container.innerHTML = '';
  };
}

function renderContent(container: HTMLElement) {
  const page = document.createElement('div');
  page.className = 'admin-page';

  const header = document.createElement('div');
  header.className = 'admin-actions';
  header.innerHTML = '<h2 style="font-size:16px;font-weight:600;color:var(--ink);margin:0">Submit Feedback</h2>';
  page.appendChild(header);

  const form = document.createElement('form');
  form.className = 'admin-form';
  form.style.maxWidth = '640px';
  form.innerHTML = `
    <div class="admin-form-group">
      <label>Type</label>
      <select name="type" required>
        <option value="BUG">Bug</option>
        <option value="FEATURE_REQUEST">Feature Request</option>
        <option value="GENERAL">General</option>
      </select>
    </div>
    <div class="admin-form-group">
      <label>Urgency</label>
      <select name="urgency" required>
        <option value="low">Low</option>
        <option value="medium" selected>Medium</option>
        <option value="high">High</option>
      </select>
    </div>
    <div class="admin-form-group">
      <label>Title</label>
      <input type="text" name="title" maxlength="200" required />
    </div>
    <div class="admin-form-group">
      <label>Description</label>
      <textarea name="description" rows="6" maxlength="5000" required></textarea>
    </div>
    <div class="admin-form-actions">
      <button type="submit" class="admin-btn admin-btn-primary">Submit Feedback</button>
    </div>
    <div class="admin-form-message" style="margin-top:12px"></div>
  `;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(form);
    const type = formData.get('type') as string;
    const urgency = formData.get('urgency') as string;
    const title = formData.get('title') as string;
    const description = formData.get('description') as string;

    const msg = form.querySelector('.admin-form-message') as HTMLDivElement;
    msg.textContent = '';
    msg.className = 'admin-form-message';

    const btn = form.querySelector('button[type="submit"]') as HTMLButtonElement;
    btn.disabled = true;
    btn.textContent = 'Submitting...';

    try {
      await post('/feedback', { type, urgency, title, description });
      msg.textContent = 'Feedback submitted. Thank you!';
      msg.className = 'admin-form-message admin-form-message-success';
      form.reset();
      loadHistory(container);
    } catch (err) {
      msg.textContent = err instanceof Error ? err.message : 'Failed to submit';
      msg.className = 'admin-form-message admin-form-message-error';
    } finally {
      btn.disabled = false;
      btn.textContent = 'Submit Feedback';
    }
  });

  page.appendChild(form);

  const historyHeader = document.createElement('div');
  historyHeader.className = 'admin-actions';
  historyHeader.style.marginTop = '32px';
  historyHeader.innerHTML = '<h2 style="font-size:16px;font-weight:600;color:var(--ink);margin:0">Your Submitted Feedback</h2>';
  page.appendChild(historyHeader);

  const historyWrap = document.createElement('div');
  historyWrap.id = 'feedback-history';
  historyWrap.className = 'admin-table-container';
  historyWrap.innerHTML = '<div class="admin-empty">Loading...</div>';
  page.appendChild(historyWrap);

  container.innerHTML = '';
  container.appendChild(page);
}

async function loadHistory(container: HTMLElement) {
  const wrap = container.querySelector('#feedback-history');
  if (!wrap) return;

  try {
    const res = await get<{ feedback: FeedbackItem[] }>('/feedback');
    renderHistory(wrap as HTMLElement, res.feedback);
  } catch (err) {
    wrap.innerHTML = `<div class="admin-empty">${err instanceof Error ? err.message : 'Failed to load history'}</div>`;
  }
}

function renderHistory(container: HTMLElement, items: FeedbackItem[]) {
  if (items.length === 0) {
    container.innerHTML = '<div class="admin-empty">No feedback submitted yet</div>';
    return;
  }

  const table = document.createElement('table');
  table.className = 'admin-table';
  table.innerHTML = `
    <thead>
      <tr>
        <th>Type</th>
        <th>Title</th>
        <th>Urgency</th>
        <th>Status</th>
        <th>Submitted</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;

  const tbody = table.querySelector('tbody')!;
  for (const item of items) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><span class="admin-badge">${escapeHtml(item.type)}</span></td>
      <td>${escapeHtml(item.title)}</td>
      <td>${urgencyBadge(item.urgency)}</td>
      <td><span class="admin-badge">${escapeHtml(item.status)}</span></td>
      <td>${formatDate(item.createdAt)}</td>
    `;
    tbody.appendChild(tr);
  }

  container.innerHTML = '';
  container.appendChild(table);
}

function urgencyBadge(urgency: string): string {
  const cls =
    urgency === 'high'
      ? 'admin-badge-danger'
      : urgency === 'medium'
        ? 'admin-badge-warning'
        : 'admin-badge-success';
  return `<span class="admin-badge ${cls}">${escapeHtml(urgency)}</span>`;
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
