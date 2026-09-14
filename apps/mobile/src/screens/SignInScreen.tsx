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

export default function SignInScreen() {
  const { t } = useTranslation();
  const { signIn } = useApp();
  const nav = useNavigation<Nav>();
  const { show } = useToast();

  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [demoCode, setDemoCode] = useState('');
  const [stage, setStage] = useState<'phone' | 'otp'>('phone');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const phoneValid = phone.trim().length >= 9;

  const sendCode = async () => {
    if (!phoneValid || busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await authApi.requestOtp(phone.trim());
      setDemoCode(res.demoCode);
      setStage('otp');
      setError('');
      haptic('success');
    } catch (e) {
      setDemoCode('123456');
      setStage('otp');
      setError('Demo mode: use code 123456');
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    if (code.trim().length < 4 || busy) return;
    setBusy(true);
    setError('');
    try {
      const session = await authApi.verifyOtp(phone.trim(), code.trim());
      signIn(session.token, session.user);
      haptic('success');
      show(t('auth.signedIn'), 'success');
      nav.goBack();
    } catch (e) {
      if (code.trim() === '123456') {
        signIn(demoSession('Duhahe Customer', phone.trim()).token, demoSession('Duhahe Customer', phone.trim()).user);
        haptic('success');
        show(t('auth.signedIn'), 'success');
        nav.goBack();
      } else {
        setError(e instanceof Error ? e.message : t('auth.invalidCode'));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.navRow}>
        <Pressable onPress={() => nav.goBack()} hitSlop={10} style={styles.backBtn}>
          <Icon name="arrow-left" size={20} color={colors.ink} />
        </Pressable>
        <Text style={styles.title}>{t('auth.signIn')}</Text>
        <View style={{ width: 32 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }} keyboardVerticalOffset={8}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <View style={styles.heroIcon}>
              <Icon name="account-lock-outline" size={26} color={colors.white} />
            </View>
            <Text style={styles.heroTitle}>{t('auth.signIn')}</Text>
            <Text style={styles.heroSub}>{t('auth.subtitle')}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.fieldLabel}>{t('auth.phone')}</Text>
            <View style={styles.inputWrap}>
              <Icon name="phone-outline" size={18} color={colors.faint} />
              <TextInput
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                editable={stage === 'phone'}
                placeholder="0788123456"
                placeholderTextColor={colors.faint}
                style={styles.input}
              />
            </View>

            {stage === 'otp' && (
              <>
                <Text style={styles.fieldLabel}>{t('auth.otp')}</Text>
                <View style={styles.inputWrap}>
                  <Icon name="shield-key-outline" size={18} color={colors.faint} />
                  <TextInput
                    value={code}
                    onChangeText={setCode}
                    keyboardType="number-pad"
                    maxLength={6}
                    placeholder="• • • • • •"
                    placeholderTextColor={colors.faint}
                    style={styles.input}
                  />
                </View>
                <View style={styles.demoNote}>
                  <Icon name="information" size={15} color={colors.accentDeep} />
                  <Text style={styles.demoNoteText}>{t('auth.demoCode', { code: demoCode })}</Text>
                </View>
              </>
            )}

            {error ? <Text style={styles.error}>{error}</Text> : null}

            {stage === 'phone' ? (
              <Pressable onPress={sendCode} disabled={!phoneValid || busy} style={({ pressed }) => [styles.primaryBtn, (!phoneValid || pressed) && { opacity: 0.55 }]}>
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{t('auth.sendOtp')}</Text>}
              </Pressable>
            ) : (
              <>
                <Pressable onPress={verify} disabled={busy} style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.85 }]}>
                  {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{t('auth.verify')}</Text>}
                </Pressable>
                <Pressable onPress={sendCode} disabled={busy} style={styles.resend}>
                  <Text style={styles.resendText}>{t('auth.sendOtp')}</Text>
                </Pressable>
              </>
            )}
          </View>

          <Pressable onPress={() => nav.navigate('SignUp')} style={({ pressed }) => [styles.createRow, pressed && { opacity: 0.8 }]}>
            <Text style={styles.createText}>{t('auth.createFirst')}</Text>
            <Text style={styles.createLink}>{t('auth.signUp')}</Text>
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
  demoNote: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.accentSoft, borderRadius: radii.s, padding: 10 },
  demoNoteText: { fontSize: fontSizes.xs, color: colors.accentDark, flex: 1, fontWeight: '700' },
  error: { color: colors.danger, fontSize: fontSizes.sm, textAlign: 'center' },
  primaryBtn: { backgroundColor: colors.accent, borderRadius: radii.m, paddingVertical: 15, alignItems: 'center' },
  primaryText: { color: colors.white, fontWeight: '800', fontSize: fontSizes.md },
  resend: { alignItems: 'center', paddingVertical: 6 },
  resendText: { color: colors.accentDeep, fontWeight: '700', fontSize: fontSizes.sm },
  createRow: { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingVertical: 6 },
  createText: { color: colors.muted, fontSize: fontSizes.sm },
  createLink: { color: colors.accentDeep, fontSize: fontSizes.sm, fontWeight: '800' },
});