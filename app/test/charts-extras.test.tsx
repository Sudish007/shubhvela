// Phase B charts extras (FEAT-B04): the "14 more vargas" chip + sheet gated by entitlements (14 entries; locked rows +
// unlock block on free, radios after an unlock / on Pro); the unlock flow writes `unlocks` and the chip reads "till
// <time> tomorrow"; a chosen varga swaps the hero through the same Chart component; the no-fill rewarded ad reports
// honestly; Ashtakavarga (BAV 8 x 12 grid, SAV 12 bars summing to 337) and KP (12 cusps, planets, significators,
// ruling planets for now) screens behind their keys; the Yogas card (N found, formed/cancelled tags, Why?); Varshaphal
// row -> card 30 days before the solar return -> summary screen (chart, Muntha, year lord); dasha alerts Pro-only and
// default Off in the planner, on the card and in Settings; Timing and documents rows gated by the route flags; +30 %
// pseudo-locale snapshots of the vargas sheet and the KP table (no truncation).
import { act, fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { PixelRatio } from 'react-native';
import { DAY_MS, LOCKED_VARGA_IDS } from '@shubhvela/engine';
import ChartsScreen from '../app/(tabs)/charts';
import AshtakavargaScreen from '../app/charts/ashtakavarga';
import KpScreen from '../app/charts/kp';
import VargasScreen from '../app/charts/vargas';
import VarshaphalScreen from '../app/charts/varshaphal';
import NotificationsScreen from '../app/settings/notifications';
import { resetAdPolicyForTests, unlock } from '../src/ads/AdPolicy';
import { TimingDocumentsCard } from '../src/charts/TimingDocumentsCard';
import { VargaSheet } from '../src/charts/VargaSheet';
import { chipTillText, featureAccess, isTomorrow, rowStateText, unlockedTillText } from '../src/charts/unlockState';
import { varshaphalPromoted } from '../src/charts/varshaphalModel';
import { yogaRows } from '../src/charts/YogasCard';
import { getProfile, insertProfile } from '../src/db/profiles';
import { getDashaAlertsEnabled, getYearBeginsEnabled, setDashaAlertsEnabled, setYearBeginsEnabled } from '../src/db/reminderSettings';
import { listScheduledDetailed } from '../src/db/scheduled';
import { SAMPLE_PRIYA } from '../src/dev/seed';
import { grantUnlock, setEntitlement, unlockedUntil } from '../src/entitlements';
import { ashtakavargaFor, chartFor, clearChartCache, dashaFor, kpFor, nextSolarReturn, varshaphalFor, vedicYearAt, yogasFor } from '../src/engine-bridge/charts';
import { makeT } from '../src/i18n';
import { planDashaChanges, planNotifications, planYearBegins } from '../src/notifications/planner';
import { applyPlan, plannerInputFromDb, type ScheduleDeps } from '../src/notifications/schedule';
import { installTestDb } from './helpers/nodeDb';
import { allTexts, renderWithProviders, textOf } from './helpers/render';

const NOW = Date.UTC(2026, 9, 22, 5, 28); // Thu 22 Oct 2026 10:58 IST
const now = () => NOW;
const TZ = 'Asia/Kolkata';
const t = makeT('en');

function assertNoTruncation() {
  for (const tx of allTexts()) expect(tx.props.numberOfLines).toBeUndefined();
}

/** Pro via the entitlement cache (billing's only write path); wrapped in act because mounted screens subscribe. */
async function goPro(): Promise<void> {
  await act(async () => {
    setEntitlement('shubhvela_pro', 'active', 'tok', new Date(NOW));
  });
}

const fakeDeps: ScheduleDeps = { async ensureChannel() {}, async cancelAll() {}, async schedule(n) { return `id-${n.key}-${n.fireAtMs}`; } };

describe('B04 charts extras', () => {
  let close: () => void;
  let priyaId: number;
  const priya = () => getProfile(priyaId)!;
  beforeEach(() => {
    jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(1);
    ({ close } = installTestDb());
    clearChartCache();
    resetAdPolicyForTests();
    (router.push as jest.Mock).mockClear();
    priyaId = insertProfile(SAMPLE_PRIYA, new Date(NOW));
  });
  afterEach(() => {
    globalThis.__PSEUDO_LOCALE__ = undefined;
    close();
  });

  // ---- F12: vargas chip + sheet + unlock ----

  it('the vargas sheet lists the 14 locked vargas (D9 stays a row chip) and gates by entitlements: free = unlock block, no radios', async () => {
    await renderWithProviders(<ChartsScreen now={now} chartWidth={326} />);
    expect(screen.getByTestId('chip-D9')).toBeTruthy();
    const chip = screen.getByTestId('chip-vargas');
    expect(textOf(chip)).toBe('14 more vargas');
    expect(chip.props.accessibilityLabel).toBe('14 more vargas, locked');
    await fireEvent.press(chip);
    expect(screen.getByRole('header', { name: 'Divisional charts' })).toBeTruthy();
    expect(screen.getAllByTestId(/^varga-D\d+$/).length).toBe(14);
    for (const id of LOCKED_VARGA_IDS) expect(screen.getByTestId(`varga-${id}`)).toBeTruthy();
    expect(screen.queryByTestId('varga-D9')).toBeNull();
    expect(screen.getAllByText('Locked').length).toBe(14);
    expect(screen.queryAllByRole('radio').length).toBe(0);
    // The unlock block names the key, offers the two buttons and the device caption.
    expect(screen.getByTestId('varga-unlock')).toBeTruthy();
    expect(screen.getByText(/Watch one short ad to unlock 14 vargas on this phone for 24 hours/)).toBeTruthy();
    expect(screen.getByTestId('unlock-watch').props.accessibilityLabel).toBe('Watch an ad · unlock for 24 h');
    expect(screen.getByTestId('unlock-go-pro').props.accessibilityLabel).toBe('Go Pro · everything, no ads');
    expect(screen.getByText(/^The unlock is for this device\./)).toBeTruthy();
    // No fill under Jest: the tap reports honestly and unlocks nothing.
    await fireEvent.press(screen.getByTestId('unlock-watch'));
    expect(screen.getByText('Ad not available right now, try again')).toBeTruthy();
    expect(unlockedUntil('vargas', new Date(NOW))).toBeNull();
    // Go Pro navigates to the Pro screen.
    await fireEvent.press(screen.getByTestId('unlock-go-pro'));
    expect(router.push).toHaveBeenCalledWith('/pro');
  });

  it('the unlock flow writes unlocks(vargas, +24 h); the chip reads "till <time> tomorrow", the rows become radios and D10 swaps the hero', async () => {
    await renderWithProviders(<ChartsScreen now={now} chartWidth={326} />);
    await act(async () => {
      const expires = unlock('vargas', new Date(NOW));
      expect(expires.getTime()).toBe(NOW + 24 * 3600_000);
    });
    expect(unlockedUntil('vargas', new Date(NOW))?.toISOString()).toBe(new Date(NOW + DAY_MS).toISOString());
    expect(unlockedUntil('kp', new Date(NOW))).toBeNull(); // one ad = one key
    const chip = screen.getByTestId('chip-vargas');
    expect(textOf(chip)).toBe('14 more vargastill 10:58 tomorrow');
    expect(chip.props.accessibilityLabel).toBe('14 more vargas, till 10:58 tomorrow');
    await fireEvent.press(chip);
    expect(screen.queryByTestId('varga-unlock')).toBeNull();
    expect(textOf(screen.getByTestId('varga-till'))).toBe('unlocked till 10:58 tomorrow');
    expect(screen.getAllByRole('radio').length).toBe(14);
    await fireEvent.press(screen.getByTestId('varga-D10'));
    expect(textOf(screen.getByTestId('hero-title'))).toBe('D10 Dasamsa');
    expect(screen.getByTestId('chart-svg')).toBeTruthy();
    expect(screen.getByTestId('chip-vargas').props.accessibilityState.selected).toBe(true);
    expect(textOf(screen.getByTestId('chip-vargas'))).toMatch(/^D10 Dasamsa/);
    // The More card row names the state too.
    expect(textOf(screen.getByTestId('more-state-vargas'))).toBe('unlocked till 10:58 tomorrow');
    expect(textOf(screen.getByTestId('more-state-kp'))).toBe('watch an ad · 24 h');
  });

  it('unlock wording: "tomorrow" only while exact, else the date; Pro rows carry no state text', async () => {
    const until = new Date(NOW + DAY_MS);
    expect(isTomorrow(until, NOW, TZ)).toBe(true);
    expect(unlockedTillText(until, NOW, TZ, 'en', t)).toBe('unlocked till 10:58 tomorrow');
    expect(chipTillText(until, NOW, TZ, 'en', t)).toBe('till 10:58 tomorrow');
    const nextMorning = NOW + 20 * 3600_000; // 06:58 IST on the 23rd: expiry is "today"
    expect(isTomorrow(until, nextMorning, TZ)).toBe(false);
    expect(unlockedTillText(until, nextMorning, TZ, 'en', t)).toBe('unlocked till 10:58 23 Oct 2026');
    expect(rowStateText({ allowed: true, pro: true, until: null }, NOW, TZ, 'en', t)).toBeNull();
    expect(rowStateText({ allowed: false, pro: false, until: null }, NOW, TZ, 'en', t)).toBe('watch an ad · 24 h');
    await goPro();
    expect(featureAccess('vargas', NOW)).toEqual({ allowed: true, pro: true, until: null });
  });

  it('Pro: the vargas chip has no lock, the sheet is all radios, the More rows are plain and the full-screen table renders D60 with the same Chart', async () => {
    await goPro();
    await renderWithProviders(<ChartsScreen now={now} chartWidth={326} />);
    expect(screen.getByTestId('chip-vargas').props.accessibilityLabel).toBe('14 more vargas');
    await fireEvent.press(screen.getByTestId('chip-vargas'));
    expect(screen.getAllByRole('radio').length).toBe(14);
    expect(screen.queryByTestId('varga-till')).toBeNull();
    await fireEvent.press(screen.getByTestId('varga-open-full'));
    expect(router.push).toHaveBeenCalledWith(`/charts/vargas?profile=${priyaId}&varga=D2`);
    expect(screen.queryByTestId('more-state-vargas')).toBeNull();
    expect(screen.queryByTestId('more-state-kp')).toBeNull();
    await renderWithProviders(<VargasScreen now={now} profileId={priyaId} varga="D60" chartWidth={326} />);
    expect(screen.getByRole('header', { name: 'D60 Shashtyamsa' })).toBeTruthy();
    expect(screen.getByTestId('vargas-chart')).toBeTruthy();
    expect(screen.getAllByTestId(/^vargas-chip-D/).length).toBe(15);
    expect(screen.getAllByTestId(/^vargas-row-/).length).toBe(10); // Lagna + 9 planets
    expect(textOf(screen.getByTestId('vargas-how'))).toMatch(/^How this was computed: BPHS sign mappings for D60 \(Shashtyamsa, 60 parts per sign\)/);
    assertNoTruncation();
  });

  it('the full-screen vargas table is locked on the free tier (unlock sheet for the key) but D9 stays free', async () => {
    await renderWithProviders(<VargasScreen now={now} profileId={priyaId} varga="D10" chartWidth={326} />);
    expect(screen.getByTestId('vargas-locked')).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Unlock 14 vargas' })).toBeTruthy();
    expect(screen.queryByTestId('vargas-chart')).toBeNull();
    await renderWithProviders(<VargasScreen now={now} profileId={priyaId} varga="D9" chartWidth={326} />);
    expect(screen.getByTestId('vargas-chart')).toBeTruthy();
  });

  // ---- F15: Ashtakavarga + KP ----

  it('Ashtakavarga: locked on free (unlock sheet names the key); unlocked -> BAV 8 x 12 grid, SAV 12 bars summing to 337', async () => {
    await renderWithProviders(<AshtakavargaScreen now={now} profileId={priyaId} />);
    expect(screen.getByTestId('ashtakavarga-locked')).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Unlock Ashtakavarga' })).toBeTruthy();
    expect(screen.queryByTestId('sav-card')).toBeNull();
    await act(async () => {
      grantUnlock('ashtakavarga', new Date(NOW));
    });
    expect(screen.queryByTestId('ashtakavarga-locked')).toBeNull();
    const report = ashtakavargaFor(chartFor(priya()));
    expect(report.total).toBe(337);
    expect(report.sav.reduce((a, b) => a + b, 0)).toBe(337);
    // BAV grid: 8 contributor rows (7 planets + Lagna) x 12 sign cells, totals row = engine bySign.
    expect(screen.getAllByTestId(/^bav-row-/).length).toBe(8);
    expect(screen.getByTestId('bav-row-Ascendant')).toBeTruthy();
    expect(textOf(screen.getByTestId('bav-totals-Su'))).toBe(`Total${report.bav.Su.bySign.join('')}`);
    expect(textOf(screen.getByTestId('bav-title'))).toMatch(/^Sun · 48 bindus/);
    await fireEvent.press(screen.getByTestId('bav-chip-Sa'));
    expect(textOf(screen.getByTestId('bav-title'))).toMatch(/^Saturn · 39 bindus/);
    expect(textOf(screen.getByTestId('bav-totals-Sa'))).toBe(`Total${report.bav.Sa.bySign.join('')}`);
    // SAV: 12 house rows with Why?, bars, strength words; printed bindus sum to 337.
    expect(screen.getAllByTestId(/^sav-row-\d+$/).length).toBe(12);
    expect(screen.getAllByTestId(/^sav-bar-\d+$/).length).toBe(12);
    const printed = report.houseStrength.map((h) => textOf(screen.getByTestId(`sav-row-${h.house}`)));
    expect(printed.reduce((sum, s) => sum + Number(s.match(/· (\d+)/)![1]), 0)).toBe(337);
    for (const h of report.houseStrength) expect(printed[h.house - 1]).toContain(`House ${h.house} · `);
    expect(screen.getAllByLabelText(/^Why\? House \d+/).length).toBe(12);
    expect(textOf(screen.getByTestId('sav-total'))).toBe('337 bindus in all');
    expect(textOf(screen.getByTestId('ashtakavarga-how'))).toMatch(/^How this was computed: BPHS bindu tables/);
    assertNoTruncation();
  });

  it('KP: locked on free; Pro -> 12 cusps with sign/star/sub lords, 9 planets, 12 significator houses, ruling planets for now with the instant', async () => {
    await renderWithProviders(<KpScreen now={now} profileId={priyaId} />);
    expect(screen.getByTestId('kp-locked')).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Unlock KP' })).toBeTruthy();
    await goPro();
    await renderWithProviders(<KpScreen now={now} profileId={priyaId} />);
    expect(screen.queryByTestId('kp-locked')).toBeNull();
    expect(screen.getAllByTestId(/^kp-cusp-\d+$/).length).toBe(12);
    const report = kpFor(priya());
    expect(report.cusps.length).toBe(12);
    expect(textOf(screen.getByTestId('kp-cusp-1'))).toContain(`${report.cusps[0].signLord} · ${report.cusps[0].starLord} · ${report.cusps[0].subLord}`.replace(/ /g, '\u00A0'));
    expect(screen.getAllByTestId(/^kp-planet-/).length).toBe(9);
    expect(screen.getAllByTestId(/^kp-sig-\d+$/).length).toBe(12);
    expect(textOf(screen.getByTestId('kp-ruling-at'))).toBe('Thu 22 Oct 10:58 · Lucknow');
    expect(textOf(screen.getByTestId('kp-ruling-list')).length).toBeGreaterThan(3);
    expect(textOf(screen.getByTestId('kp-how'))).toMatch(/^How this was computed: Placidus cusps in the tropical frame reduced by the KP ayanamsa \(23\.7353°\)/);
    assertNoTruncation();
  });

  // ---- F16: yogas ----

  it('the Yogas card prints "N found" from the engine and formed / cancelled tags with the cancelling rule and a Why? per row', async () => {
    const report = yogasFor(chartFor(priya()));
    expect(report.found).toBeGreaterThan(0);
    const cancelled = yogaRows(report).filter((y) => !y.formed);
    expect(cancelled.length).toBeGreaterThan(0);
    await renderWithProviders(<ChartsScreen now={now} chartWidth={326} />);
    expect(textOf(screen.getByTestId('yogas-found'))).toBe(`${report.found} found`);
    expect(screen.getAllByTestId(/^yoga-row-/).length).toBe(report.yogas.length);
    expect(screen.getAllByText('formed').length).toBe(report.found);
    expect(screen.getAllByText('cancelled').length).toBe(cancelled.length);
    expect(screen.getByTestId('yoga-row-kemadruma')).toBeTruthy();
    expect(textOf(screen.getByTestId('yoga-cancelled-kemadruma'))).toMatch(/^cancelled: /);
    expect(screen.queryByText(/danger/i)).toBeNull();
    // Why? -> the yogas corpus explanation with rule, inputs, source.
    await fireEvent.press(screen.getByTestId('yoga-why-kemadruma'));
    expect(screen.getByRole('header', { name: 'Kemadruma' })).toBeTruthy();
    expect(textOf(screen.getByTestId('yoga-sheet-text')).length).toBeGreaterThan(80);
    expect(screen.getByText('Phaladeepika')).toBeTruthy(); // the corpus source of yoga-kemadruma
    expect(screen.getAllByText(/^cancelled: Kemadruma cancelled: a planet other than the Moon/).length).toBeGreaterThanOrEqual(1);
  });

  // ---- F17: Varshaphal ----

  it('Varshaphal row in "More from this chart" names the running year; the card appears only inside 30 days of the next return', async () => {
    const chart = chartFor(priya());
    const vy = vedicYearAt(chart, NOW);
    expect(vy.runningYear).toBe(2026);
    expect(vy.nextYear).toBe(2027);
    expect(vy.runningStart).toBeLessThanOrEqual(NOW);
    expect(vy.nextStart).toBeGreaterThan(NOW);
    expect(varshaphalPromoted(vy, NOW)).toBe(false);
    expect(varshaphalPromoted(vy, vy.nextStart - 31 * DAY_MS)).toBe(false);
    expect(varshaphalPromoted(vy, vy.nextStart - 30 * DAY_MS)).toBe(true);
    expect(varshaphalPromoted(vy, vy.nextStart - 1)).toBe(true);
    expect(varshaphalPromoted(vy, vy.nextStart)).toBe(false);
    expect(nextSolarReturn(chart, NOW)).toBe(vy.nextStart);
    // Oct 2026: row only.
    await renderWithProviders(<ChartsScreen now={now} chartWidth={326} />);
    expect(screen.queryByTestId('varshaphal-card')).toBeNull();
    expect(textOf(screen.getByTestId('more-row-varshaphal'))).toMatch(/Your Vedic year from \d+ Mar 2026 · \d\d:\d\d/);
    // 20 days before the March 2027 return: the card is promoted, default Off toggle, locked summary on free.
    const soon = vy.nextStart - 20 * DAY_MS;
    await renderWithProviders(<ChartsScreen now={() => soon} chartWidth={326} />);
    const card = screen.getByTestId('varshaphal-card');
    expect(card).toBeTruthy();
    expect(textOf(screen.getByTestId('varshaphal-begins'))).toMatch(/Your Vedic year begins \d+ Mar 2027 · \d\d:\d\d/);
    expect(screen.getByTestId('varshaphal-notify').props.accessibilityState.checked).toBe(false);
    expect(textOf(screen.getByTestId('varshaphal-state'))).toBe('watch an ad · 24 h');
    await fireEvent.press(screen.getByTestId('varshaphal-open'));
    expect(screen.getByRole('header', { name: 'Unlock Varshaphal' })).toBeTruthy();
    expect(router.push).not.toHaveBeenCalledWith(expect.stringMatching(/^\/charts\/varshaphal/));
  });

  it('the Varshaphal summary renders the solar-return chart, Muntha and the year lord with the candidate table; the toggle schedules one notification', async () => {
    await renderWithProviders(<VarshaphalScreen now={now} profileId={priyaId} year={2026} chartWidth={326} />);
    expect(screen.getByTestId('varshaphal-locked')).toBeTruthy();
    await goPro();
    const replan = jest.fn(async () => ({}));
    await renderWithProviders(<VarshaphalScreen now={now} profileId={priyaId} year={2026} chartWidth={326} getPermission={async () => 'granted'} replan={replan} />);
    const chart = chartFor(priya());
    const report = varshaphalFor(chart, 2026);
    expect(screen.getByRole('header', { name: 'Varshaphal 2026' })).toBeTruthy();
    expect(screen.getByTestId('varshaphal-chart')).toBeTruthy();
    expect(screen.getByTestId('chart-svg')).toBeTruthy();
    expect(textOf(screen.getByTestId('varshaphal-muntha'))).toMatch(/^Muntha {2}Muntha in \w+, house \d+ · lord \w+/);
    expect(textOf(screen.getByTestId('varshaphal-lord'))).toContain('Year lord');
    expect(screen.getAllByTestId(/^varshaphal-candidate-/).length).toBe(report.yearLord.candidates.length);
    expect(report.yearLord.candidates.length).toBe(5);
    expect(screen.getAllByText(/^Why\?$/).length).toBeGreaterThanOrEqual(3);
    // Default Off; switching On persists, re-plans; the planner emits exactly one entry at the next return.
    const sw = screen.getByTestId('varshaphal-notify');
    expect(sw.props.accessibilityState.checked).toBe(false);
    expect(getYearBeginsEnabled()).toBe(false);
    await fireEvent.press(sw);
    await act(async () => {});
    expect(getYearBeginsEnabled()).toBe(true);
    expect(replan).toHaveBeenCalledTimes(1);
    const input = plannerInputFromDb(NOW, 'en')!;
    expect(input.yearBegins?.profiles.length).toBe(1);
    const plan = planYearBegins(input);
    expect(plan.length).toBe(1);
    expect(plan[0].kind).toBe('year_begins');
    expect(plan[0].fireAtMs).toBe(vedicYearAt(chart, NOW).nextStart);
    expect(plan[0].title).toBe('Year begins');
    expect(plan[0].body).toMatch(/^Priya: the Vedic year begins \d+ Mar 2027 at \d\d:\d\d\./);
    // applyPlan records the kind so Settings labels it honestly.
    await applyPlan(plan, 'en', fakeDeps);
    expect(listScheduledDetailed(5)).toEqual([{ fireAt: new Date(plan[0].fireAtMs).toISOString(), kind: 'year_begins', refId: null }]);
    assertNoTruncation();
  });

  // ---- F14: dasha alerts (Pro, default Off) ----

  it('dasha change alerts: free sees the Pro tag and the planner ignores the flag; Pro sees the switch (default Off) and the planner schedules antar + pratyantar changes', async () => {
    expect(getDashaAlertsEnabled()).toBe(false);
    await renderWithProviders(<ChartsScreen now={now} chartWidth={326} />);
    expect(screen.getByTestId('dasha-pro')).toBeTruthy();
    expect(screen.queryByTestId('dasha-alerts')).toBeNull();
    // The stored preference alone schedules nothing on the free tier.
    setDashaAlertsEnabled(true);
    expect(plannerInputFromDb(NOW, 'en')!.dashaAlerts).toBeUndefined();
    expect(planNotifications(plannerInputFromDb(NOW, 'en')!).filter((n) => n.kind === 'dasha_change')).toEqual([]);
    setDashaAlertsEnabled(false);
    await goPro();
    const replan = jest.fn(async () => ({}));
    await renderWithProviders(<ChartsScreen now={now} chartWidth={326} getPermission={async () => 'granted'} replan={replan} />);
    expect(screen.queryByTestId('dasha-pro')).toBeNull();
    const sw = screen.getByTestId('dasha-alerts');
    expect(sw.props.accessibilityState.checked).toBe(false);
    expect(textOf(screen.getByTestId('dasha-alerts-caption'))).toBe('(off until you switch them on)');
    expect(screen.getByTestId('dasha-pratyantar-now')).toBeTruthy();
    await fireEvent.press(sw);
    await act(async () => {});
    expect(getDashaAlertsEnabled()).toBe(true);
    expect(replan).toHaveBeenCalledTimes(1);
    expect(textOf(screen.getByTestId('dasha-alerts-caption'))).toMatch(/^Next change \d+ \w+ 20\d\d$/);
    // Planner: every antar/pratyantar change in the 60-day horizon, exact instants, counted in the cap.
    const input = plannerInputFromDb(NOW, 'en')!;
    expect(input.dashaAlerts?.profiles.length).toBe(1);
    const changes = planDashaChanges(input);
    expect(changes.length).toBeGreaterThan(0);
    const tree = dashaFor(chartFor(priya()));
    for (const c of changes) {
      expect(c.kind).toBe('dasha_change');
      expect(c.fireAtMs).toBeGreaterThan(NOW);
      expect(c.fireAtMs).toBeLessThanOrEqual(NOW + 60 * DAY_MS);
      expect(c.body).toMatch(/^Priya: /);
    }
    const praty = tree.mahas.flatMap((m) => m.children ?? []).flatMap((a) => a.children ?? []).filter((p) => p.end > NOW && p.end <= NOW + 60 * DAY_MS);
    expect(changes.filter((c) => c.body.includes('pratyantar dasha begins now')).length).toBe(praty.length);
    expect(planNotifications(input).filter((n) => n.kind === 'dasha_change').length).toBe(changes.length);
    expect(planNotifications({ ...input, cap: 1 }).length).toBe(1);
  });

  it('Settings -> Notifications: Pro gets the dasha alerts switch (default Off) and the year-begins switch; both re-plan', async () => {
    await goPro();
    const replan = jest.fn(async () => ({ scheduled: 0, failed: [], planned: 0 }));
    await renderWithProviders(<NotificationsScreen getPermission={async () => 'granted'} replan={replan} />);
    await screen.findByText('Notifications are allowed for Shubhvela', {}, { timeout: 20000 });
    const dasha = screen.getByTestId('dasha-alerts-switch');
    expect(dasha.props.accessibilityState.checked).toBe(false);
    expect(screen.queryByTestId('dasha-alerts-pro')).toBeNull();
    await fireEvent.press(dasha);
    expect(getDashaAlertsEnabled()).toBe(true);
    await fireEvent.press(screen.getByTestId('year-begins-switch'));
    expect(getYearBeginsEnabled()).toBe(true);
    expect(replan).toHaveBeenCalledTimes(2);
    setYearBeginsEnabled(false);
  });

  // ---- M3: Timing and documents ----

  it('Timing and documents renders nothing while every route flag is false, and one row per flag otherwise (Janam Patri state from entitlements)', async () => {
    const noop = () => {};
    await renderWithProviders(<TimingDocumentsCard flags={{ muhuratFinder: false, janamPatriPdf: false, shareChartCard: false }} onMuhurat={noop} onJanamPatri={noop} onShareCard={noop} testID="timing-card" />);
    expect(screen.queryByTestId('timing-card')).toBeNull();
    expect(screen.queryByText('Timing and documents')).toBeNull();
    await renderWithProviders(<TimingDocumentsCard flags={{ muhuratFinder: true, janamPatriPdf: true, shareChartCard: false }} onMuhurat={noop} onJanamPatri={noop} onShareCard={noop} testID="timing-card" />);
    expect(screen.getByText('Timing and documents')).toBeTruthy();
    expect(screen.getByTestId('timing-row-muhuratFinder')).toBeTruthy();
    expect(screen.getByTestId('timing-row-janamPatriPdf')).toBeTruthy();
    expect(screen.queryByTestId('timing-row-shareChartCard')).toBeNull();
    expect(screen.getByText('₹99 · store price may differ')).toBeTruthy();
    await goPro();
    await renderWithProviders(<TimingDocumentsCard flags={{ muhuratFinder: false, janamPatriPdf: true, shareChartCard: true }} onMuhurat={noop} onJanamPatri={noop} onShareCard={noop} testID="timing-card" />);
    expect(screen.getByText('included in Pro')).toBeTruthy();
    expect(screen.getByTestId('timing-row-shareChartCard')).toBeTruthy();
    expect(screen.queryByTestId('timing-row-muhuratFinder')).toBeNull();
  });

  // ---- +30 % pseudo-locale ----

  for (const lang of ['en', 'hi', 'bho'] as const) {
    it(`pseudo-locale +30 % (${lang}): the vargas sheet and the KP table wrap their headers and truncate nothing`, async () => {
      globalThis.__PSEUDO_LOCALE__ = true;
      await goPro();
      await renderWithProviders(<ChartsScreen now={now} chartWidth={296} />, { lang });
      await fireEvent.press(screen.getByTestId('chip-vargas'));
      expect(screen.getAllByTestId(/^varga-D\d+$/).length).toBe(14);
      assertNoTruncation();
      const noop = () => {};
      const sheet = await renderWithProviders(<VargaSheet visible onClose={noop} access={{ allowed: true, pro: true, until: null }} selected="D10" onSelect={noop} onUnlocked={noop} onOpenFull={noop} nowMs={NOW} tz={TZ} />, { lang });
      expect(screen.getAllByRole('radio').length).toBe(14);
      assertNoTruncation();
      if (lang === 'en') expect(sheet.toJSON()).toMatchSnapshot();
      const kp = await renderWithProviders(<KpScreen now={now} profileId={priyaId} />, { lang });
      expect(screen.getAllByTestId(/^kp-cusp-\d+$/).length).toBe(12);
      assertNoTruncation();
      expect(allTexts().length).toBeGreaterThan(100);
      if (lang === 'en') expect(kp.toJSON()).toMatchSnapshot();
    });
  }
});
