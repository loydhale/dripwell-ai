import { get, post, put, del } from '../lib/api.js';
import { setPageTitle } from '../components/Layout.js';

interface CatalogItem {
  id: string;
  name: string;
  description: string | null;
  type: 'DRIP' | 'ADD_ON' | 'INJECTION' | 'PEPTIDE';
  isInStock: boolean;
  outOfStockReason: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export function renderCatalogManager(container: HTMLElement): () => void {
  container.innerHTML = '<div class="admin-page">Loading catalog...</div>';
  setPageTitle('Catalog');

  let items: CatalogItem[] = [];

  async function load() {
    const res = await get<{ items: CatalogItem[] }>('/catalog');
    items = res.items;
    render();
  }

  function render() {
    const page = document.createElement('div');
    page.className = 'admin-page';

    const actions = document.createElement('div');
    actions.className = 'admin-actions';

    const addBtn = document.createElement('button');
    addBtn.className = 'admin-btn admin-btn-primary';
    addBtn.textContent = '+ Add Item';
    addBtn.addEventListener('click', () => openAddModal());
    actions.appendChild(addBtn);
    page.appendChild(actions);

    const tableWrap = document.createElement('div');
    tableWrap.className = 'admin-table-container';

    if (items.length === 0) {
      tableWrap.innerHTML = '<div class="admin-empty">No catalog items yet</div>';
    } else {
      const table = document.createElement('table');
      table.className = 'admin-table';
      table.innerHTML = `
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Stock</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody></tbody>
      `;
      const tbody = table.querySelector('tbody')!;
      for (const item of items) {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>
            <div style="font-weight:600">${item.name}</div>
            <div style="font-size:12px;color:var(--text-3)">${item.description || '—'}</div>
          </td>
          <td>${typeLabel(item.type)}</td>
          <td>${stockBadge(item)}</td>
          <td>
            <button class="admin-btn admin-btn-sm admin-btn-secondary" data-edit="${item.id}">Edit</button>
            <button class="admin-btn admin-btn-sm ${item.isInStock ? 'admin-btn-danger' : 'admin-btn-secondary'}" data-toggle="${item.id}">${item.isInStock ? 'Mark OOS' : 'Mark In Stock'}</button>
            <button class="admin-btn admin-btn-sm admin-btn-danger" data-delete="${item.id}">Delete</button>
          </td>
        `;
        tbody.appendChild(tr);
      }
      tableWrap.appendChild(table);
    }
    page.appendChild(tableWrap);

    container.innerHTML = '';
    container.appendChild(page);

    // Bind actions
    tableWrap.querySelectorAll<HTMLButtonElement>('[data-edit]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-edit')!;
        const item = items.find((i) => i.id === id);
        if (item) openEditModal(item);
      });
    });
    tableWrap.querySelectorAll<HTMLButtonElement>('[data-toggle]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-toggle')!;
        const item = items.find((i) => i.id === id);
        if (!item) return;
        btn.disabled = true;
        try {
          await put<{ catalogItem: CatalogItem }>(`/catalog/${id}`, { isInStock: !item.isInStock });
          await load();
        } catch (err) {
          alert(err instanceof Error ? err.message : 'Failed to toggle stock');
          btn.disabled = false;
        }
      });
    });
    tableWrap.querySelectorAll<HTMLButtonElement>('[data-delete]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-delete')!;
        if (!confirm('Delete this catalog item?')) return;
        btn.disabled = true;
        try {
          await del<{ catalogItem: CatalogItem }>(`/catalog/${id}`);
          await load();
        } catch (err) {
          alert(err instanceof Error ? err.message : 'Failed to delete');
          btn.disabled = false;
        }
      });
    });
  }

  function openAddModal() {
    openModal('Add Catalog Item', {
      name: '',
      description: '',
      type: 'DRIP',
      isInStock: true,
      outOfStockReason: '',
    }, async (data) => {
      await post('/catalog', data);
      await load();
    });
  }

  function openEditModal(item: CatalogItem) {
    openModal('Edit Catalog Item', {
      name: item.name,
      description: item.description || '',
      type: item.type,
      isInStock: item.isInStock,
      outOfStockReason: item.outOfStockReason || '',
    }, async (data) => {
      await put(`/catalog/${item.id}`, data);
      await load();
    });
  }

  load().catch((err) => {
    container.innerHTML = `<div class="admin-page"><div class="admin-login-error">${err instanceof Error ? err.message : 'Failed to load catalog'}</div></div>`;
  });

  return () => {
    container.innerHTML = '';
  };
}

function typeLabel(type: string): string {
  const labels: Record<string, string> = {
    DRIP: 'Drip',
    ADD_ON: 'Add-on',
    INJECTION: 'Injection',
    PEPTIDE: 'Peptide',
  };
  return labels[type] || type;
}

function stockBadge(item: CatalogItem): string {
  if (!item.isActive) return '<span class="admin-badge admin-badge-neutral">Deleted</span>';
  if (item.isInStock) return '<span class="admin-badge admin-badge-success">In Stock</span>';
  return `<span class="admin-badge admin-badge-danger">Out${item.outOfStockReason ? ': ' + item.outOfStockReason : ''}</span>`;
}

function openModal(title: string, values: Record<string, unknown>, onSave: (data: Record<string, unknown>) => Promise<void>) {
  const overlay = document.createElement('div');
  overlay.className = 'admin-modal-overlay';

  const modal = document.createElement('div');
  modal.className = 'admin-modal';
  modal.innerHTML = `
    <div class="admin-modal-header"><h3>${title}</h3></div>
    <div class="admin-modal-body">
      <div class="admin-form-row">
        <label>Name</label>
        <input id="modal-name" type="text" value="${values.name}" />
      </div>
      <div class="admin-form-row">
        <label>Description</label>
        <textarea id="modal-desc" rows="2">${values.description}</textarea>
      </div>
      <div class="admin-form-row">
        <label>Type</label>
        <select id="modal-type">
          <option value="DRIP" ${values.type === 'DRIP' ? 'selected' : ''}>Drip</option>
          <option value="ADD_ON" ${values.type === 'ADD_ON' ? 'selected' : ''}>Add-on</option>
          <option value="INJECTION" ${values.type === 'INJECTION' ? 'selected' : ''}>Injection</option>
          <option value="PEPTIDE" ${values.type === 'PEPTIDE' ? 'selected' : ''}>Peptide</option>
        </select>
      </div>
      <div class="admin-form-row">
        <label>
          <input id="modal-instock" type="checkbox" ${values.isInStock ? 'checked' : ''} />
          In Stock
        </label>
      </div>
      <div class="admin-form-row">
        <label>Out of Stock Reason</label>
        <input id="modal-reason" type="text" value="${values.outOfStockReason}" placeholder="Optional" />
      </div>
    </div>
    <div class="admin-modal-footer">
      <button class="admin-btn admin-btn-secondary" id="modal-cancel">Cancel</button>
      <button class="admin-btn admin-btn-primary" id="modal-save">Save</button>
    </div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  function close() {
    overlay.remove();
  }

  modal.querySelector<HTMLButtonElement>('#modal-cancel')!.addEventListener('click', close);
  modal.querySelector<HTMLButtonElement>('#modal-save')!.addEventListener('click', async () => {
    const data = {
      name: (modal.querySelector<HTMLInputElement>('#modal-name')!.value || '').trim(),
      description: (modal.querySelector<HTMLTextAreaElement>('#modal-desc')!.value || '').trim() || undefined,
      type: modal.querySelector<HTMLSelectElement>('#modal-type')!.value,
      isInStock: modal.querySelector<HTMLInputElement>('#modal-instock')!.checked,
      outOfStockReason: (modal.querySelector<HTMLInputElement>('#modal-reason')!.value || '').trim() || undefined,
    };
    if (!data.name) {
      alert('Name is required');
      return;
    }
    const saveBtn = modal.querySelector<HTMLButtonElement>('#modal-save')!;
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';
    try {
      await onSave(data);
      close();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Save failed');
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save';
    }
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
}
