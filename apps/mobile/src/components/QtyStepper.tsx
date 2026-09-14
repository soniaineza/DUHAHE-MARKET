import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '../theme';

interface Props {
  qty: number;
  step: number;
  min: number;
  max?: number;
  onChange: (qty: number) => void;
}

export default function QtyStepper({ qty, step, min, max, onChange }: Props) {
  const [draft, setDraft] = useState(String(qty));

  useEffect(() => setDraft(String(qty)), [qty]);

  const commit = (value: string) => {
    const parsed = Number(value.replace(',', '.'));
    if (!Number.isFinite(parsed)) {
      setDraft(String(qty));
      return;
    }
    const rounded = Math.round(parsed / step) * step;
    const bounded = Math.max(min, max == null ? rounded : Math.min(max, rounded));
    const next = Math.round(bounded * 100) / 100;
    setDraft(String(next));
    onChange(next);
  };
  const dec = () => commit(String(qty - step));
  const canDec = qty - step >= min - 0.0001;
  const inc = () => {
    const next = Math.round((qty + step) * 100) / 100;
    if (max != null && next > max) return;
    commit(String(next));
  };
  const canInc = max == null || Math.round((qty + step) * 100) / 100 <= max;

  return (
    <View style={styles.row}>
      <Pressable onPress={dec} disabled={!canDec} style={({ pressed }) => [styles.btn, !canDec && styles.disabled, pressed && styles.pressed]}>
        <Text style={styles.btnText}>−</Text>
      </Pressable>
      <TextInput
        value={draft}
        onChangeText={(value) => {
          if (/^\d*(?:[.,]\d*)?$/.test(value)) setDraft(value);
        }}
        onBlur={() => commit(draft)}
        keyboardType="decimal-pad"
        selectTextOnFocus
        style={styles.qty}
      />
      <Pressable onPress={inc} disabled={!canInc} style={({ pressed }) => [styles.btn, !canInc && styles.disabled, pressed && styles.pressed]}>
        <Text style={styles.btnText}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  btn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.35 },
  pressed: { opacity: 0.7 },
  btnText: { color: colors.accentDeep, fontSize: 18, fontWeight: '700' },
  qty: { minWidth: 34, textAlign: 'center', fontWeight: '700', color: colors.ink, fontSize: 15 },
});