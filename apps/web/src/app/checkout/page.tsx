'use client';

import { useRouter } from 'next/navigation';
import { useRef } from 'react';
import Link from 'next/link';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import {
  CardSchema,
  TEST_CARDS,
  type CardInput,
} from '@orderhub/contracts';
import { AuthGuard } from '@/components/auth-guard';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FormField } from '@/components/ui/form-field';
import { useCart } from '@/features/cart/use-cart';
import { calculateCartTotal } from '@/features/cart/cart-total';
import { ApiError } from '@/lib/api-client';
import { formatMoney } from '@/lib/format-money';
import { applyServerErrors } from '@/lib/form-errors';
import { useCreateOrder, usePayOrder } from '@/hooks/queries';

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
  const payOrder = usePayOrder();

  // Remember the order id once it's been created, so retries after a failed
  // payment hit /pay on the same order rather than re-creating one (which
  // would re-decrement stock and leave the first order orphaned).
  const pendingOrderId = useRef<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CardInput>({
    resolver: zodResolver(CardSchema),
    defaultValues: {
      number: '',
      holderName: '',
      expiry: '',
      cvv: '',
    },
  });

  async function onSubmit(card: CardInput) {
    if (items.length === 0) return;
    try {
      let orderId = pendingOrderId.current;
      if (!orderId) {
        const { order } = await createOrder.mutateAsync({
          items: items.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
          })),
        });
        orderId = order.id;
        pendingOrderId.current = orderId;
      }
      await payOrder.mutateAsync({ id: orderId, input: { card } });
      // Payment succeeded — cart can be cleared.
      pendingOrderId.current = null;
      clear();
      router.replace(`/orders/${orderId}`);
    } catch (err) {
      const handled = applyServerErrors(setError, err);
      if (!handled) {
        setError('root', {
          message:
            err instanceof ApiError
              ? err.message
              : 'Something went wrong',
        });
      } else if (err instanceof ApiError) {
        setError('root', { message: err.message });
      }
    }
  }

  const rootError = errors.root?.message;
  const isDeclined =
    payOrder.error instanceof ApiError &&
    payOrder.error.code === 'PAYMENT_DECLINED';
  const hasPendingOrder = pendingOrderId.current !== null;

  return (
    <section className="mx-auto max-w-xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Checkout</h1>

      {items.length === 0 ? (
        <p className="text-slate-500">Your cart is empty.</p>
      ) : (
        <>
          <Card>
            <ul className="divide-y divide-slate-200">
              {items.map((item) => (
                <li key={item.productId} className="flex justify-between p-4 text-sm">
                  <span>
                    {item.name} × {item.quantity}
                  </span>
                  <span>{formatMoney(item.unitPrice)}</span>
                </li>
              ))}
            </ul>
          </Card>
          <p className="text-lg font-semibold">Total: {formatMoney(total)}</p>

          <form
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-4"
            noValidate
          >
            <h2 className="text-lg font-semibold">Payment</h2>
            <Alert tone="info">
              This is a <strong>mock</strong> payment form. No card is charged.
              Use <code className="font-mono">{TEST_CARDS.ALWAYS_DECLINE}</code>{' '}
              to simulate a decline; any other 13–19 digit number succeeds.
            </Alert>
            <FormField
              label="Card number"
              id="card-number"
              inputMode="numeric"
              autoComplete="cc-number"
              placeholder="4111 1111 1111 1111"
              error={errors.number?.message}
              {...register('number', {
                // Strip spaces so users can paste in spaced numbers.
                setValueAs: (v: string) => (v ?? '').replace(/\s+/g, ''),
              })}
            />
            <FormField
              label="Cardholder name"
              id="card-holder"
              autoComplete="cc-name"
              error={errors.holderName?.message}
              {...register('holderName')}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                label="Expiry (MM/YY)"
                id="card-expiry"
                inputMode="numeric"
                autoComplete="cc-exp"
                placeholder="12/29"
                error={errors.expiry?.message}
                {...register('expiry')}
              />
              <FormField
                label="CVV"
                id="card-cvv"
                inputMode="numeric"
                autoComplete="cc-csc"
                placeholder="123"
                error={errors.cvv?.message}
                {...register('cvv')}
              />
            </div>

            {rootError ? (
              <Alert tone="error">
                {isDeclined
                  ? `${rootError} You can try a different card.`
                  : rootError}
              </Alert>
            ) : null}

            <div className="flex items-center gap-3">
              <Button
                type="submit"
                disabled={isSubmitting || items.length === 0}
              >
                {isSubmitting
                  ? hasPendingOrder
                    ? 'Charging card…'
                    : 'Placing order…'
                  : `Pay ${formatMoney(total)}`}
              </Button>
              {hasPendingOrder ? (
                <Link
                  href={`/orders/${pendingOrderId.current}`}
                  className="text-sm text-indigo-600 hover:underline"
                >
                  View pending order
                </Link>
              ) : null}
            </div>
          </form>
        </>
      )}
    </section>
  );
}
