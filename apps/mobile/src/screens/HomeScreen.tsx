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
import { FRAME_MAX_WIDTH, useResponsive } from '../hooks/useResponsive';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { colors, fontSizes, fonts, radii } from '../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function HomeScreen() {
  const { t } = useTranslation();
  const nav = useNavigation<Nav>();
  const { products, loading, refresh } = useCatalog();
  const { itemWidth, gap, isDesktop } = useResponsive();

  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const featured = useMemo(() => FEATURED_IDS.map((id) => byId.get(id)).filter((p): p is NonNullable<typeof p> => !!p), [byId]);
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    products.forEach((p) => m.set(p.category, (m.get(p.category) ?? 0) + 1));
    return m;
  }, [products]);

  const searchBar = (
    <Pressable
      style={({ pressed }) => [styles.searchBar, isDesktop ? styles.searchBarDesktop : styles.searchBarMobile, pressed && styles.pressed]}
      onPress={() => nav.navigate('Search', { q: undefined })}
    >
      <Icon name="magnify" size={20} color={colors.muted} />
      <Text style={styles.searchPlaceholder} numberOfLines={1}>{t('common.search')}</Text>
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.primary} />}
      >
        {/* Phone header: brand + actions, search below. On desktop the site header (DesktopHeader) does this job. */}
        {!isDesktop && (
        <>
        <View style={styles.header}>
          <View style={styles.locPin}>
            <Icon name="map-marker" size={18} color={colors.white} />
          </View>
          <View style={styles.brandCol}>
            <Pressable onPress={() => { haptic('light'); nav.navigate('About'); }} hitSlop={6}>
              <Text style={styles.locCity} numberOfLines={2}>{t('about.brand')}</Text>
            </Pressable>
            <Pressable onPress={() => { haptic('light'); nav.navigate('Addresses'); }} style={styles.locSubRow} hitSlop={6}>
              <Text style={styles.locSub}>{t('home.deliverTo')}</Text>
              <Icon name="chevron-down" size={12} color={colors.muted} />
            </Pressable>
          </View>
          <View style={styles.actions}>
            <Pressable style={styles.iconBtn} hitSlop={6} onPress={() => { haptic('light'); nav.navigate('About'); }}>
              <Icon name="information-outline" size={20} color={colors.ink} />
            </Pressable>
            <Pressable style={styles.iconBtn} hitSlop={6} onPress={() => { haptic('light'); nav.navigate('Notifications'); }}>
              <Icon name="bell-outline" size={20} color={colors.ink} />
              <View style={styles.bellDot} />
            </Pressable>
          </View>
        </View>

        {searchBar}
        </>
        )}

        {/* Delivery promo */}
        <Pressable
          onPress={() => nav.navigate('Category', { category: 'staples' })}
          style={({ pressed }) => [styles.promo, isDesktop && styles.promoDesktop, pressed && styles.pressed]}
        >
          <View style={{ flex: 1 }}>
            <Text style={[styles.promoTitle, isDesktop && styles.promoTitleDesktop]}>{t('home.deliveryTitle')}</Text>
            <Text style={styles.promoSub}>{t('home.deliverySub')}</Text>
            <View style={styles.promoCta}>
              <Text style={styles.promoCtaText}>{t('home.shopNow')}</Text>
              <Icon name="arrow-right" size={14} color={colors.white} />
            </View>
          </View>
          <View style={[styles.promoIcon, isDesktop && styles.promoIconDesktop]}>
            <Icon name="truck-fast-outline" size={isDesktop ? 44 : 34} color={colors.ink} />
          </View>
        </Pressable>

        {/* Categories: tile and label share one item so they always scroll together */}
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>{t('home.categoriesTitle')}</Text>
          <Pressable onPress={() => nav.navigate('Tabs', { screen: 'Categories' })} hitSlop={6} style={styles.seeAll}>
            <Text style={styles.seeAllText}>{t('common.seeAll')}</Text>
          </Pressable>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          scrollEnabled={!isDesktop}
          style={isDesktop ? undefined : styles.catScroll}
          contentContainerStyle={[styles.catRow, isDesktop && styles.catRowDesktop]}
        >
          {CATEGORIES.map((id) => (
            <Pressable
              key={id}
              onPress={() => nav.navigate('Category', { category: id })}
              style={({ pressed }) => [styles.catItem, isDesktop && styles.catItemDesktop, pressed && { opacity: 0.85 }]}
            >
              <View style={styles.catTile}>
                <CategoryImage category={id} style={styles.catImg} />
              </View>
              <Text style={styles.catLabel} numberOfLines={2}>{t(`categories.${id}`)}</Text>
              <Text style={styles.catCount}>{counts.get(id) ?? 0}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Popular this week */}
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>{t('home.popular')}</Text>
          <Pressable onPress={() => nav.navigate('Search', { q: undefined })} hitSlop={6} style={styles.seeAll}>
            <Text style={styles.seeAllText}>{t('common.seeAll')}</Text>
          </Pressable>
        </View>
        <View style={[styles.grid, { columnGap: gap, rowGap: gap }]}>
          {featured.map((p) => (
            <View key={p.id} style={[styles.gridItem, { width: itemWidth }]}>
              <ProductCard product={p} />
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  // One container for the whole page: header, search, banner, categories and grid all share its edges.
  content: { paddingHorizontal: 16, paddingBottom: 32, width: '100%', maxWidth: FRAME_MAX_WIDTH, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8, minHeight: 44 },
  brandCol: { flexShrink: 1, minWidth: 0 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 'auto' },
  locPin: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  locCity: { fontSize: fontSizes.md + 1, lineHeight: 20, fontWeight: '800', color: colors.ink, fontFamily: fonts.bold, letterSpacing: -0.3 },
  locSubRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 1 },
  locSub: { fontSize: fontSizes.xs, color: colors.muted, fontWeight: '500' },
  iconBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  bellDot: { position: 'absolute', top: 11, right: 12, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent, borderWidth: 1.5, borderColor: colors.surface },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 48,
    backgroundColor: colors.surface,
    borderRadius: radii.m,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
  },
  searchBarMobile: { marginTop: 12, width: '100%' },
  searchBarDesktop: { flex: 1, maxWidth: 560, marginLeft: 'auto', marginRight: 'auto' },
  searchPlaceholder: { flex: 1, fontSize: fontSizes.md, color: colors.muted, fontWeight: '500' },
  promo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    backgroundColor: colors.accent,
    borderRadius: radii.l,
    paddingVertical: 16,
    paddingLeft: 18,
    paddingRight: 14,
  },
  promoDesktop: { paddingVertical: 24, paddingLeft: 32, paddingRight: 32, marginTop: 18 },
  pressed: { opacity: 0.9 },
  promoTitle: { fontSize: fontSizes.lg, fontWeight: '900', color: colors.ink, fontFamily: fonts.extrabold, letterSpacing: -0.3 },
  promoTitleDesktop: { fontSize: fontSizes.xxl },
  promoSub: { fontSize: fontSizes.sm, color: colors.ink, opacity: 0.8, marginTop: 4, lineHeight: 18 },
  promoCta: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6, marginTop: 12, backgroundColor: colors.ink, borderRadius: radii.pill, paddingHorizontal: 16, paddingVertical: 8 },
  promoCtaText: { fontSize: fontSizes.sm, fontWeight: '800', color: colors.white },
  promoIcon: { marginLeft: 12, width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.45)', alignItems: 'center', justifyContent: 'center' },
  promoIconDesktop: { width: 88, height: 88, borderRadius: 44 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 24, marginBottom: 12 },
  sectionTitle: { fontSize: fontSizes.lg, fontWeight: '800', color: colors.ink, fontFamily: fonts.bold, letterSpacing: -0.3 },
  seeAll: { minHeight: 32, justifyContent: 'center' },
  seeAllText: { fontSize: fontSizes.sm, color: colors.ink, fontWeight: '700', textDecorationLine: 'underline' },
  // Mobile: swipeable row that bleeds to the screen edge. Desktop: all eight tiles share the row evenly.
  catScroll: { marginHorizontal: -16 },
  catRow: { paddingHorizontal: 16, gap: 12 },
  catRowDesktop: { flexGrow: 1, paddingHorizontal: 0, gap: 16 },
  catItem: { width: 88, alignItems: 'center' },
  catItemDesktop: { flex: 1, width: undefined },
  catTile: { width: '100%', aspectRatio: 1, borderRadius: radii.m, overflow: 'hidden', backgroundColor: colors.primarySoft },
  catImg: { width: '100%', height: '100%' },
  catLabel: { marginTop: 8, fontSize: fontSizes.sm, fontWeight: '700', color: colors.ink, textAlign: 'center', lineHeight: 16 },
  catCount: { marginTop: 1, fontSize: fontSizes.xs, color: colors.muted, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start' },
  gridItem: { width: '48.5%' },
});
