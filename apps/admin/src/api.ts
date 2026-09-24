import type { DashboardStats, Order, OrderStatus, PaymentStatus, Product } from '@duhahe/shared';

const PRODUCTION_API_URL = 'https://duhahe-market-1.onrender.com/api';
const BASE = (import.meta.env.VITE_API_URL as string) || PRODUCTION_API_URL;
export const API_BASE = BASE;
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
    if (res.status === 401) { clearToken(); window.dispatchEvent(new Event('auth:logout')); }
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

export interface AdminNotification {
  id: string;
  phone: string;
  title: string;
  body: string;
  kind: 'order' | 'general';
  createdAt: string;
  read: boolean;
}

export interface AdminCustomer {
  id: string;
  name: string;
  phone: string;
  role: 'customer';
  createdAt: string;
  addresses: {
    id: string;
    label: string;
    name: string;
    province: string;
    district: string;
    address?: string;
    isDefault: boolean;
  }[];
  orders: {
    id: string;
    orderNumber: string;
    status: OrderStatus;
    paymentStatus: PaymentStatus;
    total: number;
    createdAt: string;
  }[];
}

export interface OrderPaymentInfo {
  orderId: string;
  orderNumber: string;
  paymentMethod: Order['paymentMethod'];
  paymentStatus: PaymentStatus;
  providerReference?: string;
  total: number;
}

export type ProductPatch = Partial<{
  price: number;
  stockQty: number;
  organic: boolean;
  name: { en: string; kin: string; fr: string };
  description: { en: string; kin: string; fr: string };
  category: Product['category'];
  unit: Product['unit'];
  farmer: string;
  emoji: string;
  minOrderQty: number;
  step: number;
}>;

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

  updateInventory: (id: string, patch: ProductPatch) =>
    request<Envelope<Product>>(`/admin/inventory/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),

  addInventory: (product: Omit<Product, 'id'>) =>
    request<Envelope<Product>>('/admin/inventory', { method: 'POST', body: JSON.stringify(product) }),

  deleteInventory: (id: string) =>
    request<Envelope<Product>>(`/admin/inventory/${id}`, { method: 'DELETE' }),

  customers: () => request<Envelope<AdminCustomer[]>>('/admin/customers'),

  notifications: (phone?: string) =>
    request<Envelope<AdminNotification[]>>(`/admin/notifications${phone ? `?phone=${encodeURIComponent(phone)}` : ''}`),

  orderPayment: (id: string) => request<Envelope<OrderPaymentInfo>>(`/admin/orders/${id}/payment`),

  updateOrderPayment: (id: string, paymentStatus: PaymentStatus, note?: string) =>
    request<Envelope<Order>>(`/admin/orders/${id}/payment`, {
      method: 'PATCH',
      body: JSON.stringify({ paymentStatus, note }),
    }),
};

export type { DashboardStats, Order, OrderStatus, PaymentStatus, Product };