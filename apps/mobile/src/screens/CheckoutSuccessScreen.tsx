import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useApp } from '../context/AppContext';
import { fmtRWF } from '../components/Money';
import Icon from '../components/Icon';
import { haptic } from '../components/Toast';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { colors, fontSizes, radii, gradientAccent } from '../theme';

interface Props {
  route: RouteProp<RootStackParamList, 'CheckoutSuccess'>;
}

export default function CheckoutSuccessScreen({ route }: Props) {
  const { t } = useTranslation();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { orderNumber, total } = route.params;
  const { profile } = useApp();
  const scale = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    haptic('success');
    Animated.spring(scale, { toValue: 1, friction: 4, useNativeDriver: true }).start();
    Animated.timing(fade, { toValue: 1, duration: 350, useNativeDriver: true }).start();
  }, [scale, fade]);

  return (
    <LinearGradient colors={['#f7f9fb', '#eaf4fd']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.safe}>
      <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1 }}>
        <View style={styles.wrap}>
          <Animated.View style={{ transform: [{ scale }] }}>
            <LinearGradient colors={gradientAccent} style={styles.checkCircle}>
              <Icon name="check-bold" size={40} color={colors.white} />
            </LinearGradient>
          </Animated.View>

          <Animated.View style={{ opacity: fade, alignSelf: 'stretch' }}>
            <Text style={styles.title}>{t('notifications.orderPlaced')}</Text>

            <View style={styles.card}>
              <Text style={styles.cardLabel}>{t('order.orderNumber', { number: orderNumber })}</Text>
              <Text style={styles.total}>{fmtRWF(total)}</Text>
              <View style={styles.cardRow}>
                <View style={styles.etaPill}>
                  <Icon name="motorbike" size={14} color={colors.accent} />
                  <Text style={styles.etaText}>{t('order.statusInTransit')}</Text>
                </View>
              </View>
            </View>

            <Pressable
              onPress={() => nav.navigate('Tracking', { orderNumber, phone: profile?.phone })}
              style={({ pressed }) => [styles.btn, pressed && { opacity: 0.9 }]}
            >
              <Text style={styles.btnText}>{t('success.track')}</Text>
              <Icon name="arrow-right" size={18} color={colors.white} />
            </Pressable>
            <Pressable onPress={() => nav.navigate('Tabs', { screen: 'Home' })} style={({ pressed }) => [styles.link, pressed && { opacity: 0.7 }]}>
              <Text style={styles.linkText}>{t('cart.continueShopping')} ›</Text>
            </Pressable>
          </Animated.View>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const shadow = {
  shadowColor: '#0d2414',
  shadowOpacity: 0.25,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 8 },
  elevation: 10,
};

const styles = StyleSheet.create({
  safe: { flex: 1 },
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  checkCircle: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', ...shadow, marginBottom: 24 },
  title: { fontSize: fontSizes.xl, fontWeight: '900', color: colors.ink, textAlign: 'center' },
  card: {
    marginTop: 24,
    backgroundColor: colors.card,
    borderRadius: radii.xl,
    padding: 22,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardLabel: { fontSize: fontSizes.sm, color: colors.faint, fontWeight: '700' },
  total: { fontSize: fontSizes.xxl, fontWeight: '900', color: colors.ink, marginTop: 4 },
  cardRow: { flexDirection: 'row', marginTop: 14 },
  etaPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.accentSoft, borderRadius: radii.pill, paddingHorizontal: 12, paddingVertical: 6 },
  etaText: { fontSize: fontSizes.xs, color: colors.accentDark, fontWeight: '800' },
  btn: {
    marginTop: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.accent,
    borderRadius: radii.m,
    paddingVertical: 15,
    paddingHorizontal: 28,
  },
  btnText: { color: colors.white, fontWeight: '800', fontSize: fontSizes.md },
  link: { marginTop: 16 },
  linkText: { color: colors.accent, fontWeight: '700', fontSize: fontSizes.sm },
});