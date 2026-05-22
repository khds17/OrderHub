import type { Pool } from 'pg';
import type {
  CreateOrderItemInput,
  Order,
  OrderItem,
  OrderWithItems,
  UserRole,
} from '@orderhub/contracts';
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
