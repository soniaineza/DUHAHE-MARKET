import { useEffect, useRef, useState } from 'react';
import { Animated, Image, StyleSheet, View, type ImageStyle, type StyleProp, type ViewStyle } from 'react-native';
import type { Product } from '@duhahe/shared';
import { colors } from '../theme';
import { productPhotoUrl } from '../lib/productImage';

interface Props {
  product: Product;
  /** Outer container box (position + dimensions). */
  style?: StyleProp<ViewStyle>;
  /** Applied to the <Image> (e.g. borderRadius). */
  imageStyle?: StyleProp<ImageStyle>;
  resizeMode?: 'cover' | 'contain';
}

/**
 * Real product photography with a branded fallback while loading or offline.
 */
export default function ProductImage({ product, style, imageStyle, resizeMode = 'cover' }: Props) {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    setState('loading');
    opacity.setValue(0);
  }, [product.id, opacity]);

  const fadeIn = () => {
    setState('ready');
    Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }).start();
  };

  return (
    <View style={[styles.wrap, style]}>
      {state !== 'error' && (
        <Image
          source={{ uri: productPhotoUrl(product) }}
          style={[styles.image, imageStyle]}
          resizeMode={resizeMode}
          onLoad={fadeIn}
          onError={() => setState('error')}
        />
      )}
      {state === 'ready' && <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity }]} />}
      {state === 'loading' && (
        <View pointerEvents="none" style={styles.fallback} />
      )}
      {state === 'error' && (
        <View style={styles.fallback} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: colors.primarySoft, overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
  fallback: { ...StyleSheet.absoluteFill },
});