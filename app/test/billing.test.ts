// Billing (plan P2/P19, design.md 10.9) through the injectable gateway: catalog mapping (localised prices, offer
// tokens), restore from mocked getAvailablePurchases (active / grace / expired / consumable credits, acknowledgements),
// failures leave the cache untouched, buying a plan or a report, the Manage deep link, SKUs and the Save arithmetic.
import { getDb } from '../src/db/connection';
import { entitlementRows, inGracePeriod, isPro, proStatus, reportCredits, reportIncluded, setEntitlement } from '../src/entitlements';
import { BillingFailure, applyAvailablePurchases, buyPlan, buyReport, catalogFrom, loadCatalog, restorePurchases, setBillingGateway, toBillingFailure, type BillingGateway, type StorePurchase } from '../src/billing/iap';
import { manageSubscriptionUrl, openManageSubscription } from '../src/billing/manage';
import { BASE_PLAN_ID, IN_APP_SKUS, LIFETIME_SKU, MANAGE_SUBSCRIPTION_URL, REPORT_SKU, SUBSCRIPTION_SKU, monthlyEquivalent, savingPercent } from '../src/billing/products';
import { restoreNow } from '../src/billing/restore';
import { installTestDb } from './helpers/nodeDb';

const NOW = new Date('2026-11-01T09:00:00Z');

function purchase(over: Partial<StorePurchase> & { productId: string }): StorePurchase {
  return { id: `id-${over.productId}`, purchaseToken: `tok-${over.productId}`, purchaseState: 'purchased', isAcknowledgedAndroid: true, isSuspendedAndroid: false, transactionDate: NOW.getTime(), ...over };
}

function fakeGateway(over: Partial<BillingGateway> = {}): BillingGateway & { finished: { productId: string; consumable: boolean }[] } {
  const finished: { productId: string; consumable: boolean }[] = [];
  return {
    finished,
    initConnection: async () => true,
    endConnection: async () => true,
    fetchProducts: async () => [],
    getAvailablePurchases: async () => [],
    requestPurchase: async () => null,
    finishTransaction: async ({ purchase: p, isConsumable }) => {
      finished.push({ productId: p.productId, consumable: !!isConsumable });
    },
    purchaseUpdatedListener: () => ({ remove: () => {} }),
    purchaseErrorListener: () => ({ remove: () => {} }),
    ...over,
  };
}

