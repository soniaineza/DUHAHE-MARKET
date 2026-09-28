import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useState } from 'react';
import { useFonts } from 'expo-font';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  Inter_900Black,
} from '@expo-google-fonts/inter';
import RootNavigator from './src/navigation/RootNavigator';
import { CartProvider } from './src/context/CartContext';
import { FavoritesProvider } from './src/context/FavoritesContext';
import { ToastProvider } from './src/components/Toast';
import { colors } from './src/theme';
import './src/i18n';

const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.primary,
    background: colors.bg,
    card: colors.surface,
    text: colors.ink,
    border: colors.border,
  },
};

const styles = StyleSheet.create({
  boot: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  bootErrorText: { color: colors.muted, marginTop: 14, fontSize: 14, textAlign: 'center', paddingHorizontal: 32 },
  retryBtn: { marginTop: 18, backgroundColor: colors.primary, borderRadius: 999, paddingHorizontal: 28, paddingVertical: 10 },
  retryBtnText: { color: colors.white, fontWeight: '800', fontSize: 14 },
});

export default function App() {
  // Remount AppInner to re-run useFonts when the user taps "Try again" —
  // a failed font load previously fell through and rendered blank icons.
  const [fontAttempt, setFontAttempt] = useState(0);
  return <AppInner key={fontAttempt} onRetryFonts={() => setFontAttempt((n) => n + 1)} />;
}

function AppInner({ onRetryFonts }: { onRetryFonts: () => void }) {
  const [fontsLoaded, fontError] = useFonts({
    ...MaterialCommunityIcons.font,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
    Inter_900Black,
  });

  if (fontError) {
    console.warn('[Duhahe] Font loading failed — icons will be blank until fonts load.', fontError);
    return (
      <View style={styles.boot}>
        <Pressable onPress={onRetryFonts} style={styles.retryBtn}>
          <Text style={styles.retryBtnText}>Try again</Text>
        </Pressable>
        <Text style={styles.bootErrorText}>Assets failed to load. Check your connection, then retry.</Text>
      </View>
    );
  }

  if (!fontsLoaded) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <ToastProvider>
        <CartProvider>
          <FavoritesProvider>
            <NavigationContainer theme={theme}>
              <StatusBar style="dark" />
              <RootNavigator />
            </NavigationContainer>
          </FavoritesProvider>
        </CartProvider>
      </ToastProvider>
    </SafeAreaProvider>
  );
}