'use client';

import { use } from 'react';
import { AuthGuard } from '@/components/auth-guard';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { useOrder } from '@/hooks/queries';
import { formatMoney } from '@/lib/format-money';

type Params = { id: string };

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
            <Badge tone={order.status === 'CONFIRMED' ? 'success' : 'info'}>
              {order.status}
            </Badge>
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
    </article>
  );
}
