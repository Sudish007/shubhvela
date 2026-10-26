// Ad placement owner (design.md 5 and 11; M4, M5, M6, M12, M14). Every screen ASKS this module before rendering an
// ad and never instantiates an ad view of its own; the ads components (BannerStrip, NativeAdCard, the hooks) report
// back here. Rules in one place:
//   - banner: allow-list only (M5); 'none' on any other route, in sessions 1-3, when Pro, or after a no-fill;
//   - Today native card: the LAST card of the stack, mounted only when its onLayout.y >= windowHeight (M4);
//   - strip height observable = measured banner + 2 x 16, consumed by Screen's padding formula (M6);
//   - interstitial: only maybeShowInterstitial(trigger) with the three forward triggers, sessions >= 4, one per
//     session, >= 45 s since the last ad of ANY kind; callers assert "not on back, not with a sheet open";
//   - rewarded: five keys, one ad = one key for 24 h (unlocks table via entitlements.grantUnlock);
//   - session = cold start, or foreground return after >= 30 min in background; counter persisted in app_state;
//   - Pro: none everywhere (and AdsRoot never initialises the SDK).
// Nothing fake: when the answer is 'none' nothing is drawn, not a placeholder box.
import { useSyncExternalStore } from 'react';
import { getAppState, setAppState } from '../db/appState';
import { hasDb } from '../db/connection';
import { grantUnlock, isPro, onEntitlementsChanged, type FeatureKey } from '../entitlements';
import { size } from '../theme/tokens';
import { adUnitIds, type AdUnitIds } from './config';

export type Placement = 'banner' | 'native' | 'interstitial' | 'rewarded';
export type BannerPlacement = 'anchored' | 'none';

/** Routes that may carry the anchored banner (M5). Any other route -> none. */
export const BANNER_ROUTES = ['Family', 'Charts', 'MuhuratFinder', 'MatchingResults', 'FestivalDetail', 'GlossaryList', 'LearnRoot', 'FullDashaTree', 'Ashtakavarga', 'KP', 'Calendar', 'VratDetail'] as const;
export type BannerRoute = (typeof BANNER_ROUTES)[number];

/** The only route with a native ad card (design.md 5: Today, last card, below the fold, M4). */
export const NATIVE_ROUTES: readonly string[] = ['Today'];

/** Interstitial triggers (M12): explicit forward actions only; never on back navigation, never while a sheet is open. */
export type InterstitialTrigger = 'reportDone' | 'sharePreviewClosedAfterShare' | 'muhuratSearchCompleted';
export const INTERSTITIAL_TRIGGERS: readonly InterstitialTrigger[] = ['reportDone', 'sharePreviewClosedAfterShare', 'muhuratSearchCompleted'];

/** Rewarded unlock keys (M14); each unlocks exactly one feature for 24 h. */
export const REWARDED_KEYS = ['vargas', 'kp', 'ashtakavarga', 'prashna', 'varshaphal'] as const;
export type RewardedKey = (typeof REWARDED_KEYS)[number];

/** Banner and interstitial start in the fourth session (spec F38 "never in the first 3 sessions"). */
export const FIRST_AD_SESSION = 4;
/** Minimum spacing between any two ads of any kind. */
export const MIN_AD_SPACING_MS = 45_000;
/** Background time after which a foreground return counts as a new session. */
export const SESSION_GAP_MS = 30 * 60_000;

export type AdKind = Placement;

interface MemoryState {
  /** Mirror of app_state.sessions (authoritative when there is no database, e.g. component unit tests). */
  sessions: number;
  /** Mirror of app_state.last_ad_at (epoch ms). */
  lastAdAt: number | null;
  interstitialThisSession: boolean;
  backgroundedAt: number | null;
  /** Measured banner height per route while a banner is loaded there. */
  bannerHeights: Record<string, number>;
  /** Routes whose banner reported no fill this session: the strip is removed and padding recalculated. */
  noFill: Set<string>;
}

const mem: MemoryState = { sessions: 0, lastAdAt: null, interstitialThisSession: false, backgroundedAt: null, bannerHeights: {}, noFill: new Set() };

// --- observable store ---
type Listener = () => void;
const listeners = new Set<Listener>();
let entitlementsSub: (() => void) | null = null;

