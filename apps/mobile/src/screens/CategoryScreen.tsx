import { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import type { CategoryId } from '@duhahe/shared';
import ProductCard from '../components/ProductCard';
import Icon from '../components/Icon';
import { haptic } from '../components/Toast';
import { useCatalog } from '../context/CatalogContext';
import { categoryPhotoUrl } from '../lib/productImage';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { colors, fontSizes, fonts, radii } from '../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'Category'>;

const SORTS = ['default', 'price_asc', 'price_desc'] as const;

export default function CategoryScreen() {
  const { t } = useTranslation();
  const nav = useNavigation<Nav>();
  const route = useRoute<Route>();
  const category = route.params.category;
  const { products } = useCatalog();
  const [sort, setSort] = useState<(typeof SORTS)[number]>('default');

  const items = useMemo(() => {
    const list = products.filter((p) => p.category === category);
    if (sort === 'price_asc') return [...list].sort((a, b) => a.price - b.price);
    if (sort === 'price_desc') return [...list].sort((a, b) => b.price - a.price);
    return list;
  }, [products, category, sort]);

  const label = t(`categories.${category}`);

  return (
    <View style={styles.safe}>
      <View style={styles.topBar}>
        <SafeAreaView edges={['top']}>
          <View style={styles.topRow}>
            <Pressable onPress={() => nav.goBack()} hitSlop={8} style={styles.backBtn}>
              <Icon name="arrow-left" size={20} color={colors.ink} />
            </Pressable>
            <Text style={styles.title} numberOfLines={1}>{label}</Text>
            <View style={styles.backBtn} />
          </View>
        </SafeAreaView>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.banner}>
          <Image source={{ uri: categoryPhotoUrl(category as CategoryId) }} style={styles.bannerImg} resizeMode="cover" />
          <View style={styles.bannerOverlay} />
          <View style={styles.bannerText}>
            <Text style={styles.bannerName}>{label}</Text>
            <Text style={styles.bannerCount}>{t('product.count', { count: items.length })}</Text>
          </View>
        </View>

        <View style={styles.sortRow}>
          {SORTS.map((s) => {
            const active = sort === s;
            return (
              <Pressable
                key={s}
                onPress={() => { setSort(s); haptic('light'); }}
                style={[styles.sortChip, active && styles.sortChipActive]}
              >
                <Text style={[styles.sortText, active && styles.sortTextActive]}>
                  {s === 'default' ? t('category.sortDefault') : s === 'price_asc' ? t('category.sortLow') : t('category.sortHigh')}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.grid}>
          {items.map((p) => (
            <View key={p.id} style={styles.gridItem}>
              <ProductCard product={p} />
            </View>
          ))}
        </View>
        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  topBar: { backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 8 },
  backBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  title: { flex: 1, textAlign: 'center', fontSize: fontSizes.lg, fontWeight: '800', color: colors.ink, fontFamily: fonts.bold },
  content: { paddingHorizontal: 16 },
  banner: { marginTop: 14, height: 150, borderRadius: radii.l, overflow: 'hidden', backgroundColor: colors.primarySoft },
  bannerImg: { width: '100%', height: '100%' },
  bannerOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(8,116,67,0.35)' },
  bannerText: { position: 'absolute', left: 16, bottom: 12 },
  bannerName: { fontSize: fontSizes.xl, fontWeight: '900', color: colors.white, fontFamily: fonts.black, letterSpacing: -0.4 },
  bannerCount: { fontSize: fontSizes.sm, color: 'rgba(255,255,255,0.9)', fontWeight: '600', marginTop: 2 },
  sortRow: { flexDirection: 'row', gap: 8, marginTop: 14, marginBottom: 14 },
  sortChip: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radii.pill, paddingHorizontal: 14, paddingVertical: 7 },
  sortChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  sortText: { fontSize: fontSizes.sm, color: colors.muted, fontWeight: '600' },
  sortTextActive: { color: colors.white, fontWeight: '800' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 14 },
  gridItem: { width: '48.5%' },
});