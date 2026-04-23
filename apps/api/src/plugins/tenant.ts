import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { UserPayload } from '../types/index.js';

export default fp(async function tenantPlugin(fastify: FastifyInstance) {
  fastify.addHook('preHandler', async function (request: FastifyRequest) {
    const user = request.user as UserPayload | undefined;
    if (user) {
      request.tenantId = user.tenantId;
    }
  });
}, { name: 'tenant' });
