import type { FastifyRequest } from 'fastify';
import type { ZodSchema } from 'zod';
import { ValidationError } from '../utils/errors.js';

type Schemas = {
  body?: ZodSchema;
  params?: ZodSchema;
  query?: ZodSchema;
};

export function validate(schemas: Schemas) {
  return async (req: FastifyRequest): Promise<void> => {
    if (schemas.body) {
      const result = schemas.body.safeParse(req.body);
      if (!result.success) {
        throw new ValidationError(
          result.error.errors.map((e) => ({
            field: ['body', ...e.path.map(String)].filter(Boolean).join('.'),
            message: e.message,
          })),
        );
      }
      req.body = result.data;
    }
    if (schemas.params) {
      const result = schemas.params.safeParse(req.params);
      if (!result.success) {
        throw new ValidationError(
          result.error.errors.map((e) => ({
            field: ['params', ...e.path.map(String)].filter(Boolean).join('.'),
            message: e.message,
          })),
        );
      }
      req.params = result.data;
    }
    if (schemas.query) {
      const result = schemas.query.safeParse(req.query);
      if (!result.success) {
        throw new ValidationError(
          result.error.errors.map((e) => ({
            field: ['query', ...e.path.map(String)].filter(Boolean).join('.'),
            message: e.message,
          })),
        );
      }
      req.query = result.data;
    }
  };
}
