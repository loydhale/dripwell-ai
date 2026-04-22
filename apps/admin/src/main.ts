import { makeTenantId } from '@dripwell/shared';

const app = document.getElementById('app');
if (app) {
  app.innerHTML = `
    <div style="font-family: Inter, sans-serif; padding: 40px; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #0f7a6a; font-family: Fraunces, serif;">DripWell Admin</h1>
      <p>Super user admin panel for clinic management, catalog configuration, and analytics.</p>
      <p style="color: #64748b; font-size: 14px; margin-top: 24px;">
        Workspace linked: ${makeTenantId('admin-tenant')}
      </p>
    </div>
  `;
}
