import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  ProductImagesService,
  type Disk,
  MAX_UPLOAD_BYTES,
} from './product-images.service.js';
import type {
  ProductImageRow,
  ProductImagesRepository,
} from './product-images.repository.js';

const PRODUCT_ID = '11111111-1111-1111-1111-111111111111';
const IMAGE_ID = '22222222-2222-2222-2222-222222222222';
const UPLOADS_ROOT = '/tmp/orderhub-test-uploads';

const makeRow = (overrides: Partial<ProductImageRow> = {}): ProductImageRow => ({
  id: IMAGE_ID,
  product_id: PRODUCT_ID,
  file_path: `products/${PRODUCT_ID}/abc.png`,
  sort_order: 0,
  created_at: new Date('2024-01-01T00:00:00Z'),
  ...overrides,
});

const makeRepo = () =>
  ({
    findById: jest.fn(),
    findByProductIds: jest.fn(),
    insert: jest.fn(),
    deleteById: jest.fn(),
  }) as unknown as jest.Mocked<ProductImagesRepository>;

const makeDisk = (): jest.Mocked<Disk> => ({
  mkdir: jest.fn<Disk['mkdir']>().mockResolvedValue(undefined),
  writeFile: jest.fn<Disk['writeFile']>().mockResolvedValue(undefined),
  unlink: jest.fn<Disk['unlink']>().mockResolvedValue(undefined),
});

describe('ProductImagesService.upload', () => {
  let repo: jest.Mocked<ProductImagesRepository>;
  let disk: jest.Mocked<Disk>;
  let svc: ProductImagesService;

  beforeEach(() => {
    repo = makeRepo();
    disk = makeDisk();
    svc = new ProductImagesService(repo, UPLOADS_ROOT, disk);
    repo.insert.mockResolvedValue(makeRow());
  });

  it('writes the bytes to disk under products/<id>/, then inserts the row', async () => {
    const bytes = Buffer.from('PNGDATA');

    await svc.upload({
      productId: PRODUCT_ID,
      mimeType: 'image/png',
      bytes,
    });

    expect(disk.mkdir).toHaveBeenCalledTimes(1);
    const dirArg = disk.mkdir.mock.calls[0]![0] as string;
    expect(dirArg).toContain(`uploads`);
    expect(dirArg).toContain(`products/${PRODUCT_ID}`);

    expect(disk.writeFile).toHaveBeenCalledTimes(1);
    const [writePath, writeData] = disk.writeFile.mock.calls[0]!;
    expect(writePath as string).toMatch(/\.png$/);
    expect(writeData).toBe(bytes);

    expect(repo.insert).toHaveBeenCalledTimes(1);
    const insertArg = repo.insert.mock.calls[0]![0];
    expect(insertArg.productId).toBe(PRODUCT_ID);
    expect(insertArg.filePath).toMatch(
      new RegExp(`^products/${PRODUCT_ID}/[a-f0-9-]+\\.png$`),
    );
  });

  it('returns the public ProductImage with a /uploads URL', async () => {
    repo.insert.mockResolvedValue(
      makeRow({ file_path: `products/${PRODUCT_ID}/file.jpg` }),
    );

    const image = await svc.upload({
      productId: PRODUCT_ID,
      mimeType: 'image/jpeg',
      bytes: Buffer.from('JPEGDATA'),
    });

    expect(image.url).toBe(`/uploads/products/${PRODUCT_ID}/file.jpg`);
    expect(image.sortOrder).toBe(0);
  });

  it('uses the right extension per MIME type', async () => {
    const cases: Array<[string, RegExp]> = [
      ['image/jpeg', /\.jpg$/],
      ['image/png', /\.png$/],
      ['image/webp', /\.webp$/],
      ['image/gif', /\.gif$/],
    ];
    for (const [mime, re] of cases) {
      disk = makeDisk();
      repo = makeRepo();
      repo.insert.mockResolvedValue(makeRow());
      svc = new ProductImagesService(repo, UPLOADS_ROOT, disk);

      await svc.upload({
        productId: PRODUCT_ID,
        mimeType: mime,
        bytes: Buffer.from('X'),
      });
      const path = disk.writeFile.mock.calls[0]![0] as string;
      expect(path).toMatch(re);
    }
  });

  it('rejects unsupported MIME types with 415 UNSUPPORTED_IMAGE_TYPE', async () => {
    await expect(
      svc.upload({
        productId: PRODUCT_ID,
        mimeType: 'application/pdf',
        bytes: Buffer.from('PDF'),
      }),
    ).rejects.toMatchObject({
      code: 'UNSUPPORTED_IMAGE_TYPE',
      statusCode: 415,
    });
    expect(disk.writeFile).not.toHaveBeenCalled();
    expect(repo.insert).not.toHaveBeenCalled();
  });

  it('rejects oversized uploads with 413 IMAGE_TOO_LARGE', async () => {
    const oversized = Buffer.alloc(MAX_UPLOAD_BYTES + 1);

    await expect(
      svc.upload({
        productId: PRODUCT_ID,
        mimeType: 'image/png',
        bytes: oversized,
      }),
    ).rejects.toMatchObject({ code: 'IMAGE_TOO_LARGE', statusCode: 413 });
    expect(disk.writeFile).not.toHaveBeenCalled();
  });

  it('rejects empty uploads with 400 EMPTY_UPLOAD', async () => {
    await expect(
      svc.upload({
        productId: PRODUCT_ID,
        mimeType: 'image/png',
        bytes: Buffer.alloc(0),
      }),
    ).rejects.toMatchObject({ code: 'EMPTY_UPLOAD', statusCode: 400 });
  });

  it('unlinks the orphan file if the DB insert fails after a successful write', async () => {
    repo.insert.mockRejectedValue(new Error('db boom'));

    await expect(
      svc.upload({
        productId: PRODUCT_ID,
        mimeType: 'image/png',
        bytes: Buffer.from('X'),
      }),
    ).rejects.toThrow('db boom');

    expect(disk.unlink).toHaveBeenCalledTimes(1);
    const wrotePath = disk.writeFile.mock.calls[0]![0] as string;
    const unlinkedPath = disk.unlink.mock.calls[0]![0] as string;
    expect(unlinkedPath).toBe(wrotePath);
  });
});

