import { Prisma, type SetupRecordingUpload } from '@prisma/client';
import { getDb } from './db';
import { ApiError } from './errors';
import { assertRecordingPathNotDetached, captureRecordingObject, parseRecordingObjectIdentity,
  recordingDatabaseTime, recordingObjectPath, sameRecordingObject, type RecordingObjectIdentity } from './recording-deletion-intents';
import { recordingProcessingTransaction } from './recording-processing';

type Tx = Prisma.TransactionClient;
export interface SetupRecordingReservation {
  id: string; tenantId: string; userId: string; locationId: string; setupConversationId: string;
  purpose: 'VOICE' | 'CATALOG'; mimeType: string; bytes: number;
}
function interrupted(): never {
  throw new ApiError(409, 'Setup upload is no longer available for adoption.', 'SETUP_UPLOAD_INTERRUPTED');
}
async function owner(tx: Tx, row: SetupRecordingReservation) {
  await tx.$queryRaw`SELECT "id" FROM "SetupConversation" WHERE "id" = ${row.setupConversationId}::uuid AND "tenantId" = ${row.tenantId}::uuid FOR UPDATE`;
  await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${row.userId}::uuid AND "tenantId" = ${row.tenantId}::uuid FOR SHARE`;
  const user = await tx.user.findFirst({ where: { id: row.userId, tenantId: row.tenantId, isActive: true, role: 'SUPER_USER' }, include: { tenant: true } });
  const conversation = await tx.setupConversation.findFirst({ where: { id: row.setupConversationId,
    tenantId: row.tenantId, userId: row.userId, locationId: row.locationId,
    location: { is: { tenantId: row.tenantId, isActive: true } } } });
  if (!user?.tenant?.isActive || !conversation) interrupted();
}

export async function reserveSetupRecording(input: SetupRecordingReservation) {
  const blobPath = recordingObjectPath({ tenantId: input.tenantId, recordingId: input.id,
    consultationId: null, setupConversationId: input.setupConversationId, uploadAttemptId: null });
  return recordingProcessingTransaction(async tx => {
    await owner(tx, input);
    await assertRecordingPathNotDetached(tx, input.tenantId, blobPath);
    const now = await recordingDatabaseTime(tx);
    return tx.setupRecordingUpload.create({ data: { ...input, blobPath, consentAt: now,
      expiresAt: new Date(now.getTime() + 14 * 86400000) } });
  });
}

/** Independent commit: adoption rollback can never erase returned metadata. */
export async function settleSetupRecording(id: string, object: RecordingObjectIdentity) {
  const value = parseRecordingObjectIdentity(object);
  return recordingProcessingTransaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "SetupRecordingUpload" WHERE "id" = ${id}::uuid FOR UPDATE`;
    const row = await tx.setupRecordingUpload.findUniqueOrThrow({ where: { id } });
    if (value.recordingId !== id || value.tenantId !== row.tenantId || value.setupConversationId !== row.setupConversationId
      || value.consultationId !== null || value.uploadAttemptId !== null || value.blobPath !== row.blobPath) interrupted();
    if (row.uploadSettled) {
      if (!sameRecordingObject(row.blobObject, value)) interrupted();
      return row;
    }
    if (!['IN_FLIGHT', 'CLEANUP_PENDING'].includes(row.state)) interrupted();
    return tx.setupRecordingUpload.update({ where: { id }, data: { uploadSettled: true, blobObject: value } });
  });
}

export async function queueSetupRecordingCleanup(id: string, tenantId: string) {
  // A queue/settlement-only journal lock never subsequently acquires an owner.
  return getDb().setupRecordingUpload.updateMany({ where: { id, tenantId, state: 'IN_FLIGHT' },
    data: { state: 'CLEANUP_PENDING' } });
}

export async function adoptSetupRecording<T>(id: string, object: RecordingObjectIdentity,
  createJob: (tx: Tx, journal: SetupRecordingUpload, object: RecordingObjectIdentity) => Promise<T>) {
  return recordingProcessingTransaction(async tx => {
    const initial = await tx.setupRecordingUpload.findUniqueOrThrow({ where: { id } });
    await owner(tx, { ...initial, purpose: initial.purpose === 'VOICE' ? 'VOICE' : 'CATALOG' });
    await tx.$queryRaw`SELECT "id" FROM "RecordingSegment" WHERE "id" = ${id}::uuid AND "tenantId" = ${initial.tenantId}::uuid FOR UPDATE`;
    await tx.$queryRaw`SELECT "id" FROM "SetupRecordingUpload" WHERE "id" = ${id}::uuid FOR UPDATE`;
    const row = await tx.setupRecordingUpload.findUniqueOrThrow({ where: { id } });
    if (row.state !== 'IN_FLIGHT' || !row.uploadSettled || !sameRecordingObject(row.blobObject, object)) interrupted();
    await assertRecordingPathNotDetached(tx, row.tenantId, row.blobPath);
    const now = await recordingDatabaseTime(tx);
    if (row.expiresAt <= now) interrupted();
    await tx.recordingSegment.create({ data: { id, tenantId: row.tenantId, userId: row.userId,
      setupConversationId: row.setupConversationId, segmentKey: id, sequence: 0, blobPath: row.blobPath,
      blobObject: object, mimeType: row.mimeType, bytes: row.bytes, consentAt: row.consentAt, expiresAt: row.expiresAt } });
    const result = await createJob(tx, row, object);
    await tx.setupRecordingUpload.update({ where: { id }, data: { state: 'ADOPTED' } });
    return result;
  });
}

export async function performSetupRecordingUpload<T>(input: SetupRecordingReservation,
  putFile: (path: string) => Promise<{ pathname: string; url: string; etag: string }>,
  createJob: (tx: Tx, journal: SetupRecordingUpload, object: RecordingObjectIdentity) => Promise<T>) {
  const journal = await reserveSetupRecording(input); // no put without a durable owner
  try {
    const blob = await putFile(journal.blobPath);
    const object = captureRecordingObject({ tenantId: journal.tenantId, recordingId: journal.id,
      consultationId: null, setupConversationId: journal.setupConversationId, uploadAttemptId: null }, blob);
    await settleSetupRecording(journal.id, object);
    return await adoptSetupRecording(journal.id, object, createJob);
  } catch (error) {
    try { await queueSetupRecordingCleanup(journal.id, journal.tenantId); }
    catch { /* The original journal remains unresolved, never guessed absent. */ }
    throw error;
  }
}
