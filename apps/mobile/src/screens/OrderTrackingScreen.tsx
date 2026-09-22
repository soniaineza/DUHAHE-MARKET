import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import type { Order } from '@duhahe/shared';
import { api } from '../api';
import { useApp } from '../context/AppContext';
import EmptyState from '../components/EmptyState';
import Icon, { type IconName } from '../components/Icon';
import { fmtRWF } from '../components/Money';
import { haptic, useToast } from '../components/Toast';
import { pickCourier } from '../data/discovery';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { colors, fontSizes, radii, gradientAccent } from '../theme';
import { LinearGradient } from 'expo-linear-gradient';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Props = NativeStackScreenProps<RootStackParamList, 'Tracking'>;

const STEPS: { icon: IconName; labelKey: string }[] = [
  { icon: 'check-bold', labelKey: 'tracking.stepsConfirmed' },
  { icon: 'chef-hat', labelKey: 'tracking.stepsPreparing' },
  { icon: 'motorbike', labelKey: 'tracking.stepsPickup' },
  { icon: 'map-marker-path', labelKey: 'tracking.stepsOnTheWay' },
  { icon: 'home-variant', labelKey: 'tracking.stepsDelivered' },
];

function stepIndex(status: Order['status']): number {
  switch (status) {
    case 'pending': return 0;
    case 'packing': return 1;
    case 'in_transit': return 3;
    case 'delivered': return 4;
    default: return 0;
  }
}

/** Deterministic delivery ETA that shrinks as time passes since the order was placed. */
function etaFor(order: Order): string {
  let seed = 0;
  for (const ch of order.id) seed = (seed * 31 + ch.charCodeAt(0)) % 997;
  const base = 28 + (seed % 16);
  const elapsedMin = Math.max(0, Math.floor((Date.now() - new Date(order.createdAt).getTime()) / 60000));
  const remaining = Math.max(5, base - elapsedMin);
  if (order.status === 'in_transit') return `${remaining} min`;
  if (order.status === 'packing') return `${remaining + 20}–${remaining + 40} min`;
  return `${remaining + 60}–${remaining + 90} min`;
}

