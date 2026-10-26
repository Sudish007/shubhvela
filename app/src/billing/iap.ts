// Play Billing through expo-iap (plan P2, P19; design.md 10.9). This module is the only writer of the `entitlements`
// and `purchases` tables (through entitlements.setEntitlement). Flow: connect -> fetchProducts (localised prices) ->
// requestPurchase -> purchase arrives (promise or purchaseUpdated listener) -> acknowledge / consume -> cache.
// On launch getAvailablePurchases() restores the cache: Pro products -> 'active' ('grace' while Play reports a
// billing issue: Pro stays on, Settings shows the notice), absent -> 'expired'; unconsumed report purchases are
// consumed into report credits. Failures (cancelled / network / item unavailable) surface inline and NEVER change
// the cache. The gateway is injectable so the restore path is unit-tested with mocked purchases.
import { PRO_PRODUCTS, entitlementRows, setEntitlement, type EntitlementState, type ReportKind } from '../entitlements';
import { getDb } from '../db/connection';
import { BASE_PLAN_ID, IN_APP_SKUS, LIFETIME_SKU, REPORT_SKU, SUBSCRIPTION_SKU, SUBSCRIPTION_SKUS, isProSku, reportKindOf, type Plan } from './products';

// --- the slice of expo-iap this app uses (structural types; expo-iap's own types satisfy them) ---
export interface StoreOffer {
  id: string;
  basePlanIdAndroid?: string | null;
  offerTokenAndroid?: string | null;
  displayPrice: string;
  price: number;
  currency?: string | null;
}

export interface StoreProduct {
  id: string;
  type: 'in-app' | 'subs';
  displayPrice: string;
  price?: number | null;
  currency: string;
  subscriptionOffers?: StoreOffer[] | null;
}

export interface StorePurchase {
  id: string;
  productId: string;
  purchaseToken?: string | null;
  purchaseState: 'pending' | 'purchased' | 'unknown';
  isAcknowledgedAndroid?: boolean | null;
  isSuspendedAndroid?: boolean | null;
  currentPlanId?: string | null;
  transactionDate: number;
}

export interface StoreError {
  code: string;
  message: string;
}

export interface BillingGateway {
  initConnection(): Promise<boolean>;
  endConnection(): Promise<boolean>;
  fetchProducts(req: { skus: string[]; type: 'in-app' | 'subs' }): Promise<StoreProduct[] | null>;
  getAvailablePurchases(opts?: { includeSuspendedAndroid?: boolean }): Promise<StorePurchase[]>;
  requestPurchase(args: { type: 'in-app'; request: { google: { skus: string[] } } } | { type: 'subs'; request: { google: { skus: string[]; subscriptionOffers?: { sku: string; offerToken: string }[] } } }): Promise<StorePurchase | StorePurchase[] | null>;
  finishTransaction(args: { purchase: StorePurchase; isConsumable?: boolean }): Promise<void>;
  purchaseUpdatedListener(listener: (p: StorePurchase) => void): { remove: () => void };
  purchaseErrorListener(listener: (e: StoreError) => void): { remove: () => void };
  subscriptionBillingIssueListener?(listener: (p: StorePurchase) => void): { remove: () => void };
}

/** Lazily bound real gateway (expo-iap). Kept behind a function so unit tests never touch the native module. */
export function expoIapGateway(): BillingGateway {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const iap = require('expo-iap') as typeof import('expo-iap');
  return {
    initConnection: () => iap.initConnection(),
    endConnection: () => iap.endConnection(),
    fetchProducts: (req) => iap.fetchProducts(req) as Promise<StoreProduct[] | null>,
    getAvailablePurchases: (opts) => iap.getAvailablePurchases(opts ?? undefined) as Promise<StorePurchase[]>,
    requestPurchase: (args) => iap.requestPurchase(args as Parameters<typeof iap.requestPurchase>[0]) as Promise<StorePurchase | StorePurchase[] | null>,
    finishTransaction: (args) => iap.finishTransaction(args as Parameters<typeof iap.finishTransaction>[0]),
    purchaseUpdatedListener: (l) => iap.purchaseUpdatedListener(l as Parameters<typeof iap.purchaseUpdatedListener>[0]),
    purchaseErrorListener: (l) => iap.purchaseErrorListener(l as Parameters<typeof iap.purchaseErrorListener>[0]),
    subscriptionBillingIssueListener: (l) => iap.subscriptionBillingIssueListener(l as Parameters<typeof iap.subscriptionBillingIssueListener>[0]),
  };
}

