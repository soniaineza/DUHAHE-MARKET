import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import type { Order, OrderStatus } from '@duhahe/shared';
import { api } from '../api';
import { useApp } from '../context/AppContext';
import { useCatalog } from '../context/CatalogContext';
import { useCart } from '../context/CartContext';
import StatusBadge from '../components/StatusBadge';
import EmptyState from '../components/EmptyState';
import Icon, { type IconName } from '../components/Icon';
import { fmtRWF } from '../components/Money';
import { haptic, useToast } from '../components/Toast';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { colors, fontSizes, radii } from '../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const FLOW: OrderStatus[] = ['pending', 'packing', 'in_transit', 'delivered'];

const statusIcons: Record<OrderStatus, IconName> = {
  pending: 'clipboard-text-clock-outline',
  packing: 'package-variant-closed',
  in_transit: 'motorbike',
  delivered: 'home-variant',
  cancelled: 'close-circle-outline',
};

export default function OrdersScreen() {
  const { t } = useTranslation();
  const { lang, profile, user } = useApp();
  const cart = useCart();
  const { products } = useCatalog();
  const { show } = useToast();
  const nav = useNavigation<Nav>();
  const [phone, setPhone] = useState(user?.phone ?? profile?.phone ?? '');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (phone.trim().length < 9) return;
    if (!silent) setLoading(true);
    try {
      setOrders(await api.recentOrders(phone.trim()));
      setLoaded(true);
    } catch {
      // keep previous list
    } finally {
      setLoading(false);
    }
  }, [phone]);

  const reorder = (o: Order) => {
    cart.clear();
    o.items.forEach((it) => {
      const product = products.find((p) => p.id === it.productId);
      if (product) cart.add(product, it.qty);
    });
    haptic('success');
    show(t('common.addedToCart'), 'success');
  };

  const payNow = async (o: Order) => {
    try {
      await api.stubPayment({ method: 'mtn_momo', orderId: o.id, phone: o.customer.phone, amount: o.total });
      haptic('success');
      show(t('notifications.orderPaid'), 'success');
      load(true);
    } catch {
      show(t('notifications.paymentFailed'), 'error');
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.navRow}>
        <Pressable onPress={() => nav.goBack()} hitSlop={10} style={styles.backBtn}>
          <Icon name="arrow-left" size={20} color={colors.ink} />
        </Pressable>
        <Text style={styles.title}>{t('profileMenu.orders')}</Text>
        <View style={{ width: 32 }} />
      </View>

      <View style={styles.searchRow}>
        <View style={styles.inputWrap}>
          <Icon name="phone-outline" size={18} color={colors.faint} />
          <TextInput
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            placeholder={t('checkout.phone')}
            placeholderTextColor={colors.faint}
            style={styles.input}
          />
        </View>
<Pressable onPress={() => { haptic('light'); load(); }} style={({ pressed }) => [styles.loadBtn, pressed && { opacity: 0.85 }]}>
            <Icon name="magnify" size={18} color={colors.white} />
          </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={() => load(true)} tintColor={colors.accent} colors={[colors.accent]} />
        }
      >
        {loading && orders.length === 0 && <ActivityIndicator color={colors.accent} style={{ marginVertical: 20 }} />}

        {loaded && orders.length === 0 && (
          <EmptyState icon="package-variant-closed" title={t('order.empty')} message={t('cart.emptyCta')} />
        )}

        {orders.map((o) => (
          <Pressable
            key={o.id}
            onPress={() => nav.navigate('Tracking', { orderNumber: o.orderNumber, phone: o.customer.phone })}
            style={({ pressed }) => [styles.card, pressed && { opacity: 0.96 }]}
          >
            <View style={styles.cardHead}>
              <View>
                <Text style={styles.orderNo}>{o.orderNumber}</Text>
                <Text style={styles.date}>
                  {t('order.placedOn').replace('{{date}}', new Date(o.createdAt).toLocaleDateString(lang === 'en' ? 'en-GB' : lang === 'fr' ? 'fr-FR' : 'rw-RW'))}
                </Text>
              </View>
              <StatusBadge status={o.status} />
            </View>

            {o.status !== 'cancelled' ? (
              <Timeline status={o.status} />
            ) : (
              <View style={styles.cancelledNote}>
                <Icon name="close-circle" size={14} color={colors.danger} />
                <Text style={styles.cancelledText}>{t('order.statusCancelled')}</Text>
              </View>
            )}

            <View style={styles.items}>
              {o.items.map((it) => (
                <View key={it.productId} style={styles.itemRow}>
                  <View style={styles.itemDot} />
                  <Text style={styles.itemName} numberOfLines={1}>{it.name[lang]}</Text>
                  <Text style={styles.itemQty}>{it.qty} {it.unit}</Text>
                  <Text style={styles.itemPrice}>{fmtRWF(it.lineTotal)}</Text>
                </View>
              ))}
            </View>

            <View style={styles.summary}>
              <View>
                <Text style={styles.sumText}>{t('common.deliveryFee')}: {fmtRWF(o.deliveryFee)}</Text>
                <Text style={styles.payInfo}>{o.paymentMethod.replace(/_/g, ' ')} · {o.paymentStatus}</Text>
              </View>
              <Text style={styles.total}>{fmtRWF(o.total)}</Text>
            </View>

            {(o.status !== 'cancelled' || o.paymentStatus === 'unpaid') && (
              <View style={styles.actions}>
                {o.status !== 'cancelled' && (
                  <Pressable onPress={() => reorder(o)} style={({ pressed }) => [styles.actionBtn, styles.actionBtnGhost, pressed && { opacity: 0.8 }]}>
                    <Icon name="refresh" size={15} color={colors.accent} />
                    <Text style={styles.actionGhostText}>{t('order.reorder')}</Text>
                  </Pressable>
                )}
                {o.paymentStatus === 'unpaid' && o.status !== 'cancelled' && (
                  <Pressable onPress={() => payNow(o)} style={({ pressed }) => [styles.actionBtn, { backgroundColor: colors.accent }, pressed && { opacity: 0.85 }]}>
                    <Icon name="credit-card-outline" size={15} color={colors.white} />
                    <Text style={styles.actionSolidText}>{t('order.payNow')}</Text>
                  </Pressable>
                )}
              </View>
            )}
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function Timeline({ status }: { status: OrderStatus }) {
  const { t } = useTranslation();
  const idx = FLOW.indexOf(status);
  return (
    <View style={styles.timeline}>
      {FLOW.map((s, i) => {
        const done = i < idx;
        const current = i === idx;
        const icon = statusIcons[s];
        return (
          <View key={s} style={styles.timelineStep}>
            <View style={[styles.tlConnector, i === 0 && { opacity: 0 }]} />
            <View style={[styles.tlNode, done && styles.tlNodeDone, current && styles.tlNodeCurrent]}>
              <Icon name={icon} size={12} color={current ? colors.white : done ? colors.accent : colors.faint} />
            </View>
            <View style={styles.tlLabelWrap}>
              <Text style={[styles.tlLabel, (done || current) && { color: colors.accent, fontWeight: '800' }]}>{t(`status.${s}`)}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginTop: 8 },
  backBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: fontSizes.xl, fontWeight: '900', color: colors.ink },
  searchRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginTop: 14, alignItems: 'center' },
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.m,
    paddingHorizontal: 12,
  },
  input: { flex: 1, paddingVertical: 11, fontSize: fontSizes.md, color: colors.ink },
  loadBtn: { width: 44, height: 44, borderRadius: radii.m, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.l,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  orderNo: { fontSize: fontSizes.md, fontWeight: '900', color: colors.ink },
  date: { fontSize: fontSizes.xs, color: colors.faint, marginTop: 2 },
  timeline: { flexDirection: 'row', marginTop: 14 },
  timelineStep: { flex: 1, alignItems: 'center' },
  tlConnector: {
    position: 'absolute',
    top: 11,
    left: '-50%',
    width: '100%',
    height: 2,
    backgroundColor: colors.accentLine,
  },
  tlNode: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  tlNodeDone: { backgroundColor: colors.accentSoft, borderColor: colors.accentLine },
  tlNodeCurrent: { backgroundColor: colors.accent, borderColor: colors.accent },
  tlLabelWrap: { marginTop: 6 },
  tlLabel: { fontSize: 8, color: colors.faint, fontWeight: '700', textAlign: 'center', maxWidth: 56 },
  cancelledNote: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14, backgroundColor: colors.dangerSoft, borderRadius: radii.s, padding: 8 },
  cancelledText: { fontSize: fontSizes.xs, color: colors.danger, fontWeight: '700' },
  items: { marginTop: 12, gap: 6, borderTopWidth: 1, borderColor: colors.divider, paddingTop: 10 },
  itemRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  itemDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.accentLine },
  itemName: { flex: 1, fontSize: fontSizes.sm, color: colors.ink },
  itemQty: { fontSize: fontSizes.sm, color: colors.faint },
  itemPrice: { fontSize: fontSizes.sm, fontWeight: '700', color: colors.ink },
  summary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderColor: colors.divider,
    marginTop: 10,
    paddingTop: 10,
  },
  sumText: { fontSize: fontSizes.xs, color: colors.faint },
  payInfo: { fontSize: fontSizes.xs, color: colors.faint, textTransform: 'capitalize', marginTop: 2 },
  total: { fontSize: fontSizes.lg, fontWeight: '900', color: colors.ink },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: radii.m,
    paddingVertical: 11,
  },
  actionBtnGhost: { backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.accentLine },
  actionGhostText: { fontSize: fontSizes.sm, color: colors.accentDark, fontWeight: '800' },
  actionSolidText: { fontSize: fontSizes.sm, color: colors.white, fontWeight: '800' },
});