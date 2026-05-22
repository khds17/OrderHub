import type { CartItem } from './use-cart';

const CENTS_PER_UNIT = 100n;
const MONEY_RE = /^\d+(\.\d{1,2})?$/;

function moneyToCents(price: string): bigint {
  if (!MONEY_RE.test(price.trim())) {
    throw new Error(`Invalid money string: "${price}"`);
  }
  const [intPart, fracPart = ''] = price.trim().split('.');
  const padded = (fracPart + '00').slice(0, 2);
  return BigInt(intPart!) * CENTS_PER_UNIT + BigInt(padded);
}

function centsToMoney(cents: bigint): string {
  const int = cents / CENTS_PER_UNIT;
  const frac = cents % CENTS_PER_UNIT;
  return `${int.toString()}.${frac.toString().padStart(2, '0')}`;
}

/** Sum of cart items at their stored unit price. Does not re-fetch from API. */
export function calculateCartTotal(items: ReadonlyArray<CartItem>): string {
  if (items.length === 0) return '0.00';
  let total = 0n;
  for (const item of items) {
    total += moneyToCents(item.unitPrice) * BigInt(item.quantity);
  }
  return centsToMoney(total);
}
