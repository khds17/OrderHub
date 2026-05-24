import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import type { ProductImagesController } from './product-images.controller.js';

const ProductIdParamSchema = z.object({ id: z.string().uuid() });
const ProductImageParamSchema = z.object({
  id: z.string().uuid(),
  imageId: z.string().uuid(),
});

export function registerProductImagesRoutes(
  app: FastifyInstance,
  controller: ProductImagesController,
): void {
  // Multipart upload — note: validate({ body }) cannot run here because the
  // body isn't JSON. Param + role gates are the only preHandlers.
  app.post<{ Params: { id: string } }>(
    '/products/:id/images',
    {
      preHandler: [
        authenticate,
        authorize('ADMIN'),
        validate({ params: ProductIdParamSchema }),
      ],
    },
    controller.upload,
  );

  app.delete<{ Params: { id: string; imageId: string } }>(
    '/products/:id/images/:imageId',
    {
      preHandler: [
        authenticate,
        authorize('ADMIN'),
        validate({ params: ProductImageParamSchema }),
      ],
    },
    controller.delete,
  );
}
