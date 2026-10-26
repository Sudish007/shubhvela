// AdPolicy state machine (design.md 5 / 12; M4, M5, M6, M12, M14): session definition and persistence, sessions 1-3 ->
// no banner and no interstitial, allow-list exact, forbidden routes -> none, one interstitial per session, 45 s spacing
// across ad kinds, rewarded unlock 24 h, Pro -> none everywhere, the M4 fold gate over 4 intents x 3 widths x 2 scales,
// the M6 strip height (measured + 32) reaching Screen's padding formula.
import {
  BANNER_ROUTES,
  FIRST_AD_SESSION,
  INTERSTITIAL_TRIGGERS,
  MIN_AD_SPACING_MS,
  REWARDED_KEYS,
  SESSION_GAP_MS,
  bannerFor,
  bannerHeightFor,
  beginSession,
  interstitialDecision,
  maybeShowInterstitial,
  nativeMountAllowed,
  noteBackground,
  noteForeground,
  placementAllowed,
  recordAdShown,
  reportBannerFailed,
  reportBannerLoaded,
  resetAdPolicyForTests,
  sessionCount,
  stripHeight,
  todayCardOrder,
  todayNativeSlot,
  unlock,
  type InterstitialTrigger,
} from '../src/ads/AdPolicy';
import { TEST_UNIT_IDS, resolveUnitIds } from '../src/ads/config';
import { screenBottomPadding } from '../src/components';
import { getAppState } from '../src/db/appState';
import { canSeeFeature, setEntitlement, unlockedUntil } from '../src/entitlements';
import { size } from '../src/theme/tokens';
import { installTestDb } from './helpers/nodeDb';

const T0 = Date.UTC(2026, 10, 1, 9, 0, 0);

function reachSession(n: number): void {
  while (sessionCount() < n) beginSession();
}

