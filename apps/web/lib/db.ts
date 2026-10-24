import { PrismaClient } from '@prisma/client';
import { ApiError } from './errors';

const globalDatabase = globalThis as unknown as { dripwellDatabase?: PrismaClient };
let database: PrismaClient | undefined;

export function getDb(): PrismaClient {
  if (database) return database;
  const url = process.env.DATABASE_URL;
  if (!url || !/^postgres(?:ql)?:\/\//.test(url)) {
    throw new ApiError(503, 'Database connection is not configured.', 'DATABASE_UNAVAILABLE');
  }
  database = globalDatabase.dripwellDatabase ?? new PrismaClient({ log: [] });
  if (process.env.NODE_ENV !== 'production') globalDatabase.dripwellDatabase = database;
  return database;
}
