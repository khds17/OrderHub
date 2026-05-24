'use client';

import { use, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { useProduct } from '@/hooks/queries';
import { useAddToCart } from '@/features/cart/use-add-to-cart';
import { formatMoney } from '@/lib/format-money';
import { absoluteImageUrl } from '@/lib/image-url';

type Params = { slug: string };

export default function ProductDetailPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = use(params);
  const { data, isLoading, error } = useProduct(slug);
  const [quantity, setQuantity] = useState(1);
  const addToCart = useAddToCart();

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState error={error} fallback="Failed to load product" />;
  if (!data) return null;

  const product = data.product;

  const primary = product.images[0];
  const gallery = product.images.slice(1);

  return (
    <article className="space-y-4">
      {primary ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={absoluteImageUrl(primary.url)}
          alt={product.name}
          className="max-h-96 w-full rounded-lg object-cover"
        />
      ) : null}
      {gallery.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {gallery.map((img) => (
            // eslint-disable-next-line @next/next/no-img-element
            <li key={img.id}>
              <img
                src={absoluteImageUrl(img.url)}
                alt=""
                className="h-20 w-20 rounded-md object-cover"
              />
            </li>
          ))}
        </ul>
      ) : null}
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
              addToCart(
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