describe('AdPolicy', () => {
  let close: () => void;
  beforeEach(() => {
    ({ close } = installTestDb());
    resetAdPolicyForTests();
  });
  afterEach(() => {
    resetAdPolicyForTests();
    close();
  });

  describe('sessions', () => {
    it('cold start = one session, persisted in app_state', () => {
      expect(sessionCount()).toBe(0);
      expect(beginSession()).toBe(1);
      expect(getAppState('sessions')).toBe('1');
      beginSession();
      expect(sessionCount()).toBe(2);
    });

    it('foreground return counts as a session only after >= 30 min in background', () => {
      beginSession();
      noteBackground(T0);
      expect(noteForeground(T0 + SESSION_GAP_MS - 1)).toBe(false);
      expect(sessionCount()).toBe(1);
      noteBackground(T0);
      expect(noteForeground(T0 + SESSION_GAP_MS)).toBe(true);
      expect(sessionCount()).toBe(2);
      // No background noted -> no new session.
      expect(noteForeground(T0 + 10 * SESSION_GAP_MS)).toBe(false);
    });
  });

  describe('banner (M5)', () => {
    it('the allow-list is exactly the twelve M5 routes', () => {
      expect([...BANNER_ROUTES].sort()).toEqual(['Ashtakavarga', 'Calendar', 'Charts', 'Family', 'FestivalDetail', 'FullDashaTree', 'GlossaryList', 'KP', 'LearnRoot', 'MatchingResults', 'MuhuratFinder', 'VratDetail']);
    });

    it('sessions 1-3 -> none on every route; session 4 -> anchored on allow-listed routes only', () => {
      for (let s = 1; s < FIRST_AD_SESSION; s++) {
        beginSession();
        for (const r of BANNER_ROUTES) expect(bannerFor(r)).toBe('none');
      }
      beginSession();
      expect(sessionCount()).toBe(4);
      for (const r of BANNER_ROUTES) expect(bannerFor(r)).toBe('anchored');
      for (const r of ['Today', 'Pro', 'PdfPreview', 'SharePreview', 'LessonReader', 'Journal', 'Onboarding', 'Settings', 'SettingsPro', 'Sheet', '', 'charts']) expect(bannerFor(r)).toBe('none');
      expect(placementAllowed('banner', 'Charts')).toBe(true);
      expect(placementAllowed('banner', 'Today')).toBe(false);
    });

    it('no fill removes the strip for the session; a new session tries again', () => {
      reachSession(4);
      reportBannerFailed('Charts');
      expect(bannerFor('Charts')).toBe('none');
      expect(bannerFor('Family')).toBe('anchored');
      beginSession();
      expect(bannerFor('Charts')).toBe('anchored');
    });

    it('M6: strip height = measured banner + 32 and reaches Screen padding; no banner -> no strip', () => {
      reachSession(4);
      expect(bannerHeightFor('Charts')).toBeNull();
      expect(stripHeight('Charts')).toBeNull();
      reportBannerLoaded('Charts', 50, T0);
      expect(bannerHeightFor('Charts')).toBe(50);
      expect(stripHeight('Charts')).toBe(50 + 2 * size.bannerPadding);
      expect(screenBottomPadding({ chrome: 'tabs', bannerHeight: bannerHeightFor('Charts'), ctaHeight: null, insetBottom: 34 })).toBe(72 + 82 + 16 + 34);
      // Pushed allow-listed screens (no tab bar) pad for the strip alone.
      reportBannerLoaded('FestivalDetail', 60, T0);
      expect(screenBottomPadding({ chrome: 'stack', bannerHeight: bannerHeightFor('FestivalDetail'), ctaHeight: null, insetBottom: 34 })).toBe(60 + 32 + 16 + 34);
      // A route without a banner contributes 0 even after another route measured.
      expect(bannerHeightFor('Today')).toBeNull();
      expect(screenBottomPadding({ chrome: 'tabs', bannerHeight: bannerHeightFor('Today'), ctaHeight: null, insetBottom: 34 })).toBe(72 + 16 + 34);
      reportBannerFailed('Charts');
      expect(bannerHeightFor('Charts')).toBeNull();
    });

    it('the banner strip is measured, never a fixed 82', () => {
      expect(size).not.toHaveProperty('bannerStrip');
      expect(size.bannerPadding).toBe(16);
    });
  });

  describe('interstitial (M12)', () => {
    const trigger: InterstitialTrigger = 'muhuratSearchCompleted';

    it('only the three forward triggers exist', () => {
      expect([...INTERSTITIAL_TRIGGERS].sort()).toEqual(['muhuratSearchCompleted', 'reportDone', 'sharePreviewClosedAfterShare']);
      expect(interstitialDecision('back' as InterstitialTrigger, T0)).toEqual({ show: false, reason: 'badTrigger' });
    });

    it('never in sessions 1-3', () => {
      for (let s = 1; s < FIRST_AD_SESSION; s++) {
        beginSession();
        for (const tr of INTERSTITIAL_TRIGGERS) expect(maybeShowInterstitial(tr, T0)).toBe(false);
        expect(interstitialDecision(trigger, T0).reason).toBe('earlySession');
      }
    });

    it('one per session, then the next session opens one slot again', () => {
      reachSession(4);
      expect(maybeShowInterstitial(trigger, T0)).toBe(true);
      expect(maybeShowInterstitial('reportDone', T0 + 10 * MIN_AD_SPACING_MS)).toBe(false);
      expect(interstitialDecision('reportDone', T0 + 10 * MIN_AD_SPACING_MS).reason).toBe('oncePerSession');
      beginSession();
      expect(maybeShowInterstitial('reportDone', T0 + 20 * MIN_AD_SPACING_MS)).toBe(true);
    });

    it('>= 45 s since the last ad of ANY kind (banner, native, rewarded all count)', () => {
      reachSession(4);
      recordAdShown('banner', T0);
      expect(interstitialDecision(trigger, T0 + MIN_AD_SPACING_MS - 1)).toEqual({ show: false, reason: 'spacing' });
      expect(interstitialDecision(trigger, T0 + MIN_AD_SPACING_MS).show).toBe(true);
      recordAdShown('native', T0 + 60_000);
      expect(interstitialDecision(trigger, T0 + 60_000 + 44_999).reason).toBe('spacing');
      expect(getAppState('last_ad_at')).toBe(String(T0 + 60_000));
      // Showing books the clock too.
      expect(maybeShowInterstitial(trigger, T0 + 60_000 + MIN_AD_SPACING_MS)).toBe(true);
      expect(getAppState('last_ad_at')).toBe(String(T0 + 60_000 + MIN_AD_SPACING_MS));
    });
  });

  describe('rewarded (M14)', () => {
    it('five keys; unlock writes unlocks(feature, now + 24 h) and books the spacing clock', () => {
      expect([...REWARDED_KEYS]).toEqual(['vargas', 'kp', 'ashtakavarga', 'prashna', 'varshaphal']);
      reachSession(4);
      const now = new Date(T0);
      const expires = unlock('ashtakavarga', now);
      expect(expires.getTime()).toBe(T0 + 24 * 3600_000);
      expect(unlockedUntil('ashtakavarga', now)?.toISOString()).toBe(expires.toISOString());
      expect(canSeeFeature('ashtakavarga', new Date(T0 + 23 * 3600_000)).allowed).toBe(true);
      expect(canSeeFeature('ashtakavarga', new Date(T0 + 24 * 3600_000)).allowed).toBe(false);
      // One ad unlocks exactly one key.
      expect(canSeeFeature('kp', now).allowed).toBe(false);
      expect(interstitialDecision('reportDone', T0 + 1000).reason).toBe('spacing');
    });
  });

  describe('Pro -> none everywhere', () => {
    it('banner, native, interstitial and rewarded all answer none/false for a Pro user', () => {
      reachSession(10);
      setEntitlement('shubhvela_pro', 'active', 'tok', new Date(T0));
      for (const r of BANNER_ROUTES) expect(bannerFor(r)).toBe('none');
      expect(todayNativeSlot(5)).toEqual({ kind: 'none' });
      for (const tr of INTERSTITIAL_TRIGGERS) expect(maybeShowInterstitial(tr, T0 + 1e9)).toBe(false);
      expect(interstitialDecision('reportDone', T0 + 1e9).reason).toBe('pro');
      for (const p of ['banner', 'native', 'interstitial', 'rewarded'] as const) expect(placementAllowed(p, p === 'native' ? 'Today' : 'Charts')).toBe(false);
      // Grace keeps Pro (and keeps ads off).
      setEntitlement('shubhvela_pro', 'grace', 'tok', new Date(T0));
      expect(bannerFor('Charts')).toBe('none');
      // Expired -> free again.
      setEntitlement('shubhvela_pro', 'expired', 'tok', new Date(T0));
      expect(bannerFor('Charts')).toBe('anchored');
      reportBannerLoaded('Charts', 50, T0);
      expect(bannerHeightFor('Charts')).toBe(50);
      setEntitlement('shubhvela_pro_lifetime', 'active', 'tok2', new Date(T0));
      expect(bannerHeightFor('Charts')).toBeNull();
    });
  });

  describe('Today native card (M4)', () => {
    const intents = ['marriage', 'career', 'familyDates', 'learn'] as const;
    const widths = [360, 390, 412] as const;
    const scales = [1.0, 1.3] as const;
    /** Window heights of the Phase A/B audit devices at those widths (dp). */
    const heightFor: Record<number, number> = { 360: 800, 390: 844, 412: 915 };

    it('the ad is the LAST card for every intent, and the slot index equals the content length', () => {
      for (const intent of intents) {
        const order = todayCardOrder(intent);
        expect(order[order.length - 1]).toBe('nativeAd');
        expect(order.filter((k) => k === 'nativeAd')).toHaveLength(1);
        const slot = todayNativeSlot(order.length - 1);
        expect(slot.kind).toBe('native');
        if (slot.kind === 'native') {
          expect(slot.index).toBe(order.length - 1);
          expect(slot.unitId).toBe(TEST_UNIT_IDS.native);
        }
      }
      expect(todayCardOrder('familyDates').indexOf('upcoming')).toBeLessThan(todayCardOrder('familyDates').indexOf('dailyNote'));
      expect(todayCardOrder('marriage').indexOf('upcoming')).toBeGreaterThan(todayCardOrder('marriage').indexOf('dailyNote'));
      expect(todayCardOrder(null)).toEqual(todayCardOrder('marriage'));
    });

    it('the mount gate requires onLayout.y >= windowHeight at 360/390/412 x 1.0/1.3 for every intent', () => {
      // Nominal card heights at 1.0x (dp) for the simulation; text-driven cards grow with the font scale, gaps are 12.
      const nominal: Record<string, number> = { header: 140, goodHours: 320, tithiToday: 56, vratToday: 140, upcoming: 120, dailyNote: 260 };
      for (const intent of intents) {
        for (const w of widths) {
          for (const scale of scales) {
            const h = heightFor[w];
            for (const vratToday of [false, true]) {
              const order = todayCardOrder(intent);
              let y = nominal.header * scale;
              for (const key of order) {
                if (key === 'nativeAd') break;
                if (key === 'vratToday' && !vratToday) continue;
                y += nominal[key] * scale + 12;
              }
              // The ad index is last (checked above); the gate decides from the measured y alone.
              expect(nativeMountAllowed(y, h)).toBe(y >= h);
              // With the whole stack rendered the slot sits below the fold on every device at 1.0x (design.md 5).
              if (scale === 1.0) expect(y).toBeGreaterThanOrEqual(h);
            }
            expect(nativeMountAllowed(h - 1, h)).toBe(false);
            expect(nativeMountAllowed(h, h)).toBe(true);
          }
        }
      }
      expect(nativeMountAllowed(Number.NaN, 844)).toBe(false);
    });
  });

  describe('unit ids', () => {
    it('Google test units by default; real ids only when live is true and complete', () => {
      expect(resolveUnitIds(undefined)).toEqual(TEST_UNIT_IDS);
      expect(resolveUnitIds({ live: false, units: { banner: 'x', native: 'x', interstitial: 'x', rewarded: 'x' } })).toEqual(TEST_UNIT_IDS);
      expect(resolveUnitIds({ live: true, units: { banner: 'x' } })).toEqual(TEST_UNIT_IDS);
      expect(resolveUnitIds({ live: true, units: { banner: 'b', native: 'n', interstitial: 'i', rewarded: 'r' } })).toEqual({ banner: 'b', native: 'n', interstitial: 'i', rewarded: 'r' });
      expect(TEST_UNIT_IDS).toEqual({
        banner: 'ca-app-pub-3940256099942544/6300978111',
        native: 'ca-app-pub-3940256099942544/2247696110',
        interstitial: 'ca-app-pub-3940256099942544/1033173712',
        rewarded: 'ca-app-pub-3940256099942544/5224354917',
      });
    });
  });
});
