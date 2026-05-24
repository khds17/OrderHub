import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  CreateProductSchema,
  ProductListQuerySchema,
  UpdateProductSchema,
  type CreateProductInput,
  type UpdateProductInput,
} from '@orderhub/contracts';
import {
  authenticate,
  authorize,
  optionalAuthenticate,
} from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import type { ProductsController } from './products.controller.js';

const IdParamSchema = z.object({ id: z.string().uuid() });
const IdOrSlugParamSchema = z.object({ idOrSlug: z.string().min(1) });

export function registerProductsRoutes(
  app: FastifyInstance,
  controller: ProductsController,
): void {
  app.get<{
    Querystring: {
      q?: string;
      limit?: number;
      offset?: number;
      includeInactive?: boolean;
    };
  }>(
    '/products',
    {
      preHandler: [
        optionalAuthenticate,
        validate({ query: ProductListQuerySchema }),
      ],
    },
    controller.list,
  );

  app.get<{ Params: { idOrSlug: string } }>(
    '/products/:idOrSlug',
    { preHandler: validate({ params: IdOrSlugParamSchema }) },
    controller.getOne,
  );

  app.post<{ Body: CreateProductInput }>(
    '/products',
    {
      preHandler: [
        authenticate,
        authorize('ADMIN'),
        validate({ body: CreateProductSchema }),
      ],
    },
    controller.create,
  );

  app.patch<{ Params: { id: string }; Body: UpdateProductInput }>(
    '/products/:id',
    {
      preHandler: [
        authenticate,
        authorize('ADMIN'),
        validate({ params: IdParamSchema, body: UpdateProductSchema }),
      ],
    },
    controller.update,
  );

  app.patch<{ Params: { id: string } }>(
    '/products/:id/deactivate',
    {
      preHandler: [
        authenticate,
        authorize('ADMIN'),
        validate({ params: IdParamSchema }),
      ],
    },
    controller.deactivate,
  );

  app.patch<{ Params: { id: string } }>(
    '/products/:id/activate',
    {
      preHandler: [
        authenticate,
        authorize('ADMIN'),
        validate({ params: IdParamSchema }),
      ],
    },
    controller.activate,
  );
}
