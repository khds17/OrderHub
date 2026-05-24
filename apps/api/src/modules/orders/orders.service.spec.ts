import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { Pool, PoolClient } from 'pg';
import type { CardInput } from '@orderhub/contracts';
import { TEST_CARDS } from '@orderhub/contracts';
import { OrdersService } from './orders.service.js';
import type {
  OrderItemRow,
  OrderRow,
  OrdersRepository,
  ProductLockRow,
} from './orders.repository.js';

const VALID_CARD: CardInput = {
  number: '4111111111111111',
  holderName: 'Test Customer',
  expiry: '12/99',
  cvv: '123',
};

const DECLINE_CARD: CardInput = {
  ...VALID_CARD,
  number: TEST_CARDS.ALWAYS_DECLINE,
};

const P1 = '11111111-1111-1111-1111-111111111111';
const P2 = '22222222-2222-2222-2222-222222222222';

const makeOrderRow = (overrides: Partial<OrderRow> = {}): OrderRow => ({
  id: 'order-1',
  user_id: 'user-1',
  status: 'PENDING',
  total: '30.00',
  payment_status: 'PENDING',
  created_at: new Date('2024-01-01T00:00:00Z'),
  updated_at: new Date('2024-01-01T00:00:00Z'),
  ...overrides,
});

const makeItemRow = (overrides: Partial<OrderItemRow> = {}): OrderItemRow => ({
  id: 'item-1',
  order_id: 'order-1',
  product_id: P1,
  quantity: 3,
  unit_price: '10.00',
  ...overrides,
});

const makeRepo = () =>
  ({
    findOrderById: jest.fn(),
    findOrderItems: jest.fn(),
    listUserOrders: jest.fn(),
    listAllOrders: jest.fn(),
    findProductsForUpdate: jest.fn(),
    createOrder: jest.fn(),
    createOrderItems: jest.fn(),
    decrementStock: jest.fn(),
    findOrderForUpdate: jest.fn(),
    findOrderItemsTx: jest.fn(),
    updateOrderStatus: jest.fn(),
    restoreStock: jest.fn(),
    markOrderPaid: jest.fn(),
    markPaymentFailed: jest.fn(),
  }) as unknown as jest.Mocked<OrdersRepository>;

function makePool() {
  const query = jest.fn<(sql: string) => Promise<{ rows: unknown[] }>>();
  query.mockResolvedValue({ rows: [] });
  const release = jest.fn<() => void>();
  const client = { query, release } as unknown as PoolClient;

  const connect = jest.fn<() => Promise<PoolClient>>();
  connect.mockResolvedValue(client);
  const pool = { connect } as unknown as Pool;
  return { pool, client, connect };
}

describe('OrdersService.createOrder — validation', () => {
  let repo: jest.Mocked<OrdersRepository>;
  let pool: Pool;
  let connect: ReturnType<typeof makePool>['connect'];
  let svc: OrdersService;

  beforeEach(() => {
    repo = makeRepo();
    const built = makePool();
    pool = built.pool;
    connect = built.connect;
    svc = new OrdersService(repo, pool);
  });

  it('throws DUPLICATE_PRODUCT_ID before opening a transaction', async () => {
    await expect(
      svc.createOrder('user-1', [
        { productId: P1, quantity: 1 },
        { productId: P1, quantity: 2 },
      ]),
    ).rejects.toMatchObject({ code: 'DUPLICATE_PRODUCT_ID', statusCode: 400 });
    expect(connect).not.toHaveBeenCalled();
    expect(repo.findProductsForUpdate).not.toHaveBeenCalled();
  });

  it('throws PRODUCT_NOT_FOUND when a productId does not exist', async () => {
    repo.findProductsForUpdate.mockResolvedValue([]);
    await expect(
      svc.createOrder('user-1', [{ productId: P1, quantity: 1 }]),
    ).rejects.toMatchObject({ code: 'PRODUCT_NOT_FOUND', statusCode: 404 });
    expect(repo.createOrder).not.toHaveBeenCalled();
  });

  it('throws INSUFFICIENT_STOCK when requested quantity exceeds available', async () => {
    repo.findProductsForUpdate.mockResolvedValue([
      { id: P1, stock: 2, price: '10.00' },
    ] satisfies ProductLockRow[]);
    await expect(
      svc.createOrder('user-1', [{ productId: P1, quantity: 5 }]),
    ).rejects.toMatchObject({ code: 'INSUFFICIENT_STOCK', statusCode: 409 });
    expect(repo.createOrder).not.toHaveBeenCalled();
  });

  it('reports ALL stock violations at once, not just the first', async () => {
    repo.findProductsForUpdate.mockResolvedValue([
      { id: P1, stock: 1, price: '10.00' },
      { id: P2, stock: 1, price: '20.00' },
    ] satisfies ProductLockRow[]);

    await expect(
      svc.createOrder('user-1', [
        { productId: P1, quantity: 5 },
        { productId: P2, quantity: 5 },
      ]),
    ).rejects.toMatchObject({
      code: 'INSUFFICIENT_STOCK',
      details: [
        expect.objectContaining({ field: `items.${P1}` }),
        expect.objectContaining({ field: `items.${P2}` }),
      ],
    });
  });
});

