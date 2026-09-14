import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radii } from '../theme';

export function Skeleton({ width, height, style, radius = radii.s }: { width?: number | `${number}%`; height: number; style?: StyleProp<ViewStyle>; radius?: number }) {
  const pulse = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.35, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View style={[{ width: width ?? '100%', height, borderRadius: radius, backgroundColor: colors.subtle, opacity: pulse, overflow: 'hidden' }, style]}>
      <LinearGradient colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.6)', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
    </Animated.View>
  );
}

export function SkeletonCard() {
  return (
    <View style={[styles.card, shadowWrap]}>
      <Skeleton height={96} radius={radii.m} />
      <Skeleton height={14} width="80%" style={{ marginTop: 10 }} />
      <Skeleton height={12} width="50%" style={{ marginTop: 6 }} />
      <Skeleton height={18} width="60%" style={{ marginTop: 10 }} />
    </View>
  );
}

const shadowWrap = {
  shadowColor: '#17351f',
  shadowOpacity: 0.06,
  shadowRadius: 6,
  shadowOffset: { width: 0, height: 2 },
  elevation: 2,
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.l,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
});