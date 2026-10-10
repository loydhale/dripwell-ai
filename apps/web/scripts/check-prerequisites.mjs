import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import nextEnvironment from '@next/env';

nextEnvironment.loadEnvConfig(process.cwd(), false);
const expected = ['DATABASE_URL', 'APP_URL', 'AUTH_ENCRYPTION_KEY', 'BLOB_READ_WRITE_TOKEN', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'STRIPE_PRICE_ID', 'RESEND_API_KEY', 'EMAIL_FROM', 'CRON_SECRET'];
const absent = expected.filter(key => !process.env[key]);
if (!process.env.AI_GATEWAY_API_KEY && !process.env.VERCEL_OIDC_TOKEN && process.env.VERCEL !== '1') absent.push('AI_GATEWAY_API_KEY or Vercel project OIDC');
const projectPath = [resolve('.vercel/project.json'), resolve('../../.vercel/project.json')].find(existsSync);
const project = projectPath ? JSON.parse(readFileSync(projectPath, 'utf8')) : null;
console.log(JSON.stringify({ linked: Boolean(project?.projectId && project?.orgId), requiredKeys: expected.length + 1, presentKeys: expected.length + 1 - absent.length, missingKeys: absent, databaseMigrations: 'Run pnpm db:deploy after linkage and environment verification.' }, null, 2));
if (!project || absent.length) process.exitCode = 1;
