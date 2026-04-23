import { postMultipart, post } from '../lib/api.js';

interface ExtractedItem {
  name: string;
  type: string;
  description?: string;
  ingredients: string[];
}

interface ExtractResult {
  items: ExtractedItem[];
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

interface GenerateDescResult {
  description: string;
}

export interface ImageUploaderCallbacks {
  onImportComplete: () => void;
  onClose: () => void;
}

export function renderImageUploader(_container: HTMLElement, callbacks: ImageUploaderCallbacks): () => void {
  let file: File | null = null;
  let extractedItems: ExtractedItem[] = [];
  let isExtracting = false;
  let isImporting = false;
  let imagePreviewUrl: string | null = null;

  const overlay = document.createElement('div');
  overlay.className = 'admin-modal-overlay';

  const modal = document.createElement('div');
  modal.className = 'admin-modal';
  modal.style.maxWidth = '840px';

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
    header.innerHTML = '<h3>Upload Menu Photo</h3>';
    modal.appendChild(header);

    const body = document.createElement('div');
    body.className = 'admin-modal-body';

    if (extractedItems.length === 0 && !isExtracting) {
      body.innerHTML = `
        <div class="admin-form-row">
          <label>Upload a photo of your spa menu</label>
          <input id="menu-file" type="file" accept="image/*" />
          <div style="font-size:12px;color:var(--text-2);margin-top:6px">
            AI will extract menu items, types, and ingredients for review.
          </div>
        </div>
      `;
      const fileInput = body.querySelector<HTMLInputElement>('#menu-file')!;
      fileInput.addEventListener('change', () => {
        if (fileInput.files && fileInput.files[0]) {
          file = fileInput.files[0];
          if (imagePreviewUrl) {
            URL.revokeObjectURL(imagePreviewUrl);
          }
          imagePreviewUrl = URL.createObjectURL(file);
          runExtraction();
        }
      });
    } else if (isExtracting) {
      body.innerHTML = `
        <div class="admin-empty">
          <div style="margin-bottom:12px">Analyzing menu photo with AI...</div>
          <div style="width:100%;height:4px;background:var(--line);border-radius:2px;overflow:hidden">
            <div style="width:60%;height:100%;background:var(--primary);border-radius:2px;animation:uploadPulse 1.5s ease-in-out infinite"></div>
          </div>
        </div>
      `;
    } else {
      // Show image preview
      if (imagePreviewUrl) {
        const imgWrap = document.createElement('div');
        imgWrap.style.marginBottom = '16px';
        imgWrap.style.maxHeight = '200px';
        imgWrap.style.overflow = 'hidden';
        imgWrap.style.borderRadius = '8px';
        imgWrap.style.border = '1px solid var(--line)';
        const img = document.createElement('img');
        img.src = imagePreviewUrl;
        img.style.width = '100%';
        img.style.height = 'auto';
        img.style.display = 'block';
        imgWrap.appendChild(img);
        body.appendChild(imgWrap);
      }

      // Extracted items table
      const tableWrap = document.createElement('div');
      tableWrap.className = 'admin-table-container';
      tableWrap.style.maxHeight = '360px';
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
            <th>Actions</th>
          </tr>
        </thead>
        <tbody></tbody>
      `;
      const tbody = table.querySelector('tbody')!;

      for (let i = 0; i < extractedItems.length; i++) {
        const item = extractedItems[i];
        const tr = document.createElement('tr');
        tr.dataset.index = String(i);

        // Name cell with input
        const nameTd = document.createElement('td');
        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.value = item.name;
        nameInput.style.width = '100%';
        nameInput.style.fontSize = '13px';
        nameInput.style.padding = '4px 6px';
        nameInput.style.border = '1px solid var(--line-2)';
        nameInput.style.borderRadius = '4px';
        nameInput.addEventListener('change', () => {
          extractedItems[i].name = nameInput.value.trim();
        });
        nameTd.appendChild(nameInput);
        tr.appendChild(nameTd);

        // Type cell with select
        const typeTd = document.createElement('td');
        const typeSelect = document.createElement('select');
        typeSelect.style.width = '100%';
        typeSelect.style.fontSize = '13px';
        typeSelect.style.padding = '4px 6px';
        typeSelect.style.border = '1px solid var(--line-2)';
        typeSelect.style.borderRadius = '4px';
        for (const t of ['DRIP', 'ADD_ON', 'INJECTION', 'PEPTIDE']) {
          const opt = document.createElement('option');
          opt.value = t;
          opt.textContent = t;
          typeSelect.appendChild(opt);
        }
        typeSelect.value = item.type;
        typeSelect.addEventListener('change', () => {
          extractedItems[i].type = typeSelect.value;
        });
        typeTd.appendChild(typeSelect);
        tr.appendChild(typeTd);

        // Description cell with textarea
        const descTd = document.createElement('td');
        const descTextarea = document.createElement('textarea');
        descTextarea.rows = 2;
        descTextarea.value = item.description || '';
        descTextarea.style.width = '100%';
        descTextarea.style.fontSize = '13px';
        descTextarea.style.padding = '4px 6px';
        descTextarea.style.border = '1px solid var(--line-2)';
        descTextarea.style.borderRadius = '4px';
        descTextarea.style.resize = 'vertical';
        descTextarea.addEventListener('change', () => {
          extractedItems[i].description = descTextarea.value.trim() || undefined;
        });
        descTd.appendChild(descTextarea);
        tr.appendChild(descTd);

        // Ingredients cell with input
        const ingTd = document.createElement('td');
        const ingInput = document.createElement('input');
        ingInput.type = 'text';
        ingInput.value = item.ingredients.join(', ');
        ingInput.style.width = '100%';
        ingInput.style.fontSize = '13px';
        ingInput.style.padding = '4px 6px';
        ingInput.style.border = '1px solid var(--line-2)';
        ingInput.style.borderRadius = '4px';
        ingInput.addEventListener('change', () => {
          extractedItems[i].ingredients = ingInput.value
            .split(/[,;|]/)
            .map((s) => s.trim())
            .filter((s) => s.length > 0);
        });
        ingTd.appendChild(ingInput);
        tr.appendChild(ingTd);

        // Actions cell
        const actionTd = document.createElement('td');
        const aiBtn = document.createElement('button');
        aiBtn.className = 'admin-btn admin-btn-sm admin-btn-secondary';
        aiBtn.textContent = 'AI Desc';
        aiBtn.addEventListener('click', () => generateAiDescription(i, aiBtn, descTextarea));
        actionTd.appendChild(aiBtn);
        tr.appendChild(actionTd);

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

    if (extractedItems.length > 0) {
      const reuploadBtn = document.createElement('button');
      reuploadBtn.className = 'admin-btn admin-btn-secondary';
      reuploadBtn.textContent = 'Upload Different Photo';
      reuploadBtn.addEventListener('click', () => {
        extractedItems = [];
        file = null;
        if (imagePreviewUrl) {
          URL.revokeObjectURL(imagePreviewUrl);
          imagePreviewUrl = null;
        }
        render();
      });
      footer.appendChild(reuploadBtn);

      const importBtn = document.createElement('button');
      importBtn.className = 'admin-btn admin-btn-primary';
      importBtn.textContent = isImporting ? 'Importing...' : `Import ${extractedItems.length} items`;
      importBtn.disabled = isImporting;
      importBtn.addEventListener('click', runImport);
      footer.appendChild(importBtn);
    }

    modal.appendChild(footer);
  }

  async function runExtraction() {
    if (!file) return;
    isExtracting = true;
    render();

    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await postMultipart<ExtractResult>('/catalog/extract-menu', formData);
      extractedItems = res.items;
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Menu extraction failed');
      file = null;
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl);
        imagePreviewUrl = null;
      }
    } finally {
      isExtracting = false;
      render();
    }
  }

  async function generateAiDescription(
    index: number,
    btn: HTMLButtonElement,
    descTextarea: HTMLTextAreaElement
  ) {
    const item = extractedItems[index];
    btn.disabled = true;
    btn.textContent = '...';

    try {
      const res = await post<GenerateDescResult>('/catalog/generate-description', {
        name: item.name,
        ingredients: item.ingredients,
        type: item.type,
      });
      extractedItems[index].description = res.description;
      descTextarea.value = res.description;
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Description generation failed');
    } finally {
      btn.disabled = false;
      btn.textContent = 'AI Desc';
    }
  }

  async function runImport() {
    const validItems = extractedItems.filter((i) => i.name.trim().length > 0);
    if (validItems.length === 0) {
      alert('No valid items to import. Please ensure all items have names.');
      return;
    }

    isImporting = true;
    render();

    try {
      const duplicateAction = confirm(
        'If an item with the same name already exists, choose OK to UPDATE it or Cancel to SKIP it.'
      )
        ? 'UPDATE'
        : 'SKIP';

      const body = {
        items: validItems.map((r) => ({
          name: r.name.trim(),
          type: r.type as 'DRIP' | 'ADD_ON' | 'INJECTION' | 'PEPTIDE',
          description: r.description,
          ingredients: r.ingredients,
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
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
    }
    overlay.remove();
  };
}
