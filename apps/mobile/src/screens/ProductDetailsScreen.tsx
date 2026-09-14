import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import ProductImage from '../components/ProductImage';
import QtyStepper from '../components/QtyStepper';
import Icon from '../components/Icon';
import { fmtRWF } from '../components/Money';
import { haptic, useToast } from '../components/Toast';
import { useApp } from '../context/AppContext';
import { useCart } from '../context/CartContext';
import { useFavorites } from '../context/FavoritesContext';
import { useCatalog } from '../context/CatalogContext';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { colors, fontSizes, fonts, radii, shadow } from '../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'ProductDetails'>;

const unitLabel: Record<string, Record<'en' | 'kin' | 'fr', string>> = {
  kg: { en: 'kg', kin: 'kg', fr: 'kg' },
  piece: { en: 'pc', kin: 'umwe', fr: 'pièce' },
  bundle: { en: 'bundle', kin: 'umuganda', fr: 'botte' },
  pack: { en: 'pack', kin: 'ipaki', fr: 'paquet' },
  dozen: { en: 'dozen', kin: 'igana', fr: 'douzaine' },
  liter: { en: 'L', kin: 'litiro', fr: 'litre' },
  box: { en: 'box', kin: 'agasanduku', fr: 'caisse' },
  bottle: { en: 'bottle', kin: 'icupa', fr: 'bouteille' },
  can: { en: 'can', kin: 'agakopo', fr: 'canette' },
  bag: { en: 'bag', kin: 'agasaho', fr: 'sac' },
  pair: { en: 'pair', kin: 'ingana', fr: 'paire' },
};

