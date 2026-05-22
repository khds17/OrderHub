'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import {
  CreateProductSchema,
  type CreateProductInput,
} from '@orderhub/contracts';
import { AuthGuard } from '@/components/auth-guard';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { FormField } from '@/components/ui/form-field';
import { Textarea } from '@/components/ui/input';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { ApiError } from '@/lib/api-client';
import { applyServerErrors } from '@/lib/form-errors';
import { formatMoney } from '@/lib/format-money';
import {
  useActivateProduct,
  useCreateProduct,
  useDeactivateProduct,
  useProducts,
} from '@/hooks/queries';

export default function AdminProductsPage() {
  return (
    <AuthGuard roles={['ADMIN']}>
      <AdminProductsInner />
    </AuthGuard>
  );
}

function AdminProductsInner() {
  const { data, isLoading, error } = useProducts({ includeInactive: true });
  const deactivate = useDeactivateProduct();
  const activate = useActivateProduct();

  return (
    <section className="space-y-8">
      <h1 className="text-2xl font-semibold tracking-tight">Admin · Products</h1>

      <CreateProductForm />

      {(deactivate.error || activate.error) && (
        <ErrorState
          error={deactivate.error ?? activate.error}
          fallback="Failed to update product"
        />
      )}

      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState error={error} fallback="Failed to load products" />
      ) : !data || data.products.length === 0 ? (
        <p className="text-sm text-slate-500">No products yet.</p>
      ) : (
        <Card>
          <ul className="divide-y divide-slate-200">
            {data.products.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-4 p-3"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{p.name}</p>
                    <Badge tone={p.active ? 'success' : 'neutral'}>
                      {p.active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <p className="font-mono text-xs text-slate-500">{p.slug}</p>
                </div>
                <div className="text-right text-sm">
                  <p>{formatMoney(p.price)}</p>
                  <p className="text-slate-500">{p.stock} in stock</p>
                </div>
                {p.active ? (
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={deactivate.isPending}
                    onClick={() => deactivate.mutate(p.id)}
                  >
                    Deactivate
                  </Button>
                ) : (
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={activate.isPending}
                    onClick={() => activate.mutate(p.id)}
                    className="border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                  >
                    Activate
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </section>
  );
}

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
