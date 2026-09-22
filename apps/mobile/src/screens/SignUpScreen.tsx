import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { authApi, demoSession } from '../api';
import { useApp } from '../context/AppContext';
import Icon from '../components/Icon';
import { haptic, useToast } from '../components/Toast';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { colors, fontSizes, radii } from '../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function SignUpScreen() {
  const { t } = useTranslation();
  const { signIn } = useApp();
  const nav = useNavigation<Nav>();
  const { show } = useToast();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const canSubmit = name.trim().length >= 2 && phone.trim().length >= 9;

  const submit = async () => {
    if (!canSubmit || busy) return;
    setBusy(true);
    setError('');
    try {
      const session = await authApi.signup(name.trim(), phone.trim());
      signIn(session.token, session.user);
      haptic('success');
      show(t('auth.signedIn'), 'success');
      nav.goBack();
    } catch (e) {
      const session = demoSession(name.trim(), phone.trim());
      signIn(session.token, session.user);
      haptic('warning');
      show(t('auth.demoOffline', 'Offline demo: signed in without a server account'), 'info');
      nav.goBack();
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.navRow}>
        <Pressable onPress={() => nav.goBack()} hitSlop={10} style={styles.backBtn}>
          <Icon name="arrow-left" size={20} color={colors.ink} />
        </Pressable>
        <Text style={styles.title}>{t('auth.signUp')}</Text>
        <View style={{ width: 32 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }} keyboardVerticalOffset={8}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <View style={styles.heroIcon}>
              <Icon name="account-plus-outline" size={26} color={colors.white} />
            </View>
            <Text style={styles.heroTitle}>{t('auth.signUp')}</Text>
            <Text style={styles.heroSub}>{t('auth.subtitle')}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.fieldLabel}>{t('auth.name')}</Text>
            <View style={styles.inputWrap}>
              <Icon name="account-outline" size={18} color={colors.faint} />
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Jean Bosco"
                placeholderTextColor={colors.faint}
                style={styles.input}
              />
            </View>

            <Text style={styles.fieldLabel}>{t('auth.phone')}</Text>
            <View style={styles.inputWrap}>
              <Icon name="phone-outline" size={18} color={colors.faint} />
              <TextInput
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                placeholder="0788123456"
                placeholderTextColor={colors.faint}
                style={styles.input}
              />
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable onPress={submit} disabled={!canSubmit || busy} style={({ pressed }) => [styles.primaryBtn, (!canSubmit || pressed) && { opacity: 0.55 }]}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{t('auth.signUp')}</Text>}
            </Pressable>
          </View>

          <Pressable onPress={() => nav.navigate('SignIn')} style={({ pressed }) => [styles.createRow, pressed && { opacity: 0.8 }]}>
            <Text style={styles.createText}>{t('auth.haveAccount')}</Text>
            <Text style={styles.createLink}>{t('auth.signIn')}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginTop: 8 },
  backBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: fontSizes.xl, fontWeight: '900', color: colors.ink },
  content: { padding: 16, paddingBottom: 40, gap: 16 },
  hero: { alignItems: 'center', marginTop: 10 },
  heroIcon: { width: 58, height: 58, borderRadius: 29, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  heroTitle: { fontSize: fontSizes.xl, fontWeight: '900', color: colors.ink, marginTop: 12, letterSpacing: -0.3 },
  heroSub: { fontSize: fontSizes.sm, color: colors.muted, textAlign: 'center', marginTop: 4, lineHeight: 19, maxWidth: 300 },
  card: { backgroundColor: colors.card, borderRadius: radii.l, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 10 },
  fieldLabel: { fontSize: fontSizes.xs, color: colors.faint, marginBottom: 2, fontWeight: '700' },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.m,
    paddingHorizontal: 12,
  },
  input: { flex: 1, paddingVertical: 13, fontSize: fontSizes.md, color: colors.ink },
  error: { color: colors.danger, fontSize: fontSizes.sm, textAlign: 'center' },
  primaryBtn: { backgroundColor: colors.accent, borderRadius: radii.m, paddingVertical: 15, alignItems: 'center' },
  primaryText: { color: colors.white, fontWeight: '800', fontSize: fontSizes.md },
  createRow: { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingVertical: 6 },
  createText: { color: colors.muted, fontSize: fontSizes.sm },
  createLink: { color: colors.accentDeep, fontSize: fontSizes.sm, fontWeight: '800' },
});