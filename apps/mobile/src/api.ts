import Constants from 'expo-constants';
import type { CategoryId, Language, Order, PaymentResult, Product } from '@duhahe/shared';

const API_PORT = 4000;

function resolveBaseUrl(): string {
  const explicit = process.env.EXPO_PUBLIC_API_URL;
  if (explicit) return explicit.replace(/\/$/, '');
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const host = hostUri.split(':')[0];
    return `http://${host}:${API_PORT}/api`;
  }
  return `http://localhost:${API_PORT}/api`;
}

export const BASE_URL = resolveBaseUrl();

interface Envelope<T> {
  data: T;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  const body = (await res.json()) as Envelope<T>;
  return body.data;
}

async function authGet<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  const body = (await res.json()) as Envelope<T>;
  return body.data;
}

async function post<T>(path: string, payload: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await res.json();
  if (!res.ok || body.error) {
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }
  return body.data as T;
}

async function del<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, { method: 'DELETE' });
  const body = await res.json();
  if (!res.ok || body.error) {
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }
  return body.data as T;
}

export const api = {
  products: (params?: { lang?: Language; search?: string; category?: CategoryId; sort?: string }) => {
    const qs = new URLSearchParams();
    if (params?.lang) qs.set('lang', params.lang);
    if (params?.search) qs.set('search', params.search);
    if (params?.category) qs.set('category', params.category);
    if (params?.sort) qs.set('sort', params.sort);
    return get<Product[]>(`/products?${qs.toString()}`);
  },

  product: (id: string) => get<Product>(`/products/${id}`),

  categories: (lang?: Language) =>
    get<{ id: CategoryId; label: Record<Language, string>; count: number }[]>(
      `/categories${lang ? `?lang=${lang}` : ''}`
    ),

  calculateOrder: (items: { productId: string; qty: number }[], district?: string) =>
    post<{ items: { productId: string; qty: number; lineTotal: number }[]; subtotal: number; deliveryFee: number; total: number }>(
      '/orders/calculate',
      { items, district }
    ),

  createOrder: (payload: {
    items: { productId: string; qty: number }[];
    customer: { name: string; phone: string; email?: string; province?: string; district?: string; address?: string };
    paymentMethod: 'mtn_momo' | 'airtel_money' | 'cash_on_delivery';
    note?: string;
  }) => post<Order>('/orders', payload),

  recentOrders: (phone: string) => get<Order[]>(`/orders/${encodeURIComponent(phone)}/recent`),

  stubPayment: (payload: { method: 'mtn_momo' | 'airtel_money'; orderId: string; phone: string; amount: number }) =>
    post<PaymentResult>('/payments/stub', payload),
};

export interface AuthUser {
  id: string;
  name: string;
  phone: string;
  createdAt: string;
}

export interface AuthSession {
  token: string;
  user: AuthUser;
}

export function demoSession(name: string, phone: string): AuthSession {
  return {
    token: `demo-${phone}`,
    user: { id: `demo-${phone}`, name, phone, createdAt: new Date().toISOString() },
  };
}

export interface OtpResult {
  phone: string;
  demoCode: string;
  registered: boolean;
}

export interface AppNotification {
  id: string;
  phone: string;
  title: string;
  body: string;
  kind: 'order' | 'general';
  createdAt: string;
  read: boolean;
}

export const authApi = {
  signup: (name: string, phone: string) => post<AuthSession>('/auth/signup', { name, phone }),
  requestOtp: (phone: string) => post<OtpResult>('/auth/request-otp', { phone }),
  verifyOtp: (phone: string, code: string) => post<AuthSession>('/auth/verify', { phone, code }),
  me: (token: string) => authGet<{ user: AuthUser }>('/auth/me', token),
  notifications: (phone: string) => get<AppNotification[]>(`/notifications?phone=${encodeURIComponent(phone)}`),
  markNotificationRead: (id: string) => post<AppNotification>(`/notifications/${id}/read`, {}),
};

export interface SavedAddress {
  id: string;
  phone: string;
  label: string;
  name: string;
  province: string;
  district: string;
  address?: string;
  isDefault: boolean;
}

export const addressApi = {
  list: (phone: string) => get<SavedAddress[]>(`/addresses?phone=${encodeURIComponent(phone)}`),
  save: (payload: { phone: string; label?: string; name: string; province: string; district: string; address?: string; isDefault?: boolean }) =>
    post<SavedAddress>('/addresses', payload),
  remove: (id: string) => del<SavedAddress>(`/addresses/${id}`),
  setDefault: (phone: string, id: string) => post<SavedAddress>(`/addresses/${id}/default`, { phone }),
};