let gateway: BillingGateway | null = null;
export function setBillingGateway(gw: BillingGateway | null): void {
  gateway = gw;
  connected = false;
}
function gw(): BillingGateway {
  return gateway ?? (gateway = expoIapGateway());
}

// --- connection ---
let connected = false;
let connecting: Promise<boolean> | null = null;
const subs: { remove: () => void }[] = [];

export async function connectBilling(): Promise<boolean> {
  if (connected) return true;
  if (connecting) return connecting;
  connecting = (async () => {
    try {
      const ok = await gw().initConnection();
      if (!ok) return false;
      connected = true;
      subs.push(gw().purchaseUpdatedListener((p) => void handlePurchase(p)));
      subs.push(gw().purchaseErrorListener((e) => notifyError(toBillingFailure(e))));
      const issue = gw().subscriptionBillingIssueListener;
      if (issue) subs.push(issue.call(gw(), (p) => markGrace(p)));
      return true;
    } catch {
      return false;
    } finally {
      connecting = null;
    }
  })();
  return connecting;
}

export async function disconnectBilling(): Promise<void> {
  subs.splice(0).forEach((s) => s.remove());
  if (connected) await gw().endConnection().catch(() => false);
  connected = false;
}

// --- catalog (localised prices) ---
export interface PriceInfo {
  displayPrice: string;
  amount: number | null;
  currency: string | null;
}

export interface Catalog {
  plans: Record<Plan, PriceInfo | null>;
  reports: Record<ReportKind, PriceInfo | null>;
  /** Offer tokens needed by requestPurchase for the two base plans. */
  offerTokens: Partial<Record<Exclude<Plan, 'lifetime'>, string>>;
  /** True when Play answered (even with no products); false when the catalog is the offline fallback. */
  fromStore: boolean;
}

export const EMPTY_CATALOG: Catalog = {
  plans: { monthly: null, yearly: null, lifetime: null },
  reports: { janam_patri: null, matching: null, varshaphal: null },
  offerTokens: {},
  fromStore: false,
};

/** Pure mapping from store products to the catalog (tested with fixtures). */
export function catalogFrom(products: StoreProduct[]): Catalog {
  const cat: Catalog = { ...EMPTY_CATALOG, plans: { ...EMPTY_CATALOG.plans }, reports: { ...EMPTY_CATALOG.reports }, offerTokens: {}, fromStore: true };
  for (const p of products) {
    if (p.id === SUBSCRIPTION_SKU) {
      for (const plan of ['monthly', 'yearly'] as const) {
        // The base plan's own offer carries no offerId beyond the base plan; prefer the offer whose basePlanId matches.
        const offer = (p.subscriptionOffers ?? []).find((o) => o.basePlanIdAndroid === BASE_PLAN_ID[plan]);
        if (offer) {
          cat.plans[plan] = { displayPrice: offer.displayPrice, amount: Number.isFinite(offer.price) ? offer.price : null, currency: offer.currency ?? p.currency ?? null };
          if (offer.offerTokenAndroid) cat.offerTokens[plan] = offer.offerTokenAndroid;
        }
      }
    } else if (p.id === LIFETIME_SKU) {
      cat.plans.lifetime = { displayPrice: p.displayPrice, amount: p.price ?? null, currency: p.currency ?? null };
    } else {
      const kind = reportKindOf(p.id);
      if (kind) cat.reports[kind] = { displayPrice: p.displayPrice, amount: p.price ?? null, currency: p.currency ?? null };
    }
  }
  return cat;
}

