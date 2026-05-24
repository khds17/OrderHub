import type { Pool } from 'pg';

export type ProductImageRow = {
  id: string;
  product_id: string;
  file_path: string;
  sort_order: number;
  created_at: Date;
};

const COLS = `id, product_id, file_path, sort_order, created_at`;

export class ProductImagesRepository {
  constructor(private readonly pool: Pool) {}

  async findById(id: string): Promise<ProductImageRow | null> {
    const { rows } = await this.pool.query<ProductImageRow>(
      `SELECT ${COLS} FROM product_images WHERE id = $1`,
      [id],
    );
    return rows[0] ?? null;
  }

  /**
   * Batch-load images for a set of products in their display order.
   * Used to hydrate the products list response so the N+1 trap doesn't
   * appear once the catalog has thumbnails on every card.
   */
  async findByProductIds(productIds: string[]): Promise<ProductImageRow[]> {
    if (productIds.length === 0) return [];
    const { rows } = await this.pool.query<ProductImageRow>(
      `SELECT ${COLS}
       FROM product_images
       WHERE product_id = ANY($1::uuid[])
       ORDER BY product_id, sort_order, created_at`,
      [productIds],
    );
    return rows;
  }

  async insert(input: {
    productId: string;
    filePath: string;
    sortOrder?: number;
  }): Promise<ProductImageRow> {
    const { rows } = await this.pool.query<ProductImageRow>(
      `INSERT INTO product_images (product_id, file_path, sort_order)
       VALUES ($1, $2, COALESCE($3, 0))
       RETURNING ${COLS}`,
      [input.productId, input.filePath, input.sortOrder ?? null],
    );
    const row = rows[0];
    if (!row) throw new Error('insert product_image: no row returned');
    return row;
  }

  /** Returns the deleted row so callers can unlink the on-disk file. */
  async deleteById(id: string): Promise<ProductImageRow | null> {
    const { rows } = await this.pool.query<ProductImageRow>(
      `DELETE FROM product_images
       WHERE id = $1
       RETURNING ${COLS}`,
      [id],
    );
    return rows[0] ?? null;
  }
}
