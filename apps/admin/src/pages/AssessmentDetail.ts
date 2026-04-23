import { get } from '../lib/api.js';
import { setPageTitle } from '../components/Layout.js';

interface ChangeLogEntry {
  id: string;
  actionType: string;
  changedFields: string[];
  originalValue: object | null;
  modifiedValue: object | null;
  providerName: string;
  createdAt: string;
}

interface AssessmentDetail {
  id: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  providerId: string;
  isReturning: boolean;
  vitals: {
    bloodPressureSystolic?: number;
    bloodPressureDiastolic?: number;
    pulse?: number;
    spo2?: number;
    temperature?: number | null;
    respiratoryRate?: number | null;
    weight?: number | null;
  } | null;
}

export function renderAssessmentDetail(container: HTMLElement): () => void {
  container.innerHTML = '<div class="admin-page">Loading assessment...</div>';
  setPageTitle('Assessment Detail');

  const hash = window.location.hash;
  const match = hash.match(/[?&]id=([^&]+)/);
  const assessmentId = match ? match[1] : null;

  if (!assessmentId) {
    container.innerHTML = '<div class="admin-page"><div class="admin-login-error">No assessment selected</div></div>';
    return () => {};
  }

  loadData(assessmentId).then((data) => {
    renderContent(container, data, assessmentId);
  }).catch((err) => {
    container.innerHTML = `<div class="admin-page"><div class="admin-login-error">${err instanceof Error ? err.message : 'Failed to load assessment'}</div></div>`;
  });

  return () => {
    container.innerHTML = '';
  };
}

async function loadData(assessmentId: string): Promise<{ assessment: AssessmentDetail; changeLog: ChangeLogEntry[] }> {
  const [assessmentRes, logRes] = await Promise.all([
    get<{ assessment: AssessmentDetail }>(`/assessments/${assessmentId}`),
    get<{ changeLog: ChangeLogEntry[] }>(`/assessments/${assessmentId}/change-log`),
  ]);
  return {
    assessment: assessmentRes.assessment,
    changeLog: logRes.changeLog,
  };
}