describe('OrdersService.createOrder — happy paths', () => {
  let repo: jest.Mocked<OrdersRepository>;
  let pool: Pool;
  let svc: OrdersService;

  beforeEach(() => {
    repo = makeRepo();
    pool = makePool().pool;
    svc = new OrdersService(repo, pool);
  });

  it('succeeds when requested quantity equals available stock exactly', async () => {
    repo.findProductsForUpdate.mockResolvedValue([
      { id: P1, stock: 3, price: '10.00' },
    ]);
    repo.createOrder.mockResolvedValue(makeOrderRow({ total: '30.00' }));
    repo.createOrderItems.mockResolvedValue([
      makeItemRow({ quantity: 3, unit_price: '10.00' }),
    ]);
    repo.decrementStock.mockResolvedValue(undefined);

    const order = await svc.createOrder('user-1', [
      { productId: P1, quantity: 3 },
    ]);

    expect(order.id).toBe('order-1');
    expect(order.total).toBe('30.00');
    expect(order.items).toHaveLength(1);
    expect(order.items[0]!.unitPrice).toBe('10.00');
  });

  it('snapshots the current product price into order_items.unit_price', async () => {
    repo.findProductsForUpdate.mockResolvedValue([
      { id: P1, stock: 5, price: '12.34' },
    ]);
    repo.createOrder.mockResolvedValue(makeOrderRow({ total: '24.68' }));
    repo.createOrderItems.mockResolvedValue([
      makeItemRow({ quantity: 2, unit_price: '12.34' }),
    ]);
    repo.decrementStock.mockResolvedValue(undefined);

    await svc.createOrder('user-1', [{ productId: P1, quantity: 2 }]);

    expect(repo.createOrderItems).toHaveBeenCalledTimes(1);
    const itemsArg = repo.createOrderItems.mock.calls[0]![2];
    expect(itemsArg).toEqual([
      { productId: P1, quantity: 2, unitPrice: '12.34' },
    ]);
  });

  it('decrements stock once per requested item, in input order', async () => {
    repo.findProductsForUpdate.mockResolvedValue([
      { id: P1, stock: 10, price: '5.00' },
      { id: P2, stock: 10, price: '8.00' },
    ]);
    repo.createOrder.mockResolvedValue(makeOrderRow());
    repo.createOrderItems.mockResolvedValue([]);
    repo.decrementStock.mockResolvedValue(undefined);

    await svc.createOrder('user-1', [
      { productId: P1, quantity: 2 },
      { productId: P2, quantity: 3 },
    ]);

    expect(repo.decrementStock).toHaveBeenCalledTimes(2);
    expect(repo.decrementStock.mock.calls[0]?.[1]).toBe(P1);
    expect(repo.decrementStock.mock.calls[0]?.[2]).toBe(2);
    expect(repo.decrementStock.mock.calls[1]?.[1]).toBe(P2);
    expect(repo.decrementStock.mock.calls[1]?.[2]).toBe(3);
  });
});

describe('OrdersService — pagination passthrough', () => {
  let repo: jest.Mocked<OrdersRepository>;
  let svc: OrdersService;

  beforeEach(() => {
    repo = makeRepo();
    svc = new OrdersService(repo, makePool().pool);
  });

  it('passes limit/offset through to listUserOrders', async () => {
    repo.listUserOrders.mockResolvedValue([]);
    await svc.listMyOrders('user-1', { limit: 5, offset: 10 });
    expect(repo.listUserOrders).toHaveBeenCalledWith('user-1', {
      limit: 5,
      offset: 10,
    });
  });

  it('passes limit/offset through to listAllOrders', async () => {
    repo.listAllOrders.mockResolvedValue([]);
    await svc.listAllOrders({ limit: 50, offset: 100 });
    expect(repo.listAllOrders).toHaveBeenCalledWith({
      limit: 50,
      offset: 100,
    });
  });
});

