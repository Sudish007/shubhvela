// FEAT-B05 Muhurat finder (F26), travel note (F27) and saved muhurats: the free range is fixed today..+7 and the Pro range
// is editable through the native picker; results are the engine's ranked windows with one rule chip per rule in its
// met / not-met state and "N/10 rules met"; windows under 4 rules go to "Best partial matches"; the zero-results copy
// lists the top three partials; Save writes saved_muhurats and the Upcoming strip shows it; .ics is gated (free ->
// Pro screen, Pro -> engine toIcs through the share seam); the interstitial trigger fires once per completed search;
// the Travel today card matches the weekday's Disha Shool and prints Panchak / Bhadra as text; +30 % pseudo-locale
// snapshot of a window card (chips wrap, the time range never splits).
import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { PixelRatio } from 'react-native';
import { MUHURAT_ACTIVITY_IDS, MUHURAT_MIN_RULES, MUHURAT_RULE_ORDER, dishaShool, panchang, splitWindows, travelNoteFor, type MuhuratWindow } from '@shubhvela/engine';
import MuhuratFinder, { initialSelection, reshapeSelection } from '../app/charts/muhurat/index';
import SavedMuhurats from '../app/charts/muhurat/saved';
import { resetAdPolicyForTests } from '../src/ads/AdPolicy';
import { getProfile, insertProfile } from '../src/db/profiles';
import { listSavedMuhurats, saveMuhurat } from '../src/db/savedMuhurats';
import { SAMPLE_AMMA, SAMPLE_PRIYA } from '../src/dev/seed';
import { setEntitlement } from '../src/entitlements';
import { chartFor, clearChartCache } from '../src/engine-bridge/charts';
import { makeT } from '../src/i18n';
import { noBreak } from '../src/components/Num';
import { collapsedRow, VISIBLE_COLLAPSED } from '../src/muhurat/ActivityChips';
import { icsText } from '../src/muhurat/ics';
import { clampRange, freeRange, ruleChipLabel, searchMuhurat, whenLine } from '../src/muhurat/model';
import { PartialMatches } from '../src/muhurat/PartialMatches';
import { travelSentences, TravelTodayCard } from '../src/muhurat/TravelTodayCard';
import { WindowCard } from '../src/muhurat/WindowCard';
import { computeToday, observerFromProfile } from '../src/today/model';
import { upcomingCardText } from '../src/today/UpcomingStrip';
import { installTestDb } from './helpers/nodeDb';
import { allTexts, renderWithProviders, textOf } from './helpers/render';

// The interstitial hook is replaced by a spy so the trigger discipline can be asserted without an ad SDK.
const mockShow = jest.fn(() => true);
jest.mock('../src/ads/useInterstitial', () => ({ useInterstitial: () => ({ ready: true, show: mockShow }) }));

const NOW = Date.UTC(2026, 9, 22, 5, 28); // Thu 22 Oct 2026 10:58 IST
const now = () => NOW;
const TZ = 'Asia/Kolkata';
const LUCKNOW = { lat: SAMPLE_PRIYA.lat, lon: SAMPLE_PRIYA.lon };
const t = makeT('en');

function assertNoTruncation() {
  for (const tx of allTexts()) expect(tx.props.numberOfLines).toBeUndefined();
}

async function goPro(): Promise<void> {
  await act(async () => {
    setEntitlement('shubhvela_pro', 'active', 'tok', new Date(NOW));
  });
}

