import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';

export class ApiError extends Error {
  constructor(public readonly status: number, message: string, public readonly code = 'REQUEST_FAILED') {
    super(message);
    this.name = 'ApiError';
  }
}

export function publicError(error: unknown): { status: number; error: string; code: string } {
  if (error instanceof ApiError) return { status: error.status, error: error.message, code: error.code };
  if (error instanceof ZodError) return { status: 400, error: 'Some request fields are invalid.', code: 'VALIDATION_ERROR' };
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') return { status: 409, error: 'A record with these details already exists.', code: 'CONFLICT' };
    if (error.code === 'P2025') return { status: 404, error: 'The requested record was not found.', code: 'NOT_FOUND' };
    if (error.code === 'P2034') return { status: 409, error: 'This record changed. Refresh and try again.', code: 'CONCURRENT_CHANGE' };
  }
  return { status: 500, error: 'The request could not be completed. Please try again.', code: 'INTERNAL_ERROR' };
}
