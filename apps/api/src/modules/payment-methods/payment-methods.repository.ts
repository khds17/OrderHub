import type { Pool } from 'pg';

export type PaymentMethodRow = {
  id: string;
  user_id: string;
  holder_name: string;
  last4: string;
  expiry: string;
  created_at: Date;
  updated_at: Date;
};

const COLS = `id, user_id, holder_name, last4, expiry, created_at, updated_at`;

export class PaymentMethodsRepository {
  constructor(private readonly pool: Pool) {}

  async findByUserId(userId: string): Promise<PaymentMethodRow | null> {
    const { rows } = await this.pool.query<PaymentMethodRow>(
      `SELECT ${COLS} FROM payment_methods WHERE user_id = $1`,
      [userId],
    );
    return rows[0] ?? null;
  }

  /**
   * Upsert the single payment method per user. The UNIQUE(user_id)
   * constraint from migration 004 is what makes ON CONFLICT well-defined.
   */
  async upsert(input: {
    userId: string;
    holderName: string;
    last4: string;
    expiry: string;
  }): Promise<PaymentMethodRow> {
    const { rows } = await this.pool.query<PaymentMethodRow>(
      `INSERT INTO payment_methods (user_id, holder_name, last4, expiry)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id) DO UPDATE
         SET holder_name = EXCLUDED.holder_name,
             last4       = EXCLUDED.last4,
             expiry      = EXCLUDED.expiry,
             updated_at  = now()
       RETURNING ${COLS}`,
      [input.userId, input.holderName, input.last4, input.expiry],
    );
    const row = rows[0];
    if (!row) throw new Error('upsert payment_method: no row returned');
    return row;
  }

  /**
   * @returns true when a row existed and was deleted, false when there was
   * nothing to delete (so callers can return 204 vs. 404 cleanly).
   */
  async deleteByUserId(userId: string): Promise<boolean> {
    const { rowCount } = await this.pool.query(
      `DELETE FROM payment_methods WHERE user_id = $1`,
      [userId],
    );
    return (rowCount ?? 0) > 0;
  }
}
