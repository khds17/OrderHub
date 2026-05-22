import type { Pool, PoolClient } from 'pg';
import type { OrderStatus, PaymentStatus } from '@orderhub/contracts';

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
}