/** Play's localised catalog; throws BillingFailure('unreachable') when Play cannot be reached (caller keeps the fallback). */
export async function loadCatalog(): Promise<Catalog> {
  if (!(await connectBilling())) throw new BillingFailure('unreachable');
  try {
    const [subs, inApp] = await Promise.all([gw().fetchProducts({ skus: [...SUBSCRIPTION_SKUS], type: 'subs' }), gw().fetchProducts({ skus: [...IN_APP_SKUS], type: 'in-app' })]);
    return catalogFrom([...(subs ?? []), ...(inApp ?? [])]);
  } catch (e) {
    throw toBillingFailure(e);
  }
}

// --- purchases -> cache ---
export type BillingFailureKind = 'cancelled' | 'network' | 'unavailable' | 'unreachable' | 'alreadyOwned' | 'failed';

export class BillingFailure extends Error {
  constructor(
    public kind: BillingFailureKind,
    public storeMessage?: string,
  ) {
    super(kind);
  }
}

export function toBillingFailure(e: unknown): BillingFailure {
  if (e instanceof BillingFailure) return e;
  const code = typeof (e as StoreError)?.code === 'string' ? (e as StoreError).code : '';
  const message = typeof (e as StoreError)?.message === 'string' ? (e as StoreError).message : undefined;
  switch (code) {
    case 'user-cancelled':
      return new BillingFailure('cancelled', message);
    case 'network-error':
    case 'service-disconnected':
    case 'service-timeout':
    case 'remote-error':
    case 'connection-closed':
      return new BillingFailure('network', message);
    case 'item-unavailable':
    case 'sku-not-found':
    case 'empty-sku-list':
    case 'query-product':
      return new BillingFailure('unavailable', message);
    case 'already-owned':
      return new BillingFailure('alreadyOwned', message);
    case 'billing-unavailable':
    case 'iap-not-available':
    case 'init-connection':
    case 'not-prepared':
      return new BillingFailure('unreachable', message);
    default:
      return new BillingFailure('failed', message);
  }
}

type ErrorListener = (f: BillingFailure) => void;
const errorListeners = new Set<ErrorListener>();
export function onBillingError(l: ErrorListener): () => void {
  errorListeners.add(l);
  return () => {
    errorListeners.delete(l);
  };
}
function notifyError(f: BillingFailure): void {
  errorListeners.forEach((l) => l(f));
}

function stateOf(p: StorePurchase): EntitlementState {
  if (p.isSuspendedAndroid) return 'grace';
  return p.purchaseState === 'purchased' ? 'active' : 'pending';
}

function recordReportCredit(p: StorePurchase): void {
  const token = p.purchaseToken ?? p.id;
  const dup = getDb().getFirstSync<{ n: number }>('SELECT COUNT(*) AS n FROM purchases WHERE token = ?', [token]);
  if ((dup?.n ?? 0) > 0) return;
  getDb().runSync('INSERT INTO purchases (product, ref_id, token, delivered_at) VALUES (?, NULL, ?, NULL)', [p.productId, token]);
}

/**
 * Applies one purchase to the cache and settles it with Play: Pro products are acknowledged, report consumables are
 * consumed into a credit row. Idempotent (same token twice = one row).
 */
export async function handlePurchase(p: StorePurchase, now: Date = new Date()): Promise<void> {
  if (isProSku(p.productId)) {
    setEntitlement(p.productId, stateOf(p), p.purchaseToken ?? null, now);
    if (p.purchaseState === 'purchased' && p.isAcknowledgedAndroid === false) await gw().finishTransaction({ purchase: p, isConsumable: false }).catch(() => undefined);
    return;
  }
  if (reportKindOf(p.productId) && p.purchaseState === 'purchased') {
    recordReportCredit(p);
    await gw().finishTransaction({ purchase: p, isConsumable: true }).catch(() => undefined);
  }
}

function markGrace(p: StorePurchase): void {
  if (!isProSku(p.productId)) return;
  setEntitlement(p.productId, 'grace', p.purchaseToken ?? null);
}

