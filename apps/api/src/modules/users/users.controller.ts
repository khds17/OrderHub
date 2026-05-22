import type { FastifyRequest } from 'fastify';
import type { UpdateUserInput } from '@orderhub/contracts';
import { UnauthorizedError } from '../../utils/errors.js';
import type { UsersService } from './users.service.js';

export class UsersController {
  constructor(private readonly service: UsersService) {}

  getMe = async (req: FastifyRequest) => {
    const claims = req.user;
    if (!claims) throw new UnauthorizedError('Not authenticated');
    const user = await this.service.getById(claims.sub);
    return { status: 'success', data: { user } };
  };

  updateMe = async (req: FastifyRequest<{ Body: UpdateUserInput }>) => {
    const claims = req.user;
    if (!claims) throw new UnauthorizedError('Not authenticated');
    const user = await this.service.updateMe(claims.sub, req.body);
    return { status: 'success', data: { user } };
  };

  listAll = async () => {
    const users = await this.service.listAll();
    return { status: 'success', data: { users } };
  };

  getById = async (req: FastifyRequest<{ Params: { id: string } }>) => {
    const user = await this.service.getById(req.params.id);
    return { status: 'success', data: { user } };
  };
}
