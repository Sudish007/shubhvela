// Ad placement owner (design.md 11, M4-M6). Phase A ships NO ad SDK calls: every placement answers "none" and the
// banner strip has no height, so Screen's padding formula adds 0 for it. B03 replaces the bodies (allow-list,
// session counts, 45 s spacing, Pro = none) without changing these signatures. Screens ask, never decide; no screen
// ever renders an ad box of its own (nothing fake: when the answer is none, nothing is drawn).
export type Placement = 'banner' | 'native' | 'interstitial' | 'rewarded';

export interface BannerState {
  /** Measured banner height in dp, or null when no banner is shown on this route (M6). */
  measuredHeight: number | null;
}

/** Routes that may carry the anchored banner (M5). Any other route -> none. B03 enforces; the list is the contract. */
export const BANNER_ROUTES: readonly string[] = ['Family', 'Charts', 'MuhuratFinder', 'MatchingResults', 'FestivalDetail', 'GlossaryList', 'LearnRoot', 'FullDashaTree', 'Ashtakavarga', 'KP', 'Calendar', 'VratDetail'];

/** The only route with a native ad card (design.md 5: Today, after the Upcoming strip, below the fold, M4). */
export const NATIVE_ROUTES: readonly string[] = ['Today'];

/** Interstitial triggers (M12); never on back navigation, never while a sheet is open. */
export type InterstitialTrigger = 'reportDone' | 'sharePreviewClosedAfterShare' | 'muhuratSearchCompleted';

export function bannerFor(_route: string): BannerState {
  return { measuredHeight: null };
}

export function placementAllowed(_placement: Placement, _route: string): boolean {
  return false;
}

/** Hook form for components; constant in Phase A. */
export function useBannerHeight(_route: string): number | null {
  return null;
}

export type TodayNativeSlot = { kind: 'none' } | { kind: 'native'; unitId: string };

/**
 * The Today card stack asks once per render where (if anywhere) its single native ad card goes. Phase A: none (no
 * SDK, no Pro screen); B03 answers 'native' for free users past the first three sessions and mounts NativeAdCard
 * only when its onLayout.y >= windowHeight (M4). Today renders nothing for 'none' - no placeholder box.
 */
export function todayNativeSlot(): TodayNativeSlot {
  return { kind: 'none' };
}
