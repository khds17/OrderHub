import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type CartItem = {
  productId: string;
  slug: string;
  name: string;
  unitPrice: string;
  quantity: number;
};

type CartState = {
  items: CartItem[];
  add: (item: Omit<CartItem, 'quantity'>, quantity?: number) => void;
  setQuantity: (productId: string, quantity: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
};

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
    (set) => ({
      items: [],
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
      clear: () => set({ items: [] }),
    }),
    {
      name: 'orderhub_cart',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

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

export function calculateCartTotal(items: ReadonlyArray<CartItem>): string {
  if (items.length === 0) return '0.00';
  let total = 0n;
  for (const item of items) {
    total += moneyToCents(item.unitPrice) * BigInt(item.quantity);
  }
  return centsToMoney(total);
}