function emit(): void {
  listeners.forEach((l) => l());
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  if (!entitlementsSub) entitlementsSub = onEntitlementsChanged(emit);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && entitlementsSub) {
      entitlementsSub();
      entitlementsSub = null;
    }
  };
}

/** Test hook: forget every in-memory fact (the database rows are the test's own business). */
export function resetAdPolicyForTests(): void {
  mem.sessions = 0;
  mem.lastAdAt = null;
  mem.interstitialThisSession = false;
  mem.backgroundedAt = null;
  mem.bannerHeights = {};
  mem.noFill = new Set();
  emit();
}

// --- sessions ---
function readSessions(): number {
  if (!hasDb()) return mem.sessions;
  const v = getAppState('sessions');
  return v ? Number(v) || 0 : 0;
}

function readLastAdAt(): number | null {
  if (!hasDb()) return mem.lastAdAt;
  const v = getAppState('last_ad_at');
  return v ? Number(v) || null : null;
}

export function sessionCount(): number {
  return readSessions();
}

/** A new session starts: cold start, or foreground return after >= 30 min in background. Returns the new count. */
export function beginSession(): number {
  const n = readSessions() + 1;
  mem.sessions = n;
  if (hasDb()) setAppState('sessions', String(n));
  mem.interstitialThisSession = false;
  mem.noFill = new Set();
  mem.backgroundedAt = null;
  emit();
  return n;
}

export function noteBackground(now: number = Date.now()): void {
  mem.backgroundedAt = now;
}

/** Foreground return: a new session only after >= 30 min away (design.md 5). */
export function noteForeground(now: number = Date.now()): boolean {
  const away = mem.backgroundedAt;
  mem.backgroundedAt = null;
  if (away != null && now - away >= SESSION_GAP_MS) {
    beginSession();
    return true;
  }
  return false;
}

/** Any ad at all? Pro -> false (the SDK is never initialised either, see AdsRoot). */
export function adsEnabled(): boolean {
  return !isPro();
}

/** Records that an ad of any kind was shown (the 45 s spacing counts every kind). */
export function recordAdShown(_kind: AdKind, now: number = Date.now()): void {
  mem.lastAdAt = now;
  if (hasDb()) setAppState('last_ad_at', String(now));
  emit();
}

export function unitIds(): AdUnitIds {
  return adUnitIds();
}

// --- banner (M5, M6) ---
export function bannerFor(route: string): BannerPlacement {
  if (!adsEnabled()) return 'none';
  if (!(BANNER_ROUTES as readonly string[]).includes(route)) return 'none';
  if (readSessions() < FIRST_AD_SESSION) return 'none';
  if (mem.noFill.has(route)) return 'none';
  return 'anchored';
}

/** BannerStrip reports a loaded banner's measured height (dp); the strip height becomes measured + 2 x 16. */
export function reportBannerLoaded(route: string, measuredHeight: number, now: number = Date.now()): void {
  mem.noFill.delete(route);
  mem.bannerHeights = { ...mem.bannerHeights, [route]: Math.round(measuredHeight) };
  recordAdShown('banner', now);
}

/** No fill / SDK error (design.md 11): the strip is removed for this session and the padding recalculated. */
export function reportBannerFailed(route: string): void {
  const next = { ...mem.bannerHeights };
  delete next[route];
  mem.bannerHeights = next;
  mem.noFill.add(route);
  emit();
}

/** Measured banner height for the route, or null when no banner is shown there (Screen adds the 2 x 16 padding). */
export function bannerHeightFor(route: string): number | null {
  if (bannerFor(route) !== 'anchored') return null;
  const h = mem.bannerHeights[route];
  return typeof h === 'number' ? h : null;
}

/** Full strip height (M6): measured banner + 2 x bannerPadding, or null when there is no strip. */
export function stripHeight(route: string): number | null {
  const h = bannerHeightFor(route);
  return h == null ? null : h + 2 * size.bannerPadding;
}

export function useBannerPlacement(route: string): BannerPlacement {
  return useSyncExternalStore(subscribe, () => bannerFor(route), () => 'none');
}

