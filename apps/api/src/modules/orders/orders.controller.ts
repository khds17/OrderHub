import type { FastifyReply, FastifyRequest } from 'fastify';
import type { CreateOrderInput } from '@orderhub/contracts';
import { UnauthorizedError } from '../../utils/errors.js';
import type { OrdersService } from './orders.service.js';

export class OrdersController {
  constructor(private readonly service: OrdersService) {}

  create = async (
    req: FastifyRequest<{ Body: CreateOrderInput }>,
    reply: FastifyReply,
  ) => {
    const user = requireUser(req);
    const order = await this.service.createOrder(user.sub, req.body.items);
    return reply.status(201).send({ status: 'success', data: { order } });
  };

  listMine = async (
    req: FastifyRequest<{
      Querystring: { limit?: number; offset?: number };
    }>,
  ) => {
    const user = requireUser(req);
    const page = readPagination(req.query);
    const orders = await this.service.listMyOrders(user.sub, page);
    return {
      status: 'success',
      data: { orders, pagination: page },
    };
  };

  listAll = async (
    req: FastifyRequest<{
      Querystring: { limit?: number; offset?: number };
    }>,
  ) => {
    const page = readPagination(req.query);
    const orders = await this.service.listAllOrders(page);
    return {
      status: 'success',
      data: { orders, pagination: page },
    };
  };

  getOne = async (req: FastifyRequest<{ Params: { id: string } }>) => {
    const user = requireUser(req);
    const order = await this.service.getOrderById(
      req.params.id,
      user.sub,
      user.role,
    );
    return { status: 'success', data: { order } };
  };
}

function requireUser(req: FastifyRequest) {
  if (!req.user) {
    throw new UnauthorizedError('Not authenticated');
  }
  return req.user;
}

function readPagination(query: {
  limit?: number;
  offset?: number;
}): { limit: number; offset: number } {
  // Defaults; the Zod schema in the route already clamps these to safe ranges.
  return {
    limit: query.limit ?? 20,
    offset: query.offset ?? 0,
  };
}
