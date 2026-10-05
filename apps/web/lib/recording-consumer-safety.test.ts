import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { Prisma, type RecordingSegment } from '@prisma/client';
import { emptyConsultationSummary } from '@dripwell/shared/v2';
import { ApiError } from './errors';
import { captureRecordingObject, recordingObjectPath } from './recording-deletion-intents';
import { recordingInputFingerprint, publicRecordingJobResult, publishRecordingProcessing, type RecordingProcessingSnapshot } from './recording-processing';
import { readPrivateRecording } from './recordings';
import { cleanupRecordingUploadAttempt, cleanupDiscardedRecordingUploads } from './recording-uploads';
import { performSetupRecordingUpload } from './setup-recording-uploads';
import { readRecordingSummaryCache } from '../workflows/recordings';

const effects = vi.hoisted(() => ({ guard: vi.fn(), tx: {} as Record<string, any>, db: {} as Record<string, any> }));
vi.mock('./db', () => ({ getDb: () => effects.db }));
vi.mock('./recording-processing', async importOriginal => ({
  ...await importOriginal<typeof import('./recording-processing')>(),
  assertRecordingProcessing: effects.guard,
  recordingProcessingTransaction: (body: (tx: unknown) => unknown) => body(effects.tx),
}));
vi.mock('@vercel/blob', () => ({ get: vi.fn(() => { throw new Error('Unexpected private provider call'); }),
  put: vi.fn(() => { throw new Error('Unexpected private provider call'); }) }));
vi.mock('workflow/api', () => ({ start: vi.fn(() => { throw new Error('Unexpected native workflow start'); }) }));

function fixture() {
  const target = { tenantId: randomUUID(), recordingId: randomUUID(), consultationId: randomUUID(),
    setupConversationId: null, uploadAttemptId: randomUUID() };
  const pathname = recordingObjectPath(target);
  const object = captureRecordingObject(target, { pathname,
    url: `https://syntheticstore.private.blob.vercel-storage.com/${pathname}`, etag: '"synthetic-etag"' });
  const row: RecordingSegment = { id: object.recordingId, tenantId: object.tenantId, userId: randomUUID(),
    consultationId: object.consultationId, setupConversationId: null, segmentKey: randomUUID(), sequence: 0,
    blobPath: pathname, blobObject: object, mimeType: 'audio/webm', bytes: 2, durationSeconds: null,
    consentAt: new Date(1000), expiresAt: new Date('2099-01-01'), createdAt: new Date(1000), updatedAt: new Date(1000),
    status: 'UPLOADED', transcript: null, staffTranscript: null };
  const snapshot: RecordingProcessingSnapshot = { jobId: randomUUID(), runId: 'synthetic-run', userId: row.userId,
    kind: 'TRANSCRIPTION', object, expectedSummaryRevision: 1, inputFingerprint: recordingInputFingerprint([row]) };
  return { object, row, snapshot };
}
function returned(object: ReturnType<typeof fixture>['object'], body = new Uint8Array([1, 2])) {
  return { statusCode: 200, blob: { url: object.objectUrl, pathname: object.blobPath, etag: object.etag, size: 2 },
    stream: new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(body); controller.close(); } }) };
}

