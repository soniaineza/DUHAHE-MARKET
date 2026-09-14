import { useState } from 'react';
import { Image, StyleSheet, View, type ImageStyle, type StyleProp } from 'react-native';
import type { CategoryId } from '@duhahe/shared';
import { colors } from '../theme';
import { categoryPhotoUrl } from '../lib/productImage';

export default function CategoryImage({ category, style }: { category: CategoryId; style?: StyleProp<ImageStyle> }) {
  const [failed, setFailed] = useState(false);

  return (
    <View style={styles.wrap}>
      {!failed && <Image source={{ uri: categoryPhotoUrl(category) }} style={[styles.image, style]} resizeMode="cover" onError={() => setFailed(true)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft },
  image: { ...StyleSheet.absoluteFill },
});
