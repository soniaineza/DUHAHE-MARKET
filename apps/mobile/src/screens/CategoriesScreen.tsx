import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { CATEGORIES } from '@duhahe/shared';
import CategoryImage from '../components/CategoryImage';
import { useCatalog } from '../context/CatalogContext';
import { useResponsive } from '../hooks/useResponsive';
import Icon from '../components/Icon';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { colors, fontSizes, fonts, radii } from '../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function CategoriesScreen() {
  const { t } = useTranslation();
  const nav = useNavigation<Nav>();
  const { products } = useCatalog();
  const { itemWidth, gap, isDesktop } = useResponsive();

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    products.forEach((p) => m.set(p.category, (m.get(p.category) ?? 0) + 1));
    return m;
  }, [products]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('tabs.categories')}</Text>
          <Text style={styles.sub}>{t('home.categoriesTitle')}</Text>
        </View>
        <View style={[styles.grid, { columnGap: gap, rowGap: gap }]}>
          {CATEGORIES.map((id) => (
            <Pressable
              key={id}
              onPress={() => nav.navigate('Category', { category: id })}
              style={({ pressed }) => [
                styles.card,
                { width: itemWidth, height: isDesktop ? 190 : 150 },
                pressed && styles.pressed,
              ]}
            >
              <CategoryImage category={id} style={styles.img} />
              <View style={styles.overlay}>
                <Text style={styles.name} numberOfLines={1}>{t(`categories.${id}`)}</Text>
                <View style={styles.countRow}>
                  <Text style={styles.count}>{counts.get(id) ?? 0}</Text>
                  <Icon name="arrow-right" size={13} color={colors.white} />
                </View>
              </View>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 16, paddingBottom: 24, width: '100%', maxWidth: 1280, alignSelf: 'center' },
  header: { paddingTop: 6, paddingBottom: 4 },
  title: { fontSize: fontSizes.xxl, fontWeight: '900', color: colors.ink, fontFamily: fonts.black, letterSpacing: -0.5 },
  sub: { fontSize: fontSizes.sm, color: colors.muted, marginTop: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start', paddingTop: 14 },
  card: {
    width: '48.5%',
    height: 150,
    borderRadius: radii.l,
    overflow: 'hidden',
    backgroundColor: colors.primarySoft,
  },
  pressed: { opacity: 0.92, transform: [{ scale: 0.985 }] },
  img: { width: '100%', height: '100%' },
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(8,116,67,0.55)',
  },
  name: { flex: 1, fontSize: fontSizes.md, fontWeight: '800', color: colors.white, fontFamily: fonts.bold },
  countRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 8 },
  count: { fontSize: fontSizes.sm, color: colors.white, fontWeight: '700' },
});