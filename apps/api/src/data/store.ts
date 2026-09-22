import { PRODUCTS, type Order, type OrderStatus, type Product } from '@duhahe/shared';
import { connectDatabase, getDatabase } from './database';

/**
 * In-memory data store.
 *
 * NOTE (Phase 2): swap the internals of this module for MongoDB (Mongoose)
 * repositories without changing the route handlers, which only talk to the
 * functions exported here.
 */

export interface CustomerUser {
  id: string;
  name: string;
  phone: string;
  role: 'customer';
  createdAt: string;
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

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: 'admin';
  passwordHash: string;
}

export const products: Map<string, Product> = new Map(
  PRODUCTS.map((prod) => [prod.id, { ...prod }])
);

export const orders: Order[] = [];

export const users: Map<string, CustomerUser> = new Map();
export const otpCodes: Map<string, { code: string; expiresAt: number }> = new Map();
export const notifications: AppNotification[] = [];
export const addresses: SavedAddress[] = [];

/** Per-phone favourites (`phone` → list of product ids). */
export const favoritesByPhone: Map<string, string[]> = new Map();
/** Per-phone saved carts (`phone` → list of cart lines). */
export const cartsByPhone: Map<string, { productId: string; qty: number }[]> = new Map();

function normalizePhone(phone: string): string {
  return (phone ?? '').replace(/\D/g, '');
}

export async function initializeStore(): Promise<void> {
  const db = await connectDatabase();
  if (!db) return;

  const [storedProducts, storedOrders, storedUsers, storedNotifications, storedAddresses, storedFavorites, storedCarts] = await Promise.all([
    db.collection<Product>('products').find().toArray(),
    db.collection<Order>('orders').find().sort({ createdAt: -1 }).toArray(),
    db.collection<CustomerUser>('users').find().toArray(),
    db.collection<AppNotification>('notifications').find().sort({ createdAt: -1 }).toArray(),
    db.collection<SavedAddress>('addresses').find().sort({ _id: -1 }).toArray(),
    db.collection<{ phone: string; productIds: string[] }>('favorites').find().toArray(),
    db.collection<{ phone: string; items: { productId: string; qty: number }[] }>('carts').find().toArray(),
  ]);

  products.clear();
  for (const product of storedProducts.length ? storedProducts : PRODUCTS) products.set(product.id, product);
  orders.splice(0, orders.length, ...storedOrders);
  users.clear();
  for (const user of storedUsers) users.set(user.phone, user);
  notifications.splice(0, notifications.length, ...storedNotifications);
  addresses.splice(0, addresses.length, ...storedAddresses);
  favoritesByPhone.clear();
  for (const fav of storedFavorites) favoritesByPhone.set(normalizePhone(fav.phone), fav.productIds);
  cartsByPhone.clear();
  for (const cart of storedCarts) cartsByPhone.set(normalizePhone(cart.phone), cart.items);

  if (!storedProducts.length) await db.collection<Product>('products').insertMany([...products.values()]);
}

export async function persistStore(): Promise<void> {
  const db = getDatabase();
  if (!db) return;
  await Promise.all([
    db.collection<Product>('products').deleteMany({}).then(() => db.collection<Product>('products').insertMany([...products.values()])),
    db.collection<Order>('orders').deleteMany({}).then(async () => { if (orders.length) await db.collection<Order>('orders').insertMany(orders); }),
    db.collection<CustomerUser>('users').deleteMany({}).then(async () => { if (users.size) await db.collection<CustomerUser>('users').insertMany([...users.values()]); }),
    db.collection<AppNotification>('notifications').deleteMany({}).then(async () => { if (notifications.length) await db.collection<AppNotification>('notifications').insertMany(notifications); }),
    db.collection<SavedAddress>('addresses').deleteMany({}).then(async () => { if (addresses.length) await db.collection<SavedAddress>('addresses').insertMany(addresses); }),
    db.collection<{ phone: string; productIds: string[] }>('favorites').deleteMany({}).then(async () => { if (favoritesByPhone.size) await db.collection<{ phone: string; productIds: string[] }>('favorites').insertMany([...favoritesByPhone.entries()].map(([phone, productIds]) => ({ phone, productIds }))); }),
    db.collection<{ phone: string; items: { productId: string; qty: number }[] }>('carts').deleteMany({}).then(async () => { if (cartsByPhone.size) await db.collection<{ phone: string; items: { productId: string; qty: number }[] }>('carts').insertMany([...cartsByPhone.entries()].map(([phone, items]) => ({ phone, items }))); }),
  ]);
}

