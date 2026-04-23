import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { parseBody } from '../lib/validate.js';
import { ConflictError, ForbiddenError } from '../lib/errors.js';
import type { UserPayload } from '../types/index.js';

const createProviderSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
});

export default async function providerRoutes(fastify: FastifyInstance) {
  fastify.post(
    '/providers',
    { preValidation: [fastify.authenticate, fastify.requireRole(['SUPER_USER'])] },
    async (request) => {
      const data = parseBody(createProviderSchema)(request.body);
      const userPayload = request.user as UserPayload;

      if (!userPayload.tenantId) {
        throw new ForbiddenError('User must belong to a tenant to invite providers');
      }

      const existing = await prisma.user.findUnique({
        where: { email: data.email },
      });

      if (existing) {
        throw new ConflictError('Email already registered');
      }

      const passwordHash = await bcrypt.hash(data.password, 12);

      const provider = await prisma.user.create({
        data: {
          email: data.email,
          passwordHash,
          firstName: data.firstName,
          lastName: data.lastName,
          role: 'PROVIDER',
          tenantId: userPayload.tenantId,
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          tenantId: true,
          isActive: true,
          createdAt: true,
        },
      });

      return { provider };
    }
  );

  fastify.get(
    '/providers',
    { preValidation: [fastify.authenticate] },
    async (request) => {
      const userPayload = request.user as UserPayload;

      if (!userPayload.tenantId) {
        throw new ForbiddenError('User must belong to a tenant');
      }

      const providers = await prisma.user.findMany({
        where: {
          tenantId: userPayload.tenantId,
          role: 'PROVIDER',
          isActive: true,
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
}
