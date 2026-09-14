import type { DashboardStats, Order, OrderStatus, Product } from '@duhahe/shared';

const BASE = (import.meta.env.VITE_API_URL as string) ?? 'http://localhost:4000/api';
const TOKEN_KEY = 'duhahe_admin_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    if (res.status === 401) clearToken();
    throw new Error((body as { error?: string }).error ?? `Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

export interface Envelope<T> {
  data: T;
}

export interface Comparison {
  today: number;
  yesterday: number;
  changePct: number;
}

export interface AdminProfile {
  id: string;
  name: string;
  email: string;
  role: string;
}

export const api = {
  login: (email: string, password: string) =>
    request<Envelope<{ token: string; admin: { name: string; email: string } }>>('/admin/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  me: () => request<Envelope<AdminProfile>>('/admin/me'),

  stats: () => request<{ data: DashboardStats; comparison?: Comparison }>('/admin/stats'),

  orders: () => request<Envelope<Order[]>>('/admin/orders'),

  order: (id: string) => request<Envelope<Order>>(`/admin/orders/${id}`),

  updateOrderStatus: (id: string, status: OrderStatus, note?: string) =>
    request<Envelope<Order>>(`/admin/orders/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, note }),
    }),

  inventory: () => request<Envelope<Product[]>>('/admin/inventory'),

  updateInventory: (id: string, patch: { price?: number; stockQty?: number; organic?: boolean }) =>
    request<Envelope<Product>>(`/admin/inventory/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),

  addInventory: (product: Omit<Product, 'id'>) =>
    request<Envelope<Product>>('/admin/inventory', { method: 'POST', body: JSON.stringify(product) }),
};

export type { DashboardStats, Order, OrderStatus, Product };