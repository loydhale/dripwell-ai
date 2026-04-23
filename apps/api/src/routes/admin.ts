import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { parseBody } from '../lib/validate.js';
import { NotFoundError, ForbiddenError } from '../lib/errors.js';
import type { UserPayload } from '../types/index.js';

const deactivateSchema = z.object({
  reason: z.string().optional(),
});

const auditLogQuerySchema = z.object({
  action: z.string().optional(),
  userId: z.string().uuid().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(100).optional().default(50),
});

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day;
  return new Date(d.setDate(diff));
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export default async function adminRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/admin/analytics',
    { preValidation: [fastify.authenticate, fastify.requireRole(['SUPER_USER'])] },
    async (request) => {
      const userPayload = request.user as UserPayload;

      if (!userPayload.tenantId) {
        throw new ForbiddenError('User must belong to a tenant');
      }

      const now = new Date();
      const weekStart = startOfWeek(now);
      const monthStart = startOfMonth(now);

      const totalAssessments = await prisma.assessmentSession.count({
        where: { tenantId: userPayload.tenantId },
      });

      const thisWeek = await prisma.assessmentSession.count({
        where: {
          tenantId: userPayload.tenantId,
          startedAt: { gte: weekStart },
        },
      });

      const thisMonth = await prisma.assessmentSession.count({
        where: {
          tenantId: userPayload.tenantId,
          startedAt: { gte: monthStart },
        },
      });

      const recommendationCounts = await prisma.recommendation.groupBy({
        by: ['status'],
        where: { tenantId: userPayload.tenantId },
        _count: { status: true },
      });

      const approved = recommendationCounts.find((c) => c.status === 'APPROVED')?._count.status || 0;
      const rejected = recommendationCounts.find((c) => c.status === 'REJECTED')?._count.status || 0;
      const modified = recommendationCounts.find((c) => c.status === 'MODIFIED')?._count.status || 0;
      const decided = approved + rejected + modified;
      const acceptanceRate = decided > 0 ? Math.round((approved / decided) * 100) : 0;

      const overrideReasons = await prisma.providerOverride.groupBy({
        by: ['reason'],
        where: { tenantId: userPayload.tenantId },
        _count: { reason: true },
      });

      const flagTiers = await prisma.safetyFlag.groupBy({
        by: ['tier'],
        where: { tenantId: userPayload.tenantId },
        _count: { tier: true },
      });

      return {
        totalAssessments,
        thisWeek,
        thisMonth,
        acceptanceRate,
        overrideReasons: overrideReasons.map((r) => ({
          reason: r.reason,
          count: r._count.reason,
        })),
        flagTiers: flagTiers.map((f) => ({
          tier: f.tier,
          count: f._count.tier,
        })),
      };
    }
  );

  fastify.get(
    '/admin/audit-logs',
    { preValidation: [fastify.authenticate, fastify.requireRole(['SUPER_USER'])] },
    async (request) => {
      const userPayload = request.user as UserPayload;

      if (!userPayload.tenantId) {
        throw new ForbiddenError('User must belong to a tenant');
      }

      const query = auditLogQuerySchema.parse(request.query);

      const where: Record<string, unknown> = {
        tenantId: userPayload.tenantId,
      };

      if (query.action) {
        where.action = query.action;
      }
      if (query.userId) {
        where.userId = query.userId;
      }
      if (query.from || query.to) {
        where.createdAt = {};
        if (query.from) {
          (where.createdAt as Record<string, unknown>).gte = new Date(query.from);
        }
        if (query.to) {
          (where.createdAt as Record<string, unknown>).lte = new Date(query.to);
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
          },
        }),
        prisma.auditLog.count({ where }),
      ]);

      return { logs, total, page: query.page, limit: query.limit };
    }
  );

  fastify.get(
    '/admin/providers',
    { preValidation: [fastify.authenticate, fastify.requireRole(['SUPER_USER'])] },
    async (request) => {
      const userPayload = request.user as UserPayload;

      if (!userPayload.tenantId) {
        throw new ForbiddenError('User must belong to a tenant');
      }

      const providers = await prisma.user.findMany({
        where: {
          tenantId: userPayload.tenantId,
          role: 'PROVIDER',
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      return { providers };
    }
  );

  fastify.put(
    '/admin/providers/:id/deactivate',
    { preValidation: [fastify.authenticate, fastify.requireRole(['SUPER_USER'])] },
    async (request) => {
      const { id } = request.params as { id: string };
      const userPayload = request.user as UserPayload;
      const data = parseBody(deactivateSchema)(request.body);

      if (!userPayload.tenantId) {
        throw new ForbiddenError('User must belong to a tenant');
      }

      const provider = await prisma.user.findFirst({
        where: { id, tenantId: userPayload.tenantId, role: 'PROVIDER' },
      });

      if (!provider) {
        throw new NotFoundError('Provider');
      }

      const updated = await prisma.user.update({
        where: { id },
        data: { isActive: false },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
        },
      });

      await prisma.auditLog.create({
        data: {
          tenantId: userPayload.tenantId,
          userId: userPayload.userId,
          action: 'USER_DEACTIVATED',
          entityType: 'User',
          entityId: id,
          details: { reason: data.reason || null },
        },
      });

      return { provider: updated };
    }
  );

  fastify.put(
    '/admin/providers/:id/reactivate',
    { preValidation: [fastify.authenticate, fastify.requireRole(['SUPER_USER'])] },
    async (request) => {
      const { id } = request.params as { id: string };
      const userPayload = request.user as UserPayload;

      if (!userPayload.tenantId) {
        throw new ForbiddenError('User must belong to a tenant');
      }

      const provider = await prisma.user.findFirst({
        where: { id, tenantId: userPayload.tenantId, role: 'PROVIDER' },
      });

      if (!provider) {
        throw new NotFoundError('Provider');
      }

      const updated = await prisma.user.update({
        where: { id },
        data: { isActive: true },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
        },
      });

      await prisma.auditLog.create({
        data: {
          tenantId: userPayload.tenantId,
          userId: userPayload.userId,
          action: 'USER_INVITED',
          entityType: 'User',
          entityId: id,
          details: { action: 'reactivated' },
        },
      });

      return { provider: updated };
    }
  );

  fastify.get(
    '/admin/assessments/recent',
    { preValidation: [fastify.authenticate, fastify.requireRole(['SUPER_USER'])] },
    async (request) => {
      const userPayload = request.user as UserPayload;

      if (!userPayload.tenantId) {
        throw new ForbiddenError('User must belong to a tenant');
      }

      const limit = Math.min(
        Number((request.query as Record<string, string>)?.limit) || 10,
        50
      );

      const assessments = await prisma.assessmentSession.findMany({
        where: { tenantId: userPayload.tenantId },
        orderBy: { startedAt: 'desc' },
        take: limit,
        select: {
          id: true,
          status: true,
          startedAt: true,
          completedAt: true,
          providerId: true,
          provider: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          recommendations: {
            select: {
              id: true,
              status: true,
            },
          },
        },
      });

      return { assessments };
    }
  );

  fastify.get(
    '/admin/notifications',
    { preValidation: [fastify.authenticate, fastify.requireRole(['SUPER_USER'])] },
    async (request) => {
      const userPayload = request.user as UserPayload;

      if (!userPayload.tenantId) {
        throw new ForbiddenError('User must belong to a tenant');
      }

      const limit = Math.min(
        Number((request.query as Record<string, string>)?.limit) || 20,
        50
      );

      const [notifications, unreadCount] = await Promise.all([
        prisma.notification.findMany({
          where: { tenantId: userPayload.tenantId },
          orderBy: { createdAt: 'desc' },
          take: limit,
        }),
        prisma.notification.count({
          where: { tenantId: userPayload.tenantId, isRead: false },
        }),
      ]);

      return { notifications, unreadCount };
    }
  );

  fastify.put(
    '/admin/notifications/:id/read',
    { preValidation: [fastify.authenticate, fastify.requireRole(['SUPER_USER'])] },
    async (request) => {
      const { id } = request.params as { id: string };
      const userPayload = request.user as UserPayload;

      if (!userPayload.tenantId) {
        throw new ForbiddenError('User must belong to a tenant');
      }

      const notification = await prisma.notification.findFirst({
        where: { id, tenantId: userPayload.tenantId },
      });

      if (!notification) {
        throw new NotFoundError('Notification');
      }

      const updated = await prisma.notification.update({
        where: { id },
        data: { isRead: true },
      });

      return { notification: updated };
    }
  );

  fastify.put(
    '/admin/notifications/read-all',
    { preValidation: [fastify.authenticate, fastify.requireRole(['SUPER_USER'])] },
    async (request) => {
      const userPayload = request.user as UserPayload;

      if (!userPayload.tenantId) {
        throw new ForbiddenError('User must belong to a tenant');
      }

      await prisma.notification.updateMany({
        where: { tenantId: userPayload.tenantId, isRead: false },
        data: { isRead: true },
      });

      return { success: true };
    }
  );
}