describe('billing', () => {
  let close: () => void;
  beforeEach(() => {
    ({ close } = installTestDb());
  });
  afterEach(() => {
    setBillingGateway(null);
    close();
  });

  it('SKUs follow P19 and the Save arithmetic is over the shown prices', () => {
    expect(SUBSCRIPTION_SKU).toBe('shubhvela_pro');
    expect(BASE_PLAN_ID).toEqual({ monthly: 'monthly', yearly: 'yearly' });
    expect(LIFETIME_SKU).toBe('shubhvela_pro_lifetime');
    expect(REPORT_SKU).toEqual({ janam_patri: 'report_janam_patri', matching: 'report_matching', varshaphal: 'report_varshaphal' });
    expect([...IN_APP_SKUS].sort()).toEqual(['report_janam_patri', 'report_matching', 'report_varshaphal', 'shubhvela_pro_lifetime']);
    expect(savingPercent(49, 299)).toBe(49); // 1 - 299 / 588 = 0.4915
    expect(savingPercent(2.99, 19.99)).toBe(44);
    expect(savingPercent(0, 299)).toBe(0);
    expect(monthlyEquivalent(299)).toBe('24.92');
    expect(MANAGE_SUBSCRIPTION_URL).toBe('https://play.google.com/store/account/subscriptions?sku=shubhvela_pro&package=com.shubhvela.app');
    expect(manageSubscriptionUrl()).toBe(MANAGE_SUBSCRIPTION_URL);
  });

  it('catalogFrom maps Play products to plan / report prices and base-plan offer tokens', () => {
    const cat = catalogFrom([
      {
        id: SUBSCRIPTION_SKU,
        type: 'subs',
        displayPrice: '₹49.00',
        currency: 'INR',
        subscriptionOffers: [
          { id: '', basePlanIdAndroid: 'monthly', offerTokenAndroid: 'tok-m', displayPrice: '₹49.00', price: 49, currency: 'INR' },
          { id: '', basePlanIdAndroid: 'yearly', offerTokenAndroid: 'tok-y', displayPrice: '₹299.00', price: 299, currency: 'INR' },
        ],
      },
      { id: LIFETIME_SKU, type: 'in-app', displayPrice: '₹999.00', price: 999, currency: 'INR' },
      { id: 'report_varshaphal', type: 'in-app', displayPrice: '₹149.00', price: 149, currency: 'INR' },
    ]);
    expect(cat.fromStore).toBe(true);
    expect(cat.plans.monthly).toEqual({ displayPrice: '₹49.00', amount: 49, currency: 'INR' });
    expect(cat.plans.yearly?.displayPrice).toBe('₹299.00');
    expect(cat.plans.lifetime?.amount).toBe(999);
    expect(cat.offerTokens).toEqual({ monthly: 'tok-m', yearly: 'tok-y' });
    expect(cat.reports.varshaphal?.displayPrice).toBe('₹149.00');
    expect(cat.reports.janam_patri).toBeNull();
  });

  it('restore: an active subscription -> Pro; Play listing nothing later -> expired (Pro off)', async () => {
    const gw = fakeGateway({ getAvailablePurchases: async () => [purchase({ productId: SUBSCRIPTION_SKU, currentPlanId: 'yearly', isAcknowledgedAndroid: false })] });
    setBillingGateway(gw);
    expect(isPro()).toBe(false);
    const r = await restorePurchases(NOW);
    expect(r).toEqual({ pro: true, reportCredits: 0 });
    expect(isPro()).toBe(true);
    expect(proStatus()).toEqual({ pro: true, product: 'shubhvela_pro', grace: false });
    expect(entitlementRows()).toEqual([{ product: 'shubhvela_pro', token: 'tok-shubhvela_pro', state: 'active', updated_at: NOW.toISOString() }]);
    // Unacknowledged Pro purchases are acknowledged (non-consumable).
    expect(gw.finished).toEqual([{ productId: SUBSCRIPTION_SKU, consumable: false }]);
    // Next restore finds nothing -> expired.
    setBillingGateway(fakeGateway({ getAvailablePurchases: async () => [] }));
    await restorePurchases(NOW);
    expect(isPro()).toBe(false);
    expect(entitlementRows()[0].state).toBe('expired');
  });

  it('grace: a suspended subscription keeps Pro on with the Settings notice; lifetime wins over grace', async () => {
    setBillingGateway(fakeGateway({ getAvailablePurchases: async () => [purchase({ productId: SUBSCRIPTION_SKU, isSuspendedAndroid: true })] }));
    await restorePurchases(NOW);
    expect(isPro()).toBe(true);
    expect(inGracePeriod()).toBe(true);
    expect(proStatus().grace).toBe(true);
    setEntitlement(LIFETIME_SKU, 'active', 'life', NOW);
    expect(proStatus()).toEqual({ pro: true, product: 'shubhvela_pro_lifetime', grace: false });
    expect(inGracePeriod()).toBe(false);
  });

  it('restore consumes unconsumed report purchases into credits exactly once', async () => {
    const gw = fakeGateway({ getAvailablePurchases: async () => [purchase({ productId: 'report_matching', purchaseToken: 'rm-1' }), purchase({ productId: 'report_janam_patri', purchaseToken: 'rj-1' })] });
    setBillingGateway(gw);
    const r = await restorePurchases(NOW);
    expect(r).toEqual({ pro: false, reportCredits: 2 });
    expect(reportCredits('matching')).toBe(1);
    expect(reportCredits('janam_patri')).toBe(1);
    expect(reportCredits('varshaphal')).toBe(0);
    expect(gw.finished).toEqual([
      { productId: 'report_matching', consumable: true },
      { productId: 'report_janam_patri', consumable: true },
    ]);
    // The same tokens again (Play re-delivering) do not duplicate credits.
    await restorePurchases(NOW);
    expect(reportCredits('matching')).toBe(1);
    expect(getDb().getFirstSync<{ n: number }>('SELECT COUNT(*) AS n FROM purchases')?.n).toBe(2);
  });

  it('Play unreachable: restore throws and the cache is untouched; the Restore row says unreachable', async () => {
    setEntitlement(SUBSCRIPTION_SKU, 'active', 'cached', NOW);
    setBillingGateway(
      fakeGateway({
        getAvailablePurchases: async () => {
          throw { code: 'service-disconnected', message: 'Play offline' };
        },
      }),
    );
    await expect(restorePurchases(NOW)).rejects.toBeInstanceOf(BillingFailure);
    expect(isPro()).toBe(true);
    expect(entitlementRows()[0].token).toBe('cached');
    expect(await restoreNow()).toBe('unreachable');
    setBillingGateway(fakeGateway({ initConnection: async () => false }));
    expect(await restoreNow()).toBe('unreachable');
    await expect(loadCatalog()).rejects.toMatchObject({ kind: 'unreachable' });
    expect(isPro()).toBe(true);
  });

  it('Restore row outcomes: restored / nothing', async () => {
    setBillingGateway(fakeGateway({ getAvailablePurchases: async () => [purchase({ productId: LIFETIME_SKU })] }));
    expect(await restoreNow()).toBe('restored');
    expect(proStatus().product).toBe('shubhvela_pro_lifetime');
    setBillingGateway(fakeGateway());
    expect(await restoreNow()).toBe('nothing');
    expect(isPro()).toBe(false);
  });

  it('applyAvailablePurchases: pending purchases are cached as pending (not Pro)', () => {
    applyAvailablePurchases([purchase({ productId: SUBSCRIPTION_SKU, purchaseState: 'pending' })], NOW);
    expect(entitlementRows()[0].state).toBe('pending');
    expect(isPro()).toBe(false);
  });

  it('buyPlan: the purchase result is cached and acknowledged; the yearly offer token is passed', async () => {
    const requests: unknown[] = [];
    const gw = fakeGateway({
      requestPurchase: async (args) => {
        requests.push(args);
        return purchase({ productId: SUBSCRIPTION_SKU, isAcknowledgedAndroid: false, currentPlanId: 'yearly' });
      },
    });
    setBillingGateway(gw);
    const catalog = catalogFrom([{ id: SUBSCRIPTION_SKU, type: 'subs', displayPrice: '₹299.00', currency: 'INR', subscriptionOffers: [{ id: '', basePlanIdAndroid: 'yearly', offerTokenAndroid: 'tok-y', displayPrice: '₹299.00', price: 299 }] }]);
    await buyPlan('yearly', catalog);
    expect(requests[0]).toEqual({ type: 'subs', request: { google: { skus: [SUBSCRIPTION_SKU], subscriptionOffers: [{ sku: SUBSCRIPTION_SKU, offerToken: 'tok-y' }] } } });
    expect(isPro()).toBe(true);
    expect(gw.finished).toEqual([{ productId: SUBSCRIPTION_SKU, consumable: false }]);
    await buyPlan('lifetime', catalog);
    expect(requests[1]).toEqual({ type: 'in-app', request: { google: { skus: [LIFETIME_SKU] } } });
  });

  it('buyPlan failures map to inline kinds and never touch the cache', async () => {
    for (const [code, kind] of [
      ['user-cancelled', 'cancelled'],
      ['network-error', 'network'],
      ['item-unavailable', 'unavailable'],
      ['already-owned', 'alreadyOwned'],
      ['developer-error', 'failed'],
    ] as const) {
      setBillingGateway(
        fakeGateway({
          requestPurchase: async () => {
            throw { code, message: `Play: ${code}` };
          },
        }),
      );
      await expect(buyPlan('monthly', catalogFrom([]))).rejects.toMatchObject({ kind, storeMessage: `Play: ${code}` });
      expect(entitlementRows()).toEqual([]);
      expect(isPro()).toBe(false);
    }
    expect(toBillingFailure(new Error('x')).kind).toBe('failed');
  });

  it('buyReport: the consumable is consumed into a credit; M2 says which reports Pro includes', async () => {
    const gw = fakeGateway({ requestPurchase: async () => purchase({ productId: 'report_varshaphal', purchaseToken: 'rv-1' }) });
    setBillingGateway(gw);
    await buyReport('varshaphal');
    expect(reportCredits('varshaphal')).toBe(1);
    expect(gw.finished).toEqual([{ productId: 'report_varshaphal', consumable: true }]);
    expect(reportIncluded('janam_patri')).toBe(false);
    expect(reportIncluded('matching')).toBe(false);
    expect(reportIncluded('varshaphal')).toBe(false);
    setEntitlement(SUBSCRIPTION_SKU, 'active', 't', NOW);
    expect(reportIncluded('janam_patri')).toBe(true);
    expect(reportIncluded('matching')).toBe(true);
    expect(reportIncluded('varshaphal')).toBe(false); // ₹149 on both tiers
  });

  it('Manage opens the Play subscription centre deep link', async () => {
    const open = jest.fn(async () => true);
    expect(await openManageSubscription(open)).toBe(true);
    expect(open).toHaveBeenCalledWith(MANAGE_SUBSCRIPTION_URL);
    expect(
      await openManageSubscription(async () => {
        throw new Error('no handler');
      }),
    ).toBe(false);
  });
});
