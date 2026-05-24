import type { FastifyInstance } from 'fastify';
import {
  SavePaymentMethodSchema,
  type SavePaymentMethodInput,
} from '@orderhub/contracts';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import type { PaymentMethodsController } from './payment-methods.controller.js';

export function registerPaymentMethodsRoutes(
  app: FastifyInstance,
  controller: PaymentMethodsController,
): void {
  // Mounted under /users/me/... because the saved card is a "thing about me"
  // — keeps the URL consistent with /users/me and /users/me (PATCH).
  app.get(
    '/users/me/payment-method',
    { preHandler: [authenticate, authorize('CLIENT')] },
    controller.getMine,
  );

  app.put<{ Body: SavePaymentMethodInput }>(
    '/users/me/payment-method',
    {
      preHandler: [
        authenticate,
        authorize('CLIENT'),
        validate({ body: SavePaymentMethodSchema }),
      ],
    },
    controller.save,
  );

  app.delete(
    '/users/me/payment-method',
    { preHandler: [authenticate, authorize('CLIENT')] },
    controller.delete,
  );
}
