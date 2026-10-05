import { z } from 'zod';
import { ApiError } from './errors';

export const MAINTENANCE_PAGE_LIMITS = {
  reminders: 20, abandonedUploads: 100, interruptedJobs: 100,
  expiredChallenges: 50, oldSessions: 50, oldRates: 50,
} as const;
export type MaintenanceFamily = keyof typeof MAINTENANCE_PAGE_LIMITS;
export const MAINTENANCE_FAMILIES = Object.keys(MAINTENANCE_PAGE_LIMITS) as MaintenanceFamily[];
export const MAINTENANCE_FAMILY_BUDGET_MS = 20_000;
export const RECORDING_CLEANUP_FAMILIES = ['recordingUploadCleanup', 'expiredAudioRetention'] as const;
export type RecordingCleanupFamily = typeof RECORDING_CLEANUP_FAMILIES[number];
const key = z.string().min(1).max(256);

const pageSchema = z.object({
  ids: z.array(key).max(100), index: z.number().int().min(0).max(100),
  cutoff: z.iso.datetime(), changed: z.number().int().min(0),
  dismissed: z.number().int().min(0), upserted: z.number().int().min(0),
  failed: z.number().int().min(0), deferred: z.number().int().min(0), finished: z.boolean(),
}).strict().refine((page) => page.index <= page.ids.length &&
  page.failed + page.deferred <= page.index &&
  page.finished === (page.index === page.ids.length) && new Set(page.ids).size === page.ids.length);
export type MaintenancePage = z.infer<typeof pageSchema>;
const uuid = z.string().uuid().regex(/^[0-9a-f-]+$/);
export const cleanupSourceKind = z.enum(['UPLOAD_ATTEMPT', 'SETUP_UPLOAD', 'RECORDING', 'LEGACY_INTENT']);
export type CleanupSourceKind = z.infer<typeof cleanupSourceKind>;
export const cleanupKeySchema = z.object({
  at: z.iso.datetime().refine(value => new Date(value).toISOString() === value),
  stableId: z.string().regex(/^(UPLOAD_ATTEMPT|SETUP_UPLOAD|RECORDING|LEGACY_INTENT):[0-9a-f-]{36}$/),
}).strict().refine(value => uuid.safeParse(value.stableId.split(':')[1]).success);
export type CleanupKey = z.infer<typeof cleanupKeySchema>;
export const cleanupItemSchema = z.object({
  kind: cleanupSourceKind, sourceId: uuid, tenantId: uuid, key: cleanupKeySchema, intentId: uuid.nullable(),
}).strict().refine(item => item.key.stableId === item.kind + ':' + item.sourceId);
export type CleanupItem = z.infer<typeof cleanupItemSchema>;
export const cleanupCursorSchema = z.object({ after: cleanupKeySchema.nullable(), ceiling: cleanupKeySchema.nullable() }).strict();
export const recordingCleanupPageSchema = z.object({
  items: z.array(cleanupItemSchema).max(5), index: z.number().int().min(0).max(5),
  cutoff: z.iso.datetime(), deadline: z.iso.datetime(), ceiling: cleanupKeySchema.nullable(), ended: z.boolean(),
  deleted: z.number().int().min(0), preserved: z.number().int().min(0), failed: z.number().int().min(0),
  deferred: z.number().int().min(0), durationMs: z.number().int().min(0).max(300_000),
  active: z.object({ intentId: uuid, token: uuid, index: z.number().int().min(0).max(4) }).strict().nullable(),
  finished: z.boolean(),
}).strict().refine(page => page.index <= page.items.length &&
  page.deleted + page.preserved + page.failed + page.deferred === page.index &&
  page.finished === (page.index === page.items.length) &&
  (!page.active || (!page.finished && page.active.index === page.index)) &&
  new Set(page.items.map(item => item.key.at + '|' + item.key.stableId)).size === page.items.length &&
  new Date(page.deadline).getTime() === new Date(page.cutoff).getTime() + MAINTENANCE_FAMILY_BUDGET_MS);
export type RecordingCleanupPage = z.infer<typeof recordingCleanupPageSchema>;
const dbCursor = z.object({ after: key.nullable(), ceiling: key.nullable() }).strict();
export const maintenanceCursorSchema = z.object({
  reminders: dbCursor.optional(), abandonedUploads: dbCursor.optional(), interruptedJobs: dbCursor.optional(),
  expiredChallenges: dbCursor.optional(), oldSessions: dbCursor.optional(), oldRates: dbCursor.optional(),
  recordingUploadCleanup: cleanupCursorSchema.optional(), expiredAudioRetention: cleanupCursorSchema.optional(),
}).strict();
export const maintenanceProgressSchema = z.object({
  reminders: pageSchema.optional(), abandonedUploads: pageSchema.optional(), interruptedJobs: pageSchema.optional(),
  expiredChallenges: pageSchema.optional(), oldSessions: pageSchema.optional(), oldRates: pageSchema.optional(),
  recordingUploadCleanup: recordingCleanupPageSchema.optional(), expiredAudioRetention: recordingCleanupPageSchema.optional(),
}).strict().refine(pages => MAINTENANCE_FAMILIES.every(family =>
  !pages[family] || pages[family].ids.length <= MAINTENANCE_PAGE_LIMITS[family]));

/** Empty selection is a proved terminal page, not permission to skip selection. */
export function emptyRecordingCleanupPage(cutoff: string): RecordingCleanupPage {
  return recordingCleanupPageSchema.parse({ items: [], index: 0, cutoff,
    deadline: new Date(new Date(cutoff).getTime() + MAINTENANCE_FAMILY_BUDGET_MS).toISOString(),
    ceiling: null, ended: true, deleted: 0, preserved: 0, failed: 0, deferred: 0,
    durationMs: 0, active: null, finished: true });
}

export function maintenanceState<T extends z.ZodType>(schema: T, data: unknown): z.output<T> {
  const parsed = schema.safeParse(data);
  if (!parsed.success) throw new ApiError(503, 'Maintenance progress is invalid.', 'MAINTENANCE_STATE_INVALID');
  return parsed.data;
}

export function completedMaintenancePages(data: unknown) {
  const progress = maintenanceState(maintenanceProgressSchema, data);
  if (MAINTENANCE_FAMILIES.some(family => !progress[family]?.finished) ||
    RECORDING_CLEANUP_FAMILIES.some(family => !progress[family]?.finished))
    throw new ApiError(409, 'Maintenance pages are incomplete.', 'MAINTENANCE_INCOMPLETE');
  return Object.fromEntries([
    ...MAINTENANCE_FAMILIES.map(family => [family, {
      checked: progress[family]!.ids.length, changed: progress[family]!.changed,
      failed: progress[family]!.failed, deferred: progress[family]!.deferred,
      dismissed: progress[family]!.dismissed, upserted: progress[family]!.upserted,
    }]),
    ...RECORDING_CLEANUP_FAMILIES.map(family => [family, {
      checked: progress[family]!.items.length, changed: progress[family]!.deleted,
      deleted: progress[family]!.deleted, preserved: progress[family]!.preserved,
      failed: progress[family]!.failed, deferred: progress[family]!.deferred,
      dismissed: 0, upserted: 0, durationMs: progress[family]!.durationMs,
    }]),
  ]) as Record<string, { checked: number; changed: number; failed: number; deferred: number;
    dismissed: number; upserted: number; deleted?: number; preserved?: number; durationMs?: number }>;
}
