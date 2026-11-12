import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { checkPassword, isStrongPassword, isValidEmail } from '@duhahe/shared';
import { authApi } from '../api';
import { useApp } from '../context/AppContext';
import Icon from '../components/Icon';
import { haptic, useToast } from '../components/Toast';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { colors, fontSizes, radii } from '../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const RESEND_SECONDS = 60;

export default function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const { signIn } = useApp();
  const nav = useNavigation<Nav>();
  const { show } = useToast();

  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  const emailOk = isValidEmail(email);
  const checks = checkPassword(password);
  const canReset = code.trim().length === 6 && isStrongPassword(password) && password === confirm;

  const send = async () => {
    if (!emailOk || busy || (sent && cooldown > 0)) return;
    setBusy(true);
    setError('');
    try {
      await authApi.forgotPassword(email.trim());
      setSent(true);
      setCooldown(RESEND_SECONDS);
      haptic('success');
    } catch (e) {
      haptic('warning');
      setError(e instanceof Error ? e.message : t('auth.signUpFailed'));
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    if (!canReset || busy) return;
    setBusy(true);
    setError('');
    try {
      const session = await authApi.resetPassword({ email: email.trim(), code: code.trim(), password, confirmPassword: confirm });
      signIn(session.token, session.user);
      haptic('success');
      show(t('auth.passwordReset'), 'success');
      nav.goBack();
    } catch (e) {
      haptic('warning');
      setError(e instanceof Error ? e.message : t('auth.invalidCode'));
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
        <Pressable onPress={() => nav.goBack()} hitSlop={10} style={styles.backBtn}>
          <Icon name="arrow-left" size={20} color={colors.ink} />
        </Pressable>
        <Text style={styles.title}>{t('auth.forgotTitle')}</Text>
        <View style={{ width: 32 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }} keyboardVerticalOffset={8}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <View style={styles.heroIcon}>
              <Icon name="lock-reset" size={26} color={colors.white} />
            </View>
            <Text style={styles.heroTitle}>{t('auth.forgotTitle')}</Text>
            <Text style={styles.heroSub}>{sent ? t('auth.resetBody', { email: email.trim() }) : t('auth.forgotBody')}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.fieldLabel}>{t('auth.email')}</Text>
            <View style={styles.inputWrap}>
              <Icon name="email-outline" size={18} color={colors.faint} />
              <TextInput
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!busy && !sent}
                placeholder="name@email.com"
                placeholderTextColor={colors.faint}
                style={styles.input}
              />
            </View>
            {email.length > 0 && !emailOk ? <Text style={styles.hint}>{t('auth.emailInvalid')}</Text> : null}

            {!sent ? (
              <>
                {error ? <Text style={styles.error}>{error}</Text> : null}
                <Pressable onPress={send} disabled={!emailOk || busy} style={({ pressed }) => [styles.primaryBtn, (!emailOk || pressed) && { opacity: 0.55 }]}>
                  {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{t('auth.sendResetCode')}</Text>}
                </Pressable>
              </>
            ) : (
              <>
                <Text style={styles.fieldLabel}>{t('auth.resetCode')}</Text>
                <View style={styles.inputWrap}>
                  <Icon name="numeric" size={18} color={colors.faint} />
                  <TextInput
                    value={code}
                    onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
                    keyboardType="number-pad"
                    maxLength={6}
                    placeholder="000000"
                    placeholderTextColor={colors.faint}
                    style={[styles.input, styles.codeInput]}
                  />
                </View>

                <Text style={styles.fieldLabel}>{t('auth.newPassword')}</Text>
                <View style={styles.inputWrap}>
                  <Icon name="lock-outline" size={18} color={colors.faint} />
                  <TextInput value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" placeholder="••••••••" placeholderTextColor={colors.faint} style={styles.input} />
                </View>

                <Text style={styles.fieldLabel}>{t('auth.confirmPassword')}</Text>
                <View style={styles.inputWrap}>
                  <Icon name="lock-check-outline" size={18} color={colors.faint} />
                  <TextInput value={confirm} onChangeText={setConfirm} secureTextEntry autoCapitalize="none" placeholder="••••••••" placeholderTextColor={colors.faint} style={styles.input} />
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

                <Pressable onPress={reset} disabled={!canReset || busy} style={({ pressed }) => [styles.primaryBtn, (!canReset || pressed) && { opacity: 0.55 }]}>
                  {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{t('auth.resetPassword')}</Text>}
                </Pressable>

                <Pressable onPress={send} disabled={cooldown > 0 || busy} style={styles.linkBtn}>
                  <Text style={[styles.createLink, cooldown > 0 && { opacity: 0.5 }]}>
                    {cooldown > 0 ? `${t('auth.resendCode')} (${cooldown}s)` : t('auth.resendCode')}
                  </Text>
                </Pressable>
              </>
            )}
          </View>

          <Pressable onPress={() => nav.navigate('SignIn')} style={({ pressed }) => [styles.createRow, pressed && { opacity: 0.8 }]}>
            <Text style={styles.createLink}>{t('auth.backToSignIn')}</Text>
          </Pressable>
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
  inputWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: radii.m, paddingHorizontal: 12 },
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
  createLink: { color: colors.accentDeep, fontSize: fontSizes.sm, fontWeight: '800' },
});