describe('OrdersService.getOrderById — RBAC', () => {
  let repo: jest.Mocked<OrdersRepository>;
  let svc: OrdersService;

  beforeEach(() => {
    repo = makeRepo();
    svc = new OrdersService(repo, makePool().pool);
  });

  it('hides existence (404) when a CLIENT requests an order owned by someone else', async () => {
    repo.findOrderById.mockResolvedValue(makeOrderRow({ user_id: 'someone-else' }));
    await expect(
      svc.getOrderById('order-1', 'user-1', 'CLIENT'),
    ).rejects.toMatchObject({ code: 'ORDER_NOT_FOUND', statusCode: 404 });
  });

  it('returns the order to its owning CLIENT', async () => {
    repo.findOrderById.mockResolvedValue(makeOrderRow({ user_id: 'user-1' }));
    repo.findOrderItems.mockResolvedValue([makeItemRow()]);
    const order = await svc.getOrderById('order-1', 'user-1', 'CLIENT');
    expect(order.id).toBe('order-1');
    expect(order.userId).toBe('user-1');
  });

  it('returns the order to an ADMIN even if they are not the owner', async () => {
    repo.findOrderById.mockResolvedValue(makeOrderRow({ user_id: 'someone-else' }));
    repo.findOrderItems.mockResolvedValue([]);
    const order = await svc.getOrderById('order-1', 'admin-id', 'ADMIN');
    expect(order.id).toBe('order-1');
  });

  it('returns the order to SUPPORT even if they are not the owner', async () => {
    repo.findOrderById.mockResolvedValue(makeOrderRow({ user_id: 'someone-else' }));
    repo.findOrderItems.mockResolvedValue([]);
    const order = await svc.getOrderById('order-1', 'support-id', 'SUPPORT');
    expect(order.id).toBe('order-1');
  });
});