function renderContent(container: HTMLElement, data: { assessment: AssessmentDetail; changeLog: ChangeLogEntry[] }, assessmentId: string) {
  const page = document.createElement('div');
  page.className = 'admin-page';

  // Header
  const header = document.createElement('div');
  header.className = 'admin-actions';
  header.style.alignItems = 'center';
  header.innerHTML = `
    <button class="admin-btn admin-btn-sm admin-btn-secondary" id="assessment-back">&larr; Back</button>
    <div style="flex:1"></div>
  `;
  header.querySelector<HTMLButtonElement>('#assessment-back')!.addEventListener('click', () => {
    window.location.hash = '#dashboard';
  });
  page.appendChild(header);

  // Assessment info card
  const info = document.createElement('div');
  info.className = 'admin-card-grid';
  info.style.gridTemplateColumns = 'repeat(auto-fill, minmax(180px, 1fr))';
  info.appendChild(makeCard('ID', assessmentId.slice(0, 8), ''));
  info.appendChild(makeCard('Status', data.assessment.status, ''));
  info.appendChild(makeCard('Started', formatDate(data.assessment.startedAt), ''));
  info.appendChild(makeCard('Returning', data.assessment.isReturning ? 'Yes' : 'No', ''));
  page.appendChild(info);

  // Vitals section
  if (data.assessment.vitals) {
    const vitalsTitle = document.createElement('h2');
    vitalsTitle.style.fontSize = '16px';
    vitalsTitle.style.fontWeight = '600';
    vitalsTitle.style.color = 'var(--ink)';
    vitalsTitle.style.marginTop = '28px';
    vitalsTitle.style.marginBottom = '16px';
    vitalsTitle.textContent = 'Vitals';
    page.appendChild(vitalsTitle);

    const vitalsGrid = document.createElement('div');
    vitalsGrid.className = 'admin-card-grid';
    vitalsGrid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(160px, 1fr))';
    const v = data.assessment.vitals;
    if (v.bloodPressureSystolic !== undefined && v.bloodPressureDiastolic !== undefined) {
      vitalsGrid.appendChild(makeCard('Blood Pressure', `${v.bloodPressureSystolic}/${v.bloodPressureDiastolic}`, 'mmHg'));
    }
    if (v.pulse !== undefined) {
      vitalsGrid.appendChild(makeCard('Pulse', String(v.pulse), 'bpm'));
    }
    if (v.spo2 !== undefined) {
      vitalsGrid.appendChild(makeCard('SpO2', `${v.spo2}%`, ''));
    }
    if (v.temperature !== undefined && v.temperature !== null) {
      vitalsGrid.appendChild(makeCard('Temperature', String(v.temperature), 'F'));
    }
    if (v.respiratoryRate !== undefined && v.respiratoryRate !== null) {
      vitalsGrid.appendChild(makeCard('Respiratory Rate', String(v.respiratoryRate), ''));
    }
    if (v.weight !== undefined && v.weight !== null) {
      vitalsGrid.appendChild(makeCard('Weight', String(v.weight), 'lbs'));
    }
    page.appendChild(vitalsGrid);
  }

  // Change log section
  const logTitle = document.createElement('h2');
  logTitle.style.fontSize = '16px';
  logTitle.style.fontWeight = '600';
  logTitle.style.color = 'var(--ink)';
  logTitle.style.marginTop = '28px';
  logTitle.style.marginBottom = '16px';
  logTitle.textContent = 'Change Log';
  page.appendChild(logTitle);

  const logWrap = document.createElement('div');
  logWrap.className = 'admin-table-container';

  if (data.changeLog.length === 0) {
    logWrap.innerHTML = '<div class="admin-empty">No changes recorded for this assessment</div>';
  } else {
    const table = document.createElement('table');
    table.className = 'admin-table';
    table.innerHTML = `
      <thead>
        <tr>
          <th>Timestamp</th>
          <th>Provider</th>
          <th>Action</th>
          <th>Changed Fields</th>
          <th>Details</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;
    const tbody = table.querySelector('tbody')!;
    for (const entry of data.changeLog) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${formatDate(entry.createdAt)}</td>
        <td>${escapeHtml(entry.providerName)}</td>
        <td>${actionBadge(entry.actionType)}</td>
        <td>${entry.changedFields.join(', ') || '—'}</td>
        <td><pre style="font-size:11px;margin:0;white-space:pre-wrap">${escapeHtml(JSON.stringify(entry.modifiedValue, null, 2))}</pre></td>
      `;
      tbody.appendChild(tr);
    }
    logWrap.appendChild(table);
  }
  page.appendChild(logWrap);

  container.innerHTML = '';
  container.appendChild(page);
}

function makeCard(label: string, value: string, unit: string): HTMLElement {
  const card = document.createElement('div');
  card.className = 'admin-card';
  card.innerHTML = `
    <div class="admin-card-label">${escapeHtml(label)}</div>
    <div class="admin-card-value">${escapeHtml(value)}${unit ? ` <span style="font-size:12px;color:var(--text-3)">${escapeHtml(unit)}</span>` : ''}</div>
  `;
  return card;
}

function actionBadge(action: string): string {
  const map: Record<string, string> = {
    MODIFY: '<span class="admin-badge admin-badge-neutral">Modified</span>',
    OVERRIDE: '<span class="admin-badge admin-badge-warning">Overridden</span>',
    ESCALATE: '<span class="admin-badge admin-badge-danger">Escalated</span>',
    DEFER: '<span class="admin-badge admin-badge-warning">Deferred</span>',
    APPROVE: '<span class="admin-badge admin-badge-success">Approved</span>',
  };
  return map[action] || `<span class="admin-badge admin-badge-neutral">${escapeHtml(action)}</span>`;
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
    hour: '2-digit',
    minute: '2-digit',
  });
}
