import { randomUUID } from 'node:crypto';
import { describe, expect, test, vi } from 'vitest';

const database = vi.hoisted(() => ({ getDb: vi.fn(() => { throw new Error('No database in identity checks'); }) }));
vi.mock('./db', () => database);
import { captureRecordingObject, parseRecordingObjectIdentity, recordingObjectPath } from './recording-deletion-intents';

function fixture(setup = false) {
  const target = { tenantId: randomUUID(), recordingId: randomUUID(),
    consultationId: setup ? null : randomUUID(), setupConversationId: setup ? randomUUID() : null,
    uploadAttemptId: setup ? null : randomUUID() };
  const pathname = recordingObjectPath(target);
  const blob = { pathname, url: `https://syntheticstore.private.blob.vercel-storage.com/${pathname}`, etag: '"exact-returned-etag"' };
  return { target, blob, object: captureRecordingObject(target, blob) };
}

describe('dormant recording object identity', () => {
  test('captures a consultation attempt and preserves the exact returned ETag', () => {
    const { target, blob, object } = fixture();
    expect(object).toEqual({ ...target, version: 1, nonOverwrite: true,
      blobPath: blob.pathname, objectUrl: blob.url, storeId: 'syntheticstore', etag: blob.etag });
    expect(database.getDb).not.toHaveBeenCalled();
  });

  test('binds a setup recording to its fresh UUID and exact conversation', () => {
    const { target, object } = fixture(true);
    expect(object.blobPath).toBe(`private/${target.tenantId}/setup/${target.recordingId}`);
    expect(() => parseRecordingObjectIdentity({ ...object, uploadAttemptId: randomUUID() })).toThrow();
    expect(() => parseRecordingObjectIdentity({ ...object, consultationId: randomUUID() })).toThrow();
  });

  test('rejects foreign tenant, recording and attempt path substitutions', () => {
    const { object } = fixture();
    for (const field of ['tenantId', 'recordingId', 'consultationId', 'uploadAttemptId']) {
      expect(() => parseRecordingObjectIdentity({ ...object, [field]: randomUUID() })).toThrow();
    }
    expect(() => parseRecordingObjectIdentity({ ...object, blobPath: object.blobPath + '/later' })).toThrow();
    expect(() => parseRecordingObjectIdentity({ ...object, tenantId: 'A' + object.tenantId.slice(1) })).toThrow();
  });

  test('rejects URL credentials, ports, queries, fragments, traversal and another store', () => {
    const { target, blob, object } = fixture();
    for (const url of [blob.url + '?token=unsafe', blob.url + '#fragment',
      blob.url.replace('https://', 'https://user:pass@'), blob.url.replace('.com/', '.com:443/'),
      blob.url.replace('/private/', '/other/../private/'), blob.url.replace('.private.', '.public.'),
      blob.url.replace('https://', 'http://')]) {
      expect(() => captureRecordingObject(target, { ...blob, url })).toThrow();
    }
    expect(() => parseRecordingObjectIdentity({ ...object, storeId: 'anotherstore' })).toThrow();
  });

  test('defers missing, reusable and uncertain object metadata without guessing', () => {
    const { object } = fixture();
    for (const value of [null, { blobPath: object.blobPath }, { ...object, version: 0 },
      { ...object, nonOverwrite: false }, { ...object, etag: '' }, { ...object, etag: 'unsafe\r\nheader' },
      { ...object, uploadAttemptId: null }, { ...object, extra: 'unreviewed' }]) {
      expect(() => parseRecordingObjectIdentity(value)).toThrow();
    }
    expect(database.getDb).not.toHaveBeenCalled();
  });
});