describe('recording consumer safety contracts', () => {
  beforeEach(() => { vi.clearAllMocks(); effects.tx = {}; effects.db = {}; vi.stubEnv('BLOB_READ_WRITE_TOKEN', 'vercel_blob_rw_syntheticstore_SYNTHETIC_ONLY'); });
  afterEach(() => { vi.unstubAllEnvs(); });

  test('rejects expired, detached, legacy or changed private object before get', async () => {
    const { snapshot } = fixture();
    const get = vi.fn();
    for (const code of ['RECORDING_OBJECT_UNAVAILABLE', 'RECORDING_OBJECT_IDENTITY_INVALID', 'PROCESSING_JOB_REQUIRED']) {
      effects.guard.mockRejectedValueOnce(new ApiError(409, 'Synthetic denial', code));
      await expect(readPrivateRecording(snapshot, get)).rejects.toMatchObject({ code });
    }
    vi.stubEnv('BLOB_READ_WRITE_TOKEN', 'vercel_blob_rw_otherstore_SYNTHETIC_ONLY');
    await expect(readPrivateRecording(snapshot, get)).rejects.toMatchObject({ code: 'RECORDING_OBJECT_IDENTITY_INVALID' });
    expect(get).not.toHaveBeenCalled();
  });

  test('verifies returned private URL ETag pathname and byte limits', async () => {
    const { snapshot, object, row } = fixture();
    effects.guard.mockResolvedValue({ rows: [row] });
    for (const change of [{ etag: '"other"' }, { url: `${object.objectUrl}?wrong=1` }, { pathname: 'private/wrong' }, { size: 3 }]) {
      const response = returned(object); Object.assign(response.blob, change);
      await expect(readPrivateRecording(snapshot, vi.fn().mockResolvedValue(response))).rejects.toMatchObject({ code: 'STORED_FILE_INVALID' });
    }
    for (const body of [new Uint8Array([1]), new Uint8Array([1, 2, 3])])
      await expect(readPrivateRecording(snapshot, vi.fn().mockResolvedValue(returned(object, body)))).rejects.toMatchObject({ code: 'STORED_FILE_INVALID' });
    effects.guard.mockResolvedValueOnce({ rows: [{ ...row, bytes: 0 }] });
    const unopened = vi.fn();
    await expect(readPrivateRecording(snapshot, unopened)).rejects.toMatchObject({ code: 'STORED_FILE_INVALID' });
    expect(unopened).not.toHaveBeenCalled();
    effects.guard.mockResolvedValue({ rows: [row] });
    const get = vi.fn().mockResolvedValue(returned(object));
    expect(await readPrivateRecording(snapshot, get)).toEqual(new Uint8Array([1, 2]));
    expect(get).toHaveBeenCalledWith(object.objectUrl, expect.objectContaining({ access: 'private', useCache: false,
      token: 'vercel_blob_rw_syntheticstore_SYNTHETIC_ONLY', abortSignal: expect.any(AbortSignal) }));
  });

  test('rechecks the original snapshot after private I/O before returning bytes', async () => {
    const { snapshot, object, row } = fixture();
    effects.guard.mockResolvedValueOnce({ rows: [row] }).mockRejectedValueOnce(new ApiError(409, 'Late synthetic stop', 'PROCESSING_JOB_REQUIRED'));
    const get = vi.fn().mockResolvedValue(returned(object));
    await expect(readPrivateRecording(snapshot, get)).rejects.toMatchObject({ code: 'PROCESSING_JOB_REQUIRED' });
    expect(get).toHaveBeenCalledTimes(1);
    expect(effects.guard.mock.calls.map(call => call[1])).toEqual([snapshot, snapshot]);
  });

  test('keeps cached summary reuse bound to input identity and correction fingerprint', () => {
    const { row } = fixture();
    const other = { ...row, id: randomUUID(), sequence: 1, transcript: 'Another synthetic source' };
    const fingerprint = recordingInputFingerprint([row, other]);
    expect(recordingInputFingerprint([other, row])).toBe(fingerprint);
    for (const rows of [[row], [row, { ...other, staffTranscript: 'Staff correction' }],
      [row, { ...other, blobObject: null }], [row, { ...other, updatedAt: new Date(2000) }]])
      expect(recordingInputFingerprint(rows)).not.toBe(fingerprint);
    const value = { summary: emptyConsultationSummary(), evidence: [], usage: {}, costUsd: null, estimatedCostCents: null };
    expect(readRecordingSummaryCache(value, fingerprint)).toBeNull();
    expect(readRecordingSummaryCache({ ...value, recordingInputFingerprint: 'wrong' }, fingerprint)).toBeNull();
    expect(readRecordingSummaryCache({ ...value, recordingInputFingerprint: fingerprint }, fingerprint)).toEqual(value);
  });

  test('queues consultation upload failure without path delete or inferred settlement', async () => {
    const { object } = fixture();
    const attempt = { id: object.uploadAttemptId!, kind: 'RECORDING_UPLOAD', tenantId: object.tenantId,
      consultationId: object.consultationId, result: { recordingId: object.recordingId, blobPath: object.blobPath,
        state: 'IN_FLIGHT', uploadSettled: false } };
    const update = vi.fn();
    effects.tx = { $queryRaw: vi.fn(), generationJob: { findUniqueOrThrow: vi.fn(() => attempt), update },
      recordingSegment: { findFirst: vi.fn(() => ({ status: 'UPLOADING', blobPath: object.blobPath })) } };
    effects.db = { generationJob: { findUnique: vi.fn(() => attempt) }, $transaction: (body: (tx: unknown) => unknown) => body(effects.tx) };
    const del = vi.fn(() => { throw new Error('Dedicated deletion is forbidden'); });
    expect(await cleanupRecordingUploadAttempt(attempt.id, del, new Date('2099-01-01'))).toMatchObject({ pending: true, reason: 'UPLOAD_UNSETTLED' });
    expect(update).not.toHaveBeenCalled();
    effects.tx.recordingSegment.findFirst.mockReturnValue({ status: 'DISCARDED', blobPath: '' });
    expect(await cleanupRecordingUploadAttempt(attempt.id, del)).toMatchObject({ pending: true, deleted: false, reason: 'UPLOAD_UNSETTLED' });
    expect(update.mock.calls[0]![0].data.result).toEqual({ ...attempt.result, state: 'CLEANUP_PENDING' });
    expect(del).not.toHaveBeenCalled();
  });

  test('returns discard pending for unresolved legacy audio without provider call', async () => {
    const { row } = fixture();
    effects.tx = { $queryRaw: vi.fn(), recordingSegment: { findFirst: vi.fn(() => ({ ...row, status: 'DISCARDED', blobObject: null })) },
      generationJob: { updateMany: vi.fn(() => ({ count: 0 })) } };
    effects.db = { $transaction: (body: (tx: unknown) => unknown) => body(effects.tx) };
    expect(await cleanupDiscardedRecordingUploads(row.id, row.tenantId, row.blobPath)).toBe(true);
    expect(effects.tx.generationJob.updateMany.mock.calls[0]![0].where).toMatchObject({ tenantId: row.tenantId, kind: 'RECORDING_UPLOAD' });
    expect(effects.tx.generationJob.updateMany.mock.calls[0]![0].data).not.toHaveProperty('result');
  });

  test('creates durable setup ownership before put and queues failed adoption', async () => {
    const input = { id: randomUUID(), tenantId: randomUUID(), userId: randomUUID(), locationId: randomUUID(),
      setupConversationId: randomUUID(), purpose: 'VOICE' as const, mimeType: 'audio/webm', bytes: 2 };
    let journal: Record<string, any> | undefined;
    effects.tx = { $queryRaw: vi.fn(() => [{ now: new Date() }]),
      user: { findFirst: vi.fn(() => ({ tenant: { isActive: true } })) }, setupConversation: { findFirst: vi.fn(() => ({})) },
      recordingDeletionIntent: { findUnique: vi.fn(() => null) },
      setupRecordingUpload: { create: vi.fn(({ data }) => (journal = { ...data, state: 'IN_FLIGHT', uploadSettled: false })),
        findUniqueOrThrow: vi.fn(() => journal), update: vi.fn(({ data }) => Object.assign(journal!, data)) },
      recordingSegment: { create: vi.fn() } };
    const queued = vi.fn(({ data }) => { Object.assign(journal!, data); return { count: 1 }; });
    effects.db = { setupRecordingUpload: { updateMany: queued } };
    const put = vi.fn(async (path: string) => {
      expect(journal).toMatchObject({ ...input, blobPath: path, uploadSettled: false, state: 'IN_FLIGHT' });
      return { pathname: path, url: `https://syntheticstore.private.blob.vercel-storage.com/${path}`, etag: '"returned"' };
    });
    await expect(performSetupRecordingUpload(input, put, async () => {
      expect(journal).toMatchObject({ uploadSettled: true, state: 'IN_FLIGHT', blobObject: { etag: '"returned"' } });
      throw new Error('Synthetic adoption rollback');
    })).rejects.toThrow('Synthetic adoption rollback');
    expect(journal).toMatchObject({ state: 'CLEANUP_PENDING', uploadSettled: true, blobObject: { nonOverwrite: true } });
    expect(put).toHaveBeenCalledTimes(1); expect(queued).toHaveBeenCalledTimes(1);
  });

  test('keeps cleanup records out of AI polling and preserves cooperative-cancellation limits', async () => {
    const { object, snapshot, row } = fixture();
    const visible = { recordingId: row.id, recordingObject: object, processingStartToken: randomUUID(),
      processingSummaryAttempt: { childJobId: randomUUID(), runId: 'failed-synthetic-run',
        inputFingerprint: snapshot.inputFingerprint, expectedSummaryRevision: 1 },
      recordingInputFingerprint: snapshot.inputFingerprint, needsReview: true, transcript: 'Saved synthetic text' };
    expect(publicRecordingJobResult(visible)).toEqual({ recordingId: row.id, needsReview: true, transcript: 'Saved synthetic text' });
    effects.guard.mockResolvedValue({ rows: [row] });
    const get = vi.fn().mockResolvedValue(returned(object));
    await readPrivateRecording(snapshot, get);
    const signal = get.mock.calls[0]![1].abortSignal;
    expect(signal).toBeInstanceOf(AbortSignal);
    // The signal requests cancellation; the post-I/O guard, not abort alone,
    // prevents publication. No test claims forced remote I/O cancellation.
    expect(effects.guard).toHaveBeenCalledTimes(2);
    expect(effects.db).toEqual({}); // no journal/intents exposed through an AI job write
  });

  test('retries only known P2034 publication failures within the shared database boundary', async () => {
    const { snapshot } = fixture();
    const conflict = new Prisma.PrismaClientKnownRequestError('Synthetic publication conflict', {
      code: 'P2034', clientVersion: Prisma.prismaVersion.client,
    });
    const value = { committed: 'synthetic-transaction-result' };
    // Reject before callback entry, then return a controlled transaction result.
    // This isolates orchestration; the PG cases exercise real guards and writes.
    const transaction = vi.fn().mockRejectedValueOnce(conflict).mockResolvedValueOnce(value);
    effects.db = { $transaction: transaction };
    const body = vi.fn();
    expect(await publishRecordingProcessing(snapshot, body)).toBe(value);
    expect(transaction).toHaveBeenCalledTimes(2);
    expect(transaction.mock.calls[0][0]).toBe(transaction.mock.calls[1][0]);
    for (const call of transaction.mock.calls) expect(call).toEqual([expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 2000, timeout: 10_000,
    }]);
    expect(body).not.toHaveBeenCalled();
  });

  test('caps publication conflicts and propagates all other errors unchanged', async () => {
    const { snapshot } = fixture();
    const conflicts = Array.from({ length: 12 }, () => new Prisma.PrismaClientKnownRequestError('Synthetic conflict', {
      code: 'P2034', clientVersion: Prisma.prismaVersion.client,
    }));
    const transaction = vi.fn();
    for (const error of conflicts) transaction.mockRejectedValueOnce(error);
    effects.db = { $transaction: transaction };
    const body = vi.fn();
    await expect(publishRecordingProcessing(snapshot, body)).rejects.toBe(conflicts[11]);
    expect(transaction).toHaveBeenCalledTimes(12);
    expect(body).not.toHaveBeenCalled();
    for (const error of [
      new Prisma.PrismaClientKnownRequestError('Synthetic ambiguous transaction', {
        code: 'P2028', clientVersion: Prisma.prismaVersion.client,
      }),
      new ApiError(409, 'Synthetic authority changed', 'PROCESSING_JOB_REQUIRED'),
      { code: 'P2034' },
      new Error('Synthetic non-Prisma failure'),
    ]) {
      const rejected = vi.fn().mockRejectedValue(error);
      effects.db = { $transaction: rejected };
      await expect(publishRecordingProcessing(snapshot, body)).rejects.toBe(error);
      expect(rejected).toHaveBeenCalledTimes(1);
    }
    expect(body).not.toHaveBeenCalled();
  });
});
