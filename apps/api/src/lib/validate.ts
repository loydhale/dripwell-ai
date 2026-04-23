import { z } from 'zod';
import { ValidationError } from './errors.js';

export function parseBody<T extends z.ZodTypeAny>(schema: T) {
  return (body: unknown): z.infer<T> => {
    const result = schema.safeParse(body);
    if (!result.success) {
      throw new ValidationError(result.error.issues);
    }
    return result.data;
  };
}
