import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import Icon, { type IconName } from '../components/Icon';
import { haptic } from '../components/Toast';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { colors, fontSizes, fonts, radii } from '../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function AboutScreen() {
  const { t } = useTranslation();
  const nav = useNavigation<Nav>();

  const facts: { icon: IconName; text: string }[] = [
    { icon: 'sprout-outline', text: t('about.farmers') },
    { icon: 'basket-outline', text: t('about.catalogLabel') },
    { icon: 'truck-fast-outline', text: t('about.deliveryLabel') },
    { icon: 'cellphone-check', text: t('about.paymentLabel') },
  ];

  const contacts: { icon: IconName; label: string; value: string }[] = [
    { icon: 'phone-outline', label: t('about.callUs'), value: '+250 799 654 373' },
    { icon: 'whatsapp', label: t('about.whatsappUs'), value: '+250 799 654 373' },
    { icon: 'email-outline', label: t('about.emailUs'), value: 'duhaherwanda@gmail.com' },
    { icon: 'map-marker-outline', label: t('about.address'), value: t('about.addressLine') },
    { icon: 'clock-outline', label: t('about.hours'), value: t('about.hoursValue') },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.navRow}>
        <Pressable onPress={() => nav.goBack()} hitSlop={10} style={styles.backBtn}>
          <Icon name="arrow-left" size={20} color={colors.ink} />
        </Pressable>
        <Text style={styles.title}>{t('about.title')}</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={['#111111', '#000000']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <View style={styles.logoWrap}>
            <Icon name="basket" size={30} color={colors.accent} />
          </View>
          <Text style={styles.brand}>{t('about.brand')}</Text>
          <Text style={styles.tagline}>{t('about.tagline')}</Text>
        </LinearGradient>

        <View style={styles.card}>
          <View style={styles.sectionHead}>
            <View style={styles.sectionIcon}>
              <Icon name="bullseye-arrow" size={16} color={colors.accent} />
            </View>
            <Text style={styles.sectionTitle}>{t('about.missionTitle')}</Text>
          </View>
          <Text style={styles.body}>{t('about.mission')}</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHead}>
            <View style={styles.sectionIcon}>
              <Icon name="check-decagram-outline" size={16} color={colors.accent} />
            </View>
            <Text style={styles.sectionTitle}>{t('about.factsTitle')}</Text>
          </View>
          <View style={styles.factList}>
            {facts.map((f) => (
              <View key={f.icon} style={styles.factRow}>
                <View style={styles.factIcon}>
                  <Icon name={f.icon} size={17} color={colors.primary} />
                </View>
                <Text style={styles.factText}>{f.text}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHead}>
            <View style={styles.sectionIcon}>
              <Icon name="account-group-outline" size={16} color={colors.accent} />
            </View>
            <Text style={styles.sectionTitle}>{t('about.contactTitle')}</Text>
          </View>
          <View style={styles.factList}>
            {contacts.map((c) => (
              <View key={c.icon} style={styles.factRow}>
                <View style={styles.factIcon}>
                  <Icon name={c.icon} size={17} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.contactLabel}>{c.label}</Text>
                  <Text style={styles.contactValue}>{c.value}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.demoNote}>
          <Icon name="information-outline" size={17} color={colors.accentDark} />
          <Text style={styles.demoNoteText}>{t('about.demoNote')}</Text>
        </View>

        <Pressable
          onPress={() => { haptic('light'); nav.goBack(); }}
          style={({ pressed }) => [styles.doneBtn, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.doneBtnText}>{t('about.back')}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginTop: 8 },
  backBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: fontSizes.xl, fontWeight: '900', color: colors.ink, fontFamily: fonts.bold },
  content: { padding: 16, paddingBottom: 40, gap: 14 },
  hero: {
    borderRadius: radii.l,
    padding: 24,
    alignItems: 'center',
  },
  logoWrap: { width: 58, height: 58, borderRadius: 29, backgroundColor: 'rgba(244,185,66,0.2)', alignItems: 'center', justifyContent: 'center' },
  brand: { fontSize: fontSizes.xl, fontWeight: '900', color: '#fff', fontFamily: fonts.black, marginTop: 12, textAlign: 'center' },
  tagline: { fontSize: fontSizes.sm, color: '#cfe9dd', marginTop: 6, textAlign: 'center', lineHeight: 19 },
  card: { backgroundColor: colors.card, borderRadius: radii.l, borderWidth: 1, borderColor: colors.border, padding: 16 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionIcon: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: fontSizes.md, fontWeight: '800', color: colors.ink },
  body: { fontSize: fontSizes.sm, color: colors.muted, lineHeight: 21 },
  factList: { gap: 12 },
  factRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  factIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  factText: { flex: 1, fontSize: fontSizes.sm, color: colors.inkSoft, fontWeight: '600', lineHeight: 19 },
  contactLabel: { fontSize: fontSizes.xs, color: colors.faint, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  contactValue: { fontSize: fontSizes.sm, color: colors.ink, fontWeight: '700', marginTop: 1 },
  demoNote: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.accentSoft, borderRadius: radii.s, padding: 12 },
  demoNoteText: { flex: 1, fontSize: fontSizes.xs, color: colors.accentDark, fontWeight: '700', lineHeight: 17 },
  doneBtn: { backgroundColor: colors.accent, borderRadius: radii.m, paddingVertical: 15, alignItems: 'center' },
  doneBtnText: { color: '#fff', fontWeight: '800', fontSize: fontSizes.md },
});