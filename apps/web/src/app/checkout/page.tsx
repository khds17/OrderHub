'use client';

import { useRouter } from 'next/navigation';
import { AuthGuard } from '@/components/auth-guard';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useCart } from '@/features/cart/use-cart';
import { calculateCartTotal } from '@/features/cart/cart-total';
import { ApiError } from '@/lib/api-client';
import { formatMoney } from '@/lib/format-money';
import { useCreateOrder } from '@/hooks/queries';

export default function CheckoutPage() {
  return (
    <AuthGuard roles={['CLIENT']}>
      <CheckoutInner />
    </AuthGuard>
  );
}

function CheckoutInner() {
  const router = useRouter();
  const { items, clear } = useCart();
  const total = calculateCartTotal(items);
  const createOrder = useCreateOrder();
  const error = createOrder.error;
  const apiError = error instanceof ApiError ? error : null;

  async function placeOrder() {
    if (items.length === 0) return;
    try {
      const { order } = await createOrder.mutateAsync({
        items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
      });
      clear();
      router.replace(`/orders/${order.id}`);
    } catch {
      // surfaced via createOrder.error
    }
  }

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Checkout</h1>
      {items.length === 0 ? (
        <p className="text-slate-500">Your cart is empty.</p>
      ) : (
        <>
          <Card>
            <ul className="divide-y divide-slate-200">
              {items.map((item) => (
                <li key={item.productId} className="flex justify-between p-4">
                  <span>
                    {item.name} × {item.quantity}
                  </span>
                  <span>{formatMoney(item.unitPrice)}</span>
                </li>
              ))}
            </ul>
          </Card>
          <p className="text-lg font-semibold">Total: {formatMoney(total)}</p>
        </>
      )}
      {apiError && (
        <Alert tone="error" fieldErrors={apiError.fieldErrors}>
          {apiError.message}
        </Alert>
      )}
      {error && !apiError && <Alert tone="error">Something went wrong</Alert>}
      <Button
        onClick={() => void placeOrder()}
        disabled={createOrder.isPending || items.length === 0}
      >
        {createOrder.isPending ? 'Placing order…' : 'Place order'}
      </Button>
    </section>
  );
}
