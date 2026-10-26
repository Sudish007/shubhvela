// AdsRoot (design.md 5, plan B03): mounted once in the root layout. It counts sessions (cold start + foreground return
// after >= 30 min), then - ONLY when the user is not Pro - runs the UMP consent flow (gather, show the form when the
// region requires it: EEA/UK) and initialises the Google Mobile Ads SDK. For Pro users nothing beyond this module
// reference is touched: mobileAds().initialize() is never called (asserted by test/ads-root.test.ts), so the AppLovin
// adapter, which only initialises through the AdMob SDK, never starts either (M10).
// The Play entitlement is restored first so a Pro user whose cache is stale does not get the SDK started.
import { useEffect, useSyncExternalStore } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import mobileAds, { AdsConsent } from 'react-native-google-mobile-ads';
import { restoreOnLaunch } from '../billing/iap';
import { isPro } from '../entitlements';
import { beginSession, noteBackground, noteForeground } from './AdPolicy';

export interface AdsSdk {
  gatherConsent: () => Promise<{ canRequestAds: boolean }>;
  initialize: () => Promise<unknown>;
}

function liveSdk(): AdsSdk {
  return {
    gatherConsent: () => AdsConsent.gatherConsent(),
    initialize: () => mobileAds().initialize(),
  };
}

// --- "SDK ready" flag the ad components read before loading anything ---
let initialized = false;
const readyListeners = new Set<() => void>();

function setInitialized(v: boolean): void {
  initialized = v;
  readyListeners.forEach((l) => l());
}

export function isAdsInitialized(): boolean {
  return initialized;
}

export function useAdsInitialized(): boolean {
  return useSyncExternalStore(
    (l) => {
      readyListeners.add(l);
      return () => {
        readyListeners.delete(l);
      };
    },
    () => initialized,
    () => false,
  );
}

export function resetAdsRootForTests(): void {
  setInitialized(false);
}

/**
 * Consent, then initialise - never for Pro. Returns true when the SDK was initialised this call.
 * UMP failure (offline, SDK error) means no ads this session rather than ads without consent.
 */
export async function initAds(sdk: AdsSdk = liveSdk()): Promise<boolean> {
  if (isPro()) return false;
  let canRequestAds = false;
  try {
    canRequestAds = (await sdk.gatherConsent()).canRequestAds;
  } catch (e) {
    if (__DEV__) console.warn('UMP consent failed', e);
    return false;
  }
  if (!canRequestAds) return false;
  // Re-check: the consent form may have taken long enough for a restore to land.
  if (isPro()) return false;
  try {
    await sdk.initialize();
  } catch (e) {
    if (__DEV__) console.warn('ads init failed', e);
    return false;
  }
  setInitialized(true);
  return true;
}

export interface AdsRootProps {
  /** Injected for tests; production uses the real SDK and the Play restore. */
  sdk?: AdsSdk;
  restore?: () => Promise<unknown>;
}

export function AdsRoot({ sdk, restore = restoreOnLaunch }: AdsRootProps) {
  useEffect(() => {
    beginSession();
    const sub = AppState.addEventListener('change', (s: AppStateStatus) => {
      if (s === 'background' || s === 'inactive') noteBackground();
      else if (s === 'active') noteForeground();
    });
    let alive = true;
    void restore()
      .catch(() => undefined)
      .then(() => (alive ? initAds(sdk) : false))
      .catch(() => undefined);
    return () => {
      alive = false;
      sub.remove();
    };
  }, [sdk, restore]);
  return null;
}
