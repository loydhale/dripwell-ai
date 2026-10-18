import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { ClinicActor } from './auth';
import { getDb } from './db';
import { ApiError } from './errors';
import { captureRecordingObject, recordingObjectPath } from './recording-deletion-intents';
import { prepareRecordingProcessing } from './recording-processing';
import { appendReceivedTranscript, applyGeneratedSummary, beginRecordingIntake, discardRecordingEvidence,
  getClinicDashboard, getConsultation, mutateClinicAction } from './clinic';
import { reconcileConsultationReminders } from '../workflows/reminders';
import { activateTrial, emptyConsultationSummary, type ClinicConfiguration, type ConsultationSummary } from '@dripwell/shared/v2';

const testUrl = process.env.TEST_DATABASE_URL;
if (testUrl) process.env.DATABASE_URL = testUrl;
const suite = testUrl ? describe : describe.skip;

const syntheticConfiguration: ClinicConfiguration = {
  schemaVersion: 2,
  clinic: { name: 'Synthetic clinic only', currency: 'USD', contact: '', brandColor: '#0d9488' },
  questions: [{ id: 'fixture-permitted', text: 'Synthetic eligibility confirmed?', why: 'Test fixture, not a clinical protocol.',
    type: 'BOOLEAN', options: [], required: true, safetyRelevant: true, activeWhen: [], priority: 1 }],
  products: [{ id: 'fixture-iv', name: 'Synthetic IV fixture', type: 'DRIP', description: 'Integration fixture only',
    priceCents: 10000, currency: 'USD', available: true, ingredients: [], goalTags: ['wellness'], compatibleWith: [],
    benefits: [], terms: '', clinical: true, priority: 1,
    rules: { validated: true, validationNote: 'Synthetic test only, never a deployed clinical protocol.',
      eligibility: [{ questionId: 'fixture-permitted', operator: 'EQ', value: true }], exclusions: [], rationale: 'Synthetic eligibility test.' } }],
  recommendationPolicy: { clinicalValidated: true, validatedBy: 'Synthetic test provider', validationNote: 'Test fixture only.', maxAddOns: 0, maxWellnessOffers: 0 },
  reminders: { careOutcomeHours: 1, wellnessDecisionHours: 1 },
  retention: { audioDays: 1, documentDays: 1, shareExpiryHours: 1 },
};
const reviewedSummary: ConsultationSummary = { ...emptyConsultationSummary(), goals: ['wellness'], staffReviewed: true,
  wellnessOffersAllowed: false, answers: { 'fixture-permitted': { value: true, status: 'CONFIRMED', source: 'STAFF', evidence: 'Synthetic fixture answer.' } } };

type Fixture = { owner: ClinicActor; staff: ClinicActor; locationId: string; configurationId: string };
const tenants: string[] = [];
async function fixture(): Promise<Fixture> {
  const db = getDb();
  const suffix = randomUUID();
  const tenant = await db.tenant.create({ data: { name: 'Integration fixture', slug: `fixture-${suffix}`, state: 'TEST', medicalDirector: 'Synthetic test provider' } });
  tenants.push(tenant.id);
  const location = await db.location.create({ data: { tenantId: tenant.id, name: 'Synthetic location' } });
  const user = await db.user.create({ data: { tenantId: tenant.id, email: `owner-${suffix}@example.test`, passwordHash: 'test-unusable-password-hash', firstName: 'Test', lastName: 'Owner', role: 'SUPER_USER', canApproveClinical: true, mfaEnabled: true } });
  const staff = await db.user.create({ data: { tenantId: tenant.id, email: `staff-${suffix}@example.test`, passwordHash: 'test-unusable-password-hash', firstName: 'Test', lastName: 'Staff', role: 'STAFF', canApproveClinical: false } });
  const ownerSession = await db.authSession.create({ data: { userId: user.id, tokenHash: randomUUID(), expiresAt: new Date(Date.now() + 3600000), mfaVerifiedAt: new Date() } });
  const staffSession = await db.authSession.create({ data: { userId: staff.id, tokenHash: randomUUID(), expiresAt: new Date(Date.now() + 3600000) } });
  const configuration = await db.clinicConfigurationVersion.create({ data: { tenantId: tenant.id, locationId: location.id,
    version: 1, status: 'ACTIVE', payload: JSON.parse(JSON.stringify(syntheticConfiguration)), source: 'Integration fixture only', userId: user.id,
    activatedAt: new Date(), activatedById: user.id, clinicalValidatedById: user.id } });
  await db.subscription.create({ data: { tenantId: tenant.id, ...activateTrial(new Date()) } });
  function actor(member: typeof user, session: typeof ownerSession): ClinicActor {
    return { id: member.id, userId: member.id, tenantId: tenant.id, tenant, locationId: location.id,
      email: member.email, firstName: member.firstName, lastName: member.lastName, role: member.role,
      canApproveClinical: member.canApproveClinical, mfaEnabled: member.mfaEnabled,
      mfaVerified: Boolean(session.mfaVerifiedAt), mfaVerifiedAt: session.mfaVerifiedAt, sessionId: session.id };
  }
  return { owner: actor(user, ownerSession), staff: actor(staff, staffSession), locationId: location.id, configurationId: configuration.id };
}

async function start(f: Fixture, key = randomUUID()) {
  const result = await mutateClinicAction(f.staff, { action: 'consultation.start', locationId: f.locationId, consent: false, idempotencyKey: key });
  assert.ok('consultation' in result);
  return result.consultation!;
}
async function mutate(f: Fixture, visitId: string, action: string, fields: Record<string, unknown> = {}, actor = f.owner) {
  const current = await getConsultation(actor, visitId);
  return mutateClinicAction(actor, { action, consultationId: visitId, expectedVersion: current.consultation.version, ...fields });
}
async function reviewedInitial(f: Fixture, id: string) {
  await mutate(f, id, 'consultation.summary.update', { summary: reviewedSummary, reason: 'STAFF_JUDGMENT' });
  await mutate(f, id, 'consultation.initial.generate');
  await mutate(f, id, 'consultation.initial.approve');
}
async function approvedWellness(f: Fixture, id: string) {
  await reviewedInitial(f, id);
  const current = await getConsultation(f.owner, id);
  await mutate(f, id, 'consultation.care.record', { actualCare: { outcome: 'STARTED', items: current.consultation.initialRecommendation!.items,
    observations: 'Synthetic test visit.', reason: '', currency: 'USD' } });
  await mutate(f, id, 'consultation.wellness.generate');
  await mutate(f, id, 'consultation.wellness.approve');
}

