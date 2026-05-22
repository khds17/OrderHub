import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { Pool, PoolClient } from 'pg';
import { OrdersService } from './orders.service.js';
import type {
  OrderItemRow,
  OrderRow,
  OrdersRepository,
  ProductLockRow,
} from './orders.repository.js';

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
