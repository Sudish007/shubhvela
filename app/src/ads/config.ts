// Ad unit ids (spec F38, section 11; plan B03): Google's TEST units are the compile-time default. Real ids are read
// from app.json `extra.admob` ONLY when the owner has set `live: true` (docs/OWNER-TODO.md item 4). Nothing else in
// the app knows a unit id; the SDK components receive them from here through AdPolicy.
import Constants from 'expo-constants';

export interface AdUnitIds {
  banner: string;
  native: string;
  interstitial: string;
  rewarded: string;
}

/** Google's published test units (Android). */
export const TEST_UNIT_IDS: Readonly<AdUnitIds> = {
  banner: 'ca-app-pub-3940256099942544/6300978111',
  native: 'ca-app-pub-3940256099942544/2247696110',
  interstitial: 'ca-app-pub-3940256099942544/1033173712',
  rewarded: 'ca-app-pub-3940256099942544/5224354917',
};

interface AdmobExtra {
  appId?: string;
  units?: Partial<AdUnitIds>;
  live?: boolean;
}

function admobExtra(): AdmobExtra | undefined {
  return (Constants.expoConfig?.extra as { admob?: AdmobExtra } | undefined)?.admob;
}

/** Pure form for tests: live units only when `live` is true AND every unit is present; otherwise the test ids. */
export function resolveUnitIds(extra: AdmobExtra | undefined): AdUnitIds {
  const u = extra?.units;
  if (extra?.live === true && u && u.banner && u.native && u.interstitial && u.rewarded) {
    return { banner: u.banner, native: u.native, interstitial: u.interstitial, rewarded: u.rewarded };
  }
  return { ...TEST_UNIT_IDS };
}

export function adUnitIds(): AdUnitIds {
  return resolveUnitIds(admobExtra());
}

/** True when the build runs on Google's test units (shown nowhere; used by the verification notes and dev route). */
export function usingTestUnits(): boolean {
  return adUnitIds().banner === TEST_UNIT_IDS.banner;
}

/** AppLovin SDK key placeholder (M10): '' until the owner acts; the adapter never gets a mediation group in v1. */
export function applovinSdkKey(): string {
  return (Constants.expoConfig?.extra as { applovinSdkKey?: string } | undefined)?.applovinSdkKey ?? '';
}
