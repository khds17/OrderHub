'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateOrderInput,
  CreateProductInput,
} from '@orderhub/contracts';
import { api } from '@/lib/api-client';

export const queryKeys = {
  productsActive: () => ['products', { includeInactive: false }] as const,
  productsAll: () => ['products', { includeInactive: true }] as const,
  product: (idOrSlug: string) => ['product', idOrSlug] as const,
  myOrders: (offset: number, limit: number) =>
    ['orders', 'me', { offset, limit }] as const,
  allOrders: (offset: number, limit: number) =>
    ['orders', 'all', { offset, limit }] as const,
  order: (id: string) => ['order', id] as const,
};

export function useProducts(options: { includeInactive?: boolean } = {}) {
  const includeInactive = options.includeInactive === true;
  return useQuery({
    queryKey: includeInactive
      ? queryKeys.productsAll()
      : queryKeys.productsActive(),
    queryFn: () => api.products.list({ includeInactive }),
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
