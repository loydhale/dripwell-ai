import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { ClinicActor } from './auth';
import { getDb } from './db';
import { ApiError } from './errors';
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
    const segment = await getDb().recordingSegment.create({ data: { tenantId: other.owner.tenantId, consultationId: visit.id,
      userId: other.staff.userId, segmentKey: randomUUID(), sequence: 0, blobPath: 'private/test-fixture-not-used', mimeType: 'audio/webm',
      bytes: 1, consentAt: new Date(), expiresAt: new Date(Date.now() + 3600000), transcript: 'Synthetic additional statement.', status: 'TRANSCRIBED' } });
    const job = await getDb().generationJob.create({ data: { tenantId: other.owner.tenantId, consultationId: visit.id,
      userId: other.staff.userId, kind: 'TRANSCRIPTION', status: 'RUNNING', idempotencyKey: randomUUID(), model: 'test-transcription-provider', promptVersion: 'test-only' } });
    const appended = await appendReceivedTranscript({ tenantId: other.owner.tenantId, consultationId: visit.id, recordingId: segment.id, jobId: job.id });
    assert.equal(appended.summaryRevision, current.summaryRevision + 1);
    const updated = (await getConsultation(other.owner, visit.id)).consultation;
    assert.equal(updated.summary.staffReviewed, false);
    assert.equal(updated.clinicalApprovedVersion, null);
    const repeated = await appendReceivedTranscript({ tenantId: other.owner.tenantId, consultationId: visit.id, recordingId: segment.id, jobId: job.id });
    assert.equal(repeated.recordVersion, updated.version);
    await mutate(other, visit.id, 'consultation.summary.update', { summary: { ...reviewedSummary, symptoms: ['Staff corrected fixture'] }, reason: 'STAFF_JUDGMENT' });
    const child = await getDb().generationJob.create({ data: { tenantId: other.owner.tenantId, consultationId: visit.id,
      userId: other.staff.userId, kind: 'SUMMARY', status: 'COMPLETE', idempotencyKey: randomUUID(), model: 'test-summary-provider', promptVersion: 'test-only',
      result: { evidence: ['Preserved original generated evidence'], originalProviderOutput: 'Original fixture' } } });
    const proposed = await applyGeneratedSummary({ tenantId: other.owner.tenantId, consultationId: visit.id, jobId: child.id,
      expectedSummaryRevision: current.summaryRevision, summary: { ...reviewedSummary, symptoms: ['Stale AI fixture'], answers: {
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
    const recordingId = randomUUID();
    const input = { actor: other.staff, consultationId: visit.id, recordingId, segmentKey: randomUUID(), sequence: 0,
      blobPath: `private/${other.owner.tenantId}/recordings/${visit.id}/${recordingId}`, mimeType: 'audio/webm', bytes: 1,
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
    await getDb().recordingSegment.update({ where: { id: recordingId }, data: { status: 'UPLOADED' } });
    const parent = await getDb().generationJob.create({ data: { tenantId: other.owner.tenantId, consultationId: visit.id,
      userId: other.staff.userId, kind: 'TRANSCRIPTION', status: 'PENDING', idempotencyKey: `recording:${recordingId}`,
      model: 'test-provider', promptVersion: 'test-only', result: { recordingId, expectedSummaryRevision: accepted.expectedSummaryRevision } } });
    const child = await getDb().generationJob.create({ data: { tenantId: other.owner.tenantId, consultationId: visit.id,
      userId: other.staff.userId, kind: 'SUMMARY', status: 'RUNNING', idempotencyKey: `summary:${parent.id}`,
      model: 'test-provider', promptVersion: 'test-only', result: { recordingId } } });
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
      summary: reviewedSummary, expectedSummaryRevision: accepted.expectedSummaryRevision }), (error: unknown) => error instanceof ApiError && error.code === 'PROCESSING_JOB_REQUIRED');
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
});
