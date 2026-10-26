import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import ProductCard from '../components/ProductCard';
import EmptyState from '../components/EmptyState';
import Icon from '../components/Icon';
import { useCatalog } from '../context/CatalogContext';
import { useFavorites } from '../context/FavoritesContext';
import { useResponsive } from '../hooks/useResponsive';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { colors, fontSizes, fonts, radii } from '../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function FavoritesScreen() {
  const { t } = useTranslation();
  const nav = useNavigation<Nav>();
  const { products } = useCatalog();
  const { ids } = useFavorites();
  const { itemWidth, gap } = useResponsive();
  const insets = useSafeAreaInsets();

  const items = products.filter((p) => ids.includes(p.id));

  return (
    <View style={styles.safe}>
      <View style={styles.topBar}>
        <SafeAreaView edges={['top']}>
          <View style={styles.topRow}>
            <Pressable onPress={() => nav.goBack()} hitSlop={8} style={styles.backBtn}>
              <Icon name="arrow-left" size={20} color={colors.ink} />
            </Pressable>
            <Text style={styles.title}>{t('profileMenu.favorites')}</Text>
            <View style={styles.backBtn} />
          </View>
        </SafeAreaView>
      </View>

      {items.length === 0 ? (
        <EmptyState
          icon="heart-outline"
          title={t('favorites.emptyTitle')}
          message={t('favorites.emptySub')}
          actionLabel={t('search.startShopping')}
          onAction={() => nav.navigate('Tabs', { screen: 'Home' })}
        />
      ) : (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 24 + insets.bottom }]} showsVerticalScrollIndicator={false}>
          <View style={[styles.grid, { columnGap: gap, rowGap: gap }]}>
            {items.map((p) => (
              <View key={p.id} style={[styles.gridItem, { width: itemWidth }]}>
                <ProductCard product={p} />
              </View>
            ))}
          </View>
          <View style={{ height: 24 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  topBar: { backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 8 },
  backBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  title: { flex: 1, textAlign: 'center', fontSize: fontSizes.lg, fontWeight: '800', color: colors.ink, fontFamily: fonts.bold },
  content: { paddingHorizontal: 16, paddingTop: 14, width: '100%', maxWidth: 1280, alignSelf: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start' },
  gridItem: { width: '48.5%' },
});