import { postMultipart, post } from '../lib/api.js';

interface PreviewRow {
  name: string;
  type: string;
  description?: string;
  ingredients: string[];
  price?: number;
  valid: boolean;
  errors: string[];
}

interface PreviewResult {
  preview: {
    rows: PreviewRow[];
    detectedHeaders: string[];
    columnMapping: Record<string, string>;
    totalRows: number;
    validRows: number;
  };
}

interface ImportResult {
  result: {
    created: number;
    updated: number;
    skipped: number;
    failed: number;
    errors: string[];
    items: Array<{ id: string; name: string; action: string }>;
  };
}

export interface CsvUploaderCallbacks {
  onImportComplete: () => void;
  onClose: () => void;
}

export function renderCsvUploader(_container: HTMLElement, callbacks: CsvUploaderCallbacks): () => void {
  let preview: PreviewResult['preview'] | null = null;
  let file: File | null = null;
  let columnMapping: Record<string, string> = {};
  let isImporting = false;

  const overlay = document.createElement('div');
  overlay.className = 'admin-modal-overlay';

  const modal = document.createElement('div');
  modal.className = 'admin-modal';
  modal.style.maxWidth = '720px';

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  function close() {
    overlay.remove();
    callbacks.onClose();
  }

  function render() {
    modal.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'admin-modal-header';
    header.innerHTML = '<h3>Import Catalog from CSV</h3>';
    modal.appendChild(header);

    const body = document.createElement('div');
    body.className = 'admin-modal-body';

    if (!preview) {
      body.innerHTML = `
        <div class="admin-form-row">
          <label>Upload CSV file</label>
          <input id="csv-file" type="file" accept=".csv,text/csv" />
          <div style="font-size:12px;color:var(--text-2);margin-top:6px">
            Expected columns: name, type, description, ingredients, price (optional)
          </div>
        </div>
      `;
      const fileInput = body.querySelector<HTMLInputElement>('#csv-file')!;
      fileInput.addEventListener('change', () => {
        if (fileInput.files && fileInput.files[0]) {
          file = fileInput.files[0];
          loadPreview();
        }
      });
    } else {
      // Column mapping controls
      if (preview.detectedHeaders.length > 0) {
        const mapWrap = document.createElement('div');
        mapWrap.className = 'admin-form-row';
        mapWrap.innerHTML = '<label style="font-size:11px;text-transform:uppercase;letter-spacing:0.04em;color:var(--text-3)">Column Mapping</label>';
        const mapGrid = document.createElement('div');
        mapGrid.style.display = 'grid';
        mapGrid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(140px, 1fr))';
        mapGrid.style.gap = '8px';
        mapGrid.style.marginTop = '6px';

        const targetColumns = ['name', 'type', 'description', 'ingredients', 'price'];
        for (const target of targetColumns) {
          const wrap = document.createElement('div');
          wrap.innerHTML = `
            <label style="font-size:11px;color:var(--text-2);display:block;margin-bottom:2px">${target}</label>
            <select id="map-${target}" style="width:100%;padding:4px 6px;font-size:12px;border:1px solid var(--line-2);border-radius:4px"></select>
          `;
          const select = wrap.querySelector<HTMLSelectElement>(`#map-${target}`)!;
          const noneOpt = document.createElement('option');
          noneOpt.value = '';
          noneOpt.textContent = '--';
          select.appendChild(noneOpt);
          for (const h of preview.detectedHeaders) {
            const opt = document.createElement('option');
            opt.value = h;
            opt.textContent = h;
            select.appendChild(opt);
          }
          select.value = columnMapping[target] || '';
          select.addEventListener('change', () => {
            columnMapping[target] = select.value;
          });
          mapGrid.appendChild(wrap);
        }
        mapWrap.appendChild(mapGrid);
        body.appendChild(mapWrap);
      }

      // Summary
      const summary = document.createElement('div');
      summary.style.fontSize = '13px';
      summary.style.marginBottom = '12px';
      summary.style.color = preview.validRows === preview.totalRows ? 'var(--success)' : 'var(--warning)';
      summary.textContent = `${preview.validRows} of ${preview.totalRows} rows valid`;
      body.appendChild(summary);

      // Preview table
      const tableWrap = document.createElement('div');
      tableWrap.className = 'admin-table-container';
      tableWrap.style.maxHeight = '320px';
      tableWrap.style.overflowY = 'auto';

      const table = document.createElement('table');
      table.className = 'admin-table';
      table.innerHTML = `
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Description</th>
            <th>Ingredients</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody></tbody>
      `;
      const tbody = table.querySelector('tbody')!;
      for (const row of preview.rows) {
        const tr = document.createElement('tr');
        const status = row.valid
          ? '<span class="admin-badge admin-badge-success">Valid</span>'
          : `<span class="admin-badge admin-badge-danger">Invalid</span><div style="font-size:11px;color:var(--danger);margin-top:2px">${row.errors.join(', ')}</div>`;
        tr.innerHTML = `
          <td>${row.name || '<em style="color:var(--text-3)">empty</em>'}</td>
          <td>${row.type || '-'}</td>
          <td>${row.description || '-'}</td>
          <td>${row.ingredients.length > 0 ? row.ingredients.join(', ') : '-'}</td>
          <td>${status}</td>
        `;
        tbody.appendChild(tr);
      }
      tableWrap.appendChild(table);
      body.appendChild(tableWrap);
    }

    modal.appendChild(body);

    const footer = document.createElement('div');
    footer.className = 'admin-modal-footer';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'admin-btn admin-btn-secondary';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', close);
    footer.appendChild(cancelBtn);

    if (preview) {
      const reparseBtn = document.createElement('button');
      reparseBtn.className = 'admin-btn admin-btn-secondary';
      reparseBtn.textContent = 'Re-parse';
      reparseBtn.addEventListener('click', loadPreview);
      footer.appendChild(reparseBtn);

      const importBtn = document.createElement('button');
      importBtn.className = 'admin-btn admin-btn-primary';
      importBtn.textContent = isImporting ? 'Importing...' : `Import ${preview.validRows} items`;
      importBtn.disabled = isImporting || preview.validRows === 0;
      importBtn.addEventListener('click', runImport);
      footer.appendChild(importBtn);
    }

    modal.appendChild(footer);
  }

  async function loadPreview() {
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    if (Object.keys(columnMapping).length > 0) {
      formData.append('columnMapping', JSON.stringify(columnMapping));
    }

    const res = await postMultipart<PreviewResult>('/catalog/import-preview', formData);
    preview = res.preview;
    if (Object.keys(columnMapping).length === 0) {
      columnMapping = { ...preview.columnMapping };
    }
    render();
  }

  async function runImport() {
    if (!preview) return;
    const validRows = preview.rows.filter((r) => r.valid);
    if (validRows.length === 0) return;

    isImporting = true;
    render();

    try {
      const duplicateAction = confirm(
        'If an item with the same name already exists, choose OK to UPDATE it or Cancel to SKIP it.'
      )
        ? 'UPDATE'
        : 'SKIP';

      const body = {
        items: validRows.map((r) => ({
          name: r.name,
          type: r.type as 'DRIP' | 'ADD_ON' | 'INJECTION' | 'PEPTIDE',
          description: r.description,
          ingredients: r.ingredients,
          price: r.price,
        })),
        duplicateAction,
      };

      const res = await post<ImportResult>('/catalog/import', body);
      alert(
        `Import complete. Created: ${res.result.created}, Updated: ${res.result.updated}, Skipped: ${res.result.skipped}, Failed: ${res.result.failed}`
      );
      callbacks.onImportComplete();
      close();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Import failed');
      isImporting = false;
      render();
    }
  }

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  render();

  return () => {
    overlay.remove();
  };
}
