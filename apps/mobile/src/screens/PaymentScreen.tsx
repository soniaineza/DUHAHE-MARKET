import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { decidePhase, pollDelayMs, type PaymentMethod, type PaymentPhase, type PaymentSyncResponse } from '@duhahe/shared';
import { api } from '../api';
import { useApp } from '../context/AppContext';
import { fmtRWF } from '../components/Money';
import Icon, { type IconName } from '../components/Icon';
import { haptic } from '../components/Toast';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { colors, fontSizes, radii, shadow } from '../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const paymentMeta: Record<PaymentMethod, { icon: IconName; tile: readonly [string, string]; note: string; short: string }> = {
  mtn_momo: { icon: 'cellphone', tile: ['#ffcb05', '#f5b800'], note: 'MTN Mobile Money', short: 'MTN MoMo' },
  airtel_money: { icon: 'cellphone', tile: ['#f43f5e', '#e11d48'], note: 'Airtel Money', short: 'Airtel Money' },
  cash_on_delivery: { icon: 'hand-coin', tile: ['#334155', '#475569'], note: 'Cash on Delivery', short: 'Cash' },
};

export default function PaymentScreen({ route }: { route: RouteProp<RootStackParamList, 'Payment'> }) {
  const { t } = useTranslation();
  const { lang } = useApp();
  const nav = useNavigation<Nav>();
  const { order } = route.params;

  const meta = paymentMeta[order.paymentMethod];
  const [phase, setPhase] = useState<PaymentPhase>('sending');
  const [reference, setReference] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [degraded, setDegraded] = useState(false);
  const [slow, setSlow] = useState(false);
  const [checkNote, setCheckNote] = useState(false);
  const [busy, setBusy] = useState(false);
  const pulse = useRef(new Animated.Value(1)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startedAt = useRef<number>(Date.now());
  const checking = useRef(false);
  const alive = useRef(true);
  const phaseRef = useRef<PaymentPhase>('sending');
  /** The payment attempt this page is currently watching. Answers about any other attempt are ignored. */
  const attemptRef = useRef<string | undefined>(undefined);

  const goto = (p: PaymentPhase) => {
    phaseRef.current = p;
    setPhase(p);
  };

  const stopPolling = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };

  /** One status check. The backend (which talks to the provider) is the only source of truth. */
  const checkOnce = useCallback(async (): Promise<boolean> => {
    if (checking.current || !alive.current) return false;
    checking.current = true;
    try {
      let res: PaymentSyncResponse;
      try {
        res = await api.paymentStatus(order.id, attemptRef.current);
      } catch {
        // Offline / server unreachable: the real state is unknown, so keep waiting - never fail.
        res = { status: 'unpaid', unavailable: true };
      }
      if (!alive.current) return false;
      // A late answer for an earlier attempt (e.g. the one that was just cancelled) must never
      // be shown as the result of the attempt we are watching now.
      if (res.attemptId && attemptRef.current && res.attemptId !== attemptRef.current) return false;
      if (res.providerReference) setReference(res.providerReference);
      const since = res.requestedAt ? Date.parse(res.requestedAt) : NaN;
      const waited = Date.now() - (Number.isFinite(since) ? since : startedAt.current);
      const d = decidePhase(res, waited);
      setDegraded(d.degraded);
      setSlow(waited > 45_000);
      if (d.phase === 'success') haptic('success');
      if (d.phase === 'cancelled') haptic('error');
      goto(d.phase);
      if (d.stopPolling) stopPolling();
      return d.stopPolling;
    } finally {
      checking.current = false;
    }
  }, [order.id]);

  const schedule = useCallback(() => {
    stopPolling();
    const waited = Date.now() - startedAt.current;
    timer.current = setTimeout(async () => {
      const finished = await checkOnce();
      if (!finished && alive.current) schedule();
    }, pollDelayMs(waited));
  }, [checkOnce]);

  const watch = useCallback(() => {
    goto('waiting');
    setCheckNote(false);
    schedule();
    void checkOnce();
  }, [checkOnce, schedule]);

  /**
   * Starts (or safely resumes) the payment. The server never sends a second prompt while an earlier
   * one is still pending, so reloading this page or tapping Try again too early is harmless.
   */
  const processPayment = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setCheckNote(false);
    goto('sending');
    startedAt.current = Date.now();
    attemptRef.current = undefined;
    setReference('');
    try {
      const result = await api.createPayment({
        method: order.paymentMethod,
        orderId: order.id,
        phone: order.customer.phone,
        amount: order.total,
      });
      if (!result.success) {
        setError(result.message?.[lang] ?? result.message?.en ?? null);
        goto('error');
        haptic('error');
        return;
      }
      attemptRef.current = result.attemptId;
      if (result.providerRequestId) setReference(result.providerRequestId);
      if (result.status === 'paid') {
        goto('success');
        haptic('success');
      } else {
        // Mobile money is asynchronous: wait for the provider's final answer.
        watch();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : null);
      goto('error');
      haptic('error');
    } finally {
      setBusy(false);
    }
  };

  const recheck = async () => {
    setCheckNote(false);
    const finished = await checkOnce();
    if (!finished && phaseRef.current === 'unresolved') setCheckNote(true);
  };

  useEffect(() => {
    alive.current = true;
    if (order.paymentMethod === 'cash_on_delivery') {
      goto('success');
      return () => {
        alive.current = false;
      };
    }
    const start = setTimeout(processPayment, 400);
    // Check immediately when the customer returns from the MoMo prompt / the tab or network comes back.
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && phaseRef.current === 'waiting') void checkOnce();
    });
    return () => {
      alive.current = false;
      clearTimeout(start);
      stopPolling();
      sub.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (phase === 'sending' || phase === 'waiting') {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.12, duration: 550, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1, duration: 550, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
    pulse.setValue(1);
    return undefined;
  }, [phase, pulse]);

  const trackOrder = () => {
    haptic('medium');
    nav.replace('Tracking', { orderNumber: order.orderNumber, phone: order.customer.phone });
  };

  const goHome = () => {
    nav.navigate('Tabs', { screen: 'Home' });
  };

  const processing = phase === 'sending' || phase === 'waiting';
  const waitingTitle = t('payment.waitingTitle', { provider: meta.short });

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.wrap}>
        <View style={styles.card}>
          <View style={styles.providerRow}>
            <LinearGradient colors={meta.tile} style={styles.providerTile}>
              <Icon name={meta.icon} size={22} color="#fff" />
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text style={styles.providerName}>{t(`checkout.${order.paymentMethod}`)}</Text>
              <Text style={styles.providerNote}>{meta.note}</Text>
            </View>
          </View>

          <View style={styles.amountRow}>
            <Text style={styles.amountLabel}>{t('common.total')}</Text>
            <Text style={styles.amount}>{fmtRWF(order.total)}</Text>
          </View>

          {processing && (
            <View style={styles.steps}>
              <Step icon="send-outline" label={t('payment.stepSending')} active spinner={phase === 'sending'} done={phase === 'waiting'} />
              <Step icon="cellphone-information" label={phase === 'waiting' ? waitingTitle : t('payment.stepWaiting')} active={phase === 'waiting'} spinner={phase === 'waiting'} />
              {phase === 'waiting' ? (
                <>
                  <Text style={styles.waitNote}>{t('payment.waitingHint', { phone: order.customer.phone })}</Text>
                  {slow ? <Text style={styles.waitNote}>{t('payment.waitingSlow')}</Text> : null}
                  {degraded ? <Text style={[styles.waitNote, styles.warnNote]}>{t('payment.degraded')}</Text> : null}
                </>
              ) : null}
            </View>
          )}

          {phase === 'success' && (
            <View style={styles.result}>
              <Animated.View style={[styles.checkCircle, { transform: [{ scale: pulse }] }]}>
                <LinearGradient colors={['#111111', '#000000']} style={styles.checkInner}>
                  <Icon name="check-bold" size={30} color="#fff" />
                </LinearGradient>
              </Animated.View>
              <Text style={styles.resultTitle}>
                {order.paymentMethod === 'cash_on_delivery' ? t('payment.cashApproved') : t('payment.approved')}
              </Text>
              <Text style={styles.resultSub}>
                {order.paymentMethod === 'cash_on_delivery' ? t('payment.cashSub') : t('payment.approvedSub')}
              </Text>
              {reference ? (
                <View style={styles.refRow}>
                  <Text style={styles.refLabel}>{t('payment.reference')}</Text>
                  <Text style={styles.refValue}>{reference}</Text>
                </View>
              ) : null}
            </View>
          )}

          {phase === 'cancelled' && (
            <View style={styles.result}>
              <View style={[styles.checkCircle, { backgroundColor: colors.dangerSoft }]}>
                <Icon name="close-circle" size={34} color={colors.danger} />
              </View>
              <Text style={styles.resultTitle}>{t('payment.cancelledTitle')}</Text>
              <Text style={styles.resultSub}>{t('payment.cancelledSub')}</Text>
            </View>
          )}

          {phase === 'unresolved' && (
            <View style={styles.result}>
              <View style={[styles.checkCircle, { backgroundColor: colors.accentSoft }]}>
                <Icon name="help-circle-outline" size={36} color={colors.accentDark} />
              </View>
              <Text style={styles.resultTitle}>{t('payment.unresolvedTitle')}</Text>
              <Text style={styles.resultSub}>{t('payment.unresolvedSub')}</Text>
              {checkNote ? <Text style={[styles.resultSub, styles.warnNote]}>{t('payment.stillPending')}</Text> : null}
            </View>
          )}

          {phase === 'error' && (
            <View style={styles.result}>
              <View style={[styles.checkCircle, { backgroundColor: colors.dangerSoft }]}>
                <Icon name="close-circle" size={34} color={colors.danger} />
              </View>
              <Text style={styles.resultTitle}>{t('payment.failed')}</Text>
              {error ? <Text style={styles.resultSub}>{error}</Text> : null}
            </View>
          )}
        </View>

        {phase === 'success' && (
          <View style={styles.actions}>
            <Pressable onPress={trackOrder} style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}>
              <Icon name="map-marker-path" size={18} color="#fff" />
              <Text style={styles.primaryText}>{t('success.track')}</Text>
            </Pressable>
            <Pressable onPress={goHome} style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}>
              <Text style={styles.secondaryText}>{t('success.backHome')}</Text>
            </Pressable>
          </View>
        )}

        {(phase === 'cancelled' || phase === 'error') && (
          <View style={styles.actions}>
            <Pressable onPress={processPayment} disabled={busy} style={({ pressed }) => [styles.primaryBtn, (pressed || busy) && styles.pressed]}>
              <Icon name="refresh" size={18} color="#fff" />
              <Text style={styles.primaryText}>{t('payment.tryAgain')}</Text>
            </Pressable>
            <Pressable onPress={trackOrder} style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}>
              <Text style={styles.secondaryText}>{t('success.track')}</Text>
            </Pressable>
          </View>
        )}

        {phase === 'unresolved' && (
          <View style={styles.actions}>
            <Pressable onPress={recheck} style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}>
              <Icon name="refresh" size={18} color="#fff" />
              <Text style={styles.primaryText}>{t('payment.checkAgain')}</Text>
            </Pressable>
            <Pressable onPress={trackOrder} style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}>
              <Text style={styles.secondaryText}>{t('success.track')}</Text>
            </Pressable>
          </View>
        )}

        {phase === 'waiting' && (
          <View style={styles.actions}>
            <Pressable onPress={trackOrder} style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}>
              <Text style={styles.secondaryText}>{t('success.track')}</Text>
            </Pressable>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

function Step({ icon, label, active, spinner, done }: { icon: IconName; label: string; active: boolean; spinner: boolean; done?: boolean }) {
  return (
    <View style={[styles.step, active && styles.stepActive]}>
      {spinner ? <ActivityIndicator size="small" color={colors.primary} /> : <Icon name={done ? 'check-circle' : icon} size={17} color={active ? colors.primary : colors.faint} />}
      <Text style={[styles.stepText, active && { color: colors.ink, fontWeight: '700' }]} numberOfLines={3}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  wrap: { flex: 1, justifyContent: 'center', padding: 20, gap: 18, width: '100%', maxWidth: 560, alignSelf: 'center' },
  card: { backgroundColor: colors.card, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.border, padding: 18, ...shadow.md },
  providerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  providerTile: { width: 46, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  providerName: { fontSize: fontSizes.md, fontWeight: '900', color: colors.ink },
  providerNote: { fontSize: fontSizes.xs, color: colors.muted, fontWeight: '600', marginTop: 2 },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderColor: colors.divider,
    marginTop: 16,
    paddingTop: 14,
  },
  amountLabel: { fontSize: fontSizes.sm, color: colors.faint, fontWeight: '700' },
  amount: { fontSize: fontSizes.xl, fontWeight: '900', color: colors.accent },
  steps: { gap: 8, marginTop: 16 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: radii.m, padding: 11, backgroundColor: colors.chip },
  stepActive: { backgroundColor: colors.primarySoft },
  stepText: { flex: 1, fontSize: fontSizes.sm, color: colors.faint, fontWeight: '600' },
  waitNote: { fontSize: fontSizes.xs, color: colors.muted, fontWeight: '600', textAlign: 'center', marginTop: 4, lineHeight: 17 },
  warnNote: { color: colors.accentDark },
  result: { alignItems: 'center', marginTop: 22 },
  checkCircle: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  checkInner: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center' },
  resultTitle: { fontSize: fontSizes.lg, fontWeight: '900', color: colors.ink, textAlign: 'center' },
  resultSub: { fontSize: fontSizes.sm, color: colors.muted, textAlign: 'center', lineHeight: 19, marginTop: 6 },
  refRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.accentSoft, borderRadius: radii.s, paddingHorizontal: 12, paddingVertical: 8, marginTop: 12 },
  refLabel: { fontSize: fontSizes.xs, color: colors.faint, fontWeight: '700' },
  refValue: { fontSize: fontSizes.xs, color: colors.accentDark, fontWeight: '800', fontFamily: 'Courier' },
  actions: { gap: 10 },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.accent,
    borderRadius: radii.m,
    paddingVertical: 16,
  },
  primaryText: { color: '#fff', fontWeight: '800', fontSize: fontSizes.md },
  secondaryBtn: { alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
  secondaryText: { color: colors.muted, fontWeight: '700', fontSize: fontSizes.sm },
  pressed: { opacity: 0.8 },
});
