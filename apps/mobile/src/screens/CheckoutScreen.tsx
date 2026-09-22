import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import type { PaymentMethod } from '@duhahe/shared';
import { addressApi, api, type SavedAddress } from '../api';
import { useApp } from '../context/AppContext';
import { useCart } from '../context/CartContext';
import { fmtRWF } from '../components/Money';
import Icon, { type IconName } from '../components/Icon';
import { haptic } from '../components/Toast';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { colors, fontSizes, radii } from '../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const PROVINCES = {
  en: ['Kigali City', 'Northern', 'Southern', 'Eastern', 'Western'],
  kin: ['Umujyi wa Kigali', 'Amajyaruguru', 'Amajyepfo', 'Iburasirazuba', 'Uburengerazuba'],
  fr: ['Ville de Kigali', 'Nord', 'Sud', 'Est', 'Ouest'],
};
const DISTRICTS = {
  en: ['Gasabo', 'Kicukiro', 'Nyarugenge', 'Musanze', 'Huye', 'Rubavu', 'Nyagatare', 'Bugesera', 'Kayonza', 'Rwamagana'],
  kin: ['Gasabo', 'Kicukiro', 'Nyarugenge', 'Musanze', 'Huye', 'Rubavu', 'Nyagatare', 'Bugesera', 'Kayonza', 'Rwamagana'],
  fr: ['Gasabo', 'Kicukiro', 'Nyarugenge', 'Musanze', 'Huye', 'Rubavu', 'Nyagatare', 'Bugesera', 'Kayonza', 'Rwamagana'],
};

const paymentMeta: Record<PaymentMethod, { icon: IconName; tile: readonly [string, string]; note: string }> = {
  mtn_momo: { icon: 'cellphone', tile: ['#ffcb05', '#f5b800'], note: 'MTN' },
  airtel_money: { icon: 'cellphone', tile: ['#f43f5e', '#e11d48'], note: 'Airtel' },
  cash_on_delivery: { icon: 'hand-coin', tile: ['#334155', '#475569'], note: 'Cash' },
};

