import 'server-only';
import { Prisma } from '@prisma/client';
import { referralPolicySchema, type ReferralPolicy } from '@dripwell/shared/v2';
import { getDb } from './db';
import { ApiError } from './errors';
import { applicationUrl, ensureReferralCode } from './billing';
import { ledgerBalances } from './credits';

export function serviceReadiness() {
  const items = [
    { name: 'database', connected: Boolean(process.env.DATABASE_URL) },
    { name: 'applicationAddress', connected: Boolean(process.env.APP_URL) },
    {
      name: 'twoFactorEncryption',
      connected: Boolean(
        process.env.AUTH_ENCRYPTION_KEY &&
        Buffer.from(process.env.AUTH_ENCRYPTION_KEY, 'base64url').length === 32,
      ),
    },
    { name: 'scheduledWork', connected: Boolean(process.env.CRON_SECRET) },
    {
      name: 'subscriptionBilling',
      connected: Boolean(
        process.env.STRIPE_SECRET_KEY &&
        process.env.STRIPE_WEBHOOK_SECRET &&
        process.env.STRIPE_PRICE_ID,
      ),
    },
    {
      name: 'secureEmail',
      connected: Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM),
    },
    { name: 'privateStorage', connected: Boolean(process.env.BLOB_READ_WRITE_TOKEN) },
    {
      name: 'aiGateway',
      connected: Boolean(
        process.env.AI_GATEWAY_API_KEY ||
        process.env.VERCEL_OIDC_TOKEN ||
        process.env.VERCEL === '1',
      ),
    },
  ];
  return { configured: items.every((item) => item.connected), services: items };
}

