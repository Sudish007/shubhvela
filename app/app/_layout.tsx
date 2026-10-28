// Root layout (plan.md A09): database + migrations BEFORE the first render (module scope, synchronous), bundled fonts,
// ThemeProvider (light first paint, persisted System/Light/Dark read synchronously), LangProvider, safe-area insets,
// then a plain stack: index (consent gate) -> onboarding/* or (tabs); settings/*, profile/[id], family/* and dev/state are
// pushed. On every launch the reminder planner re-plans the next 60 days (F25, N12) once the UI has painted; with no
// enabled series the plan is empty and nothing is scheduled (quiet by default). AdsRoot (B03) counts sessions, restores
// the Play entitlement and - only when not Pro - runs UMP consent and initialises the ads SDK. C01 (F9): the background
// task `extend-widget-state` is DEFINED here at module scope (expo-task-manager requirement) and WidgetStateSync writes
// files/widget_state.json after launch and on language change, registering the task once consent exists.
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AdsRoot } from '../src/ads/AdsRoot';
import { initAppDb } from '../src/db/open';
import { LangProvider } from '../src/i18n';
import { replanAll } from '../src/notifications/schedule';
import { ThemeProvider, useTokens } from '../src/theme/ThemeProvider';
import { defineExtendWidgetStateTask } from '../src/widgets/backgroundTask';
import { WidgetStateSync } from '../src/widgets/WidgetStateSync';

initAppDb();
defineExtendWidgetStateTask();
// Local notifications show while the app is in the foreground too (no sound beyond the channel default).
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

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
        <Stack.Screen name="settings/pro" />
        <Stack.Screen name="pro" />
        <Stack.Screen name="profile/[id]" />
        <Stack.Screen name="charts/dasha-tree" />
        <Stack.Screen name="charts/vargas" />
        <Stack.Screen name="charts/ashtakavarga" />
        <Stack.Screen name="charts/kp" />
        <Stack.Screen name="charts/varshaphal" />
        <Stack.Screen name="charts/muhurat/index" />
        <Stack.Screen name="charts/muhurat/saved" />
        <Stack.Screen name="charts/pdf/[kind]" />
        <Stack.Screen name="family/naamkaran" />
        <Stack.Screen name="family/match/index" />
        <Stack.Screen name="family/match/result" />
        <Stack.Screen name="family/share-code" />
        <Stack.Screen name="family/scan" />
        <Stack.Screen name="family/calendar" />
        <Stack.Screen name="family/festival/[slug]" />
        <Stack.Screen name="family/vrat/[id]" />
        <Stack.Screen name="family/ancestor/[id]" />
        <Stack.Screen name="learn/lesson/[id]" />
        <Stack.Screen name="learn/glossary/index" />
        <Stack.Screen name="learn/glossary/[term]" />
        <Stack.Screen name="learn/journal" />
        <Stack.Screen name="settings/vrats" />
        <Stack.Screen name="settings/notifications" />
        <Stack.Screen name="settings/backup" />
        <Stack.Screen name="charts/prashna/index" />
        <Stack.Screen name="charts/prashna/history" />
        <Stack.Screen name="charts/ask/gate" />
        <Stack.Screen name="charts/ask/consent" />
        <Stack.Screen name="charts/ask/download" />
        <Stack.Screen name="charts/ask/chat" />
        {/* F37 deep links (C04): shubhvela://kundli, shubhvela://m, shubhvela://festival/<slug>/<year>, shubhvela://panchang/<city>. */}
        <Stack.Screen name="kundli" />
        <Stack.Screen name="m" />
        <Stack.Screen name="festival/[slug]/[year]" />
        <Stack.Screen name="panchang/[city]" />
        <Stack.Screen name="dev/state" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(FONTS);
  if (fontError && __DEV__) console.warn('font load failed', fontError);
  // F25 / N12: re-plan the next 60 days of enabled series on every launch, after the first paint.
  useEffect(() => {
    const id = setTimeout(() => void replanAll(), 1500);
    return () => clearTimeout(id);
  }, []);
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <LangProvider>
          <AdsRoot />
          <WidgetStateSync />
          <Navigator fontsReady={fontsLoaded || !!fontError} />
        </LangProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
