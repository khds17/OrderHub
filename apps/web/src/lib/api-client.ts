import type {
  AuthResponse,
  AuthTokens,
  CreateOrderInput,
  CreateProductInput,
  LoginInput,
  Order,
  OrderWithItems,
  Product,
  RefreshInput,
  RegisterInput,
  UpdateProductInput,
  UpdateUserInput,
  User,
} from '@orderhub/contracts';
import { tokenStorage } from './token-storage';

const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

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
  /** When true (default), attaches `Authorization: Bearer <token>` if available. */
  auth?: boolean;
};

let refreshInflight: Promise<boolean> | null = null;
// Callback the auth store can register so a successful refresh updates UI state
// without forcing a reload.
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
      tokenStorage.set(parsed.data.tokens.accessToken, parsed.data.tokens.refreshToken);
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

  // Transparent refresh on 401 for authenticated requests.
  if (res.status === 401 && auth) {
    const refreshed = await attemptRefresh();
    if (refreshed) {
      res = await rawRequest(path, method, body, true);
    } else {
      tokenStorage.clear();
      onAuthFailure?.();
    }
  }

  // 204 No Content — no body to parse.
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
  },
  users: {
    me: () => request<{ user: User }>('/users/me'),
    updateMe: (input: UpdateUserInput) =>
      request<{ user: User }>('/users/me', { method: 'PATCH', body: input }),
    list: () => request<{ users: User[] }>('/users'),
    byId: (id: string) => request<{ user: User }>(`/users/${id}`),
  },
  products: {
    list: (options: { includeInactive?: boolean } = {}) => {
      const qs = options.includeInactive ? '?includeInactive=true' : '';
      return request<{ products: Product[] }>(`/products${qs}`, {
        // Send auth when we ask for inactive products; the server requires admin.
        auth: options.includeInactive === true,
      });
    },
    byIdOrSlug: (idOrSlug: string) =>
      request<{ product: Product }>(`/products/${encodeURIComponent(idOrSlug)}`, {
        auth: false,
      }),
    create: (input: CreateProductInput) =>
      request<{ product: Product }>('/products', { method: 'POST', body: input }),
    update: (id: string, input: UpdateProductInput) =>
      request<{ product: Product }>(`/products/${id}`, {
        method: 'PATCH',
        body: input,
      }),
    deactivate: (id: string) =>
      request<{ product: Product }>(`/products/${id}/deactivate`, {
        method: 'PATCH',
      }),
    activate: (id: string) =>
      request<{ product: Product }>(`/products/${id}/activate`, {
        method: 'PATCH',
      }),
  },
  orders: {
    create: (input: CreateOrderInput) =>
      request<{ order: OrderWithItems }>('/orders', {
        method: 'POST',
        body: input,
      }),
    listMine: (page: { limit?: number; offset?: number } = {}) =>
      request<{ orders: Order[]; pagination: { limit: number; offset: number } }>(
        `/orders/me${buildPageQuery(page)}`,
      ),
    listAll: (page: { limit?: number; offset?: number } = {}) =>
      request<{ orders: Order[]; pagination: { limit: number; offset: number } }>(
        `/orders${buildPageQuery(page)}`,
      ),
    byId: (id: string) =>
      request<{ order: OrderWithItems }>(`/orders/${id}`),
  },
};

function buildPageQuery(page: {
  limit?: number;
  offset?: number;
}): string {
  const parts: string[] = [];
  if (page.limit !== undefined) parts.push(`limit=${page.limit}`);
  if (page.offset !== undefined) parts.push(`offset=${page.offset}`);
  return parts.length === 0 ? '' : `?${parts.join('&')}`;
}
