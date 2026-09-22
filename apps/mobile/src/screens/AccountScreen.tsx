import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import type { Language } from '@duhahe/shared';
import { useApp } from '../context/AppContext';
import Icon, { type IconName } from '../components/Icon';
import { haptic, useToast } from '../components/Toast';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { colors, fontSizes, fonts, radii } from '../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const LANGS: Language[] = ['en', 'kin', 'fr'];
const LANG_LABEL: Record<Language, string> = { en: 'English', kin: 'Kinyarwanda', fr: 'Français' };

export default function AccountScreen() {
  const { t } = useTranslation();
  const { lang, setLang, profile, user, signOut } = useApp();
  const nav = useNavigation<Nav>();
  const { show } = useToast();

  const [langOpen, setLangOpen] = useState(false);

  const signedIn = !!user && !!profile;

  const notifySoon = (label: string) => {
    haptic('light');
    show(label, 'info');
  };

  const displayName = user?.name ?? profile?.name ?? '';
  const initial = (displayName.trim()[0] ?? 'D').toUpperCase();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.greetingRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.greetingSmall}>{t('profileMenu.greeting')}</Text>
            <Text style={styles.greeting}>{displayName || 'Duhahe customer'}</Text>
            {user && <Text style={styles.greetingPhone}>{user.phone}</Text>}
          </View>
        </View>

        {!signedIn ? (
          <View style={styles.authCard}>
            <Text style={styles.authTitle}>{t('auth.signIn')}</Text>
            <Text style={styles.authSub}>{t('auth.subtitle')}</Text>
            <View style={styles.authActions}>
              <Pressable onPress={() => { haptic('light'); nav.navigate('SignIn'); }} style={({ pressed }) => [styles.authBtn, styles.authBtnPrimary, pressed && { opacity: 0.85 }]}>
                <Icon name="login" size={16} color={colors.white} />
                <Text style={styles.authBtnPrimaryText}>{t('auth.signIn')}</Text>
              </Pressable>
              <Pressable onPress={() => { haptic('light'); nav.navigate('SignUp'); }} style={({ pressed }) => [styles.authBtn, pressed && { opacity: 0.85 }]}>
                <Text style={styles.authBtnGhostText}>{t('auth.signUp')}</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        <View style={styles.menu}>
          <MenuItem icon="receipt-text-outline" label={t('profileMenu.orders')} onPress={() => nav.navigate('Tabs', { screen: 'Orders' })} />
          <MenuItem icon="map-marker-outline" label={t('profileMenu.addresses')} onPress={() => nav.navigate('Addresses')} />
          <MenuItem icon="heart-outline" label={t('profileMenu.favorites')} onPress={() => nav.navigate('Favorites')} />
          <MenuItem icon="credit-card-outline" label={t('profileMenu.payments')} onPress={() => notifySoon(t('payment.thisIsDemo'))} />
          <MenuItem icon="translate" label={t('profileMenu.language')} onPress={() => setLangOpen((v) => !v)} open={langOpen} />
          <MenuItem icon="information-outline" label={t('profileMenu.about')} onPress={() => { haptic('light'); nav.navigate('About'); }} />
          {signedIn && (
            <View style={styles.logoutRow}>
              <Icon name="logout" size={19} color={colors.danger} />
              <Pressable onPress={() => { signOut(); haptic('medium'); show(t('auth.signOut'), 'info'); }}>
                <Text style={styles.logoutText}>{t('profileMenu.logout')}</Text>
              </Pressable>
            </View>
          )}
        </View>

        {langOpen && (
          <View style={styles.card}>
            <View style={styles.langRow}>
              {LANGS.map((l) => (
                <Pressable
                  key={l}
                  onPress={() => { setLang(l); haptic('light'); }}
                  style={({ pressed }) => [styles.langChip, lang === l && styles.langChipActive, pressed && { opacity: 0.85 }]}
                >
                  <Text style={[styles.langChipText, lang === l && styles.langChipTextActive]}>{LANG_LABEL[l]}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function MenuItem({ icon, label, onPress, open }: { icon: IconName; label: string; onPress: () => void; open?: boolean }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.menuRow, pressed && { opacity: 0.8 }]}>
      <View style={styles.menuIcon}>
        <Icon name={icon} size={18} color={colors.primary} />
      </View>
      <Text style={styles.menuLabel}>{label}</Text>
      <Icon name={open ? 'chevron-up' : 'chevron-right'} size={20} color={colors.faint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 40 },
  greetingRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 8 },
  avatar: { width: 58, height: 58, borderRadius: 29, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: fontSizes.xl, fontWeight: '900', color: colors.white, fontFamily: fonts.black },
  greetingSmall: { fontSize: fontSizes.sm, color: colors.muted, fontWeight: '600' },
  greeting: { fontSize: fontSizes.xxl, fontWeight: '900', color: colors.ink, fontFamily: fonts.black, letterSpacing: -0.5, marginTop: 1 },
  greetingPhone: { fontSize: fontSizes.sm, color: colors.faint, fontWeight: '600', marginTop: 2 },
  authCard: { marginTop: 18, backgroundColor: colors.surface, borderRadius: radii.l, borderWidth: 1, borderColor: colors.border, padding: 16 },
  authTitle: { fontSize: fontSizes.md, fontWeight: '900', color: colors.ink },
  authSub: { fontSize: fontSizes.sm, color: colors.muted, marginTop: 4, lineHeight: 18 },
  authActions: { flexDirection: 'row', gap: 8, marginTop: 14 },
  authBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: radii.m, paddingVertical: 12 },
  authBtnPrimary: { backgroundColor: colors.primary },
  authBtnPrimaryText: { color: colors.white, fontWeight: '800', fontSize: fontSizes.sm },
  authBtnGhostText: { color: colors.primary, fontWeight: '800', fontSize: fontSizes.sm },
  menu: { marginTop: 22, backgroundColor: colors.surface, borderRadius: radii.l, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: colors.divider },
  menuIcon: { width: 34, height: 34, borderRadius: 12, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  menuLabel: { flex: 1, fontSize: fontSizes.md, fontWeight: '700', color: colors.ink },
  logoutRow: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 16, paddingVertical: 15 },
  logoutText: { fontSize: fontSizes.md, fontWeight: '700', color: colors.danger },
  card: { marginTop: 14, backgroundColor: colors.surface, borderRadius: radii.l, borderWidth: 1, borderColor: colors.border, padding: 16 },
  langRow: { flexDirection: 'row', gap: 8 },
  langChip: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.m,
    paddingVertical: 10,
  },
  langChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  langChipText: { fontSize: fontSizes.sm, color: colors.ink },
  langChipTextActive: { color: colors.white, fontWeight: '800' },
});