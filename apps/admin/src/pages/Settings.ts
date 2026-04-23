import { get, put } from '../lib/api.js';
import { setPageTitle } from '../components/Layout.js';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  state: string;
  medicalDirector: string;
  isActive: boolean;
  config: Record<string, unknown> | null;
}

export function renderSettings(container: HTMLElement): () => void {
  container.innerHTML = '<div class="admin-page">Loading settings...</div>';
  setPageTitle('Settings');

  async function load() {
    const userRes = await get<{ user: { tenantId: string | null } }>('/me');
    if (!userRes.user.tenantId) {
      container.innerHTML = '<div class="admin-page"><div class="admin-login-error">No clinic assigned. Create a clinic first.</div></div>';
      return;
    }
    const tenantRes = await get<{ tenant: Tenant }>(`/tenants/${userRes.user.tenantId}`);
    render(tenantRes.tenant);
  }

  function render(tenant: Tenant) {
    const page = document.createElement('div');
    page.className = 'admin-page';

    const form = document.createElement('div');
    form.className = 'admin-form';

    const config = (tenant.config || {}) as Record<string, unknown>;

    form.innerHTML = `
      <div class="admin-form-row">
        <label for="set-name">Clinic Name</label>
        <input id="set-name" type="text" value="${tenant.name}" />
      </div>
      <div class="admin-form-row">
        <label for="set-state">State</label>
        <input id="set-state" type="text" value="${tenant.state}" />
      </div>
      <div class="admin-form-row">
        <label for="set-md">Medical Director Contact</label>
        <input id="set-md" type="text" value="${tenant.medicalDirector}" />
      </div>
      <div class="admin-form-row">
        <label for="set-intake">Intake Form Length</label>
        <select id="set-intake">
          <option value="short" ${config.intakeFormLength === 'short' ? 'selected' : ''}>Short</option>
          <option value="standard" ${config.intakeFormLength === 'standard' || !config.intakeFormLength ? 'selected' : ''}>Standard</option>
          <option value="long" ${config.intakeFormLength === 'long' ? 'selected' : ''}>Long</option>
        </select>
      </div>
      <button class="admin-btn admin-btn-primary" id="set-save">Save Changes</button>
    `;

    page.appendChild(form);
    container.innerHTML = '';
    container.appendChild(page);

    const saveBtn = form.querySelector<HTMLButtonElement>('#set-save')!;
    saveBtn.addEventListener('click', async () => {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';

      const data = {
        name: (form.querySelector<HTMLInputElement>('#set-name')!.value || '').trim(),
        state: (form.querySelector<HTMLInputElement>('#set-state')!.value || '').trim(),
        medicalDirector: (form.querySelector<HTMLInputElement>('#set-md')!.value || '').trim(),
      };

      const newConfig = {
        intakeFormLength: form.querySelector<HTMLSelectElement>('#set-intake')!.value,
      };

      try {
        await put(`/tenants/${tenant.id}`, { ...data, config: newConfig });
        saveBtn.textContent = 'Saved';
        setTimeout(() => {
          saveBtn.disabled = false;
          saveBtn.textContent = 'Save Changes';
        }, 1200);
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Save failed');
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Changes';
      }
    });
  }

  load().catch((err) => {
    container.innerHTML = `<div class="admin-page"><div class="admin-login-error">${err instanceof Error ? err.message : 'Failed to load settings'}</div></div>`;
  });

  return () => {
    container.innerHTML = '';
  };
}
