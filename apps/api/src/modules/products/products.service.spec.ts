import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ProductsService } from './products.service.js';
import type { ProductRow, ProductsRepository } from './products.repository.js';

const makeRow = (overrides: Partial<ProductRow> = {}): ProductRow => ({
  id: '22222222-2222-2222-2222-222222222222',
  category_id: null,
  name: 'Widget',
  slug: 'widget',
  description: null,
  price: '9.99',
  stock: 10,
  active: true,
  created_at: new Date('2024-01-01T00:00:00Z'),
  updated_at: new Date('2024-01-01T00:00:00Z'),
  ...overrides,
});

const makeRepo = () =>
  ({
    list: jest.fn(),
    findByIdOrSlug: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    deactivate: jest.fn(),
    activate: jest.fn(),
  }) as unknown as jest.Mocked<ProductsRepository>;

describe('ProductsService.create', () => {
  let repo: jest.Mocked<ProductsRepository>;
  let svc: ProductsService;
  beforeEach(() => {
    repo = makeRepo();
    svc = new ProductsService(repo);
  });

  it('translates a pg unique-violation (23505) into SLUG_TAKEN (409)', async () => {
    const pgErr = Object.assign(new Error('duplicate key'), { code: '23505' });
    repo.create.mockRejectedValue(pgErr);
    await expect(
      svc.create({
        name: 'Widget',
        slug: 'widget',
        price: '9.99',
        stock: 10,
      }),
    ).rejects.toMatchObject({ code: 'SLUG_TAKEN', statusCode: 409 });
  });

  it('propagates non-unique pg errors unchanged', async () => {
    const pgErr = Object.assign(new Error('boom'), { code: '42P01' });
    repo.create.mockRejectedValue(pgErr);
    await expect(
      svc.create({
        name: 'Widget',
        slug: 'widget',
        price: '9.99',
        stock: 10,
      }),
    ).rejects.toBe(pgErr);
  });
});

describe('ProductsService.deactivate', () => {
  let repo: jest.Mocked<ProductsRepository>;
  let svc: ProductsService;
  beforeEach(() => {
    repo = makeRepo();
    svc = new ProductsService(repo);
  });

  it('throws PRODUCT_NOT_FOUND when the repo returns null', async () => {
    repo.deactivate.mockResolvedValue(null);
    await expect(
      svc.deactivate('22222222-2222-2222-2222-222222222222'),
    ).rejects.toMatchObject({ code: 'PRODUCT_NOT_FOUND', statusCode: 404 });
  });

  it('returns the deactivated product when the row exists', async () => {
    repo.deactivate.mockResolvedValue(makeRow({ active: false }));
    const product = await svc.deactivate(
      '22222222-2222-2222-2222-222222222222',
    );
    expect(product.active).toBe(false);
    expect(product.slug).toBe('widget');
  });
});

describe('ProductsService.activate', () => {
  let repo: jest.Mocked<ProductsRepository>;
  let svc: ProductsService;
  beforeEach(() => {
    repo = makeRepo();
    svc = new ProductsService(repo);
  });

  it('throws PRODUCT_NOT_FOUND when the repo returns null', async () => {
    repo.activate.mockResolvedValue(null);
    await expect(
      svc.activate('22222222-2222-2222-2222-222222222222'),
    ).rejects.toMatchObject({ code: 'PRODUCT_NOT_FOUND', statusCode: 404 });
  });

  it('returns the reactivated product when the row exists', async () => {
    repo.activate.mockResolvedValue(makeRow({ active: true }));
    const product = await svc.activate(
      '22222222-2222-2222-2222-222222222222',
    );
    expect(product.active).toBe(true);
  });
});

describe('ProductsService.list', () => {
  let repo: jest.Mocked<ProductsRepository>;
  let svc: ProductsService;
  beforeEach(() => {
    repo = makeRepo();
    svc = new ProductsService(repo);
  });

  it('defaults includeInactive to false', async () => {
    repo.list.mockResolvedValue([]);
    await svc.list();
    expect(repo.list).toHaveBeenCalledWith({ includeInactive: false });
  });

  it('passes includeInactive=true through to the repo when requested', async () => {
    repo.list.mockResolvedValue([]);
    await svc.list({ includeInactive: true });
    expect(repo.list).toHaveBeenCalledWith({ includeInactive: true });
  });
});

describe('ProductsService.getByIdOrSlug', () => {
  let repo: jest.Mocked<ProductsRepository>;
  let svc: ProductsService;
  beforeEach(() => {
    repo = makeRepo();
    svc = new ProductsService(repo);
  });

  it('throws PRODUCT_NOT_FOUND when no row matches', async () => {
    repo.findByIdOrSlug.mockResolvedValue(null);
    await expect(svc.getByIdOrSlug('nonexistent')).rejects.toMatchObject({
      code: 'PRODUCT_NOT_FOUND',
      statusCode: 404,
    });
  });

  it('serializes price as a string and dates as ISO strings', async () => {
    repo.findByIdOrSlug.mockResolvedValue(makeRow());
    const p = await svc.getByIdOrSlug('widget');
    expect(typeof p.price).toBe('string');
    expect(p.price).toBe('9.99');
    expect(p.createdAt).toBe('2024-01-01T00:00:00.000Z');
  });
});
