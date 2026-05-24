import type { FastifyReply, FastifyRequest } from 'fastify';
import type {
  CreateProductInput,
  UpdateProductInput,
} from '@orderhub/contracts';
import { ForbiddenError } from '../../utils/errors.js';
import type { ProductsService } from './products.service.js';

export class ProductsController {
  constructor(private readonly service: ProductsService) {}

  list = async (
    req: FastifyRequest<{
      Querystring: {
        q?: string;
        limit?: number;
        offset?: number;
        includeInactive?: boolean;
      };
    }>,
  ) => {
    const includeInactive = req.query.includeInactive === true;
    if (includeInactive && req.user?.role !== 'ADMIN') {
      throw new ForbiddenError(
        'includeInactive=true requires ADMIN',
        'ADMIN_ONLY_QUERY',
      );
    }
    const result = await this.service.list({
      q: req.query.q,
      limit: req.query.limit,
      offset: req.query.offset,
      includeInactive,
    });
    return { status: 'success', data: result };
  };

  getOne = async (req: FastifyRequest<{ Params: { idOrSlug: string } }>) => {
    const product = await this.service.getByIdOrSlug(req.params.idOrSlug);
    return { status: 'success', data: { product } };
  };

  create = async (
    req: FastifyRequest<{ Body: CreateProductInput }>,
    reply: FastifyReply,
  ) => {
    const product = await this.service.create(req.body);
    return reply.status(201).send({ status: 'success', data: { product } });
  };

  update = async (
    req: FastifyRequest<{ Params: { id: string }; Body: UpdateProductInput }>,
  ) => {
    const product = await this.service.update(req.params.id, req.body);
    return { status: 'success', data: { product } };
  };

  deactivate = async (req: FastifyRequest<{ Params: { id: string } }>) => {
    const product = await this.service.deactivate(req.params.id);
    return { status: 'success', data: { product } };
  };

  activate = async (req: FastifyRequest<{ Params: { id: string } }>) => {
    const product = await this.service.activate(req.params.id);
    return { status: 'success', data: { product } };
  };
}
