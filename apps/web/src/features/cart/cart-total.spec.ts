import { describe, it, expect } from '@jest/globals';
import { calculateCartTotal } from './cart-total';
import type { CartItem } from './use-cart';

const item = (overrides: Partial<CartItem> = {}): CartItem => ({
  productId: 'p1',
  slug: 'p1',
  name: 'Item',
  unitPrice: '10.00',
  quantity: 1,
  ...overrides,
});

describe('calculateCartTotal', () => {
  it('returns 0.00 for an empty cart', () => {
    expect(calculateCartTotal([])).toBe('0.00');
  });

  it('sums quantity × unitPrice across items', () => {
    expect(
      calculateCartTotal([
        item({ unitPrice: '10.00', quantity: 2 }),
        item({ productId: 'p2', unitPrice: '4.25', quantity: 3 }),
      ]),
    ).toBe('32.75');
  });

  it('avoids float drift (0.10 × 3 = 0.30, not 0.30000000000000004)', () => {
    expect(
      calculateCartTotal([item({ unitPrice: '0.10', quantity: 3 })]),
    ).toBe('0.30');
  });

  it('throws on a malformed money string', () => {
    expect(() =>
      calculateCartTotal([item({ unitPrice: '1.234' })]),
    ).toThrow();
  });
});
