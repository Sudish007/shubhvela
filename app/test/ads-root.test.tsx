// AdsRoot (design.md 5, M10): Pro -> mobileAds().initialize() is NEVER called (the AppLovin adapter therefore never
// starts); free -> UMP consent first, then initialize; consent failure or "cannot request ads" -> no initialisation.
// The mounted component counts the cold-start session and restores the Play entitlement before deciding.
import { act, render } from '@testing-library/react-native';
import mobileAds, { AdsConsent } from 'react-native-google-mobile-ads';
import { AdsRoot, initAds, isAdsInitialized, resetAdsRootForTests } from '../src/ads/AdsRoot';
import { resetAdPolicyForTests, sessionCount } from '../src/ads/AdPolicy';
import { setEntitlement } from '../src/entitlements';
import { installTestDb } from './helpers/nodeDb';

const initialize = mobileAds().initialize as jest.Mock;
const gather = AdsConsent.gatherConsent as jest.Mock;

describe('AdsRoot', () => {
  let close: () => void;
  beforeEach(() => {
    ({ close } = installTestDb());
    resetAdPolicyForTests();
    resetAdsRootForTests();
    initialize.mockClear();
    gather.mockClear();
  });
  afterEach(() => close());

  it('Pro: initialize() is never called and no consent form is requested', async () => {
    setEntitlement('shubhvela_pro', 'active', 'tok');
    expect(await initAds()).toBe(false);
    expect(gather).not.toHaveBeenCalled();
    expect(initialize).not.toHaveBeenCalled();
    expect(isAdsInitialized()).toBe(false);
    // Grace counts as Pro too.
    setEntitlement('shubhvela_pro', 'grace', 'tok');
    expect(await initAds()).toBe(false);
    expect(initialize).not.toHaveBeenCalled();
  });

  it('free: UMP consent runs before initialize()', async () => {
    const calls: string[] = [];
    const sdk = {
      gatherConsent: jest.fn(async () => {
        calls.push('consent');
        return { canRequestAds: true };
      }),
      initialize: jest.fn(async () => {
        calls.push('init');
        return [];
      }),
    };
    expect(await initAds(sdk)).toBe(true);
    expect(calls).toEqual(['consent', 'init']);
    expect(isAdsInitialized()).toBe(true);
  });

  it('free but consent says ads cannot be requested, or UMP fails: no initialisation', async () => {
    expect(await initAds({ gatherConsent: async () => ({ canRequestAds: false }), initialize: jest.fn() })).toBe(false);
    expect(
      await initAds({
        gatherConsent: async () => {
          throw new Error('offline');
        },
        initialize: jest.fn(),
      }),
    ).toBe(false);
    expect(isAdsInitialized()).toBe(false);
  });

  it('mounted: counts the cold-start session, restores first, then initialises for a free user (real mock SDK)', async () => {
    const restore = jest.fn(async () => null);
    await act(async () => {
      render(<AdsRoot restore={restore} />);
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(sessionCount()).toBe(1);
    expect(restore).toHaveBeenCalledTimes(1);
    expect(gather).toHaveBeenCalledTimes(1);
    expect(initialize).toHaveBeenCalledTimes(1);
  });

  it('mounted for a Pro user: the restore runs, the SDK does not', async () => {
    setEntitlement('shubhvela_pro_lifetime', 'active', 'tok');
    const restore = jest.fn(async () => null);
    await act(async () => {
      render(<AdsRoot restore={restore} />);
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(restore).toHaveBeenCalledTimes(1);
    expect(gather).not.toHaveBeenCalled();
    expect(initialize).not.toHaveBeenCalled();
  });
});
