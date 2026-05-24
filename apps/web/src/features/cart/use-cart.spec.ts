/**
 * @jest-environment jsdom
 */
import { describe, it, expect, beforeEach } from '@jest/globals';
import { useCart } from './use-cart';

const P1 = 'p1';
const P2 = 'p2';

function reset() {
  // The store is module-singleton; reset between tests to avoid bleed.
  useCart.setState({ items: [], pendingAdd: null });
}

describe('useCart — pendingAdd lifecycle', () => {
  beforeEach(reset);

  it('setPendingAdd stores the item without touching items', () => {
    useCart.getState().setPendingAdd({
      productId: P1,
      slug: 'p1',
      name: 'Item 1',
      unitPrice: '10.00',
      quantity: 2,
    });
    expect(useCart.getState().pendingAdd?.productId).toBe(P1);
    expect(useCart.getState().items).toHaveLength(0);
  });

  it('consumePendingAdd merges pending into items and clears the slot', () => {
    useCart.getState().setPendingAdd({
      productId: P1,
      slug: 'p1',
      name: 'Item 1',
      unitPrice: '10.00',
      quantity: 2,
    });
    const consumed = useCart.getState().consumePendingAdd();
    expect(consumed).toBe(true);
    expect(useCart.getState().items).toEqual([
      {
        productId: P1,
        slug: 'p1',
        name: 'Item 1',
        unitPrice: '10.00',
        quantity: 2,
      },
    ]);
    expect(useCart.getState().pendingAdd).toBeNull();
  });

  it('consumePendingAdd is a no-op (returns false) when nothing is pending', () => {
    expect(useCart.getState().consumePendingAdd()).toBe(false);
    expect(useCart.getState().items).toHaveLength(0);
  });

  it('consume merges with an existing cart entry rather than duplicating', () => {
    useCart.getState().add(
      { productId: P1, slug: 'p1', name: 'Item 1', unitPrice: '10.00' },
      1,
    );
    useCart.getState().setPendingAdd({
      productId: P1,
      slug: 'p1',
      name: 'Item 1',
      unitPrice: '10.00',
      quantity: 3,
    });
    useCart.getState().consumePendingAdd();
    expect(useCart.getState().items).toHaveLength(1);
    expect(useCart.getState().items[0]!.quantity).toBe(4);
  });

  it('clear() drops pending too — leaving no zombie pending after sign-out', () => {
    useCart.getState().setPendingAdd({
      productId: P2,
      slug: 'p2',
      name: 'Item 2',
      unitPrice: '5.00',
      quantity: 1,
    });
    useCart.getState().clear();
    expect(useCart.getState().pendingAdd).toBeNull();
    expect(useCart.getState().items).toHaveLength(0);
  });
});
