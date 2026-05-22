import { describe, it, expect } from '@jest/globals';
import {
  calculateOrderTotal,
  centsToMoney,
  findDuplicateProductIds,
  moneyToCents,
} from './orders.utils.js';

describe('moneyToCents / centsToMoney', () => {
  it('round-trips without precision loss for typical prices', () => {
    expect(centsToMoney(moneyToCents('9.99'))).toBe('9.99');
    expect(centsToMoney(moneyToCents('1499.00'))).toBe('1499.00');
    expect(centsToMoney(moneyToCents('0.10'))).toBe('0.10');
  });

  it('handles a missing fractional part', () => {
    expect(moneyToCents('5')).toBe(500n);
    expect(centsToMoney(500n)).toBe('5.00');
  });

  it('rejects malformed money strings', () => {
    expect(() => moneyToCents('1.234')).toThrow();
    expect(() => moneyToCents('-1.00')).toThrow();
    expect(() => moneyToCents('abc')).toThrow();
  });
});

describe('calculateOrderTotal', () => {
  it('returns 0.00 for an empty items array', () => {
    expect(calculateOrderTotal([], {})).toBe('0.00');
  });

  it('computes total correctly for a single line item', () => {
    expect(
      calculateOrderTotal(
        [{ productId: 'p1', quantity: 2 }],
        { p1: '15.00' },
      ),
    ).toBe('30.00');
  });

  it('sums across multiple line items', () => {
    expect(
      calculateOrderTotal(
        [
          { productId: 'p1', quantity: 1 },
          { productId: 'p2', quantity: 3 },
        ],
        { p1: '10.50', p2: '4.25' },
      ),
    ).toBe('23.25');
  });

  it('does not suffer from float drift (0.1 * 3 = 0.30, not 0.30000000000000004)', () => {
    expect(
      calculateOrderTotal(
        [{ productId: 'p1', quantity: 3 }],
        { p1: '0.10' },
      ),
    ).toBe('0.30');
  });

  it('throws when an item references a productId without a known price', () => {
    expect(() =>
      calculateOrderTotal([{ productId: 'p1', quantity: 1 }], {}),
    ).toThrow(/Missing price/);
  });
});

describe('findDuplicateProductIds', () => {
  it('returns an empty array when all productIds are unique', () => {
    expect(
      findDuplicateProductIds([
        { productId: 'p1', quantity: 1 },
        { productId: 'p2', quantity: 1 },
      ]),
    ).toEqual([]);
  });

  it('reports each duplicate exactly once', () => {
    expect(
      findDuplicateProductIds([
        { productId: 'p1', quantity: 1 },
        { productId: 'p1', quantity: 1 },
        { productId: 'p2', quantity: 1 },
        { productId: 'p2', quantity: 1 },
        { productId: 'p2', quantity: 1 },
      ]),
    ).toEqual(['p1', 'p2']);
  });
});
