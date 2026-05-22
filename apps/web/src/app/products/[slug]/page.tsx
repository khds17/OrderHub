'use client';

import { use, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { useProduct } from '@/hooks/queries';
import { useCart } from '@/features/cart/use-cart';
import { formatMoney } from '@/lib/format-money';

type Params = { slug: string };

export default function ProductDetailPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = use(params);
  const { data, isLoading, error } = useProduct(slug);
  const [quantity, setQuantity] = useState(1);
  const add = useCart((s) => s.add);

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState error={error} fallback="Failed to load product" />;
  if (!data) return null;

  const product = data.product;

  return (
    <article className="space-y-4">
      <h1 className="text-3xl font-semibold tracking-tight">{product.name}</h1>
      <p className="text-2xl font-medium">{formatMoney(product.price)}</p>
      <p className="text-slate-700">{product.description ?? ''}</p>
      <p className="text-sm text-slate-500">
        {product.active ? `${product.stock} in stock` : 'Currently unavailable'}
      </p>
      {product.active && product.stock > 0 && (
        <div className="flex items-center gap-3">
          <label htmlFor="qty" className="text-sm font-medium">
            Quantity
          </label>
          <Input
            id="qty"
            type="number"
            min={1}
            max={product.stock}
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
            className="w-20"
          />
          <Button
            onClick={() =>
              add(
                {
                  productId: product.id,
                  slug: product.slug,
                  name: product.name,
                  unitPrice: product.price,
                },
                quantity,
              )
            }
          >
            Add to cart
          </Button>
        </div>
      )}
    </article>
  );
}
