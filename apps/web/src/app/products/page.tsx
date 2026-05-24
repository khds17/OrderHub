'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { useAddToCart } from '@/features/cart/use-add-to-cart';
import { PaginationControls } from '@/features/catalog/pagination-controls';
import { useCatalogParams } from '@/features/catalog/use-catalog-params';
import { useProducts } from '@/hooks/queries';
import { formatMoney } from '@/lib/format-money';
import { absoluteImageUrl } from '@/lib/image-url';

const PAGE_SIZE = 12;

// useSearchParams() in the catalog params hook requires Suspense in Next 15.
export default function ProductsPage() {
  return (
    <Suspense fallback={<LoadingState label="Loading products…" />}>
      <ProductsPageInner />
    </Suspense>
  );
}

function ProductsPageInner() {
  const { qInput, setQInput, q, offset, goToOffset } = useCatalogParams();
  const { data, isLoading, isFetching, error } = useProducts({
    q: q || undefined,
    limit: PAGE_SIZE,
    offset,
  });
  const addToCart = useAddToCart();

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Products</h1>
        <div className="w-full sm:max-w-xs">
          <label htmlFor="product-search" className="sr-only">
            Search products
          </label>
          <Input
            id="product-search"
            type="search"
            placeholder="Search by name or description…"
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
          />
        </div>
      </div>

      {error ? (
        <ErrorState error={error} fallback="Failed to load products" />
      ) : isLoading ? (
        <LoadingState label="Loading products…" />
      ) : !data || data.products.length === 0 ? (
        <EmptyState query={q} />
      ) : (
        <>
          <ul
            className="grid grid-cols-1 gap-4 md:grid-cols-2"
            aria-busy={isFetching}
          >
            {data.products.map((p) => {
              const primary = p.images[0];
              return (
                <li key={p.id}>
                  <Card>
                    <CardBody className="flex flex-col gap-3">
                      <div className="flex items-start gap-4">
                        {primary ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={absoluteImageUrl(primary.url)}
                            alt={p.name}
                            className="h-20 w-20 shrink-0 rounded-md object-cover"
                          />
                        ) : (
                          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-md border border-dashed border-slate-300 text-xs text-slate-400">
                            No img
                          </div>
                        )}
                        <div className="flex-1">
                          <Link
                            href={`/products/${p.slug}`}
                            className="text-lg font-medium hover:underline"
                          >
                            {p.name}
                          </Link>
                          <p className="text-sm text-slate-500 line-clamp-2">
                            {p.description ?? ''}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-semibold">
                            {formatMoney(p.price)}
                          </p>
                          <p className="text-xs text-slate-500">
                            {p.stock} in stock
                          </p>
                        </div>
                      </div>
                      <div>
                        <Button
                          size="sm"
                          onClick={() =>
                            addToCart({
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
              );
            })}
          </ul>
          <PaginationControls
            pagination={data.pagination}
            onChange={goToOffset}
          />
        </>
      )}
    </section>
  );
}

function EmptyState({ query }: { query: string }) {
  if (query) {
    return (
      <p className="text-sm text-slate-500">
        No products match <span className="font-medium">“{query}”</span>.
      </p>
    );
  }
  return <p className="text-sm text-slate-500">No products available.</p>;
}
