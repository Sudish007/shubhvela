// Root layout. A09 replaces this with fonts, theme (light first paint), safe-area and the
// four-tab navigator; A01 only needs a valid expo-router tree so prebuild and tests run.
import { Stack } from 'expo-router';

export default function RootLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
