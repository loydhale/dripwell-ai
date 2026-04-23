import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import { ApiError, ValidationError, UnauthorizedError, ForbiddenError, NotFoundError, ConflictError, ServiceUnavailableError } from '../lib/errors.js';

export default fp(async function errorHandlerPlugin(fastify: FastifyInstance) {
  fastify.setErrorHandler((error, _request, reply) => {
    if (error instanceof ValidationError) {
      reply.status(error.statusCode);
      return { error: error.message, code: error.code, details: error.details };
    }

    if (error instanceof UnauthorizedError) {
      reply.status(error.statusCode);
      return { error: error.message, code: error.code };
    }

    if (error instanceof ForbiddenError) {
      reply.status(error.statusCode);
      return { error: error.message, code: error.code };
    }

    if (error instanceof NotFoundError) {
      reply.status(error.statusCode);
      return { error: error.message, code: error.code };
    }

    if (error instanceof ConflictError) {
      reply.status(error.statusCode);
      return { error: error.message, code: error.code };
    }

    if (error instanceof ServiceUnavailableError) {
      reply.status(error.statusCode);
      return { error: error.message, code: error.code };
    }

    if (error instanceof ApiError) {
      reply.status(error.statusCode);
      return { error: error.message, code: error.code, details: error.details };
    }

    fastify.log.error(error);

    reply.status(500);
    return { error: 'Internal server error', code: 'INTERNAL_ERROR' };
  });
}, { name: 'error-handler' });
