import type {
  CreateProductInput,
  Pagination,
  Product,
  ProductImage,
  UpdateProductInput,
} from '@orderhub/contracts';
import { ConflictError, NotFoundError } from '../../utils/errors.js';
import type { ProductImagesService } from '../product-images/product-images.service.js';
import type { ProductRow, ProductsRepository } from './products.repository.js';

const PG_UNIQUE_VIOLATION = '23505';

/** Default page size for the catalog. Matches the product requirement. */
const DEFAULT_LIMIT = 12;

export class ProductsService {
  constructor(
    private readonly repo: ProductsRepository,
    /** Optional so mutations (create/update/activate/...) don't have to pull
     *  in the images dependency. List/getOne use it when set; without it
     *  responses simply have an empty `images: []`. */
    private readonly images?: ProductImagesService,
  ) {}

  async list(
    options: {
      q?: string;
      limit?: number;
      offset?: number;
      includeInactive?: boolean;
    } = {},
  ): Promise<{ products: Product[]; pagination: Pagination }> {
    const limit = options.limit ?? DEFAULT_LIMIT;
    const offset = options.offset ?? 0;
    const includeInactive = options.includeInactive ?? false;
    const q = options.q;

    // Issue the page query and the total-count query in parallel — they hit
    // the same table and don't depend on each other.
    const [rows, total] = await Promise.all([
      this.repo.list({ q, limit, offset, includeInactive }),
      this.repo.count({ q, includeInactive }),
    ]);

    const imagesByProduct = await this.loadImages(rows.map((r) => r.id));

    return {
      products: rows.map((r) => toPublic(r, imagesByProduct.get(r.id) ?? [])),
      pagination: { limit, offset, total },
    };
  }

  async getByIdOrSlug(idOrSlug: string): Promise<Product> {
    const row = await this.repo.findByIdOrSlug(idOrSlug);
    if (!row) {
      throw new NotFoundError('PRODUCT_NOT_FOUND', 'Product not found');
    }
    const imagesByProduct = await this.loadImages([row.id]);
    return toPublic(row, imagesByProduct.get(row.id) ?? []);
  }

  private async loadImages(
    productIds: string[],
  ): Promise<Map<string, ProductImage[]>> {
    if (!this.images || productIds.length === 0) {
      return new Map();
    }
    return this.images.listForProducts(productIds);
  }

  async create(input: CreateProductInput): Promise<Product> {
    try {
      const row = await this.repo.create(input);
      // Fresh row → no images yet; skip the lookup.
      return toPublic(row, []);
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new ConflictError(
          'SLUG_TAKEN',
          'A product with this slug already exists',
        );
      }
      throw err;
    }
  }

  async update(id: string, fields: UpdateProductInput): Promise<Product> {
    try {
      const row = await this.repo.update(id, fields);
      if (!row) {
        throw new NotFoundError('PRODUCT_NOT_FOUND', 'Product not found');
      }
      const imagesByProduct = await this.loadImages([row.id]);
      return toPublic(row, imagesByProduct.get(row.id) ?? []);
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new ConflictError(
          'SLUG_TAKEN',
          'A product with this slug already exists',
        );
      }
      throw err;
    }
  }

  async deactivate(id: string): Promise<Product> {
    const row = await this.repo.deactivate(id);
    if (!row) {
      throw new NotFoundError('PRODUCT_NOT_FOUND', 'Product not found');
    }
    const imagesByProduct = await this.loadImages([row.id]);
    return toPublic(row, imagesByProduct.get(row.id) ?? []);
  }

  async activate(id: string): Promise<Product> {
    const row = await this.repo.activate(id);
    if (!row) {
      throw new NotFoundError('PRODUCT_NOT_FOUND', 'Product not found');
    }
    const imagesByProduct = await this.loadImages([row.id]);
    return toPublic(row, imagesByProduct.get(row.id) ?? []);
  }
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: unknown }).code === PG_UNIQUE_VIOLATION
  );
}

function toPublic(row: ProductRow, images: ProductImage[]): Product {
  return {
    id: row.id,
    categoryId: row.category_id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    price: row.price,
    stock: row.stock,
    active: row.active,
    images,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}
