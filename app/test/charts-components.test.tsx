// Chart component and card units (plan A11 tests): all three styles render every glyph inside its house polygon from
// layout output; labelSize >= 12 sp at 296 dp (360 dp card); hitTest maps a tap on a glyph centre to the planet, on
// empty space to the house and an ambiguous pair to the house; PlanetTable column widths sum to 100 % and a planet with
// combust + friend + vargottama shows every tag; DashaCard hides labels in cells < 28 dp; duration/position helpers.
import { fireEvent, screen } from '@testing-library/react-native';
import { computeChart, layout, pointInPolygon, type ChartData, type ChartPlanet } from '@shubhvela/engine';
import { Chart, resolveLongPress, resolvePress } from '../src/charts/Chart';
import { DashaCard, stripA11y } from '../src/charts/DashaCard';
import { ANTAR_LABEL_MIN_DP, antarCells, chipsFor, chartForChip, durationText, fmtBirthDate, heroTitle, nextAntar, shortPlace, tagsFor } from '../src/charts/model';
import { COLUMN_WIDTHS, PlanetTable, tagLabels } from '../src/charts/PlanetTable';
import { episodeToShow, sadeSatiRuleId } from '../src/charts/SadeSatiCard';
import { dashaFor, sadeSatiFor } from '../src/engine-bridge/charts';
import { makeT } from '../src/i18n';
import { renderWithProviders } from './helpers/render';

const PRIYA = computeChart({ date: '1998-03-14', time: '06:42', tz: 'Asia/Kolkata', lat: 26.85, lon: 80.95 }, { ayanamsa: 'lahiri', node: 'mean' });
const UNKNOWN = computeChart({ date: '1998-03-14', timeUnknown: true, tz: 'Asia/Kolkata', lat: 26.85, lon: 80.95 });
const NOW = Date.UTC(2026, 9, 22, 5, 28);
const t = makeT('en');

