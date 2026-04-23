import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { parseBody } from '../lib/validate.js';
import { NotFoundError, ForbiddenError } from '../lib/errors.js';
import type { UserPayload } from '../types/index.js';

const createTenantSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
  state: z.string().min(1),
  medicalDirector: z.string().min(1),
});

const updateTenantSchema = z.object({
  name: z.string().min(1).optional(),
  state: z.string().min(1).optional(),
  medicalDirector: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
});

export default async function tenantRoutes(fastify: FastifyInstance) {
  fastify.post(
    '/tenants',
    { preValidation: [fastify.authenticate, fastify.requireRole(['SUPER_USER'])] },
    async (request) => {
      const data = parseBody(createTenantSchema)(request.body);
      const userPayload = request.user as UserPayload;

      if (userPayload.tenantId) {
        throw new ForbiddenError('User already belongs to a tenant');
      }

      const tenant = await prisma.tenant.create({
        data: {
          name: data.name,
          slug: data.slug,
          state: data.state,
          medicalDirector: data.medicalDirector,
        },
      });

      await prisma.user.update({
        where: { id: userPayload.userId },
        data: { tenantId: tenant.id },
      });

      const token = fastify.jwt.sign({
        userId: userPayload.userId,
        role: userPayload.role,
        tenantId: tenant.id,
      });

      return { tenant, token };
    }
  );

  fastify.get(
    '/tenants/:id',
    { preValidation: [fastify.authenticate] },
    async (request) => {
      const { id } = request.params as { id: string };
      const userPayload = request.user as UserPayload;

      if (userPayload.tenantId && userPayload.tenantId !== id) {
        throw new ForbiddenError('Cannot access another tenant');
      }

      const tenant = await prisma.tenant.findUnique({
        where: { id },
      });

      if (!tenant) {
        throw new NotFoundError('Tenant');
      }

      return { tenant };
    }
  );

  fastify.put(
    '/tenants/:id',
    { preValidation: [fastify.authenticate, fastify.requireRole(['SUPER_USER'])] },
    async (request) => {
      const { id } = request.params as { id: string };
      const data = parseBody(updateTenantSchema)(request.body);
      const userPayload = request.user as UserPayload;

      if (userPayload.tenantId && userPayload.tenantId !== id) {
        throw new ForbiddenError('Cannot modify another tenant');
      }

      const tenant = await prisma.tenant.update({
        where: { id },
        data,
      });

      return { tenant };
    }
  );
}
