import { createHash } from 'node:crypto';
import { getDb } from './db';
import { ApiError } from './errors';

export function requestIdentity(request: Request): string {
  const trustedAddress = process.env.VERCEL ? request.headers.get('x-vercel-forwarded-for') : process.env.NODE_ENV !== 'production' ? request.headers.get('x-forwarded-for') : null;
  return createHash('sha256').update(trustedAddress?.split(',')[0]?.trim() || 'unidentified').digest('hex');
}

export async function rateLimit(key: string, options: { limit: number; windowMs: number }): Promise<void> {
  const hash = createHash('sha256').update(key).digest('hex');
  const cutoff = new Date(Date.now() - options.windowMs);
  const rows = await getDb().$queryRaw<Array<{ count: number }>>`
    INSERT INTO "RateLimitBucket" ("key", "windowStart", "count") VALUES (${hash}, NOW(), 1)
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimitBucket"."windowStart" < ${cutoff} THEN 1 ELSE "RateLimitBucket"."count" + 1 END,
      "windowStart" = CASE WHEN "RateLimitBucket"."windowStart" < ${cutoff} THEN NOW() ELSE "RateLimitBucket"."windowStart" END
    RETURNING "count"
  `;
  if (!rows[0] || rows[0].count > options.limit) throw new ApiError(429, 'Too many attempts. Please try again later.', 'RATE_LIMITED');
}