describe('Chart geometry (engine layout -> SVG)', () => {
  for (const style of ['north', 'south', 'east'] as const) {
    it(`${style}: every glyph centre lies inside its house polygon and labelSize >= 12 sp at 296 dp`, async () => {
      const lay = layout(style, PRIYA, 1, 296, { lang: 'en' });
      // 12 sp floor: user-unit size x scale = rendered sp.
      expect(lay.labelSize * lay.scale).toBeGreaterThanOrEqual(12 - 1e-9);
      for (const g of lay.glyphs) {
        const house = lay.houses.find((h) => h.n === g.house)!;
        expect(pointInPolygon(g.x, g.y, house.polygon)).toBe(true);
        expect(g.size * lay.scale).toBeGreaterThanOrEqual(12 - 1e-9);
      }
      expect(lay.glyphs.length + lay.badges.reduce((n, b) => n + b.count, 0)).toBe(9);
      await renderWithProviders(<Chart style={style} chart={PRIYA} width={296} fontScale={1} styleName={style} testID="c" />);
      expect(screen.getByTestId('chart-svg')).toBeTruthy();
      expect(screen.getAllByTestId(/^chart-glyph-/).length).toBe(lay.glyphs.length);
      expect(screen.getAllByTestId(/^chart-label-/).length).toBe(12);
      if (style === 'south') expect(screen.getByTestId('chart-lagna-mark')).toBeTruthy();
    });
  }

  it('hitTest: glyph centre -> planet, empty house -> house, two centres within 12 dp -> house (ambiguous)', () => {
    const lay = layout('north', PRIYA, 1, 326, { lang: 'en' });
    const rahu = lay.glyphs.find((g) => g.planetId === 'Ra')!;
    expect(resolvePress(lay, rahu.x * lay.scale, rahu.y * lay.scale)).toEqual({ kind: 'planet', id: 'Ra', house: 6, sign: 5 });
    const empty = lay.houses.find((h) => h.planets.length === 0)!;
    expect(resolvePress(lay, empty.centroid[0] * lay.scale, empty.centroid[1] * lay.scale)).toEqual({ kind: 'house', house: empty.n, sign: empty.sign });
    // House 1 holds three glyphs: the midpoint of the two closest centres (within 12 dp each) is ambiguous.
    const h1 = lay.glyphs.filter((g) => g.house === 1);
    let best: [number, number, number] = [Infinity, 0, 0];
    for (let i = 0; i < h1.length; i++) for (let j = i + 1; j < h1.length; j++) {
      const d = Math.hypot(h1[i].x - h1[j].x, h1[i].y - h1[j].y);
      if (d < best[0]) best = [d, i, j];
    }
    const mx = (h1[best[1]].x + h1[best[2]].x) / 2;
    const my = (h1[best[1]].y + h1[best[2]].y) / 2;
    expect((best[0] / 2) * lay.scale).toBeLessThanOrEqual(12);
    expect(resolvePress(lay, mx * lay.scale, my * lay.scale)).toEqual({ kind: 'house', house: 1, sign: 12 });
    // Outside every house (the frame corner beyond the diamond is still house 2/3... use a point off the canvas).
    expect(resolvePress(lay, -5, -5)).toBeNull();
    // Long-press: planet under the touch, else the sign.
    expect(resolveLongPress(lay, rahu.x * lay.scale, rahu.y * lay.scale)).toEqual({ kind: 'planet', id: 'Ra', house: 6 });
    expect(resolveLongPress(lay, empty.centroid[0] * lay.scale, empty.centroid[1] * lay.scale)).toEqual({ kind: 'sign', sign: empty.sign, house: empty.n });
  });

  it('the component forwards presses through hitTest and draws approx glyphs in indigo', async () => {
    const onPlanet = jest.fn();
    const onHouse = jest.fn();
    const onLong = jest.fn();
    await renderWithProviders(<Chart style="north" chart={PRIYA} width={326} fontScale={1} styleName="North Indian" onPressPlanet={onPlanet} onPressHouse={onHouse} onLongPress={onLong} testID="c" />);
    const lay = layout('north', PRIYA, 1, 326, { lang: 'en' });
    const rahu = lay.glyphs.find((g) => g.planetId === 'Ra')!;
    await fireEvent(screen.getByTestId('c'), 'press', { nativeEvent: { locationX: rahu.x * lay.scale, locationY: rahu.y * lay.scale } });
    expect(onPlanet).toHaveBeenCalledWith('Ra', 6);
    const empty = lay.houses.find((h) => h.planets.length === 0)!;
    await fireEvent(screen.getByTestId('c'), 'press', { nativeEvent: { locationX: empty.centroid[0] * lay.scale, locationY: empty.centroid[1] * lay.scale } });
    expect(onHouse).toHaveBeenCalledWith(empty.n, empty.sign);
    await fireEvent(screen.getByTestId('c'), 'longPress', { nativeEvent: { locationX: empty.centroid[0] * lay.scale, locationY: empty.centroid[1] * lay.scale } });
    expect(onLong).toHaveBeenCalledWith({ kind: 'sign', sign: empty.sign, house: empty.n });
    // The Sun is within 1 deg of a sign boundary (approx): indigo, not ink.
    const sun = screen.getByTestId('chart-glyph-Su');
    const moon = screen.getByTestId('chart-glyph-Mo');
    expect(PRIYA.planets.find((p) => p.id === 'Su')!.approx).toBe(true);
    expect(sun.props.fill).not.toEqual(moon.props.fill);
    expect(layout('north', PRIYA, 1, 326).glyphs.find((g) => g.planetId === 'Su')!.approx).toBe(true);
    expect(screen.getByTestId('c').props.accessibilityLabel).toMatch(/^North Indian chart, Lagna Meena\./);
  });

  it('Devanagari glyphs use Tiro at 14.5 u and the centre lines render for South/East', async () => {
    await renderWithProviders(<Chart style="south" chart={PRIYA} width={326} fontScale={1} styleName="दक्षिण" centreLines={['Priya', 'Lahiri · mean']} testID="c" />, { lang: 'hi' });
    const glyph = screen.getByTestId('chart-glyph-Mo');
    expect(glyph.props.font?.fontFamily ?? glyph.props.fontFamily).toBe('TiroDevanagariHindi');
    const lay = layout('south', PRIYA, 1, 326, { lang: 'hi' });
    expect(lay.glyphs.find((g) => g.planetId === 'Mo')!.text).toBe('चं');
    expect(lay.glyphSize * lay.scale).toBeCloseTo(14.5, 6);
    expect(glyph.props.font?.fontSize ?? glyph.props.fontSize).toBeCloseTo(lay.glyphs.find((g) => g.planetId === 'Mo')!.size, 6);
    expect(screen.getAllByTestId('chart-centre').length).toBe(2);
  });
});

