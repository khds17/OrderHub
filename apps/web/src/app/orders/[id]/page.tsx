'use client';

import { use, useState } from 'react';
import type { OrderStatus, OrderWithItems, User } from '@orderhub/contracts';
import { AuthGuard } from '@/components/auth-guard';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { useAuth } from '@/features/auth/use-auth';
import { useCancelOrder, useOrder } from '@/hooks/queries';
import { ApiError } from '@/lib/api-client';
import { formatMoney } from '@/lib/format-money';

type Params = { id: string };

// Source statuses from which a cancel is allowed by the API. Keep this in
// sync with OrdersService.cancelOrder.
const CANCELLABLE_STATUSES: ReadonlySet<OrderStatus> = new Set([
  'PENDING',
  'CONFIRMED',
]);

export default function OrderDetailPage({
  params,
}: {
  params: Promise<Params>;
}) {
  return (
    <AuthGuard>
      <OrderDetailInner params={params} />
    </AuthGuard>
  );
}

function OrderDetailInner({ params }: { params: Promise<Params> }) {
  const { id } = use(params);
  const { data, isLoading, error } = useOrder(id);
  const { user } = useAuth();

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState error={error} fallback="Failed to load order" />;
  if (!data) return null;

  const order = data.order;

  return (
    <article className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Order details</h1>
        <p className="font-mono text-xs text-slate-500">{order.id}</p>
      </div>
      <dl className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <dt className="font-medium">Status</dt>
          <dd>
            <Badge tone={statusTone(order.status)}>{order.status}</Badge>
          </dd>
        </div>
        <div>
          <dt className="font-medium">Payment</dt>
          <dd>
            <Badge tone={order.paymentStatus === 'PAID' ? 'success' : 'neutral'}>
              {order.paymentStatus}
            </Badge>
          </dd>
        </div>
        <div>
          <dt className="font-medium">Placed</dt>
          <dd>{new Date(order.createdAt).toLocaleString()}</dd>
        </div>
        <div>
          <dt className="font-medium">Total</dt>
          <dd>{formatMoney(order.total)}</dd>
        </div>
      </dl>
      <div>
        <h2 className="text-lg font-semibold">Items</h2>
        <Card className="mt-2">
          <ul className="divide-y divide-slate-200">
            {order.items.map((item) => (
              <li key={item.id} className="flex justify-between p-3 text-sm">
                <span className="font-mono">{item.productId.slice(0, 8)}…</span>
                <span>× {item.quantity}</span>
                <span>{formatMoney(item.unitPrice)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
      {canCancel(order, user) ? <CancelOrderSection order={order} /> : null}
    </article>
  );
}

function CancelOrderSection({ order }: { order: OrderWithItems }) {
  const cancel = useCancelOrder();
  const [done, setDone] = useState(false);

  const onCancel = () => {
    // Native confirm is enough here — there's no dialog primitive in the
    // design system yet, and the action is reversible-ish (admin can resolve).
    if (!window.confirm('Cancel this order? Stock will be restored.')) return;
    cancel.mutate(order.id, {
      onSuccess: () => setDone(true),
    });
  };

  const errMessage =
    cancel.error instanceof ApiError
      ? cancel.error.message
      : cancel.error
        ? 'Failed to cancel order'
        : null;

  return (
    <section className="space-y-2 border-t border-slate-200 pt-4">
      <h2 className="text-lg font-semibold">Cancel order</h2>
      <p className="text-sm text-slate-600">
        Cancelling this order restores stock for every item. This cannot be
        undone.
      </p>
      <Button
        variant="destructive"
        onClick={onCancel}
        disabled={cancel.isPending || done}
      >
        {cancel.isPending ? 'Cancelling…' : 'Cancel order'}
      </Button>
      {done ? (
        <Alert tone="success" title="Order cancelled">
          Stock has been restored.
        </Alert>
      ) : null}
      {errMessage && !done ? (
        <Alert tone="error" title="Could not cancel order">
          {errMessage}
        </Alert>
      ) : null}
    </section>
  );
}

function canCancel(order: OrderWithItems, user: User | null): boolean {
  if (!user) return false;
  if (!CANCELLABLE_STATUSES.has(order.status)) return false;
  if (user.role === 'ADMIN' || user.role === 'SUPPORT') return true;
  return user.id === order.userId;
}

function statusTone(
  status: OrderStatus,
): 'success' | 'info' | 'warning' | 'neutral' {
  if (status === 'CONFIRMED' || status === 'SHIPPED') return 'success';
  if (status === 'CANCELLED') return 'warning';
  return 'info';
}
