import { Pressable, StyleSheet, Text, View } from 'react-native';
import Icon from './Icon';
import { colors, fontSizes, radii } from '../theme';

interface Props {
  title: string;
  sub?: string;
  actionLabel?: string;
  onAction?: () => void;
  pill?: boolean;
}

export default function SectionHeader({ title, sub, actionLabel, onAction, pill = true }: Props) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{title}</Text>
        {sub ? <Text style={styles.sub}>{sub}</Text> : null}
      </View>
      {actionLabel && onAction ? (
        pill ? (
          <Pressable onPress={onAction} style={({ pressed }) => [styles.pill, pressed && styles.pressed]}>
            <Text style={styles.pillText}>{actionLabel}</Text>
          </Pressable>
        ) : (
          <Pressable onPress={onAction} style={({ pressed }) => [styles.link, pressed && styles.pressed]}>
            <Text style={styles.linkText}>{actionLabel}</Text>
            <Icon name="chevron-right" size={15} color={colors.accent} />
          </Pressable>
        )
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 26, marginBottom: 14 },
  title: { fontSize: fontSizes.xl, fontWeight: '900', color: colors.ink, letterSpacing: -0.4 },
  sub: { fontSize: fontSizes.sm, color: colors.muted, marginTop: 2 },
  pill: { backgroundColor: colors.accentSoft, borderRadius: radii.pill, paddingHorizontal: 16, paddingVertical: 8 },
  pillText: { color: colors.accentDeep, fontWeight: '800', fontSize: fontSizes.sm },
  link: { flexDirection: 'row', alignItems: 'center' },
  linkText: { fontSize: fontSizes.sm, fontWeight: '700', color: colors.accent },
  pressed: { opacity: 0.75 },
});