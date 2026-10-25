// Ad placement owner (design.md 11, M4-M6). Phase A ships NO ad SDK calls: every placement answers "none" and the
// banner strip has no height, so Screen's padding formula adds 0 for it. B03 replaces the bodies (allow-list,
// session counts, 45 s spacing, Pro = none) without changing these signatures.
export type Placement = 'banner' | 'native' | 'interstitial' | 'rewarded';

export interface BannerState {
  /** Measured banner height in dp, or null when no banner is shown on this route (M6). */
  measuredHeight: number | null;
}

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
