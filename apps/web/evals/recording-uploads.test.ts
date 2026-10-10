import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { getDb } from '../lib/db';
import { ApiError } from '../lib/errors';
import {
  performRecordingUpload,
  adoptRecordingUpload,
  cleanupRecordingUploadAttempt,
  type RecordingUploadContext,
} from '../lib/recording-uploads';

const testUrl = process.env.TEST_DATABASE_URL;
if (testUrl) process.env.DATABASE_URL = testUrl;
const suite = testUrl ? describe : describe.skip;
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function returnedBlob(pathname: string) {
  return { pathname, url: `https://syntheticstore.private.blob.vercel-storage.com/${pathname}`,
    etag: '"synthetic-returned-etag"' };
}

suite(
  'private recording upload lifecycle against isolated PostgreSQL',
  { concurrency: false },
  () => {
    let tenantId: string;
    let userId: string;
    let consultationId: string;
    let sequence = 0;
    const objects = new Set<string>();
    const file = new File(['synthetic test bytes'], 'synthetic.webm', { type: 'audio/webm' });
    before(async () => {
      const suffix = randomUUID();
      const tenant = await getDb().tenant.create({
        data: {
          name: 'Synthetic upload lifecycle',
          slug: `uploads-${suffix}`,
          state: 'TEST',
          medicalDirector: 'Synthetic test director',
        },
      });
      tenantId = tenant.id;
      const user = await getDb().user.create({
        data: {
          tenantId,
          email: `uploads-${suffix}@example.test`,
          firstName: 'Synthetic',
          lastName: 'Owner',
          role: 'SUPER_USER',
          passwordHash: 'unusable-synthetic-password',
        },
      });
      userId = user.id;
      const location = await getDb().location.create({
        data: { tenantId, name: 'Synthetic upload location' },
      });
      const configuration = await getDb().clinicConfigurationVersion.create({
        data: { tenantId, userId, locationId: location.id, version: 1, status: 'DRAFT',
          payload: {}, source: 'Unused synthetic recording-parent fixture' },
      });
      const consultation = await getDb().consultation.create({
        data: { tenantId, providerId: userId, locationId: location.id,
          configurationVersionId: configuration.id, reference: `SYNTHETIC-${suffix}`,
          idempotencyKey: suffix, isTest: true },
      });
      consultationId = consultation.id;
    });
    after(async () => {
      await getDb().generationJob.deleteMany({ where: { tenantId } });
      await getDb().recordingSegment.deleteMany({ where: { tenantId } });
      await getDb().consultation.deleteMany({ where: { tenantId } });
      await getDb().clinicConfigurationVersion.deleteMany({ where: { tenantId } });
      await getDb().user.deleteMany({ where: { tenantId } });
      await getDb().location.deleteMany({ where: { tenantId } });
      await getDb().tenant.delete({ where: { id: tenantId } });
      await getDb().$disconnect();
    });
    async function fixture(): Promise<RecordingUploadContext> {
      const recordingId = randomUUID();
      const attemptId = randomUUID();
      const blobPath = `private/${tenantId}/recordings/${consultationId}/${recordingId}/${attemptId}`;
      await getDb().recordingSegment.create({
        data: {
          id: recordingId,
          tenantId,
          userId,
          consultationId,
          segmentKey: randomUUID(),
          sequence: sequence++,
          blobPath,
          mimeType: file.type,
          bytes: file.size,
          consentAt: new Date(),
          expiresAt: new Date(Date.now() + 3600000),
          status: 'UPLOADING',
        },
      });
      return { recordingId, attemptId, tenantId, userId, consultationId, blobPath, mimeType: file.type };
    }
    let deletionCalls = 0;
    const deleteFile = async (path: string) => {
      deletionCalls++; objects.delete(path);
    };
    async function adopt(path: string, context: RecordingUploadContext) {
      return getDb().$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "Consultation" WHERE "id" = ${context.consultationId}::uuid AND "tenantId" = ${context.tenantId}::uuid FOR UPDATE`;
        await tx.recordingSegment.update({
          where: { id: context.recordingId },
          data: { status: 'UPLOADED', blobPath: path },
        });
        await adoptRecordingUpload(tx, context);
        return context.recordingId;
      });
    }

    it('retains a late discarded settled upload pointer while provider deletion stays deferred', async () => {
      const context = await fixture();
      const entered = deferred<void>();
      const remote = deferred<ReturnType<typeof returnedBlob>>();
      const upload = performRecordingUpload(
        context,
        file,
        async () => {
          throw new ApiError(409, 'Discarded synthetic source.', 'RECORDING_UPLOAD_INTERRUPTED');
        },
        {
          putFile: async () => {
            entered.resolve();
            return remote.promise;
          },
          deleteFile: async () => {
            throw new Error('Synthetic temporary deletion outage');
          },
        },
      );
      await entered.promise;
      await getDb().recordingSegment.update({
        where: { id: context.recordingId },
        data: { status: 'DISCARDED', blobPath: '', expiresAt: new Date() },
      });
      await getDb().generationJob.update({
        where: { id: context.attemptId },
        data: { status: 'CANCELLED' },
      });
      assert.equal(
        (await cleanupRecordingUploadAttempt(context.attemptId, deleteFile)).pending,
        true,
      );
      objects.add(context.blobPath);
      remote.resolve(returnedBlob(context.blobPath));
      await assert.rejects(upload, { code: 'RECORDING_UPLOAD_INTERRUPTED' });
      const pending = await getDb().generationJob.findUniqueOrThrow({
        where: { id: context.attemptId },
      });
      assert.equal(pending.status, 'CLEANUP_PENDING');
      assert.equal((pending.result as { blobPath: string }).blobPath, context.blobPath);
      assert.ok(objects.has(context.blobPath));
      assert.equal(
        (await cleanupRecordingUploadAttempt(context.attemptId, deleteFile)).pending,
        true,
      );
      assert.equal(objects.has(context.blobPath), true);
      const retained = await getDb().generationJob.findUniqueOrThrow({ where: { id: context.attemptId } });
      assert.equal(retained.status, 'CLEANUP_PENDING');
      assert.equal((retained.result as { uploadSettled: boolean }).uploadSettled, true);
      assert.equal(deletionCalls, 0);
    });

    it('keeps unknown expired remote outcomes and late objects addressable without inferring settlement', async () => {
      const context = await fixture();
      const entered = deferred<void>();
      const remote = deferred<ReturnType<typeof returnedBlob>>();
      const upload = performRecordingUpload(
        context,
        file,
        async () => {
          throw new ApiError(409, 'Expired synthetic source.', 'RECORDING_UPLOAD_INTERRUPTED');
        },
        {
          putFile: async () => {
            entered.resolve();
            return remote.promise;
          },
          deleteFile,
        },
      );
      await entered.promise;
      await getDb().generationJob.update({
        where: { id: context.attemptId },
        data: { createdAt: new Date(Date.now() - 17 * 60000) },
      });
      await getDb().recordingSegment.update({
        where: { id: context.recordingId },
        data: {
          status: 'UPLOAD_FAILED',
          consentAt: new Date(Date.now() - 3600000),
          createdAt: new Date(Date.now() - 17 * 60000),
          expiresAt: new Date(Date.now() - 1000),
        },
      });
      assert.equal(
        (await cleanupRecordingUploadAttempt(context.attemptId, deleteFile)).pending,
        true,
      );
      objects.add(context.blobPath);
      await cleanupRecordingUploadAttempt(context.attemptId, deleteFile);
      assert.equal(objects.has(context.blobPath), true);
      const retained = await getDb().generationJob.findUniqueOrThrow({
        where: { id: context.attemptId },
      });
      assert.equal(retained.status, 'CLEANUP_PENDING');
      assert.equal((retained.result as { blobPath: string }).blobPath, context.blobPath);
      remote.resolve(returnedBlob(context.blobPath));
      await assert.rejects(upload, { code: 'RECORDING_UPLOAD_INTERRUPTED' });
    });

    it('waits for an adopting recording lock and never deletes its committed accepted object', async () => {
      const context = await fixture();
      const rowHeld = deferred<void>();
      const release = deferred<void>();
      let deletionCalls = 0;
      const upload = performRecordingUpload(
        context,
        file,
        async (path, uploadContext) =>
          getDb().$transaction(async (tx) => {
            await tx.$queryRaw`SELECT "id" FROM "Consultation" WHERE "id" = ${context.consultationId}::uuid AND "tenantId" = ${context.tenantId}::uuid FOR UPDATE`;
            await tx.recordingSegment.update({
              where: { id: context.recordingId },
              data: { status: 'UPLOADED', blobPath: path },
            });
            rowHeld.resolve();
            await release.promise;
            await adoptRecordingUpload(tx, uploadContext);
            return context.recordingId;
          }),
        {
          putFile: async (path) => {
            objects.add(path);
            return returnedBlob(path);
          },
          deleteFile,
        },
      );
      await rowHeld.promise;
      const cleanup = cleanupRecordingUploadAttempt(
        context.attemptId,
        async (path) => {
          deletionCalls++;
          await deleteFile(path);
        },
        new Date(Date.now() + 5 * 60000),
      );
      try {
        let waiting = false;
        for (let index = 0; index < 100 && !waiting; index++) {
          const rows = await getDb().$queryRaw<
            Array<{ count: bigint }>
          >`SELECT count(*) FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock' AND query LIKE '%Consultation%'`;
          waiting = Number(rows[0]?.count ?? 0) > 0;
          if (!waiting) await new Promise((resolve) => setTimeout(resolve, 10));
        }
        assert.ok(waiting, 'cleanup must actually wait on the owner-first adoption lock');
      } finally {
        release.resolve();
      }
      assert.equal(await upload, context.recordingId);
      assert.equal((await cleanup).preserved, true);
      assert.equal(deletionCalls, 0);
      assert.ok(objects.has(context.blobPath));
    });

    it('prevents adoption after cleanup wins its claim and preserves a newer accepted path', async () => {
      const context = await fixture();
      const entered = deferred<void>();
      const remote = deferred<ReturnType<typeof returnedBlob>>();
      const upload = performRecordingUpload(context, file, adopt, {
        putFile: async () => {
          entered.resolve();
          return remote.promise;
        },
        deleteFile,
      });
      await entered.promise;
      await getDb().recordingSegment.update({ where: { id: context.recordingId }, data: { status: 'UPLOAD_FAILED' } });
      await cleanupRecordingUploadAttempt(
        context.attemptId,
        deleteFile,
        new Date(Date.now() + 5 * 60000),
      );
      objects.add(context.blobPath);
      remote.resolve(returnedBlob(context.blobPath));
      await assert.rejects(upload, { code: 'RECORDING_UPLOAD_INTERRUPTED' });
      const newerAttempt = randomUUID();
      const newerPath = context.blobPath.slice(0, -context.attemptId.length) + newerAttempt;
      objects.add(newerPath);
      await getDb().recordingSegment.update({
        where: { id: context.recordingId },
        data: { status: 'UPLOADED', blobPath: newerPath, blobObject: Prisma.DbNull },
      });
      objects.add(context.blobPath);
      await getDb().generationJob.update({
        where: { id: context.attemptId },
        data: {
          status: 'CLEANUP_PENDING',
          result: {
            recordingId: context.recordingId,
            blobPath: context.blobPath,
            state: 'CLEANUP_PENDING',
            uploadSettled: true,
          },
        },
      });
      assert.equal((await cleanupRecordingUploadAttempt(context.attemptId, deleteFile)).pending, true);
      assert.equal(deletionCalls, 0);
      assert.equal(objects.has(context.blobPath), true);
      assert.ok(objects.has(newerPath));
      assert.equal(
        (await getDb().recordingSegment.findUniqueOrThrow({ where: { id: context.recordingId } }))
          .blobPath,
        newerPath,
      );
    });
  },
);
