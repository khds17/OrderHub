import type { FastifyInstance, FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { AppError, type ErrorDetail } from '../utils/errors.js';
import { env } from '../config/env.js';

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((err: FastifyError, req: FastifyRequest, reply: FastifyReply) => {
    if (err instanceof AppError) {
      return reply.status(err.statusCode).send({
        status: 'error',
        code: err.code,
        message: err.message,
        ...(err.details ? { errors: err.details } : {}),
      });
    }

    if (err instanceof ZodError) {
      const details: ErrorDetail[] = err.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      return reply.status(400).send({
        status: 'error',
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        errors: details,
      });
    }

    // Fastify's JSON-schema validation errors land here with err.validation set.
    if (err.validation) {
      const details: ErrorDetail[] = err.validation.map((v) => ({
        field:
          v.instancePath ||
          (v.params && typeof v.params['missingProperty'] === 'string'
            ? String(v.params['missingProperty'])
            : ''),
        message: v.message ?? 'invalid',
      }));
      return reply.status(400).send({
        status: 'error',
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        errors: details,
      });
    }

    req.log.error({ err }, 'Unhandled error');
    return reply.status(500).send({
      status: 'error',
      code: 'INTERNAL_ERROR',
      message:
        env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
    });
  });
}