export async function clinicReferrals(tenantId: string) {
  const db = getDb();
  const [code, subscription, referrals, credits, policy] = await Promise.all([
    ensureReferralCode(tenantId),
    db.subscription.findUnique({ where: { tenantId } }),
    db.referral.findMany({
      where: { referrerTenantId: tenantId },
      select: {
        id: true,
        status: true,
        createdAt: true,
        convertedAt: true,
        policyVersion: true,
        referredTenant: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    db.creditLedger.findMany({
      where: { tenantId },
      select: {
        id: true,
        sourceEventId: true,
        reversesId: true,
        referralId: true,
        kind: true,
        amountCents: true,
        currency: true,
        policyVersion: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
    db.platformPolicy.findUnique({ where: { id: 'global' } }),
  ]);
  const parsed = referralPolicySchema.safeParse(policy?.referralPolicy);
  return {
    code,
    url: `${applicationUrl()}/register?ref=${encodeURIComponent(code)}`,
    trial: {
      endsAt: subscription?.trialEndsAt ?? null,
      activatedAt: subscription?.trialActivatedAt ?? null,
      limit: subscription?.trialLimit ?? 10,
      used: subscription?.trialUsed ?? 0,
      remaining: Math.max(0, (subscription?.trialLimit ?? 10) - (subscription?.trialUsed ?? 0)),
    },
    subscription: {
      status: subscription?.status ?? 'NOT_STARTED',
      currentPeriodEnd: subscription?.currentPeriodEnd ?? null,
      stripeCustomerLinked: Boolean(subscription?.stripeCustomerId),
    },
    referrals: referrals.map((item) => ({
      id: item.id,
      clinicName: item.referredTenant.name,
      status: item.status,
      createdAt: item.createdAt,
      convertedAt: item.convertedAt,
      policyVersion: item.policyVersion,
    })),
    credits,
    balances: ledgerBalances(credits),
    policy: parsed.success ? parsed.data : null,
    notice: parsed.success
      ? 'Credits are awarded after a referred clinic makes its first qualifying subscription payment.'
      : 'Referral tracking is active. The account-credit amount and terms have not yet been configured; no monetary credit is promised until a policy is published.',
  };
}

export async function platformOverview() {
  const db = getDb();
  const [
    clinics,
    stages,
    care,
    subscriptions,
    referrals,
    credits,
    jobs,
    billingFailures,
    policy,
    support,
  ] = await Promise.all([
    db.tenant.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        isActive: true,
        createdAt: true,
        subscription: true,
        _count: {
          select: { users: true, consultations: { where: { isTest: false } }, referralsSent: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    db.consultation.groupBy({
      by: ['tenantId', 'stage'],
      where: { isTest: false },
      _count: { _all: true },
    }),
    db.consultation.groupBy({
      by: ['tenantId', 'careOutcome'],
      where: { isTest: false },
      _count: { _all: true },
    }),
    db.subscription.groupBy({ by: ['status'], _count: { _all: true } }),
    db.referral.findMany({
      select: {
        id: true,
        referrerTenantId: true,
        referredTenantId: true,
        status: true,
        policyVersion: true,
        createdAt: true,
        convertedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
    db.creditLedger.findMany({
      select: {
        id: true,
        sourceEventId: true,
        reversesId: true,
        tenantId: true,
        referralId: true,
        kind: true,
        amountCents: true,
        currency: true,
        policyVersion: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
    db.generationJob.findMany({
      select: {
        tenantId: true,
        kind: true,
        status: true,
        usage: true,
        errorCode: true,
        startedAt: true,
        completedAt: true,
      },
    }),
    db.billingEvent.findMany({
      where: { status: { not: 'PROCESSED' } },
      select: { eventId: true, eventType: true, status: true, errorCode: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    db.platformPolicy.findUnique({ where: { id: 'global' } }),
    db.feedback.groupBy({ by: ['status'], _count: { _all: true } }),
  ]);
  const parsed = referralPolicySchema.safeParse(policy?.referralPolicy);
  const latencies = jobs
    .filter((job) => job.startedAt && job.completedAt)
    .map((job) => job.completedAt!.getTime() - job.startedAt!.getTime());
  const costValues = jobs
    .map((job) => {
      const usage = job.usage as Record<string, unknown> | null;
      return typeof usage?.costUsd === 'number' ? usage.costUsd : null;
    })
    .filter((cost): cost is number => cost !== null);
  const estimates = jobs
    .map((job) => {
      const usage = job.usage as Record<string, unknown> | null;
      return typeof usage?.estimatedCostCents === 'number' ? usage.estimatedCostCents : null;
    })
    .filter((cost): cost is number => cost !== null);
  const transcriptionSeconds = jobs.reduce((sum, job) => {
    const usage = job.usage as { transcription?: { durationSeconds?: unknown } } | null;
    return (
      sum +
      (typeof usage?.transcription?.durationSeconds === 'number'
        ? usage.transcription.durationSeconds
        : 0)
    );
  }, 0);
  const tokenTotals = jobs.reduce(
    (totals, job) => {
      const usage = job.usage as { inputTokens?: unknown; outputTokens?: unknown } | null;
      return {
        inputTokens:
          totals.inputTokens + (typeof usage?.inputTokens === 'number' ? usage.inputTokens : 0),
        outputTokens:
          totals.outputTokens + (typeof usage?.outputTokens === 'number' ? usage.outputTokens : 0),
      };
    },
    { inputTokens: 0, outputTokens: 0 },
  );
  return {
    clinics: clinics.map((clinic) => ({
      id: clinic.id,
      name: clinic.name,
      slug: clinic.slug,
      isActive: clinic.isActive,
      createdAt: clinic.createdAt,
      staffCount: clinic._count.users,
      consultationCount: clinic._count.consultations,
      subscriptionStatus: clinic.subscription?.status ?? 'NOT_STARTED',
      trial: {
        endsAt: clinic.subscription?.trialEndsAt ?? null,
        limit: clinic.subscription?.trialLimit ?? 10,
        used: clinic.subscription?.trialUsed ?? 0,
      },
      stages: Object.fromEntries(
        stages
          .filter((row) => row.tenantId === clinic.id)
          .map((row) => [row.stage, row._count._all]),
      ),
      careOutcomes: Object.fromEntries(
        care
          .filter((row) => row.tenantId === clinic.id)
          .map((row) => [row.careOutcome, row._count._all]),
      ),
      referralCount: clinic._count.referralsSent,
      generationFailures: jobs.filter(
        (job) => job.tenantId === clinic.id && job.status === 'FAILED',
      ).length,
    })),
    totals: {
      clinics: clinics.length,
      consultations: clinics.reduce((sum, clinic) => sum + clinic._count.consultations, 0),
      subscriptions: Object.fromEntries(subscriptions.map((row) => [row.status, row._count._all])),
      referrals: referrals.length,
      convertedReferrals: referrals.filter((referral) => referral.convertedAt).length,
      generationJobs: jobs.length,
      generationFailures: jobs.filter((job) => job.status === 'FAILED').length,
      measuredUsage: { ...tokenTotals, transcriptionSeconds },
      averageGenerationMilliseconds: latencies.length
        ? Math.round(latencies.reduce((sum, latency) => sum + latency, 0) / latencies.length)
        : null,
      knownModelCostUsd: costValues.length ? costValues.reduce((sum, cost) => sum + cost, 0) : null,
      estimatedModelCostCents: estimates.length
        ? estimates.reduce((sum, cost) => sum + cost, 0)
        : null,
      jobsWithMeasuredCost: costValues.length,
      creditBalances: ledgerBalances(credits),
      support: Object.fromEntries(support.map((row) => [row.status, row._count._all])),
      note: 'Consultation totals exclude setup tests and include archived visits. Model cost is shown only when reported by the provider.',
    },
    referrals,
    credits,
    billingFailures,
    policy: parsed.success ? parsed.data : null,
    readiness: serviceReadiness(),
  };
}

export async function setReferralPolicy(userId: string, policy: ReferralPolicy | null) {
  return getDb().$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(735918223)`;
    const existing = await tx.platformPolicy.findUnique({ where: { id: 'global' } });
    const previous = referralPolicySchema.safeParse(existing?.referralPolicy);
    const history = await tx.$queryRaw<Array<{ version: number }>>`
      SELECT COALESCE(MAX(("details" #>> '{after,version}')::int), 0) AS "version"
      FROM "AuditLog" WHERE "entityType" = 'REFERRAL_POLICY' AND jsonb_typeof("details" #> '{after,version}') = 'number'
    `;
    const latestVersion = Math.max(
      previous.success ? previous.data.version : 0,
      history[0]?.version ?? 0,
    );
    if (policy && (policy.version > 2147483647 || policy.creditCents > 2147483647))
      throw new ApiError(400, 'Policy amounts and version are too large.');
    if (policy && policy.version <= latestVersion)
      throw new ApiError(409, `Publish a new policy version greater than ${latestVersion}.`);
    const saved = await tx.platformPolicy.upsert({
      where: { id: 'global' },
      create: {
        referralPolicy: policy ? (policy as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
        updatedById: userId,
      },
      update: {
        referralPolicy: policy ? (policy as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
        updatedById: userId,
      },
    });
    await tx.auditLog.create({
      data: {
        userId,
        action: 'SETTINGS_CHANGED',
        entityType: 'REFERRAL_POLICY',
        details: {
          before: existing?.referralPolicy ?? null,
          after: policy as unknown as Prisma.InputJsonValue | null,
        },
      },
    });
    return { policy: saved.referralPolicy };
  });
}
