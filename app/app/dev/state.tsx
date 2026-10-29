// Screenshot-mode route (plan.md P12): shubhvela://dev/state?lang=<en|hi|bho>&theme=<light|dark|system>&screen=<route>&sample=1&font=<1.0|1.3>
// Active ONLY when the bundle was built with EXPO_PUBLIC_SCREENSHOT_MODE=1 (inlined by Expo); any other build renders
// nothing and goes home. `sample=1` seeds Priya / Amma / Dadaji (engine-computed on the screens) and consent_at=now;
// `font` is accepted for the shots manifest but the font scale itself is a device setting (adb settings put system
// font_scale), so it is only echoed in the dev log. `screen` is a route path (default /(tabs)/today). `pdf_dump=1` (B07)
// prints the three reports to the cache directory and logs their URIs for B08 to pull. B08 audit extras (all with
// sample=1): `pro=1` seeds an active Pro entitlement (absent = Free), `session=N` sets the session counter (4 = ads),
// `intent=` sets the self profile's intent (M4), `pdf_lang=` the profiles' PDF language. C01/C05: `widget_state=stale|exhausted`
// rewrites files/widget_state.json with a clock moved 40 h / 9 days back so the home-screen widgets show their footer state.
// C04/C05: `backup_roundtrip=1` runs the encrypted backup export -> import (Merge) through react-native-quick-crypto and logs it.
// c06 (DEV-1): `screen=/dev/insets` opens the safe-area readout (app/dev/insets.tsx); every screenshot build also logs
// `dev/insets {...}` (BottomInsetProvider) whenever the reported / probe / effective bottom inset changes.
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';
import { initAds, isAdsInitialized } from '../../src/ads/AdsRoot';
import { runBackupRoundtrip } from '../../src/dev/backupRoundtrip';
import { getSelfProfile, listProfiles } from '../../src/db/profiles';
import { setSetting } from '../../src/db/settings';
import { parseDevParams, withForwardedQuery } from '../../src/dev/params';
import { dumpReports } from '../../src/dev/pdfDump';
import { seedSampleState } from '../../src/dev/seed';
import { scheduleTestReminder } from '../../src/dev/testReminder';
import { writeDevWidgetState } from '../../src/dev/widgetState';
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
    if (p.sample) {
      seedSampleState({ lang: p.lang, theme: p.theme, intent: p.intent, pdfLang: p.pdfLang, pro: p.pro, sessions: p.session, history: p.history });
      // AdsRoot decided about the SDK at cold start, before this seed: a Free shot after a Pro run would otherwise show
      // no ads this session. Idempotent (initAds returns early when Pro or already initialised).
      if (!p.pro && !isAdsInitialized()) void initAds();
    }
    if (p.style) setSetting('chartStyle', p.style);
    // After the launch re-plan (app/_layout.tsx, 1.5 s after mount), which cancels every scheduled notification first.
    if (p.testReminder) setTimeout(() => void scheduleTestReminder(p.lang), 6000);
    if (p.pdfDump)
      setTimeout(() => {
        dumpReports(p.lang)
          .then((r) => console.log('dev/state pdf-dump', JSON.stringify(r)))
          .catch((e) => console.warn('dev/state pdf-dump failed', e));
      }, 2000);
    // C04: the encrypted backup round trip through the native crypto (C05 reads the line from logcat).
    if (p.backupRoundtrip)
      setTimeout(() => {
        runBackupRoundtrip()
          .then((r) => console.log('dev/state backup-roundtrip', JSON.stringify(r)))
          .catch((e) => console.warn('dev/state backup-roundtrip failed', e));
      }, 2500);
    // After the launch write (WidgetStateSync, 2.5 s) and Today's observer write, so the moved clock wins for 10 minutes.
    if (p.widgetState) {
      const mode = p.widgetState;
      setTimeout(() => {
        writeDevWidgetState(mode)
          .then((r) => console.log('dev/state widget-state', mode, JSON.stringify({ written: r.written, skipped: r.skipped, widgets: r.widgetsRefreshed, days: r.file?.days.length })))
          .catch((e) => console.warn('dev/state widget-state failed', e));
      }, 4000);
    }
    setLang(p.lang);
    setThemeSetting(p.theme);
    if (__DEV__) console.log('dev/state', p);
    // `{self}` = the self profile id, `{other}` = the first non-self profile (Amma) for matching / PDF routes (B08).
    const selfId = getSelfProfile()?.id;
    const otherId = listProfiles().find((x) => !x.isSelf)?.id;
    const ids = (s: string) => {
      let out = s;
      if (selfId !== undefined) out = out.replace('{self}', String(selfId));
      if (otherId !== undefined) out = out.replace('{other}', String(otherId));
      return out;
    };
    const forward = p.forward ? Object.fromEntries(Object.entries(p.forward).map(([k, v]) => [k, ids(v)])) : undefined;
    router.replace(withForwardedQuery(ids(p.screen), forward));
    // One run per deep link (the params object changes identity on every link; `key` captures its content).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, key]);

  if (!enabled) return <Redirect href="/" />;
  return <View />;
}
