import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import dotenv from 'dotenv';

import errorHandlerPlugin from './plugins/error-handler.js';
import authPlugin from './plugins/auth.js';
import tenantPlugin from './plugins/tenant.js';

import healthRoutes from './routes/health.js';
import authRoutes from './routes/auth.js';
import tenantRoutes from './routes/tenants.js';
import catalogRoutes from './routes/catalog.js';
import providerRoutes from './routes/providers.js';
import assessmentRoutes from './routes/assessments.js';
import adminRoutes from './routes/admin.js';
import vendorRoutes from './routes/vendor.js';
import feedbackRoutes from './routes/feedback.js';

dotenv.config({ path: new URL('../.env', import.meta.url) });

export async function buildServer() {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
    },
  });

  await app.register(cors, {
    origin: (process.env.CORS_ORIGIN === 'true' || !process.env.CORS_ORIGIN) ? true : process.env.CORS_ORIGIN,
    credentials: true,
  });

  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  await app.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10 MB
      files: 1,
    },
  });

  await app.register(errorHandlerPlugin);
  await app.register(authPlugin);
  await app.register(tenantPlugin);

  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(tenantRoutes);
  await app.register(catalogRoutes);
  await app.register(providerRoutes);
  await app.register(assessmentRoutes);
  await app.register(adminRoutes);
  await app.register(vendorRoutes);
  await app.register(feedbackRoutes);

  return app;
}
