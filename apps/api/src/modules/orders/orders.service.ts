import type { Pool } from 'pg';
import type {
  CardInput,
  CreateOrderItemInput,
  Order,
  OrderItem,
  OrderWithItems,
  UserRole,
} from '@orderhub/contracts';
import { TEST_CARDS } from '@orderhub/contracts';
import { withTransaction } from '../../db/transaction.js';
import {
  AppError,
  ConflictError,
  NotFoundError,
} from '../../utils/errors.js';
import {
  calculateOrderTotal,
  findDuplicateProductIds,
} from './orders.utils.js';
import type {
  OrderItemRow,
  OrderRow,
  OrdersRepository,
} from './orders.repository.js';

export class OrdersService {
  constructor(
    private readonly repo: OrdersRepository,
    private readonly pool: Pool,
  ) {}

  async createOrder(
    userId: string,
    items: ReadonlyArray<CreateOrderItemInput>,
  ): Promise<OrderWithItems> {
    const duplicates = findDuplicateProductIds(items);
    if (duplicates.length > 0) {
      throw new AppError(
        400,
        'DUPLICATE_PRODUCT_ID',
        'Each productId may appear at most once per order',
        duplicates.map((id) => ({
          field: 'items',
          message: `duplicate productId: ${id}`,
        })),
      );
    }

    const { order, orderItems } = await withTransaction(
      this.pool,
      async (client) => {
        const productIds = items.map((i) => i.productId);
        const products = await this.repo.findProductsForUpdate(
          client,
          productIds,
        );

        const productById = new Map(products.map((p) => [p.id, p]));
        const missing = productIds.filter((id) => !productById.has(id));
        if (missing.length > 0) {
          throw new NotFoundError(
            'PRODUCT_NOT_FOUND',
            'One or more products were not found',
          );
        }

        const stockViolations = items
          .map((item) => {
            const p = productById.get(item.productId)!;
            return p.stock < item.quantity
              ? { productId: item.productId, requested: item.quantity, available: p.stock }
              : null;
          })
          .filter(
            (v): v is { productId: string; requested: number; available: number } =>
              v !== null,
          );

        if (stockViolations.length > 0) {
          throw new ConflictError(
            'INSUFFICIENT_STOCK',
            'Insufficient stock for one or more products',
            stockViolations.map((v) => ({
              field: `items.${v.productId}`,
              message: `requested ${v.requested}, available ${v.available}`,
            })),
          );
        }

        const pricesByProductId: Record<string, string> = {};
        for (const p of products) pricesByProductId[p.id] = p.price;

        const total = calculateOrderTotal(items, pricesByProductId);

        const orderRow = await this.repo.createOrder(client, { userId, total });

        const itemRows = await this.repo.createOrderItems(
          client,
          orderRow.id,
          items.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
            unitPrice: pricesByProductId[i.productId]!,
          })),
        );

        for (const item of items) {
          await this.repo.decrementStock(client, item.productId, item.quantity);
        }

