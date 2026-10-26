// Unlock state for the five rewarded keys (design.md 5 M14, spec section 9): the hook re-renders a screen when
// entitlements change (Pro restored, a 24-h unlock granted) and the label helpers print the state the way design.md
// words it - "unlocked till <time> tomorrow" (or "till <time> <date>" once "tomorrow" would no longer be true), the
// locked wording with the key's name, or nothing when Pro. entitlements.ts stays the only module that decides.
import { addDays, localDateOf } from '@shubhvela/engine';
import { useSyncExternalStore } from 'react';
import { canSeeFeature, isPro, onEntitlementsChanged, unlockedUntil, type FeatureKey } from '../entitlements';
import type { Lang, TFn } from '../i18n';
import { fmtDate, fmtTime } from '../today/format';

export type UnlockKey = 'vargas' | 'kp' | 'ashtakavarga' | 'prashna' | 'varshaphal';

/** Keys of the "More from this chart" rows in this build (Prashna and Ask my chart are added by C04). */
export const MORE_FROM_CHART_KEYS: readonly UnlockKey[] = ['vargas', 'ashtakavarga', 'kp', 'varshaphal'];

export interface FeatureAccess {
  allowed: boolean;
  pro: boolean;
  /** Expiry of a running 24-h unlock (null when Pro or locked). */
  until: Date | null;
}

function snapshot(key: FeatureKey, nowMs: number): string {
  const now = new Date(nowMs);
  const until = isPro() ? null : unlockedUntil(key, now);
  return `${isPro() ? 1 : 0}|${canSeeFeature(key, now).allowed ? 1 : 0}|${until ? until.toISOString() : ''}`;
}

function parse(s: string): FeatureAccess {
  const [pro, allowed, until] = s.split('|');
  return { pro: pro === '1', allowed: allowed === '1', until: until ? new Date(until) : null };
}

/** Live access state of a feature key; re-renders on every entitlement change (unlock granted, Pro restored). */
export function useFeatureAccess(key: FeatureKey, nowMs: number): FeatureAccess {
  const s = useSyncExternalStore(onEntitlementsChanged, () => snapshot(key, nowMs), () => snapshot(key, nowMs));
  return parse(s);
}

/** Non-hook form for screens that compute once per render pass. */
export function featureAccess(key: FeatureKey, nowMs: number): FeatureAccess {
  return parse(snapshot(key, nowMs));
}

/** True when `until` falls on the civil day after `nowMs` in `tz` (the wording "tomorrow" is then exact). */
export function isTomorrow(until: Date, nowMs: number, tz: string): boolean {
  return localDateOf(until.getTime(), tz) === addDays(localDateOf(nowMs, tz), 1);
}

/** "unlocked till 10:58 tomorrow" / "unlocked till 10:58 24 Oct 2026" (row caption after an unlock). */
export function unlockedTillText(until: Date, nowMs: number, tz: string, lang: Lang, t: TFn): string {
  const time = fmtTime(until.getTime(), tz);
  return isTomorrow(until, nowMs, tz) ? t('unlock.till', { time }) : t('unlock.tillDate', { time, date: fmtDate(until.getTime(), tz, lang) });
}

/** "till 10:58 tomorrow" / "till 10:58 24 Oct 2026" (chip caption after an unlock). */
export function chipTillText(until: Date, nowMs: number, tz: string, lang: Lang, t: TFn): string {
  const time = fmtTime(until.getTime(), tz);
  return isTomorrow(until, nowMs, tz) ? t('unlock.chipTill', { time }) : t('unlock.chipTillDate', { time, date: fmtDate(until.getTime(), tz, lang) });
}

/** The localised key name used in every unlock sentence ("Unlock Ashtakavarga", "14 vargas unlocked till ..."). */
export function featureName(key: UnlockKey, t: TFn): string {
  return t(`unlock.feature.${key}`);
}

/**
 * The state caption of a "More from this chart" row (design.md 5): Pro -> null (plain row), unlocked -> "unlocked till
 * <time> tomorrow", locked -> "watch an ad · 24 h".
 */
export function rowStateText(access: FeatureAccess, nowMs: number, tz: string, lang: Lang, t: TFn): string | null {
  if (access.pro) return null;
  if (access.until) return unlockedTillText(access.until, nowMs, tz, lang, t);
  return t('unlock.watchShort');
}
