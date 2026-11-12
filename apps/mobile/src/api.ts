import Constants from 'expo-constants';
import type { CategoryId, Language, Order, PaymentResult, PaymentSyncResponse, Product } from '@duhahe/shared';

const API_PORT = 4000;
const PRODUCTION_API_URL = 'https://duhahe-market-1.onrender.com/api';

function resolveBaseUrl(): string {
  const explicit = process.env.EXPO_PUBLIC_API_URL;
  if (explicit) return explicit.trim().replace(/\/+$/, '');
  // Release builds (APK/AAB): always talk to the production API — never LAN/dev.
  if (!__DEV__) return PRODUCTION_API_URL;
  // Dev builds: hit the machine running `npm run api` on the local network.
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const host = hostUri.trim().split(':')[0];
    return `http://${host}:${API_PORT}/api`;
  }
  return PRODUCTION_API_URL;
}

export const BASE_URL = resolveBaseUrl();

// The signed-in customer's token is attached to every request. Customer data (addresses, cart, favourites,
// notifications, orders) is identified by this token on the server, never by a phone number sent by the client.
let authToken: string | null = null;
let onUnauthorized: (() => void) | null = null;
export function setAuthToken(token: string | null) {
  authToken = token;
}
export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn;
}
function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return authToken ? { ...extra, Authorization: `Bearer ${authToken}` } : extra;
}
/** A 401 while a token is set means the session expired or was revoked: sign the customer out. */
function checkUnauthorized(res: Response) {
  if (res.status === 401 && authToken && onUnauthorized) onUnauthorized();
}

interface Envelope<T> {
  data: T;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, { headers: authHeaders() });
  checkUnauthorized(res);
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
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  checkUnauthorized(res);
  const body = await res.json();
  if (!res.ok || body.error) {
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }
  return body.data as T;
}

async function put<T>(path: string, payload: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'PUT',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  checkUnauthorized(res);
  const body = await res.json();
  if (!res.ok || body.error) {
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }
  return body.data as T;
}

async function del<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, { method: 'DELETE', headers: authHeaders() });
  checkUnauthorized(res);
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

  /** The signed-in customer's own orders. */
  myOrders: () => get<Order[]>('/orders/mine'),

  /** Guest-friendly lookup: both the order number and the phone it was placed with must match. */
  trackOrder: (orderNumber: string, phone: string) =>
    get<Order>(`/orders/track?orderNumber=${encodeURIComponent(orderNumber)}&phone=${encodeURIComponent(phone)}`),

  createPayment: (payload: {
    method: 'mtn_momo' | 'airtel_money' | 'cash_on_delivery';
    orderId: string;
    phone: string;
    amount: number;
    /** Customer-confirmed early retry ("I cancelled attempt <id> on my phone"); the server re-checks the provider first. */
    supersedeAttemptId?: string;
  }) => post<PaymentResult>('/payments/create', payload),

  /** `attemptId` pins the answer to one payment attempt, so a retry never shows an older attempt's result. */
  paymentStatus: (orderId: string, attemptId?: string) =>
    get<PaymentSyncResponse>(
      `/payments/status/${encodeURIComponent(orderId)}${attemptId ? `?attempt=${encodeURIComponent(attemptId)}` : ''}`
    ),
};

export interface AuthUser {
  id: string;
  name: string;
  phone: string;
  email?: string;
  phoneVerified?: boolean;
  createdAt: string;
}

export interface AuthSession {
  token: string;
  user: AuthUser;
}

export interface SignupStarted {
  email: string;
  /** True when an SMS code was also sent and must be entered. */
  phoneVerificationRequired: boolean;
  expiresInSeconds: number;
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
  /** Step 1: validates the details and sends verification codes. No account exists yet. */
  signup: (payload: { name: string; email: string; phone: string; password: string; confirmPassword: string }) =>
    post<SignupStarted>('/auth/signup', payload),
  resendCode: (email: string) => post<SignupStarted>('/auth/signup/resend', { email }),
  /** Step 2: the codes prove ownership of the email (and phone); only then the account is created. */
  verifySignup: (email: string, emailCode: string, phoneCode?: string) =>
    post<AuthSession>('/auth/signup/verify', { email, emailCode, phoneCode }),
  /** Emails a 6-digit reset code. Always answers the same, whether or not the email has an account. */
  forgotPassword: (email: string) => post<{ ok: boolean; expiresInSeconds: number }>('/auth/forgot', { email }),
  resetPassword: (payload: { email: string; code: string; password: string; confirmPassword: string }) =>
    post<AuthSession>('/auth/reset', payload),
  /** `identifier` is the email OR phone number the account was registered with. */
  login: (identifier: string, password: string) => post<AuthSession>('/auth/login', { identifier, password }),
  deleteAccount: async (token: string, password: string) => {
    const res = await fetch(`${BASE_URL}/auth/account`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ password }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || body.error) throw new Error(body.error ?? `Request failed (${res.status})`);
  },
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

export interface ServerCartLine {
  productId: string;
  qty: number;
}

export const cartApi = {
  get: (phone: string) => get<{ items: ServerCartLine[] }>(`/cart?phone=${encodeURIComponent(phone)}`),
  save: (phone: string, items: ServerCartLine[]) => put<{ items: ServerCartLine[] }>('/cart', { phone, items }),
};

export const favoritesApi = {
  get: (phone: string) => get<{ ids: string[] }>(`/favorites?phone=${encodeURIComponent(phone)}`),
  save: (phone: string, ids: string[]) => put<{ ids: string[] }>('/favorites', { phone, ids }),
  toggle: (phone: string, productId: string) => post<{ ids: string[] }>('/favorites/toggle', { phone, productId }),
};