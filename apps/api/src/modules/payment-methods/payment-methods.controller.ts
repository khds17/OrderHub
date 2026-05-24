import type { FastifyReply, FastifyRequest } from 'fastify';
import type { SavePaymentMethodInput } from '@orderhub/contracts';
import { UnauthorizedError } from '../../utils/errors.js';
import type { PaymentMethodsService } from './payment-methods.service.js';

export class PaymentMethodsController {
  constructor(private readonly service: PaymentMethodsService) {}

  getMine = async (req: FastifyRequest) => {
    const claims = req.user;
    if (!claims) throw new UnauthorizedError('Not authenticated');
    const paymentMethod = await this.service.getMine(claims.sub);
    // Always wrap in the envelope so the client can read `data.paymentMethod`
    // regardless of whether a card is saved. `null` is the no-card signal.
    return { status: 'success', data: { paymentMethod } };
  };

  save = async (
    req: FastifyRequest<{ Body: SavePaymentMethodInput }>,
  ) => {
    const claims = req.user;
    if (!claims) throw new UnauthorizedError('Not authenticated');
    const paymentMethod = await this.service.saveMine(claims.sub, req.body);
    return { status: 'success', data: { paymentMethod } };
  };

  delete = async (req: FastifyRequest, reply: FastifyReply) => {
    const claims = req.user;
    if (!claims) throw new UnauthorizedError('Not authenticated');
    await this.service.deleteMine(claims.sub);
    return reply.status(204).send();
  };
}
