// useInterstitial (design.md 5, M12): the only way a screen shows an interstitial. The screen calls `show(trigger)`
// on one of the three forward actions; the hook asks AdPolicy.maybeShowInterstitial (sessions >= 4, one per session,
// >= 45 s since any ad, Pro = never) and shows the pre-loaded ad only when the policy says yes AND the ad is loaded.
// Callers must not call it on back navigation or while a sheet is open (the policy cannot see navigation).
import { useCallback, useEffect } from 'react';
import { useInterstitialAd } from 'react-native-google-mobile-ads';
import { adsEnabled, maybeShowInterstitial, unitIds, type InterstitialTrigger } from './AdPolicy';
import { useAdsInitialized } from './AdsRoot';

export interface InterstitialApi {
  /** True when an ad is loaded and could be shown if the policy allows. */
  ready: boolean;
  /** Returns true when an interstitial was shown for this trigger. */
  show: (trigger: InterstitialTrigger) => boolean;
}

export function useInterstitial(): InterstitialApi {
  const initialized = useAdsInitialized();
  const enabled = initialized && adsEnabled();
  const ad = useInterstitialAd({ adUnitId: enabled ? unitIds().interstitial : null, autoLoad: enabled });

  // After a shown ad closes, warm the next one so the next session's single slot is ready.
  useEffect(() => {
    if (ad.status === 'closed') ad.load();
  }, [ad.status, ad.load, ad]);

  const show = useCallback(
    (trigger: InterstitialTrigger) => {
      if (!enabled || ad.status !== 'loaded') return false;
      if (!maybeShowInterstitial(trigger)) return false;
      ad.show();
      return true;
    },
    [enabled, ad],
  );

  return { ready: enabled && ad.status === 'loaded', show };
}