describe('OrdersService.cancelOrder', () => {
  let repo: jest.Mocked<OrdersRepository>;
  let pool: Pool;
  let svc: OrdersService;

  beforeEach(() => {
    repo = makeRepo();
    pool = makePool().pool;
    svc = new OrdersService(repo, pool);
    // updateOrderStatus is exercised on every successful cancel; default to a
    // cancelled row so individual tests don't have to set it up.
    repo.updateOrderStatus.mockResolvedValue(
      makeOrderRow({ status: 'CANCELLED' }),
    );
    repo.findOrderItemsTx.mockResolvedValue([]);
    repo.restoreStock.mockResolvedValue(undefined);
  });

  it('cancels a PENDING order owned by the requester', async () => {
    repo.findOrderForUpdate.mockResolvedValue(
      makeOrderRow({ user_id: 'user-1', status: 'PENDING' }),
    );

    const order = await svc.cancelOrder('order-1', 'user-1', 'CLIENT');

    expect(order.status).toBe('CANCELLED');
    expect(repo.updateOrderStatus).toHaveBeenCalledWith(
      expect.anything(),
      'order-1',
      'CANCELLED',
    );
  });

  it('cancels a CONFIRMED order owned by the requester', async () => {
    repo.findOrderForUpdate.mockResolvedValue(
      makeOrderRow({ user_id: 'user-1', status: 'CONFIRMED' }),
    );

    const order = await svc.cancelOrder('order-1', 'user-1', 'CLIENT');

    expect(order.status).toBe('CANCELLED');
    expect(repo.updateOrderStatus).toHaveBeenCalledTimes(1);
  });

  it('throws ORDER_NOT_CANCELLABLE (409) when the order is SHIPPED', async () => {
    repo.findOrderForUpdate.mockResolvedValue(
      makeOrderRow({ user_id: 'user-1', status: 'SHIPPED' }),
    );

    await expect(
      svc.cancelOrder('order-1', 'user-1', 'CLIENT'),
    ).rejects.toMatchObject({
      code: 'ORDER_NOT_CANCELLABLE',
      statusCode: 409,
    });
    expect(repo.updateOrderStatus).not.toHaveBeenCalled();
    expect(repo.restoreStock).not.toHaveBeenCalled();
  });

  it('throws ORDER_ALREADY_CANCELLED (409) when the order is already CANCELLED', async () => {
    repo.findOrderForUpdate.mockResolvedValue(
      makeOrderRow({ user_id: 'user-1', status: 'CANCELLED' }),
    );

    await expect(
      svc.cancelOrder('order-1', 'user-1', 'CLIENT'),
    ).rejects.toMatchObject({
      code: 'ORDER_ALREADY_CANCELLED',
      statusCode: 409,
    });
    expect(repo.updateOrderStatus).not.toHaveBeenCalled();
    expect(repo.restoreStock).not.toHaveBeenCalled();
  });

  it('throws ORDER_NOT_FOUND (404) when the order does not exist', async () => {
    repo.findOrderForUpdate.mockResolvedValue(null);

    await expect(
      svc.cancelOrder('missing-order', 'user-1', 'CLIENT'),
    ).rejects.toMatchObject({
      code: 'ORDER_NOT_FOUND',
      statusCode: 404,
    });
  });

  it('hides existence (404) when a CLIENT tries to cancel another user’s order', async () => {
    repo.findOrderForUpdate.mockResolvedValue(
      makeOrderRow({ user_id: 'someone-else', status: 'PENDING' }),
    );

    await expect(
      svc.cancelOrder('order-1', 'user-1', 'CLIENT'),
    ).rejects.toMatchObject({
      code: 'ORDER_NOT_FOUND',
      statusCode: 404,
    });
    expect(repo.updateOrderStatus).not.toHaveBeenCalled();
  });

  it('lets an ADMIN cancel an order they do not own', async () => {
    repo.findOrderForUpdate.mockResolvedValue(
      makeOrderRow({ user_id: 'someone-else', status: 'PENDING' }),
    );

    const order = await svc.cancelOrder('order-1', 'admin-id', 'ADMIN');

    expect(order.status).toBe('CANCELLED');
  });

  it('lets SUPPORT cancel an order they do not own', async () => {
    repo.findOrderForUpdate.mockResolvedValue(
      makeOrderRow({ user_id: 'someone-else', status: 'PENDING' }),
    );

    const order = await svc.cancelOrder('order-1', 'support-id', 'SUPPORT');

    expect(order.status).toBe('CANCELLED');
  });

  it('restores stock for every line item before flipping status', async () => {
    repo.findOrderForUpdate.mockResolvedValue(
      makeOrderRow({ user_id: 'user-1', status: 'PENDING' }),
    );
    repo.findOrderItemsTx.mockResolvedValue([
      makeItemRow({ id: 'item-1', product_id: P1, quantity: 2 }),
      makeItemRow({ id: 'item-2', product_id: P2, quantity: 5 }),
    ]);

    await svc.cancelOrder('order-1', 'user-1', 'CLIENT');

    expect(repo.restoreStock).toHaveBeenCalledTimes(2);
    expect(repo.restoreStock.mock.calls[0]?.[1]).toBe(P1);
    expect(repo.restoreStock.mock.calls[0]?.[2]).toBe(2);
    expect(repo.restoreStock.mock.calls[1]?.[1]).toBe(P2);
    expect(repo.restoreStock.mock.calls[1]?.[2]).toBe(5);

    // Stock must be restored before the status update, otherwise a crash mid-
    // way through would leave a CANCELLED order with no stock restored.
    const lastRestoreCall = repo.restoreStock.mock.invocationCallOrder.at(-1)!;
    const updateCall = repo.updateOrderStatus.mock.invocationCallOrder[0]!;
    expect(lastRestoreCall).toBeLessThan(updateCall);
  });
});

