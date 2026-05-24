import path from 'node:path';
import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import { env } from './config/env.js';
import { getPool } from './db/pool.js';
import { registerErrorHandler } from './middleware/error-handler.js';
import { AuthRepository } from './modules/auth/auth.repository.js';
import { AuthService } from './modules/auth/auth.service.js';
import { AuthController } from './modules/auth/auth.controller.js';
import { registerAuthRoutes } from './modules/auth/auth.routes.js';
import { ProductsRepository } from './modules/products/products.repository.js';
import { ProductsService } from './modules/products/products.service.js';
import { ProductsController } from './modules/products/products.controller.js';
import { registerProductsRoutes } from './modules/products/products.routes.js';
import { ProductImagesRepository } from './modules/product-images/product-images.repository.js';
import {
  MAX_UPLOAD_BYTES,
  ProductImagesService,
  UPLOADS_URL_PREFIX,
} from './modules/product-images/product-images.service.js';
import { ProductImagesController } from './modules/product-images/product-images.controller.js';
import { registerProductImagesRoutes } from './modules/product-images/product-images.routes.js';
import { OrdersRepository } from './modules/orders/orders.repository.js';
import { OrdersService } from './modules/orders/orders.service.js';
import { OrdersController } from './modules/orders/orders.controller.js';
import { registerOrdersRoutes } from './modules/orders/orders.routes.js';
import { UsersRepository } from './modules/users/users.repository.js';
import { UsersService } from './modules/users/users.service.js';
import { UsersController } from './modules/users/users.controller.js';
import { registerUsersRoutes } from './modules/users/users.routes.js';
import { PaymentMethodsRepository } from './modules/payment-methods/payment-methods.repository.js';
import { PaymentMethodsService } from './modules/payment-methods/payment-methods.service.js';
import { PaymentMethodsController } from './modules/payment-methods/payment-methods.controller.js';
import { registerPaymentMethodsRoutes } from './modules/payment-methods/payment-methods.routes.js';

/**
 * Where uploaded product images live on disk. `process.cwd()` resolves
 * relative to where the API is started (the `apps/api` dir during
 * `npm run dev`). When containerised this should be a mounted volume.
 */
const UPLOADS_ROOT = path.resolve(process.cwd(), 'uploads');

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === 'production' ? 'info' : 'debug',
      ...(env.NODE_ENV !== 'production' && {
        transport: { target: 'pino-pretty', options: { colorize: true } },
      }),
    },
  });

  await app.register(cors, {
    origin: env.ALLOWED_ORIGINS.split(',').map((s) => s.trim()),
    credentials: true,
  });

  // Multipart for product image uploads. The fileSize limit is also enforced
  // at the service layer so a programmatic caller can't bypass it.
  await app.register(multipart, {
    limits: {
      fileSize: MAX_UPLOAD_BYTES,
      files: 1,
    },
  });

  // Serve uploaded images. `decorateReply: false` because we don't need
  // reply.sendFile() — we only want the implicit GET-by-path behaviour.
  await app.register(fastifyStatic, {
    root: UPLOADS_ROOT,
    prefix: `${UPLOADS_URL_PREFIX}/`,
    decorateReply: false,
  });

  registerErrorHandler(app);

  const pool = getPool();

  const authRepo = new AuthRepository(pool);
  const authService = new AuthService(authRepo, {
    jwtSecret: env.JWT_SECRET,
    jwtRefreshSecret: env.JWT_REFRESH_SECRET,
  });
  const authController = new AuthController(authService);
  registerAuthRoutes(app, authController);

  const productImagesRepo = new ProductImagesRepository(pool);
  const productImagesService = new ProductImagesService(
    productImagesRepo,
    UPLOADS_ROOT,
  );
  const productImagesController = new ProductImagesController(
    productImagesService,
  );
  registerProductImagesRoutes(app, productImagesController);

  const productsRepo = new ProductsRepository(pool);
  // Pass the image service so list/detail responses include images.
  const productsService = new ProductsService(productsRepo, productImagesService);
  const productsController = new ProductsController(productsService);
  registerProductsRoutes(app, productsController);

  const ordersRepo = new OrdersRepository(pool);
  const ordersService = new OrdersService(ordersRepo, pool);
  const ordersController = new OrdersController(ordersService);
  registerOrdersRoutes(app, ordersController);

  const usersRepo = new UsersRepository(pool);
  const usersService = new UsersService(usersRepo);
  const usersController = new UsersController(usersService);
  registerUsersRoutes(app, usersController);

  const paymentMethodsRepo = new PaymentMethodsRepository(pool);
  const paymentMethodsService = new PaymentMethodsService(paymentMethodsRepo);
  const paymentMethodsController = new PaymentMethodsController(
    paymentMethodsService,
  );
  registerPaymentMethodsRoutes(app, paymentMethodsController);

  app.get('/health', async (_req, reply) => {
    try {
      await pool.query('SELECT 1');
      return { status: 'success', data: { db: 'ok' } };
    } catch {
      reply.status(503);
      return {
        status: 'error',
        code: 'DB_UNREACHABLE',
        message: 'Database is unreachable',
      };
    }
  });

  return app;
}
