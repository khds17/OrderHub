'use client';

import Link from 'next/link';
import { useState } from 'react';
import { AuthGuard } from '@/components/auth-guard';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { useMyOrders } from '@/hooks/queries';
import { formatMoney } from '@/lib/format-money';

const PAGE_SIZE = 10;

export default function OrdersPage() {
  return (
    <AuthGuard roles={['CLIENT']}>
      <OrdersInner />
    </AuthGuard>
  );
}

function OrdersInner() {
  const [offset, setOffset] = useState(0);
  const { data, isLoading, isFetching, error } = useMyOrders(offset, PAGE_SIZE);

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState error={error} fallback="Failed to load orders" />;
  if (!data) return null;

  if (data.orders.length === 0 && offset === 0) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">My orders</h1>
        <p className="text-slate-500">You haven&apos;t placed any orders yet.</p>
      </section>
    );
  }

  const hasMore = data.orders.length === PAGE_SIZE;
  const onPrev = () => setOffset(Math.max(0, offset - PAGE_SIZE));
  const onNext = () => setOffset(offset + PAGE_SIZE);

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">My orders</h1>
      <Card>
        <ul className="divide-y divide-slate-200">
          {data.orders.map((order) => (
            <li key={order.id} className="p-4">
              <Link
                href={`/orders/${order.id}`}
                className="flex items-center justify-between gap-3 hover:underline"
              >
                <span className="font-mono text-sm">{order.id.slice(0, 8)}…</span>
                <span>{formatMoney(order.total)}</span>
                <span className="text-sm text-slate-500">{order.status}</span>
                <span className="text-xs text-slate-400">
                  {new Date(order.createdAt).toLocaleString()}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Card>
      <Pagination
        offset={offset}
        hasMore={hasMore}
        isFetching={isFetching}
        onPrev={onPrev}
        onNext={onNext}
      />
    </section>
  );
}

function Pagination({
  offset,
  hasMore,
  isFetching,
  onPrev,
  onNext,
}: {
  offset: number;
  hasMore: boolean;
  isFetching: boolean;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-slate-500">
        Showing from {offset + 1}
        {isFetching ? ' · refreshing…' : ''}
      </span>
      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={onPrev}
          disabled={offset === 0 || isFetching}
        >
          ← Prev
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={onNext}
          disabled={!hasMore || isFetching}
        >
          Next →
        </Button>
      </div>
    </div>
  );
}
