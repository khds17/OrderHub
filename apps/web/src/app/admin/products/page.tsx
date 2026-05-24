'use client';

import { Suspense, useRef, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import {
  CreateProductSchema,
  UpdateProductSchema,
  type CreateProductInput,
  type Product,
  type ProductImage,
  type UpdateProductInput,
} from '@orderhub/contracts';
import { AuthGuard } from '@/components/auth-guard';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { FormField } from '@/components/ui/form-field';
import { Input, Textarea } from '@/components/ui/input';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { PaginationControls } from '@/features/catalog/pagination-controls';
import { useCatalogParams } from '@/features/catalog/use-catalog-params';
import { ApiError } from '@/lib/api-client';
import { applyServerErrors } from '@/lib/form-errors';
import { formatMoney } from '@/lib/format-money';
import { absoluteImageUrl } from '@/lib/image-url';
import {
  useActivateProduct,
  useCreateProduct,
  useDeactivateProduct,
  useDeleteProductImage,
  useProducts,
  useUpdateProduct,
  useUploadProductImage,
} from '@/hooks/queries';

const PAGE_SIZE = 12;

export default function AdminProductsPage() {
  return (
    <AuthGuard roles={['ADMIN']}>
      <Suspense fallback={<LoadingState />}>
        <AdminProductsInner />
      </Suspense>
    </AuthGuard>
  );
}

function AdminProductsInner() {
  const { qInput, setQInput, q, offset, goToOffset } = useCatalogParams();
  const { data, isLoading, isFetching, error } = useProducts({
    q: q || undefined,
    limit: PAGE_SIZE,
    offset,
    includeInactive: true,
  });

  return (
    <section className="space-y-8">
      <h1 className="text-2xl font-semibold tracking-tight">Admin · Products</h1>

      <CreateProductForm />

      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold">Catalog</h2>
          <div className="w-full sm:max-w-xs">
            <label htmlFor="admin-product-search" className="sr-only">
              Search products
            </label>
            <Input
              id="admin-product-search"
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
          <LoadingState />
        ) : !data || data.products.length === 0 ? (
          <p className="text-sm text-slate-500">
            {q ? `No products match “${q}”.` : 'No products yet.'}
          </p>
        ) : (
          <>
            <ul
              className="grid grid-cols-1 gap-3"
              aria-busy={isFetching}
            >
              {data.products.map((p) => (
                <li key={p.id}>
                  <ProductRow product={p} />
                </li>
              ))}
            </ul>
            <PaginationControls
              pagination={data.pagination}
              onChange={goToOffset}
            />
          </>
        )}
      </div>
    </section>
  );
}

// ── Per-row component ────────────────────────────────────────────────────

