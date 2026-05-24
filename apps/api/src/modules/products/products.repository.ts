import type { Pool } from 'pg';
import type { CreateProductInput, UpdateProductInput } from '@orderhub/contracts';

export type ProductRow = {
  id: string;
  category_id: string | null;
  name: string;
  slug: string;
  description: string | null;
  price: string;
  stock: number;
  active: boolean;
  created_at: Date;
  updated_at: Date;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SELECT_COLS = `
  id, category_id, name, slug, description,
  price::text AS price, stock, active,
  created_at, updated_at
`;

export class ProductsRepository {
  constructor(private readonly pool: Pool) {}

  async list(options: {
    q?: string;
    limit: number;
    offset: number;
    includeInactive: boolean;
  }): Promise<ProductRow[]> {
    const { sql: whereSql, params } = buildListWhere(options);
    const limitIdx = params.length + 1;
    const offsetIdx = params.length + 2;
    const { rows } = await this.pool.query<ProductRow>(
      `SELECT ${SELECT_COLS}
       FROM products
       ${whereSql}
       ORDER BY created_at DESC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      [...params, options.limit, options.offset],
    );
    return rows;
  }

  /**
   * Count of rows matching the same filter `list` would apply (ignoring
   * limit/offset). Shares `buildListWhere` with `list` so the two never
   * drift — a mismatch would skew the "Showing X of Y" UI and the
   * has-next-page check.
   */
  async count(options: {
    q?: string;
    includeInactive: boolean;
  }): Promise<number> {
    const { sql: whereSql, params } = buildListWhere(options);
    // count(*) comes back as bigint → text from pg; parse to number after.
    const { rows } = await this.pool.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM products ${whereSql}`,
      params,
    );
    return Number(rows[0]?.count ?? '0');
  }

  async findByIdOrSlug(idOrSlug: string): Promise<ProductRow | null> {
    const sql = UUID_RE.test(idOrSlug)
      ? `SELECT ${SELECT_COLS} FROM products WHERE id = $1`
      : `SELECT ${SELECT_COLS} FROM products WHERE slug = $1`;
    const { rows } = await this.pool.query<ProductRow>(sql, [idOrSlug]);
    return rows[0] ?? null;
  }

  async create(input: CreateProductInput): Promise<ProductRow> {
    const { rows } = await this.pool.query<ProductRow>(
      `INSERT INTO products (category_id, name, slug, description, price, stock)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING ${SELECT_COLS}`,
      [
        input.categoryId ?? null,
        input.name,
        input.slug,
        input.description ?? null,
        input.price,
        input.stock,
      ],
    );
    const row = rows[0];
    if (!row) throw new Error('create: no row returned');
    return row;
  }

  async update(
    id: string,
    fields: UpdateProductInput,
  ): Promise<ProductRow | null> {
    const sets: string[] = [];
    const values: unknown[] = [id];
    let i = 2;
    // Column names are hardcoded; only values are parameterized.
    if (fields.name !== undefined) {
      sets.push(`name = $${i++}`);
      values.push(fields.name);
    }
    if (fields.description !== undefined) {
      sets.push(`description = $${i++}`);
      values.push(fields.description);
    }
    if (fields.price !== undefined) {
      sets.push(`price = $${i++}`);
      values.push(fields.price);
    }
    if (fields.stock !== undefined) {
      sets.push(`stock = $${i++}`);
      values.push(fields.stock);
    }
    if (fields.slug !== undefined) {
      sets.push(`slug = $${i++}`);
      values.push(fields.slug);
    }
    if (fields.categoryId !== undefined) {
      // null is meaningful here (clear category), so we don't COALESCE.
      sets.push(`category_id = $${i++}`);
      values.push(fields.categoryId);
    }

    if (sets.length === 0) {
      // Nothing to patch — return the current row (or null if missing).
      const { rows } = await this.pool.query<ProductRow>(
        `SELECT ${SELECT_COLS} FROM products WHERE id = $1`,
        [id],
      );
      return rows[0] ?? null;
    }

    sets.push(`updated_at = now()`);
    const { rows } = await this.pool.query<ProductRow>(
      `UPDATE products
       SET ${sets.join(', ')}
       WHERE id = $1
       RETURNING ${SELECT_COLS}`,
      values,
    );
    return rows[0] ?? null;
  }

  async deactivate(id: string): Promise<ProductRow | null> {
    const { rows } = await this.pool.query<ProductRow>(
      `UPDATE products
       SET active = false, updated_at = now()
       WHERE id = $1
       RETURNING ${SELECT_COLS}`,
      [id],
    );
    return rows[0] ?? null;
  }

  async activate(id: string): Promise<ProductRow | null> {
    const { rows } = await this.pool.query<ProductRow>(
      `UPDATE products
       SET active = true, updated_at = now()
       WHERE id = $1
       RETURNING ${SELECT_COLS}`,
      [id],
    );
    return rows[0] ?? null;
  }
}

/**
 * Shared WHERE-clause builder for list/count so they apply identical filters.
 * Returns the `WHERE ...` SQL fragment (empty string when no conditions) and
 * the positional params it references (1-indexed in caller SQL).
 *
 * Search semantics:
 *   - case-insensitive substring match on (name OR description) via ILIKE
 *   - user-supplied `%` and `_` are escaped so they can't widen the match
 *   - the LIKE escape character is set to `\` via ESCAPE clause
 */
function buildListWhere(options: {
  q?: string;
  includeInactive: boolean;
}): { sql: string; params: unknown[] } {
  const params: unknown[] = [];
  const conds: string[] = [];

  if (!options.includeInactive) {
    conds.push('active = true');
  }

  if (options.q) {
    // Escape LIKE meta-chars in user input so "50_off" doesn't match anything
    // with a 50 followed by some char followed by off.
    const escaped = options.q.replace(/[\\%_]/g, '\\$&');
    params.push(`%${escaped}%`);
    const i = params.length;
    conds.push(`(name ILIKE $${i} ESCAPE '\\' OR description ILIKE $${i} ESCAPE '\\')`);
  }

  return {
    sql: conds.length ? `WHERE ${conds.join(' AND ')}` : '',
    params,
  };
}
