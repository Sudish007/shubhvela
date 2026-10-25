// Screenshot-mode route (plan.md P12): shubhvela://dev/state?lang=<en|hi|bho>&theme=<light|dark|system>&screen=<route>&sample=1&font=<1.0|1.3>
// Active ONLY when the bundle was built with EXPO_PUBLIC_SCREENSHOT_MODE=1 (inlined by Expo); any other build renders
// nothing and goes home. `sample=1` seeds Priya / Amma / Dadaji (engine-computed on the screens) and consent_at=now;
// `font` is accepted for the shots manifest but the font scale itself is a device setting (adb settings put system
// font_scale), so it is only echoed in the dev log. `screen` is a route path (default /(tabs)/today).
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';
import { parseDevParams } from '../../src/dev/params';
import { seedSampleState } from '../../src/dev/seed';
import { useLang } from '../../src/i18n';
import { isScreenshotBuild } from '../../src/legal';
import { useTokens } from '../../src/theme/ThemeProvider';

export default function DevState() {
  const params = useLocalSearchParams<Record<string, string>>();
  const router = useRouter();
  const { setLang } = useLang();
  const { setThemeSetting } = useTokens();
  const enabled = isScreenshotBuild();
  const key = JSON.stringify(params);

  useEffect(() => {
    if (!enabled) return;
    const p = parseDevParams(params);
    if (p.sample) seedSampleState({ lang: p.lang, theme: p.theme });
    setLang(p.lang);
    setThemeSetting(p.theme);
    if (__DEV__) console.log('dev/state', p);
    router.replace(p.screen);
    // One run per deep link (the params object changes identity on every link; `key` captures its content).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, key]);

  if (!enabled) return <Redirect href="/" />;
  return <View />;
}
