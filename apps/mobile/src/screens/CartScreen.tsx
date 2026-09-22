import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { useApp } from '../context/AppContext';
import { useCart } from '../context/CartContext';
import QtyStepper from '../components/QtyStepper';
import EmptyState from '../components/EmptyState';
import Icon from '../components/Icon';
import { fmtRWF } from '../components/Money';
import { haptic, useToast } from '../components/Toast';
import ProductImage from '../components/ProductImage';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { colors, fontSizes, radii } from '../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export const FREE_DELIVERY_THRESHOLD = 15000;

const unitLabel: Record<string, Record<'en' | 'kin' | 'fr', string>> = {
  kg: { en: 'kg', kin: 'kg', fr: 'kg' },
  piece: { en: 'pc', kin: 'umwe', fr: 'pc' },
  bundle: { en: 'bd', kin: 'ugd', fr: 'bt' },
  pack: { en: 'pk', kin: 'pk', fr: 'pk' },
  dozen: { en: 'dz', kin: 'dz', fr: 'dz' },
  liter: { en: 'L', kin: 'L', fr: 'L' },
  box: { en: 'bx', kin: 'bx', fr: 'cse' },
};

export default function CartScreen() {
  const { t } = useTranslation();
  const { lang, user } = useApp();
  const cart = useCart();
  const nav = useNavigation<Nav>();
  const { show } = useToast();

  const progress = Math.min(cart.subtotal / FREE_DELIVERY_THRESHOLD, 1);
  const remaining = FREE_DELIVERY_THRESHOLD - cart.subtotal;
  const freeReached = cart.subtotal >= FREE_DELIVERY_THRESHOLD;

  const insets = useSafeAreaInsets();
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('cart.title')}</Text>
        {cart.lines.length > 0 && (
          <Text style={styles.itemCount}>{t('cart.itemCount', { count: cart.lines.length })}</Text>
        )}
      </View>

      {cart.lines.length === 0 ? (
        <View style={styles.emptyWrap}>
          <EmptyState
            icon="basket-outline"
            title={t('cart.empty')}
            message={t('cart.emptySub')}
            actionLabel={t('cart.emptyCta')}
            onAction={() => nav.navigate('Tabs', { screen: 'Home' })}
          />
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.progressCard}>
              <View style={styles.progressHead}>
                <Icon name={freeReached ? 'truck-fast' : 'truck-outline'} size={18} color={freeReached ? colors.success : colors.accent} />
                <Text style={[styles.progressText, freeReached && { color: colors.success }]}>
                  {freeReached ? t('cart.freeReached') : t('cart.freeProgress', { remaining: fmtRWF(Math.ceil(remaining)) })}
                </Text>
              </View>
              <View style={styles.progressTrack}>
                <LinearGradient
                  colors={freeReached ? [colors.ink, colors.inkSoft] : [colors.accent, colors.accentDark]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.progressFill, { width: `${Math.max(progress * 100, 4)}%` }]}
                />
              </View>
            </View>

            {cart.lines.map((l) => {
              const p = l.product;
              const unit = unitLabel[p.unit]?.[lang] ?? p.unit;
              return (
                <View key={p.id} style={styles.line}>
                  <ProductImage product={p} style={styles.emojiWrap} />
                  <View style={styles.lineBody}>
                    <View style={styles.lineTop}>
                      <Text style={styles.lineName} numberOfLines={1}>{p.name[lang]}</Text>
                      <Pressable onPress={() => { cart.remove(p.id); haptic('light'); }} hitSlop={8}>
                        <Icon name="trash-can-outline" size={17} color={colors.faint} />
                      </Pressable>
                    </View>
                    <Text style={styles.lineUnit}>{fmtRWF(p.price)} / {unit}</Text>
                    <View style={styles.lineBottom}>
                      <QtyStepper
                        qty={l.qty}
                        step={p.step}
                        min={0}
                        max={p.stockQty}
                        onChange={(q) => { haptic('light'); cart.setQty(p.id, q); }}
                      />
                      <Text style={styles.lineTotal}>{fmtRWF(l.qty * p.price)}</Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: 20 + insets.bottom }]}>
            <View style={styles.summary}>
              <View style={styles.summaryRow}>
                <Text style={styles.footerLabel}>{t('common.subtotal')}</Text>
                <Text style={styles.footerTotal}>{fmtRWF(cart.subtotal)}</Text>
              </View>
              <Text style={styles.footerNote}>{t('common.deliveryFee')} · {t('checkout.delivery')}</Text>
            </View>
            <Pressable
              onPress={() => {
                haptic('medium');
                if (!user) {
                  show(t('auth.signIn'), 'info');
                  nav.navigate('SignIn');
                  return;
                }
                nav.navigate('Checkout');
              }}
              style={({ pressed }) => [styles.checkoutBtn, pressed && styles.checkoutPressed]}
            >
              <Text style={styles.checkoutText}>{t('cart.checkout')}</Text>
              <Icon name="arrow-right" size={18} color={colors.white} />
            </Pressable>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'baseline', gap: 10, paddingHorizontal: 16, marginTop: 8 },
  title: { fontSize: fontSizes.xxl, fontWeight: '900', color: colors.ink, letterSpacing: -0.4 },
  itemCount: { fontSize: fontSizes.sm, color: colors.faint, fontWeight: '600' },
  emptyWrap: { flex: 1, justifyContent: 'center' },
  content: { padding: 16, gap: 12 },
  progressCard: { backgroundColor: colors.card, borderRadius: radii.m, borderWidth: 1, borderColor: colors.border, padding: 12, marginBottom: 2 },
  progressHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  progressText: { flex: 1, fontSize: fontSizes.xs, color: colors.harvest500, fontWeight: '700', lineHeight: 16 },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.leaf50,
    marginTop: 10,
    overflow: 'hidden',
  },
  progressFill: { height: 8, borderRadius: 4 },
  line: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: radii.l,
    padding: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emojiWrap: { width: 64, height: 64, borderRadius: radii.m, alignItems: 'center', justifyContent: 'center' },
  lineBody: { flex: 1 },
  lineTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  lineName: { fontSize: fontSizes.md, fontWeight: '700', color: colors.ink, flex: 1 },
  lineUnit: { fontSize: fontSizes.xs, color: colors.faint, marginTop: 2 },
  lineBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  lineTotal: { fontSize: fontSizes.md, fontWeight: '800', color: colors.ink },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    gap: 12,
  },
  summary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  summaryRow: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  footerLabel: { fontSize: fontSizes.md, fontWeight: '700', color: colors.ink },
  footerTotal: { fontSize: fontSizes.xl, fontWeight: '900', color: colors.ink },
  footerNote: { fontSize: fontSizes.xs, color: colors.faint },
  checkoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.accent,
    borderRadius: radii.m,
    paddingVertical: 15,
  },
  checkoutPressed: { backgroundColor: colors.accentDark },
  checkoutText: { color: colors.white, fontWeight: '800', fontSize: fontSizes.md },
});