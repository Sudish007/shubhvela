// The ONLY module that answers tier questions (design.md 11, spec section 9). Screens ask; they never compare SKUs,
// count rows or decide caps themselves. Phase A: nothing can be bought, so isPro() is false and every Pro-only answer
// is an honest refusal that the UI explains with the "Pro is not in this build yet" sheet. B03 extends the unlock
// table (rewarded 24 h unlocks) and the Play entitlement state; the function names here are the contract.
import { getDb } from './db/connection';

/** Free tier caps (spec section 9). */
export const FREE_PROFILE_CAP = 2;
/** Enabled reminder SERIES: each tithi birthday, each ancestor (barsi incl. its Pitru Paksha day), each vrat family = 1. */
export const FREE_REMINDER_SERIES_CAP = 5;

export const PRO_PRODUCTS = ['shubhvela_pro', 'shubhvela_pro_lifetime'] as const;

/** Feature keys gated by tier or by a rewarded 24 h unlock (spec section 9). */
export type FeatureKey =
  | 'vargas' // D2-D60 except D9
  | 'kp'
  | 'ashtakavarga'
  | 'prashna'
  | 'varshaphal'
  | 'dasha_pratyantar'
  | 'muhurat_any_range'
  | 'matching_full'
  | 'ask_my_chart'
  | 'ads_free';

/** Features a rewarded ad can unlock for 24 h on the free tier; the rest are Pro-only. */
export const REWARDED_UNLOCKABLE: readonly FeatureKey[] = ['vargas', 'kp', 'ashtakavarga', 'prashna', 'varshaphal'];

export type Refusal = 'pro_profiles' | 'pro_reminders' | 'pro_feature';

export interface Decision {
  allowed: boolean;
  /** Why not, for the UI to explain (never silently fail). */
  reason?: Refusal;
  /** Cap that applies on the current tier (undefined for Pro). */
  cap?: number;
}

/** True when a Pro product is active. Reads the Play-backed entitlement cache written by B03; empty in Phase A. */
export function isPro(): boolean {
  const row = getDb().getFirstSync<{ n: number }>(
    `SELECT COUNT(*) AS n FROM entitlements WHERE state = 'active' AND product IN (${PRO_PRODUCTS.map(() => '?').join(', ')})`,
    [...PRO_PRODUCTS],
  );
  return (row?.n ?? 0) > 0;
}

/** May another profile be created given `currentCount` existing profiles (ancestors excluded)? */
export function canAddProfile(currentCount: number): Decision {
  if (isPro()) return { allowed: true };
  return currentCount < FREE_PROFILE_CAP ? { allowed: true, cap: FREE_PROFILE_CAP } : { allowed: false, reason: 'pro_profiles', cap: FREE_PROFILE_CAP };
}

/** May another reminder series be switched on given `enabledSeriesCount` already enabled? */
export function canAddReminder(enabledSeriesCount: number): Decision {
  if (isPro()) return { allowed: true };
  return enabledSeriesCount < FREE_REMINDER_SERIES_CAP
    ? { allowed: true, cap: FREE_REMINDER_SERIES_CAP }
    : { allowed: false, reason: 'pro_reminders', cap: FREE_REMINDER_SERIES_CAP };
}

/** Unexpired rewarded unlock for a feature (B03 writes rows; Phase A only reads). */
export function unlockedUntil(feature: FeatureKey, now: Date = new Date()): Date | null {
  const row = getDb().getFirstSync<{ expires_at: string }>('SELECT expires_at FROM unlocks WHERE feature = ?', [feature]);
  if (!row) return null;
  const until = new Date(row.expires_at);
  return until.getTime() > now.getTime() ? until : null;
}

export function canSeeFeature(feature: FeatureKey, now: Date = new Date()): Decision {
  if (isPro()) return { allowed: true };
  if (REWARDED_UNLOCKABLE.includes(feature) && unlockedUntil(feature, now)) return { allowed: true };
  return { allowed: false, reason: 'pro_feature' };
}