describe('B05 muhurat finder', () => {
  let close: () => void;
  let priyaId: number;
  let ammaId: number;
  const priya = () => getProfile(priyaId)!;
  beforeEach(() => {
    jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(1);
    ({ close } = installTestDb());
    clearChartCache();
    resetAdPolicyForTests();
    (router.push as jest.Mock).mockClear();
    (DateTimePickerAndroid.open as jest.Mock).mockClear();
    mockShow.mockClear();
    priyaId = insertProfile(SAMPLE_PRIYA, new Date(NOW));
    ammaId = insertProfile(SAMPLE_AMMA, new Date(NOW));
  });
  afterEach(() => {
    globalThis.__PSEUDO_LOCALE__ = undefined;
    close();
  });

  // ---- model ----

  it('the free range is today .. today + 7 in the observer zone and a Pro range is clamped to today .. +400', () => {
    expect(freeRange(NOW, TZ)).toEqual({ from: '2026-10-22', to: '2026-10-29' });
    expect(clampRange({ from: '2026-10-01', to: '2026-11-30' }, NOW, TZ)).toEqual({ from: '2026-10-22', to: '2026-11-30' });
    expect(clampRange({ from: '2026-12-01', to: '2026-11-01' }, NOW, TZ)).toEqual({ from: '2026-12-01', to: '2026-12-01' });
    expect(clampRange({ from: '2026-10-22', to: '2029-01-01' }, NOW, TZ).to).toBe('2027-11-26');
  });

  it('every one of the 14 activities returns ranked windows with the 10-rule breakdown over today + 7 days', () => {
    expect(MUHURAT_ACTIVITY_IDS.length).toBe(14);
    const obs = { ...LUCKNOW, tz: TZ, placeName: 'Lucknow' };
    for (const id of MUHURAT_ACTIVITY_IDS) {
      const r = searchMuhurat(id, freeRange(NOW, TZ), [priya()], obs);
      expect(r.all.length).toBeGreaterThan(0);
      for (const w of r.all) {
        expect(w.rules.map((x) => x.id)).toEqual([...MUHURAT_RULE_ORDER]);
        expect(w.met).toBe(w.rules.filter((x) => x.met).length);
        expect(w.of).toBe(10);
        expect(w.partial).toBe(w.met < MUHURAT_MIN_RULES);
      }
      for (let i = 1; i < r.all.length; i++) expect(r.all[i - 1].met).toBeGreaterThanOrEqual(r.all[i].met);
      expect(r.matches.every((w) => !w.partial) && r.partials.every((w) => w.partial)).toBe(true);
    }
  });

  it('the collapsed chip row shows six activities plus the selected one; marriage takes two profiles', () => {
    expect(collapsedRow('griha-pravesh').length).toBe(VISIBLE_COLLAPSED);
    expect(collapsedRow('vrat-start')).toEqual([...collapsedRow('griha-pravesh'), 'vrat-start']);
    expect(initialSelection('griha-pravesh', priya(), [priya(), getProfile(ammaId)!])).toEqual([priyaId]);
    expect(initialSelection('marriage', priya(), [priya(), getProfile(ammaId)!])).toEqual([priyaId, ammaId]);
    expect(reshapeSelection([priyaId, ammaId], 1, [])).toEqual([priyaId]);
    expect(reshapeSelection([priyaId], 2, [priya(), getProfile(ammaId)!])).toEqual([priyaId, ammaId]);
  });

  // ---- screen: free tier ----

  it('free tier: the range field is read-only "today – +7 days" with the Pro link, no picker fields; results render rule chips in met / not-met state with "N/10 rules met"', async () => {
    await renderWithProviders(<MuhuratFinder now={now} />);
    expect(screen.getByTestId('range-free')).toBeTruthy();
    expect(screen.getByText('today – +7 days')).toBeTruthy();
    expect(textOf(screen.getByTestId('range-dates'))).toMatch(/22.Oct.2026/);
    expect(screen.queryByTestId('range-from')).toBeNull();
    expect(screen.getByTestId('muhurat-caption')).toBeTruthy();
    expect(screen.getByText(/Free plan searches today \+ 7 days/)).toBeTruthy();
    await fireEvent.press(screen.getByTestId('range-pro'));
    expect(router.push).toHaveBeenCalledWith('/pro');

    const r = searchMuhurat('griha-pravesh', freeRange(NOW, TZ), [priya()], { ...LUCKNOW, tz: TZ, placeName: null });
    expect(textOf(screen.getByTestId('muhurat-count'))).toBe(r.matches.length === 1 ? '1 window' : `${r.matches.length} windows`);
    expect(r.matches.length).toBeGreaterThan(0);
    const first = screen.getByTestId('window-0');
    expect(textOf(within(first).getByTestId('window-when'))).toBe(noBreak(whenLine(r.matches[0], TZ, 'en', t, '2026-10-22')));
    // ONE chip per rule, state in the testID, label from the rule detail.
    const w = r.matches[0];
    for (const rule of w.rules) {
      const chip = screen.getAllByTestId(`rule-${rule.id}-${rule.met ? 'met' : 'notmet'}`)[0];
      expect(chip.props.accessibilityLabel).toBe(`${ruleChipLabel(rule, w, TZ, 'en', t)}, ${rule.met ? 'met' : 'not met'}`);
    }
    expect(within(first).getAllByTestId(/^rule-/).length).toBe(10);
    expect(screen.getAllByLabelText(`${w.met} of 10 rules met`).length).toBeGreaterThan(0);
    expect(screen.queryByText(/%/)).toBeNull();
    // The first result's Save is the primary CTA; .ics is labelled ".ics Pro" on the free tier.
    expect(within(first).getByTestId('window-save').props.accessibilityLabel).toBe('Save to Upcoming');
    expect(textOf(within(first).getByTestId('window-ics'))).toBe('.ics Pro');
    // Travel card and footer close the list.
    expect(screen.getByTestId('travel-today')).toBeTruthy();
    expect(screen.getByText('How this was computed')).toBeTruthy();
    assertNoTruncation();
  });

  it('windows under 4 rules appear only under "Best partial matches"; zero matches print the copy with the top three partials', async () => {
    const r = searchMuhurat('griha-pravesh', freeRange(NOW, TZ), [priya()], { ...LUCKNOW, tz: TZ, placeName: null });
    expect(r.partials.length).toBeGreaterThan(0);
    await renderWithProviders(<MuhuratFinder now={now} />);
    expect(screen.getByTestId('partial-title')).toBeTruthy();
    expect(screen.getAllByTestId(/^partial-\d+$/).length).toBe(r.partials.length);
    expect(screen.queryByTestId('zero-results')).toBeNull();
    for (let i = 0; i < r.partials.length; i++) expect(textOf(within(screen.getByTestId(`partial-${i}`)).getByTestId('window-when'))).toBe(noBreak(whenLine(r.partials[i], TZ, 'en', t, '2026-10-22')));

    // Zero-results copy with the top three of a longer partial list (every window of the search, here, in N18 order).
    expect(r.all.length).toBeGreaterThan(3);
    await renderWithProviders(<PartialMatches partials={r.all} zeroResults tz={TZ} todayDate="2026-10-22" pro={false} isSaved={() => false} onSave={() => {}} onIcs={() => {}} testID="partials" />);
    expect(textOf(screen.getByTestId('zero-results'))).toBe('No window met at least 4 rules in these days; widen the range (Pro) or see the best partial matches');
    expect(screen.getAllByTestId(/^partial-\d+$/).length).toBe(3);
  });

  it('Save to Upcoming writes saved_muhurats once per window and the Upcoming strip shows it with the activity name, opening the saved list', async () => {
    await renderWithProviders(<MuhuratFinder now={now} />);
    expect(listSavedMuhurats().length).toBe(0);
    const first = screen.getByTestId('window-0');
    await fireEvent.press(within(first).getByTestId('window-save'));
    const saved = listSavedMuhurats();
    expect(saved.length).toBe(1);
    expect(saved[0].activity).toBe('griha-pravesh');
    expect(saved[0].window.rules.length).toBe(10);
    expect(within(first).getByTestId('window-saved').props.accessibilityState.disabled).toBe(true);
    expect(screen.getByTestId('muhurat-saved-link').props.accessibilityLabel).toBe('Saved muhurats (1)');
    // Saving again is idempotent.
    saveMuhurat(saved[0].window);
    expect(listSavedMuhurats().length).toBe(1);
    // F7: the Today model hands the saved rows to engine.upcoming and the strip card names the activity.
    const model = computeToday(priya(), observerFromProfile(priya()), NOW);
    const item = model.upcoming.find((i) => i.kind === 'savedMuhurat');
    expect(item).toBeTruthy();
    expect(item!.at).toBe(saved[0].start);
    const text = upcomingCardText(item!, TZ, priyaId, t, 'en');
    expect(text.title).toBe('Griha Pravesh');
    expect(text.route).toBe('/charts/muhurat/saved');
    expect(text.kind).toBe('Saved muhurat');
    // The saved list renders the row and Remove deletes it.
    await renderWithProviders(<SavedMuhurats now={now} />);
    expect(screen.getByTestId(`saved-${saved[0].id}`)).toBeTruthy();
    expect(textOf(screen.getByTestId(`saved-met-${saved[0].id}`))).toBe(`${saved[0].window.met}/10 rules met`);
    await fireEvent.press(screen.getByTestId(`saved-ics-${saved[0].id}`));
    expect(router.push).toHaveBeenLastCalledWith('/pro');
    await fireEvent.press(screen.getByTestId(`saved-remove-${saved[0].id}`));
    expect(listSavedMuhurats().length).toBe(0);
    expect(screen.getByText('No saved muhurat yet')).toBeTruthy();
  });

  it('.ics is gated: free opens the Pro screen; Pro writes engine toIcs text and hands the file to the share seam', async () => {
    const writeFile = jest.fn(async (name: string, _text: string) => `file:///cache/${name}`);
    const share = jest.fn(async () => {});
    await renderWithProviders(<MuhuratFinder now={now} icsDeps={{ writeFile, share }} />);
    await fireEvent.press(within(screen.getByTestId('window-0')).getByTestId('window-ics'));
    expect(router.push).toHaveBeenCalledWith('/pro');
    expect(writeFile).not.toHaveBeenCalled();

    await goPro();
    expect(textOf(within(screen.getByTestId('window-0')).getByTestId('window-ics'))).toBe('.ics');
    await fireEvent.press(within(screen.getByTestId('window-0')).getByTestId('window-ics'));
    await act(async () => {});
    expect(writeFile).toHaveBeenCalledTimes(1);
    const [name, text] = writeFile.mock.calls[0];
    expect(name).toMatch(/^muhurat-griha-pravesh-\d{8}-\d{4}\.ics$/);
    expect(text).toContain('BEGIN:VCALENDAR');
    expect(text).toContain('SUMMARY:Griha Pravesh');
    expect(text).toMatch(/rules met/);
    expect(text.replace(/\r\n /g, '')).toContain('Rahu Kaal avoided');
    expect(share).toHaveBeenCalledWith(`file:///cache/${name}`);
    const r = searchMuhurat('griha-pravesh', freeRange(NOW, TZ), [priya()], { ...LUCKNOW, tz: TZ, placeName: 'Lucknow, Uttar Pradesh, India' });
    expect(text).toBe(icsText(r.matches[0], 'en', t, TZ, 'Lucknow, Uttar Pradesh, India', NOW));
  });

  it('Pro: the range is editable through the native date picker and the search follows it', async () => {
    await goPro();
    await renderWithProviders(<MuhuratFinder now={now} />);
    expect(screen.queryByTestId('range-free')).toBeNull();
    expect(screen.getByTestId('range-from')).toBeTruthy();
    expect(screen.getByTestId('range-to')).toBeTruthy();
    expect(screen.queryByText(/Free plan searches/)).toBeNull();
    const before = textOf(screen.getByTestId('muhurat-count'));
    await fireEvent.press(screen.getByTestId('range-to'));
    expect(DateTimePickerAndroid.open).toHaveBeenCalledTimes(1);
    const opts = (DateTimePickerAndroid.open as jest.Mock).mock.calls[0][0];
    expect(opts.mode).toBe('date');
    await act(async () => {
      opts.onValueChange({}, new Date(2026, 10, 15, 12));
    });
    expect(screen.getByTestId('range-to').props.accessibilityLabel).toMatch(/15 Nov 2026/);
    const r = searchMuhurat('griha-pravesh', { from: '2026-10-22', to: '2026-11-15' }, [priya()], { ...LUCKNOW, tz: TZ, placeName: null });
    const after = textOf(screen.getByTestId('muhurat-count'));
    expect(after).toBe(`${r.matches.length} windows`);
    expect(after).not.toBe(before);
  });

  it('the interstitial trigger muhuratSearchCompleted fires once per completed search (not on re-render), and again for a new search', async () => {
    const tree = await renderWithProviders(<MuhuratFinder now={now} />);
    expect(mockShow).toHaveBeenCalledTimes(1);
    expect(mockShow).toHaveBeenCalledWith('muhuratSearchCompleted');
    await tree.rerender(<MuhuratFinder now={now} />);
    expect(mockShow).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByTestId('activity-chip-travel'));
    expect(mockShow).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('activity-chip-travel').props.accessibilityState.selected).toBe(true);
  });

  it('the "All 14 activities" chip opens a sheet of 14 radio rows; choosing marriage adds the second For field', async () => {
    await renderWithProviders(<MuhuratFinder now={now} />);
    expect(screen.getAllByTestId(/^activity-chip-(?!all$|row$)/).length).toBe(VISIBLE_COLLAPSED);
    await fireEvent.press(screen.getByTestId('activity-chip-all'));
    expect(screen.getAllByTestId(/^activity-sheet-/).length).toBe(14);
    expect(screen.getAllByRole('radio').length).toBe(14);
    await fireEvent.press(screen.getByTestId('activity-sheet-marriage'));
    expect(screen.getByTestId('activity-chip-marriage').props.accessibilityState.selected).toBe(true);
    expect(screen.getAllByTestId(/^for-field-\d$/).length).toBe(2);
    expect(screen.getByText('For (two profiles)')).toBeTruthy();
    expect(screen.getByTestId('for-field-1').props.accessibilityLabel).toContain('Amma');
    // Marriage allows night windows: at least one card carries the night tag over the week, or none - either way every value is the engine's.
    const r = searchMuhurat('marriage', freeRange(NOW, TZ), [priya(), getProfile(ammaId)!], { ...LUCKNOW, tz: TZ, placeName: null });
    expect(textOf(screen.getByTestId('muhurat-count'))).toBe(r.matches.length === 1 ? '1 window' : `${r.matches.length} windows`);
  });

  // ---- F27 travel ----

  it('Travel today matches the weekday Disha Shool and prints Panchak / Bhadra as text', async () => {
    const p = panchang('2026-10-22', LUCKNOW, TZ);
    expect(p.vara).toBe(4);
    expect(dishaShool(4).avoid).toBe('south');
    const note = travelNoteFor(p);
    const lines = travelSentences(note, p.date, TZ, t, 'en');
    expect(lines[0]).toBe('Disha Shool is south on Thursdays: avoid beginning a journey towards the south today; returning is fine.');
    await renderWithProviders(<TravelTodayCard panchang={p} testID="travel" />);
    expect(screen.getByText('Travel today')).toBeTruthy();
    expect(textOf(screen.getByTestId('travel-line-0'))).toBe(lines[0]);
    expect(screen.getByLabelText(/^Why\? Travel today/)).toBeTruthy();
    if (p.panchak) expect(textOf(screen.getByTestId('travel-line-1'))).toMatch(/^Panchak is active till /);
    else if (p.bhadra.some((b) => b.location === 'earth')) expect(textOf(screen.getByTestId('travel-line-1'))).toMatch(/^Bhadra on earth /);
    else expect(textOf(screen.getByTestId('travel-line-1'))).toBe('No Panchak or Bhadra flag today.');
    // Over the next 60 days every weekday's sentence names its own direction and a Panchak day prints the flag.
    let sawPanchak = false;
    for (let i = 0; i < 60; i++) {
      const d = new Date(Date.UTC(2026, 9, 22 + i));
      const day = d.toISOString().slice(0, 10);
      const pd = panchang(day, LUCKNOW, TZ);
      const s = travelSentences(travelNoteFor(pd), day, TZ, t, 'en');
      expect(s[0]).toContain(`Disha Shool is ${dishaShool(pd.vara).avoid} on`);
      if (pd.panchak) {
        sawPanchak = true;
        expect(s.some((x) => x.startsWith('Panchak is active till'))).toBe(true);
      }
    }
    expect(sawPanchak).toBe(true);
    expect(screen.queryByText(/danger|fear|inauspicious/i)).toBeNull();
  });

  // ---- +30 % pseudo-locale ----

  it('+30 % pseudo-locale: window cards keep every label whole, chips wrap, the time range never splits', async () => {
    globalThis.__PSEUDO_LOCALE__ = true;
    const r = searchMuhurat('griha-pravesh', freeRange(NOW, TZ), [priya()], { ...LUCKNOW, tz: TZ, placeName: null });
    const w: MuhuratWindow = r.matches[0];
    const tree = await renderWithProviders(<WindowCard window={w} tz={TZ} todayDate="2026-10-22" primary saved={false} pro={false} onSave={() => {}} onIcs={() => {}} testID="card" />);
    assertNoTruncation();
    const when = textOf(screen.getByTestId('window-when'));
    expect(when).toContain('\u2060');
    expect(when).not.toMatch(/\d \u2013|\u2013 \d/);
    expect(screen.getAllByTestId(/^rule-/).length).toBe(10);
    expect(screen.getByTestId('window-rules').props.style).toEqual(expect.objectContaining({ flexWrap: 'wrap' }));
    expect(screen.getAllByText(/ x+$/).length).toBeGreaterThan(3);
    expect(tree.toJSON()).toMatchSnapshot();
  });

  it('splitWindows agrees with the partial flag for the sample search', () => {
    const r = searchMuhurat('vehicle-purchase', freeRange(NOW, TZ), [priya()], { ...LUCKNOW, tz: TZ, placeName: null });
    const s = splitWindows(r.all);
    expect(s.matches.length).toBe(r.matches.length);
    expect(s.partials.length).toBe(r.partials.length);
    expect(chartFor(priya()).planets.find((p) => p.id === 'Mo')).toBeTruthy();
  });
});
