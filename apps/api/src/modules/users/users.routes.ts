import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  UpdateUserSchema,
  type UpdateUserInput,
} from '@orderhub/contracts';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import type { UsersController } from './users.controller.js';

const IdParamSchema = z.object({ id: z.string().uuid() });

export function registerUsersRoutes(
  app: FastifyInstance,
  controller: UsersController,
): void {
  app.get(
    '/users/me',
    { preHandler: [authenticate] },
    controller.getMe,
  );

  app.patch<{ Body: UpdateUserInput }>(
    '/users/me',
    {
      preHandler: [
        authenticate,
        validate({ body: UpdateUserSchema }),
      ],
    },
    controller.updateMe,
  );

  app.get(
    '/users',
    { preHandler: [authenticate, authorize('ADMIN')] },
    controller.listAll,
  );

  app.get<{ Params: { id: string } }>(
    '/users/:id',
    {
      preHandler: [
        authenticate,
        authorize('ADMIN', 'SUPPORT'),
        validate({ params: IdParamSchema }),
      ],
    },
    controller.getById,
  );
}
