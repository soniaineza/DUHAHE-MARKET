import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { useApp } from '../context/AppContext';
import { useCatalog } from '../context/CatalogContext';
import SearchField from '../components/SearchField';
import Chip from '../components/Chip';
import ProductCard from '../components/ProductCard';
import EmptyState from '../components/EmptyState';
import Icon from '../components/Icon';
import { haptic } from '../components/Toast';
import { POPULAR_SEARCHES, SUGGESTED_SEARCHES, pick } from '../data/discovery';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { colors, fontSizes, radii } from '../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'Search'>;

export default function SearchScreen() {
  const { t } = useTranslation();
  const { lang } = useApp();
  const nav = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { search: searchProducts } = useCatalog();
  const [query, setQuery] = useState(route.params?.q ?? '');
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    if (route.params?.q) setQuery(route.params.q ?? '');
  }, [route.params?.q]);

  const commit = (q: string) => {
    const v = q.trim();
    if (!v) return;
    haptic('light');
    setQuery(v);
    setRecent((prev) => [v, ...prev.filter((r) => r !== v)].slice(0, 6));
  };

  const products = query.trim() ? searchProducts(query) : [];

  const searching = query.trim().length > 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <SearchField
          value={query}
          onChangeText={setQuery}
          placeholder={t('search.placeholder')}
          onClear={() => setQuery('')}
          onSubmitEditing={() => commit(query)}
        />

        {!searching ? (
          <>
            {recent.length > 0 && (
              <View style={styles.block}>
                <View style={styles.blockHead}>
                  <Text style={styles.blockTitle}>{t('search.recent')}</Text>
                  <Pressable onPress={() => setRecent([])} hitSlop={6}>
                    <Text style={styles.clearText}>{t('search.clear')}</Text>
                  </Pressable>
                </View>
                <View style={styles.wrapRow}>
                  {recent.map((r) => (
                    <Pressable key={r} onPress={() => commit(r)} style={styles.recentChip}>
                      <Icon name="history" size={14} color={colors.faint} />
                      <Text style={styles.recentText}>{r}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            <View style={styles.block}>
              <Text style={styles.blockTitle}>{t('search.suggested')}</Text>
              <View style={styles.wrapRow}>
                {SUGGESTED_SEARCHES.map((s) => (
                  <Chip key={s.q} label={pick(s.label, lang)} onPress={() => commit(s.q)} />
                ))}
              </View>
            </View>

            <View style={styles.block}>
              <Text style={styles.blockTitle}>{t('search.popular')}</Text>
              {POPULAR_SEARCHES.map((s, i) => (
                <Pressable key={s.q} onPress={() => commit(s.q)} style={({ pressed }) => [styles.popRow, pressed && { opacity: 0.75 }]}>
                  <Text style={styles.popIndex}>{String(i + 1).padStart(2, '0')}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.popLabel}>{pick(s.label, lang)}</Text>
                  </View>
                  <Icon name="trending-up" size={17} color={colors.accent} />
                </Pressable>
              ))}
            </View>
          </>
        ) : (
          <>
            {products.length > 0 && (
              <View style={styles.block}>
                <Text style={styles.blockTitle}>{t('search.products')}</Text>
                <View style={styles.grid}>
                  {products.slice(0, 24).map((p) => (
                    <View key={p.id} style={styles.gridItem}>
                      <ProductCard product={p} onPress={() => nav.navigate('ProductDetails', { productId: p.id })} />
                    </View>
                  ))}
                </View>
              </View>
            )}

            {products.length === 0 && (
              <EmptyState
                icon="magnify-close"
                title={t('search.noResults')}
                message={t('search.noResultsSub')}
                actionLabel={t('search.startShopping')}
                onAction={() => { setQuery(''); nav.navigate('Tabs', { screen: 'Home' }); }}
              />
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 16, paddingBottom: 130, paddingTop: 10 },
  block: { marginTop: 24 },
  blockHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  blockTitle: { fontSize: fontSizes.lg, fontWeight: '900', color: colors.ink, letterSpacing: -0.3 },
  clearText: { fontSize: fontSizes.sm, color: colors.accent, fontWeight: '700' },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  recentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.chip,
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  recentText: { fontSize: fontSizes.sm, fontWeight: '600', color: colors.inkSoft },
  popRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.divider },
  popIndex: { fontSize: fontSizes.xs, color: colors.faint, fontWeight: '800', width: 26 },
  popLabel: { fontSize: fontSizes.md, fontWeight: '700', color: colors.ink },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 14 },
  gridItem: { width: '48.5%' },
});