function ProductRow({ product }: { product: Product }) {
  const [editing, setEditing] = useState(false);
  const deactivate = useDeactivateProduct();
  const activate = useActivateProduct();

  return (
    <Card>
      <CardBody className="space-y-4">
        <div className="flex items-start gap-4">
          <ProductThumbnail images={product.images} alt={product.name} />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="font-medium">{product.name}</p>
              <Badge tone={product.active ? 'success' : 'neutral'}>
                {product.active ? 'Active' : 'Inactive'}
              </Badge>
            </div>
            <p className="font-mono text-xs text-slate-500">{product.slug}</p>
            <p className="mt-1 text-sm text-slate-600 line-clamp-2">
              {product.description ?? ''}
            </p>
          </div>
          <div className="text-right text-sm">
            <p>{formatMoney(product.price)}</p>
            <p className="text-slate-500">{product.stock} in stock</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setEditing((v) => !v)}
          >
            {editing ? 'Close' : 'Edit'}
          </Button>
          {product.active ? (
            <Button
              variant="destructive"
              size="sm"
              disabled={deactivate.isPending}
              onClick={() => deactivate.mutate(product.id)}
            >
              Deactivate
            </Button>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              disabled={activate.isPending}
              onClick={() => activate.mutate(product.id)}
              className="border-emerald-300 text-emerald-700 hover:bg-emerald-50"
            >
              Activate
            </Button>
          )}
        </div>

        {editing ? (
          <div className="space-y-6 border-t border-slate-200 pt-4">
            <EditProductForm
              product={product}
              onSaved={() => setEditing(false)}
            />
            <ProductImagesEditor product={product} />
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}

function ProductThumbnail({
  images,
  alt,
}: {
  images: ProductImage[];
  alt: string;
}) {
  const first = images[0];
  if (!first) {
    return (
      <div
        className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md border border-dashed border-slate-300 text-xs text-slate-400"
        aria-label="No image"
      >
        No img
      </div>
    );
  }
  return (
    // The API serves images via a different origin in dev — use a plain <img>
    // rather than next/image so we don't fight with the remotePatterns config.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={absoluteImageUrl(first.url)}
      alt={alt}
      className="h-16 w-16 shrink-0 rounded-md object-cover"
    />
  );
}

// ── Edit form ─────────────────────────────────────────────────────────────

function EditProductForm({
  product,
  onSaved,
}: {
  product: Product;
  onSaved: () => void;
}) {
  const update = useUpdateProduct();
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<UpdateProductInput>({
    resolver: zodResolver(UpdateProductSchema),
    defaultValues: {
      name: product.name,
      slug: product.slug,
      price: product.price,
      stock: product.stock,
      description: product.description ?? '',
    },
  });

  async function onSubmit(values: UpdateProductInput) {
    try {
      await update.mutateAsync({
        id: product.id,
        input: {
          ...values,
          // Empty string clears the description on the server (column is
          // nullable). Send undefined to leave it untouched if RHF gave us
          // exactly what was already there.
          description:
            typeof values.description === 'string' &&
            values.description.length === 0
              ? undefined
              : values.description,
        },
      });
      setSavedAt(Date.now());
      onSaved();
    } catch (err) {
      const handled = applyServerErrors(setError, err);
      if (!handled) {
        setError('root', {
          message:
            err instanceof ApiError ? err.message : 'Something went wrong',
        });
      } else if (err instanceof ApiError) {
        setError('root', { message: err.message });
      }
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
      <h3 className="text-sm font-semibold text-slate-700">Edit product</h3>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <FormField
          label="Name"
          id={`edit-name-${product.id}`}
          error={errors.name?.message}
          {...register('name')}
        />
        <FormField
          label="Slug"
          id={`edit-slug-${product.id}`}
          error={errors.slug?.message}
          {...register('slug')}
        />
        <FormField
          label="Price"
          id={`edit-price-${product.id}`}
          error={errors.price?.message}
          {...register('price')}
        />
        <FormField
          label="Stock"
          id={`edit-stock-${product.id}`}
          type="number"
          min={0}
          error={errors.stock?.message}
          {...register('stock', { valueAsNumber: true })}
        />
      </div>
      <div className="space-y-1">
        <label
          htmlFor={`edit-description-${product.id}`}
          className="block text-sm font-medium text-slate-800"
        >
          Description
        </label>
        <Textarea
          id={`edit-description-${product.id}`}
          rows={2}
          {...register('description')}
        />
      </div>
      {errors.root?.message ? (
        <Alert tone="error">{errors.root.message}</Alert>
      ) : null}
      {savedAt ? (
        <Alert tone="success" role="status">
          Product saved.
        </Alert>
      ) : null}
      <Button type="submit" disabled={isSubmitting || !isDirty}>
        {isSubmitting ? 'Saving…' : 'Save changes'}
      </Button>
    </form>
  );
}

// ── Image management ─────────────────────────────────────────────────────

function ProductImagesEditor({ product }: { product: Product }) {
  const upload = useUploadProductImage();
  const remove = useDeleteProductImage();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function onFileSelected(file: File | null) {
    if (!file) return;
    upload.mutate(
      { id: product.id, file },
      {
        onSettled: () => {
          // Reset so the same filename can be uploaded again (the input
          // otherwise won't fire onChange twice in a row for the same path).
          if (fileInputRef.current) fileInputRef.current.value = '';
        },
      },
    );
  }

  const uploadError =
    upload.error instanceof ApiError
      ? upload.error.message
      : upload.error
        ? 'Upload failed'
        : null;
  const removeError =
    remove.error instanceof ApiError
      ? remove.error.message
      : remove.error
        ? 'Remove failed'
        : null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-slate-700">Photos</h3>

      {product.images.length === 0 ? (
        <p className="text-sm text-slate-500">No photos yet.</p>
      ) : (
        <ul className="flex flex-wrap gap-3">
          {product.images.map((image) => (
            <li
              key={image.id}
              className="relative h-24 w-24 overflow-hidden rounded-md border border-slate-200"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={absoluteImageUrl(image.url)}
                alt=""
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                aria-label="Remove photo"
                onClick={() =>
                  remove.mutate({ id: product.id, imageId: image.id })
                }
                disabled={remove.isPending}
                className="absolute right-1 top-1 rounded-full bg-white/90 px-1.5 py-0.5 text-xs font-medium text-red-600 shadow hover:bg-white disabled:opacity-50"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center gap-3">
        <label
          htmlFor={`upload-${product.id}`}
          className="inline-flex cursor-pointer items-center rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          {upload.isPending ? 'Uploading…' : 'Add photo'}
        </label>
        <input
          ref={fileInputRef}
          id={`upload-${product.id}`}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          disabled={upload.isPending}
          onChange={(e) => onFileSelected(e.target.files?.[0] ?? null)}
          className="sr-only"
        />
        <span className="text-xs text-slate-500">
          JPEG/PNG/WEBP/GIF, up to 5 MB.
        </span>
      </div>

      {uploadError ? <Alert tone="error">{uploadError}</Alert> : null}
      {removeError ? <Alert tone="error">{removeError}</Alert> : null}
    </div>
  );
}

// ── Create form (unchanged) ──────────────────────────────────────────────

function CreateProductForm() {
  const createProduct = useCreateProduct();
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateProductInput>({
    resolver: zodResolver(CreateProductSchema),
    defaultValues: {
      name: '',
      slug: '',
      price: '',
      stock: 0,
      description: '',
    },
  });

  async function onSubmit(values: CreateProductInput) {
    try {
      await createProduct.mutateAsync({
        ...values,
        description: values.description ? values.description : undefined,
      });
      reset();
    } catch (err) {
      const handled = applyServerErrors(setError, err);
      if (!handled) {
        setError('root', {
          message:
            err instanceof ApiError ? err.message : 'Something went wrong',
        });
      } else if (err instanceof ApiError) {
        setError('root', { message: err.message });
      }
    }
  }

  return (
    <Card>
      <CardBody>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <h2 className="text-lg font-semibold">New product</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField
              label="Name"
              id="name"
              error={errors.name?.message}
              {...register('name')}
            />
            <FormField
              label="Slug"
              id="slug"
              placeholder="slug-in-kebab-case"
              error={errors.slug?.message}
              {...register('slug')}
            />
            <FormField
              label="Price"
              id="price"
              placeholder='e.g. "9.99"'
              error={errors.price?.message}
              {...register('price')}
            />
            <FormField
              label="Stock"
              id="stock"
              type="number"
              min={0}
              error={errors.stock?.message}
              {...register('stock', { valueAsNumber: true })}
            />
          </div>
          <div className="space-y-1">
            <label
              htmlFor="description"
              className="block text-sm font-medium text-slate-800"
            >
              Description
            </label>
            <Textarea
              id="description"
              rows={2}
              placeholder="Optional"
              {...register('description')}
            />
          </div>
          {errors.root?.message ? (
            <Alert tone="error">{errors.root.message}</Alert>
          ) : null}
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Creating…' : 'Create product'}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
