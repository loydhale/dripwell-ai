import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { ClinicActor } from './auth';
import type { ClinicPayload } from '../components/clinic-context';

const boundary = vi.hoisted(() => ({ getDb: vi.fn(), payload: null as ClinicPayload | null }));
vi.mock('server-only', () => ({}));
vi.mock('./db', () => ({ getDb: boundary.getDb }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('../components/clinic-context', () => ({
  useClinic: () => ({ data: boundary.payload, locationId: '11111111-1111-4111-8111-111111111112',
    mutate: vi.fn(), refresh: vi.fn(), loadMore: vi.fn(), loading: false, pageError: '' }),
  isOwner: (role: string) => role === 'SUPER_USER',
  locationHref: (path: string) => path,
  stageLabels: {}, stageTones: {},
}));

import { getClinicDashboard } from './clinic';
import { membershipMetrics } from './membership-metrics';
import { MembershipOutcomes } from '../components/membership-outcomes';
import { Dashboard } from '../components/dashboard';
import { Owner } from '../components/owner';

const tenantId = '11111111-1111-4111-8111-111111111111';
const locationId = '11111111-1111-4111-8111-111111111112';
const secondLocationId = '11111111-1111-4111-8111-111111111113';
const foreignId = '22222222-2222-4222-8222-222222222222';
const from = '2026-09-01T00:00:00.000Z';
const to = '2026-10-01T00:00:00.000Z';
const actor = {
  id: '11111111-1111-4111-8111-111111111114', userId: '11111111-1111-4111-8111-111111111114',
  tenantId, locationId, sessionId: '11111111-1111-4111-8111-111111111115',
  email: 'membership-owner@example.invalid', firstName: 'Synthetic', lastName: 'Owner',
  role: 'SUPER_USER', canApproveClinical: false, mfaEnabled: false, mfaVerified: false,
  mfaVerifiedAt: null, tenant: { id: tenantId, name: 'Synthetic reporting clinic', slug: 'synthetic-reporting', isActive: true },
} as ClinicActor;

function care(membershipEnrolled: unknown) {
  return { outcome: 'STARTED', items: [], observations: '', reason: '', membershipEnrolled,
    membershipProductId: null, servicePurchased: null, confirmedCollectedCents: null, currency: 'USD' };
}
function row(actualCare: unknown, overrides: Record<string, unknown> = {}) {
  return { tenantId, locationId, isTest: false, createdAt: new Date(from), completedAt: null,
    archivedAt: null, actualCare, careOutcome: 'STARTED', wellnessDecision: null, ...overrides };
}
function mixed() {
  return [
    ...Array.from({ length: 5 }, () => row(care(true))),
    ...Array.from({ length: 5 }, () => row(care(false))),
    ...Array.from({ length: 10 }, () => row(null)),
  ];
}
type FixtureRow = ReturnType<typeof row>;
type Read = { where: { tenantId: string; locationId: string; isTest: boolean;
  createdAt: { gte: Date; lt: Date } }; select?: unknown; include?: unknown; take?: number };

// This transport mock tests the real query contract; it is not PostgreSQL execution evidence.
function dashboardTransport(rows: FixtureRow[], role = 'SUPER_USER') {
  const cohort = (query: Read) => rows.filter(item => item.tenantId === query.where.tenantId
    && item.locationId === query.where.locationId && item.isTest === query.where.isTest
    && item.createdAt >= query.where.createdAt.gte && item.createdAt < query.where.createdAt.lt);
  const tx = {
    user: { findUnique: vi.fn(async () => ({ ...actor, role, isActive: true })), findMany: vi.fn(async () => []) },
    authSession: { findFirst: vi.fn(async () => ({ mfaVerifiedAt: null })) },
    location: { findMany: vi.fn(async () => [
      { id: locationId, name: 'Synthetic main location' }, { id: secondLocationId, name: 'Synthetic second location' },
    ]) },
    clinicConfigurationVersion: { findMany: vi.fn(async () => []) },
    consultation: {
      fields: { wellnessRevision: 'wellnessRevision' },
      findFirst: vi.fn(async () => ({ id: actor.id, createdAt: new Date(from) })),
      findMany: vi.fn(async (query: Read) => {
        if (query.include) return []; // An empty board page must not erase complete-period metrics.
        expect(query.take).toBeUndefined();
        expect(query.where).toEqual({ tenantId, locationId: query.where.locationId, isTest: false,
          createdAt: { gte: new Date(from), lt: new Date(to) } });
        expect(query.select).toMatchObject({ actualCare: true });
        return cohort(query);
      }),
      count: vi.fn(async () => 0),
      groupBy: vi.fn(async (query: Read & { by: string[] }) => {
        const field = query.by[0];
        const values = new Map<unknown, number>();
        for (const item of cohort(query)) {
          const value = field === 'careOutcome' ? item.careOutcome : item.wellnessDecision;
          values.set(value, (values.get(value) ?? 0) + 1);
        }
        return [...values].map(([value, count]) => ({ [field]: value, _count: { _all: count } }));
      }),
    },
    notification: { findMany: vi.fn(async () => []) },
    consultationAdjustment: { count: vi.fn(async () => 0), findMany: vi.fn(async () => []) },
    subscription: { findUnique: vi.fn(async () => null) },
    improvementProposal: { findMany: vi.fn(async () => []) },
    tenant: { findUniqueOrThrow: vi.fn(async () => actor.tenant) },
    referral: { count: vi.fn(async () => 0) }, creditLedger: { findMany: vi.fn(async () => []) },
  };
  const transaction = vi.fn(async (operation: (value: typeof tx) => Promise<unknown>, options: unknown) => {
    expect(options).toMatchObject({ isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return operation(tx);
  });
  boundary.getDb.mockReturnValue({ $transaction: transaction });
  return tx;
}
function markup(outcomes: { actualCare: unknown }[]) {
  return renderToStaticMarkup(createElement(MembershipOutcomes, {
    metrics: { ...membershipMetrics(outcomes), denominator: outcomes.length, from, to },
  }));
}
beforeEach(() => { boundary.getDb.mockReset(); boundary.payload = null; });

describe('Client membership reporting', () => {
  test('partitions twenty visits into five enrolled, five declined and ten unknown with a known-only rate', () => {
    expect(membershipMetrics(mixed())).toEqual({ membershipEnrollments: 5, membershipDeclines: 5,
      membershipNotRecorded: 10, membershipRecorded: 10, membershipEnrollmentRate: 0.5 });
  });

  test('full actual-care validation treats absent, malformed and coercible membership records as unknown', () => {
    const { membershipEnrolled: _missing, ...unfilled } = care(null);
    const invalid = [undefined, null, {}, true, 'true', [care(true)], care('true'), care(1),
      { ...care(true), currency: 'invalid' }, { ...care(false), items: 'invalid' }, unfilled];
    expect(membershipMetrics(invalid.map(actualCare => ({ actualCare })))).toEqual({
      membershipEnrollments: 0, membershipDeclines: 0, membershipNotRecorded: invalid.length,
      membershipRecorded: 0, membershipEnrollmentRate: null,
    });
  });

  test('wellness acceptance, rejection, a service purchase and known money never infer enrollment', () => {
    const results = [row(null, { wellnessDecision: 'ACCEPTED' }), row(care(false), { wellnessDecision: 'ACCEPTED' }),
      row(care(true), { wellnessDecision: 'REJECTED' }),
      row({ ...care(null), servicePurchased: true, confirmedCollectedCents: 10000 }), row(null)];
    expect(membershipMetrics(results)).toEqual({ membershipEnrollments: 1, membershipDeclines: 1,
      membershipNotRecorded: 3, membershipRecorded: 2, membershipEnrollmentRate: 0.5 });
  });

  test('four all-unknown outcomes and an empty cohort have null rates, while recorded declines have a real zero rate', () => {
    expect(membershipMetrics(Array.from({ length: 4 }, () => ({ actualCare: null }))))
      .toMatchObject({ membershipNotRecorded: 4, membershipEnrollmentRate: null });
    expect(membershipMetrics([])).toEqual({ membershipEnrollments: 0, membershipDeclines: 0,
      membershipNotRecorded: 0, membershipRecorded: 0, membershipEnrollmentRate: null });
    expect(membershipMetrics([{ actualCare: care(false) }]))
      .toMatchObject({ membershipDeclines: 1, membershipRecorded: 1, membershipEnrollmentRate: 0 });
  });

  test('the real dashboard selects a complete half-open tenant/location cohort with archived visits and no setup tests', async () => {
    const rows = mixed();
    rows[0] = row(care(true), { archivedAt: new Date(from) });
    rows[1] = row(care(true), { createdAt: new Date(new Date(to).getTime() - 1) });
    const tx = dashboardTransport([...rows,
      row(care(true), { tenantId: foreignId }), row(care(false), { locationId: secondLocationId }),
      row(care(true), { isTest: true }), row(care(true), { createdAt: new Date(new Date(from).getTime() - 1) }),
      row(care(false), { createdAt: new Date(to) }),
    ]);
    const result = await getClinicDashboard(actor, { from, to, search: 'no board matches' });
    expect(result.metrics).toMatchObject({ from, to, denominator: 20, consultations: 20,
      membershipEnrollments: 5, membershipDeclines: 5, membershipNotRecorded: 10, membershipRecorded: 10,
      membershipEnrollmentRate: 0.5, careStarted: 20 });
    expect(result.consultations).toEqual([]);
    expect(result.metrics.membershipEnrollments + result.metrics.membershipDeclines + result.metrics.membershipNotRecorded)
      .toBe(result.metrics.denominator);
    expect(tx.consultation.findMany).toHaveBeenCalledTimes(2);
    expect(tx.consultation.count).toHaveBeenCalledTimes(2); // board/overdue only; denominator is the cohort length.
  });

  test('board search, paging and all-date archive browsing never shrink selected-period membership totals', async () => {
    const tx = dashboardTransport(mixed());
    for (const filters of [
      { search: 'no matches', pageSize: 1 },
      { search: 'other', pageSize: 2, cursor: actor.id },
      { archived: true, search: 'archive', pageSize: 1 },
    ]) {
      const result = await getClinicDashboard(actor, { from, to, ...filters });
      expect(result.metrics).toMatchObject({ denominator: 20, membershipEnrollments: 5,
        membershipDeclines: 5, membershipNotRecorded: 10, membershipEnrollmentRate: 0.5 });
      expect(result.consultationCount).toBe(0);
    }
    expect(tx.consultation.findMany.mock.calls.filter(([query]) => query.select)).toHaveLength(3);
    const pages = tx.consultation.findMany.mock.calls.filter(([query]) => query.include);
    expect(pages.map(([query]) => query.take)).toEqual([2, 3, 2]);
  });

  test('a second owned location has its own complete cohort and an unavailable foreign location is rejected before reads', async () => {
    const tx = dashboardTransport([...mixed(), row(care(false), { locationId: secondLocationId })]);
    const second = await getClinicDashboard(actor, { from, to, locationId: secondLocationId });
    expect(second.metrics).toMatchObject({ denominator: 1, membershipDeclines: 1,
      membershipNotRecorded: 0, membershipEnrollmentRate: 0 });
    tx.consultation.findMany.mockClear();
    await expect(getClinicDashboard(actor, { from, to, locationId: foreignId }))
      .rejects.toMatchObject({ status: 404, code: 'LOCATION_NOT_FOUND' });
    expect(tx.consultation.findMany).not.toHaveBeenCalled();
  });

  test('an empty selected-period dashboard preserves zero counts and a null known-outcome rate', async () => {
    dashboardTransport([row(care(true), { createdAt: new Date(to) })]);
    const result = await getClinicDashboard(actor, { from, to });
    expect(result.metrics).toMatchObject({ denominator: 0, consultations: 0, membershipEnrollments: 0,
      membershipDeclines: 0, membershipNotRecorded: 0, membershipRecorded: 0, membershipEnrollmentRate: null });
  });

  test('the shared accessible summary exposes all outcomes, both denominators, missing data and creation-period semantics', () => {
    const html = markup(mixed());
    for (const text of ['aria-label="Client membership outcomes"', '<h2>Client membership outcomes</h2>',
      'Enrolled', 'Did not enroll', 'Not recorded', '50%', '5 enrolled of 10 recorded outcomes; 10 not recorded.',
      'Cohort: 20 consultation visits', '(inclusive)', '(exclusive)', 'Archived visits are included',
      'setup tests are excluded', 'repeat client visits', 'payment collection', 'DripWell account billing is separate']) {
      expect(html).toContain(text);
    }
    expect(html).toContain('<strong>5<em>/20</em></strong>');
    expect(html).toContain(`dateTime="${from}"`);
    expect(html).toContain(`dateTime="${to}"`);
  });

  test('all-unknown and empty rendered cohorts show no percentage or invalid arithmetic', () => {
    for (const outcomes of [Array.from({ length: 4 }, () => ({ actualCare: null })), []]) {
      const html = markup(outcomes);
      expect(html).toContain('Not available');
      expect(html).toContain('No membership outcomes recorded');
      expect(html).not.toMatch(/\d%|NaN|Infinity/);
    }
  });

  test('recorded declines render a valid zero percent alongside their missing count', () => {
    const html = markup([{ actualCare: care(false) }, { actualCare: null }]);
    expect(html).toContain('0%');
    expect(html).toContain('0 enrolled of 1 recorded outcomes; 1 not recorded.');
  });

  test('both primary views render the same server metrics while the owner workbench retains its role gate', async () => {
    dashboardTransport(mixed());
    boundary.payload = await getClinicDashboard(actor, { from, to }) as unknown as ClinicPayload;
    for (const component of [Dashboard, Owner]) {
      const html = renderToStaticMarkup(createElement(component));
      expect(html).toContain('aria-label="Client membership outcomes"');
      expect(html).toContain('<strong>5<em>/20</em></strong>');
      expect(html).toContain('5 enrolled of 10 recorded outcomes; 10 not recorded.');
    }
    boundary.payload.user.role = 'STAFF';
    const staffOwnerPage = renderToStaticMarkup(createElement(Owner));
    expect(staffOwnerPage).toContain('The clinic owner manages adjustment review');
    expect(staffOwnerPage).not.toContain('Client membership outcomes');
  });
});
