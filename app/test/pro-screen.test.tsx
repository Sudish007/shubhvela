// Pro screen (design.md 5 / pro.html; spec section 9; M2): lede, three radio plan cards with yearly preselected and
// "Save 49%" computed from the shown prices (1 - 299 / (49 x 12)), the restore caption, the 12-row matrix, the one-time
// report rows with the M2 wording, Restore / Manage, the disclaimer, the sticky CTA with the Screen padding rule, no
// banner / testimonials / counts / timers / "most popular". Prices under Jest are the spec INR fallback (Play mocked
// away) and say so. Settings -> Pro and purchases shows the grace notice and the rows. CapSheet now navigates to /pro.
import { fireEvent, screen } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';
import ProScreen, { planPrices, savingFor } from '../app/pro';
import SettingsScreen from '../app/settings/index';
import SettingsProScreen from '../app/settings/pro';
import { resetAdPolicyForTests, beginSession } from '../src/ads/AdPolicy';
import { EMPTY_CATALOG, catalogFrom } from '../src/billing/iap';
import { CapSheet } from '../src/components';
import { setEntitlement } from '../src/entitlements';
import { installTestDb } from './helpers/nodeDb';
import { TEST_INSETS, allTexts, renderWithProviders, textOf } from './helpers/render';

function contentPadding(): number {
  return StyleSheet.flatten(screen.getByTestId('screen-scroll').props.contentContainerStyle).paddingBottom as number;
}

