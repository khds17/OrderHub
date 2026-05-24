import { z } from 'zod';
import { CardSchema } from './orders.js';

/**
 * Saved payment method as returned by the API. Note this is *not* the
 * payable card — we never echo back PAN/CVV/holder-on-the-wire-too-many-times.
 *
 * The row stores `last4` only; `expiry` is MM/YY (matches CardSchema).
 */
export const PaymentMethodSchema = z.object({
  id: z.string().uuid(),
  holderName: z.string(),
  last4: z.string().regex(/^\d{4}$/),
  expiry: z.string().regex(/^(0[1-9]|1[0-2])\/\d{2}$/),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type PaymentMethod = z.infer<typeof PaymentMethodSchema>;

/**
 * Save (upsert) payload — the client posts a full fake card, the API derives
 * last4 server-side and stores only what `PaymentMethodSchema` describes.
 * Reusing CardSchema keeps the validation rules (expiry in future, 13–19
 * digits, CVV shape) single-sourced with the checkout flow.
 */
export const SavePaymentMethodSchema = CardSchema;
export type SavePaymentMethodInput = z.infer<typeof SavePaymentMethodSchema>;
