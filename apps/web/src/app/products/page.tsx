'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { useProducts } from '@/hooks/queries';
import { useCart } from '@/features/cart/use-cart';
import { formatMoney } from '@/lib/format-money';

export default function ProductsPage() {
  const { data, isLoading, error } = useProducts();
  const add = useCart((s) => s.add);

  if (isLoading) return <LoadingState label="Loading products…" />;
  if (error) return <ErrorState error={error} fallback="Failed to load products" />;
  if (!data || data.products.length === 0) {
    return <p className="text-sm text-slate-500">No products available.</p>;
  }

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Products</h1>
      <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {data.products.map((p) => (
          <li key={p.id}>
            <Card>
              <CardBody className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <Link
                      href={`/products/${p.slug}`}
                      className="text-lg font-medium hover:underline"
                    >
                      {p.name}
                    </Link>
                    <p className="text-sm text-slate-500">{p.description ?? ''}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold">{formatMoney(p.price)}</p>
                    <p className="text-xs text-slate-500">{p.stock} in stock</p>
                  </div>
                </div>
                <div>
                  <Button
                    size="sm"
                    onClick={() =>
                      add({
                        productId: p.id,
                        slug: p.slug,
                        name: p.name,
                        unitPrice: p.price,
                      })
                    }
                    disabled={p.stock === 0}
                  >
                    Add to cart
                  </Button>
                </div>
              </CardBody>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}
