import { StyleSheet, Text, View, Image } from 'react-native';
import { colors, radii } from '../theme';

interface Props {
  size?: 'sm' | 'md' | 'lg';
  dark?: boolean;
  showWordmark?: boolean;
}

export default function LogoMark({ size = 'md', dark = false, showWordmark = true }: Props) {
  return (
    <View style={styles.container}>
      <Image
        source={require('../assets/logo.jpeg')}
        style={styles.logo}
        dark={dark}
      />
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
  container: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: { width: 58, height: 58, borderRadius: 29, resizeMode: 'cover' },
  wordWrap: {},
  word: { fontSize: 22, fontWeight: '900', letterSpacing: -0.5, color: colors.ink },
  wordDark: { color: colors.white },
  sub: { fontSize: 11, fontWeight: '600', color: colors.muted, letterSpacing: 0.4, marginTop: -2 },
  subDark: { color: colors.leaf200 },
});

export { radii as logoRadii };