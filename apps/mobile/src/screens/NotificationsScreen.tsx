import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { authApi, type AppNotification } from '../api';
import { useApp } from '../context/AppContext';
import EmptyState from '../components/EmptyState';
import Icon from '../components/Icon';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { colors, fontSizes, radii } from '../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function NotificationsScreen() {
  const { t } = useTranslation();
  const { lang, user, profile } = useApp();
  const nav = useNavigation<Nav>();

  const phone = (user?.phone ?? profile?.phone ?? '').replace(/\D/g, '');
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(
    async (silent = false) => {
      if (!phone) {
        setLoaded(true);
        setItems([]);
        return;
      }
      if (!silent) setLoading(true);
      try {
        setItems(await authApi.notifications(phone));
        setLoaded(true);
      } catch {
        // keep previous list
      } finally {
        setLoading(false);
      }
    },
    [phone]
  );

  useEffect(() => {
    load();
  }, [load]);

  const markRead = async (n: AppNotification) => {
    if (n.read) return;
    setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    try {
      await authApi.markNotificationRead(n.id);
    } catch {
      // revert silently
    }
  };

  const date = (iso: string) =>
    new Date(iso).toLocaleDateString(lang === 'en' ? 'en-GB' : lang === 'fr' ? 'fr-FR' : 'rw-RW', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.navRow}>
        <Pressable onPress={() => nav.goBack()} hitSlop={10} style={styles.backBtn}>
          <Icon name="arrow-left" size={20} color={colors.ink} />
        </Pressable>
        <Text style={styles.title}>{t('notifications.title')}</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={() => load(true)} tintColor={colors.accent} colors={[colors.accent]} />
        }
      >
        {loading && items.length === 0 && <ActivityIndicator color={colors.accent} style={{ marginVertical: 24 }} />}

        {loaded && items.length === 0 && (
          <EmptyState icon="bell-outline" title={t('notifications.empty')} message={t('notifications.emptySub')} />
        )}

        {items.map((n) => (
          <Pressable key={n.id} onPress={() => markRead(n)} style={({ pressed }) => [styles.card, n.read && styles.cardRead, pressed && { opacity: 0.9 }]}>
            <View style={[styles.iconWrap, n.read && styles.iconWrapRead]}>
              <Icon name={n.kind === 'order' ? 'package-variant-closed' : 'bell-outline'} size={19} color={n.read ? colors.faint : colors.accentDeep} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.cardHead}>
                <Text style={[styles.cardTitle, n.read && styles.cardTitleRead]}>{n.title}</Text>
                {!n.read && <View style={styles.unreadDot} />}
              </View>
              <Text style={[styles.cardBody, n.read && styles.cardBodyRead]}>{n.body}</Text>
              <Text style={styles.cardDate}>{date(n.createdAt)}</Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginTop: 8 },
  backBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: fontSizes.xl, fontWeight: '900', color: colors.ink },
  content: { padding: 16, gap: 10, paddingBottom: 40 },
  card: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: radii.l,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  cardRead: { backgroundColor: colors.chip, borderColor: colors.divider },
  iconWrap: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  iconWrapRead: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.divider },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { fontSize: fontSizes.md, fontWeight: '800', color: colors.ink },
  cardTitleRead: { color: colors.muted },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
  cardBody: { fontSize: fontSizes.sm, color: colors.inkSoft, marginTop: 3, lineHeight: 18 },
  cardBodyRead: { color: colors.faint },
  cardDate: { fontSize: fontSizes.xs, color: colors.faint, marginTop: 7, fontWeight: '600' },
});