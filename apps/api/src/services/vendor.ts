import { prisma } from '../lib/prisma.js';
import { NotFoundError } from '../lib/errors.js';
import type { FastifyInstance } from 'fastify';

interface ClinicOverview {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  activeProviders: number;
  assessmentsThisMonth: number;
  lastActiveAt: Date | null;
  catalogSize: number;
}

export async function getClinicOverview(): Promise<ClinicOverview[]> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const tenants = await prisma.tenant.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: {
        select: {
          users: true,
          assessmentSessions: true,
          catalogItems: true,
        },
      },
      users: {
        where: { role: 'PROVIDER', isActive: true },
        select: { id: true },
      },
      assessmentSessions: {
        where: { startedAt: { gte: monthStart } },
        select: { id: true, startedAt: true },
        orderBy: { startedAt: 'desc' },
        take: 1,
      },
    },
  });

  const monthlyCounts = await prisma.assessmentSession.groupBy({
    by: ['tenantId'],
    where: { startedAt: { gte: monthStart } },
    _count: { id: true },
  });

  const countMap = new Map(monthlyCounts.map((c) => [c.tenantId, c._count.id]));

  return tenants.map((t) => ({
    id: t.id,
    name: t.name,
    slug: t.slug,
    isActive: t.isActive,
    activeProviders: t.users.length,
    assessmentsThisMonth: countMap.get(t.id) || 0,
    lastActiveAt: t.assessmentSessions[0]?.startedAt || null,
    catalogSize: t._count.catalogItems,
  }));
}

interface ClinicDetail {
  id: string;
  name: string;
  slug: string;
  state: string;
  medicalDirector: string;
  isActive: boolean;
  createdAt: Date;
  providers: Array<{
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    isActive: boolean;
    lastLoginAt: Date | null;
  }>;
  recentAssessments: Array<{
    id: string;
    status: string;
    startedAt: Date;
    completedAt: Date | null;
    providerName: string;
  }>;
  catalogSize: number;
}

export async function getClinicDetail(tenantId: string): Promise<ClinicDetail> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: {
      users: {
        where: { role: { in: ['SUPER_USER', 'PROVIDER'] } },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          isActive: true,
          lastLoginAt: true,
        },
        orderBy: { createdAt: 'desc' },
      },
      assessmentSessions: {
        orderBy: { startedAt: 'desc' },
        take: 10,
        select: {
          id: true,
          status: true,
          startedAt: true,
          completedAt: true,
          provider: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
      },
      _count: {
        select: {
          catalogItems: true,
        },
      },
    },
  });

  if (!tenant) {
    throw new NotFoundError('Clinic');
  }

  return {
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    state: tenant.state,
    medicalDirector: tenant.medicalDirector,
    isActive: tenant.isActive,
    createdAt: tenant.createdAt,
    providers: tenant.users,
    recentAssessments: tenant.assessmentSessions.map((a) => ({
      id: a.id,
      status: a.status,
      startedAt: a.startedAt,
      completedAt: a.completedAt,
      providerName: a.provider ? `${a.provider.firstName} ${a.provider.lastName}` : 'Unknown',
    })),
    catalogSize: tenant._count.catalogItems,
  };
}