/** Hook form consumed by Screen's padding formula. */
export function useBannerHeight(route: string): number | null {
  return useSyncExternalStore(subscribe, () => bannerHeightFor(route), () => null);
}

// --- Today native card (M4) ---
export type TodayNativeSlot = { kind: 'none' } | { kind: 'native'; index: number; unitId: string };

/** Card keys of the Today stack; the order is decided once here so the ad is provably the last card. */
export type TodayCardKey = 'goodHours' | 'tithiToday' | 'vratToday' | 'upcoming' | 'dailyNote' | 'nativeAd';
export type TodayIntent = 'marriage' | 'career' | 'familyDates' | 'learn' | null | undefined;

/** The Today card order per onboarding intent (design.md 3): "Family dates" lifts vrat + Upcoming above the note. */
export function todayCardOrder(intent: TodayIntent): TodayCardKey[] {
  const content: TodayCardKey[] = intent === 'familyDates' ? ['goodHours', 'tithiToday', 'vratToday', 'upcoming', 'dailyNote'] : ['goodHours', 'tithiToday', 'dailyNote', 'vratToday', 'upcoming'];
  return [...content, 'nativeAd'];
}

/**
 * Where the single native ad card goes: the index AFTER the last content card (= stackLength), or none for Pro.
 * The card itself mounts its ad view only when nativeMountAllowed(onLayout.y, windowHeight).
 */
export function todayNativeSlot(stackLength: number): TodayNativeSlot {
  if (!adsEnabled()) return { kind: 'none' };
  return { kind: 'native', index: stackLength, unitId: adUnitIds().native };
}

/** M4 mount gate: the card's top edge must be at or below the window height (below the fold at any width/scale). */
export function nativeMountAllowed(layoutY: number, windowHeight: number): boolean {
  return Number.isFinite(layoutY) && Number.isFinite(windowHeight) && layoutY >= windowHeight;
}

// --- interstitial (M12) ---
export interface InterstitialDecision {
  show: boolean;
  reason?: 'pro' | 'badTrigger' | 'earlySession' | 'oncePerSession' | 'spacing';
}

export function interstitialDecision(trigger: InterstitialTrigger, now: number = Date.now()): InterstitialDecision {
  if (!adsEnabled()) return { show: false, reason: 'pro' };
  if (!INTERSTITIAL_TRIGGERS.includes(trigger)) return { show: false, reason: 'badTrigger' };
  if (readSessions() < FIRST_AD_SESSION) return { show: false, reason: 'earlySession' };
  if (mem.interstitialThisSession) return { show: false, reason: 'oncePerSession' };
  const last = readLastAdAt();
  if (last != null && now - last < MIN_AD_SPACING_MS) return { show: false, reason: 'spacing' };
  return { show: true };
}

/**
 * The ONLY way an interstitial is shown. Returns true when the caps allow it and books the slot (one per session,
 * spacing clock). Callers call it only on the three forward triggers with a loaded ad and no sheet open.
 */
export function maybeShowInterstitial(trigger: InterstitialTrigger, now: number = Date.now()): boolean {
  const d = interstitialDecision(trigger, now);
  if (!d.show) return false;
  mem.interstitialThisSession = true;
  recordAdShown('interstitial', now);
  return true;
}

// --- rewarded (M14) ---
export function isRewardedKey(key: string): key is RewardedKey {
  return (REWARDED_KEYS as readonly string[]).includes(key);
}

/** After EARNED_REWARD: writes unlocks(feature, now + 24 h) and books the spacing clock. Returns the expiry. */
export function unlock(key: RewardedKey, now: Date = new Date()): Date {
  const expires = grantUnlock(key as FeatureKey, now);
  recordAdShown('rewarded', now.getTime());
  return expires;
}

/** Generic yes/no for a placement on a route (kept from Phase A; the specific functions above are the contract). */
export function placementAllowed(placement: Placement, route: string): boolean {
  switch (placement) {
    case 'banner':
      return bannerFor(route) === 'anchored';
    case 'native':
      return adsEnabled() && NATIVE_ROUTES.includes(route);
    case 'interstitial':
      return adsEnabled() && readSessions() >= FIRST_AD_SESSION && !mem.interstitialThisSession;
    case 'rewarded':
      return adsEnabled();
  }
}
