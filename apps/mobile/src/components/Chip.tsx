import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, radii } from '../theme';

interface Props {
  label: string;
  emoji?: string;
  active?: boolean;
  dot?: string;
  onPress?: () => void;
}

export default function Chip({ label, emoji, active, dot, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && styles.pressed]}
    >
      {emoji ? <Text style={styles.emoji}>{emoji}</Text> : null}
      {dot ? <Text style={styles.dot}>{dot}</Text> : null}
      <Text style={[styles.label, active && styles.labelActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  chipActive: { backgroundColor: colors.accentSoft, borderColor: colors.accentLine },
  emoji: { fontSize: 15 },
  dot: { color: colors.accent, fontSize: 18, lineHeight: 18 },
  label: { fontSize: 13, fontWeight: '700', color: colors.inkSoft },
  labelActive: { color: colors.accentDeep },
  pressed: { opacity: 0.75 },
});