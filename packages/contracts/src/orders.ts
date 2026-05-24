import { z } from 'zod';

export const OrderStatusSchema = z.enum([
  'PENDING',
  'CONFIRMED',
  'CANCELLED',
  'SHIPPED',
]);
export type OrderStatus = z.infer<typeof OrderStatusSchema>;

export const PaymentStatusSchema = z.enum(['PENDING', 'PAID', 'FAILED']);
export type PaymentStatus = z.infer<typeof PaymentStatusSchema>;

export const CreateOrderItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive(),
});
export type CreateOrderItemInput = z.infer<typeof CreateOrderItemSchema>;

export const CreateOrderSchema = z.object({
  items: z.array(CreateOrderItemSchema).min(1),
});
export type CreateOrderInput = z.infer<typeof CreateOrderSchema>;

export const OrderItemSchema = z.object({
  id: z.string().uuid(),
  orderId: z.string().uuid(),
  productId: z.string().uuid(),
  quantity: z.number().int().positive(),
  unitPrice: z.string(),
});
export type OrderItem = z.infer<typeof OrderItemSchema>;

export const OrderSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  status: OrderStatusSchema,
  total: z.string(),
  paymentStatus: PaymentStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Order = z.infer<typeof OrderSchema>;

export const OrderWithItemsSchema = OrderSchema.extend({
  items: z.array(OrderItemSchema),
});
export type OrderWithItems = z.infer<typeof OrderWithItemsSchema>;

// ── Payment ────────────────────────────────────────────────────────────────
//
// Fake/mock card schema. We never store these values server-side; they only
// exist long enough for the payOrder service to look at the card number and
// decide success vs. decline. Validation is shape-only — real PAN validation
// (Luhn, BIN ranges) would be theatre when there's no real processor.

const CARD_NUMBER_RE = /^\d{13,19}$/;
// MM is 01–12, YY is two digits.
const EXPIRY_RE = /^(0[1-9]|1[0-2])\/\d{2}$/;
const CVV_RE = /^\d{3,4}$/;

export const CardSchema = z.object({
  /** Card number, digits only (13–19). Spaces should be stripped before send. */
  number: z.string().regex(CARD_NUMBER_RE, 'Card number must be 13–19 digits'),
  holderName: z.string().min(1).max(120),
  /** Expiry as MM/YY. Must be a future month (current month is still valid). */
  expiry: z
    .string()
    .regex(EXPIRY_RE, 'Expiry must be in MM/YY format')
    .refine(isExpiryInFuture, { message: 'Card is expired' }),
  cvv: z.string().regex(CVV_RE, 'CVV must be 3 or 4 digits'),
});
export type CardInput = z.infer<typeof CardSchema>;

export const PayOrderSchema = z.object({
  card: CardSchema,
});
export type PayOrderInput = z.infer<typeof PayOrderSchema>;

/**
 * Test card numbers that the mock processor recognises. Stripe's classic
 * "always-declines" PAN is used here so manual QA has a predictable failure
 * path without us inventing new magic.
 */
export const TEST_CARDS = {
  /** Any other shape-valid number succeeds. This one always declines. */
  ALWAYS_DECLINE: '4000000000000002',
} as const;

function isExpiryInFuture(s: string): boolean {
  const match = EXPIRY_RE.exec(s);
  if (!match) return false;
  const mm = Number(s.slice(0, 2));
  const yy = Number(s.slice(3, 5));
  // Card is valid through the end of the expiry month.
  const exp = new Date(2000 + yy, mm, 0, 23, 59, 59);
  return exp.getTime() >= Date.now();
}
