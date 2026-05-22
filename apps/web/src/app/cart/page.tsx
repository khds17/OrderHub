'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useCart } from '@/features/cart/use-cart';
import { calculateCartTotal } from '@/features/cart/cart-total';
import { formatMoney } from '@/lib/format-money';

export default function CartPage() {
  const { items, setQuantity, remove } = useCart();
  const total = calculateCartTotal(items);

  if (items.length === 0) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Cart</h1>
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
                onClick={() => remove(item.productId)}
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
