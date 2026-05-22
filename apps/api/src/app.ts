import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
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
import { OrdersRepository } from './modules/orders/orders.repository.js';
import { OrdersService } from './modules/orders/orders.service.js';
import { OrdersController } from './modules/orders/orders.controller.js';
import { registerOrdersRoutes } from './modules/orders/orders.routes.js';
import { UsersRepository } from './modules/users/users.repository.js';
import { UsersService } from './modules/users/users.service.js';
import { UsersController } from './modules/users/users.controller.js';
import { registerUsersRoutes } from './modules/users/users.routes.js';

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

  registerErrorHandler(app);

  const pool = getPool();

  const authRepo = new AuthRepository(pool);
  const authService = new AuthService(authRepo, {
    jwtSecret: env.JWT_SECRET,
    jwtRefreshSecret: env.JWT_REFRESH_SECRET,
  });
  const authController = new AuthController(authService);
  registerAuthRoutes(app, authController);

  const productsRepo = new ProductsRepository(pool);
  const productsService = new ProductsService(productsRepo);
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