let persistenceQueue = Promise.resolve();

function persistSoon(): void {
  persistenceQueue = persistenceQueue
    .then(() => persistStore())
    .catch((error) => console.error('MongoDB persistence error:', error));
}

export function listAddressesFor(phone: string): SavedAddress[] {
  const digits = phone.replace(/\D/g, '');
  return addresses.filter((a) => a.phone.replace(/\D/g, '') === digits);
}

export function addAddress(data: Omit<SavedAddress, 'id'>): SavedAddress {
  const entry: SavedAddress = { ...data, id: `adr-${crypto.randomUUID().slice(0, 8)}` };
  if (entry.isDefault || listAddressesFor(entry.phone).length === 0) {
    addresses.forEach((a) => {
      if (a.phone === entry.phone) a.isDefault = false;
    });
    entry.isDefault = true;
  }
  addresses.unshift(entry);
  persistSoon();
  return entry;
}

export function removeAddress(id: string): SavedAddress | undefined {
  const idx = addresses.findIndex((a) => a.id === id);
  if (idx === -1) return undefined;
  const removed = addresses.splice(idx, 1)[0];
  persistSoon();
  return removed;
}

export function setDefaultAddress(phone: string, id: string): SavedAddress | undefined {
  const digits = phone.replace(/\D/g, '');
  let updated: SavedAddress | undefined;
  addresses.forEach((a) => {
    if (a.phone.replace(/\D/g, '') === digits) {
      a.isDefault = a.id === id;
      if (a.isDefault) updated = a;
    }
  });
  persistSoon();
  return updated;
}

export function getFavoritesFor(phone: string): string[] {
  const digits = normalizePhone(phone);
  return favoritesByPhone.get(digits) ?? [];
}

export function setFavoritesFor(phone: string, ids: string[]): string[] {
  const clean = Array.from(new Set((ids ?? []).filter((id) => typeof id === 'string' && id.trim().length > 0)));
  favoritesByPhone.set(normalizePhone(phone), clean);
  persistSoon();
  return clean;
}

export function toggleFavorite(phone: string, productId: string): string[] {
  const digits = normalizePhone(phone);
  const current = favoritesByPhone.get(digits) ?? [];
  const next = current.includes(productId) ? current.filter((x) => x !== productId) : [...current, productId];
  favoritesByPhone.set(digits, next);
  persistSoon();
  return next;
}

export function getCartFor(phone: string): { productId: string; qty: number }[] {
  return cartsByPhone.get(normalizePhone(phone)) ?? [];
}

export function setCartFor(phone: string, items: { productId: string; qty: number }[]): { productId: string; qty: number }[] {
  const clean = (items ?? [])
    .filter(
      (i) =>
        i &&
        typeof i.productId === 'string' &&
        i.productId.trim().length > 0 &&
        Number.isFinite(i.qty) &&
        i.qty > 0
    )
    .map((i) => ({ productId: i.productId, qty: Math.round(i.qty * 100) / 100 }));
  cartsByPhone.set(normalizePhone(phone), clean);
  persistSoon();
  return clean;
}

export function upsertUser(user: CustomerUser): CustomerUser {
  users.set(user.phone, user);
  persistSoon();
  return user;
}

export function getUserByPhone(phone: string): CustomerUser | undefined {
  return users.get(phone);
}

export function setOtp(phone: string, code: string): void {
  otpCodes.set(phone, { code, expiresAt: Date.now() + 5 * 60 * 1000 });
}

