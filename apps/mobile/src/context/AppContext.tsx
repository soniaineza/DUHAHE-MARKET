import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { Language } from '@duhahe/shared';
import { setLanguage } from '../i18n';
import type { AuthUser } from '../api';

export interface CustomerProfile {
  name: string;
  phone: string;
  email?: string;
  province?: string;
  district?: string;
  address?: string;
}

interface AppState {
  lang: Language;
  setLang: (lang: Language) => void;
  profile: CustomerProfile | null;
  setProfile: (profile: CustomerProfile) => void;
  clearProfile: () => void;
  token: string | null;
  user: AuthUser | null;
  signIn: (token: string, user: AuthUser) => void;
  signOut: () => void;
}

const AppContext = createContext<AppState | null>(null);

const KEYS = { lang: 'duhahe_lang', profile: 'duhahe_profile', token: 'duhahe_token', user: 'duhahe_user' };

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Language>('en');
  const [profile, setProfileState] = useState<CustomerProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [savedLang, savedProfile, savedToken, savedUser] = await Promise.all([
          AsyncStorage.getItem(KEYS.lang),
          AsyncStorage.getItem(KEYS.profile),
          AsyncStorage.getItem(KEYS.token),
          AsyncStorage.getItem(KEYS.user),
        ]);
        if (savedLang && (savedLang === 'en' || savedLang === 'kin' || savedLang === 'fr')) {
          setLangState(savedLang as Language);
          setLanguage(savedLang as Language);
        }
        if (savedProfile) setProfileState(JSON.parse(savedProfile));
        if (savedToken) setToken(savedToken);
        if (savedUser) {
          try {
            setUser(JSON.parse(savedUser));
          } catch {
            // ignore
          }
        }
      } catch {
        // ignore
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const api = useMemo<AppState>(
    () => ({
      lang,
      setLang: (l) => {
        setLangState(l);
        setLanguage(l);
        AsyncStorage.setItem(KEYS.lang, l).catch(() => {});
      },
      profile,
      setProfile: (p) => {
        setProfileState(p);
        AsyncStorage.setItem(KEYS.profile, JSON.stringify(p)).catch(() => {});
      },
      clearProfile: () => {
        setProfileState(null);
        AsyncStorage.removeItem(KEYS.profile).catch(() => {});
      },
      token,
      user,
      signIn: (tok, u) => {
        setToken(tok);
        setUser(u);
        setProfileState((prev) => ({ ...(prev ?? {}), name: u.name, phone: u.phone }));
        AsyncStorage.multiSet([
          [KEYS.token, tok],
          [KEYS.user, JSON.stringify(u)],
          [KEYS.profile, JSON.stringify({ ...(profile ?? {}), name: u.name, phone: u.phone })],
        ]).catch(() => {});
      },
      signOut: () => {
        setToken(null);
        setUser(null);
        setProfileState(null);
        AsyncStorage.multiRemove([KEYS.token, KEYS.user, KEYS.profile]).catch(() => {});
      },
    }),
    [lang, profile, token, user]
  );

  if (!ready) return null;
  return <AppContext.Provider value={api}>{children}</AppContext.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}