import type { CreateOrderItemInput } from '@orderhub/contracts';

const CENTS_PER_UNIT = 100n;
const MONEY_RE = /^\d+(\.\d{1,2})?$/;

export function moneyToCents(price: string): bigint {
  const trimmed = price.trim();
  if (!MONEY_RE.test(trimmed)) {
    throw new Error(`Invalid money string: "${price}"`);
  }
  const [intPart, fracPart = ''] = trimmed.split('.');
  const padded = (fracPart + '00').slice(0, 2);
  return BigInt(intPart!) * CENTS_PER_UNIT + BigInt(padded);
}

export function centsToMoney(cents: bigint): string {
  const negative = cents < 0n;
  const abs = negative ? -cents : cents;
  const int = abs / CENTS_PER_UNIT;
  const frac = abs % CENTS_PER_UNIT;
  return `${negative ? '-' : ''}${int.toString()}.${frac
    .toString()
    .padStart(2, '0')}`;
}

export function calculateOrderTotal(
  items: ReadonlyArray<CreateOrderItemInput>,
  pricesByProductId: Readonly<Record<string, string>>,
): string {
  if (items.length === 0) return '0.00';
  let total = 0n;
  for (const item of items) {
    const price = pricesByProductId[item.productId];
    if (price === undefined) {
      throw new Error(`Missing price for product ${item.productId}`);
    }
    total += moneyToCents(price) * BigInt(item.quantity);
  }
  return centsToMoney(total);
}

export function findDuplicateProductIds(
  items: ReadonlyArray<CreateOrderItemInput>,
): string[] {
  const seen = new Set<string>();
  const dups = new Set<string>();
  for (const item of items) {
    if (seen.has(item.productId)) dups.add(item.productId);
    seen.add(item.productId);
  }
  return [...dups];
}