export function consumeOtp(phone: string, code: string): boolean {
  const entry = otpCodes.get(phone);
  if (!entry) return false;
  if (entry.code !== code) return false;
  if (entry.expiresAt < Date.now()) {
    otpCodes.delete(phone);
    return false;
  }
  otpCodes.delete(phone);
  return true;
}

export function pushNotification(data: Omit<AppNotification, 'id' | 'createdAt' | 'read'>): AppNotification {
  const note: AppNotification = {
    ...data,
    id: `ntf-${crypto.randomUUID().slice(0, 8)}`,
    createdAt: new Date().toISOString(),
    read: false,
  };
  notifications.unshift(note);
  persistSoon();
  return note;
}

export function listNotificationsFor(phone: string): AppNotification[] {
  const digits = phone.replace(/\D/g, '');
  return notifications.filter((n) => n.phone.replace(/\D/g, '') === digits).slice(0, 50);
}

export function markNotificationRead(id: string): AppNotification | undefined {
  const note = notifications.find((n) => n.id === id);
  if (note) note.read = true;
  persistSoon();
  return note;
}

export const adminUser: AdminUser = {
  id: 'admin-1',
  name: 'Esperance Mukabaranga',
  email: 'admin@duhahe.rw',
  role: 'admin',
  passwordHash: 'admin123', // TBD: replace with bcrypt hash in Phase 2
};

export function updateProduct(id: string, patch: Partial<Omit<Product, 'id'>>): Product | undefined {
  const prod = products.get(id);
  if (!prod) return undefined;
  Object.assign(prod, patch);
  persistSoon();
  return prod;
}

export function addProduct(product: Product): Product {
  products.set(product.id, product);
  persistSoon();
  return product;
}

export function deleteProduct(id: string): Product | undefined {
  const removed = products.get(id);
  if (!removed) return undefined;
  products.delete(id);
  for (const [phone, ids] of favoritesByPhone) {
    favoritesByPhone.set(phone, ids.filter((pid) => pid !== id));
  }
  for (const [phone, lines] of cartsByPhone) {
    cartsByPhone.set(phone, lines.filter((line) => line.productId !== id));
  }
  persistSoon();
  return removed;
}

export function listCustomers(): CustomerUser[] {
  return [...users.values()];
}

export function listAllNotifications(): AppNotification[] {
  return [...notifications];
}

export function createOrder(order: Order): Order {
  order.tracking = [{ updatedAt: new Date().toISOString(), note: 'Order received' }];
  orders.unshift(order);
  persistSoon();
  return order;
}

export function updateOrderStatus(id: string, status: OrderStatus, note?: string): Order | undefined {
  const order = orders.find((o) => o.id === id);
  if (!order) return undefined;
  const changed = order.status !== status;
  order.status = status;
  order.tracking?.push({ updatedAt: new Date().toISOString(), note: note ?? `Status → ${status}` });
  if (changed) {
    const label = status.replace('_', ' ');
    pushNotification({
      phone: order.customer.phone,
      title: status === 'delivered' ? 'Order delivered' : 'Order update',
      body:
        status === 'cancelled'
          ? `Order ${order.orderNumber} was cancelled.`
          : status === 'delivered'
          ? `Order ${order.orderNumber} has been delivered. Enjoy!`
          : `Order ${order.orderNumber} is now ${label}.`,
      kind: 'order',
    });
  }
  persistSoon();
  return order;
}

export function updateOrderPaymentStatus(id: string, status: Order['paymentStatus'], providerReference?: string): Order | undefined {
  const order = orders.find((o) => o.id === id);
  if (!order) return undefined;
  order.paymentStatus = status;
  if (providerReference) order.providerReference = providerReference;
  persistSoon();
  return order;
}

export function getStatsBase() {
  return { productCount: products.size, outOfStock: [...products.values()].filter((p) => p.stockQty <= 0).length };
}

export function getProductById(id: string): Product | undefined {
  return products.get(id);
}

export { PRODUCTS as DEFAULT_PRODUCTS };