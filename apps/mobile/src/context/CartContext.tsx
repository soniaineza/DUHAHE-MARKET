import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Product } from '@duhahe/shared';
import { cartApi } from '../api';
import { CatalogProvider, useCatalog } from './CatalogContext';
import { AppProvider, useApp } from './AppContext';

export interface CartLine {
  product: Product;
  qty: number;
}

interface CartState {
  lines: CartLine[];
  count: number;
  subtotal: number;
  add: (product: Product, qty?: number) => void;
  setQty: (productId: string, qty: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartState | null>(null);

const STORAGE_KEY = 'duhahe_cart';

function CartProviderInner({ children }: { children: React.ReactNode }) {
  const { products } = useCatalog();
  const { user } = useApp();
  const phone = user?.phone ?? '';
  const [items, setItems] = useState<{ productId: string; qty: number }[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [synced, setSynced] = useState(false);

  const find = (id: string): Product | undefined => products.find((p) => p.id === id);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            setItems(
              parsed.filter(
                (i): i is { productId: string; qty: number } =>
                  !!i && typeof i.productId === 'string' && typeof i.qty === 'number' && !!find(i.productId)
              )
            );
          }
        }
      } catch {
        // ignore corrupt storage
      } finally {
        setHydrated(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    setSynced(false);
    if (!phone) {
      setSynced(true);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await cartApi.get(phone);
        if (cancelled) return;
        if (res.items.length > 0) {
          const known = res.items
            .filter((i) => !!find(i.productId) && i.qty > 0)
            .map((i) => ({ productId: i.productId, qty: Math.min(i.qty, find(i.productId)!.stockQty) }));
          setItems(known);
        }
      } catch {
        // keep the local cart
      } finally {
        if (!cancelled) setSynced(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, phone]);

  useEffect(() => {
    if (!hydrated || !synced || !phone) return;
    const t = setTimeout(() => {
      cartApi.save(phone, items).catch(() => {});
    }, 400);
    return () => clearTimeout(t);
  }, [items, hydrated, synced, phone]);

  useEffect(() => {
    if (!hydrated) return;
    if (items.length === 0) {
      AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
    } else {
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items)).catch(() => {});
    }
  }, [items, hydrated]);

  const value = useMemo<CartState>(() => {
    const lines: CartLine[] = items
      .map((i) => ({ product: find(i.productId)!, qty: i.qty }))
      .filter((l) => !!l.product);
    const subtotal = lines.reduce((s, l) => s + l.qty * l.product.price, 0);
    return {
      lines,
      count: lines.length,
      subtotal: Math.round(subtotal * 100) / 100,
      add: (product, qty = product.minOrderQty) => {
        setItems((prev) => {
          const existing = prev.find((i) => i.productId === product.id);
          const current = existing?.qty ?? 0;
          const next = Math.min(roundTo(current + Math.max(0, qty), product.step), product.stockQty);
          if (next <= 0) return prev;
          if (existing) {
            return prev.map((i) => (i.productId === product.id ? { ...i, qty: next } : i));
          }
          return [...prev, { productId: product.id, qty: next }];
        });
      },
      setQty: (productId, qty) => {
        setItems((prev) => {
          const prod = find(productId);
          if (!prod) return prev;
          const next = Math.min(roundTo(Math.max(0, qty), prod.step), prod.stockQty);
          if (next <= 0) return prev.filter((i) => i.productId !== productId);
          return prev.map((i) => (i.productId === productId ? { ...i, qty: next } : i));
        });
      },
      remove: (productId) => setItems((prev) => prev.filter((i) => i.productId !== productId)),
      clear: () => setItems([]),
    };
  }, [items, products]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

function roundTo(qty: number, step: number): number {
  return Math.round(Math.max(0, qty) / step) * step;
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  return (
    <AppProvider>
      <CatalogProvider>
        <CartProviderInner>{children}</CartProviderInner>
      </CatalogProvider>
    </AppProvider>
  );
}

export function useCart(): CartState {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}

export { useApp }; // re-export convenience