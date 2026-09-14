import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, radii } from '../theme';

interface Props {
  size?: 'sm' | 'md' | 'lg';
  dark?: boolean;
  showWordmark?: boolean;
}

const sizes = { sm: 34, md: 44, lg: 56 };

export default function LogoMark({ size = 'md', dark = false, showWordmark = true }: Props) {
  const px = sizes[size];
  return (
    <View style={styles.row}>
      <LinearGradient
        colors={dark ? ['#23813f', '#144523'] : ['#2e9e4f', '#1d6a35']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.tile, { width: px, height: px, borderRadius: px * 0.28 }]}
      >
        <MaterialCommunityIcons name="basket-fill" size={px * 0.55} color="#ffffff" />
      </LinearGradient>
      {showWordmark && (
        <View style={styles.wordWrap}>
          <Text style={[styles.word, dark && styles.wordDark]}>Duhahe</Text>
          <Text style={[styles.sub, dark && styles.subDark]}>Rwanda Market</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tile: { alignItems: 'center', justifyContent: 'center', shadowColor: '#0d2414', shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 5 },
  wordWrap: {},
  word: { fontSize: 22, fontWeight: '900', letterSpacing: -0.5, color: colors.ink },
  wordDark: { color: colors.white },
  sub: { fontSize: 11, fontWeight: '600', color: colors.muted, letterSpacing: 0.4, marginTop: -2 },
  subDark: { color: colors.leaf200 },
});

export { radii as logoRadii };