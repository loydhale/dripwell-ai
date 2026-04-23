import { get, post, put } from '../lib/api.js';
import { setPageTitle } from '../components/Layout.js';

interface Provider {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export function renderProviderManager(container: HTMLElement): () => void {
  container.innerHTML = '<div class="admin-page">Loading providers...</div>';
  setPageTitle('Providers');

  let providers: Provider[] = [];

  async function load() {
    const res = await get<{ providers: Provider[] }>('/admin/providers');
    providers = res.providers;
    render();
  }

  function render() {
    const page = document.createElement('div');
    page.className = 'admin-page';

    const actions = document.createElement('div');
    actions.className = 'admin-actions';

    const inviteBtn = document.createElement('button');
    inviteBtn.className = 'admin-btn admin-btn-primary';
    inviteBtn.textContent = '+ Invite Provider';
    inviteBtn.addEventListener('click', () => openInviteModal());
    actions.appendChild(inviteBtn);
    page.appendChild(actions);

    const tableWrap = document.createElement('div');
    tableWrap.className = 'admin-table-container';

    if (providers.length === 0) {
      tableWrap.innerHTML = '<div class="admin-empty">No providers yet</div>';
    } else {
      const table = document.createElement('table');
      table.className = 'admin-table';
      table.innerHTML = `
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Status</th>
            <th>Last Login</th>
            <th>Joined</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody></tbody>
      `;
      const tbody = table.querySelector('tbody')!;
      for (const p of providers) {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${p.firstName} ${p.lastName}</td>
          <td>${p.email}</td>
          <td>${p.isActive ? '<span class="admin-badge admin-badge-success">Active</span>' : '<span class="admin-badge admin-badge-danger">Inactive</span>'}</td>
          <td>${p.lastLoginAt ? formatDate(p.lastLoginAt) : 'Never'}</td>
          <td>${formatDate(p.createdAt)}</td>
          <td>
            ${p.isActive
              ? `<button class="admin-btn admin-btn-sm admin-btn-danger" data-deactivate="${p.id}">Deactivate</button>`
              : `<button class="admin-btn admin-btn-sm admin-btn-secondary" data-reactivate="${p.id}">Reactivate</button>`}
          </td>
        `;
        tbody.appendChild(tr);
      }
      tableWrap.appendChild(table);
    }
    page.appendChild(tableWrap);

    container.innerHTML = '';
    container.appendChild(page);

    tableWrap.querySelectorAll<HTMLButtonElement>('[data-deactivate]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-deactivate')!;
        if (!confirm('Deactivate this provider? They will no longer be able to log in.')) return;
        btn.disabled = true;
        try {
          await put(`/admin/providers/${id}/deactivate`, {});
          await load();
        } catch (err) {
          alert(err instanceof Error ? err.message : 'Failed to deactivate');
          btn.disabled = false;
        }
      });
    });

    tableWrap.querySelectorAll<HTMLButtonElement>('[data-reactivate]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-reactivate')!;
        btn.disabled = true;
        try {
          await put(`/admin/providers/${id}/reactivate`, {});
          await load();
        } catch (err) {
          alert(err instanceof Error ? err.message : 'Failed to reactivate');
          btn.disabled = false;
        }
      });
    });
  }

  function openInviteModal() {
    const overlay = document.createElement('div');
    overlay.className = 'admin-modal-overlay';

    const modal = document.createElement('div');
    modal.className = 'admin-modal';
    modal.innerHTML = `
      <div class="admin-modal-header"><h3>Invite Provider</h3></div>
      <div class="admin-modal-body">
        <div class="admin-form-row">
          <label>First Name</label>
          <input id="inv-fname" type="text" />
        </div>
        <div class="admin-form-row">
          <label>Last Name</label>
          <input id="inv-lname" type="text" />
        </div>
        <div class="admin-form-row">
          <label>Email</label>
          <input id="inv-email" type="email" />
        </div>
        <div class="admin-form-row">
          <label>Password</label>
          <input id="inv-password" type="password" />
        </div>
      </div>
      <div class="admin-modal-footer">
        <button class="admin-btn admin-btn-secondary" id="inv-cancel">Cancel</button>
        <button class="admin-btn admin-btn-primary" id="inv-save">Create Provider</button>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    function close() {
      overlay.remove();
    }

    modal.querySelector<HTMLButtonElement>('#inv-cancel')!.addEventListener('click', close);
    modal.querySelector<HTMLButtonElement>('#inv-save')!.addEventListener('click', async () => {
      const data = {
        firstName: (modal.querySelector<HTMLInputElement>('#inv-fname')!.value || '').trim(),
        lastName: (modal.querySelector<HTMLInputElement>('#inv-lname')!.value || '').trim(),
        email: (modal.querySelector<HTMLInputElement>('#inv-email')!.value || '').trim(),
        password: modal.querySelector<HTMLInputElement>('#inv-password')!.value,
      };
      if (!data.firstName || !data.lastName || !data.email || !data.password) {
        alert('All fields are required');
        return;
      }
      if (data.password.length < 8) {
        alert('Password must be at least 8 characters');
        return;
      }
      const saveBtn = modal.querySelector<HTMLButtonElement>('#inv-save')!;
      saveBtn.disabled = true;
      saveBtn.textContent = 'Creating...';
      try {
        await post('/providers', data);
        close();
        await load();
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Failed to create provider');
        saveBtn.disabled = false;
        saveBtn.textContent = 'Create Provider';
      }
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });
  }

  load().catch((err) => {
    container.innerHTML = `<div class="admin-page"><div class="admin-login-error">${err instanceof Error ? err.message : 'Failed to load providers'}</div></div>`;
  });

  return () => {
    container.innerHTML = '';
  };
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
