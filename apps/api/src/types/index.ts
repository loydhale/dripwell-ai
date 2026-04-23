export interface UserPayload {
  userId: string;
  role: string;
  tenantId: string | null;
}

declare module 'fastify' {
  interface FastifyRequest {
    tenantId: string | null;
  }

  interface FastifyInstance {
    authenticate: (request: import('fastify').FastifyRequest, reply: import('fastify').FastifyReply) => Promise<void>;
    requireRole: (roles: string[]) => (request: import('fastify').FastifyRequest, reply: import('fastify').FastifyReply) => Promise<void>;
  }
}
