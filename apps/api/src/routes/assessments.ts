import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { parseBody } from '../lib/validate.js';
import { getPhotoStorage } from '../lib/storage.js';
import { NotFoundError, ForbiddenError, ValidationError } from '../lib/errors.js';
import type { UserPayload } from '../types/index.js';

const createAssessmentSchema = z.object({
  locationId: z.string().uuid().optional(),
});

const photoAngleSchema = z.enum(['FACE', 'UNDER_EYES', 'HAND_FOREARM', 'TONGUE']);

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

  fastify.post(
    '/assessments/:id/photos',
    { preValidation: [fastify.authenticate] },
    async (request, reply) => {
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

      const data = await request.file();
      if (!data) {
        throw new ValidationError([{ message: 'Photo file is required' }]);
      }

      const angleRaw = (data.fields.angle as { value?: string } | undefined)?.value;
      const angleResult = photoAngleSchema.safeParse(angleRaw);
      if (!angleResult.success) {
        throw new ValidationError([{ message: 'Invalid or missing photo angle. Must be one of: FACE, UNDER_EYES, HAND_FOREARM, TONGUE' }]);
      }
      const angle = angleResult.data;

      const chunks: Buffer[] = [];
      for await (const chunk of data.file) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);

      const storage = getPhotoStorage();
      const stored = await storage.savePhoto({
        buffer,
        angle,
        assessmentId: id,
        tenantId: userPayload.tenantId,
        mimeType: data.mimetype,
      });

      const photoCapture = await prisma.photoCapture.create({
        data: {
          assessmentSessionId: id,
          tenantId: userPayload.tenantId,
          angle,
          url: stored.url,
          uploadedAt: new Date(),
        },
      });

      await prisma.auditLog.create({
        data: {
          tenantId: userPayload.tenantId,
          userId: userPayload.userId,
          assessmentSessionId: id,
          action: 'PHOTO_CAPTURED',
          entityType: 'PhotoCapture',
          entityId: photoCapture.id,
          details: { angle, url: stored.url },
        },
      });

      reply.status(201);
      return { photoCapture };
    }
  );
}
