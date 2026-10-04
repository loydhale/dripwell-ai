import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { PDFDocument } from 'pdf-lib';
import { beforeAll, afterAll, describe, expect, test, vi } from 'vitest';
import { Prisma } from '@prisma/client';
vi.mock('server-only', () => ({}));
const cookieValues = vi.hoisted(() => new Map<string, string>());
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (key: string) => (cookieValues.has(key) ? { value: cookieValues.get(key) } : undefined),
    set: (key: string, value: string) => cookieValues.set(key, value),
    delete: (key: string) => cookieValues.delete(key),
  }),
}));
import { getDb } from './db';
import {
  approvedTakeaway,
  createShare,
  readTakeaway,
  revokeShare,
  sharedDocument,
  takeawayPdf,
  validShare,
} from './sharing';

const run = Boolean(process.env.TEST_DATABASE_URL);
if (run) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
const suite = run ? describe : describe.skip;
const prefix = `sharing-${randomUUID()}`;
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
suite('approved documents and recipient access against isolated PostgreSQL', () => {
  let tenantId: string;
  let userId: string;
  let consultationId: string;
  let shareId: string;
  let locationId: string;
  const linkToken = randomBytes(32).toString('base64url');
  const sessionToken = randomBytes(32).toString('base64url');
  beforeAll(async () => {
    const db = getDb();
    const tenant = await db.tenant.create({
      data: {
        name: 'Synthetic document clinic',
        slug: prefix,
        state: 'TX',
        medicalDirector: 'Synthetic fixture',
      },
    });
    tenantId = tenant.id;
    const location = await db.location.create({ data: { tenantId, name: 'Synthetic location' } });
    locationId = location.id;
    const user = await db.user.create({
      data: {
        tenantId,
        email: `${prefix}@example.test`,
        passwordHash: 'unused-synthetic-no-login',
        firstName: 'Synthetic',
        lastName: 'Provider',
        role: 'PROVIDER',
      },
    });
    userId = user.id;
    const configuration = {
      schemaVersion: 2,
      clinic: {
        name: 'Clínica Élan',
        currency: 'USD',
        contact: 'Contact your clinic',
        brandColor: '#0d9488',
      },
      questions: [],
      products: [],
      recommendationPolicy: {
        clinicalValidated: true,
        validatedBy: 'Synthetic',
        validationNote: 'Synthetic test only',
        maxAddOns: 2,
        maxWellnessOffers: 2,
      },
      reminders: { careOutcomeHours: 24, wellnessDecisionHours: 24 },
      retention: { audioDays: 30, documentDays: 365, shareExpiryHours: 24 },
    };
    const version = await db.clinicConfigurationVersion.create({
      data: {
        tenantId,
        locationId: location.id,
        version: 1,
        status: 'ACTIVE',
        payload: configuration,
        source: 'SYNTHETIC_TEST',
        userId,
      },
    });
    const item = {
      productId: 'synthetic-product',
      name: 'Synthetic wellness option',
      type: 'MEMBERSHIP',
      priceCents: 4900,
      currency: 'USD',
      quantity: 1,
      rationale: 'Staff-approved explanation only.',
      evidence: ['PRIVATE_EVIDENCE'],
      terms: 'Monthly, cancel at any time.',
    };
    const consultation = await db.consultation.create({
      data: {
        tenantId,
        locationId: location.id,
        providerId: userId,
        configurationVersionId: version.id,
        reference: `Synthetic-${randomUUID()}`,
        idempotencyKey: prefix,
        isTest: true,
        stage: 'WELLNESS_RECOMMENDATIONS_PRODUCED',
        wellnessRevision: 1,
        wellnessApprovedVersion: 1,
        wellnessApprovedAt: new Date(),
        wellnessApprovedById: userId,
        summaryRevision: 1,
        careRevision: 1,
        wellnessSummaryRevision: 1,
        wellnessCareRevision: 1,
        wellnessPlan: {
          configurationVersionId: version.id,
          engineVersion: 'dripwell-rules-v2.1',
          visitSummary: 'We discussed your goals.',
          explanation: 'Consider this option with your provider.',
          careReceived: {
            outcome: 'STARTED',
            items: [],
            observations: 'PRIVATE_INTERNAL_OBSERVATIONS',
            reason: '',
            currency: 'USD',
          },
          offers: [item],
          safetyFlags: ['PRIVATE_SAFETY_FLAG'],
        },
      },
    });
    consultationId = consultation.id;
    const takeaway = await approvedTakeaway(tenantId, consultationId, userId);
    const share = await db.shareLink.create({
      data: {
        tenantId,
        takeawayId: takeaway.id,
        tokenHash: digest(linkToken),
        recipientEmail: 'synthetic-recipient@example.test',
        createdById: userId,
        expiresAt: new Date(Date.now() + 3600000),
      },
    });
    shareId = share.id;
  });
  afterAll(async () => {
    await getDb().tenant.delete({ where: { id: tenantId } });
    cookieValues.clear();
    await getDb().$disconnect();
  });
  test('freezes exact official prices and terms, with no internal notes or evidence', async () => {
    const snapshot = await approvedTakeaway(tenantId, consultationId, userId);
    const document = readTakeaway(snapshot);
    expect(document.offers[0].priceCents).toBe(4900);
    expect(document.offers[0].terms).toBe('Monthly, cancel at any time.');
    expect(JSON.stringify(snapshot.payload)).not.toContain('PRIVATE_');
    expect(await getDb().takeaway.count({ where: { consultationId } })).toBe(1);
  });
  test('refuses another tenant and forwarded links without the recipient session', async () => {
    await expect(approvedTakeaway(randomUUID(), consultationId, userId)).rejects.toMatchObject({
      status: 404,
    });
    await expect(sharedDocument(linkToken)).rejects.toMatchObject({ status: 401 });
    await expect(validShare('not-a-real-token')).rejects.toMatchObject({ status: 404 });
  });
  test('opens only with the hashed session bound to this share', async () => {
    await getDb().shareSession.create({
      data: {
        shareLinkId: shareId,
        tokenHash: digest(sessionToken),
        expiresAt: new Date(Date.now() + 3600000),
      },
    });
    cookieValues.set(`dw-share-session-${shareId}`, sessionToken);
    expect((await sharedDocument(linkToken)).clinic.name).toBe('Clínica Élan');
    cookieValues.set(`dw-share-session-${shareId}`, randomBytes(32).toString('base64url'));
    await expect(sharedDocument(linkToken)).rejects.toMatchObject({ status: 401 });
    cookieValues.set(`dw-share-session-${shareId}`, sessionToken);
  });
  test('rejects an expired share and a plan changed after approval', async () => {
    await getDb().shareLink.update({
      where: { id: shareId },
      data: { expiresAt: new Date(Date.now() - 1) },
    });
    await expect(sharedDocument(linkToken)).rejects.toMatchObject({ status: 410 });
    await getDb().shareLink.update({
      where: { id: shareId },
      data: { expiresAt: new Date(Date.now() + 3600000) },
    });
    await getDb().consultation.update({
      where: { id: consultationId },
      data: { wellnessRevision: 2 },
    });
    await expect(sharedDocument(linkToken)).rejects.toMatchObject({ status: 410 });
    await expect(approvedTakeaway(tenantId, consultationId, userId)).rejects.toMatchObject({
      status: 409,
    });
    await getDb().consultation.update({
      where: { id: consultationId },
      data: { wellnessRevision: 1 },
    });
    await getDb().consultation.update({
      where: { id: consultationId },
      data: { summaryRevision: 2 },
    });
    await expect(sharedDocument(linkToken)).rejects.toMatchObject({ status: 410 });
    await getDb().consultation.update({
      where: { id: consultationId },
      data: { summaryRevision: 1 },
    });
  });
  test('pending new recording evidence blocks old downloads and shares throughout upload retries', async () => {
    process.env.APP_URL = 'https://dripwell.example.test';
    process.env.RESEND_API_KEY = 're_disposable_verification_not_used';
    process.env.EMAIL_FROM = 'verification@example.test';
    const db = getDb();
    const recordingId = randomUUID();
    const data = {
      id: recordingId, tenantId, consultationId, userId, segmentKey: `pending-${prefix}`, sequence: 0,
      blobPath: `synthetic/${recordingId}`, mimeType: 'audio/webm', bytes: 100,
      consentAt: new Date(), status: 'UPLOADING', expiresAt: new Date(Date.now() + 86400000),
    };
    // Keep the earlier approval pointers intact to exercise the independent
    // read guard even if the write-side invalidation were accidentally omitted.
    await db.recordingSegment.create({ data });
    try {
      for (let retry = 0; retry < 2; retry++) {
        await db.recordingSegment.upsert({ where: { id: recordingId }, create: data, update: { status: 'UPLOADING' } });
        await expect(approvedTakeaway(tenantId, consultationId, userId)).rejects.toMatchObject({ status: 409, code: 'EVIDENCE_PROCESSING' });
        await expect(createShare(tenantId, userId, { consultationId, recipientEmail: 'synthetic-recipient@example.test' })).rejects.toMatchObject({ status: 409, code: 'EVIDENCE_PROCESSING' });
        await expect(sharedDocument(linkToken)).rejects.toMatchObject({ status: 410, code: 'EVIDENCE_PROCESSING' });
      }
      expect(await db.recordingSegment.count({ where: { consultationId } })).toBe(1);
      expect(await db.takeaway.count({ where: { consultationId } })).toBe(1);
      await db.recordingSegment.update({ where: { id: recordingId }, data: { status: 'UPLOADED' } });
      await expect(sharedDocument(linkToken)).rejects.toMatchObject({ code: 'EVIDENCE_PROCESSING' });
    } finally { await db.recordingSegment.delete({ where: { id: recordingId } }); }
  });
  test('active summary processing blocks an earlier approved document after audio transcription', async () => {
    const db = getDb();
    const job = await db.generationJob.create({ data: {
      tenantId, consultationId, userId, kind: 'SUMMARY', status: 'PENDING',
      idempotencyKey: `pending-summary-${prefix}`, model: 'synthetic-model', promptVersion: 'synthetic-test',
    } });
    try {
      for (const status of ['PENDING', 'QUEUING', 'RUNNING']) {
        await db.generationJob.update({ where: { id: job.id }, data: { status } });
        await expect(approvedTakeaway(tenantId, consultationId, userId)).rejects.toMatchObject({ code: 'EVIDENCE_PROCESSING' });
        await expect(sharedDocument(linkToken)).rejects.toMatchObject({ code: 'EVIDENCE_PROCESSING' });
      }
    } finally { await db.generationJob.delete({ where: { id: job.id } }); }
  });
  test('renders Unicode and long approved prose across multiple PDF pages', async () => {
    const snapshot = await approvedTakeaway(tenantId, consultationId, userId);
    const document = readTakeaway(snapshot);
    document.visitSummary = 'Élan — wellness 🙂 中文. '.repeat(700);
    const bytes = await takeawayPdf(document);
    expect(Buffer.from(bytes.subarray(0, 5)).toString()).toBe('%PDF-');
    expect((await PDFDocument.load(bytes)).getPageCount()).toBeGreaterThan(1);
  });
  test('revocation immediately invalidates the recipient session', async () => {
    await revokeShare(tenantId, userId, shareId);
    await expect(sharedDocument(linkToken)).rejects.toMatchObject({ status: 410 });
    expect(
      (await getDb().shareSession.findUniqueOrThrow({ where: { tokenHash: digest(sessionToken) } }))
        .revokedAt,
    ).not.toBeNull();
  });
});
