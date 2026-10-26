import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import type { PaymentMethod } from '@duhahe/shared';
import { api } from '../api';
import { fmtRWF } from '../components/Money';
import Icon, { type IconName } from '../components/Icon';
import { haptic } from '../components/Toast';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { colors, fontSizes, radii, shadow } from '../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

type Phase = 'sending' | 'waiting' | 'success' | 'error';

const POLL_INTERVAL_MS = 4000;
const POLL_TIMEOUT_MS = 600000;

const paymentMeta: Record<PaymentMethod, { icon: IconName; tile: readonly [string, string]; note: string }> = {
  mtn_momo: { icon: 'cellphone', tile: ['#ffcb05', '#f5b800'], note: 'MTN Mobile Money' },
  airtel_money: { icon: 'cellphone', tile: ['#f43f5e', '#e11d48'], note: 'Airtel Money' },
  cash_on_delivery: { icon: 'hand-coin', tile: ['#334155', '#475569'], note: 'Cash on Delivery' },
};

export default function PaymentScreen({ route }: { route: RouteProp<RootStackParamList, 'Payment'> }) {
  const { t } = useTranslation();
  const nav = useNavigation<Nav>();
  const { order } = route.params;

  const meta = paymentMeta[order.paymentMethod];
  const [phase, setPhase] = useState<Phase>('sending');
  const [reference, setReference] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pulse = useRef(new Animated.Value(1)).current;
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAt = useRef<number>(Date.now());

  const stopPolling = () => {
    if (poll.current) {
      clearInterval(poll.current);
      poll.current = null;
    }
  };

  const succeed = () => {
    stopPolling();
    setPhase('success');
    haptic('success');
  };

  const fail = (message: string) => {
    stopPolling();
    setError(message);
    setPhase('error');
    haptic('error');
  };

  const watchConfirmation = () => {
    setPhase('waiting');
    startedAt.current = Date.now();
    stopPolling();
    poll.current = setInterval(async () => {
      try {
        const latest = await api.paymentStatus(order.id);
        if (latest.providerReference) setReference(latest.providerReference);
        if (latest.status === 'paid') {
          succeed();
        } else if (latest.status === 'failed') {
          fail(t('payment.cancelled', 'The payment was not completed. You can try again.'));
        } else if (Date.now() - startedAt.current > POLL_TIMEOUT_MS) {
          fail(t('payment.notConfirmed', 'We did not receive confirmation yet. Check your orders.'));
        }
      } catch {
        // transient network error — keep polling until timeout
      }
    }, POLL_INTERVAL_MS);
  };

  const processPayment = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setPhase('sending');
    try {
      const result = await api.createPayment({
        method: order.paymentMethod,
        orderId: order.id,
        phone: order.customer.phone,
        amount: order.total,
      });
      if (!result.success) {
        fail(result.message?.en ?? t('payment.failed'));
        return;
      }
      setReference(result.providerRequestId ?? '');
      if (result.status === 'paid') {
        succeed();
      } else {
        // Mobile money is asynchronous: stay on "waiting" until the provider
        // confirms the customer approved the prompt on their phone.
        watchConfirmation();
      }
    } catch (e) {
      fail(e instanceof Error ? e.message : t('payment.failed'));
    } finally {
      setBusy(false);
    }
  };

  const later = (fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms));
  };

  useEffect(() => {
    if (order.paymentMethod === 'cash_on_delivery') {
      succeed();
      return;
    }
    later(processPayment, 400);
    return () => {
      timers.current.forEach(clearTimeout);
      stopPolling();
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
              <Step icon="send-outline" label={t('payment.stepSending')} active={phase === 'sending' || phase === 'waiting'} spinner={phase === 'sending'} />
              <Step icon="cellphone-information" label={t('payment.stepWaiting')} active={phase === 'waiting'} spinner={phase === 'waiting'} />
              {phase === 'waiting' ? (
                <Text style={styles.waitNote}>{t('payment.confirmPrompt', { phone: order.customer.phone })}</Text>
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

        {phase === 'error' && (
          <View style={styles.actions}>
            <Pressable onPress={processPayment} style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}>
              <Icon name="refresh" size={18} color="#fff" />
              <Text style={styles.primaryText}>{t('payment.retry')}</Text>
            </Pressable>
            <Pressable onPress={trackOrder} style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}>
              <Text style={styles.secondaryText}>{t('success.track')}</Text>
            </Pressable>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

function Step({ icon, label, active, spinner }: { icon: IconName; label: string; active: boolean; spinner: boolean }) {
  return (
    <View style={[styles.step, active && styles.stepActive]}>
      {spinner ? <ActivityIndicator size="small" color={colors.primary} /> : <Icon name={icon} size={17} color={active ? colors.primary : colors.faint} />}
      <Text style={[styles.stepText, active && { color: colors.ink, fontWeight: '700' }]}>{label}</Text>
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
  stepText: { fontSize: fontSizes.sm, color: colors.faint, fontWeight: '600' },
  waitNote: { fontSize: fontSizes.xs, color: colors.muted, fontWeight: '600', textAlign: 'center', marginTop: 4 },
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
