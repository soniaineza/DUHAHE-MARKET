import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Icon, { type IconName } from './Icon';
import { useCart } from '../context/CartContext';
import { FRAME_MAX_WIDTH } from '../hooks/useResponsive';
import { colors, fontSizes, fonts, radii } from '../theme';

type TabName = 'Home' | 'Categories' | 'Orders' | 'Cart' | 'Account';
type Overlay = 'Search' | 'About' | 'Notifications' | 'Addresses';

const ITEMS: { name: TabName; icon: IconName; key: string }[] = [
  { name: 'Home', icon: 'home-variant', key: 'tabs.home' },
  { name: 'Categories', icon: 'view-grid-outline', key: 'tabs.categories' },
  { name: 'Orders', icon: 'receipt-text-outline', key: 'tabs.orders' },
  { name: 'Cart', icon: 'cart-outline', key: 'tabs.cart' },
  { name: 'Account', icon: 'account-circle-outline', key: 'tabs.account' },
];

/** Full search field from here up; below it the search collapses to an icon so nothing is squeezed. */
const WIDE = 1100;

interface Props {
  /** The tab that is currently open (none for screens that are not a tab, e.g. a product page). */
  active?: TabName;
  go: (tab: TabName) => void;
  open: (screen: Overlay) => void;
}

/**
 * Desktop site header: brand, primary navigation, search and actions in one row, inside the same
 * centred container as the page content. Replaces the bottom tab bar from 900px up (the bottom bar
 * stays on phones and small tablets, where it belongs).
 */
export default function DesktopHeader({ active, go, open }: Props) {
  const { t } = useTranslation();
  const { count } = useCart();
  const { width } = useWindowDimensions();
  const wide = width >= WIDE;

  return (
    <View style={styles.bar}>
      <View style={styles.inner}>
        <Pressable onPress={() => go('Home')} style={styles.brand} accessibilityRole="link" accessibilityLabel={t('about.brand')}>
          <View style={styles.pin}>
            <Icon name="map-marker" size={18} color={colors.white} />
          </View>
          <View style={styles.brandText}>
            <Text style={styles.brandName} numberOfLines={1}>{wide ? t('about.brand') : 'Duhahe'}</Text>
            {wide ? (
              <Pressable onPress={() => open('Addresses')} hitSlop={6} style={styles.deliverRow}>
                <Text style={styles.deliverText}>{t('home.deliverTo')}</Text>
                <Icon name="chevron-down" size={12} color={colors.muted} />
              </Pressable>
            ) : null}
          </View>
        </Pressable>

        <View style={styles.nav} accessibilityRole="tablist">
          {ITEMS.map((item) => {
            const focused = active === item.name;
            return (
              <Pressable
                key={item.name}
                onPress={() => go(item.name)}
                accessibilityRole="tab"
                accessibilityState={{ selected: focused }}
                style={(state) => [
                  styles.link,
                  (state as { hovered?: boolean }).hovered && !focused && styles.linkHover,
                  focused && styles.linkActive,
                ]}
              >
                <View>
                  <Icon name={item.icon} size={20} color={focused ? colors.white : colors.inkSoft} />
                  {item.name === 'Cart' && count > 0 ? (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{count > 99 ? '99+' : count}</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={[styles.linkText, focused && styles.linkTextActive]} numberOfLines={1}>{t(item.key)}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.right}>
          {wide ? (
            <Pressable onPress={() => open('Search')} style={(s) => [styles.search, (s as { hovered?: boolean }).hovered && styles.searchHover]} accessibilityRole="search">
              <Icon name="magnify" size={20} color={colors.muted} />
              <Text style={styles.searchText} numberOfLines={1}>{t('common.search')}</Text>
            </Pressable>
          ) : (
            <Pressable onPress={() => open('Search')} style={styles.iconBtn} accessibilityLabel={t('common.search')}>
              <Icon name="magnify" size={20} color={colors.ink} />
            </Pressable>
          )}
          <Pressable onPress={() => open('About')} style={styles.iconBtn} accessibilityLabel="About">
            <Icon name="information-outline" size={20} color={colors.ink} />
          </Pressable>
          <Pressable onPress={() => open('Notifications')} style={styles.iconBtn} accessibilityLabel="Notifications">
            <Icon name="bell-outline" size={20} color={colors.ink} />
            <View style={styles.bellDot} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // The bar sits inside the centred page frame, but its white background must span the whole window.
  // The shadow spread paints the background edge to edge (it cannot cause scrolling) and clip-path trims
  // it vertically to the bar itself, so only the sides extend. Content stays in the centred container.
  bar: {
    backgroundColor: colors.surface,
    width: '100%',
    ...({
      boxShadow: `0 0 0 100vmax ${colors.surface}`,
      clipPath: 'inset(0 -100vmax)',
    } as object),
  },
  inner: {
    width: '100%',
    maxWidth: FRAME_MAX_WIDTH,
    alignSelf: 'center',
    paddingHorizontal: 16,
    height: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 0 },
  pin: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  brandText: { justifyContent: 'center' },
  brandName: { fontSize: fontSizes.md + 1, lineHeight: 20, fontWeight: '800', color: colors.ink, fontFamily: fonts.bold, letterSpacing: -0.3 },
  deliverRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 1 },
  deliverText: { fontSize: fontSizes.xs, color: colors.muted, fontWeight: '500' },
  nav: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 0 },
  link: { flexDirection: 'row', alignItems: 'center', gap: 7, height: 40, paddingHorizontal: 12, borderRadius: radii.pill },
  linkHover: { backgroundColor: colors.chip },
  linkActive: { backgroundColor: colors.ink },
  linkText: { fontSize: fontSizes.sm + 1, fontWeight: '700', color: colors.inkSoft },
  linkTextActive: { color: colors.white },
  badge: { position: 'absolute', top: -7, right: -9, minWidth: 17, height: 17, borderRadius: 9, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeText: { fontSize: 10, fontWeight: '900', color: colors.ink },
  right: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8, minWidth: 0 },
  search: {
    flex: 1,
    maxWidth: 320,
    height: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.bg,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    marginRight: 4,
  },
  searchHover: { borderColor: colors.primaryLine, backgroundColor: colors.surface },
  searchText: { flex: 1, fontSize: fontSizes.sm + 1, color: colors.muted, fontWeight: '500' },
  iconBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  bellDot: { position: 'absolute', top: 10, right: 11, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent, borderWidth: 1.5, borderColor: colors.surface },
});
