// The ONLY module that answers tier questions (design.md 11, spec section 9). Screens ask; they never compare SKUs,
// count rows or decide caps themselves. B03: isPro() reads the Play-backed entitlement cache (`entitlements` table,
// written by app/src/billing/iap.ts), the M2 report table lives here, rewarded unlocks are granted here (24 h) and the
// grace period is a cache state ('grace' keeps Pro on while Settings shows the "Payment issue" notice).
import { getDb, hasDb } from './db/connection';

/** Free tier caps (spec section 9). */
export const FREE_PROFILE_CAP = 2;
/** Enabled reminder SERIES: each tithi birthday, each ancestor (barsi incl. its Pitru Paksha day), each vrat family = 1. */
export const FREE_REMINDER_SERIES_CAP = 5;

export const PRO_PRODUCTS = ['shubhvela_pro', 'shubhvela_pro_lifetime'] as const;
export type ProProduct = (typeof PRO_PRODUCTS)[number];

/** Rewarded unlocks last 24 h (design.md 5, M14). */
export const UNLOCK_HOURS = 24;

/** Entitlement cache states. 'active' and 'grace' both mean Pro; 'grace' adds the Settings notice (design.md 10.9). */
export type EntitlementState = 'active' | 'grace' | 'pending' | 'expired';
const PRO_STATES: readonly EntitlementState[] = ['active', 'grace'];

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

/** One-time report products (spec F31/F40, M2). */
export type ReportKind = 'janam_patri' | 'matching' | 'varshaphal';

export type Refusal = 'pro_profiles' | 'pro_reminders' | 'pro_feature';

export interface Decision {
  allowed: boolean;
  /** Why not, for the UI to explain (never silently fail). */
  reason?: Refusal;
  /** Cap that applies on the current tier (undefined for Pro). */
  cap?: number;
}

export interface EntitlementRow {
  product: string;
  token: string | null;
  state: EntitlementState;
  updated_at: string;
}

export interface ProStatus {
  pro: boolean;
  /** Which product grants Pro (lifetime wins over the subscription when both are cached). */
  product: ProProduct | null;
  /** True while the subscription cache is in 'grace' (payment issue, access kept; Settings notice). */
  grace: boolean;
}

// --- change notifications (AdPolicy and the Settings rows re-render when the cache changes) ---
type Listener = () => void;
const listeners = new Set<Listener>();

export function onEntitlementsChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notify(): void {
  listeners.forEach((l) => l());
}

function proRows(): EntitlementRow[] {
  if (!hasDb()) return [];
  return getDb().getAllSync<EntitlementRow>(`SELECT product, token, state, updated_at FROM entitlements WHERE product IN (${PRO_PRODUCTS.map(() => '?').join(', ')})`, [...PRO_PRODUCTS]);
}

/** Pro status from the cache: lifetime first, then the subscription (active or in grace). */
export function proStatus(): ProStatus {
  const rows = proRows().filter((r) => PRO_STATES.includes(r.state));
  const lifetime = rows.find((r) => r.product === 'shubhvela_pro_lifetime');
  if (lifetime) return { pro: true, product: 'shubhvela_pro_lifetime', grace: false };
  const sub = rows.find((r) => r.product === 'shubhvela_pro');
  if (sub) return { pro: true, product: 'shubhvela_pro', grace: sub.state === 'grace' };
  return { pro: false, product: null, grace: false };
}

/** True when a Pro product is active or in its grace period. Empty cache (no database yet) = free. */
export function isPro(): boolean {
  return proStatus().pro;
}

/** Design.md 10.9: Play's billing-issue state keeps Pro on and shows "Payment issue - update your card in Play". */
export function inGracePeriod(): boolean {
  return proStatus().grace;
}

/** Writes one entitlement row (billing is the only caller). Idempotent; notifies subscribers. */
export function setEntitlement(product: string, state: EntitlementState, token: string | null, now: Date = new Date()): void {
  getDb().runSync(
    'INSERT INTO entitlements (product, token, state, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(product) DO UPDATE SET token = excluded.token, state = excluded.state, updated_at = excluded.updated_at',
    [product, token, state, now.toISOString()],
  );
  notify();
}

