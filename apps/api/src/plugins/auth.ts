import fp from 'fastify-plugin';
import jwt from '@fastify/jwt';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { UnauthorizedError, ForbiddenError } from '../lib/errors.js';
import type { UserPayload } from '../types/index.js';

export default fp(async function authPlugin(fastify: FastifyInstance) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required');
  }

  await fastify.register(jwt, {
    secret,
    sign: {
      expiresIn: '7d',
    },
  });

  fastify.decorate('authenticate', async function authenticate(request: FastifyRequest, _reply: FastifyReply) {
    try {
      await request.jwtVerify();
      const payload = request.user as Record<string, unknown>;
      if (payload.impersonatedBy) {
        request.user = {
          userId: payload.userId,
          role: payload.role,
          tenantId: payload.tenantId,
          impersonatedBy: payload.impersonatedBy,
        } as UserPayload;
      }
    } catch {
      throw new UnauthorizedError();
    }
  });

  fastify.decorate('requireRole', function requireRole(roles: string[]) {
    return async function roleGuard(request: FastifyRequest, _reply: FastifyReply) {
      const user = request.user as UserPayload | undefined;
      if (!user || !roles.includes(user.role)) {
        throw new ForbiddenError();
      }
    };
  });
}, { name: 'auth' });
