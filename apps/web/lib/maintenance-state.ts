import { z } from 'zod';
import { ApiError } from './errors';

export const MAINTENANCE_PAGE_LIMITS = {
  reminders: 20, abandonedUploads: 100, interruptedJobs: 100,
  expiredChallenges: 50, oldSessions: 50, oldRates: 50,
} as const;
export type MaintenanceFamily = keyof typeof MAINTENANCE_PAGE_LIMITS;
export const MAINTENANCE_FAMILIES = Object.keys(MAINTENANCE_PAGE_LIMITS) as MaintenanceFamily[];
export const MAINTENANCE_FAMILY_BUDGET_MS = 20_000;
const familyName = z.enum(['reminders', 'abandonedUploads', 'interruptedJobs', 'expiredChallenges', 'oldSessions', 'oldRates']);
const key = z.string().min(1).max(256);
export const maintenanceCursorSchema = z.partialRecord(familyName,
  z.object({ after: key.nullable(), ceiling: key.nullable() }).strict());
const pageSchema = z.object({
  ids: z.array(key).max(100), index: z.number().int().min(0).max(100),
  cutoff: z.iso.datetime(), changed: z.number().int().min(0),
  dismissed: z.number().int().min(0), upserted: z.number().int().min(0),
  failed: z.number().int().min(0), deferred: z.number().int().min(0), finished: z.boolean(),
}).strict().refine((page) => page.index <= page.ids.length &&
  page.failed + page.deferred <= page.index &&
  page.finished === (page.index === page.ids.length) && new Set(page.ids).size === page.ids.length);
export type MaintenancePage = z.infer<typeof pageSchema>;
export const maintenanceProgressSchema = z.partialRecord(familyName, pageSchema).refine((pages) =>
  MAINTENANCE_FAMILIES.every((family) => !pages[family] || pages[family].ids.length <= MAINTENANCE_PAGE_LIMITS[family]));

export function maintenanceState<T extends z.ZodType>(schema: T, data: unknown): z.output<T> {
  const parsed = schema.safeParse(data);
  if (!parsed.success) throw new ApiError(503, 'Maintenance progress is invalid.', 'MAINTENANCE_STATE_INVALID');
  return parsed.data;
}

export function completedMaintenancePages(data: unknown): Record<MaintenanceFamily, {
  checked: number; changed: number; failed: number; deferred: number; dismissed: number; upserted: number;
}> {
  const progress = maintenanceState(maintenanceProgressSchema, data);
  if (MAINTENANCE_FAMILIES.some((family) => !progress[family]?.finished))
    throw new ApiError(409, 'Maintenance pages are incomplete.', 'MAINTENANCE_INCOMPLETE');
  return Object.fromEntries(MAINTENANCE_FAMILIES.map((family) => [family, {
    checked: progress[family]!.ids.length, changed: progress[family]!.changed,
    failed: progress[family]!.failed, deferred: progress[family]!.deferred,
    dismissed: progress[family]!.dismissed, upserted: progress[family]!.upserted,
  }])) as Record<MaintenanceFamily, { checked: number; changed: number; failed: number; deferred: number; dismissed: number; upserted: number }>;
}
