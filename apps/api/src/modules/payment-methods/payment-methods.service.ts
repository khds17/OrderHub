import type {
  CardInput,
  PaymentMethod,
} from '@orderhub/contracts';
import { NotFoundError } from '../../utils/errors.js';
import type {
  PaymentMethodRow,
  PaymentMethodsRepository,
} from './payment-methods.repository.js';

export class PaymentMethodsService {
  constructor(private readonly repo: PaymentMethodsRepository) {}

  /** Returns null (not 404) when the user simply hasn't saved a card yet. */
  async getMine(userId: string): Promise<PaymentMethod | null> {
    const row = await this.repo.findByUserId(userId);
    return row ? toPublic(row) : null;
  }

  /**
   * Persist a saved card for the user. The client posts a fake-but-validated
   * full card; we derive `last4` here and never persist PAN/CVV. Holder name
   * and expiry pass through unchanged.
   *
   * Idempotent: calling twice replaces the prior card (UNIQUE(user_id) +
   * ON CONFLICT in the repo).
   */
  async saveMine(userId: string, card: CardInput): Promise<PaymentMethod> {
    const last4 = card.number.slice(-4);
    const row = await this.repo.upsert({
      userId,
      holderName: card.holderName,
      last4,
      expiry: card.expiry,
    });
    return toPublic(row);
  }

  async deleteMine(userId: string): Promise<void> {
    const existed = await this.repo.deleteByUserId(userId);
    if (!existed) {
      // Surface 404 so the client can distinguish "removed" from "wasn't there".
      throw new NotFoundError(
        'PAYMENT_METHOD_NOT_FOUND',
        'No saved card to remove',
      );
    }
  }
}

function toPublic(row: PaymentMethodRow): PaymentMethod {
  return {
    id: row.id,
    holderName: row.holder_name,
    last4: row.last4,
    expiry: row.expiry,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}
