// Root layout (plan.md A09): database + migrations BEFORE the first render (module scope, synchronous), bundled fonts,
// ThemeProvider (light first paint, persisted System/Light/Dark read synchronously), LangProvider, safe-area insets,
// then a plain stack: index (consent gate) -> onboarding/* or (tabs); settings/*, profile/[id] and dev/state are pushed.
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { initAppDb } from '../src/db/open';
import { LangProvider } from '../src/i18n';
import { ThemeProvider, useTokens } from '../src/theme/ThemeProvider';

initAppDb();

// Static TTFs (OFL) under app/assets/fonts; names match app/src/theme/typography.ts FONT_FILES.
const FONTS = {
  TiroDevanagariHindi: require('../assets/fonts/TiroDevanagariHindi-Regular.ttf'),
  NotoSans: require('../assets/fonts/NotoSans-Regular.ttf'),
  'NotoSans-SemiBold': require('../assets/fonts/NotoSans-SemiBold.ttf'),
  NotoSansDevanagari: require('../assets/fonts/NotoSansDevanagari-Regular.ttf'),
  'NotoSansDevanagari-SemiBold': require('../assets/fonts/NotoSansDevanagari-SemiBold.ttf'),
};

function Navigator({ fontsReady }: { fontsReady: boolean }) {
  const { colors, theme } = useTokens();
  if (!fontsReady) {
    // Paper-coloured frame in the resolved theme until the TTFs are registered (a few ms on device); never dark by default.
    return <View style={[styles.fill, { backgroundColor: colors.paper }]} />;
  }
  return (
    <>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.paper }, animation: 'none' }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding/consent" />
        <Stack.Screen name="onboarding/birth" />
        <Stack.Screen name="onboarding/intent" />
        <Stack.Screen name="settings/index" />
        <Stack.Screen name="profile/[id]" />
        <Stack.Screen name="charts/dasha-tree" />
        <Stack.Screen name="dev/state" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(FONTS);
  if (fontError && __DEV__) console.warn('font load failed', fontError);
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <LangProvider>
          <Navigator fontsReady={fontsLoaded || !!fontError} />
        </LangProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