export default function OrderTrackingScreen({ route }: Props) {
  const { t } = useTranslation();
  const { lang } = useApp();
  const nav = useNavigation<Nav>();
  const { show } = useToast();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const pulse = useRef(new Animated.Value(0)).current;

  const eta = order ? etaFor(order) : '';
  const courier = pickCourier(order?.id ?? 'none');

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => {
      loop.stop();
      pulse.setValue(0);
    };
  }, [pulse, order?.id]);

  const pulseStyle = {
    transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] }) }],
    shadowOpacity: 0.3,
  };

  const load = useCallback(async () => {
    const phone = route.params.phone;
    if (!phone) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    try {
      const orders = await api.recentOrders(phone);
      const found = orders.find((o) => o.orderNumber === route.params.orderNumber || o.id === route.params.orderNumber);
      setOrder(found ?? null);
      setNotFound(!found);
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [route.params.orderNumber, route.params.phone]);

  useEffect(() => { load(); }, [load]);

  const callCourier = async () => {
    haptic('light');
    const tel = `tel:${courier.phone}`;
    const ok = await Linking.canOpenURL(tel);
    if (ok) Linking.openURL(tel);
    else show(courier.phone, 'info');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.navRow}>
        <Pressable onPress={() => nav.goBack()} hitSlop={10} style={styles.backBtn}>
          <Icon name="arrow-left" size={20} color={colors.ink} />
        </Pressable>
        <Text style={styles.title}>{t('tracking.title')}</Text>
        <View style={{ width: 32 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} size="small" />
        </View>
      ) : notFound || !order ? (
        <View style={styles.center}>
          <EmptyState icon="map-search-outline" title={t('tracking.noOrder')} message={t('tracking.noOrderSub')} actionLabel={t('profileMenu.orders')} onAction={() => nav.navigate('Tabs', { screen: 'Orders' })} />
        </View>
      ) : order.status === 'cancelled' ? (
        <View style={styles.center}>
          <EmptyState icon="close-circle-outline" title={t('tracking.cancelled')} message={t('tracking.noOrderSub')} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <LinearGradient colors={gradientAccent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
            {order.status === 'delivered' ? (
              <>
                <Text style={styles.heroTitle}>{t('tracking.stepsDelivered')}</Text>
                <Text style={styles.heroSub}>{t('tracking.afterDelivery')}</Text>
              </>
            ) : (
              <>
                <Text style={styles.heroTitle}>{t('tracking.arriving', { time: eta })}</Text>
                <Text style={styles.heroSub}>{t('tracking.afterDelivery')}</Text>
              </>
            )}
            <Text style={styles.heroOrder}>{t('tracking.orderNumber', { number: order.orderNumber })}</Text>
          </LinearGradient>

          {/* Steps */}
          <View style={styles.card}>
            {STEPS.map((s, i) => {
              const idx = stepIndex(order.status);
              const done = i < idx;
              const current = i === idx;
              return (
                <View key={s.labelKey} style={styles.step}>
                  <View style={[styles.stepConnector, i === 0 && { opacity: 0 }]} />
                  <Animated.View
                    style={[
                      styles.stepNode,
                      done && styles.stepNodeDone,
                      current && styles.stepNodeCurrent,
                      current && order.status !== 'delivered' && pulseStyle,
                    ]}
                  >
                    <Icon name={s.icon} size={13} color={current ? colors.white : done ? colors.accent : colors.faint} />
                  </Animated.View>
                  <Text style={[styles.stepLabel, (done || current) && { color: colors.ink, fontWeight: '800' }]}>
                    {t(s.labelKey)}
                  </Text>
                  {current && (
                    <View style={styles.stepETA}>
                      <Text style={styles.stepETAText}>{order.status === 'in_transit' ? `~${eta}` : order.status === 'delivered' ? '✓' : '~'}</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>

          {/* Courier */}
          <Text style={styles.sectionTitle}>{t('tracking.courier')}</Text>
          <View style={styles.cardRow}>
            <LinearGradient colors={[courier.color, '#64748b']} style={styles.courierAvatar}>
              <Text style={styles.courierEmoji}>{courier.emoji}</Text>
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text style={styles.courierName}>{courier.name}</Text>
              <Text style={styles.courierMeta}>{courier.phone} · {courier.rating} ★</Text>
            </View>
            <Pressable onPress={callCourier} style={({ pressed }) => [styles.contactBtn, pressed && { opacity: 0.85 }]}>
              <Icon name="phone-outline" size={16} color={colors.white} />
              <Text style={styles.contactText}>{t('tracking.contactCourier')}</Text>
            </Pressable>
          </View>

          {/* Items */}
          <Text style={styles.sectionTitle}>{t('tracking.items')}</Text>
          <View style={styles.card}>
            {order.items.map((it) => (
              <View key={it.productId} style={styles.itemRow}>
                <Text style={styles.itemName} numberOfLines={1}>{it.name[lang]}</Text>
                <Text style={styles.itemQty}>× {it.qty} {it.unit}</Text>
                <Text style={styles.itemPrice}>{fmtRWF(it.lineTotal)}</Text>
              </View>
            ))}
            <View style={styles.divider} />
            <View style={styles.sumRow}><Text style={styles.sumLabel}>{t('common.subtotal')}</Text><Text style={styles.sumValue}>{fmtRWF(order.subtotal)}</Text></View>
            <View style={styles.sumRow}><Text style={styles.sumLabel}>{t('common.deliveryFee')}</Text><Text style={styles.sumValue}>{fmtRWF(order.deliveryFee)}</Text></View>
            <View style={[styles.sumRow, styles.totalRow]}><Text style={styles.totalLabel}>{t('common.total')}</Text><Text style={styles.totalValue}>{fmtRWF(order.total)}</Text></View>
          </View>

          <Pressable
            onPress={() => nav.navigate('Tabs', { screen: 'Home' })}
            style={({ pressed }) => [styles.shopBtn, pressed && { opacity: 0.9 }]}
          >
            <Text style={styles.shopBtnText}>{t('success.backHome')}</Text>
          </Pressable>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const shadowSm = {    shadowColor: '#111111',
  shadowOpacity: 0.10,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 4 },
  elevation: 5,
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginTop: 8 },
  backBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: fontSizes.xl, fontWeight: '900', color: colors.ink },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  content: { padding: 16, paddingBottom: 40, gap: 12 },
  hero: { borderRadius: radii.xl, padding: 22, ...shadowSm },
  heroTitle: { color: colors.white, fontSize: fontSizes.xl, fontWeight: '900', letterSpacing: -0.4 },
  heroSub: { color: 'rgba(255,255,255,0.9)', fontSize: fontSizes.xs, fontWeight: '600', marginTop: 4 },
  heroOrder: { color: 'rgba(255,255,255,0.85)', fontSize: fontSizes.sm, fontWeight: '800', marginTop: 12 },
  card: { backgroundColor: colors.card, borderRadius: radii.l, borderWidth: 1, borderColor: colors.border, padding: 14 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, borderRadius: radii.l, borderWidth: 1, borderColor: colors.border, padding: 14 },
  courierAvatar: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  courierEmoji: { fontSize: 24 },
  courierName: { fontSize: fontSizes.md, fontWeight: '800', color: colors.ink },
  courierMeta: { fontSize: fontSizes.xs, color: colors.faint, fontWeight: '600', marginTop: 2 },
  contactBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.accent, borderRadius: radii.pill, paddingHorizontal: 12, paddingVertical: 9 },
  contactText: { color: colors.white, fontSize: fontSizes.xs, fontWeight: '800' },
  sectionTitle: { fontSize: fontSizes.lg, fontWeight: '900', color: colors.ink, letterSpacing: -0.3, marginTop: 8 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  stepConnector: {
    position: 'absolute',
    left: 11,
    top: 26,
    width: 2,
    height: 26,
    backgroundColor: colors.accentLine,
  },
  stepNode: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  stepNodeDone: { backgroundColor: colors.accentSoft, borderColor: colors.accentLine },
  stepNodeCurrent: { backgroundColor: colors.accent, borderColor: colors.accent, ...shadowSm },
  stepLabel: { flex: 1, fontSize: fontSizes.md, color: colors.faint, fontWeight: '700' },
  stepETA: { backgroundColor: colors.accentSoft, borderRadius: radii.pill, paddingHorizontal: 8, paddingVertical: 3 },
  stepETAText: { fontSize: fontSizes.xs, color: colors.accentDeep, fontWeight: '800' },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  itemName: { flex: 1, fontSize: fontSizes.sm, color: colors.ink },
  itemQty: { fontSize: fontSizes.sm, color: colors.faint },
  itemPrice: { fontSize: fontSizes.sm, fontWeight: '700', color: colors.ink },
  divider: { height: 1, backgroundColor: colors.divider, marginVertical: 6 },
  sumRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  sumLabel: { fontSize: fontSizes.sm, color: colors.faint },
  sumValue: { fontSize: fontSizes.sm, fontWeight: '700', color: colors.ink },
  totalRow: { borderTopWidth: 1, borderColor: colors.divider, paddingTop: 8, marginTop: 8 },
  totalLabel: { fontSize: fontSizes.md, fontWeight: '800', color: colors.ink },
  totalValue: { fontSize: fontSizes.lg, fontWeight: '900', color: colors.accent },
  shopBtn: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radii.m, paddingVertical: 15, alignItems: 'center', marginTop: 4 },
  shopBtnText: { color: colors.accentDeep, fontWeight: '800', fontSize: fontSizes.md },
});