// Play product ids (plan P19, spec F39/F40). The owner creates them in Play Console (docs/OWNER-TODO.md item 3):
//   subscription `shubhvela_pro` with base plans `monthly` / `yearly`; in-app non-consumable `shubhvela_pro_lifetime`;
//   consumables `report_janam_patri`, `report_matching`, `report_varshaphal` (one purchase = one delivered report).
// Prices live in Play; the app only knows the spec INR fallback (entitlements.INR_FALLBACK) for offline display.
import type { ReportKind } from '../entitlements';

export const SUBSCRIPTION_SKU = 'shubhvela_pro' as const;
export const LIFETIME_SKU = 'shubhvela_pro_lifetime' as const;

export type Plan = 'monthly' | 'yearly' | 'lifetime';
export const PLANS: readonly Plan[] = ['monthly', 'yearly', 'lifetime'];

/** Base plan ids of the subscription. */
export const BASE_PLAN_ID: Readonly<Record<Exclude<Plan, 'lifetime'>, string>> = { monthly: 'monthly', yearly: 'yearly' };

export const REPORT_SKU: Readonly<Record<ReportKind, string>> = {
  janam_patri: 'report_janam_patri',
  matching: 'report_matching',
  varshaphal: 'report_varshaphal',
};
export const REPORT_KINDS: readonly ReportKind[] = ['janam_patri', 'matching', 'varshaphal'];

export const IN_APP_SKUS: readonly string[] = [LIFETIME_SKU, ...Object.values(REPORT_SKU)];
export const SUBSCRIPTION_SKUS: readonly string[] = [SUBSCRIPTION_SKU];

export function reportKindOf(sku: string): ReportKind | null {
  for (const k of REPORT_KINDS) if (REPORT_SKU[k] === sku) return k;
  return null;
}

export function isProSku(sku: string): boolean {
  return sku === SUBSCRIPTION_SKU || sku === LIFETIME_SKU;
}

/** "Save N%" on the yearly card is arithmetic over the two shown prices: 1 - yearly / (monthly x 12), rounded. */
export function savingPercent(monthly: number, yearly: number): number {
  if (!(monthly > 0) || !(yearly >= 0)) return 0;
  return Math.max(0, Math.round((1 - yearly / (monthly * 12)) * 100));
}

/** The yearly price spread over 12 months, two decimals (e.g. 299 -> "24.92"). */
export function monthlyEquivalent(yearly: number): string {
  return (yearly / 12).toFixed(2);
}

/** Play subscription centre deep link for Manage / cancel (design.md 5). */
export const MANAGE_SUBSCRIPTION_URL = 'https://play.google.com/store/account/subscriptions?sku=shubhvela_pro&package=com.shubhvela.app';
