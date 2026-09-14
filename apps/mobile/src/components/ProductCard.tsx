import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { Product } from '@duhahe/shared';
import { useApp } from '../context/AppContext';
import { useCart } from '../context/CartContext';
import { useFavorites } from '../context/FavoritesContext';
import { colors, fontSizes, radii } from '../theme';
import { fmtRWF } from './Money';
import ProductImage from './ProductImage';
import Icon from './Icon';
import { haptic, useToast } from './Toast';
import type { RootStackParamList } from '../navigation/RootNavigator';

interface Props {
  product: Product;
  onPress?: () => void;
  qtyInCart?: number;
  wide?: boolean;
  compact?: boolean;
  showFavorite?: boolean;
}

const unitShort: Record<string, Record<'en' | 'kin' | 'fr', string>> = {
  kg: { en: 'kg', kin: 'kg', fr: 'kg' },
  piece: { en: 'pc', kin: 'umwe', fr: 'pc' },
  bundle: { en: 'bundle', kin: 'umuganda', fr: 'botte' },
  pack: { en: 'pack', kin: 'ipaki', fr: 'paquet' },
  dozen: { en: 'dz', kin: 'igana', fr: 'dz' },
  liter: { en: 'L', kin: 'L', fr: 'L' },
  box: { en: 'box', kin: 'agasanduku', fr: 'caisse' },
  bottle: { en: 'bottle', kin: 'icupa', fr: 'bouteille' },
  can: { en: 'can', kin: 'agakopo', fr: 'canette' },
  bag: { en: 'bag', kin: 'agasaho', fr: 'sac' },
  pair: { en: 'pair', kin: 'ingana', fr: 'paire' },
};

export default function ProductCard({ product, onPress, qtyInCart = 0, wide = false, compact = false, showFavorite = true }: Props) {
  const { lang } = useApp();
  const cart = useCart();
  const fav = useFavorites();
  const { show } = useToast();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const unit = unitShort[product.unit]?.[lang] ?? product.unit;
  const name = product.name[lang];
  const oos = product.stockQty <= 0;
  const isFav = fav.isFav(product.id);

  const quickAdd = () => {
    if (oos) return;
    cart.add(product);
    haptic('success');
    show(name, 'success');
  };

  return (
    <Pressable
      onPress={onPress ?? (() => nav.navigate('ProductDetails', { productId: product.id }))}
      style={({ pressed }) => [styles.card, wide && styles.cardWide, compact && styles.cardCompact, pressed && styles.pressed]}
    >
      <View style={styles.tile}>
        <ProductImage product={product} style={[styles.tileImg, compact && styles.tileImgCompact, wide && styles.tileImgWide]} resizeMode="cover" />
        {product.organic && (
          <View style={styles.organic}>
            <Icon name="leaf" size={9} color={colors.primary} />
            <Text style={styles.organicText}>{lang === 'kin' ? 'Kimeza' : lang === 'fr' ? 'Bio' : 'Organic'}</Text>
          </View>
        )}
        {showFavorite && (
          <Pressable
            onPress={() => { fav.toggle(product.id); haptic('light'); }}
            hitSlop={8}
            style={({ pressed }) => [styles.fav, pressed && { opacity: 0.85 }]}
          >
            <Icon name={isFav ? 'heart' : 'heart-outline'} size={15} color={isFav ? colors.danger : colors.ink} />
          </Pressable>
        )}
        {qtyInCart > 0 && (
          <View style={styles.qtyBadge}>
            <Text style={styles.qtyBadgeText}>{qtyInCart}</Text>
          </View>
        )}
        {oos && (
          <View style={styles.oosTag}>
            <Text style={styles.oosTagText}>{lang === 'kin' ? 'Ntiboneka' : lang === 'fr' ? 'Épuisé' : 'Sold out'}</Text>
          </View>
        )}
      </View>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={2}>{name}</Text>
        <Text style={styles.sub} numberOfLines={1}>{product.farmer ?? unit}</Text>
        <View style={styles.priceRow}>
          <Text style={styles.price} numberOfLines={1}>{fmtRWF(product.price)}</Text>
          {oos ? (
            <View style={[styles.addBtn, styles.addBtnOos]}>
              <Icon name="close" size={15} color={colors.faint} />
            </View>
          ) : qtyInCart > 0 ? (
            <Pressable
              onPress={quickAdd}
              style={({ pressed }) => [styles.addBtn, styles.addBtnHasQty, pressed && styles.addPressed]}
              hitSlop={6}
            >
              <Icon name="plus" size={15} color={colors.primary} />
            </Pressable>
          ) : (
            <Pressable onPress={quickAdd} style={({ pressed }) => [styles.addBtn, pressed && styles.addPressed]} hitSlop={6}>
              <Icon name="plus" size={17} color={colors.white} />
            </Pressable>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.l,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardWide: { width: 168 },
  cardCompact: { borderRadius: radii.m },
  pressed: { opacity: 0.94, transform: [{ scale: 0.985 }] },
  tile: { position: 'relative', backgroundColor: colors.primarySoft },
  tileImg: { height: 116 },
  tileImgWide: { height: 124 },
  tileImgCompact: { height: 92 },
  organic: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.surface,
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  organicText: { fontSize: 9, color: colors.primary, fontWeight: '800', letterSpacing: 0.2 },
  fav: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBadge: {
    position: 'absolute',
    top: 8,
    right: 42,
    backgroundColor: colors.primary,
    borderRadius: 999,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  qtyBadgeText: { color: colors.white, fontSize: 9, fontWeight: '900' },
  oosTag: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(23,26,24,0.8)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  oosTagText: { color: colors.white, fontSize: 9, fontWeight: '800' },
  info: { padding: 11, paddingBottom: 12 },
  name: { fontSize: fontSizes.sm, fontWeight: '700', color: colors.ink, lineHeight: 18 },
  sub: { fontSize: fontSizes.xs, color: colors.faint, fontWeight: '600', marginTop: 2 },
  priceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 7 },
  price: { fontSize: fontSizes.md, fontWeight: '900', color: colors.ink },
  addBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnHasQty: { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.primary },
  addBtnOos: { backgroundColor: colors.chip },
  addPressed: { transform: [{ scale: 0.9 }], opacity: 0.9 },
});