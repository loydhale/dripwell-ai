import { get, post, put } from '../lib/api.js';
import { setPageTitle } from '../components/Layout.js';

interface Pattern {
  id: string;
  name: string;
  description: string;
  category: string;
  genericRecommendationIntent: string;
  clinicalRationale: string;
  supportingSignals: unknown;
  supportingAnswers: unknown;
  conflictingSignals: unknown;
  safetyFlags: unknown;
  isActive: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

function stringifyJson(value: unknown): string {
  if (value === null || value === undefined) return '[]';
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return value;
    }
  }
  return JSON.stringify(value, null, 2);
}

function parseJsonField(raw: string, fieldName: string): unknown {
  const trimmed = raw.trim();
  if (!trimmed) return [];
  try {
    return JSON.parse(trimmed);
  } catch {
    throw new Error(`Invalid JSON in ${fieldName}`);
  }
}

export function renderVendorPatterns(container: HTMLElement): () => void {
  container.innerHTML = '<div class="admin-page">Loading patterns...</div>';
  setPageTitle('Pattern Library');

  let patterns: Pattern[] = [];
  let editingId: string | null = null;

  async function load() {
    const res = await get<{ patterns: Pattern[] }>('/vendor/patterns');
    patterns = res.patterns;
    render();
  }

  function render() {
    const page = document.createElement('div');
    page.className = 'admin-page';

    const header = document.createElement('div');
    header.className = 'admin-actions';
    header.innerHTML = `<h2 style="font-size:16px;font-weight:600;color:var(--ink);margin:0">Pattern Library</h2>`;

    const addBtn = document.createElement('button');
    addBtn.className = 'admin-btn admin-btn-primary';
    addBtn.textContent = '+ New Pattern';
    addBtn.addEventListener('click', () => {
      editingId = null;
      renderForm();
    });
    header.appendChild(addBtn);
    page.appendChild(header);

    const tableWrap = document.createElement('div');
    tableWrap.className = 'admin-table-container';

    if (patterns.length === 0) {
      tableWrap.innerHTML = '<div class="admin-empty">No patterns yet</div>';
    } else {
      const table = document.createElement('table');
      table.className = 'admin-table';
      table.innerHTML = `
        <thead>
          <tr>
            <th>Name</th>
            <th>Category</th>
            <th>Intent</th>
            <th>Status</th>
            <th>Version</th>
            <th>Updated</th>
            <th></th>
          </tr>
        </thead>
        <tbody></tbody>
      `;
      const tbody = table.querySelector('tbody')!;
      for (const p of patterns) {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>
            <div style="font-weight:600">${escapeHtml(p.name)}</div>
            <div style="font-size:12px;color:var(--text-3)">${escapeHtml(p.description.slice(0, 60))}${p.description.length > 60 ? '...' : ''}</div>
          </td>
          <td>${escapeHtml(p.category)}</td>
          <td>${escapeHtml(p.genericRecommendationIntent)}</td>
          <td>${p.isActive ? '<span class="admin-badge admin-badge-success">Active</span>' : '<span class="admin-badge admin-badge-neutral">Deprecated</span>'}</td>
          <td>v${p.version}</td>
          <td>${formatDate(p.updatedAt)}</td>
          <td>
            <button class="admin-btn admin-btn-sm admin-btn-secondary" data-edit="${p.id}">Edit</button>
            <button class="admin-btn admin-btn-sm ${p.isActive ? 'admin-btn-danger' : 'admin-btn-secondary'}" data-toggle="${p.id}">${p.isActive ? 'Deprecate' : 'Activate'}</button>
          </td>
        `;
        tr.querySelector<HTMLButtonElement>(`button[data-edit="${p.id}"]`)!.addEventListener('click', () => {
          editingId = p.id;
          renderForm(p);
        });
        tr.querySelector<HTMLButtonElement>(`button[data-toggle="${p.id}"]`)!.addEventListener('click', async () => {
          try {
            await put(`/vendor/patterns/${p.id}/deprecate`, {});
            await load();
          } catch (err) {
            alert(err instanceof Error ? err.message : 'Failed to toggle');
          }
        });
        tbody.appendChild(tr);
      }
      tableWrap.appendChild(table);
    }

    page.appendChild(tableWrap);

    // Form overlay
    if (editingId !== undefined) {
      const overlay = document.createElement('div');
      overlay.className = 'admin-modal-overlay';
      overlay.id = 'pattern-form-overlay';
      page.appendChild(overlay);
    }

    container.innerHTML = '';
    container.appendChild(page);
  }

  function renderForm(pattern?: Pattern) {
    const overlay = document.getElementById('pattern-form-overlay');
    if (!overlay) return;

    const modal = document.createElement('div');
    modal.className = 'admin-modal';
    modal.style.maxWidth = '640px';

    modal.innerHTML = `
      <div class="admin-modal-header">
        <h3>${pattern ? 'Edit Pattern' : 'New Pattern'}</h3>
      </div>
      <div class="admin-modal-body">
        <div class="admin-form-row">
          <label>Name</label>
          <input id="pat-name" value="${pattern ? escapeHtml(pattern.name) : ''}" />
        </div>
        <div class="admin-form-row">
          <label>Category</label>
          <input id="pat-category" value="${pattern ? escapeHtml(pattern.category) : ''}" />
        </div>
        <div class="admin-form-row">
          <label>Description</label>
          <textarea id="pat-desc" rows="3">${pattern ? escapeHtml(pattern.description) : ''}</textarea>
        </div>
        <div class="admin-form-row">
          <label>Generic Recommendation Intent</label>
          <input id="pat-intent" value="${pattern ? escapeHtml(pattern.genericRecommendationIntent) : ''}" />
        </div>
        <div class="admin-form-row">
          <label>Clinical Rationale</label>
          <textarea id="pat-rationale" rows="3">${pattern ? escapeHtml(pattern.clinicalRationale || '') : ''}</textarea>
        </div>
        <div class="admin-form-row">
          <label>Supporting Signals <span style="font-size:12px;color:var(--text-3)">(JSON array)</span></label>
          <textarea id="pat-sig" rows="4">${pattern ? escapeHtml(stringifyJson(pattern.supportingSignals)) : '[]'}</textarea>
        </div>
        <div class="admin-form-row">
          <label>Supporting Answers <span style="font-size:12px;color:var(--text-3)">(JSON array)</span></label>
          <textarea id="pat-ans" rows="4">${pattern ? escapeHtml(stringifyJson(pattern.supportingAnswers)) : '[]'}</textarea>
        </div>
        <div class="admin-form-row">
          <label>Conflicting Signals <span style="font-size:12px;color:var(--text-3)">(JSON array)</span></label>
          <textarea id="pat-conf" rows="4">${pattern ? escapeHtml(stringifyJson(pattern.conflictingSignals)) : '[]'}</textarea>
        </div>
        <div class="admin-form-row">
          <label>Safety Flags <span style="font-size:12px;color:var(--text-3)">(JSON array)</span></label>
          <textarea id="pat-safe" rows="4">${pattern ? escapeHtml(stringifyJson(pattern.safetyFlags)) : '[]'}</textarea>
        </div>
      </div>
      <div class="admin-modal-footer">
        <button class="admin-btn admin-btn-secondary" id="pat-cancel">Cancel</button>
        <button class="admin-btn admin-btn-primary" id="pat-save">Save</button>
      </div>
    `;

    overlay.innerHTML = '';
    overlay.appendChild(modal);

    modal.querySelector<HTMLButtonElement>('#pat-cancel')!.addEventListener('click', () => {
      editingId = null;
      render();
    });

    modal.querySelector<HTMLButtonElement>('#pat-save')!.addEventListener('click', async () => {
      const name = (modal.querySelector<HTMLInputElement>('#pat-name')!).value.trim();
      const category = (modal.querySelector<HTMLInputElement>('#pat-category')!).value.trim();
      const description = (modal.querySelector<HTMLTextAreaElement>('#pat-desc')!).value.trim();
      const genericRecommendationIntent = (modal.querySelector<HTMLInputElement>('#pat-intent')!).value.trim();
      const clinicalRationale = (modal.querySelector<HTMLTextAreaElement>('#pat-rationale')!).value.trim();

      if (!name || !category || !description || !genericRecommendationIntent) {
        alert('Name, category, description, and intent are required.');
        return;
      }

      let supportingSignals: unknown;
      let supportingAnswers: unknown;
      let conflictingSignals: unknown;
      let safetyFlags: unknown;

      try {
        supportingSignals = parseJsonField((modal.querySelector<HTMLTextAreaElement>('#pat-sig')!).value, 'Supporting Signals');
        supportingAnswers = parseJsonField((modal.querySelector<HTMLTextAreaElement>('#pat-ans')!).value, 'Supporting Answers');
        conflictingSignals = parseJsonField((modal.querySelector<HTMLTextAreaElement>('#pat-conf')!).value, 'Conflicting Signals');
        safetyFlags = parseJsonField((modal.querySelector<HTMLTextAreaElement>('#pat-safe')!).value, 'Safety Flags');
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Invalid JSON');
        return;
      }

      try {
        if (pattern) {
          await put(`/vendor/patterns/${pattern.id}`, {
            name,
            category,
            description,
            genericRecommendationIntent,
            clinicalRationale,
            supportingSignals,
            supportingAnswers,
            conflictingSignals,
            safetyFlags,
          });
        } else {
          await post('/vendor/patterns', {
            name,
            category,
            description,
            genericRecommendationIntent,
            clinicalRationale,
            supportingSignals,
            supportingAnswers,
            conflictingSignals,
            safetyFlags,
          });
        }
        editingId = null;
        await load();
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Save failed');
      }
    });
  }

  load().catch((err) => {
    container.innerHTML = `<div class="admin-page"><div class="admin-login-error">${err instanceof Error ? err.message : 'Failed to load patterns'}</div></div>`;
  });

  return () => {
    container.innerHTML = '';
  };
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
