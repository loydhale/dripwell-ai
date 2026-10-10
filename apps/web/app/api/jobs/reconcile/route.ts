import { z } from 'zod';
import { apiRoute, json, readJson } from '../../../../lib/http';
import { maintenanceAuthorization, maintenanceContext } from '../../../../lib/maintenance-context';
import { maintenanceStatus, reserveMaintenance } from '../../../../lib/maintenance-coordinator';
import { dispatchMaintenance, maintenanceScope } from '../../../../workflows/maintenance';

export const maxDuration = 300;

// The unchanged Cron URL only observes status. Scheduling needs an explicit,
// machine-authorized POST; build/import/deploy/GET never bootstraps a run.
export const GET = apiRoute(async (request) => {
  maintenanceAuthorization(request);
  const context = maintenanceContext();
  return json({ state: await maintenanceStatus(context), ...maintenanceScope() });
});

export const POST = apiRoute(async (request) => {
  maintenanceAuthorization(request);
  const context = maintenanceContext();
  const input = await readJson(request, z.object({
    command: z.enum(['run-once', 'start', 'stop', 'recover']),
  }).strict(), 2048);
  const result = await reserveMaintenance(context, input.command);
  if (!result.reservation) return json({ state: result.state, ...maintenanceScope() });
  const dispatched = await dispatchMaintenance(result.reservation);
  return json({ state: result.state, dispatched, ...maintenanceScope() }, 202);
});
