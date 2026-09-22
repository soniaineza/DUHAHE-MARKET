import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { addressApi, type SavedAddress } from '../api';
import { useApp } from '../context/AppContext';
import EmptyState from '../components/EmptyState';
import Icon from '../components/Icon';
import { haptic, useToast } from '../components/Toast';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { colors, fontSizes, radii } from '../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const PROVINCES = {
  en: ['Kigali City', 'Northern', 'Southern', 'Eastern', 'Western'],
  kin: ['Umujyi wa Kigali', 'Amajyaruguru', 'Amajyepfo', 'Iburasirazuba', 'Uburengerazuba'],
  fr: ['Ville de Kigali', 'Nord', 'Sud', 'Est', 'Ouest'],
};
const DISTRICTS = ['Gasabo', 'Kicukiro', 'Nyarugenge', 'Musanze', 'Huye', 'Rubavu', 'Nyagatare', 'Bugesera', 'Kayonza', 'Rwamagana'];

export default function AddressesScreen() {
  const { t } = useTranslation();
  const { lang, user, profile } = useApp();
  const nav = useNavigation<Nav>();
  const { show } = useToast();

  const phone = user?.phone ?? profile?.phone ?? '';
  const [items, setItems] = useState<SavedAddress[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);

  const [label, setLabel] = useState('');
  const [name, setName] = useState(user?.name ?? profile?.name ?? '');
  const [province, setProvince] = useState('');
  const [district, setDistrict] = useState('');
  const [address, setAddress] = useState('');

  const load = useCallback(async () => {
    if (!phone) {
      setLoaded(true);
      setItems([]);
      return;
    }
    setLoading(true);
    try {
      setItems(await addressApi.list(phone));
      setLoaded(true);
    } catch {
      // keep previous list
    } finally {
      setLoading(false);
    }
  }, [phone]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    if (busy || !name.trim() || !province || !district) return;
    setBusy(true);
    try {
      const saved = await addressApi.save({
        phone,
        label: label.trim() || undefined,
        name: name.trim(),
        province,
        district,
        address: address.trim() || undefined,
      });
      setItems((prev) => [saved, ...prev.filter((a) => !a.isDefault || !saved.isDefault)]);
      haptic('success');
      show(t('common.save'), 'success');
      setAdding(false);
      setLabel('');
      setProvince('');
      setDistrict('');
      setAddress('');
      load();
    } catch (e) {
      show(e instanceof Error ? e.message : 'Failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  const setDefault = async (a: SavedAddress) => {
    try {
      await addressApi.setDefault(phone, a.id);
      setItems((prev) => prev.map((x) => ({ ...x, isDefault: x.id === a.id })));
      haptic('light');
    } catch {
      // ignore
    }
  };

  const remove = async (a: SavedAddress) => {
    try {
      await addressApi.remove(a.id);
      setItems((prev) => prev.filter((x) => x.id !== a.id));
      haptic('light');
    } catch {
      show(t('addresses.failedRemove'), 'error');
    }
  };

  const provinces = PROVINCES[lang as 'en' | 'kin' | 'fr'];

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.navRow}>
        <Pressable onPress={() => nav.goBack()} hitSlop={10} style={styles.backBtn}>
          <Icon name="arrow-left" size={20} color={colors.ink} />
        </Pressable>
        <Text style={styles.title}>{t('addresses.title')}</Text>
        <Pressable onPress={() => { setAdding((v) => !v); }} hitSlop={10} style={styles.addBtn}>
          <Icon name="plus" size={20} color={colors.accent} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {loading && items.length === 0 && <ActivityIndicator color={colors.accent} style={{ marginVertical: 24 }} />}

        {loaded && items.length === 0 && !adding && (
          <EmptyState icon="map-marker-plus-outline" title={t('addresses.empty')} message={t('addresses.emptySub')} actionLabel={t('addresses.addNew')} onAction={() => setAdding(true)} />
        )}

        {items.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>{t('addresses.savedAddresses')}</Text>
            {items.map((a) => (
              <View key={a.id} style={styles.card}>
                <View style={styles.cardHead}>
                  <View style={styles.labelWrap}>
                    <Icon name="map-marker-outline" size={14} color={colors.accentDeep} />
                    <Text style={styles.labelText}>{a.label}</Text>
                  </View>
                  {a.isDefault && (
                    <View style={styles.defaultBadge}>
                      <Text style={styles.defaultText}>{t('addresses.setAsDefault')}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.cardName}>{a.name} · {a.phone}</Text>
                <Text style={styles.cardAddr}>{a.address ? `${a.address}, ` : ''}{a.district}, {a.province}</Text>
                <View style={styles.cardActions}>
                  {!a.isDefault && (
                    <Pressable onPress={() => setDefault(a)} style={({ pressed }) => [styles.actionBtn, styles.defaultBtn, pressed && { opacity: 0.85 }]}>
                      <Text style={styles.defaultBtnText}>{t('addresses.setAsDefault')}</Text>
                    </Pressable>
                  )}
                  <Pressable onPress={() => remove(a)} style={({ pressed }) => [styles.actionBtn, styles.removeBtn, pressed && { opacity: 0.85 }]}>
                    <Icon name="trash-can-outline" size={15} color={colors.danger} />
                    <Text style={styles.removeText}>{t('addresses.remove')}</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </>
        )}

        {adding && (
          <View style={styles.form}>
            <Text style={styles.formTitle}>{t('addresses.addNew')}</Text>

            <Text style={styles.fieldLabel}>{t('addresses.label')}</Text>
            <TextInput value={label} onChangeText={setLabel} placeholder={t('addresses.labelPlaceholder')} placeholderTextColor={colors.faint} style={styles.input} />

            <Text style={styles.fieldLabel}>{t('checkout.fullName')}</Text>
            <TextInput value={name} onChangeText={setName} placeholder="Jean Bosco" placeholderTextColor={colors.faint} style={styles.input} />

            <Text style={styles.fieldLabel}>{t('checkout.province')}</Text>
            <View style={styles.chips}>
              {provinces.map((p) => (
                <Pressable key={p} onPress={() => setProvince(p)} style={({ pressed }) => [styles.chip, province === p && styles.chipActive, pressed && { opacity: 0.85 }]}>
                  <Text style={[styles.chipText, province === p && styles.chipTextActive]}>{p}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.fieldLabel}>{t('checkout.district')}</Text>
            <View style={styles.chips}>
              {DISTRICTS.map((d) => (
                <Pressable key={d} onPress={() => setDistrict(d)} style={({ pressed }) => [styles.chip, district === d && styles.chipActive, pressed && { opacity: 0.85 }]}>
                  <Text style={[styles.chipText, district === d && styles.chipTextActive]}>{d}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.fieldLabel}>{t('checkout.address')}</Text>
            <TextInput value={address} onChangeText={setAddress} placeholderTextColor={colors.faint} style={styles.input} />

            <Pressable onPress={save} disabled={busy || !name.trim() || !province || !district} style={({ pressed }) => [styles.saveBtn, (pressed || busy || !name.trim() || !province || !district) && { opacity: 0.55 }]}>
              {busy ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Icon name="content-save-outline" size={16} color={colors.white} />
                  <Text style={styles.saveText}>{t('addresses.saveAddress')}</Text>
                </>
              )}
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginTop: 8 },
  backBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: fontSizes.xl, fontWeight: '900', color: colors.ink },
  addBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, paddingBottom: 40, gap: 12 },
  sectionTitle: { fontSize: fontSizes.sm, fontWeight: '800', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2 },
  card: { backgroundColor: colors.card, borderRadius: radii.l, borderWidth: 1, borderColor: colors.border, padding: 14 },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  labelWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  labelText: { fontSize: fontSizes.md, fontWeight: '800', color: colors.ink },
  defaultBadge: { backgroundColor: colors.accentSoft, borderRadius: radii.pill, paddingHorizontal: 8, paddingVertical: 3 },
  defaultText: { fontSize: fontSizes.xs, color: colors.accentDeep, fontWeight: '800' },
  cardName: { fontSize: fontSizes.sm, color: colors.muted, fontWeight: '600', marginTop: 8 },
  cardAddr: { fontSize: fontSizes.sm, color: colors.inkSoft, marginTop: 2 },
  cardActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: radii.m, paddingVertical: 9, paddingHorizontal: 12 },
  defaultBtn: { backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.accentLine },
  defaultBtnText: { fontSize: fontSizes.xs, color: colors.accentDark, fontWeight: '800' },
  removeBtn: { alignSelf: 'flex-start' },
  removeText: { fontSize: fontSizes.xs, color: colors.danger, fontWeight: '800' },
  form: { backgroundColor: colors.card, borderRadius: radii.l, borderWidth: 1, borderColor: colors.border, padding: 16 },
  formTitle: { fontSize: fontSizes.md, fontWeight: '900', color: colors.ink, marginBottom: 12 },
  fieldLabel: { fontSize: fontSizes.xs, color: colors.faint, marginBottom: 6, fontWeight: '700', marginTop: 8 },
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
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.accent,
    borderRadius: radii.m,
    paddingVertical: 14,
    marginTop: 16,
  },
  saveText: { color: colors.white, fontWeight: '800', fontSize: fontSizes.md },
});