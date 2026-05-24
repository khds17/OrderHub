import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  CreateOrderSchema,
  PayOrderSchema,
  type CreateOrderInput,
  type PayOrderInput,
} from '@orderhub/contracts';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import type { OrdersController } from './orders.controller.js';

const IdParamSchema = z.object({ id: z.string().uuid() });

const PaginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export function registerOrdersRoutes(
  app: FastifyInstance,
  controller: OrdersController,
): void {
  app.post<{ Body: CreateOrderInput }>(
    '/orders',
    {
      preHandler: [
        authenticate,
        authorize('CLIENT'),
        validate({ body: CreateOrderSchema }),
      ],
    },
    controller.create,
  );

  // Static segment must register before /orders/:id so it wins the match.
  app.get<{ Querystring: { limit?: number; offset?: number } }>(
    '/orders/me',
    {
      preHandler: [
        authenticate,
        authorize('CLIENT'),
        validate({ query: PaginationQuerySchema }),
      ],
    },
    controller.listMine,
  );

  app.get<{ Querystring: { limit?: number; offset?: number } }>(
    '/orders',
    {
      preHandler: [
        authenticate,
        authorize('ADMIN', 'SUPPORT'),
        validate({ query: PaginationQuerySchema }),
      ],
    },
    controller.listAll,
  );

  app.get<{ Params: { id: string } }>(
    '/orders/:id',
    {
      preHandler: [
        authenticate,
        authorize('CLIENT', 'ADMIN', 'SUPPORT'),
        validate({ params: IdParamSchema }),
      ],
    },
    controller.getOne,
  );

  app.post<{ Params: { id: string } }>(
    '/orders/:id/cancel',
    {
      preHandler: [
        authenticate,
        authorize('CLIENT', 'ADMIN', 'SUPPORT'),
        validate({ params: IdParamSchema }),
      ],
    },
    controller.cancel,
  );

  app.post<{ Params: { id: string }; Body: PayOrderInput }>(
    '/orders/:id/pay',
    {
      preHandler: [
        authenticate,
        // Payment is the customer's action. The service layer also enforces
        // ownership; the role gate here is the first line of defence.
        authorize('CLIENT'),
        validate({ params: IdParamSchema, body: PayOrderSchema }),
      ],
    },
    controller.pay,
  );
}
