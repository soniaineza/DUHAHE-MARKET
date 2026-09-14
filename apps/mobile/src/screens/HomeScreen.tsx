import { useMemo } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { CATEGORIES } from '@duhahe/shared';
import { useCatalog } from '../context/CatalogContext';
import ProductCard from '../components/ProductCard';
import CategoryImage from '../components/CategoryImage';
import Icon from '../components/Icon';
import { haptic } from '../components/Toast';
import { FEATURED_IDS } from '../data/discovery';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { colors, fontSizes, fonts, radii, shadow } from '../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function HomeScreen() {
  const { t } = useTranslation();
  const nav = useNavigation<Nav>();
  const { products, loading, refresh } = useCatalog();

  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const featured = useMemo(() => FEATURED_IDS.map((id) => byId.get(id)).filter((p): p is NonNullable<typeof p> => !!p), [byId]);
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    products.forEach((p) => m.set(p.category, (m.get(p.category) ?? 0) + 1));
    return m;
  }, [products]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.primary} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.locPin}>
            <Icon name="map-marker" size={18} color={colors.white} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.locCity}>Duhahe</Text>
            <Pressable onPress={() => { haptic('light'); nav.navigate('Addresses'); }} style={styles.locSubRow} hitSlop={6}>
              <Text style={styles.locSub}>{t('home.deliverTo')}</Text>
              <Icon name="chevron-down" size={12} color={colors.faint} />
            </Pressable>
          </View>
          <Pressable style={styles.bellBtn} hitSlop={6} onPress={() => { haptic('light'); nav.navigate('Notifications'); }}>
            <Icon name="bell-outline" size={22} color={colors.ink} />
            <View style={styles.bellDot} />
          </Pressable>
        </View>

        {/* Search */}
        <Pressable style={styles.searchBar} onPress={() => nav.navigate('Search', { q: undefined })}>
          <Icon name="magnify" size={20} color={colors.muted} />
          <Text style={styles.searchPlaceholder}>{t('common.search')}</Text>
        </Pressable>

        {/* Delivery promo */}
        <Pressable
          onPress={() => nav.navigate('Category', { category: 'staples' })}
          style={({ pressed }) => [styles.promo, pressed && styles.pressed]}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.promoTitle}>{t('home.deliveryTitle')}</Text>
            <Text style={styles.promoSub}>{t('home.deliverySub')}</Text>
            <View style={styles.promoCta}>
              <Text style={styles.promoCtaText}>{t('home.shopNow')}</Text>
              <Icon name="arrow-right" size={14} color={colors.ink} />
            </View>
          </View>
          <View style={styles.promoIcon}>
            <Icon name="truck-fast-outline" size={40} color={colors.ink} />
          </View>
        </Pressable>

        {/* Categories */}
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>{t('home.categoriesTitle')}</Text>
          <Pressable onPress={() => nav.navigate('Tabs', { screen: 'Categories' })} hitSlop={6} style={styles.seeAll}>
            <Text style={styles.seeAllText}>{t('common.seeAll')}</Text>
          </Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catRow}>
          {CATEGORIES.map((id) => (
            <Pressable
              key={id}
              onPress={() => nav.navigate('Category', { category: id })}
              style={({ pressed }) => [styles.catItem, pressed && { opacity: 0.85 }]}
            >
              <View style={styles.catTile}>
                <CategoryImage category={id} style={styles.catImg} />
              </View>
            </Pressable>
          ))}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catLabelRow}>
          {CATEGORIES.map((id) => {
            const cnt = counts.get(id) ?? 0;
            return (
              <Pressable
                key={id}
                onPress={() => nav.navigate('Category', { category: id })}
                style={styles.catLabelItem}
              >
                <Text style={styles.catLabel} numberOfLines={1}>{t(`categories.${id}`)}</Text>
                <Text style={styles.catCount}>{cnt}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Popular this week */}
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>{t('home.popular')}</Text>
          <Pressable onPress={() => nav.navigate('Search', { q: undefined })} hitSlop={6} style={styles.seeAll}>
            <Text style={styles.seeAllText}>{t('common.seeAll')}</Text>
          </Pressable>
        </View>
        <View style={styles.grid}>
          {featured.map((p) => (
            <View key={p.id} style={styles.gridItem}>
              <ProductCard product={p} />
            </View>
          ))}
        </View>
        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 16, paddingBottom: 24 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 6 },
  locPin: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  locCity: { fontSize: fontSizes.lg, fontWeight: '800', color: colors.ink, fontFamily: fonts.bold, letterSpacing: -0.3 },
  locSubRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 1 },
  locSub: { fontSize: fontSizes.xs, color: colors.muted, fontWeight: '500' },
  bellBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  bellDot: { position: 'absolute', top: 9, right: 10, width: 7, height: 7, borderRadius: 4, backgroundColor: colors.accent },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
    backgroundColor: colors.surface,
    borderRadius: radii.m,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 13,
    ...shadow.sm,
  },
  searchPlaceholder: { fontSize: fontSizes.md, color: colors.faint, fontWeight: '500' },
  promo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    backgroundColor: colors.accent,
    borderRadius: radii.l,
    padding: 18,
    paddingRight: 14,
  },
  pressed: { opacity: 0.9 },
  promoTitle: { fontSize: fontSizes.lg, fontWeight: '900', color: colors.ink, fontFamily: fonts.extrabold, letterSpacing: -0.3 },
  promoSub: { fontSize: fontSizes.sm, color: colors.ink, opacity: 0.75, marginTop: 4, lineHeight: 18 },
  promoCta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14 },
  promoCtaText: { fontSize: fontSizes.sm, fontWeight: '800', color: colors.ink },
  promoIcon: { marginLeft: 12 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 24, marginBottom: 14 },
  sectionTitle: { fontSize: fontSizes.lg, fontWeight: '800', color: colors.ink, fontFamily: fonts.bold, letterSpacing: -0.3 },
  seeAll: {},
  seeAllText: { fontSize: fontSizes.sm, color: colors.primary, fontWeight: '700' },
  catRow: { paddingRight: 8 },
  catItem: { marginRight: 10 },
  catTile: { width: 84, height: 84, borderRadius: radii.m, overflow: 'hidden', backgroundColor: colors.primarySoft },
  catImg: { width: '100%', height: '100%' },
  catLabelRow: { marginTop: 8, paddingRight: 8 },
  catLabelItem: { marginRight: 10, width: 84, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  catLabel: { fontSize: fontSizes.sm, fontWeight: '600', color: colors.ink },
  catCount: { fontSize: fontSizes.xs, color: colors.faint, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 14 },
  gridItem: { width: '48.5%' },
});