export default function ProductDetailsScreen() {
  const { t } = useTranslation();
  const { lang } = useApp();
  const nav = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { products } = useCatalog();
  const cart = useCart();
  const fav = useFavorites();
  const { show } = useToast();

  const product = useMemo(() => products.find((p) => p.id === route.params.productId), [products, route.params.productId]);

  const [qty, setQty] = useState(product?.minOrderQty ?? 1);

  useEffect(() => {
    if (product) setQty(product.minOrderQty);
  }, [product]);

  if (!product) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.missing}>
          <Icon name="alert-circle-outline" size={40} color={colors.faint} />
          <Text style={styles.missingText}>{t('product.notFound')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const unit = unitLabel[product.unit]?.[lang] ?? product.unit;
  const oos = product.stockQty <= 0;
  const isFav = fav.isFav(product.id);
  const lowStock = !oos && product.stockQty <= 30;

  const presets = [
    product.minOrderQty,
    product.step > 1 ? product.minOrderQty + product.step : product.minOrderQty * 2,
  ];

  const addToCart = () => {
    cart.add(product, qty);
    haptic('success');
    show(product.name[lang], 'success');
  };

  return (
    <View style={styles.safe}>
      <SafeAreaView edges={['top']} style={styles.topSafe}>
        <View style={styles.topBar}>
          <Pressable onPress={() => nav.goBack()} hitSlop={8} style={styles.circleBtn}>
            <Icon name="arrow-left" size={20} color={colors.ink} />
          </Pressable>
          <Pressable onPress={() => { fav.toggle(product.id); haptic('light'); }} hitSlop={8} style={styles.circleBtn}>
            <Icon name={isFav ? 'heart' : 'heart-outline'} size={20} color={isFav ? colors.danger : colors.ink} />
          </Pressable>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ProductImage product={product} style={styles.photo} resizeMode="cover" />

        <View style={styles.body}>
          <View style={styles.tagsRow}>
            {product.organic && (
              <View style={styles.tag}><Icon name="leaf" size={12} color={colors.primary} /><Text style={styles.tagText}>{t('product.organic')}</Text></View>
            )}
            {product.farmer ? (
              <View style={styles.tag}><Icon name="store-outline" size={12} color={colors.primary} /><Text style={styles.tagText}>{t('product.fromFarmer')}: {product.farmer}</Text></View>
            ) : null}
            {lowStock && (
              <View style={[styles.tag, styles.tagWarn]}><Text style={[styles.tagText, styles.tagTextWarn]}>{t('common.inStock')}</Text></View>
            )}
            {oos && (
              <View style={[styles.tag, styles.tagDanger]}><Icon name="close-circle" size={12} color={colors.danger} /><Text style={[styles.tagText, styles.tagTextDanger]}>{t('common.outOfStock')}</Text></View>
            )}
          </View>

          <Text style={styles.name}>{product.name[lang]}</Text>
          <Text style={styles.secondary}>{product.name[lang === 'en' ? 'kin' : lang === 'kin' ? 'fr' : 'en']}</Text>
          <Text style={styles.description}>{product.description[lang]}</Text>

          <View style={styles.priceRow}>
            <Text style={styles.price}>{fmtRWF(product.price)}</Text>
            <Text style={styles.perUnit}>/ {unit}</Text>
          </View>

          <View style={styles.presetRow}>
            {presets.map((p) => {
              const active = qty === p;
              return (
                <Pressable
                  key={p}
                  onPress={() => { setQty(p); haptic('light'); }}
                  style={({ pressed }) => [styles.preset, active && styles.presetActive, pressed && { opacity: 0.8 }]}
                >
                  <Text style={[styles.presetText, active && styles.presetTextActive]}>{p} {unit}</Text>
                  {active && <Icon name="check" size={13} color={colors.white} />}
                </Pressable>
              );
            })}
          </View>

          <View style={styles.qtyRow}>
            <View>
              <Text style={styles.label}>{t('common.quantity')}</Text>
              <QtyStepper qty={qty} step={product.step} min={product.minOrderQty} max={product.stockQty} onChange={setQty} />
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.label}>{t('common.total')}</Text>
              <Text style={styles.lineTotal}>{fmtRWF(qty * product.price)}</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          disabled={oos}
          onPress={addToCart}
          style={({ pressed }) => [styles.addBtn, oos && styles.addBtnDisabled, pressed && !oos && styles.addBtnPressed]}
        >
          {oos ? (
            <Text style={[styles.addBtnText, styles.addBtnTextDisabled]}>{t('common.outOfStock')}</Text>
          ) : (
            <>
              <Icon name="cart-plus" size={18} color={colors.white} />
              <Text style={styles.addBtnText}>{t('common.addToCart')} · {fmtRWF(qty * product.price)}</Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  topSafe: { backgroundColor: colors.bg },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingTop: 6, paddingBottom: 8 },
  circleBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  missingText: { fontSize: fontSizes.md, color: colors.muted, fontWeight: '600' },
  content: { paddingBottom: 24 },
  photo: { width: '100%', height: 270 },
  body: { paddingHorizontal: 16, paddingTop: 16 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.primarySoft, borderRadius: radii.s, paddingHorizontal: 9, paddingVertical: 5 },
  tagText: { fontSize: fontSizes.xs, color: colors.primary, fontWeight: '700' },
  tagWarn: { backgroundColor: colors.warnSoft },
  tagTextWarn: { color: colors.warn },
  tagDanger: { backgroundColor: colors.dangerSoft },
  tagTextDanger: { color: colors.danger, fontWeight: '700' },
  name: { fontSize: fontSizes.xxl, fontWeight: '900', color: colors.ink, fontFamily: fonts.black, letterSpacing: -0.5, marginTop: 12 },
  secondary: { fontSize: fontSizes.sm, color: colors.faint, marginTop: 2, fontWeight: '500' },
  description: { fontSize: fontSizes.md, color: colors.muted, marginTop: 10, lineHeight: 22 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 16 },
  price: { fontSize: fontSizes.xxl, fontWeight: '900', color: colors.ink, fontFamily: fonts.black },
  perUnit: { fontSize: fontSizes.md, color: colors.faint, marginLeft: 4 },
  presetRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  preset: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: colors.border, borderRadius: radii.pill, paddingHorizontal: 14, paddingVertical: 8 },
  presetActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  presetText: { fontSize: fontSizes.xs, color: colors.muted, fontWeight: '700' },
  presetTextActive: { color: colors.white },
  qtyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 18, paddingTop: 14, borderTopWidth: 1, borderColor: colors.divider },
  label: { fontSize: fontSizes.xs, color: colors.faint, marginBottom: 6, fontWeight: '700' },
  lineTotal: { fontSize: fontSizes.lg, fontWeight: '800', color: colors.ink },
  footer: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 20, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.primary, borderRadius: radii.m, paddingVertical: 15, ...shadow.sm },
  addBtnPressed: { backgroundColor: colors.primaryDark },
  addBtnDisabled: { backgroundColor: colors.chip },
  addBtnText: { color: colors.white, fontSize: fontSizes.md, fontWeight: '800' },
  addBtnTextDisabled: { color: colors.faint },
});