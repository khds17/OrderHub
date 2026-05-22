import type { FastifyInstance } from 'fastify';
import {
  LoginSchema,
  RefreshSchema,
  RegisterSchema,
  type LoginInput,
  type RefreshInput,
  type RegisterInput,
} from '@orderhub/contracts';
import { validate } from '../../middleware/validate.js';
import type { AuthController } from './auth.controller.js';

export function registerAuthRoutes(
  app: FastifyInstance,
  controller: AuthController,
): void {
  // Force no-store on every auth response — including validation errors,
  // which never reach the controller. Headers set inside the controller
  // would miss those paths.
  app.addHook('onSend', async (req, reply) => {
    if (req.url.startsWith('/auth/')) {
      reply.header('Cache-Control', 'no-store');
    }
  });

  app.post<{ Body: RegisterInput }>(
    '/auth/register',
    { preHandler: validate({ body: RegisterSchema }) },
    controller.register,
  );
  app.post<{ Body: LoginInput }>(
    '/auth/login',
    { preHandler: validate({ body: LoginSchema }) },
    controller.login,
  );
  app.post<{ Body: RefreshInput }>(
    '/auth/refresh',
    { preHandler: validate({ body: RefreshSchema }) },
    controller.refresh,
  );
  app.post<{ Body: RefreshInput }>(
    '/auth/logout',
    { preHandler: validate({ body: RefreshSchema }) },
    controller.logout,
  );
}
