import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { canonicalRwandaPhone, checkPassword, isStrongPassword, isValidEmail } from '@duhahe/shared';
import { authApi, type SignupStarted } from '../api';
import { useApp } from '../context/AppContext';
import Icon from '../components/Icon';
import { haptic, useToast } from '../components/Toast';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { colors, fontSizes, radii } from '../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const RESEND_SECONDS = 60;

export default function SignUpScreen() {
  const { t } = useTranslation();
  const { signIn } = useApp();
  const nav = useNavigation<Nav>();
  const { show } = useToast();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Step 2 (verification) state.
  const [started, setStarted] = useState<SignupStarted | null>(null);
  const [emailCode, setEmailCode] = useState('');
  const [phoneCode, setPhoneCode] = useState('');
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  const checks = checkPassword(password);
  const emailOk = isValidEmail(email);
  const canonicalPhone = canonicalRwandaPhone(phone);
  const canSubmit = name.trim().length >= 2 && emailOk && !!canonicalPhone && isStrongPassword(password) && password === confirm;

  const start = async () => {
    if (!canSubmit || busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await authApi.signup({ name: name.trim(), email: email.trim(), phone: phone.trim(), password, confirmPassword: confirm });
      setStarted(res);
      setCooldown(RESEND_SECONDS);
      haptic('success');
    } catch (e) {
      haptic('warning');
      setError(e instanceof Error ? e.message : t('auth.signUpFailed'));
    } finally {
      setBusy(false);
    }
  };

  const canVerify = emailCode.trim().length === 6 && (!started?.phoneVerificationRequired || phoneCode.trim().length === 6);

  const verify = async () => {
    if (!started || !canVerify || busy) return;
    setBusy(true);
    setError('');
    try {
      const session = await authApi.verifySignup(started.email, emailCode.trim(), started.phoneVerificationRequired ? phoneCode.trim() : undefined);
      signIn(session.token, session.user);
      haptic('success');
      show(t('auth.signedIn'), 'success');
      nav.goBack();
    } catch (e) {
      haptic('warning');
      setError(e instanceof Error ? e.message : t('auth.invalidCode'));
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    if (!started || cooldown > 0 || busy) return;
    setBusy(true);
    setError('');
    try {
      await authApi.resendCode(started.email);
      setCooldown(RESEND_SECONDS);
      show(t('auth.codeResent'), 'success');
    } catch (e) {
      setError(e instanceof Error ? e.message : t('auth.signUpFailed'));
    } finally {
      setBusy(false);
    }
  };

  const Rule = ({ ok, label }: { ok: boolean; label: string }) => (
    <View style={styles.ruleRow}>
      <Icon name={ok ? 'check-circle' : 'circle-outline'} size={14} color={ok ? colors.accent : colors.faint} />
      <Text style={[styles.rule, ok && styles.ruleOk]}>{label}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.navRow}>
        <Pressable onPress={() => (started ? (setStarted(null), setError('')) : nav.goBack())} hitSlop={10} style={styles.backBtn}>
          <Icon name="arrow-left" size={20} color={colors.ink} />
        </Pressable>
        <Text style={styles.title}>{started ? t('auth.verifyTitle') : t('auth.signUp')}</Text>
        <View style={{ width: 32 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }} keyboardVerticalOffset={8}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <View style={styles.heroIcon}>
              <Icon name={started ? 'email-check-outline' : 'account-plus-outline'} size={26} color={colors.white} />
            </View>
            <Text style={styles.heroTitle}>{started ? t('auth.verifyTitle') : t('auth.signUp')}</Text>
            <Text style={styles.heroSub}>
              {started ? t('auth.verifyEmailBody', { email: started.email }) : t('auth.subtitle')}
            </Text>
            {started?.phoneVerificationRequired ? <Text style={styles.heroSub}>{t('auth.verifyPhoneBody', { phone: canonicalPhone ?? phone })}</Text> : null}
          </View>

          {!started ? (
            <View style={styles.card}>
              <Text style={styles.fieldLabel}>{t('auth.name')}</Text>
              <View style={styles.inputWrap}>
                <Icon name="account-outline" size={18} color={colors.faint} />
                <TextInput value={name} onChangeText={setName} placeholder="Jean Bosco" placeholderTextColor={colors.faint} style={styles.input} />
              </View>

              <Text style={styles.fieldLabel}>{t('auth.email')}</Text>
              <View style={styles.inputWrap}>
                <Icon name="email-outline" size={18} color={colors.faint} />
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="name@email.com"
                  placeholderTextColor={colors.faint}
                  style={styles.input}
                />
              </View>
              {email.length > 0 && !emailOk ? <Text style={styles.hint}>{t('auth.emailInvalid')}</Text> : null}

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
              {phone.length > 0 && !canonicalPhone ? <Text style={styles.hint}>{t('auth.phoneInvalid')}</Text> : null}

              <Text style={styles.fieldLabel}>{t('auth.password')}</Text>
              <View style={styles.inputWrap}>
                <Icon name="lock-outline" size={18} color={colors.faint} />
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoCapitalize="none"
                  placeholder="••••••••"
                  placeholderTextColor={colors.faint}
                  style={styles.input}
                />
              </View>

              <Text style={styles.fieldLabel}>{t('auth.confirmPassword')}</Text>
              <View style={styles.inputWrap}>
                <Icon name="lock-check-outline" size={18} color={colors.faint} />
                <TextInput
                  value={confirm}
                  onChangeText={setConfirm}
                  secureTextEntry
                  autoCapitalize="none"
                  placeholder="••••••••"
                  placeholderTextColor={colors.faint}
                  style={styles.input}
                />
              </View>
              {confirm.length > 0 && password !== confirm ? <Text style={styles.hint}>{t('auth.passwordsDontMatch')}</Text> : null}

              <View style={styles.rules}>
                <Rule ok={checks.length} label={t('auth.pwRule8')} />
                <Rule ok={checks.upper} label={t('auth.pwRuleUpper')} />
                <Rule ok={checks.lower} label={t('auth.pwRuleLower')} />
                <Rule ok={checks.digit} label={t('auth.pwRuleDigit')} />
                <Rule ok={checks.symbol} label={t('auth.pwRuleSymbol')} />
              </View>

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <Pressable onPress={start} disabled={!canSubmit || busy} style={({ pressed }) => [styles.primaryBtn, (!canSubmit || pressed) && { opacity: 0.55 }]}>
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{t('auth.sendOtp')}</Text>}
              </Pressable>
            </View>
          ) : (
            <View style={styles.card}>
              <Text style={styles.fieldLabel}>{t('auth.emailCode')}</Text>
              <View style={styles.inputWrap}>
                <Icon name="email-outline" size={18} color={colors.faint} />
                <TextInput
                  value={emailCode}
                  onChangeText={(v) => setEmailCode(v.replace(/\D/g, '').slice(0, 6))}
                  keyboardType="number-pad"
                  maxLength={6}
                  placeholder="000000"
                  placeholderTextColor={colors.faint}
                  style={[styles.input, styles.codeInput]}
                />
              </View>

              {started.phoneVerificationRequired ? (
                <>
                  <Text style={styles.fieldLabel}>{t('auth.phoneCode')}</Text>
                  <View style={styles.inputWrap}>
                    <Icon name="message-text-outline" size={18} color={colors.faint} />
                    <TextInput
                      value={phoneCode}
                      onChangeText={(v) => setPhoneCode(v.replace(/\D/g, '').slice(0, 6))}
                      keyboardType="number-pad"
                      maxLength={6}
                      placeholder="000000"
                      placeholderTextColor={colors.faint}
                      style={[styles.input, styles.codeInput]}
                    />
                  </View>
                </>
              ) : null}

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <Pressable onPress={verify} disabled={!canVerify || busy} style={({ pressed }) => [styles.primaryBtn, (!canVerify || pressed) && { opacity: 0.55 }]}>
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{t('auth.verifyCreate')}</Text>}
              </Pressable>

              <Pressable onPress={resend} disabled={cooldown > 0 || busy} style={styles.linkBtn}>
                <Text style={[styles.createLink, cooldown > 0 && { opacity: 0.5 }]}>
                  {cooldown > 0 ? `${t('auth.resendCode')} (${cooldown}s)` : t('auth.resendCode')}
                </Text>
              </Pressable>
              <Pressable onPress={() => { setStarted(null); setError(''); }} style={styles.linkBtn}>
                <Text style={styles.createText}>{t('auth.changeDetails')}</Text>
              </Pressable>
            </View>
          )}

          {!started ? (
            <Pressable onPress={() => nav.navigate('SignIn')} style={({ pressed }) => [styles.createRow, pressed && { opacity: 0.8 }]}>
              <Text style={styles.createText}>{t('auth.haveAccount')}</Text>
              <Text style={styles.createLink}>{t('auth.signIn')}</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginTop: 8, width: '100%', maxWidth: 460, alignSelf: 'center' },
  backBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: fontSizes.xl, fontWeight: '900', color: colors.ink },
  content: { padding: 16, paddingBottom: 40, gap: 16, width: '100%', maxWidth: 460, alignSelf: 'center' },
  hero: { alignItems: 'center', marginTop: 10 },
  heroIcon: { width: 58, height: 58, borderRadius: 29, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  heroTitle: { fontSize: fontSizes.xl, fontWeight: '900', color: colors.ink, marginTop: 12, letterSpacing: -0.3 },
  heroSub: { fontSize: fontSizes.sm, color: colors.muted, textAlign: 'center', marginTop: 4, lineHeight: 19, maxWidth: 320 },
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
  codeInput: { letterSpacing: 6, fontWeight: '800' },
  hint: { fontSize: fontSizes.xs, color: colors.warn, fontWeight: '700' },
  rules: { gap: 4, marginTop: 2 },
  ruleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rule: { fontSize: fontSizes.xs, color: colors.faint },
  ruleOk: { color: colors.accent, fontWeight: '700' },
  error: { color: colors.danger, fontSize: fontSizes.sm, textAlign: 'center' },
  primaryBtn: { backgroundColor: colors.accent, borderRadius: radii.m, paddingVertical: 15, alignItems: 'center' },
  primaryText: { color: colors.white, fontWeight: '800', fontSize: fontSizes.md },
  linkBtn: { alignItems: 'center', paddingVertical: 6 },
  createRow: { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingVertical: 6 },
  createText: { color: colors.muted, fontSize: fontSizes.sm },
  createLink: { color: colors.accentDeep, fontSize: fontSizes.sm, fontWeight: '800' },
});