describe('PlanetTable', () => {
  it('column widths sum to 100 % and a combust + friend + vargottama planet shows every tag', async () => {
    expect(COLUMN_WIDTHS.reduce((a, b) => a + b, 0)).toBe(100);
    const mars = PRIYA.planets.find((p) => p.id === 'Ma')!;
    const synthetic: ChartPlanet = { ...mars, tags: ['friend', 'combust', 'vargottama'], retrograde: true, approx: true };
    expect(tagLabels(synthetic, t).map((x) => x.label)).toEqual(["friend's sign", 'combust', 'vargottama', 'approx.']);
    expect(tagsFor({ tags: ['vargottama', 'retro', 'exalted'], approx: false })).toEqual(['exalted', 'retro', 'vargottama']);
    const chart: ChartData = { ...PRIYA, planets: PRIYA.planets.map((p) => (p.id === 'Ma' ? synthetic : p)) };
    const onPress = jest.fn();
    await renderWithProviders(<PlanetTable chart={chart} approxMinutes={30} onPressRow={onPress} testID="pt" />);
    const tags = screen.getByTestId('planet-tags-Ma');
    expect(tags.children.length).toBe(4);
    // Mars (synthetic) and the Sun (within 1 deg of a boundary) both carry the approx tag.
    expect(screen.getAllByLabelText('approx. ±30 min').length).toBe(2);
    expect(screen.getAllByTestId(/^planet-row-/).length).toBe(10);
    await fireEvent.press(screen.getByTestId('planet-row-Ma'));
    expect(onPress).toHaveBeenCalledWith({ kind: 'planet', id: 'Ma' });
    await fireEvent.press(screen.getByTestId('planet-row-lagna'));
    expect(onPress).toHaveBeenCalledWith({ kind: 'lagna' });
    // Fixed widths on every cell of the header.
    const row = screen.getByTestId('planet-row-Ma');
    const widths = row.children.map((c) => (c as unknown as { props: { style: { width: string } } }).props.style.width);
    expect(widths).toEqual(['31%', '36%', '33%']);
  });

  it('Moon-chart mode has no Lagna row', async () => {
    await renderWithProviders(<PlanetTable chart={UNKNOWN} approxMinutes={0} onPressRow={() => {}} testID="pt" />);
    expect(screen.queryByTestId('planet-row-lagna')).toBeNull();
    expect(screen.getAllByTestId(/^planet-row-/).length).toBe(9);
  });
});

