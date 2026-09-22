import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { CategoryId, Product } from '@duhahe/shared';
import { PRODUCTS } from '@duhahe/shared';
import { api } from '../api';
import { useApp } from './AppContext';

interface CatalogState {
  products: Product[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  search: (q: string) => Product[];
}

const CatalogContext = createContext<CatalogState | null>(null);

export function CatalogProvider({ children }: { children: React.ReactNode }) {
  const { lang } = useApp();
  const [products, setProducts] = useState<Product[]>(PRODUCTS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      setProducts(await api.products({ lang }));
      setError(null);
    } catch (e) {
      setProducts(PRODUCTS);
      setError(e instanceof Error ? e.message : 'Failed to load catalog');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, [lang]);

  const value = useMemo<CatalogState>(
    () => ({
      products,
      loading,
      error,
      refresh,
      search: (q: string) => {
        const needle = q.trim().toLowerCase();
        if (!needle) return products;
        return products.filter((p) =>
          [p.name.en, p.name.kin, p.name.fr, p.description.en, p.description.kin, p.description.fr, p.sku, p.farmer ?? '']
            .join(' ')
            .toLowerCase()
            .includes(needle)
        );
      },
    }),
    [products, loading, error]
  );

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

export function useCatalog(): CatalogState {
  const ctx = useContext(CatalogContext);
  if (!ctx) throw new Error('useCatalog must be used within CatalogProvider');
  return ctx;
}

export function useProductsByCategory(category?: CategoryId): Product[] {
  const { products } = useCatalog();
  return category ? products.filter((p) => p.category === category) : products;
}