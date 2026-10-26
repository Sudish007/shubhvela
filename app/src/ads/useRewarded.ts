// useRewarded (design.md 5, M14): one rewarded ad unlocks exactly one feature key for 24 h, only from an explicit tap
// on a locked row/chip ("Unlock <key> · watch an ad · 24 h"). `start()` shows the pre-loaded ad; EARNED_REWARD ->
// AdPolicy.unlock(key) -> onUnlocked(expiresAt). Closed early -> onFailed('closedEarly') and nothing is unlocked.
// Not loaded (no fill / offline) -> onFailed('unavailable') and the UI prints "Ad not available right now, try again".
import { useCallback, useEffect, useRef } from 'react';
import { useRewardedAd } from 'react-native-google-mobile-ads';
import { adsEnabled, unitIds, unlock, type RewardedKey } from './AdPolicy';
import { useAdsInitialized } from './AdsRoot';

export type RewardedFailure = 'unavailable' | 'closedEarly';

export interface RewardedCallbacks {
  onUnlocked: (key: RewardedKey, expiresAt: Date) => void;
  onFailed: (key: RewardedKey, reason: RewardedFailure) => void;
}

export interface RewardedApi {
  /** True when the ad is loaded and can be shown on the next tap. */
  ready: boolean;
  /** Shows the ad; reports 'unavailable' immediately when nothing is loaded. */
  start: () => void;
}

export function useRewarded(key: RewardedKey, callbacks: RewardedCallbacks): RewardedApi {
  const initialized = useAdsInitialized();
  const enabled = initialized && adsEnabled();
  const ad = useRewardedAd({ adUnitId: enabled ? unitIds().rewarded : null, autoLoad: enabled });
  const cb = useRef(callbacks);
  useEffect(() => {
    cb.current = callbacks;
  }, [callbacks]);
  const shownRef = useRef(false);
  const settledRef = useRef(false);

  // The reward is applied the moment it is earned (before close), closing without it unlocks nothing.
  useEffect(() => {
    if (!shownRef.current || settledRef.current) return;
    if (ad.earnedReward) {
      settledRef.current = true;
      const expires = unlock(key);
      cb.current.onUnlocked(key, expires);
    } else if (ad.status === 'closed') {
      settledRef.current = true;
      cb.current.onFailed(key, 'closedEarly');
    }
  }, [ad.earnedReward, ad.status, key]);

  // Warm the next ad after a close so a second unlock does not wait.
  useEffect(() => {
    if (ad.status === 'closed') ad.load();
  }, [ad.status, ad]);

  const start = useCallback(() => {
    if (!enabled || ad.status !== 'loaded') {
      cb.current.onFailed(key, 'unavailable');
      if (enabled && (ad.status === 'error' || ad.status === 'no-fill')) ad.retry();
      return;
    }
    shownRef.current = true;
    settledRef.current = false;
    ad.show();
  }, [enabled, ad, key]);

  return { ready: enabled && ad.status === 'loaded', start };
}
