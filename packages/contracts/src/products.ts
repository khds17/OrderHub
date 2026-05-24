import { z } from 'zod';

// Money values are kept as strings on the wire because Postgres NUMERIC arrives
// as a string from `pg`; converting to JS number would lose precision.
const MoneyStringSchema = z.string().regex(/^\d+(\.\d{1,2})?$/, {
  message: 'price must be a decimal string with up to 2 fractional digits',
});

export const ProductImageSchema = z.object({
  id: z.string().uuid(),
  /** Relative URL path (e.g. "/uploads/products/{productId}/{file}").
   *  The web client prefixes this with NEXT_PUBLIC_API_URL when rendering. */
  url: z.string(),
  sortOrder: z.number().int(),
  createdAt: z.string(),
});
export type ProductImage = z.infer<typeof ProductImageSchema>;

export const ProductSchema = z.object({
  id: z.string().uuid(),
  categoryId: z.string().uuid().nullable(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  price: MoneyStringSchema,
  stock: z.number().int().min(0),
  active: z.boolean(),
  // Always present in list/detail responses (empty array when no images).
  images: z.array(ProductImageSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Product = z.infer<typeof ProductSchema>;

export const CreateProductSchema = z.object({
  categoryId: z.string().uuid().nullable().optional(),
  name: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'slug must be lowercase kebab-case',
  }),
  description: z.string().optional(),
  price: MoneyStringSchema,
  stock: z.number().int().min(0),
});
export type CreateProductInput = z.infer<typeof CreateProductSchema>;

export const UpdateProductSchema = CreateProductSchema.partial();
export type UpdateProductInput = z.infer<typeof UpdateProductSchema>;

// ── List query + pagination ────────────────────────────────────────────────
//
// Query params for GET /products. The schema is reused on both server and
// client so the API surface stays single-sourced.
//
//  - `q` is a case-insensitive substring match over name + description.
//    Empty/whitespace strings collapse to "no filter".
//  - `limit` is capped at 100 by the API; the catalog UI defaults to 12.
//  - `includeInactive=true` is admin-only and the controller enforces that.
export const ProductListQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .max(100)
    .optional()
    // Treat "  " as absent so callers don't accidentally search for whitespace.
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  includeInactive: z
    .union([z.literal('true'), z.literal('false'), z.boolean()])
    .transform((v) => v === 'true' || v === true)
    .optional(),
});
export type ProductListQueryInput = z.infer<typeof ProductListQuerySchema>;

/**
 * Page envelope returned by paginated list endpoints. `total` is the count of
 * rows that match the filter *before* limit/offset is applied, so callers can
 * render "Showing X–Y of Z" or compute hasNextPage.
 */
export const PaginationSchema = z.object({
  limit: z.number().int().min(1),
  offset: z.number().int().min(0),
  total: z.number().int().min(0),
});
export type Pagination = z.infer<typeof PaginationSchema>;
