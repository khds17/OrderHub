import { describe, it, expect } from '@jest/globals';
import { safeNextPath } from './safe-next';

describe('safeNextPath', () => {
  const FALLBACK = '/products';

  it('returns the fallback when next is missing', () => {
    expect(safeNextPath(null, FALLBACK)).toBe(FALLBACK);
    expect(safeNextPath(undefined, FALLBACK)).toBe(FALLBACK);
    expect(safeNextPath('', FALLBACK)).toBe(FALLBACK);
  });

  it('returns same-origin paths starting with a single /', () => {
    expect(safeNextPath('/cart', FALLBACK)).toBe('/cart');
    expect(safeNextPath('/orders/abc', FALLBACK)).toBe('/orders/abc');
    expect(safeNextPath('/products?q=x', FALLBACK)).toBe('/products?q=x');
  });

  it('blocks protocol-relative URLs (//evil.com/x)', () => {
    // Browsers parse these as absolute and they're the classic open-redirect
    // footgun — must reject.
    expect(safeNextPath('//evil.com/x', FALLBACK)).toBe(FALLBACK);
    expect(safeNextPath('///still-evil', FALLBACK)).toBe(FALLBACK);
  });

  it('blocks absolute URLs', () => {
    expect(safeNextPath('https://evil.com/x', FALLBACK)).toBe(FALLBACK);
    expect(safeNextPath('http://evil.com/x', FALLBACK)).toBe(FALLBACK);
    expect(safeNextPath('javascript:alert(1)', FALLBACK)).toBe(FALLBACK);
  });

  it('blocks paths that do not start with /', () => {
    expect(safeNextPath('products', FALLBACK)).toBe(FALLBACK);
    expect(safeNextPath('../products', FALLBACK)).toBe(FALLBACK);
  });
});
