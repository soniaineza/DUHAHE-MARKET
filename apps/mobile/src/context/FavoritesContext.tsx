import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { favoritesApi } from '../api';
import { useApp } from './AppContext';

interface FavoritesState {
  ids: string[];
  isFav: (id: string) => boolean;
  toggle: (id: string) => void;
}

const FavoritesContext = createContext<FavoritesState | null>(null);
const KEY = 'duhahe_favorites';

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const { user } = useApp();
  const phone = user?.phone ?? '';
  const [ids, setIds] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [synced, setSynced] = useState(false);
  const serverLoadedRef = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(KEY);
        if (raw) setIds(JSON.parse(raw) as string[]);
      } catch {
        // ignore
      } finally {
        setReady(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!ready) return;
    serverLoadedRef.current = false;
    setSynced(false);
    if (!phone) {
      setSynced(true);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await favoritesApi.get(phone);
        if (cancelled) return;
        setIds((prev) => Array.from(new Set([...prev, ...res.ids])));
        serverLoadedRef.current = true;
      } catch {
        // keep local list; allow later pushes
      } finally {
        if (!cancelled) setSynced(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, phone]);

  useEffect(() => {
    if (!ready || !synced || !serverLoadedRef.current || !phone) return;
    const t = setTimeout(() => {
      favoritesApi.save(phone, ids).catch(() => {});
    }, 400);
    return () => clearTimeout(t);
  }, [ids, ready, synced, phone]);

  useEffect(() => {
    if (!ready) return;
    AsyncStorage.setItem(KEY, JSON.stringify(ids)).catch(() => {});
  }, [ids, ready]);

  const value = useMemo<FavoritesState>(
    () => ({
      ids,
      isFav: (id) => ids.includes(id),
      toggle: (id) => setIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])),
    }),
    [ids]
  );

  if (!ready) return null;
  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites(): FavoritesState {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error('useFavorites must be used within FavoritesProvider');
  return ctx;
}