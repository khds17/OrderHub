'use client';

import Link from 'next/link';
import { useState } from 'react';
import { AuthGuard } from '@/components/auth-guard';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { useAllOrders } from '@/hooks/queries';
import { formatMoney } from '@/lib/format-money';

const PAGE_SIZE = 20;

export default function AdminOrdersPage() {
  return (
    <AuthGuard roles={['ADMIN', 'SUPPORT']}>
      <AdminOrdersInner />
    </AuthGuard>
  );
}

function AdminOrdersInner() {
  const [offset, setOffset] = useState(0);
  const { data, isLoading, isFetching, error } = useAllOrders(offset, PAGE_SIZE);

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState error={error} fallback="Failed to load orders" />;
  if (!data) return null;

  const hasMore = data.orders.length === PAGE_SIZE;

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Admin · All orders</h1>
      {data.orders.length === 0 && offset === 0 ? (
        <p className="text-sm text-slate-500">No orders yet.</p>
      ) : (
        <>
          <Card>
            <ul className="divide-y divide-slate-200">
              {data.orders.map((order) => (
                <li key={order.id} className="p-3 text-sm">
                  <Link
                    href={`/orders/${order.id}`}
                    className="grid grid-cols-5 items-center gap-2 hover:underline"
                  >
                    <span className="font-mono">{order.id.slice(0, 8)}…</span>
                    <span className="font-mono">{order.userId.slice(0, 8)}…</span>
                    <span>{formatMoney(order.total)}</span>
                    <span>{order.status}</span>
                    <span className="text-xs text-slate-400">
                      {new Date(order.createdAt).toLocaleString()}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">
              Showing from {offset + 1}
              {isFetching ? ' · refreshing…' : ''}
            </span>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                disabled={offset === 0 || isFetching}
              >
                ← Prev
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setOffset(offset + PAGE_SIZE)}
                disabled={!hasMore || isFetching}
              >
                Next →
              </Button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