interface PatternSummary {
  id: string;
  name: string;
  description: string;
  category: string;
  genericRecommendationIntent: string;
  clinicalRationale: string;
  supportingSignals: unknown;
  supportingAnswers: unknown;
  conflictingSignals: unknown;
  safetyFlags: unknown;
  isActive: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export async function getPatternLibrary(): Promise<PatternSummary[]> {
  const patterns = await prisma.clinicalPattern.findMany({
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      name: true,
      description: true,
      category: true,
      genericRecommendationIntent: true,
      clinicalRationale: true,
      supportingSignals: true,
      supportingAnswers: true,
      conflictingSignals: true,
      safetyFlags: true,
      isActive: true,
      version: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  return patterns;
}

interface CreatePatternInput {
  name: string;
  description: string;
  category: string;
  supportingSignals: Array<Record<string, unknown>>;
  supportingAnswers: Array<Record<string, unknown>>;
  conflictingSignals: Array<Record<string, unknown>>;
  genericRecommendationIntent: string;
  clinicalRationale: string;
  safetyFlags: Array<Record<string, unknown>>;
}

export async function createPattern(data: CreatePatternInput): Promise<PatternSummary> {
  const pattern = await prisma.clinicalPattern.create({
    data: {
      name: data.name,
      description: data.description,
      category: data.category,
      supportingSignals: data.supportingSignals as unknown as object,
      supportingAnswers: data.supportingAnswers as unknown as object,
      conflictingSignals: data.conflictingSignals as unknown as object,
      genericRecommendationIntent: data.genericRecommendationIntent,
      clinicalRationale: data.clinicalRationale,
      safetyFlags: data.safetyFlags as unknown as object,
    },
    select: {
      id: true,
      name: true,
      description: true,
      category: true,
      genericRecommendationIntent: true,
      clinicalRationale: true,
      supportingSignals: true,
      supportingAnswers: true,
      conflictingSignals: true,
      safetyFlags: true,
      isActive: true,
      version: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  return pattern;
}

interface UpdatePatternInput {
  name?: string;
  description?: string;
  category?: string;
  supportingSignals?: Array<Record<string, unknown>>;
  supportingAnswers?: Array<Record<string, unknown>>;
  conflictingSignals?: Array<Record<string, unknown>>;
  genericRecommendationIntent?: string;
  clinicalRationale?: string;
  safetyFlags?: Array<Record<string, unknown>>;
}

export async function updatePattern(id: string, data: UpdatePatternInput): Promise<PatternSummary> {
  const existing = await prisma.clinicalPattern.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError('Pattern');
  }

  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.category !== undefined) updateData.category = data.category;
  if (data.supportingSignals !== undefined) updateData.supportingSignals = data.supportingSignals as unknown as object;
  if (data.supportingAnswers !== undefined) updateData.supportingAnswers = data.supportingAnswers as unknown as object;
  if (data.conflictingSignals !== undefined) updateData.conflictingSignals = data.conflictingSignals as unknown as object;
  if (data.genericRecommendationIntent !== undefined) updateData.genericRecommendationIntent = data.genericRecommendationIntent;
  if (data.clinicalRationale !== undefined) updateData.clinicalRationale = data.clinicalRationale;
  if (data.safetyFlags !== undefined) updateData.safetyFlags = data.safetyFlags as unknown as object;
  updateData.version = { increment: 1 };

  const pattern = await prisma.clinicalPattern.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      name: true,
      description: true,
      category: true,
      genericRecommendationIntent: true,
      clinicalRationale: true,
      supportingSignals: true,
      supportingAnswers: true,
      conflictingSignals: true,
      safetyFlags: true,
      isActive: true,
      version: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  return pattern;
}

export async function togglePatternActive(id: string): Promise<PatternSummary> {
  const existing = await prisma.clinicalPattern.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError('Pattern');
  }

  const pattern = await prisma.clinicalPattern.update({
    where: { id },
    data: { isActive: !existing.isActive, version: { increment: 1 } },
    select: {
      id: true,
      name: true,
      description: true,
      category: true,
      genericRecommendationIntent: true,
      clinicalRationale: true,
      supportingSignals: true,
      supportingAnswers: true,
      conflictingSignals: true,
      safetyFlags: true,
      isActive: true,
      version: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  return pattern;
}

interface PlatformHealth {
  totalAssessmentsToday: number;
  activeClinics: number;
  totalClinics: number;
  totalProviders: number;
  healthScore: number;
  aiTokenUsageEstimate: number;
}

export async function getPlatformHealth(): Promise<PlatformHealth> {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [
    totalAssessmentsToday,
    activeClinics,
    totalClinics,
    totalProviders,
  ] = await Promise.all([
    prisma.assessmentSession.count({
      where: { startedAt: { gte: todayStart } },
    }),
    prisma.tenant.count({ where: { isActive: true } }),
    prisma.tenant.count(),
    prisma.user.count({ where: { role: 'PROVIDER' } }),
  ]);

  // Health score is a proxy estimate based on safety flags and abandoned
  // assessments in the last 24h. It is not a true HTTP error rate but gives
  // a directional signal of platform friction (lower is better).
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const [safetyFlags24h, abandoned24h, totalAssessments24h] = await Promise.all([
    prisma.safetyFlag.count({ where: { createdAt: { gte: dayAgo } } }),
    prisma.assessmentSession.count({ where: { status: 'ABANDONED', updatedAt: { gte: dayAgo } } }),
    prisma.assessmentSession.count({ where: { startedAt: { gte: dayAgo } } }),
  ]);

  const proxyIssues = safetyFlags24h + abandoned24h;
  const healthScore = totalAssessments24h > 0
    ? Math.round((proxyIssues / totalAssessments24h) * 100)
    : 0;

  // AI token usage estimate: each assessment ~ 4K tokens (2 photo analysis + 2 recommendation)
  const aiTokenUsageEstimate = totalAssessments24h * 4000;

  return {
    totalAssessmentsToday,
    activeClinics,
    totalClinics,
    totalProviders,
    healthScore,
    aiTokenUsageEstimate,
  };
}

interface CrossTenantAuditLogQuery {
  action?: string;
  tenantId?: string;
  userId?: string;
  from?: Date;
  to?: Date;
  page: number;
  limit: number;
}

export async function getCrossTenantAuditLogs(query: CrossTenantAuditLogQuery) {
  const where: Record<string, unknown> = {};

  if (query.action) {
    where.action = query.action;
  }
  if (query.tenantId) {
    where.tenantId = query.tenantId;
  }
  if (query.userId) {
    where.userId = query.userId;
  }
  if (query.from || query.to) {
    where.createdAt = {};
    if (query.from) {
      (where.createdAt as Record<string, unknown>).gte = query.from;
    }
    if (query.to) {
      (where.createdAt as Record<string, unknown>).lte = query.to;
    }
  }

  const skip = (query.page - 1) * query.limit;

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: query.limit,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        tenant: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return { logs, total, page: query.page, limit: query.limit };
}

interface ImpersonationResult {
  token: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    tenantId: string | null;
    isActive: boolean;
  };
  expiresAt: Date;
}

export async function impersonateSuperUser({
  tenantId,
  vendorId,
  fastify,
}: {
  tenantId: string;
  vendorId: string;
  fastify: FastifyInstance;
}): Promise<ImpersonationResult> {
  const superUser = await prisma.user.findFirst({
    where: { tenantId, role: 'SUPER_USER', isActive: true },
  });

  if (!superUser) {
    throw new NotFoundError('Super user for this clinic');
  }

  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  const token = fastify.jwt.sign(
    {
      userId: superUser.id,
      role: superUser.role,
      tenantId: superUser.tenantId,
      impersonatedBy: vendorId,
    },
    { expiresIn: '1h' }
  );

  await prisma.auditLog.create({
    data: {
      tenantId,
      userId: vendorId,
      action: 'IMPERSONATION_STARTED',
      entityType: 'User',
      entityId: superUser.id,
      impersonatedBy: vendorId,
      details: {
        impersonatedUserId: superUser.id,
        impersonatedUserEmail: superUser.email,
        impersonatedUserName: `${superUser.firstName} ${superUser.lastName}`,
        impersonatedRole: superUser.role,
      },
    },
  });

  return {
    token,
    user: {
      id: superUser.id,
      email: superUser.email,
      firstName: superUser.firstName,
      lastName: superUser.lastName,
      role: superUser.role,
      tenantId: superUser.tenantId,
      isActive: superUser.isActive,
    },
    expiresAt,
  };
}
