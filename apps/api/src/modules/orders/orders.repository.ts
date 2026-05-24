import type { Pool, PoolClient } from 'pg';
import type { OrderStatus, PaymentStatus } from '@orderhub/contracts';

// Re-export so the service layer doesn't need to import @orderhub/contracts
// just to call the enum-narrowed methods below.
export type { OrderStatus, PaymentStatus };

export type OrderRow = {
  id: string;
  user_id: string;
  status: OrderStatus;
  total: string;
  payment_status: PaymentStatus;
  created_at: Date;
  updated_at: Date;
};

export type OrderItemRow = {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  unit_price: string;
};

export type ProductLockRow = {
  id: string;
  stock: number;
  price: string;
};

const ORDER_COLS = `
  id, user_id, status, total::text AS total,
  payment_status, created_at, updated_at
`;

const ITEM_COLS = `
  id, order_id, product_id, quantity, unit_price::text AS unit_price
`;

export class OrdersRepository {
  constructor(private readonly pool: Pool) {}

  // ── pool-backed reads ────────────────────────────────────────────────────
  async findOrderById(id: string): Promise<OrderRow | null> {
    const { rows } = await this.pool.query<OrderRow>(
      `SELECT ${ORDER_COLS} FROM orders WHERE id = $1`,
      [id],
    );
    return rows[0] ?? null;
  }

  async findOrderItems(orderId: string): Promise<OrderItemRow[]> {
    const { rows } = await this.pool.query<OrderItemRow>(
      `SELECT ${ITEM_COLS} FROM order_items WHERE order_id = $1`,
      [orderId],
    );
    return rows;
  }

  async listUserOrders(
    userId: string,
    page: { limit: number; offset: number },
  ): Promise<OrderRow[]> {
    const { rows } = await this.pool.query<OrderRow>(
      `SELECT ${ORDER_COLS}
       FROM orders
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, page.limit, page.offset],
    );
    return rows;
  }

  async listAllOrders(page: {
    limit: number;
    offset: number;
  }): Promise<OrderRow[]> {
    const { rows } = await this.pool.query<OrderRow>(
      `SELECT ${ORDER_COLS}
       FROM orders
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [page.limit, page.offset],
    );
    return rows;
  }

  // ── transaction-bound writes ─────────────────────────────────────────────
  async findProductsForUpdate(
    client: PoolClient,
    productIds: string[],
  ): Promise<ProductLockRow[]> {
    const { rows } = await client.query<ProductLockRow>(
      `SELECT id, stock, price::text AS price
       FROM products
       WHERE id = ANY($1::uuid[])
       FOR UPDATE`,
      [productIds],
    );
    return rows;
  }

  async createOrder(
    client: PoolClient,
    input: { userId: string; total: string },
  ): Promise<OrderRow> {
    const { rows } = await client.query<OrderRow>(
      `INSERT INTO orders (user_id, total)
       VALUES ($1, $2)
       RETURNING ${ORDER_COLS}`,
      [input.userId, input.total],
    );
    const row = rows[0];
    if (!row) throw new Error('createOrder: no row returned');
    return row;
  }

  async createOrderItems(
    client: PoolClient,
    orderId: string,
    items: ReadonlyArray<{
      productId: string;
      quantity: number;
      unitPrice: string;
    }>,
  ): Promise<OrderItemRow[]> {
    if (items.length === 0) return [];
    const valuesSql: string[] = [];
    const params: unknown[] = [orderId];
    let i = 2;
    for (const item of items) {
      valuesSql.push(`($1, $${i++}, $${i++}, $${i++})`);
      params.push(item.productId, item.quantity, item.unitPrice);
    }
    const { rows } = await client.query<OrderItemRow>(
      `INSERT INTO order_items (order_id, product_id, quantity, unit_price)
       VALUES ${valuesSql.join(', ')}
       RETURNING ${ITEM_COLS}`,
      params,
    );
    return rows;
  }

  async decrementStock(
    client: PoolClient,
    productId: string,
    quantity: number,
  ): Promise<void> {
    await client.query(
      `UPDATE products
       SET stock = stock - $2, updated_at = now()
       WHERE id = $1`,
      [productId, quantity],
    );
  }

  async findOrderForUpdate(
    client: PoolClient,
    id: string,
  ): Promise<OrderRow | null> {
    const { rows } = await client.query<OrderRow>(
      `SELECT ${ORDER_COLS} FROM orders WHERE id = $1 FOR UPDATE`,
      [id],
    );
    return rows[0] ?? null;
  }

  async findOrderItemsTx(
    client: PoolClient,
    orderId: string,
  ): Promise<OrderItemRow[]> {
    const { rows } = await client.query<OrderItemRow>(
      `SELECT ${ITEM_COLS} FROM order_items WHERE order_id = $1`,
      [orderId],
    );
    return rows;
  }

  async updateOrderStatus(
    client: PoolClient,
    id: string,
    status: OrderStatus,
  ): Promise<OrderRow> {
    // Cast the parameter to order_status; pg sends params as text and Postgres
    // will not implicitly coerce text to an enum on UPDATE.
    const { rows } = await client.query<OrderRow>(
      `UPDATE orders
       SET status = $2::order_status, updated_at = now()
       WHERE id = $1
       RETURNING ${ORDER_COLS}`,
      [id, status],
    );
    const row = rows[0];
    if (!row) throw new Error('updateOrderStatus: no row returned');
    return row;
  }

  async restoreStock(
    client: PoolClient,
    productId: string,
    quantity: number,
  ): Promise<void> {
    await client.query(
      `UPDATE products
       SET stock = stock + $2, updated_at = now()
       WHERE id = $1`,
      [productId, quantity],
    );
  }

  /**
   * Mark an order as paid in a single statement: payment_status → PAID and
   * order status → CONFIRMED, with their enum casts. Atomic by design so the
   * two columns can never diverge mid-update.
   */
  async markOrderPaid(client: PoolClient, id: string): Promise<OrderRow> {
    const { rows } = await client.query<OrderRow>(
      `UPDATE orders
       SET status = 'CONFIRMED'::order_status,
           payment_status = 'PAID'::payment_status,
           updated_at = now()
       WHERE id = $1
       RETURNING ${ORDER_COLS}`,
      [id],
    );
    const row = rows[0];
    if (!row) throw new Error('markOrderPaid: no row returned');
    return row;
  }

  /**
   * Record a declined payment attempt. The order status stays PENDING so the
   * customer can retry; only payment_status flips to FAILED.
   */
  async markPaymentFailed(client: PoolClient, id: string): Promise<OrderRow> {
    const { rows } = await client.query<OrderRow>(
      `UPDATE orders
       SET payment_status = 'FAILED'::payment_status,
           updated_at = now()
       WHERE id = $1
       RETURNING ${ORDER_COLS}`,
      [id],
    );
    const row = rows[0];
    if (!row) throw new Error('markPaymentFailed: no row returned');
    return row;
  }
}
