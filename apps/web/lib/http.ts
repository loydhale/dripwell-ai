import { z } from 'zod';
import { ApiError, publicError } from './errors';

export const privateHeaders = { 'Cache-Control': 'private, no-store, max-age=0', 'Pragma': 'no-cache', 'X-Content-Type-Options': 'nosniff' };

export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: privateHeaders });
}

export function assertOrigin(request: Request): void {
  const origin = request.headers.get('origin');
  if (!origin) throw new ApiError(403, 'Open this action from DripWell.', 'INVALID_ORIGIN');
  const allowed = [process.env.APP_URL, process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`, process.env.VERCEL_BRANCH_URL && `https://${process.env.VERCEL_BRANCH_URL}`].filter(Boolean).map(value => {
    try { return new URL(value!).origin; } catch { return ''; }
  });
  if (process.env.NODE_ENV !== 'production') allowed.push(new URL(request.url).origin);
  if (!allowed.includes(origin)) throw new ApiError(403, 'Open this action from DripWell.', 'INVALID_ORIGIN');
  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'none') {
    throw new ApiError(403, 'Cross-site requests are not permitted.', 'INVALID_ORIGIN');
  }
}

export async function readJson<T extends z.ZodType>(request: Request, schema: T, maximumBytes = 256_000): Promise<z.output<T>> {
  const length = Number(request.headers.get('content-length') ?? 0);
  if (length > maximumBytes) throw new ApiError(413, 'Request is too large.', 'REQUEST_TOO_LARGE');
  if (!request.headers.get('content-type')?.includes('application/json')) throw new ApiError(415, 'Send this request as JSON.', 'INVALID_CONTENT_TYPE');
  const text = await request.text();
  if (Buffer.byteLength(text, 'utf8') > maximumBytes) throw new ApiError(413, 'Request is too large.', 'REQUEST_TOO_LARGE');
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw new ApiError(400, 'Request could not be read.', 'INVALID_JSON'); }
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new ApiError(400, parsed.error.issues.map(issue => `${issue.path.join('.') || 'Request'}: ${issue.message}`).join('; '), 'VALIDATION_ERROR');
  return parsed.data;
}

export function handleError(error: unknown): Response {
  const result = publicError(error);
  return json({ error: result.error, code: result.code }, result.status);
}

export function apiRoute<C = unknown>(handler: (request: Request, context: C) => Promise<Response>, options: { mutation?: boolean } = {}) {
  return async function route(request: Request, context: C): Promise<Response> {
    try {
      if (options.mutation) assertOrigin(request);
      return await handler(request, context);
    } catch (error) { return handleError(error); }
  };
}