describe('OrdersService.payOrder', () => {
  let repo: jest.Mocked<OrdersRepository>;
  let pool: Pool;
  let svc: OrdersService;

  beforeEach(() => {
    repo = makeRepo();
    pool = makePool().pool;
    svc = new OrdersService(repo, pool);
    repo.findOrderItemsTx.mockResolvedValue([]);
    repo.markOrderPaid.mockResolvedValue(
      makeOrderRow({ status: 'CONFIRMED', payment_status: 'PAID' }),
    );
    repo.markPaymentFailed.mockResolvedValue(
      makeOrderRow({ status: 'PENDING', payment_status: 'FAILED' }),
    );
  });

  it('pays a PENDING/PENDING order: status→CONFIRMED, payment→PAID', async () => {
    repo.findOrderForUpdate.mockResolvedValue(
      makeOrderRow({
        user_id: 'user-1',
        status: 'PENDING',
        payment_status: 'PENDING',
      }),
    );

    const order = await svc.payOrder('order-1', 'user-1', 'CLIENT', VALID_CARD);

    expect(order.status).toBe('CONFIRMED');
    expect(order.paymentStatus).toBe('PAID');
    expect(repo.markOrderPaid).toHaveBeenCalledWith(expect.anything(), 'order-1');
    expect(repo.markPaymentFailed).not.toHaveBeenCalled();
  });

  it('allows retry after a previously FAILED attempt', async () => {
    repo.findOrderForUpdate.mockResolvedValue(
      makeOrderRow({
        user_id: 'user-1',
        status: 'PENDING',
        payment_status: 'FAILED',
      }),
    );

    const order = await svc.payOrder('order-1', 'user-1', 'CLIENT', VALID_CARD);

    expect(order.paymentStatus).toBe('PAID');
    expect(repo.markOrderPaid).toHaveBeenCalledTimes(1);
  });

  it('throws ORDER_NOT_FOUND (404) when the order does not exist', async () => {
    repo.findOrderForUpdate.mockResolvedValue(null);

    await expect(
      svc.payOrder('missing', 'user-1', 'CLIENT', VALID_CARD),
    ).rejects.toMatchObject({ code: 'ORDER_NOT_FOUND', statusCode: 404 });
    expect(repo.markOrderPaid).not.toHaveBeenCalled();
  });

  it('hides existence (404) when a CLIENT tries to pay another user’s order', async () => {
    repo.findOrderForUpdate.mockResolvedValue(
      makeOrderRow({ user_id: 'someone-else', status: 'PENDING' }),
    );

    await expect(
      svc.payOrder('order-1', 'user-1', 'CLIENT', VALID_CARD),
    ).rejects.toMatchObject({ code: 'ORDER_NOT_FOUND', statusCode: 404 });
    expect(repo.markOrderPaid).not.toHaveBeenCalled();
  });

  it('throws ORDER_ALREADY_PAID (409) when payment_status is PAID', async () => {
    repo.findOrderForUpdate.mockResolvedValue(
      makeOrderRow({
        user_id: 'user-1',
        status: 'CONFIRMED',
        payment_status: 'PAID',
      }),
    );

    await expect(
      svc.payOrder('order-1', 'user-1', 'CLIENT', VALID_CARD),
    ).rejects.toMatchObject({ code: 'ORDER_ALREADY_PAID', statusCode: 409 });
    expect(repo.markOrderPaid).not.toHaveBeenCalled();
  });

  it('throws ORDER_NOT_PAYABLE (409) when order is CANCELLED', async () => {
    repo.findOrderForUpdate.mockResolvedValue(
      makeOrderRow({
        user_id: 'user-1',
        status: 'CANCELLED',
        payment_status: 'PENDING',
      }),
    );

    await expect(
      svc.payOrder('order-1', 'user-1', 'CLIENT', VALID_CARD),
    ).rejects.toMatchObject({ code: 'ORDER_NOT_PAYABLE', statusCode: 409 });
    expect(repo.markOrderPaid).not.toHaveBeenCalled();
  });

  it('throws ORDER_NOT_PAYABLE (409) when order is already CONFIRMED', async () => {
    repo.findOrderForUpdate.mockResolvedValue(
      makeOrderRow({
        user_id: 'user-1',
        status: 'CONFIRMED',
        payment_status: 'PENDING',
      }),
    );

    await expect(
      svc.payOrder('order-1', 'user-1', 'CLIENT', VALID_CARD),
    ).rejects.toMatchObject({ code: 'ORDER_NOT_PAYABLE', statusCode: 409 });
  });

  it('declines the magic card: PAYMENT_DECLINED (402) and persists FAILED', async () => {
    repo.findOrderForUpdate.mockResolvedValue(
      makeOrderRow({
        user_id: 'user-1',
        status: 'PENDING',
        payment_status: 'PENDING',
      }),
    );

    await expect(
      svc.payOrder('order-1', 'user-1', 'CLIENT', DECLINE_CARD),
    ).rejects.toMatchObject({ code: 'PAYMENT_DECLINED', statusCode: 402 });
    // The FAILED write must happen — that's how the order reflects the
    // declined attempt for retry UX.
    expect(repo.markPaymentFailed).toHaveBeenCalledWith(
      expect.anything(),
      'order-1',
    );
    expect(repo.markOrderPaid).not.toHaveBeenCalled();
  });

  it('blocks ADMIN from paying (403 PAYMENT_FORBIDDEN) — payment is the customer’s action', async () => {
    repo.findOrderForUpdate.mockResolvedValue(
      makeOrderRow({
        user_id: 'someone-else',
        status: 'PENDING',
        payment_status: 'PENDING',
      }),
    );

    await expect(
      svc.payOrder('order-1', 'admin-id', 'ADMIN', VALID_CARD),
    ).rejects.toMatchObject({ code: 'PAYMENT_FORBIDDEN', statusCode: 403 });
    expect(repo.markOrderPaid).not.toHaveBeenCalled();
  });
});
