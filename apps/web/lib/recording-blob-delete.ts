import { performance } from 'node:perf_hooks';
import { del, BlobPreconditionFailedError, BlobRequestAbortedError } from '@vercel/blob';
import { ApiError } from './errors';
import { parseRecordingObjectIdentity, type RecordingObjectIdentity } from './recording-deletion-intents';

export type RecordingDeleteIO = (url: string, options: {
  token: string; ifMatch: string; abortSignal: AbortSignal;
}) => Promise<void>;
export type RecordingDeleteOutcome = { deleted: true; durationMs: number }
  | { deleted: false; durationMs: number; error: 'DELETE_FAILED' | 'DELETE_TIMEOUT' | 'OBJECT_CHANGED' };

/** Same trusted-store contract as the private reader. Never persist this value. */
export function recordingDeleteToken(object: RecordingObjectIdentity, token = process.env.BLOB_READ_WRITE_TOKEN): string {
  const identity = parseRecordingObjectIdentity(object);
  if (!token?.startsWith('vercel_blob_rw_') || token.split('_')[3] !== identity.storeId)
    throw new ApiError(503, 'The original private store is unavailable.', 'RECORDING_STORE_UNAVAILABLE');
  return token;
}

export function recordingDeleteError(error: unknown): 'DELETE_FAILED' | 'DELETE_TIMEOUT' | 'OBJECT_CHANGED' {
  if (error instanceof BlobPreconditionFailedError) return 'OBJECT_CHANGED';
  if (error instanceof BlobRequestAbortedError || (error instanceof Error && ['AbortError', 'TimeoutError'].includes(error.name)))
    return 'DELETE_TIMEOUT';
  // Not-found is not an independently verified successful conditional deletion.
  return 'DELETE_FAILED';
}

/** Node step only: one SDK invocation, not a promise of one HTTP request. */
export async function deleteRecordingBlob(object: RecordingObjectIdentity, remainingMs: number,
  io: RecordingDeleteIO = del): Promise<RecordingDeleteOutcome> {
  const identity = parseRecordingObjectIdentity(object);
  const token = recordingDeleteToken(identity);
  if (!Number.isSafeInteger(remainingMs) || remainingMs <= 0 || remainingMs > 20_000)
    throw new ApiError(409, 'The cleanup admission deadline has passed.', 'RECORDING_CLEANUP_DEADLINE');
  const began = performance.now();
  const duration = () => Math.min(60_000, Math.max(0, Math.floor(performance.now() - began)));
  try {
    await io(identity.objectUrl, { token, ifMatch: identity.etag, abortSignal: AbortSignal.timeout(remainingMs) });
    return { deleted: true, durationMs: duration() };
  } catch (error) {
    return { deleted: false, error: recordingDeleteError(error), durationMs: duration() };
  }
}
