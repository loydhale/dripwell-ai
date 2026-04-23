import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { parseBody } from '../lib/validate.js';
import { NotFoundError, ForbiddenError } from '../lib/errors.js';
import type { UserPayload } from '../types/index.js';

const createAssessmentSchema = z.object({
  locationId: z.string().uuid().optional(),
});

export default async function assessmentRoutes(fastify: FastifyInstance) {
  fastify.post(
    '/assessments',
    { preValidation: [fastify.authenticate] },
    async (request) => {
      const data = parseBody(createAssessmentSchema)(request.body);
      const userPayload = request.user as UserPayload;

      if (!userPayload.tenantId) {
        throw new ForbiddenError('User must belong to a tenant');
      }

      const assessment = await prisma.assessmentSession.create({
        data: {
          tenantId: userPayload.tenantId,
          providerId: userPayload.userId,
          locationId: data.locationId,
          status: 'IN_PROGRESS',
        },
      });

      return { assessment };
    }
  );

  fastify.get(
    '/assessments',
    { preValidation: [fastify.authenticate] },
    async (request) => {
      const userPayload = request.user as UserPayload;

      if (!userPayload.tenantId) {
        throw new ForbiddenError('User must belong to a tenant');
      }

      const assessments = await prisma.assessmentSession.findMany({
        where: {
          tenantId: userPayload.tenantId,
        },
        orderBy: { createdAt: 'desc' },
      });

      return { assessments };
    }
  );

  fastify.get(
    '/assessments/:id',
    { preValidation: [fastify.authenticate] },
    async (request) => {
      const { id } = request.params as { id: string };
      const userPayload = request.user as UserPayload;

      if (!userPayload.tenantId) {
        throw new ForbiddenError('User must belong to a tenant');
      }

      const assessment = await prisma.assessmentSession.findFirst({
        where: {
          id,
          tenantId: userPayload.tenantId,
        },
      });

      if (!assessment) {
        throw new NotFoundError('Assessment');
      }

      return { assessment };
    }
  );
}