export default function CheckoutScreen() {
  const { t } = useTranslation();
  const { lang, profile, user, setProfile } = useApp();
  const cart = useCart();
  const nav = useNavigation<Nav>();

  const [name, setName] = useState(user?.name ?? profile?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? profile?.phone ?? '');
  const [email, setEmail] = useState(profile?.email ?? '');
  const [province, setProvince] = useState(profile?.province ?? '');
  const [district, setDistrict] = useState(profile?.district ?? '');
  const [address, setAddress] = useState(profile?.address ?? '');
  const [note, setNote] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('mtn_momo');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState<SavedAddress[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const authPhone = user?.phone ?? profile?.phone ?? '';

  useEffect(() => {
    if (!authPhone) return;
    addressApi.list(authPhone).then(setSaved).catch(() => {});
  }, [authPhone]);

  const applyAddress = (a: SavedAddress) => {
    setName(a.name);
    setPhone(a.phone);
    setProvince(a.province);
    setDistrict(a.district);
    setAddress(a.address ?? '');
    setSelectedId(a.id);
    haptic('light');
  };

  const deliveryFee = useMemo(() => (district === 'Gasabo' || district === 'Kicukiro' || district === 'Nyarugenge' ? 1000 : 2500), [district]);
  const total = cart.subtotal + deliveryFee;

  const canSubmit = name.trim() && phone.trim().length >= 9 && district && cart.lines.length > 0;

  const placeOrder = async () => {
    if (!canSubmit || busy) return;
    if (!user) {
      nav.navigate('SignIn');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const order = await api.createOrder({
        items: cart.lines.map((l) => ({ productId: l.product.id, qty: l.qty })),
        customer: { name: name.trim(), phone: phone.trim(), email: email.trim() || undefined, province, district, address: address.trim() || undefined },
        paymentMethod: method,
        note: note || undefined,
      });
      setProfile({ name: name.trim(), phone: phone.trim(), email: email.trim() || undefined, province, district, address: address.trim() || undefined });
      cart.clear();
      haptic('success');
      if (method === 'cash_on_delivery') {
        nav.navigate('CheckoutSuccess', { orderNumber: order.orderNumber, total: order.total });
      } else {
        nav.navigate('DemoPayment', { order });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Order failed');
    } finally {
      setBusy(false);
    }
  };

  const provinces = PROVINCES[lang];
  const districts = DISTRICTS[lang];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.navRow}>
        <Pressable onPress={() => nav.goBack()} hitSlop={10} style={styles.backBtn}>
          <Icon name="arrow-left" size={20} color={colors.ink} />
        </Pressable>
        <Text style={styles.title}>{t('checkout.title')}</Text>
        <View style={{ width: 32 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }} keyboardVerticalOffset={8}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {saved.length > 0 && (
            <Section icon="map-marker-radius-outline" title={t('addresses.savedAddresses')}>
              {saved.map((a) => {
                const sel = selectedId === a.id;
                return (
                  <Pressable
                    key={a.id}
                    onPress={() => applyAddress(a)}
                    style={({ pressed }) => [styles.addrRow, sel && styles.addrRowActive, pressed && { opacity: 0.9 }]}
                  >
                    <View style={[styles.radio, sel && styles.radioActive]}>
                      {sel && <View style={styles.radioDot} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.addrLabel}>{a.label}</Text>
                      <Text style={styles.addrMeta}>{a.district}, {a.province}{a.address ? ` · ${a.address}` : ''}</Text>
                    </View>
                  </Pressable>
                );
              })}
              <Pressable onPress={() => nav.navigate('Addresses')} style={({ pressed }) => [styles.manageAddr, pressed && { opacity: 0.8 }]}>
                <Icon name="chevron-right" size={15} color={colors.accentDeep} />
                <Text style={styles.manageAddrText}>{t('addresses.addNew')}</Text>
              </Pressable>
            </Section>
          )}

          <Section icon="account-outline" title={t('checkout.contact')}>
            <Field label={t('checkout.fullName')}>
              <TextInput value={name} onChangeText={setName} placeholderTextColor={colors.faint} placeholder="Jean Bosco" style={styles.input} />
            </Field>
            <Field label={t('checkout.phone')}>
              <TextInput value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="0788123456" placeholderTextColor={colors.faint} style={styles.input} />
            </Field>
            <Field label={t('checkout.email')}>
              <TextInput value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholderTextColor={colors.faint} style={styles.input} />
            </Field>
          </Section>

          <Section icon="map-marker-radius-outline" title={t('checkout.delivery')}>
            <Field label={t('checkout.province')}>
              <View style={styles.chips}>
                {provinces.map((p) => (
                  <Pressable key={p} onPress={() => setProvince(p)} style={({ pressed }) => [styles.chip, province === p && styles.chipActive, pressed && { opacity: 0.85 }]}>
                    <Text style={[styles.chipText, province === p && styles.chipTextActive]}>{p}</Text>
                  </Pressable>
                ))}
              </View>
            </Field>

            <Field label={t('checkout.district')}>
              <View style={styles.chips}>
                {districts.map((d) => (
                  <Pressable key={d} onPress={() => setDistrict(d)} style={({ pressed }) => [styles.chip, district === d && styles.chipActive, pressed && { opacity: 0.85 }]}>
                    <Text style={[styles.chipText, district === d && styles.chipTextActive]}>{d}</Text>
                  </Pressable>
                ))}
              </View>
            </Field>

            <Field label={t('checkout.address')}>
              <TextInput value={address} onChangeText={setAddress} placeholderTextColor={colors.faint} style={styles.input} />
            </Field>
            <Field label={t('checkout.note')}>
              <TextInput value={note} onChangeText={setNote} placeholderTextColor={colors.faint} style={styles.input} />
            </Field>
          </Section>

          <Section icon="credit-card-outline" title={t('checkout.paymentMethod')}>
            <View style={styles.payList}>
              {(['mtn_momo', 'airtel_money', 'cash_on_delivery'] as PaymentMethod[]).map((m) => {
                const meta = paymentMeta[m];
                const active = method === m;
                return (
                  <Pressable
                    key={m}
                    onPress={() => { setMethod(m); haptic('light'); }}
                    style={({ pressed }) => [styles.payCard, active && styles.payCardActive, pressed && { opacity: 0.9 }]}
                  >
                    <View style={[styles.payTile, { backgroundColor: meta.tile[0] }]}>
                      <Icon name={meta.icon} size={20} color={colors.white} />
                    </View>
                    <Text style={styles.payLabel}>{t(`checkout.${m}`)}</Text>
                    <Text style={styles.payNote}>{meta.note}</Text>
                    <View style={[styles.radio, active && styles.radioActive]}>
                      {active && <View style={styles.radioDot} />}
                    </View>
                  </Pressable>
                );
              })}
            </View>
            {method !== 'cash_on_delivery' && (
              <View style={styles.demoNote}>
                <Icon name="information" size={15} color={colors.accentDeep} />
                <Text style={styles.demoNoteText}>{t('payment.thisIsDemo')}</Text>
              </View>
            )}
          </Section>

          <Section icon="receipt-text-outline" title={t('common.total')}>
            <View style={styles.summary}>
              <View style={styles.sumRow}><Text style={styles.sumLabel}>{t('common.subtotal')}</Text><Text style={styles.sumValue}>{fmtRWF(cart.subtotal)}</Text></View>
              <View style={styles.sumRow}><Text style={styles.sumLabel}>{t('common.deliveryFee')}</Text><Text style={styles.sumValue}>{fmtRWF(deliveryFee)}</Text></View>
              <View style={[styles.sumRow, styles.totalRow]}><Text style={styles.totalLabel}>{t('common.total')}</Text><Text style={styles.totalValue}>{fmtRWF(total)}</Text></View>
            </View>
          </Section>

          {error ? <Text style={styles.error}>{error}</Text> : null}
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={styles.footer}>
        <Pressable
          onPress={placeOrder}
          disabled={!canSubmit || busy}
          style={({ pressed }) => [styles.placeBtn, (pressed || !canSubmit) && styles.placeBtnDim]}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.placeBtnText}>{t('checkout.placeOrder')}</Text>
              <Text style={styles.placeBtnTotal}>{fmtRWF(total)}</Text>
            </>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function Section({ icon, title, children }: { icon: IconName; title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <View style={styles.sectionIcon}><Icon name={icon} size={15} color={colors.accent} /></View>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginTop: 8 },
  backBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: fontSizes.xl, fontWeight: '900', color: colors.ink },
  content: { padding: 16, paddingBottom: 40, gap: 14 },
  section: { backgroundColor: colors.card, borderRadius: radii.l, borderWidth: 1, borderColor: colors.border, padding: 14 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  sectionIcon: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: fontSizes.sm, fontWeight: '800', color: colors.ink },
  fieldLabel: { fontSize: fontSizes.xs, color: colors.faint, marginBottom: 6, fontWeight: '700' },
  input: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.m,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: fontSizes.md,
    color: colors.ink,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { fontSize: fontSizes.sm, color: colors.ink },
  chipTextActive: { color: colors.white, fontWeight: '700' },
  payList: { gap: 8 },
  addrRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.m,
    padding: 11,
    backgroundColor: colors.white,
    marginBottom: 8,
  },
  addrRowActive: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  addrLabel: { fontSize: fontSizes.md, fontWeight: '800', color: colors.ink },
  addrMeta: { fontSize: fontSizes.xs, color: colors.muted, marginTop: 2 },
  manageAddr: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 8 },
  manageAddrText: { fontSize: fontSizes.sm, color: colors.accentDeep, fontWeight: '800' },
  payCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radii.m,
    padding: 10,
    backgroundColor: colors.white,
  },
  payCardActive: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  payTile: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  payLabel: { flex: 1, fontSize: fontSizes.md, fontWeight: '700', color: colors.ink },
  payNote: { fontSize: fontSizes.xs, color: colors.faint, fontWeight: '700' },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.faint, alignItems: 'center', justifyContent: 'center' },
  radioActive: { borderColor: colors.accent },
  radioDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: colors.accent },
  demoNote: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, backgroundColor: colors.accentSoft, borderRadius: radii.s, padding: 10 },
  demoNoteText: { fontSize: fontSizes.xs, color: colors.accentDark, flex: 1 },
  summary: { gap: 8 },
  sumRow: { flexDirection: 'row', justifyContent: 'space-between' },
  sumLabel: { fontSize: fontSizes.sm, color: colors.faint },
  sumValue: { fontSize: fontSizes.sm, fontWeight: '700', color: colors.ink },
  totalRow: { borderTopWidth: 1, borderColor: colors.divider, paddingTop: 10, marginTop: 2 },
  totalLabel: { fontSize: fontSizes.md, fontWeight: '800', color: colors.ink },
  totalValue: { fontSize: fontSizes.lg, fontWeight: '900', color: colors.accent },
  error: { color: colors.danger, fontSize: fontSizes.sm, textAlign: 'center' },
  footer: { padding: 16, borderTopWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  placeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.accent,
    borderRadius: radii.m,
    paddingVertical: 16,
  },
  placeBtnDim: { opacity: 0.55 },
  placeBtnText: { color: colors.white, fontWeight: '800', fontSize: fontSizes.md },
  placeBtnTotal: { color: colors.accentSoft, fontWeight: '900', fontSize: fontSizes.md },
});