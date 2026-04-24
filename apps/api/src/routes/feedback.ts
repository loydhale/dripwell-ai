import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { parseBody } from '../lib/validate.js';
import { createFeedback, listFeedbackForTenant } from '../services/feedback.js';
import type { UserPayload } from '../types/index.js';

const createFeedbackSchema = z.object({
  type: z.enum(['BUG', 'FEATURE_REQUEST', 'GENERAL']),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(5000),
  urgency: z.enum(['low', 'medium', 'high']),
});

export default async function feedbackRoutes(fastify: FastifyInstance) {
  // Submit feedback (super user only)
  fastify.post(
    '/feedback',
    { preValidation: [fastify.authenticate, fastify.requireRole(['SUPER_USER'])] },
    async (request, reply) => {
      const userPayload = request.user as UserPayload;
      const data = parseBody(createFeedbackSchema)(request.body);

      if (!userPayload.tenantId) {
        throw new Error('User must belong to a tenant');
      }

      const feedback = await createFeedback({
        tenantId: userPayload.tenantId,
        submitterId: userPayload.userId,
        type: data.type,
        title: data.title,
        description: data.description,
        urgency: data.urgency,
      });

      reply.status(201);
      return { feedback };
    }
  );

  // List feedback for current tenant (super user only)
  fastify.get(
    '/feedback',
    { preValidation: [fastify.authenticate, fastify.requireRole(['SUPER_USER'])] },
    async (request) => {
      const userPayload = request.user as UserPayload;

      if (!userPayload.tenantId) {
        throw new Error('User must belong to a tenant');
      }

      const feedback = await listFeedbackForTenant(userPayload.tenantId);
      return { feedback };
    }
  );
}