        return { order: orderRow, orderItems: itemRows };
      },
    );

    return {
      ...toPublicOrder(order),
      items: orderItems.map(toPublicItem),
    };
  }

  async listMyOrders(
    userId: string,
    page: { limit: number; offset: number },
  ): Promise<Order[]> {
    const rows = await this.repo.listUserOrders(userId, page);
    return rows.map(toPublicOrder);
  }

  async listAllOrders(page: {
    limit: number;
    offset: number;
  }): Promise<Order[]> {
    const rows = await this.repo.listAllOrders(page);
    return rows.map(toPublicOrder);
  }

  async getOrderById(
    orderId: string,
    requesterId: string,
    requesterRole: UserRole,
  ): Promise<OrderWithItems> {
    const order = await this.repo.findOrderById(orderId);
    if (!order) {
      throw new NotFoundError('ORDER_NOT_FOUND', 'Order not found');
    }
    if (requesterRole === 'CLIENT' && order.user_id !== requesterId) {
      // Hide existence from non-owner clients to avoid leaking IDs.
      throw new NotFoundError('ORDER_NOT_FOUND', 'Order not found');
    }
    const items = await this.repo.findOrderItems(orderId);
    return {
      ...toPublicOrder(order),
      items: items.map(toPublicItem),
    };
  }

  /**
   * Cancel an order and restore stock for each line item, atomically.
   *
   * Rules:
   *   - Allowed source statuses: PENDING, CONFIRMED.
   *   - SHIPPED → 409 ORDER_NOT_CANCELLABLE (too late to cancel).
   *   - CANCELLED → 409 ORDER_ALREADY_CANCELLED (idempotency signal).
   *   - CLIENT may only cancel their own orders; mismatch surfaces as 404 to
   *     avoid leaking order IDs (mirrors getOrderById).
   *   - ADMIN / SUPPORT may cancel any cancellable order.
   *
   * The order row is locked FOR UPDATE so concurrent cancel attempts serialize:
   * the second caller sees status=CANCELLED and gets ORDER_ALREADY_CANCELLED
   * rather than double-restoring stock.
   */
  async cancelOrder(
    orderId: string,
    requesterId: string,
    requesterRole: UserRole,
  ): Promise<OrderWithItems> {
    return await withTransaction(this.pool, async (client) => {
      const order = await this.repo.findOrderForUpdate(client, orderId);
      if (!order) {
        throw new NotFoundError('ORDER_NOT_FOUND', 'Order not found');
      }
      if (requesterRole === 'CLIENT' && order.user_id !== requesterId) {
        throw new NotFoundError('ORDER_NOT_FOUND', 'Order not found');
      }
      if (order.status === 'CANCELLED') {
        throw new ConflictError(
          'ORDER_ALREADY_CANCELLED',
          'Order is already cancelled',
        );
      }
      if (order.status === 'SHIPPED') {
        throw new ConflictError(
          'ORDER_NOT_CANCELLABLE',
          'Shipped orders cannot be cancelled',
        );
      }
      // Remaining allowed source statuses: PENDING, CONFIRMED.

      const items = await this.repo.findOrderItemsTx(client, orderId);

      for (const item of items) {
        await this.repo.restoreStock(client, item.product_id, item.quantity);
      }

      const updated = await this.repo.updateOrderStatus(
        client,
        orderId,
        'CANCELLED',
      );

      return {
        ...toPublicOrder(updated),
        items: items.map(toPublicItem),
      };
    });
  }

  /**
   * Pay for an order using a fake card. There is no real processor — the
   * "decision" comes from inspecting the PAN against TEST_CARDS.
   *
   * Rules:
   *   - Only the order owner may pay (admins/support are deliberately blocked;
   *     payment is the customer's action). CLIENT non-owner surfaces as 404 to
   *     avoid leaking order IDs.
   *   - Order must be in status PENDING (CONFIRMED/SHIPPED/CANCELLED are 409).
   *   - payment_status must not be PAID (409 ORDER_ALREADY_PAID). A previous
   *     FAILED attempt is allowed — the customer may retry with a different
   *     card.
   *   - On decline: payment_status flips to FAILED, status stays PENDING, and
   *     the call surfaces as 402 PAYMENT_DECLINED. The FAILED write is
   *     committed (returned from inside the transaction as a sentinel) before
   *     the error is thrown so the row reflects the attempt.
   *   - On success: status → CONFIRMED, payment_status → PAID, atomically.
   */
  async payOrder(
    orderId: string,
    requesterId: string,
    requesterRole: UserRole,
    card: CardInput,
  ): Promise<OrderWithItems> {
    type PayOutcome =
      | { kind: 'paid'; result: OrderWithItems }
      | { kind: 'declined' };

    const outcome: PayOutcome = await withTransaction(this.pool, async (client) => {
      const order = await this.repo.findOrderForUpdate(client, orderId);
      if (!order) {
        throw new NotFoundError('ORDER_NOT_FOUND', 'Order not found');
      }
      // Only the order's owner can pay. Admins/support deliberately can't.
      if (order.user_id !== requesterId) {
        // For non-owner CLIENTs hide existence (404). For ADMIN/SUPPORT we
        // surface a clear 403 — they know the order exists, the rule is just
        // that payment is the customer's action.
        if (requesterRole === 'CLIENT') {
          throw new NotFoundError('ORDER_NOT_FOUND', 'Order not found');
        }
        throw new AppError(
          403,
          'PAYMENT_FORBIDDEN',
          'Only the order owner can pay for an order',
        );
      }
      if (order.payment_status === 'PAID') {
        throw new ConflictError(
          'ORDER_ALREADY_PAID',
          'Order has already been paid',
        );
      }
      if (order.status !== 'PENDING') {
        throw new ConflictError(
          'ORDER_NOT_PAYABLE',
          `Order in status ${order.status} cannot be paid`,
        );
      }

      // Mock "processor". The magic PAN always declines; everything else of
      // valid shape succeeds.
      if (card.number === TEST_CARDS.ALWAYS_DECLINE) {
        await this.repo.markPaymentFailed(client, orderId);
        // Defer the throw to outside the transaction so this UPDATE commits.
        return { kind: 'declined' };
      }

      const updated = await this.repo.markOrderPaid(client, orderId);
      const items = await this.repo.findOrderItemsTx(client, orderId);
      return {
        kind: 'paid',
        result: {
          ...toPublicOrder(updated),
          items: items.map(toPublicItem),
        },
      };
    });

    if (outcome.kind === 'declined') {
      throw new AppError(
        402,
        'PAYMENT_DECLINED',
        'Card was declined by the issuer',
      );
    }
    return outcome.result;
  }
}

function toPublicOrder(row: OrderRow): Order {
  return {
    id: row.id,
    userId: row.user_id,
    status: row.status,
    total: row.total,
    paymentStatus: row.payment_status,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function toPublicItem(row: OrderItemRow): OrderItem {
  return {
    id: row.id,
    orderId: row.order_id,
    productId: row.product_id,
    quantity: row.quantity,
    unitPrice: row.unit_price,
  };
}
