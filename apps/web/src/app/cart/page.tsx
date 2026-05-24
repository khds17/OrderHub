'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useCart } from '@/features/cart/use-cart';
import { calculateCartTotal } from '@/features/cart/cart-total';
import { formatMoney } from '@/lib/format-money';

/** Auto-dismiss the "X removed from cart" toast after this delay. */
const REMOVE_TOAST_MS = 4000;

export default function CartPage() {
  const { items, setQuantity, remove } = useCart();
  const total = calculateCartTotal(items);

  // Surface a brief confirmation after the user clicks Remove. Kept here in
  // local state rather than in the cart store — it's UI feedback for *this*
  // page, not a piece of shared cart truth.
  const [lastRemovedName, setLastRemovedName] = useState<string | null>(null);
  const removeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleRemove(productId: string, name: string) {
    remove(productId);
    // Restart the auto-dismiss timer so quick successive removes don't get
    // stuck displaying the first message past its welcome.
    if (removeTimeoutRef.current) clearTimeout(removeTimeoutRef.current);
    setLastRemovedName(name);
    removeTimeoutRef.current = setTimeout(
      () => setLastRemovedName(null),
      REMOVE_TOAST_MS,
    );
  }

  // Clean up the pending timeout if the user navigates away mid-toast.
  useEffect(
    () => () => {
      if (removeTimeoutRef.current) clearTimeout(removeTimeoutRef.current);
    },
    [],
  );

  const removeToast = lastRemovedName ? (
    <Alert tone="success" role="status">
      “{lastRemovedName}” removed from cart.
    </Alert>
  ) : null;

  if (items.length === 0) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Cart</h1>
        {removeToast}
        <p className="text-slate-500">Your cart is empty.</p>
        <Link href="/products" className="text-sm text-indigo-600 hover:underline">
          Browse products
        </Link>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Cart</h1>
      {removeToast}
      <Card>
        <ul className="divide-y divide-slate-200">
          {items.map((item) => (
            <li
              key={item.productId}
              className="flex items-center justify-between gap-4 p-4"
            >
              <div className="flex-1">
                <p className="font-medium">{item.name}</p>
                <p className="text-sm text-slate-500">
                  {formatMoney(item.unitPrice)} each
                </p>
              </div>
              <Input
                type="number"
                min={1}
                value={item.quantity}
                onChange={(e) =>
                  setQuantity(item.productId, Math.max(1, Number(e.target.value)))
                }
                className="w-20"
                aria-label={`Quantity for ${item.name}`}
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleRemove(item.productId, item.name)}
                className="text-red-600 hover:bg-red-50"
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      </Card>
      <div className="flex items-center justify-between border-t border-slate-200 pt-4">
        <p className="text-lg font-semibold">Total: {formatMoney(total)}</p>
        <Link href="/checkout">
          <Button>Checkout</Button>
        </Link>
      </div>
    </section>
  );
}
