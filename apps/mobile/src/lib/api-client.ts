import Constants from 'expo-constants';
import type {
  AuthResponse,
  AuthTokens,
  ChangePasswordInput,
  CreateOrderInput,
  LoginInput,
  Order,
  OrderWithItems,
  Pagination,
  PaymentMethod,
  PayOrderInput,
  Product,
  RefreshInput,
  RegisterInput,
  SavePaymentMethodInput,
  UpdateUserInput,
  User,
} from '@orderhub/contracts';
import { tokenStorage } from './token-storage';

const BASE_URL =
  (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl ??
  'http://localhost:3001';

export type FieldError = { field: string; message: string };
type SuccessEnvelope<T> = { status: 'success'; data: T };
type ErrorEnvelope = {
  status: 'error';
  code: string;
  message: string;
  errors?: FieldError[];
};
type Envelope<T> = SuccessEnvelope<T> | ErrorEnvelope;

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fieldErrors?: FieldError[],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  auth?: boolean;
};

let refreshInflight: Promise<boolean> | null = null;
let onAuthFailure: (() => void) | null = null;

export function setOnAuthFailure(cb: (() => void) | null) {
  onAuthFailure = cb;
}

async function attemptRefresh(): Promise<boolean> {
  if (refreshInflight) return refreshInflight;
  const refreshToken = tokenStorage.getRefresh();
  if (!refreshToken) return false;
  refreshInflight = (async () => {
    try {
      const res = await fetch(`${BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) return false;
      const parsed = (await res.json()) as Envelope<{ tokens: AuthTokens }>;
      if (parsed.status !== 'success') return false;
      await tokenStorage.set(
        parsed.data.tokens.accessToken,
        parsed.data.tokens.refreshToken,
      );
      return true;
    } catch {
      return false;
    } finally {
      refreshInflight = null;
    }
  })();
  return refreshInflight;
}

async function rawRequest(
  path: string,
  method: string,
  body: unknown,
  attachAuth: boolean,
): Promise<Response> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (attachAuth) {
    const token = tokenStorage.getAccess();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }
  return fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = 'GET', body, auth = true } = options;
  let res = await rawRequest(path, method, body, auth);

  if (res.status === 401 && auth) {
    const refreshed = await attemptRefresh();
    if (refreshed) {
      res = await rawRequest(path, method, body, true);
    } else {
      await tokenStorage.clear();
      onAuthFailure?.();
    }
  }

  if (res.status === 204) return undefined as T;

  let parsed: Envelope<T>;
  try {
    parsed = (await res.json()) as Envelope<T>;
  } catch {
    throw new ApiError(res.status, 'UNKNOWN', `HTTP ${res.status}`);
  }

  if (parsed.status === 'error') {
    throw new ApiError(res.status, parsed.code, parsed.message, parsed.errors);
  }
  return parsed.data;
}

type RefreshResponseData = { tokens: AuthTokens };

function buildPageQuery(page: { limit?: number; offset?: number }): string {
  const parts: string[] = [];
  if (page.limit !== undefined) parts.push(`limit=${page.limit}`);
  if (page.offset !== undefined) parts.push(`offset=${page.offset}`);
  return parts.length === 0 ? '' : `?${parts.join('&')}`;
}

export const api = {
  auth: {
    register: (input: RegisterInput) =>
      request<AuthResponse>('/auth/register', {
        method: 'POST',
        body: input,
        auth: false,
      }),
    login: (input: LoginInput) =>
      request<AuthResponse>('/auth/login', {
        method: 'POST',
        body: input,
        auth: false,
      }),
    refresh: (input: RefreshInput) =>
      request<RefreshResponseData>('/auth/refresh', {
        method: 'POST',
        body: input,
        auth: false,
      }),
    logout: (input: RefreshInput) =>
      request<void>('/auth/logout', {
        method: 'POST',
        body: input,
        auth: false,
      }),
    changePassword: (input: ChangePasswordInput) =>
      request<void>('/auth/change-password', { method: 'POST', body: input }),
  },
  users: {
    me: () => request<{ user: User }>('/users/me'),
    updateMe: (input: UpdateUserInput) =>
      request<{ user: User }>('/users/me', { method: 'PATCH', body: input }),
    paymentMethod: {
      get: () =>
        request<{ paymentMethod: PaymentMethod | null }>(
          '/users/me/payment-method',
        ),
      save: (input: SavePaymentMethodInput) =>
        request<{ paymentMethod: PaymentMethod }>('/users/me/payment-method', {
          method: 'PUT',
          body: input,
        }),
      delete: () =>
        request<void>('/users/me/payment-method', { method: 'DELETE' }),
    },
  },
  products: {
    list: (
      options: { q?: string; limit?: number; offset?: number } = {},
    ) => {
      const params: string[] = [];
      if (options.q) params.push(`q=${encodeURIComponent(options.q)}`);
      if (options.limit !== undefined) params.push(`limit=${options.limit}`);
      if (options.offset !== undefined) params.push(`offset=${options.offset}`);
      const qs = params.length === 0 ? '' : `?${params.join('&')}`;
      return request<{ products: Product[]; pagination: Pagination }>(
        `/products${qs}`,
        { auth: false },
      );
    },
    byIdOrSlug: (idOrSlug: string) =>
      request<{ product: Product }>(
        `/products/${encodeURIComponent(idOrSlug)}`,
        { auth: false },
      ),
  },
  orders: {
    create: (input: CreateOrderInput) =>
      request<{ order: OrderWithItems }>('/orders', {
        method: 'POST',
        body: input,
      }),
    listMine: (page: { limit?: number; offset?: number } = {}) =>
      request<{
        orders: Order[];
        pagination: { limit: number; offset: number };
      }>(`/orders/me${buildPageQuery(page)}`),
    byId: (id: string) =>
      request<{ order: OrderWithItems }>(`/orders/${id}`),
    cancel: (id: string) =>
      request<{ order: OrderWithItems }>(`/orders/${id}/cancel`, {
        method: 'POST',
      }),
    pay: (id: string, input: PayOrderInput) =>
      request<{ order: OrderWithItems }>(`/orders/${id}/pay`, {
        method: 'POST',
        body: input,
      }),
  },
};
