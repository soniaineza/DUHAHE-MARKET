import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radii, space } from '../theme';
import Icon, { type IconName } from './Icon';

interface Props {
  icon?: IconName;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function EmptyState({ icon = 'basket-outline', title, message, actionLabel, onAction }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.bubble}>
        <Icon name={icon} size={40} color={colors.accent} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {message && <Text style={styles.message}>{message}</Text>}
      {actionLabel && onAction && (
        <Pressable onPress={onAction} style={({ pressed }) => [styles.btn, pressed && styles.pressed]}>
          <Text style={styles.btnText}>{actionLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: space.xxxl, paddingHorizontal: space.xl },
  bubble: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.lg,
  },
  title: { fontSize: 17, fontWeight: '800', color: colors.ink, textAlign: 'center' },
  message: { fontSize: 13.5, color: colors.muted, marginTop: 6, textAlign: 'center', lineHeight: 20 },
  btn: {
    marginTop: space.lg,
    backgroundColor: colors.accent,
    borderRadius: radii.m,
    paddingHorizontal: space.xl,
    paddingVertical: 12,
  },
  pressed: { opacity: 0.85 },
  btnText: { color: colors.white, fontWeight: '800', fontSize: 14 },
});