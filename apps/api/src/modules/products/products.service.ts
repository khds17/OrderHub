import type {
  CreateProductInput,
  Product,
  UpdateProductInput,
} from '@orderhub/contracts';
import { ConflictError, NotFoundError } from '../../utils/errors.js';
import type { ProductRow, ProductsRepository } from './products.repository.js';

const PG_UNIQUE_VIOLATION = '23505';

export class ProductsService {
  constructor(private readonly repo: ProductsRepository) {}

  async list(options: { includeInactive?: boolean } = {}): Promise<Product[]> {
    const rows = await this.repo.list({
      includeInactive: options.includeInactive ?? false,
    });
    return rows.map(toPublic);
  }

  async getByIdOrSlug(idOrSlug: string): Promise<Product> {
    const row = await this.repo.findByIdOrSlug(idOrSlug);
    if (!row) {
      throw new NotFoundError('PRODUCT_NOT_FOUND', 'Product not found');
    }
    return toPublic(row);
  }

  async create(input: CreateProductInput): Promise<Product> {
    try {
      const row = await this.repo.create(input);
      return toPublic(row);
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
      return toPublic(row);
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
    return toPublic(row);
  }

  async activate(id: string): Promise<Product> {
    const row = await this.repo.activate(id);
    if (!row) {
      throw new NotFoundError('PRODUCT_NOT_FOUND', 'Product not found');
    }
    return toPublic(row);
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

function toPublic(row: ProductRow): Product {
  return {
    id: row.id,
    categoryId: row.category_id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    price: row.price,
    stock: row.stock,
    active: row.active,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}