export function entitlementRows(): EntitlementRow[] {
  if (!hasDb()) return [];
  return getDb().getAllSync<EntitlementRow>('SELECT product, token, state, updated_at FROM entitlements');
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

/** Unexpired rewarded unlock for a feature. */
export function unlockedUntil(feature: FeatureKey, now: Date = new Date()): Date | null {
  if (!hasDb()) return null;
  const row = getDb().getFirstSync<{ expires_at: string }>('SELECT expires_at FROM unlocks WHERE feature = ?', [feature]);
  if (!row) return null;
  const until = new Date(row.expires_at);
  return until.getTime() > now.getTime() ? until : null;
}

/**
 * Grants a rewarded 24 h unlock (design.md 5): `unlocks(feature, expires_at = now + 24 h)`. Only the five rewarded
 * keys can be granted; AdPolicy.unlock() is the caller after the ad reports EARNED_REWARD. Returns the expiry.
 */
export function grantUnlock(feature: FeatureKey, now: Date = new Date()): Date {
  if (!REWARDED_UNLOCKABLE.includes(feature)) throw new Error(`${feature} is not a rewarded-unlockable feature`);
  const expires = new Date(now.getTime() + UNLOCK_HOURS * 3600_000);
  getDb().runSync('INSERT INTO unlocks (feature, expires_at) VALUES (?, ?) ON CONFLICT(feature) DO UPDATE SET expires_at = excluded.expires_at', [feature, expires.toISOString()]);
  notify();
  return expires;
}

export function canSeeFeature(feature: FeatureKey, now: Date = new Date()): Decision {
  if (isPro()) return { allowed: true };
  if (REWARDED_UNLOCKABLE.includes(feature) && unlockedUntil(feature, now)) return { allowed: true };
  return { allowed: false, reason: 'pro_feature' };
}

/**
 * M2 entitlement table: Janam Patri PDF and the Matching report PDF are included in Pro (free pays ₹99 each);
 * the Varshaphal report is ₹149 on both tiers. The UI reads this, never the SKU list.
 */
export function reportIncluded(report: ReportKind): boolean {
  if (report === 'varshaphal') return false;
  return isPro();
}

/** Spec INR prices (F39/F40) used only while Play's localised price is not available, labelled "store price may differ". */
export const INR_FALLBACK: Readonly<Record<'monthly' | 'yearly' | 'lifetime' | ReportKind, { label: string; amount: number }>> = {
  monthly: { label: '₹49', amount: 49 },
  yearly: { label: '₹299', amount: 299 },
  lifetime: { label: '₹999', amount: 999 },
  janam_patri: { label: '₹99', amount: 99 },
  matching: { label: '₹99', amount: 99 },
  varshaphal: { label: '₹149', amount: 149 },
};

export interface PriceLabel {
  /** Text to print next to the product. */
  label: string;
  /** True when the label is the spec fallback rather than Play's localised price (P19: caption "store price may differ"). */
  fallback: boolean;
}

/** Play's localised price when the catalog has one, else the spec INR fallback flagged for the caption. */
export function priceLabel(product: keyof typeof INR_FALLBACK, storePrice: string | null | undefined): PriceLabel {
  if (storePrice && storePrice.trim()) return { label: storePrice, fallback: false };
  return { label: INR_FALLBACK[product].label, fallback: true };
}

/** Unused report credits (consumables bought and consumed but not yet delivered to a profile/pair; plan P19). */
export function reportCredits(report: ReportKind): number {
  if (!hasDb()) return 0;
  const row = getDb().getFirstSync<{ n: number }>('SELECT COUNT(*) AS n FROM purchases WHERE product = ? AND delivered_at IS NULL', [`report_${report}`]);
  return row?.n ?? 0;
}

/** True when a report consumable has already been delivered for this profile / pair reference (P19: one purchase = one report). */
export function reportDelivered(report: ReportKind, refId: string): boolean {
  if (!hasDb()) return false;
  const row = getDb().getFirstSync<{ n: number }>('SELECT COUNT(*) AS n FROM purchases WHERE product = ? AND ref_id = ? AND delivered_at IS NOT NULL', [`report_${report}`, refId]);
  return (row?.n ?? 0) > 0;
}

/**
 * What the preview CTA may do (M2 + P19): 'included' (Pro, Janam Patri / Matching), 'delivered' (this profile or pair
 * already consumed a purchase), 'credit' (an unused purchase exists and will be delivered on Download), 'buy'.
 */
export type ReportAccess = 'included' | 'delivered' | 'credit' | 'buy';

export function reportAccess(report: ReportKind, refId: string): ReportAccess {
  if (reportIncluded(report)) return 'included';
  if (reportDelivered(report, refId)) return 'delivered';
  if (reportCredits(report) > 0) return 'credit';
  return 'buy';
}

/**
 * Delivers one report credit to a profile / pair: the oldest undelivered `purchases` row of that product gets
 * ref_id + delivered_at. Idempotent for an already-delivered reference. Returns true when the reference is delivered
 * afterwards (false when no credit existed). The preview screen is the only caller.
 */
export function deliverReport(report: ReportKind, refId: string, now: Date = new Date()): boolean {
  if (reportDelivered(report, refId)) return true;
  const row = getDb().getFirstSync<{ id: number }>('SELECT id FROM purchases WHERE product = ? AND delivered_at IS NULL ORDER BY id ASC LIMIT 1', [`report_${report}`]);
  if (!row) return false;
  getDb().runSync('UPDATE purchases SET ref_id = ?, delivered_at = ? WHERE id = ?', [refId, now.toISOString(), row.id]);
  notify();
  return true;
}
