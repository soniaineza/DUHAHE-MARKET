import * as Haptics from 'expo-haptics';
import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { colors, radii, shadow } from '../theme';
import Icon, { type IconName } from './Icon';

export type ToastType = 'success' | 'error' | 'info';

interface ToastState {
  show: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastState | null>(null);

export function haptic(kind: 'light' | 'medium' | 'success' | 'warning' | 'error' = 'light') {
  try {
    switch (kind) {
      case 'light':
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        break;
      case 'medium':
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        break;
      case 'success':
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        break;
      case 'warning':
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        break;
      case 'error':
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        break;
    }
  } catch {
    // Haptics unavailable (e.g. simulator/web)
  }
}

const toastMeta: Record<ToastType, { icon: IconName; color: string }> = {
  success: { icon: 'check-circle', color: colors.success },
  error: { icon: 'alert-circle', color: colors.danger },
  info: { icon: 'information', color: colors.info },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const translate = useRef(new Animated.Value(24)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(
    (message: string, type: ToastType = 'success') => {
      if (timer.current) clearTimeout(timer.current);
      setToast({ message, type });
      Animated.parallel([
        Animated.spring(opacity, { toValue: 1, useNativeDriver: true, friction: 7 }),
        Animated.spring(translate, { toValue: 0, useNativeDriver: true, friction: 7 }),
      ]).start();
      timer.current = setTimeout(() => {
        Animated.parallel([
          Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
          Animated.timing(translate, { toValue: 16, duration: 180, useNativeDriver: true }),
        ]).start(() => setToast(null));
      }, 2400);
    },
    [opacity, translate]
  );

  const value = useMemo(() => ({ show }), [show]);
  const meta = toast ? toastMeta[toast.type] : null;

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast && meta && (
        <Animated.View
          pointerEvents="none"
          style={[styles.wrap, { opacity, transform: [{ translateY: translate }] }]}
        >
          <View style={[styles.toast, { borderLeftColor: meta.color }]}>
            <Icon name={meta.icon} size={20} color={meta.color} />
            <Text style={styles.text}>{toast.message}</Text>
          </View>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastState {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 96,
    zIndex: 100,
    alignItems: 'center',
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.ink,
    borderRadius: radii.m,
    paddingHorizontal: 16,
    paddingVertical: 13,
    maxWidth: 420,
    borderLeftWidth: 4,
    boxShadow: '0 6px 14px #171A18',
  },
  text: { color: colors.white, fontSize: 14, fontWeight: '600', flexShrink: 1 },
});