describe('<ProScreen>', () => {
  let close: () => void;
  beforeEach(() => {
    ({ close } = installTestDb());
    resetAdPolicyForTests();
    (useRouter().push as jest.Mock).mockClear();
  });
  afterEach(() => {
    globalThis.__PSEUDO_LOCALE__ = undefined;
    close();
  });

  it('"Save 49%" is arithmetic over the shown prices, in both the fallback and a Play catalog', () => {
    const fallback = planPrices(EMPTY_CATALOG);
    expect(fallback.monthly).toEqual({ label: '₹49', fallback: true });
    expect(fallback.yearly).toEqual({ label: '₹299', fallback: true });
    expect(fallback.lifetime).toEqual({ label: '₹999', fallback: true });
    expect(savingFor(fallback)).toBe(Math.round((1 - 299 / (49 * 12)) * 100));
    expect(savingFor(fallback)).toBe(49);
    const store = planPrices(
      catalogFrom([
        {
          id: 'shubhvela_pro',
          type: 'subs',
          displayPrice: '$2.99',
          currency: 'USD',
          subscriptionOffers: [
            { id: '', basePlanIdAndroid: 'monthly', offerTokenAndroid: 'm', displayPrice: '$2.99', price: 2.99 },
            { id: '', basePlanIdAndroid: 'yearly', offerTokenAndroid: 'y', displayPrice: '$19.99', price: 19.99 },
          ],
        },
      ]),
    );
    expect(store.monthly).toEqual({ label: '$2.99', fallback: false });
    expect(savingFor(store)).toBe(Math.round((1 - 19.99 / (2.99 * 12)) * 100));
    // Mixed sources (one Play price, one fallback) never produce a saving.
    const mixed = planPrices(catalogFrom([{ id: 'shubhvela_pro_lifetime', type: 'in-app', displayPrice: '$49.99', price: 49.99, currency: 'USD' }]));
    expect(mixed.lifetime.fallback).toBe(false);
    expect(savingFor(mixed)).toBe(49); // both subscription prices are still the fallback pair
  });

  it('renders the design.md 5 structure: lede, radio cards (yearly preselected, Save 49%), matrix, reports, rows, disclaimer, CTA', async () => {
    await renderWithProviders(<ProScreen />);
    expect(screen.getByRole('header', { name: 'Shubhvela Pro' })).toBeTruthy();
    expect(textOf(screen.getByTestId('pro-lede'))).toMatch(/^No ads\./);
    // Radio group with three radios; yearly checked.
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(3);
    expect(screen.getByTestId('plan-yearly').props.accessibilityState).toMatchObject({ selected: true, checked: true });
    expect(screen.getByTestId('plan-monthly').props.accessibilityState).toMatchObject({ selected: false, checked: false });
    expect(screen.getByText('Save 49%')).toBeTruthy();
    expect(screen.getByText('24.92 per month, billed yearly', { exact: false })).toBeTruthy();
    expect(screen.getByText('₹49')).toBeTruthy();
    expect(screen.getByText('₹299')).toBeTruthy();
    expect(screen.getByText('₹999')).toBeTruthy();
    // Fallback prices say so (Play is mocked away under Jest).
    expect(textOf(screen.getByTestId('pro-prices-note'))).toContain('store price may differ');
    expect(textOf(screen.getByTestId('pro-prices-note'))).toContain('same Google account');
    // Matrix: 12 rows from spec section 9, three columns.
    for (let i = 1; i <= 12; i++) expect(screen.getByTestId(`matrix-row-${i}`)).toBeTruthy();
    expect(screen.getByText('Profiles')).toBeTruthy();
    expect(screen.getAllByText('unlimited')).toHaveLength(2); // profiles + reminders
    expect(screen.getByText('24-h rewarded unlock')).toBeTruthy();
    expect(screen.getAllByLabelText('included').length).toBeGreaterThanOrEqual(8);
    expect(screen.getAllByLabelText('not included')).toHaveLength(1);
    // One-time reports with contents and the M2 wording.
    expect(screen.getAllByText('Janam Patri PDF')).toHaveLength(2); // matrix row 11 + the one-time report row
    expect(screen.getByText('Matching report PDF')).toBeTruthy();
    expect(screen.getByText('Varshaphal report PDF')).toBeTruthy();
    expect(textOf(screen.getByTestId('report-caption-janam_patri'))).toMatch(/^₹99 · included in Pro/);
    expect(textOf(screen.getByTestId('report-caption-matching'))).toMatch(/^₹99 · included in Pro/);
    expect(textOf(screen.getByTestId('report-caption-varshaphal'))).toMatch(/^₹149 in Free and Pro/);
    expect(screen.getByText('Solar-return chart, Muntha, year lord, Mudda dasha months, transit calendar')).toBeTruthy();
    // Restore / Manage, disclaimer.
    expect(screen.getByTestId('pro-restore')).toBeTruthy();
    expect(screen.getByTestId('pro-manage')).toBeTruthy();
    expect(textOf(screen.getByTestId('pro-disclaimer'))).toMatch(/not medical, legal or financial advice/);
    // Sticky CTA with the recurring caption and a 44 dp Terms link.
    expect(textOf(screen.getByTestId('pro-cta'))).toBe('Continue · ₹299 per year');
    expect(textOf(screen.getByTestId('pro-cta-caption'))).toBe('Recurring. Cancel in Play → Subscriptions.');
    const terms = screen.getByTestId('pro-terms');
    expect(StyleSheet.flatten(terms.props.style).minHeight).toBeGreaterThanOrEqual(44);
    // HARD NO list: no testimonials, counts, timers or "most popular"; no banner strip.
    const all = allTexts().map(textOf).join('\n');
    expect(all).not.toMatch(/most popular|testimonial|users|rating|hurry|ends in|left/i);
    expect(screen.queryByTestId('banner-strip')).toBeNull();
    expect(screen.queryByTestId('mock-banner-ad')).toBeNull();
  });

  it('selecting a plan switches the CTA label and caption; lifetime says "One payment"', async () => {
    await renderWithProviders(<ProScreen />);
    await fireEvent.press(screen.getByTestId('plan-monthly'));
    expect(screen.getByTestId('plan-monthly').props.accessibilityState.checked).toBe(true);
    expect(screen.getByTestId('plan-yearly').props.accessibilityState.checked).toBe(false);
    expect(textOf(screen.getByTestId('pro-cta'))).toBe('Continue · ₹49 per month');
    await fireEvent.press(screen.getByTestId('plan-lifetime'));
    expect(textOf(screen.getByTestId('pro-cta'))).toBe('Continue · ₹999 once');
    expect(textOf(screen.getByTestId('pro-cta-caption'))).toBe('One payment, no renewal.');
  });

  it('scroll padding = measured CTA height + 16 + inset (sticky CTA rule), even after a banner session starts', async () => {
    for (let i = 0; i < 5; i++) beginSession();
    await renderWithProviders(<ProScreen />);
    await fireEvent.layout(screen.getByTestId('screen-cta'), { x: 0, y: 0, width: 390, height: 120 });
    expect(contentPadding()).toBe(120 + 16 + TEST_INSETS.bottom);
    expect(screen.queryByTestId('banner-strip')).toBeNull();
  });

  it('Continue without Play products shows Play\'s message inline and leaves the entitlement unchanged', async () => {
    await renderWithProviders(<ProScreen />);
    await fireEvent.press(screen.getByTestId('pro-cta'));
    expect(await screen.findByText("This item isn't available in Play yet")).toBeTruthy();
    expect(screen.queryByTestId('pro-status')).toBeNull();
  });

  it('Pro user: status replaces the CTA, included reports read "included in Pro", Varshaphal keeps its price', async () => {
    setEntitlement('shubhvela_pro', 'active', 'tok');
    await renderWithProviders(<ProScreen />);
    expect(screen.getByTestId('pro-status')).toBeTruthy();
    expect(screen.getByText('Pro is active')).toBeTruthy();
    expect(screen.queryByTestId('pro-cta')).toBeNull();
    expect(screen.getByTestId('report-included-janam_patri')).toBeTruthy();
    expect(screen.getByTestId('report-included-matching')).toBeTruthy();
    expect(screen.queryByTestId('report-included-varshaphal')).toBeNull();
    expect(screen.getByTestId('report-buy-varshaphal')).toBeTruthy();
  });

  it('Restore row reports "no previous purchase" under the mocked Play; the Manage row exists', async () => {
    await renderWithProviders(<ProScreen />);
    await fireEvent.press(screen.getByTestId('pro-restore'));
    expect(await screen.findByText('No previous purchase found for this Google account')).toBeTruthy();
  });

  for (const lang of ['en', 'hi', 'bho'] as const) {
    it(`pseudo-locale +30 % (${lang}): nothing truncates`, async () => {
      globalThis.__PSEUDO_LOCALE__ = true;
      await renderWithProviders(<ProScreen />, { lang });
      for (const tx of allTexts()) expect(tx.props.numberOfLines).toBeUndefined();
      expect(allTexts().length).toBeGreaterThan(50);
    });
  }
});

