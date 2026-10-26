// Charts tab end to end (fixed clock, seeded sample household): profile pill + chip row, hero card (title, Lagna row
// with Why?, ⋮ menu with style radios + Legend, chart, birth caption), Planets table rows opening the planet sheet with
// rule ids and Why?, Houses card with 12 Why? rows (N6), Dasha card (strip, Now/Next/Pro rows, Full tree), Sade Sati
// card, computed footer; Moon-chart mode for an unknown-time profile; chart style change persists; nothing from Phase C
// or from unbuilt B05/B07 routes is rendered; +30 % pseudo-locale snapshot with no truncation and no split
// nakshatra+pada (N4). The B04 additions (vargas sheet, unlock flow, yogas, Varshaphal, More from this chart, Timing
// and documents) have their own suite in charts-extras.test.tsx.
import { fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import ChartsScreen from '../app/(tabs)/charts';
import DashaTreeScreen from '../app/charts/dasha-tree';
import CalculationScreen from '../app/settings/calculation';
import { SAMPLE_AMMA, SAMPLE_PRIYA } from '../src/dev/seed';
import { getProfile, insertProfile } from '../src/db/profiles';
import { getSetting, setSetting } from '../src/db/settings';
import { chartFor, clearChartCache, dashaFor } from '../src/engine-bridge/charts';
import { noBreak } from '../src/components';
import { fmtDate } from '../src/today/format';
import { PixelRatio } from 'react-native';
import { installTestDb } from './helpers/nodeDb';
import { allTexts, renderWithProviders, textOf } from './helpers/render';

const NOW = Date.UTC(2026, 9, 22, 5, 28); // Thu 22 Oct 2026 10:58 IST
const now = () => NOW;

function assertNoTruncation() {
  for (const tx of allTexts()) expect(tx.props.numberOfLines).toBeUndefined();
}

/** Nakshatra + pada pairs ("Revati 4") must be one NoBreak run: a glued pair carries an NBSP, never a plain space. */
function assertPadaGlued() {
  const bad: string[] = [];
  for (const tx of allTexts()) {
    const s = textOf(tx);
    if (/^[A-Za-z.\u0900-\u097F ]+ [1-4]$/.test(s)) bad.push(s);
  }
  expect(bad).toEqual([]);
}

describe('<ChartsScreen>', () => {
  let close: () => void;
  let priyaId: number;
  beforeEach(() => {
    // jest-expo mocks PixelRatio.getFontScale() as 2; the table switches to its large-text layout above 1.15, so pin the
    // regular 1.0x layout here (the large layout has its own test in charts-components.test.tsx).
    jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(1);
    ({ close } = installTestDb());
    clearChartCache();
    priyaId = insertProfile(SAMPLE_PRIYA, new Date(NOW));
    insertProfile(SAMPLE_AMMA, new Date(NOW));
  });
  afterEach(() => {
    globalThis.__PSEUDO_LOCALE__ = undefined;
    close();
  });

  it('renders the pill, five chips, the hero, the tables, dasha, Sade Sati and nothing from a later phase', async () => {
    await renderWithProviders(<ChartsScreen now={now} chartWidth={326} />);
    expect(screen.getByTestId('charts-screen')).toBeTruthy();
    expect(screen.getByTestId('profile-pill')).toBeTruthy();
    expect(screen.getByText('Priya')).toBeTruthy();
    for (const c of ['lagna', 'moon', 'sun', 'chalit', 'D9']) expect(screen.getByTestId(`chip-${c}`)).toBeTruthy();
    expect(screen.getByTestId('chip-lagna').props.accessibilityState.selected).toBe(true);
    expect(textOf(screen.getByTestId('hero-title'))).toBe('D1 Rashi chart');
    expect(screen.getByTestId('lagna-row')).toBeTruthy();
    expect(screen.getByText(/^Lagna Meena/)).toBeTruthy();
    expect(screen.getByTestId('chart')).toBeTruthy();
    expect(screen.getByTestId('chart-svg')).toBeTruthy();
    expect(screen.getByTestId('chart').props.accessibilityLabel).toMatch(/^North Indian chart, Lagna Meena\. House 1, Meena: Mars, Mercury, Saturn\./);
    expect(textOf(screen.getByTestId('born-caption'))).toMatch(/^Born 14 Mar 1998 · 06:42 · Lucknow · North Indian · Lahiri · Mean node$/);
    // Planet table: Lagna + 9 planets, every dignity tag, Legend button.
    expect(screen.getByTestId('planet-row-lagna')).toBeTruthy();
    expect(screen.getAllByTestId(/^planet-row-/).length).toBe(10);
    expect(screen.getByText('combust')).toBeTruthy();
    expect(screen.getAllByText("friend's sign").length).toBe(3);
    expect(screen.getAllByText('vargottama').length).toBe(3);
    expect(screen.getByText('debilitated')).toBeTruthy();
    expect(screen.getByTestId('legend-button')).toBeTruthy();
    // Houses (N6): 12 rows each with a Why?.
    expect(screen.getAllByTestId(/^house-row-/).length).toBe(12);
    expect(screen.getAllByLabelText(/^Why\? House \d+ · /).length).toBe(12);
    expect(screen.getByText(/^House 1 · Meena$/)).toBeTruthy();
    expect(screen.getByText(/^Lord: Jupiter · In it: Mars, Mercury, Saturn$/)).toBeTruthy();
    // Dasha: maha line, strip, you-are-here, Now/Next/Pro rows, Full tree.
    expect(textOf(screen.getByTestId('dasha-maha-line'))).toMatch(/^Rahu mahadasha · \d+ \w+ 2015 – \d+ \w+ 2033$/);
    expect(textOf(screen.getByTestId('dasha-you-are-here'))).toBe('You are here · 22 Oct 2026');
    expect(screen.getAllByTestId(/^antar-cell-/).length).toBe(9);
    expect(screen.getByTestId('antar-marker')).toBeTruthy();
    expect(textOf(screen.getByTestId('dasha-now'))).toMatch(/Rahu – Ketu/);
    expect(textOf(screen.getByTestId('dasha-next'))).toMatch(/Rahu – Venus/);
    expect(screen.getByTestId('dasha-pro')).toBeTruthy();
    expect(screen.getByTestId('dasha-full-tree')).toBeTruthy();
    // Sade Sati (free) with Why?, phase dates and next event.
    expect(screen.getByTestId('sadesati-state')).toBeTruthy();
    expect(screen.getByText(/^None at present\. Saturn is in Meena, the 7th from your Moon\.$/)).toBeTruthy();
    expect(screen.getByTestId('sadesati-next')).toBeTruthy();
    expect(screen.getByText('How this was computed')).toBeTruthy();
    // B04: the locked "14 more vargas" chip, the Yogas card and "More from this chart" are present (details in
    // charts-extras.test.tsx); B05 flipped the Muhurat finder route flag so the Timing and documents card renders that
    // one row; still not built = not rendered: Prashna (C04), "Share chart card" and the Janam Patri row (B07), ads.
    expect(screen.getByTestId('chip-vargas').props.accessibilityLabel).toBe('14 more vargas, locked');
    expect(screen.getByTestId('yogas-card')).toBeTruthy();
    expect(screen.getByTestId('more-card')).toBeTruthy();
    expect(screen.queryByTestId('varshaphal-card')).toBeNull(); // next solar return is in March, > 30 days away
    expect(screen.queryByText(/Prashna/)).toBeNull();
    // B07: the Janam Patri PDF and Share chart card rows render (route flags on); free tier shows the fallback price.
    expect(screen.getByTestId('timing-card')).toBeTruthy();
    expect(screen.getByTestId('timing-row-muhuratFinder')).toBeTruthy();
    expect(screen.getByTestId('timing-row-janamPatriPdf')).toBeTruthy();
    expect(screen.getByText('₹99 · store price may differ')).toBeTruthy();
    expect(screen.getByTestId('timing-row-shareChartCard')).toBeTruthy();
    expect(screen.queryByText('Ad')).toBeNull();
    assertNoTruncation();
    assertPadaGlued();
  });

  it('chips swap the hero: Moon chart puts Kanya in house 1, Chalit and D9 keep the same component', async () => {
    await renderWithProviders(<ChartsScreen now={now} chartWidth={326} />);
    await fireEvent.press(screen.getByTestId('chip-moon'));
    expect(textOf(screen.getByTestId('hero-title'))).toBe('Moon chart');
    expect(screen.getByTestId('chart').props.accessibilityLabel).toMatch(/House 1, Kanya: Moon\./);
    await fireEvent.press(screen.getByTestId('chip-chalit'));
    expect(textOf(screen.getByTestId('hero-title'))).toBe('Bhava Chalit');
    await fireEvent.press(screen.getByTestId('chip-D9'));
    expect(textOf(screen.getByTestId('hero-title'))).toBe('D9 Navamsa');
    expect(screen.getByTestId('chart-svg')).toBeTruthy();
  });

  it('the ⋮ menu offers North/South/East radios and Legend; a choice persists in settings and re-draws', async () => {
    await renderWithProviders(<ChartsScreen now={now} chartWidth={326} />);
    await fireEvent.press(screen.getByTestId('style-menu-button'));
    expect(screen.getByText('Chart style · also in Settings')).toBeTruthy();
    expect(screen.getByTestId('style-north').props.accessibilityState.checked).toBe(true);
    expect(screen.getByTestId('menu-legend')).toBeTruthy();
    expect(screen.getByTestId('menu-share-card')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('style-south'));
    expect(getSetting('chartStyle')).toBe('south');
    expect(screen.getByTestId('chart').props.accessibilityLabel).toMatch(/^South Indian chart/);
    expect(screen.getByTestId('chart-lagna-mark')).toBeTruthy();
    expect(textOf(screen.getByTestId('born-caption'))).toMatch(/· South Indian ·/);
    // East from Settings is picked up on focus (useFocusEffect runs on mount here).
    setSetting('chartStyle', 'east');
    await renderWithProviders(<ChartsScreen now={now} chartWidth={326} />);
    expect(screen.getByTestId('chart').props.accessibilityLabel).toMatch(/^East Indian chart/);
  });

  it('a planet row opens the planet sheet with sign/house/dignity snippets, rule ids and expanding Why?', async () => {
    await renderWithProviders(<ChartsScreen now={now} chartWidth={326} />);
    await fireEvent.press(screen.getByTestId('planet-row-Ma'));
    expect(screen.getByRole('header', { name: 'Mars in the 1st house (Meena)' })).toBeTruthy();
    expect(screen.getByTestId('sheet-planet-sign')).toBeTruthy();
    expect(screen.getByTestId('sheet-planet-house')).toBeTruthy();
    expect(screen.getByText('Rule mars-meena')).toBeTruthy();
    expect(screen.getByText('Rule mars-1')).toBeTruthy();
    expect(screen.getByTestId('sheet-tag-friend')).toBeTruthy();
    expect(screen.getByTestId('sheet-tag-combust')).toBeTruthy();
    expect(screen.getByText('Rule combust')).toBeTruthy();
    expect(screen.queryByTestId('sheet-planet-sign-rule')).toBeNull();
    await fireEvent.press(screen.getByTestId('sheet-planet-sign-why'));
    expect(screen.getByTestId('sheet-planet-sign-rule')).toBeTruthy();
    expect(screen.getByText('Source')).toBeTruthy();
    // Lagna row opens the lagna sheet.
    await fireEvent.press(screen.getByLabelText('Close'));
    await fireEvent.press(screen.getByTestId('planet-row-lagna'));
    expect(screen.getByTestId('sheet-lagna')).toBeTruthy();
    expect(screen.getByText('Rule lagna-meena')).toBeTruthy();
  });

  it('tapping the chart resolves to a planet or a house; long-press opens the glossary one-liner', async () => {
    await renderWithProviders(<ChartsScreen now={now} chartWidth={326} />);
    const chart = screen.getByTestId('chart');
    // House 6 (Simha, bottom-left triangle) holds only Rahu: a tap at its centroid opens the planet sheet.
    const scale = 326 / 320;
    await fireEvent(chart, 'press', { nativeEvent: { locationX: 80 * scale, locationY: 292 * scale } });
    expect(screen.getByRole('header', { name: 'Rahu in the 6th house (Simha)' })).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Close'));
    // House 2 (Mesha, top-left triangle) is empty: the house sheet opens with "No planet".
    await fireEvent(chart, 'press', { nativeEvent: { locationX: 80 * scale, locationY: 20 * scale } });
    expect(screen.getByRole('header', { name: 'House 2 · Mesha' })).toBeTruthy();
    expect(screen.getByTestId('house-sheet-empty')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Close'));
    // House 1 holds Mars, Mercury, Saturn: its Houses-card row opens the house sheet with one 44 dp row per planet.
    await fireEvent.press(screen.getByTestId('house-open-1'));
    expect(screen.getByRole('header', { name: 'House 1 · Meena' })).toBeTruthy();
    expect(screen.getByTestId('house-sheet-lord')).toBeTruthy();
    expect(screen.getAllByTestId(/^house-sheet-planet-/).length).toBe(3);
    await fireEvent.press(screen.getByTestId('house-sheet-planet-Sa'));
    expect(screen.getByRole('header', { name: 'Saturn in the 1st house (Meena)' })).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Close'));
    // Long-press on an empty house -> the sign's glossary entry.
    await fireEvent(chart, 'longPress', { nativeEvent: { locationX: 80 * scale, locationY: 20 * scale } });
    expect(screen.getByRole('header', { name: /\(Mesha\)$/ })).toBeTruthy();
    expect(textOf(screen.getByTestId('glossary-text')).length).toBeGreaterThan(20);
  });

  it('Legend lists the ten dignity/mark terms; the Pro tag opens the Pro sheet (Go Pro -> /pro); Full tree navigates', async () => {
    await renderWithProviders(<ChartsScreen now={now} chartWidth={326} />);
    await fireEvent.press(screen.getByTestId('legend-button'));
    expect(screen.getAllByTestId(/^legend-item-/).length).toBe(10);
    expect(screen.getByText('Same sign in D1 and D9')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Close'));
    await fireEvent.press(screen.getByTestId('dasha-pro'));
    expect(screen.getByText('This is a Pro feature')).toBeTruthy();
    expect(screen.getByTestId('cap-go-pro')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Close'));
    await fireEvent.press(screen.getByTestId('dasha-full-tree'));
    expect(router.push).toHaveBeenCalledWith(`/charts/dasha-tree?profile=${priyaId}`);
  });

  it('the profile pill switches to Amma and every card follows', async () => {
    await renderWithProviders(<ChartsScreen now={now} chartWidth={326} />);
    await fireEvent.press(screen.getByTestId('profile-pill'));
    expect(screen.getByRole('header', { name: 'Choose a profile' })).toBeTruthy();
    const rows = screen.getAllByTestId(/^pick-profile-/);
    expect(rows.length).toBe(2);
    await fireEvent.press(rows[1]);
    expect(screen.getByText('Amma')).toBeTruthy();
    expect(textOf(screen.getByTestId('born-caption'))).toMatch(/^Born 5 Jul 1970 · 04:30 · Patna/);
  });

  it('Moon-chart mode (unknown time): Moon title, no Lagna row, no Houses card, no Lagna/Chalit chips, dasha kept', async () => {
    insertProfile({ ...SAMPLE_PRIYA, name: 'Unknown', birthTime: null, timeUnknown: true, isSelf: true }, new Date(NOW));
    await renderWithProviders(<ChartsScreen now={now} chartWidth={326} />);
    expect(textOf(screen.getByTestId('hero-title'))).toBe('Moon chart · birth time unknown');
    expect(screen.queryByTestId('lagna-row')).toBeNull();
    expect(screen.getByTestId('moon-chart-row')).toBeTruthy();
    expect(screen.queryByTestId('houses-card')).toBeNull();
    expect(screen.queryByTestId('chip-lagna')).toBeNull();
    expect(screen.queryByTestId('chip-chalit')).toBeNull();
    expect(screen.getByTestId('chip-moon').props.accessibilityState.selected).toBe(true);
    expect(screen.queryByTestId('planet-row-lagna')).toBeNull();
    expect(screen.getAllByTestId(/^planet-row-/).length).toBe(9);
    expect(screen.getByTestId('dasha-card')).toBeTruthy();
    expect(textOf(screen.getByTestId('born-caption'))).toMatch(/^Born 14 Mar 1998 · time unknown · Lucknow/);
    // The Sun is flagged approx by the engine (unknown time): indigo glyph + approx tag in the table.
    expect(screen.getByTestId('planet-tags-Su')).toBeTruthy();
    expect(screen.getAllByLabelText('approx.').length).toBeGreaterThan(0);
  });

  it('Settings -> Calculation recomputes every chart and shows the toast sentence', async () => {
    const priya = getProfile(priyaId)!;
    const before = chartFor(priya);
    await renderWithProviders(<CalculationScreen />);
    await fireEvent.press(screen.getByTestId('ayanamsa-raman'));
    expect(getSetting('ayanamsa')).toBe('raman');
    expect(textOf(screen.getByTestId('recomputed-note'))).toBe('Recomputed for Raman ayanamsa');
    const after = chartFor(priya);
    expect(after.meta.ayanamsa).toBe('raman');
    expect(after).not.toBe(before);
    expect(after.planets[0].longitude).not.toBe(before.planets[0].longitude);
    await fireEvent.press(screen.getByTestId('node-true'));
    expect(textOf(screen.getByTestId('recomputed-note'))).toBe('Recomputed with the true node');
  });

  it('the full tree: pinned you-are-here header, current maha/antar expanded, pratyantar rows locked with a Pro tag', async () => {
    await renderWithProviders(<DashaTreeScreen now={now} profileId={priyaId} />);
    expect(screen.getByTestId('screen-pinned')).toBeTruthy();
    expect(textOf(screen.getByTestId('dasha-here'))).toMatch(/^You are here · 22 Oct 2026Rahu – Ketu$/);
    expect(screen.getAllByTestId(/^maha-/).length).toBeGreaterThanOrEqual(9);
    expect(screen.getByTestId('maha-Ra').props.accessibilityState.expanded).toBe(true);
    expect(screen.getAllByTestId(/^antar-Ra-/).length).toBe(9);
    expect(screen.getByTestId('antar-Ra-Ke').props.accessibilityState.expanded).toBe(true);
    const praty = screen.getAllByTestId(/^pratyantar-Ke-/);
    expect(praty.length).toBe(9);
    expect(screen.getAllByText('Pro').length).toBe(9);
    await fireEvent.press(praty[0]);
    expect(screen.getByText('This is a Pro feature')).toBeTruthy();
    // Dates equal the engine tree (F14 acceptance).
    const tree = dashaFor(chartFor(getProfile(priyaId)!));
    const ra = tree.mahas.find((m) => m.lord === 'Ra')!;
    expect(textOf(screen.getByTestId('maha-Ra'))).toContain(noBreak(fmtDate(ra.start, 'Asia/Kolkata', 'en')));
    expect(textOf(screen.getByTestId('maha-Ra'))).toContain(noBreak(fmtDate(ra.end, 'Asia/Kolkata', 'en')));
    const ke = ra.children!.find((a) => a.lord === 'Ke')!;
    expect(textOf(screen.getByTestId('antar-Ra-Ke'))).toContain(noBreak(fmtDate(ke.end, 'Asia/Kolkata', 'en')));
    assertNoTruncation();
  });

  for (const lang of ['en', 'hi', 'bho'] as const) {
    it(`pseudo-locale +30 % (${lang}): nothing truncates, table headers wrap, nakshatra+pada never split`, async () => {
      globalThis.__PSEUDO_LOCALE__ = true;
      const tree = await renderWithProviders(<ChartsScreen now={now} chartWidth={296} />, { lang });
      expect(screen.getByTestId('planet-table')).toBeTruthy();
      assertNoTruncation();
      assertPadaGlued();
      expect(allTexts().length).toBeGreaterThan(60);
      if (lang === 'en') expect(tree.toJSON()).toMatchSnapshot();
    });
  }
});
