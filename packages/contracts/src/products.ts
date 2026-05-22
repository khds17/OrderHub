import { z } from 'zod';

// Money values are kept as strings on the wire because Postgres NUMERIC arrives
// as a string from `pg`; converting to JS number would lose precision.
const MoneyStringSchema = z.string().regex(/^\d+(\.\d{1,2})?$/, {
  message: 'price must be a decimal string with up to 2 fractional digits',
});

export const ProductSchema = z.object({
  id: z.string().uuid(),
  categoryId: z.string().uuid().nullable(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  price: MoneyStringSchema,
  stock: z.number().int().min(0),
  active: z.boolean(),
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