/**
 * Pure cache update from the full list Play returned: present Pro products -> active/grace/pending, cached Pro
 * products Play no longer lists -> expired. Report consumables are returned for consumption by the caller.
 */
export function applyAvailablePurchases(purchases: StorePurchase[], now: Date = new Date()): { reports: StorePurchase[] } {
  const seen = new Set<string>();
  const reports: StorePurchase[] = [];
  for (const p of purchases) {
    if (isProSku(p.productId)) {
      seen.add(p.productId);
      setEntitlement(p.productId, stateOf(p), p.purchaseToken ?? null, now);
    } else if (reportKindOf(p.productId) && p.purchaseState === 'purchased') {
      reports.push(p);
    }
  }
  for (const row of entitlementRows()) {
    if ((PRO_PRODUCTS as readonly string[]).includes(row.product) && !seen.has(row.product) && row.state !== 'expired') setEntitlement(row.product, 'expired', row.token, now);
  }
  return { reports };
}

export interface RestoreResult {
  /** True when at least one Pro purchase was found. */
  pro: boolean;
  /** Report credits consumed in this restore. */
  reportCredits: number;
}

/** Restore from Play (launch and the Restore row). Throws BillingFailure('unreachable') and leaves the cache untouched. */
export async function restorePurchases(now: Date = new Date()): Promise<RestoreResult> {
  if (!(await connectBilling())) throw new BillingFailure('unreachable');
  let purchases: StorePurchase[];
  try {
    purchases = await gw().getAvailablePurchases({ includeSuspendedAndroid: true });
  } catch (e) {
    throw toBillingFailure(e);
  }
  const { reports } = applyAvailablePurchases(purchases, now);
  for (const p of reports) {
    recordReportCredit(p);
    await gw().finishTransaction({ purchase: p, isConsumable: true }).catch(() => undefined);
  }
  for (const p of purchases) {
    if (isProSku(p.productId) && p.purchaseState === 'purchased' && p.isAcknowledgedAndroid === false) await gw().finishTransaction({ purchase: p, isConsumable: false }).catch(() => undefined);
  }
  return { pro: purchases.some((p) => isProSku(p.productId) && p.purchaseState === 'purchased'), reportCredits: reports.length };
}

/** Launch-time restore: never throws (Play unreachable = the cached entitlement stands). */
export async function restoreOnLaunch(): Promise<RestoreResult | null> {
  try {
    return await restorePurchases();
  } catch {
    return null;
  }
}

// --- buying ---
function asList(r: StorePurchase | StorePurchase[] | null): StorePurchase[] {
  return r == null ? [] : Array.isArray(r) ? r : [r];
}

/** Buys a plan. Resolves after the purchase is cached; rejects with BillingFailure and leaves the cache untouched. */
export async function buyPlan(plan: Plan, catalog: Catalog): Promise<void> {
  if (!(await connectBilling())) throw new BillingFailure('unreachable');
  try {
    if (plan === 'lifetime') {
      const result = await gw().requestPurchase({ type: 'in-app', request: { google: { skus: [LIFETIME_SKU] } } });
      for (const p of asList(result)) await handlePurchase(p);
      return;
    }
    const token = catalog.offerTokens[plan];
    const result = await gw().requestPurchase({
      type: 'subs',
      request: { google: { skus: [SUBSCRIPTION_SKU], subscriptionOffers: token ? [{ sku: SUBSCRIPTION_SKU, offerToken: token }] : undefined } },
    });
    for (const p of asList(result)) await handlePurchase(p);
  } catch (e) {
    throw toBillingFailure(e);
  }
}

/** Buys one report consumable (P19): the credit lands in `purchases` with delivered_at NULL until a preview uses it. */
export async function buyReport(kind: ReportKind): Promise<void> {
  if (!(await connectBilling())) throw new BillingFailure('unreachable');
  try {
    const result = await gw().requestPurchase({ type: 'in-app', request: { google: { skus: [REPORT_SKU[kind]] } } });
    for (const p of asList(result)) await handlePurchase(p);
  } catch (e) {
    throw toBillingFailure(e);
  }
}