describe('Settings -> Pro and purchases', () => {
  let close: () => void;
  beforeEach(() => {
    ({ close } = installTestDb());
    (useRouter().push as jest.Mock).mockClear();
  });
  afterEach(() => close());

  it('Settings lists "Pro and purchases" first and shows the grace notice as its caption', async () => {
    await renderWithProviders(<SettingsScreen />);
    await fireEvent.press(screen.getByTestId('settings-pro'));
    expect(useRouter().push).toHaveBeenCalledWith('/settings/pro');
    setEntitlement('shubhvela_pro', 'grace', 'tok');
    await renderWithProviders(<SettingsScreen />);
    expect(screen.getAllByText('Payment issue — update your card in Play').length).toBeGreaterThanOrEqual(1);
  });

  it('the Pro settings screen shows plans, Restore, Manage, the reports and the grace notice', async () => {
    setEntitlement('shubhvela_pro', 'grace', 'tok');
    await renderWithProviders(<SettingsProScreen />);
    expect(screen.getByTestId('pro-status')).toBeTruthy();
    expect(screen.getAllByText('Payment issue — update your card in Play').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByTestId('pro-restore')).toBeTruthy();
    expect(screen.getByTestId('pro-manage')).toBeTruthy();
    expect(screen.getByTestId('report-rows')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('settings-pro-plans'));
    expect(useRouter().push).toHaveBeenCalledWith('/pro');
  });
});

describe('<CapSheet>', () => {
  let close: () => void;
  beforeEach(() => {
    ({ close } = installTestDb());
    (useRouter().push as jest.Mock).mockClear();
  });
  afterEach(() => close());

  it('every refusal offers "Go Pro" -> /pro and "Not now"; the Phase A "later build" wording is gone', async () => {
    const onClose = jest.fn();
    await renderWithProviders(<CapSheet visible onClose={onClose} reason="pro_feature" />);
    expect(screen.getByText('This is a Pro feature')).toBeTruthy();
    expect(screen.queryByText(/later build|not in this build/)).toBeNull();
    await fireEvent.press(screen.getByTestId('cap-go-pro'));
    expect(onClose).toHaveBeenCalled();
    expect(useRouter().push).toHaveBeenCalledWith('/pro');
    await renderWithProviders(<CapSheet visible onClose={onClose} reason="pro_profiles" />);
    expect(screen.getByText('Free plan: two profiles')).toBeTruthy();
    expect(screen.getByText('The free plan keeps two profiles. Pro removes the limit.')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('cap-not-now'));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
