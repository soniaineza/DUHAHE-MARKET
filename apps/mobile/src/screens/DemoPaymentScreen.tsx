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

interface Props {
  route: RouteProp<RootStackParamList, 'DemoPayment'>;
}

type Nav = NativeStackNavigationProp<RootStackParamList>;

type Phase = 'sending' | 'waiting' | 'success' | 'success_cash' | 'error';

const paymentMeta: Record<PaymentMethod, { icon: IconName; tile: readonly [string, string]; note: string }> = {
  mtn_momo: { icon: 'cellphone', tile: ['#ffcb05', '#f5b800'], note: 'MTN' },
  airtel_money: { icon: 'cellphone', tile: ['#f43f5e', '#e11d48'], note: 'Airtel' },
  cash_on_delivery: { icon: 'hand-coin', tile: ['#334155', '#475569'], note: 'Cash' },
};

export default function DemoPaymentScreen({ route }: Props) {
  const { t } = useTranslation();
  const nav = useNavigation<Nav>();
  const { order } = route.params;

  const meta = paymentMeta[order.paymentMethod];
  const [phase, setPhase] = useState<Phase>('sending');
  const [reference, setReference] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const pulse = useRef(new Animated.Value(1)).current;
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const later = (fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms));
  };

  const runPayment = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    setPhase('sending');
    try {
      const result = await api.stubPayment({
        method: order.paymentMethod === 'cash_on_delivery' ? 'mtn_momo' : order.paymentMethod,
        orderId: order.id,
        phone: order.customer.phone,
        amount: order.total,
      });
      if (result.success) {
        setReference(result.providerRequestId ?? '');
        setPhase('success');
        haptic('success');
      } else {
        setError(result.message.en);
        setPhase('error');
        haptic('error');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t('payment.failed'));
      setPhase('error');
      haptic('error');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (order.paymentMethod === 'cash_on_delivery') {
      setPhase('success_cash');
      haptic('success');
      return;
    }
    later(() => setPhase('waiting'), 1100);
    later(() => runPayment(), 2300);
    return () => timers.current.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (phase === 'sending' || phase === 'waiting') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.12, duration: 550, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1, duration: 550, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulse.setValue(1);
    }
    return () => pulse.stopAnimation();
  }, [phase, pulse]);

  const done = () => {
    haptic('medium');
    nav.replace('CheckoutSuccess', { orderNumber: order.orderNumber, total: order.total });
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
              <Text style={styles.providerNote}>{meta.note} · {t('payment.demoTitle')}</Text>
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
            </View>
          )}

          {(phase === 'success' || phase === 'success_cash') && (
            <View style={styles.result}>
              <Animated.View style={[styles.checkCircle, { transform: [{ scale: pulse }] }]}>
                <LinearGradient colors={['#111111', '#000000']} style={styles.checkInner}>
                  <Icon name="check-bold" size={30} color="#fff" />
                </LinearGradient>
              </Animated.View>
              <Text style={styles.resultTitle}>{phase === 'success' ? t('payment.approved') : t('payment.cashApproved')}</Text>
              <Text style={styles.resultSub}>{phase === 'success' ? t('payment.approvedSub') : t('payment.cashSub')}</Text>
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

        <Pressable
          onPress={phase === 'error' ? runPayment : done}
          disabled={processing}
          style={({ pressed }) => [styles.primaryBtn, processing && styles.primaryBtnDim, pressed && { opacity: 0.85 }]}
        >
          {processing ? (
            <ActivityIndicator color="#fff" />
          ) : phase === 'error' ? (
            <>
              <Icon name="refresh" size={18} color="#fff" />
              <Text style={styles.primaryText}>{t('payment.retry')}</Text>
            </>
          ) : (
            <>
              <Text style={styles.primaryText}>{t('payment.done')}</Text>
              <Icon name="arrow-right" size={18} color="#fff" />
            </>
          )}
        </Pressable>
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
  wrap: { flex: 1, justifyContent: 'center', padding: 20, gap: 18 },
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
  result: { alignItems: 'center', marginTop: 22 },
  checkCircle: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  checkInner: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center' },
  resultTitle: { fontSize: fontSizes.lg, fontWeight: '900', color: colors.ink, textAlign: 'center' },
  resultSub: { fontSize: fontSizes.sm, color: colors.muted, textAlign: 'center', lineHeight: 19, marginTop: 6 },
  refRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.accentSoft, borderRadius: radii.s, paddingHorizontal: 12, paddingVertical: 8, marginTop: 12 },
  refLabel: { fontSize: fontSizes.xs, color: colors.faint, fontWeight: '700' },
  refValue: { fontSize: fontSizes.xs, color: colors.accentDark, fontWeight: '800', fontFamily: 'Courier' },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.accent,
    borderRadius: radii.m,
    paddingVertical: 16,
  },
  primaryBtnDim: { opacity: 0.55 },
  primaryText: { color: '#fff', fontWeight: '800', fontSize: fontSizes.md },
});