describe('Dasha card and model', () => {
  const tree = dashaFor(PRIYA);

  it('antar cells are proportional, the current one is marked and labels hide below 28 dp', () => {
    const maha = tree.mahas.find((m) => m.start <= NOW && NOW < m.end)!;
    const cells = antarCells(maha, NOW, 326);
    expect(cells.length).toBe(9);
    expect(cells.reduce((a, c) => a + c.width, 0)).toBeCloseTo(326, 6);
    expect(cells.filter((c) => c.current).length).toBe(1);
    expect(cells.find((c) => c.current)!.node.lord).toBe('Ke');
    // At 326 dp the Sun antar of a Rahu maha (6/120 of 18 y) is 326 x 0.9 / 18 = 16.3 dp -> no label.
    const sun = cells.find((c) => c.node.lord === 'Su')!;
    expect(sun.width).toBeLessThan(ANTAR_LABEL_MIN_DP);
    expect(sun.label).toBe(false);
    expect(cells.find((c) => c.node.lord === 'Ra')!.label).toBe(true);
    const narrow = antarCells(maha, NOW, 120);
    expect(narrow.filter((c) => c.label).length).toBeLessThan(cells.filter((c) => c.label).length);
    const a11y = stripA11y(maha, NOW, 'Asia/Kolkata', 'en', t);
    expect(a11y).toMatch(/^Antardasha strip of the Rahu mahadasha: /);
    expect(a11y).toContain('Sun');
    expect(a11y).toContain('(current)');
  });

  it('renders the card: labelled cells only when wide enough, Now/Next rows with Why?, Pro row', async () => {
    await renderWithProviders(<DashaCard chart={PRIYA} tree={tree} nowMs={NOW} tz="Asia/Kolkata" ayanamsaLabel="Lahiri" onFullTree={() => {}} onPressPro={() => {}} width={326} testID="dc" />);
    expect(screen.getAllByTestId(/^antar-cell-/).length).toBe(9);
    expect(screen.queryByTestId('antar-label-Su')).toBeNull();
    expect(screen.getByTestId('antar-label-Ra')).toBeTruthy();
    const cells = antarCells(tree.mahas.find((m) => m.start <= NOW && NOW < m.end)!, NOW, 326);
    expect(screen.getAllByTestId(/^antar-label-/).length).toBe(cells.filter((c) => c.label).length);
    expect(screen.getAllByLabelText(/^Why\? (Now|Next):/).length).toBe(2);
    expect(screen.getByText('Pratyantar dasha and change notifications')).toBeTruthy();
    expect(screen.getByText('Pro')).toBeTruthy();
    const next = nextAntar(tree, NOW)!;
    expect(next.antar.lord).toBe('Ve');
    expect(next.maha.lord).toBe('Ra');
  });

  it('durationText, fmtBirthDate, shortPlace, chips, hero titles', () => {
    expect(durationText(400 * 86_400_000, t)).toBe('1 year 1 month 5 days');
    expect(durationText(1 * 86_400_000, t)).toBe('1 day');
    expect(durationText(0, t)).toBe('0 days');
    expect(fmtBirthDate('1998-03-14', 'en')).toBe('14 Mar 1998');
    expect(shortPlace('Lucknow, Uttar Pradesh, India')).toBe('Lucknow');
    expect(chipsFor(PRIYA)).toEqual(['lagna', 'moon', 'sun', 'chalit', 'D9']);
    expect(chipsFor(UNKNOWN)).toEqual(['moon', 'sun', 'D9']);
    expect(heroTitle('lagna', PRIYA, t)).toBe('D1 Rashi chart');
    expect(heroTitle('moon', UNKNOWN, t)).toBe('Moon chart · birth time unknown');
    expect(chartForChip(PRIYA, 'moon').firstHouseSign).toBe(6);
    expect(chartForChip(PRIYA, 'D9')).toBe(chartForChip(PRIYA, 'D9'));
  });

  it('Sade Sati helpers follow the engine state', () => {
    const report = sadeSatiFor(PRIYA, NOW);
    expect(sadeSatiRuleId(report)).toBe('sade-sati-none');
    expect(report.state.kind).toBe('none');
    const ep = episodeToShow(report, NOW)!;
    expect(ep.start).toBeGreaterThan(NOW);
    expect(ep.phases.length).toBeGreaterThanOrEqual(3);
    expect(sadeSatiRuleId({ state: { kind: 'sadesati', phase: 2, start: 0, end: 1 } })).toBe('sade-sati-phase-2');
    expect(sadeSatiRuleId({ state: { kind: 'dhaiya', house: 8, start: 0, end: 1 } })).toBe('dhaiya-8');
  });
});