describe('ProductImagesService.delete', () => {
  let repo: jest.Mocked<ProductImagesRepository>;
  let disk: jest.Mocked<Disk>;
  let svc: ProductImagesService;

  beforeEach(() => {
    repo = makeRepo();
    disk = makeDisk();
    svc = new ProductImagesService(repo, UPLOADS_ROOT, disk);
  });

  it('deletes the DB row, then unlinks the file', async () => {
    repo.deleteById.mockResolvedValue(
      makeRow({ file_path: `products/${PRODUCT_ID}/abc.png` }),
    );

    await svc.delete(IMAGE_ID);

    expect(repo.deleteById).toHaveBeenCalledWith(IMAGE_ID);
    expect(disk.unlink).toHaveBeenCalledTimes(1);
    expect((disk.unlink.mock.calls[0]![0] as string)).toContain(
      `products/${PRODUCT_ID}/abc.png`,
    );
  });

  it('throws IMAGE_NOT_FOUND (404) when no row was deleted', async () => {
    repo.deleteById.mockResolvedValue(null);
    await expect(svc.delete('missing')).rejects.toMatchObject({
      code: 'IMAGE_NOT_FOUND',
      statusCode: 404,
    });
    expect(disk.unlink).not.toHaveBeenCalled();
  });

  it('swallows file-unlink errors — the DB is the source of truth', async () => {
    repo.deleteById.mockResolvedValue(makeRow());
    disk.unlink.mockRejectedValue(new Error('ENOENT'));

    // Should resolve without throwing — the row is gone, so the delete
    // succeeded conceptually.
    await expect(svc.delete(IMAGE_ID)).resolves.toBeUndefined();
  });
});

describe('ProductImagesService.listForProducts', () => {
  let repo: jest.Mocked<ProductImagesRepository>;
  let svc: ProductImagesService;

  beforeEach(() => {
    repo = makeRepo();
    svc = new ProductImagesService(repo, UPLOADS_ROOT, makeDisk());
  });

  it('groups rows by product_id and returns public-shape images', async () => {
    repo.findByProductIds.mockResolvedValue([
      makeRow({
        id: '00000000-0000-0000-0000-000000000001',
        product_id: 'A',
        file_path: 'products/A/1.png',
        sort_order: 0,
      }),
      makeRow({
        id: '00000000-0000-0000-0000-000000000002',
        product_id: 'A',
        file_path: 'products/A/2.png',
        sort_order: 1,
      }),
      makeRow({
        id: '00000000-0000-0000-0000-000000000003',
        product_id: 'B',
        file_path: 'products/B/1.png',
        sort_order: 0,
      }),
    ]);

    const result = await svc.listForProducts(['A', 'B']);

    expect(result.get('A')).toHaveLength(2);
    expect(result.get('A')![0]!.url).toBe('/uploads/products/A/1.png');
    expect(result.get('B')).toHaveLength(1);
  });

  it('returns an empty Map when given no product ids (skips the query)', async () => {
    const result = await svc.listForProducts([]);
    expect(result.size).toBe(0);
    expect(repo.findByProductIds).not.toHaveBeenCalled();
  });
});
