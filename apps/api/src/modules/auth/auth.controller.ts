import type { FastifyReply, FastifyRequest } from 'fastify';
import type { LoginInput, RefreshInput, RegisterInput } from '@orderhub/contracts';
import type { AuthService } from './auth.service.js';

// `Cache-Control: no-store` is set by an onSend hook registered in
// auth.routes.ts so it applies to validation-error responses too.
export class AuthController {
  constructor(private readonly service: AuthService) {}

  register = async (
    req: FastifyRequest<{ Body: RegisterInput }>,
    reply: FastifyReply,
  ) => {
    const result = await this.service.register(req.body);
    return reply.status(201).send({ status: 'success', data: result });
  };

  login = async (req: FastifyRequest<{ Body: LoginInput }>) => {
    const result = await this.service.login(req.body);
    return { status: 'success', data: result };
  };

  refresh = async (req: FastifyRequest<{ Body: RefreshInput }>) => {
    const tokens = await this.service.refresh(req.body.refreshToken);
    return { status: 'success', data: { tokens } };
  };

  logout = async (
    req: FastifyRequest<{ Body: RefreshInput }>,
    reply: FastifyReply,
  ) => {
    await this.service.logout(req.body.refreshToken);
    return reply.status(204).send();
  };
}
