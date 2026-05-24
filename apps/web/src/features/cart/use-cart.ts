'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type CartItem = {
  productId: string;
  slug: string;
  name: string;
  unitPrice: string; // money string, e.g. "9.99"
  quantity: number;
};

type CartState = {
  items: CartItem[];
  /**
   * Holds the item a guest tried to add before being redirected to /login.
   * Persisted alongside `items` so it survives the navigation; consumed by
   * the login/register pages on successful auth.
   */
  pendingAdd: CartItem | null;
  add: (item: Omit<CartItem, 'quantity'>, quantity?: number) => void;
  setQuantity: (productId: string, quantity: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
  setPendingAdd: (item: CartItem | null) => void;
  /**
   * If a pendingAdd is stashed, merge it into items (using the same dedupe
   * rules as `add`) and clear the pending slot. Returns true if anything was
   * consumed so callers can decide whether to redirect to /cart.
   */
  consumePendingAdd: () => boolean;
};

/**
 * Merge an item into a cart-items list using the upsert-by-productId rule.
 * Pulled out so `add` and `consumePendingAdd` stay consistent — diverging
 * would mean a pending guest add behaves differently from a direct add.
 */
function mergeItem(items: CartItem[], next: CartItem): CartItem[] {
  const existing = items.find((i) => i.productId === next.productId);
  if (existing) {
    return items.map((i) =>
      i.productId === next.productId
        ? { ...i, quantity: i.quantity + next.quantity }
        : i,
    );
  }
  return [...items, next];
}

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      pendingAdd: null,
      add: (item, quantity = 1) =>
        set((state) => ({
          items: mergeItem(state.items, { ...item, quantity }),
        })),
      setQuantity: (productId, quantity) =>
        set((state) => ({
          items:
            quantity <= 0
              ? state.items.filter((i) => i.productId !== productId)
              : state.items.map((i) =>
                  i.productId === productId ? { ...i, quantity } : i,
                ),
        })),
      remove: (productId) =>
        set((state) => ({
          items: state.items.filter((i) => i.productId !== productId),
        })),
      clear: () => set({ items: [], pendingAdd: null }),
      setPendingAdd: (item) => set({ pendingAdd: item }),
      consumePendingAdd: () => {
        const pending = get().pendingAdd;
        if (!pending) return false;
        set((state) => ({
          items: mergeItem(state.items, pending),
          pendingAdd: null,
        }));
        return true;
      },
    }),
    { name: 'orderhub_cart' },
  ),
);
