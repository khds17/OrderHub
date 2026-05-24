'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/use-auth';
import { useCart, type CartItem } from './use-cart';

/**
 * Add an item to the cart, gated by auth.
 *
 *  - **Authenticated**: merges the item into the cart immediately. No
 *    navigation — the cart-count badge in the nav is the user-visible signal.
 *  - **Guest**: stashes the item as `pendingAdd` and routes to
 *    `/login?next=/cart`. The login/register pages consume `pendingAdd` on
 *    success and bounce the user to `/cart` with the item present.
 *
 * Centralising the gate here keeps the two add-to-cart entry points
 * (`/products` list, `/products/[slug]` detail) consistent and the spec
 * ("guest must log in before they can add") enforced in one place.
 */
export function useAddToCart() {
  const router = useRouter();
  const add = useCart((s) => s.add);
  const setPendingAdd = useCart((s) => s.setPendingAdd);
  const status = useAuth((s) => s.status);

  return function addToCart(
    item: Omit<CartItem, 'quantity'>,
    quantity = 1,
  ): { addedNow: boolean } {
    if (status === 'authenticated') {
      add(item, quantity);
      return { addedNow: true };
    }
    setPendingAdd({ ...item, quantity });
    router.push('/login?next=/cart');
    return { addedNow: false };
  };
}
