'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ChangePasswordInput,
  CreateOrderInput,
  CreateProductInput,
  PayOrderInput,
  SavePaymentMethodInput,
  UpdateProductInput,
  UpdateUserInput,
} from '@orderhub/contracts';
import { api } from '@/lib/api-client';
import { useAuth } from '@/features/auth/use-auth';

export type ProductsListOptions = {
  q?: string;
  limit?: number;
  offset?: number;
  includeInactive?: boolean;
};

export const queryKeys = {
  productsList: (options: ProductsListOptions) =>
    [
      'products',
      {
        // Normalise so different falsy values share a cache slot.
        q: options.q ?? '',
        limit: options.limit ?? null,
        offset: options.offset ?? null,
        includeInactive: options.includeInactive === true,
      },
    ] as const,
  product: (idOrSlug: string) => ['product', idOrSlug] as const,
  myOrders: (offset: number, limit: number) =>
    ['orders', 'me', { offset, limit }] as const,
  allOrders: (offset: number, limit: number) =>
    ['orders', 'all', { offset, limit }] as const,
  order: (id: string) => ['order', id] as const,
  paymentMethod: () => ['payment-method', 'me'] as const,
};

export function useProducts(options: ProductsListOptions = {}) {
  return useQuery({
    queryKey: queryKeys.productsList(options),
    queryFn: () =>
      api.products.list({
        q: options.q,
        limit: options.limit,
        offset: options.offset,
        includeInactive: options.includeInactive,
      }),
  });
}

export function useProduct(slug: string) {
  return useQuery({
    queryKey: queryKeys.product(slug),
    queryFn: () => api.products.byIdOrSlug(slug),
    enabled: Boolean(slug),
  });
}

export function useMyOrders(offset = 0, limit = 20) {
  return useQuery({
    queryKey: queryKeys.myOrders(offset, limit),
    queryFn: () => api.orders.listMine({ offset, limit }),
  });
}

export function useAllOrders(offset = 0, limit = 20) {
  return useQuery({
    queryKey: queryKeys.allOrders(offset, limit),
    queryFn: () => api.orders.listAll({ offset, limit }),
  });
}

export function useOrder(id: string) {
  return useQuery({
    queryKey: queryKeys.order(id),
    queryFn: () => api.orders.byId(id),
    enabled: Boolean(id),
  });
}

export function useCreateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateOrderInput) => api.orders.create(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['orders'] });
      void qc.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

export function useCancelOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.orders.cancel(id),
    onSuccess: (data, id) => {
      // Refresh the single-order view, both order lists, and product stock
      // (cancel restores stock, so the catalog will be stale).
      void qc.invalidateQueries({ queryKey: queryKeys.order(id) });
      void qc.invalidateQueries({ queryKey: ['orders'] });
      void qc.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

export function usePayOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: PayOrderInput }) =>
      api.orders.pay(id, input),
    onSuccess: (_data, { id }) => {
      // Refresh single-order view + order lists. Stock isn't affected.
      void qc.invalidateQueries({ queryKey: queryKeys.order(id) });
      void qc.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateProductInput) => api.products.create(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

export function useDeactivateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.products.deactivate(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

export function useActivateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.products.activate(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

export function useUpdateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateProductInput }) =>
      api.products.update(id, input),
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: ['products'] });
      // Detail page is cached by slug → invalidate that too.
      void qc.invalidateQueries({ queryKey: queryKeys.product(data.product.slug) });
      void qc.invalidateQueries({ queryKey: queryKeys.product(data.product.id) });
    },
  });
}

export function useUploadProductImage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) =>
      api.products.uploadImage(id, file),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['products'] });
      void qc.invalidateQueries({ queryKey: ['product'] });
    },
  });
}

export function useDeleteProductImage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, imageId }: { id: string; imageId: string }) =>
      api.products.deleteImage(id, imageId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['products'] });
      void qc.invalidateQueries({ queryKey: ['product'] });
    },
  });
}

// ── Profile ──────────────────────────────────────────────────────────────

/**
 * Update personal info (name / surname / address / email). On success, also
 * refreshes the auth store so the nav and any other `useAuth(s => s.user)`
 * consumer reflects the new values without a page reload.
 */
export function useUpdateMe() {
  const refreshUser = useAuth((s) => s.refreshUser);
  return useMutation({
    mutationFn: (input: UpdateUserInput) => api.users.updateMe(input),
    onSuccess: () => {
      void refreshUser();
    },
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (input: ChangePasswordInput) => api.auth.changePassword(input),
  });
}

export function usePaymentMethod() {
  return useQuery({
    queryKey: queryKeys.paymentMethod(),
    queryFn: () => api.users.paymentMethod.get(),
  });
}

export function useSavePaymentMethod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SavePaymentMethodInput) =>
      api.users.paymentMethod.save(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.paymentMethod() });
    },
  });
}

export function useDeletePaymentMethod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.users.paymentMethod.delete(),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.paymentMethod() });
    },
  });
}