suite('clinic transactions against isolated PostgreSQL', { concurrency: false }, () => {
  let f: Fixture;
  const previousClientDataFlag = process.env.ALLOW_REAL_CLIENT_DATA;
  before(async () => { process.env.ALLOW_REAL_CLIENT_DATA = 'true'; f = await fixture(); });
  after(async () => {
    for (const tenantId of tenants) {
      await getDb().consultation.deleteMany({ where: { tenantId } });
      await getDb().improvementProposal.deleteMany({ where: { tenantId } });
      await getDb().clinicConfigurationVersion.deleteMany({ where: { tenantId } });
      await getDb().user.deleteMany({ where: { tenantId } });
      await getDb().location.deleteMany({ where: { tenantId } });
      await getDb().creditLedger.deleteMany({ where: { tenantId } });
      await getDb().tenant.delete({ where: { id: tenantId } });
    }
    await getDb().$disconnect();
    if (previousClientDataFlag === undefined) delete process.env.ALLOW_REAL_CLIENT_DATA;
    else process.env.ALLOW_REAL_CLIENT_DATA = previousClientDataFlag;
  });

  it('counts exactly ten of eleven concurrent starts and resumes at the exhausted limit without another unit', async () => {
    const keys = Array.from({ length: 11 }, () => randomUUID());
    const results = await Promise.allSettled(keys.map(key => start(f, key)));
    const successful = results.flatMap((result, index) => result.status === 'fulfilled' ? [{ visit: result.value, key: keys[index]! }] : []);
    const rejected = results.filter(result => result.status === 'rejected');
    assert.equal(successful.length, 10);
    assert.equal(rejected.length, 1);
    assert.ok(rejected[0]?.status === 'rejected' && rejected[0].reason instanceof ApiError && rejected[0].reason.status === 402);
    const subscription = await getDb().subscription.findUniqueOrThrow({ where: { tenantId: f.owner.tenantId } });
    assert.equal(subscription.trialUsed, 10);
    assert.equal(await getDb().trialUsage.count({ where: { tenantId: f.owner.tenantId } }), 10);
    const resumed = await start(f, successful[0]!.key);
    assert.equal(resumed.id, successful[0]!.visit.id);
    assert.equal((await getDb().subscription.findUniqueOrThrow({ where: { tenantId: f.owner.tenantId } })).trialUsed, 10);
  });

  it('rejects expired new starts while existing consultations remain editable', async () => {
    const other = await fixture();
    const visit = await start(other);
    await getDb().subscription.update({ where: { tenantId: other.owner.tenantId }, data: {
      trialActivatedAt: new Date(Date.now() - 15 * 86400000), trialEndsAt: new Date(Date.now() - 86400000) } });
    await assert.rejects(start(other), (error: unknown) => error instanceof ApiError && error.status === 402);
    await mutate(other, visit.id, 'consultation.summary.update', { summary: reviewedSummary, reason: 'STAFF_JUDGMENT' });
    assert.equal((await getConsultation(other.owner, visit.id)).consultation.summary.staffReviewed, true);
  });

  it('enforces provider approval and owner permissions server-side', async () => {
    const visit = await getDb().consultation.findFirstOrThrow({ where: { tenantId: f.owner.tenantId } });
    await mutate(f, visit.id, 'consultation.summary.update', { summary: reviewedSummary, reason: 'STAFF_JUDGMENT' });
    await mutate(f, visit.id, 'consultation.initial.generate');
    await assert.rejects(mutate(f, visit.id, 'consultation.initial.approve', {}, f.staff), (error: unknown) => error instanceof ApiError && error.status === 403);
    await assert.rejects(mutateClinicAction(f.staff, { action: 'config.saveDraft', locationId: f.locationId, configuration: syntheticConfiguration }), (error: unknown) => error instanceof ApiError && error.status === 403);
    await assert.rejects(mutateClinicAction(f.staff, { action: 'improvement.review', improvementId: randomUUID(), decision: 'APPROVED' }), (error: unknown) => error instanceof ApiError && error.status === 403);
    await mutate(f, visit.id, 'consultation.initial.approve');
  });

  it('prevents lost edits and invalidates exact approvals and issued shares after corrected input', async () => {
    const other = await fixture();
    const visit = await start(other);
    await approvedWellness(other, visit.id);
    await mutate(other, visit.id, 'consultation.outcome.record', { decision: 'ACCEPTED' });
    const current = (await getConsultation(other.owner, visit.id)).consultation;
    const takeaway = await getDb().takeaway.create({ data: { tenantId: other.owner.tenantId, consultationId: visit.id, wellnessRevision: current.wellnessRevision,
      payload: JSON.parse(JSON.stringify(current.wellnessPlan)), contentHash: 'fixture', createdById: other.owner.userId } });
    const share = await getDb().shareLink.create({ data: { tenantId: other.owner.tenantId, takeawayId: takeaway.id, tokenHash: randomUUID(),
      recipientEmail: 'fixture@example.test', createdById: other.owner.userId, expiresAt: new Date(Date.now() + 3600000) } });
    const session = await getDb().shareSession.create({ data: { shareLinkId: share.id, tokenHash: randomUUID(), expiresAt: new Date(Date.now() + 3600000) } });
    const changed = { ...current.summary, symptoms: ['Synthetic correction'] };
    await mutateClinicAction(other.owner, { action: 'consultation.summary.update', consultationId: visit.id, expectedVersion: current.version,
      summary: changed, reason: 'MISSING_INFORMATION' });
    await assert.rejects(mutateClinicAction(other.owner, { action: 'consultation.summary.update', consultationId: visit.id, expectedVersion: current.version,
      summary: current.summary, reason: 'STAFF_JUDGMENT' }), (error: unknown) => error instanceof ApiError && error.status === 409);
    const updated = (await getConsultation(other.owner, visit.id)).consultation;
    assert.equal(updated.clinicalApprovedVersion, null);
    assert.equal(updated.wellnessApprovedVersion, null);
    assert.equal(updated.stage, 'WELLNESS_RECOMMENDATIONS_ACCEPTED');
    assert.equal(updated.decisionNeedsReview, true);
    assert.equal(updated.wellnessDecisionRevision, null);
    assert.ok((await getDb().takeaway.findUniqueOrThrow({ where: { id: takeaway.id } })).revokedAt);
    assert.ok((await getDb().shareLink.findUniqueOrThrow({ where: { id: share.id } })).revokedAt);
    assert.ok((await getDb().shareSession.findUniqueOrThrow({ where: { id: session.id } })).revokedAt);
    await mutate(other, visit.id, 'consultation.initial.generate');
    await mutate(other, visit.id, 'consultation.initial.approve');
    await mutate(other, visit.id, 'consultation.wellness.generate');
    const regenerated = (await getConsultation(other.owner, visit.id)).consultation;
    assert.ok(regenerated.wellnessRevision > current.wellnessRevision);
    assert.equal(regenerated.stage, 'WELLNESS_RECOMMENDATIONS_ACCEPTED');
    await mutate(other, visit.id, 'consultation.wellness.approve');
    assert.equal((await getConsultation(other.owner, visit.id)).consultation.decisionNeedsReview, true);
    await mutate(other, visit.id, 'consultation.outcome.record', { decision: 'ACCEPTED' });
    assert.equal((await getConsultation(other.owner, visit.id)).consultation.decisionNeedsReview, false);
  });

  it('archives suppress reminders and restores the manual stage and pending decision', async () => {
    const other = await fixture();
    const visit = await start(other);
    await approvedWellness(other, visit.id);
    await mutate(other, visit.id, 'consultation.outcome.record', { decision: 'TBD' });
    await getDb().consultation.update({ where: { id: visit.id }, data: { wellnessDecisionDueAt: new Date(Date.now() - 1000) } });
    await reconcileConsultationReminders(visit.id);
    assert.equal(await getDb().notification.count({ where: { consultationId: visit.id, dismissedAt: null } }), 1);
    await mutate(other, visit.id, 'consultation.archive', { reasonNote: 'Synthetic archive fixture' });
    assert.equal(await getDb().notification.count({ where: { consultationId: visit.id, dismissedAt: null } }), 0);
    await mutate(other, visit.id, 'consultation.restore');
    assert.equal((await getConsultation(other.owner, visit.id)).consultation.stage, 'WELLNESS_RECOMMENDATION_TBD');
    assert.equal((await getConsultation(other.owner, visit.id)).consultation.wellnessDecision, 'TBD');
    assert.equal(await getDb().notification.count({ where: { consultationId: visit.id, dismissedAt: null } }), 1);
  });

  it('retires the old wellness reminder when staff records TBD with a new future due date', async () => {
    const other = await fixture();
    const db = getDb();
    const visit = await start(other);
    await approvedWellness(other, visit.id);
    const oldDueAt = new Date(Date.now() - 1000);
    await db.consultation.update({ where: { id: visit.id }, data: { wellnessDecisionDueAt: oldDueAt } });
    await reconcileConsultationReminders(visit.id);
    const oldReminder = await db.notification.findUniqueOrThrow({ where: {
      idempotencyKey: `reminder:${visit.id}:WELLNESS_DECISION_NEEDED:${oldDueAt.toISOString()}`,
    } });
    assert.equal(oldReminder.isRead, false);
    assert.equal(oldReminder.dismissedAt, null);
    const before = await db.consultation.findUniqueOrThrow({ where: { id: visit.id } });
    const reasonNote = 'Synthetic client is still considering the plan.';
    const submittedAt = new Date();
    const result = await mutateClinicAction(other.staff, { action: 'consultation.outcome.record',
      consultationId: visit.id, expectedVersion: before.version, decision: 'TBD', reasonNote });
    const returnedAt = new Date();
    assert.ok('consultation' in result);
    const returned = result.consultation!;
    const after = await db.consultation.findUniqueOrThrow({ where: { id: visit.id } });
    assert.ok(after.wellnessDecisionDueAt instanceof Date);
    const newDueAt = after.wellnessDecisionDueAt;
    assert.equal(returned.wellnessDecisionDueAt, newDueAt.toISOString());
    assert.ok(newDueAt > returnedAt);
    const delayMs = syntheticConfiguration.reminders.wellnessDecisionHours * 3600000;
    assert.ok(newDueAt.getTime() >= submittedAt.getTime() + delayMs);
    assert.ok(newDueAt.getTime() <= returnedAt.getTime() + delayMs);
    assert.equal(returned.version, before.version + 1);
    assert.equal(returned.stage, 'WELLNESS_RECOMMENDATION_TBD');
    assert.equal(returned.wellnessDecision, 'TBD');
    assert.equal(returned.wellnessDecisionRevision, before.wellnessRevision);
    assert.deepEqual(after, { ...before, version: before.version + 1, stage: 'WELLNESS_RECOMMENDATION_TBD',
      wellnessDecision: 'TBD', wellnessDecisionRevision: before.wellnessRevision, completedAt: null,
      wellnessDecisionDueAt: newDueAt, updatedAt: after.updatedAt });
    const events = await db.consultationEvent.findMany({ where: { tenantId: other.staff.tenantId,
      consultationId: visit.id, action: 'consultation.outcome.record' } });
    assert.equal(events.length, 1);
    assert.equal(events[0]!.userId, other.staff.userId);
    assert.equal(events[0]!.artifactRevision, before.wellnessRevision);
    assert.equal(events[0]!.reason, reasonNote);
    assert.ok(events[0]!.createdAt instanceof Date);
    assert.deepEqual(events[0]!.before, { stage: before.stage, decision: before.wellnessDecision,
      revision: before.wellnessDecisionRevision });
    assert.deepEqual(events[0]!.after, { stage: 'WELLNESS_RECOMMENDATION_TBD', decision: 'TBD',
      revision: before.wellnessRevision });
    const retired = await db.notification.findUniqueOrThrow({ where: { id: oldReminder.id } });
    assert.ok(retired.dismissedAt instanceof Date);
    assert.deepEqual(retired, { ...oldReminder, dismissedAt: retired.dismissedAt });
    const scope = { tenantId: other.staff.tenantId, consultationId: visit.id,
      type: 'WELLNESS_DECISION_NEEDED' as const, dismissedAt: null };
    assert.equal(await db.notification.count({ where: scope }), 0);
    const dashboard = await getClinicDashboard(other.staff);
    const notifications = dashboard.notifications as { id: string }[];
    assert.ok(!notifications.some(notification => notification.id === oldReminder.id));
    assert.deepEqual(await reconcileConsultationReminders(visit.id), { nextDueAt: newDueAt.toISOString() });
    assert.equal(await db.notification.count({ where: scope }), 0);
    assert.deepEqual(await db.notification.findUniqueOrThrow({ where: { id: oldReminder.id } }), retired);
    assert.deepEqual(await db.consultation.findUniqueOrThrow({ where: { id: visit.id } }), after);
  });

  it('deduplicates superseded and legacy wellness schedules without changing current read state or unrelated rows', async () => {
    const other = await fixture();
    const foreign = await fixture();
    const db = getDb();
    const visit = await start(other);
    await approvedWellness(other, visit.id);
    await mutate(other, visit.id, 'consultation.outcome.record', { decision: 'TBD' }, other.staff);
    const dueAt = new Date(Date.now() - 1000);
    await db.consultation.update({ where: { id: visit.id }, data: { wellnessDecisionDueAt: dueAt } });
    await reconcileConsultationReminders(visit.id);
    const currentKey = `reminder:${visit.id}:WELLNESS_DECISION_NEEDED:${dueAt.toISOString()}`;
    const unread = await db.notification.findUniqueOrThrow({ where: { idempotencyKey: currentKey } });
    assert.equal(unread.isRead, false);
    const read = await mutateClinicAction(other.staff, { action: 'notification.read', notificationId: unread.id });
    assert.equal(read.ok, true);
    const current = await db.notification.findUniqueOrThrow({ where: { id: unread.id } });
    assert.deepEqual(current, { ...unread, isRead: true });
    const oldDueAt = new Date(dueAt.getTime() - 3600000);
    const dismissedDueAt = new Date(oldDueAt.getTime() - 3600000);
    const reminderFields = { tenantId: other.staff.tenantId, consultationId: visit.id, entityId: visit.id,
      userId: other.staff.userId, type: 'WELLNESS_DECISION_NEEDED' as const,
      title: current.title, message: current.message, dueAt: oldDueAt };
    const old = await db.notification.create({ data: { ...reminderFields, isRead: false, dismissedAt: null,
      idempotencyKey: `reminder:${visit.id}:WELLNESS_DECISION_NEEDED:${oldDueAt.toISOString()}` } });
    const legacy = await db.notification.create({ data: { ...reminderFields, isRead: true,
      idempotencyKey: null, dismissedAt: null } });
    const dismissed = await db.notification.create({ data: { ...reminderFields, isRead: true,
      dueAt: dismissedDueAt, dismissedAt: new Date(dismissedDueAt.getTime() + 1000),
      idempotencyKey: `reminder:${visit.id}:WELLNESS_DECISION_NEEDED:${dismissedDueAt.toISOString()}` } });
    const anotherVisit = await start(other);
    await approvedWellness(other, anotherVisit.id);
    await db.consultation.update({ where: { id: anotherVisit.id }, data: { wellnessDecisionDueAt: oldDueAt } });
    await reconcileConsultationReminders(anotherVisit.id);
    const sameTenantControl = await db.notification.findUniqueOrThrow({ where: {
      idempotencyKey: `reminder:${anotherVisit.id}:WELLNESS_DECISION_NEEDED:${oldDueAt.toISOString()}`,
    } });
    const foreignVisit = await start(foreign);
    await approvedWellness(foreign, foreignVisit.id);
    await db.consultation.update({ where: { id: foreignVisit.id }, data: { wellnessDecisionDueAt: oldDueAt } });
    await reconcileConsultationReminders(foreignVisit.id);
    const foreignControl = await db.notification.findUniqueOrThrow({ where: {
      idempotencyKey: `reminder:${foreignVisit.id}:WELLNESS_DECISION_NEEDED:${oldDueAt.toISOString()}`,
    } });
    const stockControl = await db.notification.create({ data: { tenantId: other.staff.tenantId,
      consultationId: visit.id, entityId: visit.id, userId: other.staff.userId, type: 'LOW_STOCK',
      title: 'Synthetic stock notice', message: 'Unrelated notification control.', isRead: false,
      idempotencyKey: `synthetic-stock:${randomUUID()}`, dueAt: oldDueAt, dismissedAt: null } });
    const visitBefore = await db.consultation.findUniqueOrThrow({ where: { id: visit.id } });
    const retiredAt = new Map<string, Date>();
    for (let pass = 0; pass < 2; pass++) {
      assert.deepEqual(await reconcileConsultationReminders(visit.id), { nextDueAt: null });
      const active = await db.notification.findMany({ where: { tenantId: other.staff.tenantId,
        consultationId: visit.id, type: 'WELLNESS_DECISION_NEEDED', dismissedAt: null } });
      assert.deepEqual(active, [current]);
      for (const original of [old, legacy]) {
        const retired = await db.notification.findUniqueOrThrow({ where: { id: original.id } });
        assert.ok(retired.dismissedAt instanceof Date);
        assert.deepEqual(retired, { ...original, dismissedAt: retired.dismissedAt });
        const firstDismissal = retiredAt.get(original.id);
        if (firstDismissal) assert.deepEqual(retired.dismissedAt, firstDismissal);
        else retiredAt.set(original.id, retired.dismissedAt);
      }
      for (const control of [dismissed, sameTenantControl, foreignControl, stockControl]) {
        assert.deepEqual(await db.notification.findUniqueOrThrow({ where: { id: control.id } }), control);
      }
      assert.deepEqual(await db.consultation.findUniqueOrThrow({ where: { id: visit.id } }), visitBefore);
      const dashboard = await getClinicDashboard(other.staff);
      const notifications = dashboard.notifications as { id: string; consultationId: string | null; type: string }[];
      assert.deepEqual(notifications.filter(notification => notification.consultationId === visit.id &&
        notification.type === 'WELLNESS_DECISION_NEEDED').map(notification => notification.id), [current.id]);
    }
  });

  it('searches and paginates every retained archive record beyond 250 without changing reporting totals', async () => {
    const archive = await fixture();
    const db = getDb();
    const recentAt = new Date(Date.now() - 86400000);
    const oldAt = new Date(Date.now() - 500 * 86400000);
    const oldestId = randomUUID();
    const rows = Array.from({ length: 251 }, (_, index) => ({
      id: index === 0 ? oldestId : randomUUID(), tenantId: archive.owner.tenantId,
      locationId: archive.locationId, providerId: index === 0 ? archive.owner.userId : archive.staff.userId,
      configurationVersionId: archive.configurationId,
      reference: index === 0 ? 'ARCHIVE-NEEDLE-500-DAYS' : `ARCHIVE-RECENT-${index}`,
      idempotencyKey: randomUUID(), summary: JSON.parse(JSON.stringify(emptyConsultationSummary())),
      archivedAt: new Date(), archiveReason: 'Synthetic retained fixture',
      stage: 'WELLNESS_RECOMMENDATION_TBD' as const,
      createdAt: index === 0 ? oldAt : recentAt, updatedAt: index === 0 ? oldAt : recentAt,
    }));
    await db.consultation.createMany({ data: rows });
    const period = { from: new Date(Date.now() - 7 * 86400000).toISOString(), to: new Date().toISOString() };
    const first = await getClinicDashboard(archive.staff, { archived: true, ...period });
    assert.equal(first.consultationCount, 251);
    assert.equal(first.consultations.length, 50);
    assert.equal(first.metrics.denominator, 250);
    assert.equal(first.metrics.carePending, 250);
    const expectedIds = [...rows].sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime()
      || right.id.localeCompare(left.id)).map(row => row.id);
    const foundIds = first.consultations.map(item => item.id);
    let cursor = first.consultationPagination.nextCursor;
    while (cursor) {
      const page = await getClinicDashboard(archive.staff, { archived: true, cursor, ...period });
      assert.ok(page.consultations.length <= 50);
      assert.equal(page.metrics.denominator, 250);
      assert.equal(page.consultationCount, 251);
      foundIds.push(...page.consultations.map(item => item.id));
      cursor = page.consultationPagination.nextCursor;
    }
    assert.deepEqual(foundIds, expectedIds);
    assert.equal(new Set(foundIds).size, 251);
    const search = await getClinicDashboard(archive.staff, { archived: true, search: 'needle-500', ...period });
    assert.deepEqual(search.consultations.map(item => item.id), [oldestId]);
    assert.equal(search.consultationCount, 1);
    assert.equal(search.consultationPagination.nextCursor, null);
    assert.equal(search.metrics.denominator, 250);
    const staffSearch = await getClinicDashboard(archive.staff, { archived: true, search: 'test owner', ...period });
    assert.deepEqual(staffSearch.consultations.map(item => item.id), [oldestId]);
    const found = await getConsultation(archive.staff, search.consultations[0]!.id);
    await mutateClinicAction(archive.staff, { action: 'consultation.restore', consultationId: found.consultation.id,
      expectedVersion: found.consultation.version });
    const restored = (await getConsultation(archive.staff, oldestId)).consultation;
    assert.equal(restored.archivedAt, null);
    assert.equal(restored.stage, 'WELLNESS_RECOMMENDATION_TBD');
    const restoreEvent = await db.consultationEvent.findFirstOrThrow({ where: {
      tenantId: archive.owner.tenantId, consultationId: oldestId, action: 'consultation.restore' } });
    assert.equal(restoreEvent.userId, archive.staff.userId);
    assert.deepEqual(restoreEvent.after, { archivedAt: null, stage: 'WELLNESS_RECOMMENDATION_TBD' });
    const afterRestore = await getClinicDashboard(archive.staff, { archived: true, search: 'needle-500', ...period });
    assert.equal(afterRestore.consultationCount, 0);
    assert.equal(afterRestore.metrics.denominator, 250);
  });

  it('validates archive paging input and rejects cursors outside the current tenant, location or filter', async () => {
    const archive = await fixture();
    const foreign = await fixture();
    const localVisit = await start(archive);
    const foreignVisit = await start(foreign);
    await mutate(archive, localVisit.id, 'consultation.archive', { reasonNote: 'Synthetic scoped archive' });
    await mutate(foreign, foreignVisit.id, 'consultation.archive', { reasonNote: 'Synthetic foreign archive' });
    const db = getDb();
    const anotherLocation = await db.location.create({ data: { tenantId: archive.owner.tenantId, name: 'Second synthetic location' } });
    const anotherConfig = await db.clinicConfigurationVersion.create({ data: {
      tenantId: archive.owner.tenantId, locationId: anotherLocation.id, version: 1, status: 'ACTIVE',
      payload: JSON.parse(JSON.stringify(syntheticConfiguration)), userId: archive.owner.userId, source: 'Scope fixture only' } });
    const anotherVisit = await db.consultation.create({ data: {
      tenantId: archive.owner.tenantId, locationId: anotherLocation.id, providerId: archive.owner.userId,
      configurationVersionId: anotherConfig.id, reference: 'FOREIGN-LOCATION-ARCHIVE', idempotencyKey: randomUUID(),
      summary: JSON.parse(JSON.stringify(emptyConsultationSummary())), archivedAt: new Date() } });
    for (const cursor of [foreignVisit.id, anotherVisit.id, randomUUID()]) {
      await assert.rejects(getClinicDashboard(archive.staff, { archived: true, cursor }),
        (error: unknown) => error instanceof ApiError && error.code === 'INVALID_CURSOR');
    }
    await assert.rejects(getClinicDashboard(archive.staff, { archived: true, cursor: localVisit.id, search: 'no-matching-reference' }),
      (error: unknown) => error instanceof ApiError && error.code === 'INVALID_CURSOR');
    await assert.rejects(getClinicDashboard(archive.staff, { archived: true, locationId: foreign.locationId }),
      (error: unknown) => error instanceof ApiError && error.status === 404);
    const foreignSearch = await getClinicDashboard(archive.staff, { archived: true, search: foreignVisit.reference });
    assert.equal(foreignSearch.consultations.length, 0);
    assert.equal(foreignSearch.consultationCount, 0);
    const explicitLocation = await getClinicDashboard(archive.staff, { archived: true, locationId: anotherLocation.id });
    assert.deepEqual(explicitLocation.consultations.map(item => item.id), [anotherVisit.id]);
    for (const options of [{ pageSize: 0 }, { pageSize: 101 }, { pageSize: 1.5 }, { search: 'x'.repeat(101) }, { cursor: 'invalid' }]) {
      await assert.rejects(getClinicDashboard(archive.staff, { archived: true, ...options }));
    }
    await assert.rejects(getClinicDashboard(archive.staff, { archived: true,
      from: new Date(Date.now() - 500 * 86400000).toISOString(), to: new Date().toISOString() }),
      (error: unknown) => error instanceof ApiError && error.code === 'INVALID_DATE_RANGE');
  });

  it('rejects guessed cross-tenant visit, configuration, location and notification IDs', async () => {
    const other = await fixture();
    const visit = await getDb().consultation.findFirstOrThrow({ where: { tenantId: f.owner.tenantId } });
    await assert.rejects(getConsultation(other.owner, visit.id), (error: unknown) => error instanceof ApiError && error.status === 404);
    await assert.rejects(mutateClinicAction(other.owner, { action: 'consultation.archive', consultationId: visit.id, expectedVersion: visit.version, reasonNote: 'forbidden' }), (error: unknown) => error instanceof ApiError && error.status === 404);
    await assert.rejects(mutateClinicAction(other.owner, { action: 'config.rollback', configurationVersionId: f.configurationId }), (error: unknown) => error instanceof ApiError && error.status === 404);
    await assert.rejects(mutateClinicAction(other.owner, { action: 'consultation.start', locationId: f.locationId, consent: false, idempotencyKey: randomUUID() }), (error: unknown) => error instanceof ApiError && error.status === 404);
    const notification = await getDb().notification.create({ data: { tenantId: f.owner.tenantId, userId: f.staff.userId, type: 'CARE_OUTCOME_NEEDED', title: 'Fixture', message: 'Fixture only' } });
    await assert.rejects(mutateClinicAction(other.owner, { action: 'notification.read', notificationId: notification.id }), (error: unknown) => error instanceof ApiError && error.status === 404);
  });

  it('requires a reviewed synthetic test and owner MFA before publishing immutable configuration', async () => {
    const other = await fixture();
    const draftResult = await mutateClinicAction(other.owner, { action: 'config.saveDraft', locationId: other.locationId, configuration: syntheticConfiguration });
    const draft = draftResult.result as { id: string; revision: number };
    await assert.rejects(mutateClinicAction(other.owner, { action: 'config.activate', configurationVersionId: draft.id, expectedVersion: draft.revision, approvedTestIds: [randomUUID()] }),
      (error: unknown) => error instanceof ApiError && error.code === 'CONFIGURATION_TEST_REQUIRED');
    const testedResult = await mutateClinicAction(other.owner, { action: 'config.test', configurationVersionId: draft.id, expectedVersion: draft.revision, summary: reviewedSummary });
    const tested = testedResult.result as { configuration: { revision: number }; test: { id: string } };
    await getDb().authSession.update({ where: { id: other.owner.sessionId }, data: { mfaVerifiedAt: null } });
    await assert.rejects(mutateClinicAction(other.owner, { action: 'config.activate', configurationVersionId: draft.id,
      expectedVersion: tested.configuration.revision, approvedTestIds: [tested.test.id] }), (error: unknown) => error instanceof ApiError && error.code === 'MFA_REQUIRED');
    await getDb().authSession.update({ where: { id: other.owner.sessionId }, data: { mfaVerifiedAt: new Date() } });
    await mutateClinicAction(other.owner, { action: 'config.activate', configurationVersionId: draft.id, expectedVersion: tested.configuration.revision, approvedTestIds: [tested.test.id] });
    assert.equal(await getDb().clinicConfigurationVersion.count({ where: { tenantId: other.owner.tenantId, locationId: other.locationId, status: 'ACTIVE' } }), 1);
    await assert.rejects(mutateClinicAction(other.owner, { action: 'config.saveDraft', locationId: other.locationId,
      configurationVersionId: draft.id, expectedVersion: tested.configuration.revision + 1, configuration: syntheticConfiguration }),
      (error: unknown) => error instanceof ApiError && error.code === 'IMMUTABLE_CONFIGURATION');
    assert.equal((await getDb().subscription.findUniqueOrThrow({ where: { tenantId: other.owner.tenantId } })).trialUsed, 0);
  });

  it('deduplicates unchanged generation without invalidating approved plans or manual decisions', async () => {
    const other = await fixture();
    const visit = await start(other);
    await approvedWellness(other, visit.id);
    await mutate(other, visit.id, 'consultation.outcome.record', { decision: 'ACCEPTED' });
    const current = (await getConsultation(other.owner, visit.id)).consultation;
    await mutate(other, visit.id, 'consultation.initial.generate');
    await mutate(other, visit.id, 'consultation.wellness.generate');
    const repeated = (await getConsultation(other.owner, visit.id)).consultation;
    assert.equal(repeated.initialRevision, current.initialRevision);
    assert.equal(repeated.wellnessRevision, current.wellnessRevision);
    assert.equal(repeated.version, current.version);
    assert.equal(repeated.clinicalApprovedVersion, current.clinicalApprovedVersion);
    assert.equal(repeated.wellnessApprovedVersion, current.wellnessApprovedVersion);
    assert.equal(repeated.stage, 'WELLNESS_RECOMMENDATIONS_ACCEPTED');
    assert.equal(repeated.decisionNeedsReview, false);
    assert.equal((await getDb().subscription.findUniqueOrThrow({ where: { tenantId: other.owner.tenantId } })).trialUsed, 1);
  });

  it('new recording evidence invalidates approvals exactly once and stale AI proposals preserve staff corrections', async () => {
    const other = await fixture();
    const visit = await start(other);
    await reviewedInitial(other, visit.id);
    await mutate(other, visit.id, 'consultation.consent', { consent: true });
    const current = (await getConsultation(other.owner, visit.id)).consultation;
    const recordingId = randomUUID(); const uploadAttemptId = randomUUID(); const runId = `synthetic-${randomUUID()}`;
    const target = { tenantId: other.owner.tenantId, recordingId, consultationId: visit.id, setupConversationId: null, uploadAttemptId };
    const path = recordingObjectPath(target);
    const object = captureRecordingObject(target, { pathname: path, url: `https://syntheticstore.private.blob.vercel-storage.com/${path}`, etag: '"synthetic-clinic-evidence"' });
    const segment = await getDb().recordingSegment.create({ data: { id: recordingId, tenantId: other.owner.tenantId, consultationId: visit.id,
      userId: other.staff.userId, segmentKey: randomUUID(), sequence: 0, blobPath: path, blobObject: object, mimeType: 'audio/webm',
      bytes: 1, consentAt: new Date(), expiresAt: new Date(Date.now() + 3600000), transcript: 'Synthetic additional statement.', status: 'TRANSCRIBED' } });
    await getDb().generationJob.create({ data: { id: uploadAttemptId, tenantId: other.owner.tenantId, consultationId: visit.id,
      userId: other.staff.userId, kind: 'RECORDING_UPLOAD', status: 'COMPLETE', idempotencyKey: `upload:${uploadAttemptId}`, model: 'synthetic', promptVersion: 'test-only',
      result: { recordingId, blobPath: path, blobObject: object, state: 'ADOPTED', uploadSettled: true } } });
    const job = await getDb().generationJob.create({ data: { tenantId: other.owner.tenantId, consultationId: visit.id,
      userId: other.staff.userId, kind: 'TRANSCRIPTION', status: 'RUNNING', runId, idempotencyKey: randomUUID(), model: 'test-transcription-provider', promptVersion: 'test-only',
      result: { recordingId, recordingObject: object, expectedSummaryRevision: current.summaryRevision } } });
    const prepared = await prepareRecordingProcessing(job.id, runId); assert.ok(prepared);
    const appended = await appendReceivedTranscript({ tenantId: other.owner.tenantId, consultationId: visit.id, recordingId: segment.id, jobId: job.id, processing: prepared.snapshot });
    assert.equal(appended.summaryRevision, current.summaryRevision + 1);
    const updated = (await getConsultation(other.owner, visit.id)).consultation;
    assert.equal(updated.summary.staffReviewed, false);
    assert.equal(updated.clinicalApprovedVersion, null);
    const repeated = await appendReceivedTranscript({ tenantId: other.owner.tenantId, consultationId: visit.id, recordingId: segment.id, jobId: job.id, processing: prepared.snapshot });
    assert.equal(repeated.recordVersion, updated.version);
    await mutate(other, visit.id, 'consultation.summary.update', { summary: { ...reviewedSummary, symptoms: ['Staff corrected fixture'] }, reason: 'STAFF_JUDGMENT' });
    const child = await getDb().generationJob.create({ data: { tenantId: other.owner.tenantId, consultationId: visit.id,
      userId: other.staff.userId, kind: 'SUMMARY', status: 'RUNNING', runId, idempotencyKey: `summary:${job.id}`, model: 'test-summary-provider', promptVersion: 'test-only',
      result: { evidence: ['Preserved original generated evidence'], originalProviderOutput: 'Original fixture' } } });
    const proposed = await applyGeneratedSummary({ tenantId: other.owner.tenantId, consultationId: visit.id, jobId: child.id,
      processing: { ...prepared.snapshot, childJobId: child.id }, expectedSummaryRevision: current.summaryRevision, summary: { ...reviewedSummary, symptoms: ['Stale AI fixture'], answers: {
        'fixture-permitted': { value: true, status: 'UNCERTAIN', source: 'TRANSCRIPT', evidence: 'Conflicting synthetic extraction.' } } } });
    assert.equal(proposed.applied, false);
    const corrected = (await getConsultation(other.owner, visit.id)).consultation;
    assert.deepEqual(corrected.summary.symptoms, ['Staff corrected fixture']);
    const savedResult = (await getDb().generationJob.findUniqueOrThrow({ where: { id: child.id } })).result as {
      evidence: string[]; proposedSummary: ConsultationSummary;
    };
    assert.deepEqual(savedResult.evidence, ['Preserved original generated evidence']);
    assert.equal(savedResult.proposedSummary.answers['fixture-permitted']!.status, 'UNCERTAIN');
    await assert.rejects(mutate(other, visit.id, 'consultation.initial.approve'), (error: unknown) => error instanceof ApiError && error.code === 'EVIDENCE_PROCESSING');
  });

  it('accepting pending audio immediately invalidates old care and shares, retries once, and requires deliberate recovery', async () => {
    const other = await fixture();
    const visit = await start(other);
    await approvedWellness(other, visit.id);
    await mutate(other, visit.id, 'consultation.outcome.record', { decision: 'ACCEPTED' });
    await mutate(other, visit.id, 'consultation.consent', { consent: true });
    const current = (await getConsultation(other.owner, visit.id)).consultation;
    const takeaway = await getDb().takeaway.create({ data: { tenantId: other.owner.tenantId, consultationId: visit.id,
      wellnessRevision: current.wellnessRevision, payload: JSON.parse(JSON.stringify(current.wellnessPlan)), contentHash: randomUUID(), createdById: other.owner.userId } });
    const share = await getDb().shareLink.create({ data: { tenantId: other.owner.tenantId, takeawayId: takeaway.id,
      tokenHash: randomUUID(), recipientEmail: 'synthetic@example.test', createdById: other.owner.userId, expiresAt: new Date(Date.now() + 3600000) } });
    const shareSession = await getDb().shareSession.create({ data: { shareLinkId: share.id, tokenHash: randomUUID(), expiresAt: new Date(Date.now() + 3600000) } });
    const recordingId = randomUUID(); const uploadAttemptId = randomUUID(); const runId = `synthetic-${randomUUID()}`;
    const target = { tenantId: other.owner.tenantId, recordingId, consultationId: visit.id, setupConversationId: null, uploadAttemptId };
    const path = recordingObjectPath(target);
    const object = captureRecordingObject(target, { pathname: path, url: `https://syntheticstore.private.blob.vercel-storage.com/${path}`, etag: '"synthetic-clinic-cancel"' });
    const input = { actor: other.staff, consultationId: visit.id, recordingId, segmentKey: randomUUID(), sequence: 0,
      blobPath: path, mimeType: 'audio/webm', bytes: 1,
      expiresAt: new Date(Date.now() + 3600000) };
    const accepted = await beginRecordingIntake(input);
    const pending = (await getConsultation(other.owner, visit.id)).consultation;
    assert.equal(accepted.recording.status, 'UPLOADING');
    assert.equal(pending.version, current.version + 1);
    assert.equal(pending.summaryRevision, current.summaryRevision + 1);
    assert.equal(pending.summary.staffReviewed, false);
    assert.equal(pending.clinicalApprovedVersion, null);
    assert.equal(pending.wellnessApprovedVersion, null);
    assert.ok((await getDb().shareLink.findUniqueOrThrow({ where: { id: share.id } })).revokedAt);
    assert.ok((await getDb().shareSession.findUniqueOrThrow({ where: { id: shareSession.id } })).revokedAt);
    await assert.rejects(mutate(other, visit.id, 'consultation.care.record', { actualCare: current.actualCare, reason: 'STAFF_JUDGMENT' }),
      (error: unknown) => error instanceof ApiError && error.code === 'EVIDENCE_PROCESSING');
    await assert.rejects(beginRecordingIntake(input), (error: unknown) => error instanceof ApiError && error.code === 'UPLOAD_IN_PROGRESS');
    assert.equal((await getConsultation(other.owner, visit.id)).consultation.version, pending.version);
    await getDb().recordingSegment.update({ where: { id: recordingId }, data: { status: 'UPLOAD_FAILED' } });
    const retried = await beginRecordingIntake(input);
    assert.equal(retried.accepted, false);
    assert.equal(retried.expectedSummaryRevision, accepted.expectedSummaryRevision);
    assert.equal((await getConsultation(other.owner, visit.id)).consultation.version, pending.version);
    await getDb().recordingSegment.update({ where: { id: recordingId }, data: { status: 'UPLOADED', blobObject: object } });
    await getDb().generationJob.create({ data: { id: uploadAttemptId, tenantId: other.owner.tenantId, consultationId: visit.id,
      userId: other.staff.userId, kind: 'RECORDING_UPLOAD', status: 'COMPLETE', idempotencyKey: `upload:${uploadAttemptId}`, model: 'synthetic', promptVersion: 'test-only',
      result: { recordingId, blobPath: path, blobObject: object, state: 'ADOPTED', uploadSettled: true } } });
    const parent = await getDb().generationJob.create({ data: { tenantId: other.owner.tenantId, consultationId: visit.id,
      userId: other.staff.userId, kind: 'TRANSCRIPTION', status: 'PENDING', runId, idempotencyKey: `recording:${recordingId}`,
      model: 'test-provider', promptVersion: 'test-only', result: { recordingId, recordingObject: object, expectedSummaryRevision: accepted.expectedSummaryRevision } } });
    const child = await getDb().generationJob.create({ data: { tenantId: other.owner.tenantId, consultationId: visit.id,
      userId: other.staff.userId, kind: 'SUMMARY', status: 'RUNNING', runId, idempotencyKey: `summary:${parent.id}`,
      model: 'test-provider', promptVersion: 'test-only', result: { recordingId } } });
    const prepared = await prepareRecordingProcessing(parent.id, runId); assert.ok(prepared);
    const duplicate = await beginRecordingIntake(input);
    assert.equal(duplicate.accepted, false);
    assert.equal((await getConsultation(other.owner, visit.id)).consultation.version, pending.version);
    await discardRecordingEvidence({ actor: other.owner, recordingId, expectedVersion: pending.version,
      reason: 'MISSING_INFORMATION', reasonNote: 'Synthetic evidence discarded; manual facts must be reviewed.' });
    assert.equal((await getDb().recordingSegment.findUniqueOrThrow({ where: { id: recordingId } })).status, 'DISCARDED');
    assert.equal((await getDb().generationJob.findUniqueOrThrow({ where: { id: parent.id } })).status, 'CANCELLED');
    assert.equal((await getDb().generationJob.findUniqueOrThrow({ where: { id: child.id } })).status, 'CANCELLED');
    const discarded = (await getConsultation(other.owner, visit.id)).consultation;
    assert.equal(discarded.clinicalApprovedVersion, null);
    assert.equal(discarded.summary.staffReviewed, false);
    await assert.rejects(applyGeneratedSummary({ tenantId: other.owner.tenantId, consultationId: visit.id, jobId: child.id,
      summary: reviewedSummary, expectedSummaryRevision: accepted.expectedSummaryRevision,
      processing: { ...prepared.snapshot, childJobId: child.id } }), (error: unknown) => error instanceof ApiError && error.code === 'PROCESSING_JOB_REQUIRED');
    await mutate(other, visit.id, 'consultation.summary.update', { summary: reviewedSummary, reason: 'STAFF_JUDGMENT' });
    await mutate(other, visit.id, 'consultation.initial.generate');
    await mutate(other, visit.id, 'consultation.initial.approve');
    assert.ok((await getConsultation(other.owner, visit.id)).consultation.clinicalApprovedVersion);
  });

  it('reports kind-aware positive ledger credits per currency without combining denominations', async () => {
    const other = await fixture();
    const usd = await getDb().creditLedger.create({ data: { tenantId: other.owner.tenantId, kind: 'EARNED', amountCents: 9000,
      currency: 'USD', policyVersion: 1, sourceEventId: randomUUID() } });
    await getDb().creditLedger.createMany({ data: [
      { tenantId: other.owner.tenantId, kind: 'APPLIED', amountCents: 2000, currency: 'USD', policyVersion: 1, sourceEventId: `apply:${usd.id}` },
      { tenantId: other.owner.tenantId, kind: 'REVERSED', amountCents: 1000, currency: 'USD', policyVersion: 1, sourceEventId: randomUUID(), reversesId: usd.id },
      { tenantId: other.owner.tenantId, kind: 'EXPIRED', amountCents: 1000, currency: 'USD', policyVersion: 1, sourceEventId: `expire:${usd.id}` },
    ] });
    let dashboard = await getClinicDashboard(other.owner);
    assert.equal(dashboard.referral!.creditBalanceCents, 5000);
    assert.equal(dashboard.referral!.currency, 'USD');
    await getDb().creditLedger.create({ data: { tenantId: other.owner.tenantId, kind: 'EARNED', amountCents: 3000,
      currency: 'EUR', policyVersion: 1, sourceEventId: randomUUID() } });
    dashboard = await getClinicDashboard(other.owner);
    assert.equal(dashboard.referral!.creditBalanceCents, null);
    assert.equal(dashboard.referral!.currency, null);
    assert.equal(dashboard.referral!.balances.find(balance => balance.currency === 'USD')!.availableCents, 5000);
    assert.equal(dashboard.referral!.balances.find(balance => balance.currency === 'EUR')!.availableCents, 3000);
  });

  it('loads real owner and staff workspace snapshots with accurate current decisions and role boundaries', async () => {
    const other = await fixture();
    const visit = await start(other);
    await approvedWellness(other, visit.id);
    await mutate(other, visit.id, 'consultation.outcome.record', { decision: 'ACCEPTED' });
    let ownerView = await getClinicDashboard(other.owner);
    assert.equal(ownerView.clinic.id, other.owner.tenantId);
    assert.equal(ownerView.configuration.active!.id, other.configurationId);
    assert.equal(ownerView.consultations[0]!.id, visit.id);
    assert.equal(ownerView.metrics.denominator, 1);
    assert.equal(ownerView.metrics.careStarted, 1);
    assert.equal(ownerView.metrics.wellnessAccepted, 1);
    assert.ok(ownerView.referral);
    await mutate(other, visit.id, 'consultation.summary.update', { summary: { ...reviewedSummary, symptoms: ['Synthetic source correction'] }, reason: 'MISSING_INFORMATION' });
    await getDb().consultation.update({ where: { id: visit.id }, data: { wellnessDecisionDueAt: new Date(Date.now() - 1000) } });
    ownerView = await getClinicDashboard(other.owner);
    assert.equal(ownerView.metrics.wellnessAccepted, 0);
    assert.equal(ownerView.metrics.wellnessUndecided, 1);
    assert.equal(ownerView.metrics.overdue, 1);
    assert.equal(ownerView.consultations[0]!.stage, 'WELLNESS_RECOMMENDATIONS_ACCEPTED');
    assert.equal(ownerView.consultations[0]!.decisionNeedsReview, true);
    assert.ok(ownerView.adjustments.length);
    const staffView = await getClinicDashboard(other.staff);
    assert.equal(staffView.configuration.draft, null);
    assert.deepEqual(staffView.improvements, []);
    assert.deepEqual(staffView.adjustments, []);
    assert.equal(staffView.referral, null);
    assert.equal(staffView.consultations.length, 1);
  });

  it('disabled real-client processing rejects starts and audio intake while explicitly synthetic consultations remain available', async () => {
    const other = await fixture();
    const real = await start(other);
    await mutate(other, real.id, 'consultation.consent', { consent: true });
    process.env.ALLOW_REAL_CLIENT_DATA = 'false';
    try {
      await assert.rejects(start(other), (error: unknown) => error instanceof ApiError && error.code === 'REAL_CLIENT_DATA_DISABLED');
      await assert.rejects(mutate(other, real.id, 'consultation.summary.update', { summary: reviewedSummary, reason: 'STAFF_JUDGMENT' }),
        (error: unknown) => error instanceof ApiError && error.code === 'REAL_CLIENT_DATA_DISABLED');
      const recordingId = randomUUID();
      const input = { actor: other.owner, consultationId: real.id, recordingId, segmentKey: randomUUID(), sequence: 0,
        blobPath: `private/${other.owner.tenantId}/recordings/${real.id}/${recordingId}`, mimeType: 'audio/webm', bytes: 1,
        expiresAt: new Date(Date.now() + 3600000) };
      await assert.rejects(beginRecordingIntake(input), (error: unknown) => error instanceof ApiError && error.code === 'REAL_CLIENT_DATA_DISABLED');
      assert.equal(await getDb().recordingSegment.count({ where: { consultationId: real.id } }), 0);
      await mutate(other, real.id, 'consultation.archive', { reasonNote: 'Existing record remains archivable on a disabled deployment.' });
      assert.ok((await getConsultation(other.owner, real.id)).consultation.archivedAt);
      const synthetic = await getDb().consultation.create({ data: { tenantId: other.owner.tenantId, locationId: other.locationId,
        configurationVersionId: other.configurationId, providerId: other.owner.userId, reference: `SYNTHETIC-${randomUUID()}`,
        idempotencyKey: randomUUID(), isTest: true, consentAt: new Date(), summary: JSON.parse(JSON.stringify(emptyConsultationSummary())) } });
      await mutate(other, synthetic.id, 'consultation.summary.update', { summary: reviewedSummary, reason: 'STAFF_JUDGMENT' });
      const syntheticId = randomUUID();
      const accepted = await beginRecordingIntake({ ...input, consultationId: synthetic.id, recordingId: syntheticId,
        segmentKey: randomUUID(), blobPath: `private/${other.owner.tenantId}/recordings/${synthetic.id}/${syntheticId}` });
      assert.equal(accepted.recording.consultationId, synthetic.id);
      assert.equal((await getDb().consultation.findUniqueOrThrow({ where: { id: synthetic.id } })).isTest, true);
      assert.equal((await getDb().subscription.findUniqueOrThrow({ where: { tenantId: other.owner.tenantId } })).trialUsed, 1);
    } finally { process.env.ALLOW_REAL_CLIENT_DATA = 'true'; }
  });

  it('pins historical consultation artifacts through configuration replacement, rollback and regeneration', async () => {
    const other = await fixture();
    const summary: ConsultationSummary = { ...reviewedSummary, wellnessOffersAllowed: true };
    function catalog(label: string, treatmentPrice: number, membershipPrice: number): ClinicConfiguration {
      const treatment = syntheticConfiguration.products[0]!;
      return { ...syntheticConfiguration,
        products: [{ ...treatment, name: `Synthetic ${label} IV`, priceCents: treatmentPrice,
          terms: `Synthetic ${label} treatment terms.`,
          rules: { ...treatment.rules, rationale: `Synthetic ${label} treatment rationale.` } },
        { ...treatment, id: 'fixture-membership', name: `Synthetic ${label} membership`, type: 'MEMBERSHIP',
          description: 'Fictional offer for historical-version testing only.', clinical: false,
          priceCents: membershipPrice, benefits: [`Synthetic ${label} benefit`],
          terms: `Synthetic ${label} membership terms.`,
          rules: { validated: false, validationNote: '', eligibility: [], exclusions: [],
            rationale: `Synthetic ${label} membership rationale.` } }],
        recommendationPolicy: { ...syntheticConfiguration.recommendationPolicy, maxWellnessOffers: 1 } };
    }
    async function activate(configuration: ClinicConfiguration) {
      const draftResult = await mutateClinicAction(other.owner, { action: 'config.saveDraft', locationId: other.locationId,
        configuration, source: 'Synthetic historical visit pinning fixture only.' });
      const draft = draftResult.result as { id: string; revision: number };
      const testedResult = await mutateClinicAction(other.owner, { action: 'config.test', configurationVersionId: draft.id,
        expectedVersion: draft.revision, summary });
      const tested = testedResult.result as { configuration: { revision: number }; test: { id: string } };
      const activated = await mutateClinicAction(other.owner, { action: 'config.activate', configurationVersionId: draft.id,
        expectedVersion: tested.configuration.revision, approvedTestIds: [tested.test.id] });
      const active = activated.result as { id: string; version: number };
      assert.equal(active.id, draft.id);
      return active;
    }
    async function approvedArtifacts(id: string) {
      await mutate(other, id, 'consultation.summary.update', { summary, reason: 'STAFF_JUDGMENT' });
      await mutate(other, id, 'consultation.initial.generate');
      await mutate(other, id, 'consultation.initial.approve');
      await mutate(other, id, 'consultation.care.record', { actualCare: { outcome: 'NOT_STARTED', items: [],
        observations: 'Synthetic manual-intake visit only.', reason: 'Synthetic client declined care.', currency: 'USD' } });
      await mutate(other, id, 'consultation.wellness.generate');
      await mutate(other, id, 'consultation.wellness.approve');
    }
    async function persisted(id: string) {
      return getDb().consultation.findUniqueOrThrow({ where: { id }, include: {
        revisions: { orderBy: [{ kind: 'asc' }, { revision: 'asc' }] },
      } });
    }
    function assertFacts(visit: Awaited<ReturnType<typeof start>>, id: string, configuration: ClinicConfiguration) {
      assert.equal(visit.configurationVersionId, id);
      assert.deepEqual(visit.configuration, configuration);
      const initial = visit.initialRecommendation, wellness = visit.wellnessPlan;
      assert.ok(initial && wellness);
      assert.equal(initial.configurationVersionId, id);
      assert.equal(wellness.configurationVersionId, id);
      assert.equal(initial.engineVersion, 'dripwell-rules-v2.1');
      assert.equal(wellness.engineVersion, 'dripwell-rules-v2.2');
      assert.equal(initial.blocked, false);
      assert.equal(initial.items.length, 1);
      assert.equal(wellness.offers.length, 1);
      for (const [item, product] of [[initial.items[0]!, configuration.products[0]!],
        [wellness.offers[0]!, configuration.products[1]!]] as const) {
        assert.deepEqual({ productId: item.productId, name: item.name, type: item.type, priceCents: item.priceCents,
          currency: item.currency, quantity: item.quantity, terms: item.terms, rationale: item.rationale },
        { productId: product.id, name: product.name, type: product.type, priceCents: product.priceCents,
          currency: product.currency, quantity: 1, terms: product.terms, rationale: product.rules.rationale });
      }
      const offer = wellness.offers[0]!;
      assert.ok('benefits' in offer && 'matchedGoals' in offer);
      assert.deepEqual(offer.benefits, configuration.products[1]!.benefits);
      assert.deepEqual(offer.matchedGoals, summary.goals);
      assert.equal(visit.actualCare!.outcome, 'NOT_STARTED');
      assert.deepEqual(visit.actualCare!.items, []);
    }

    const catalogA = catalog('A', 11000, 7100), catalogB = catalog('B', 16000, 9200);
    const activeA = await activate(catalogA);
    assert.notEqual(activeA.id, other.configurationId);
    const visitA = await start(other);
    await approvedArtifacts(visitA.id);
    assertFacts((await getConsultation(other.owner, visitA.id)).consultation, activeA.id, catalogA);
    const savedA = await persisted(visitA.id);
    assert.equal(savedA.clinicalApprovedVersion, savedA.initialRevision);
    assert.equal(savedA.wellnessApprovedVersion, savedA.wellnessRevision);
    assert.equal(savedA.clinicalApprovedById, other.owner.userId);
    assert.equal(savedA.wellnessApprovedById, other.owner.userId);

    const activeB = await activate(catalogB);
    assert.notEqual(activeB.id, activeA.id);
    assert.equal(activeB.version, activeA.version + 1);
    assert.deepEqual(await persisted(visitA.id), savedA);
    assertFacts((await getConsultation(other.owner, visitA.id)).consultation, activeA.id, catalogA);
    const visitB = await start(other);
    await approvedArtifacts(visitB.id);
    assertFacts((await getConsultation(other.owner, visitB.id)).consultation, activeB.id, catalogB);
    const savedB = await persisted(visitB.id);
    assert.equal(savedB.clinicalApprovedVersion, savedB.initialRevision);
    assert.equal(savedB.wellnessApprovedVersion, savedB.wellnessRevision);

    const rollbackResult = await mutateClinicAction(other.owner, { action: 'config.rollback',
      configurationVersionId: activeA.id, locationId: other.locationId });
    const restored = rollbackResult.result as { id: string; version: number };
    assert.notEqual(restored.id, activeA.id);
    assert.notEqual(restored.id, activeB.id);
    assert.equal(restored.version, activeB.version + 1);
    const currentConfiguration = await getDb().clinicConfigurationVersion.findFirstOrThrow({ where: {
      tenantId: other.owner.tenantId, locationId: other.locationId, status: 'ACTIVE' } });
    assert.equal(currentConfiguration.id, restored.id);
    assert.deepEqual(currentConfiguration.payload, catalogA);

    for (const [saved, active, configuration] of [[savedA, activeA, catalogA], [savedB, activeB, catalogB]] as const) {
      assert.deepEqual(await persisted(saved.id), saved);
      assertFacts((await getConsultation(other.owner, saved.id)).consultation, active.id, configuration);
      // A later non-safety note invalidates approval, but cannot rebind this visit to today's active catalog.
      await mutate(other, saved.id, 'consultation.summary.update', { summary: { ...summary,
        preferences: ['Synthetic later communication preference.'] }, reason: 'STAFF_JUDGMENT' });
      await mutate(other, saved.id, 'consultation.initial.generate');
      await mutate(other, saved.id, 'consultation.wellness.generate');
      const regenerated = (await getConsultation(other.owner, saved.id)).consultation;
      assertFacts(regenerated, active.id, configuration);
      assert.equal(regenerated.summaryRevision, saved.summaryRevision + 1);
      assert.equal(regenerated.initialRevision, saved.initialRevision + 1);
      assert.equal(regenerated.wellnessRevision, saved.wellnessRevision + 1);
      assert.equal(regenerated.clinicalApprovedVersion, null);
      assert.equal(regenerated.wellnessApprovedVersion, null);
      const after = await persisted(saved.id);
      assert.deepEqual(after.revisions.filter(row => saved.revisions.some(original => original.id === row.id)), saved.revisions);
      for (const [kind, number, payload] of [['INITIAL', regenerated.initialRevision, regenerated.initialRecommendation],
        ['WELLNESS', regenerated.wellnessRevision, regenerated.wellnessPlan]] as const) {
        const revision = after.revisions.find(row => row.kind === kind && row.revision === number);
        assert.ok(revision);
        assert.deepEqual(revision.payload, payload);
        assert.equal(revision.model, 'deterministic-rules');
        assert.equal(revision.promptVersion, payload!.engineVersion);
      }
    }
  });

  it('preserves owner proposal evidence, review, saved evaluation and activation linkage', async () => {
    const other = await fixture();
    const db = getDb();
    const visit = await start(other);
    await mutate(other, visit.id, 'consultation.summary.update', { summary: reviewedSummary,
      reason: 'STAFF_JUDGMENT', reasonNote: 'Synthetic staff correction for owner proposal evidence.' }, other.staff);
    const adjustment = await db.consultationAdjustment.findFirstOrThrow({ where: {
      tenantId: other.owner.tenantId, consultationId: visit.id, kind: 'SUMMARY' } });
    const normalized = (value: unknown): unknown => JSON.parse(JSON.stringify(value));
    const expectedEvidence = normalized([{ ...adjustment, consultation: {
      configurationVersionId: other.configurationId, reference: visit.reference, summary: reviewedSummary,
      actualCare: null, wellnessDecision: null } }]);
    const originalActive = await db.clinicConfigurationVersion.findUniqueOrThrow({ where: { id: other.configurationId } });
    const proposedConfiguration: ClinicConfiguration = { ...syntheticConfiguration,
      clinic: { ...syntheticConfiguration.clinic, name: 'Synthetic proposal clinic only' } };
    const draft = (await mutateClinicAction(other.owner, { action: 'config.saveDraft', locationId: other.locationId,
      configuration: proposedConfiguration, source: 'Synthetic descriptive-only improvement fixture.' })).result as { id: string; revision: number };
    const created = (await mutateClinicAction(other.owner, { action: 'improvement.create',
      title: 'Review the synthetic staff correction', classification: 'APPROPRIATE_CORRECTION',
      evidenceAdjustmentIds: [adjustment.id], configurationVersionId: other.configurationId,
      notes: 'Synthetic evidence, not a live model or a clinical policy change.' })).result as { id: string };
    const snapshot = async () => {
      const [proposal, target, active] = await Promise.all([
        db.improvementProposal.findUniqueOrThrow({ where: { id: created.id } }),
        db.clinicConfigurationVersion.findUniqueOrThrow({ where: { id: draft.id } }),
        db.clinicConfigurationVersion.findUniqueOrThrow({ where: { id: other.configurationId } }),
      ]);
      return { proposal, target, active };
    };
    const proposed = await snapshot();
    assert.equal(proposed.proposal.tenantId, other.owner.tenantId);
    assert.equal(proposed.proposal.userId, other.owner.userId);
    assert.equal(proposed.proposal.configurationVersionId, other.configurationId);
    assert.equal(proposed.proposal.classification, 'APPROPRIATE_CORRECTION');
    assert.equal(proposed.proposal.status, 'PROPOSED');
    assert.deepEqual(proposed.proposal.evidence, expectedEvidence);
    assert.deepEqual(proposed.proposal.proposedPayload, originalActive.payload);
    assert.deepEqual(proposed.proposal.tests, []);
    assert.equal(proposed.proposal.reviewedById, null);
    assert.equal(proposed.proposal.activatedVersionId, null);
    const classified = await db.consultationAdjustment.findUniqueOrThrow({ where: { id: adjustment.id } });
    assert.equal(classified.ownerClassification, 'APPROPRIATE_CORRECTION');
    assert.equal(classified.ownerReviewedById, other.owner.userId);
    assert.ok(classified.ownerReviewedAt && Number.isFinite(classified.ownerReviewedAt.getTime()));
    assert.deepEqual({ ...classified, ownerClassification: adjustment.ownerClassification,
      ownerReviewedById: adjustment.ownerReviewedById, ownerReviewedAt: adjustment.ownerReviewedAt }, adjustment);
    assert.deepEqual(proposed.active, originalActive);

    await mutateClinicAction(other.owner, { action: 'improvement.review', improvementId: created.id,
      decision: 'REJECTED', notes: 'Synthetic owner rejection before evaluating the saved draft.' });
    const rejected = await snapshot();
    assert.equal(rejected.proposal.status, 'REJECTED');
    assert.equal(rejected.proposal.reviewedById, other.owner.userId);
    assert.ok(rejected.proposal.reviewedAt && Number.isFinite(rejected.proposal.reviewedAt.getTime()));
    for (const action of [
      { action: 'improvement.test', improvementId: created.id, configurationVersionId: draft.id,
        expectedVersion: draft.revision, summary: reviewedSummary, notes: 'Rejected proposals cannot save evaluations.' },
      { action: 'improvement.activate', improvementId: created.id, configurationVersionId: draft.id,
        expectedVersion: draft.revision, approvedTestIds: [randomUUID()] },
    ]) {
      await assert.rejects(mutateClinicAction(other.owner, action), (error: unknown) =>
        error instanceof ApiError && error.status === 409 && error.code === 'IMPROVEMENT_REJECTED');
      assert.deepEqual(await snapshot(), rejected);
    }
    await mutateClinicAction(other.owner, { action: 'improvement.review', improvementId: created.id,
      decision: 'APPROVED', notes: 'Synthetic owner approval for the descriptive-only draft evaluation.' });
    const approved = await snapshot();
    assert.equal(approved.proposal.status, 'APPROVED');
    assert.equal(approved.proposal.reviewedById, other.owner.userId);
    assert.ok(approved.proposal.reviewedAt && Number.isFinite(approved.proposal.reviewedAt.getTime()));
    assert.equal(approved.proposal.reviewNote, 'Synthetic owner approval for the descriptive-only draft evaluation.');
    const reviewHistory = (await db.auditLog.findMany({ where: { tenantId: other.owner.tenantId,
      entityType: 'ClinicConfigurationVersion', entityId: other.configurationId, action: 'SETTINGS_CHANGED' } })).flatMap(entry => {
      const details = entry.details as { action?: string; improvementId?: string; decision?: string } | null;
      return details?.action === 'IMPROVEMENT_REVIEWED' && details.improvementId === created.id
        ? [{ decision: details.decision, userId: entry.userId, createdAt: entry.createdAt }] : [];
    });
    assert.deepEqual(reviewHistory.map(entry => entry.decision).sort(), ['APPROVED', 'REJECTED']);
    assert.ok(reviewHistory.every(entry => entry.userId === other.owner.userId && Number.isFinite(entry.createdAt.getTime())));

    const tested = (await mutateClinicAction(other.owner, { action: 'improvement.test', improvementId: created.id,
      configurationVersionId: draft.id, expectedVersion: draft.revision, summary: reviewedSummary,
      notes: 'Synthetic deterministic evaluation, not model inference.' })).result as {
      configuration: { id: string; revision: number };
      test: { id: string; summary: ConsultationSummary; approvedByOwner: boolean; initial: {
        configurationVersionId: string; blocked: boolean; items: { productId: string; priceCents: number | null; currency: string }[] } };
    };
    assert.equal(tested.configuration.id, draft.id);
    assert.notEqual(tested.test.id, '');
    assert.deepEqual(tested.test.summary, reviewedSummary);
    assert.equal(tested.test.initial.configurationVersionId, draft.id);
    assert.equal(tested.test.initial.blocked, false);
    assert.deepEqual(tested.test.initial.items.map(item => ({ productId: item.productId, priceCents: item.priceCents, currency: item.currency })),
      [{ productId: 'fixture-iv', priceCents: 10000, currency: 'USD' }]);
    assert.equal(tested.test.approvedByOwner, false);
    const evaluated = await snapshot();
    assert.equal(evaluated.target.status, 'TESTED');
    assert.equal(evaluated.target.revision, tested.configuration.revision);
    assert.deepEqual(evaluated.target.payload, proposedConfiguration);
    assert.deepEqual(evaluated.target.tests, [normalized(tested.test)]);
    assert.equal(evaluated.proposal.status, 'APPROVED');
    assert.deepEqual(evaluated.proposal.proposedPayload, proposedConfiguration);
    assert.deepEqual(evaluated.proposal.tests, [normalized(tested.test)]);
    assert.deepEqual(evaluated.proposal.evidence, expectedEvidence);
    assert.deepEqual(evaluated.active, originalActive);

    const activated = (await mutateClinicAction(other.owner, { action: 'improvement.activate', improvementId: created.id,
      configurationVersionId: draft.id, expectedVersion: tested.configuration.revision,
      approvedTestIds: [tested.test.id] })).result as { id: string };
    assert.equal(activated.id, draft.id);
    const published = await snapshot();
    assert.equal(published.proposal.status, 'ACTIVATED');
    assert.equal(published.proposal.activatedVersionId, draft.id);
    assert.deepEqual(published.proposal.evidence, expectedEvidence);
    assert.deepEqual(published.proposal.proposedPayload, proposedConfiguration);
    assert.deepEqual(published.proposal.tests, [normalized(tested.test)]);
    assert.equal(published.proposal.reviewedById, approved.proposal.reviewedById);
    assert.deepEqual(published.proposal.reviewedAt, approved.proposal.reviewedAt);
    assert.equal(published.proposal.reviewNote, approved.proposal.reviewNote);
    assert.equal(published.target.status, 'ACTIVE');
    assert.equal(published.target.activatedById, other.owner.userId);
    assert.equal(published.target.clinicalValidatedById, other.owner.userId);
    assert.ok(published.target.activatedAt && Number.isFinite(published.target.activatedAt.getTime()));
    assert.deepEqual(published.target.payload, proposedConfiguration);
    assert.deepEqual(published.target.tests, [normalized({ ...tested.test, approvedByOwner: true })]);
    await assert.rejects(mutateClinicAction(other.owner, { action: 'improvement.review', improvementId: created.id,
      decision: 'REJECTED', notes: 'An activated proposal must preserve its finalized review.' }), (error: unknown) =>
      error instanceof ApiError && error.status === 409 && error.code === 'IMMUTABLE_IMPROVEMENT');
    assert.deepEqual(await snapshot(), published);
  });
});
