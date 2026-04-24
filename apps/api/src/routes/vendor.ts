import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { parseBody } from '../lib/validate.js';
import type { UserPayload } from '../types/index.js';
import {
  getClinicOverview,
  getClinicDetail,
  getPatternLibrary,
  createPattern,
  updatePattern,
  togglePatternActive,
  getPlatformHealth,
  getCrossTenantAuditLogs,
  impersonateSuperUser,
} from '../services/vendor.js';
import {
  listAllFeedback,
  updateFeedback,
  getFeedbackById,
} from '../services/feedback.js';

const createPatternSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  category: z.string().min(1),
  supportingSignals: z.array(z.record(z.any())).default([]),
  supportingAnswers: z.array(z.record(z.any())).default([]),
  conflictingSignals: z.array(z.record(z.any())).default([]),
  genericRecommendationIntent: z.string().min(1),
  clinicalRationale: z.string().min(1),
  safetyFlags: z.array(z.record(z.any())).default([]),
});

const updatePatternSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  supportingSignals: z.array(z.record(z.any())).optional(),
  supportingAnswers: z.array(z.record(z.any())).optional(),
  conflictingSignals: z.array(z.record(z.any())).optional(),
  genericRecommendationIntent: z.string().min(1).optional(),
  clinicalRationale: z.string().min(1).optional(),
  safetyFlags: z.array(z.record(z.any())).optional(),
});

const auditLogQuerySchema = z.object({
  action: z.string().optional(),
  tenantId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(100).optional().default(50),
});

const feedbackQuerySchema = z.object({
  status: z.string().optional(),
  category: z.string().optional(),
  decision: z.string().optional(),
  priority: z.string().optional(),
  tenantId: z.string().uuid().optional(),
  search: z.string().optional(),
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(100).optional().default(50),
});

const updateFeedbackSchema = z.object({
  status: z.enum(['BACKLOG', 'IN_PROGRESS', 'DONE', 'WONT_DO']).optional(),
  category: z.enum(['SOFTWARE_ISSUE', 'PROCESS_ISSUE', 'DOCUMENTATION', 'OTHER']).optional(),
  decision: z.enum(['DO_IT', 'DONT_DO_IT', 'MAYBE', 'NEEDS_MORE_INFO']).optional(),
  priority: z.enum(['P0', 'P1', 'P2']).optional(),
  assignedTo: z.string().uuid().optional().nullable(),
  notes: z.string().optional(),
  promotedTaskId: z.string().optional(),
});

const promoteFeedbackSchema = z.object({
  taskId: z.string().min(1),
});

export default async function vendorRoutes(fastify: FastifyInstance) {
  // Clinic overview
  fastify.get(
    '/vendor/clinics',
    { preValidation: [fastify.authenticate, fastify.requireRole(['SYSTEM_ADMIN'])] },
    async () => {
      const clinics = await getClinicOverview();
      return { clinics };
    }
  );

  // Clinic detail
  fastify.get(
    '/vendor/clinics/:id',
    { preValidation: [fastify.authenticate, fastify.requireRole(['SYSTEM_ADMIN'])] },
    async (request) => {
      const { id } = request.params as { id: string };
      const detail = await getClinicDetail(id);
      return { clinic: detail };
    }
  );

  // Pattern library
  fastify.get(
    '/vendor/patterns',
    { preValidation: [fastify.authenticate, fastify.requireRole(['SYSTEM_ADMIN'])] },
    async () => {
      const patterns = await getPatternLibrary();
      return { patterns };
    }
  );

  fastify.post(
    '/vendor/patterns',
    { preValidation: [fastify.authenticate, fastify.requireRole(['SYSTEM_ADMIN'])] },
    async (request, reply) => {
      const data = parseBody(createPatternSchema)(request.body);
      const pattern = await createPattern(data);
      reply.status(201);
      return { pattern };
    }
  );

  fastify.put(
    '/vendor/patterns/:id',
    { preValidation: [fastify.authenticate, fastify.requireRole(['SYSTEM_ADMIN'])] },
    async (request) => {
      const { id } = request.params as { id: string };
      const data = parseBody(updatePatternSchema)(request.body);
      const pattern = await updatePattern(id, data);
      return { pattern };
    }
  );

  fastify.put(
    '/vendor/patterns/:id/deprecate',
    { preValidation: [fastify.authenticate, fastify.requireRole(['SYSTEM_ADMIN'])] },
    async (request) => {
      const { id } = request.params as { id: string };
      const pattern = await togglePatternActive(id);
      return { pattern };
    }
  );

  // Platform health
  fastify.get(
    '/vendor/health',
    { preValidation: [fastify.authenticate, fastify.requireRole(['SYSTEM_ADMIN'])] },
    async () => {
      const health = await getPlatformHealth();
      return { health };
    }
  );

  // Cross-tenant audit logs
  fastify.get(
    '/vendor/audit-logs',
    { preValidation: [fastify.authenticate, fastify.requireRole(['SYSTEM_ADMIN'])] },
    async (request) => {
      const query = auditLogQuerySchema.parse(request.query);
      const logs = await getCrossTenantAuditLogs({
        action: query.action,
        tenantId: query.tenantId,
        userId: query.userId,
        from: query.from ? new Date(query.from) : undefined,
        to: query.to ? new Date(query.to) : undefined,
        page: query.page,
        limit: query.limit,
      });
      return logs;
    }
  );

  // Impersonate clinic super user
  fastify.post(
    '/vendor/impersonate/:tenantId',
    { preValidation: [fastify.authenticate, fastify.requireRole(['SYSTEM_ADMIN'])] },
    async (request, reply) => {
      const { tenantId } = request.params as { tenantId: string };
      const userPayload = request.user as UserPayload;
      const result = await impersonateSuperUser({
        tenantId,
        vendorId: userPayload.userId,
        fastify,
      });
      reply.status(201);
      return {
        token: result.token,
        user: result.user,
        expiresAt: result.expiresAt.toISOString(),
      };
    }
  );

  // Vendor feedback kanban
  fastify.get(
    '/vendor/feedback',
    { preValidation: [fastify.authenticate, fastify.requireRole(['SYSTEM_ADMIN'])] },
    async (request) => {
      const query = feedbackQuerySchema.parse(request.query);
      const result = await listAllFeedback({
        status: query.status,
        category: query.category,
        decision: query.decision,
        priority: query.priority,
        tenantId: query.tenantId,
        search: query.search,
        page: query.page,
        limit: query.limit,
      });
      return result;
    }
  );

  fastify.put(
    '/vendor/feedback/:id',
    { preValidation: [fastify.authenticate, fastify.requireRole(['SYSTEM_ADMIN'])] },
    async (request) => {
      const { id } = request.params as { id: string };
      const data = parseBody(updateFeedbackSchema)(request.body);
      const feedback = await updateFeedback(id, data);
      return { feedback };
    }
  );

  fastify.post(
    '/vendor/feedback/:id/promote',
    { preValidation: [fastify.authenticate, fastify.requireRole(['SYSTEM_ADMIN'])] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const data = parseBody(promoteFeedbackSchema)(request.body);

      const feedback = await getFeedbackById(id);
      if (feedback.category !== 'SOFTWARE_ISSUE') {
        throw new Error('Only software issues can be promoted to tasks');
      }

      const updated = await updateFeedback(id, {
        status: 'IN_PROGRESS',
        promotedTaskId: data.taskId,
      });

      reply.status(201);
      return { feedback: updated };
    }
  );
}
