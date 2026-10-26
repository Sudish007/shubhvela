// The "Restore" row (design.md 5 / 10.9): asks Play for the account's purchases and rewrites the cache. Outcomes map
// to the pro.* strings: restored (Pro found), nothing (no Pro purchase on this Google account), unreachable (cache kept).
import { restorePurchases, type BillingFailure } from './iap';

export type RestoreOutcome = 'restored' | 'nothing' | 'unreachable';

export async function restoreNow(): Promise<RestoreOutcome> {
  try {
    const r = await restorePurchases();
    return r.pro || r.reportCredits > 0 ? 'restored' : 'nothing';
  } catch (e) {
    const kind = (e as BillingFailure).kind;
    return kind === 'unreachable' || kind === 'network' || kind === 'failed' ? 'unreachable' : 'nothing';
  }
}
