import { PRODUCTS, type Order, type OrderStatus, type Product } from '@duhahe/shared';
import type { Db } from 'mongodb';
import { config } from '../config';
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
  /** scrypt hash for password login (salt:hash). Never sent to clients. */
  passwordHash?: string;
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

/** True once the in-memory store reflects a completed load (authoritative). */
let storeLoaded = false;

export async function initializeStore(): Promise<void> {
  const db = await connectDatabase();
  if (!db) {
    storeLoaded = true;
    return;
  }

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
  await ensureIndexes(db);
  storeLoaded = true;
}

/**
 * Unique identity per document: duplicates in the DB would break the
 * upsert-based sync, so enforce it up front. Best-effort — if historic data
 * already contains duplicates we log and continue instead of refusing to boot.
 */
async function ensureIndexes(db: Db): Promise<void> {
  const results = await Promise.allSettled([
    db.collection('users').createIndex({ phone: 1 }, { unique: true }),
    db.collection('orders').createIndex({ id: 1 }, { unique: true }),
    db.collection('products').createIndex({ id: 1 }, { unique: true }),
    db.collection('favorites').createIndex({ phone: 1 }, { unique: true }),
    db.collection('carts').createIndex({ phone: 1 }, { unique: true }),
  ]);
  for (const result of results) {
    if (result.status === 'rejected') {
      console.warn('MongoDB index not created (continuing):', result.reason instanceof Error ? result.reason.message : result.reason);
    }
  }
}

/**
 * Persist the in-memory store to MongoDB.
 *
 * Data-loss prevention rules:
 *  1. NEVER delete-all-then-reinsert. Every document is written with an
 *     UPSERT first; only keys that no longer exist in memory are removed
 *     afterwards, and only after the upserts succeeded. A crash mid-sync can
 *     therefore never wipe a collection.
 *  2. DEMO_MODE never writes. A demo run must not be able to overwrite
 *     production data with seeded/demo rows.
 *  3. The sync is idempotent, so automatic retries after failures are safe.
 */
export async function persistStore(): Promise<void> {
  const db = getDatabase();
  if (!db || config.demoMode) return;
  if (!storeLoaded) {
    console.warn('persistStore skipped: the store has not finished loading.');
    return;
  }
  await syncCollection(db, 'products', 'id', [...products.values()]);
  await syncCollection(db, 'orders', 'id', orders);
  await syncCollection(db, 'users', 'phone', [...users.values()]);
  await syncCollection(db, 'notifications', 'id', notifications);
  await syncCollection(db, 'addresses', 'id', addresses);
  await syncCollection(db, 'favorites', 'phone', [...favoritesByPhone.entries()].map(([phone, productIds]) => ({ phone, productIds })));
  await syncCollection(db, 'carts', 'phone', [...cartsByPhone.entries()].map(([phone, items]) => ({ phone, items })));
}

/** Upsert every document, then delete only keys that are gone from memory. */
async function syncCollection(db: Db, name: string, key: string, docs: object[]): Promise<void> {
  const byKey = new Map<unknown, Record<string, unknown>>();
  for (const doc of docs) {
    const copy: Record<string, unknown> = { ...(doc as Record<string, unknown>) };
    delete copy._id; // let MongoDB keep the existing _id when replacing
    byKey.set(copy[key], copy); // duplicate keys collapse to one (last wins)
  }
  const rows = [...byKey.values()];
  if (rows.length) {
    await db.collection(name).bulkWrite(
      rows.map((doc) => ({
        replaceOne: { filter: { [key]: doc[key] }, replacement: doc, upsert: true },
      })),
      { ordered: false }
    );
    await db.collection(name).deleteMany({ [key]: { $nin: rows.map((doc) => doc[key]) } });
  } else {
    // Memory says the collection is empty; only reachable after a full load.
    await db.collection(name).deleteMany({});
  }
}

/**
 * Debounced, coalesced persistence:
 *  - mutations only mark the store dirty and start a short timer, so a burst of
 *    writes results in ONE sync of the latest state;
 *  - a failed sync is retried automatically, so a transient MongoDB blip never
 *    silently drops a change until the next unrelated mutation;
 *  - flushStore() forces a final sync on graceful shutdown.
 */
let persistenceQueue = Promise.resolve();
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let dirty = false;
let flushing = false;

function runPendingPersist(): Promise<void> {
  if (!dirty) return persistenceQueue;
  dirty = false;
  persistenceQueue = persistenceQueue.then(async () => {
    try {
      await persistStore();
    } catch (error) {
      dirty = true;
      console.error('MongoDB persistence error:', error);
      if (!flushing && !retryTimer) {
        retryTimer = setTimeout(() => {
          retryTimer = null;
          void runPendingPersist();
        }, 5000);
        retryTimer.unref?.();
        console.warn('MongoDB persistence retry scheduled in 5s.');
      }
    }
  });
  return persistenceQueue;
}

function persistSoon(delay = 400): void {
  dirty = true;
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void runPendingPersist();
  }, delay);
  flushTimer.unref?.();
}

/** Force pending changes into MongoDB (graceful shutdown / final sync). */
export async function flushStore(): Promise<void> {
  flushing = true;
  try {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
    // One retry on shutdown in case the first attempt hits a blip.
    for (let attempt = 1; attempt <= 2 && dirty; attempt += 1) {
      await runPendingPersist();
      await persistenceQueue;
      if (dirty && attempt < 2) console.warn('flushStore: attempt failed, retrying once…');
    }
    // Always wait for a sync that may already be in flight (its timer was
    // consumed before shutdown started) so it finishes before we close the DB.
    await persistenceQueue;
    if (dirty) console.error('flushStore: store still dirty — some changes may not be saved.');
  } finally {
    flushing = false;
  }
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