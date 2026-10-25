// F5 band: geometry mapping (minutes -> x, day 75 % / night 25 %), label visibility at fontScale 1.0 / 1.3 (N3), the
// legend listing only present colours with the Night "(pattern = verdict)" note (N1), and the band's text alternative.
import { screen } from '@testing-library/react-native';
import { DAY_FRACTION, LABEL_MIN_DP, goodHours, panchang, spanWidthDp, type GoodHours } from '@shubhvela/engine';
import { Legend } from '../src/today/Legend';
import { GoodHoursBand } from '../src/today/GoodHoursBand';
import { GoodHoursCard } from '../src/today/GoodHoursCard';
import { bandA11yText, bandLabels, markerX, spanRects, tickMarks } from '../src/today/bandGeometry';
import { flagsText } from '../src/today/FlagsLine';
import { makeT } from '../src/i18n';
import { renderWithProviders } from './helpers/render';

const DELHI = { lat: 28.6139, lon: 77.209 };
const TZ = 'Asia/Kolkata';
const DAY = '2026-10-22';
const WIDTH = 326;
const t = makeT('en');

let gh: GoodHours;
beforeAll(() => {
  gh = goodHours(DAY, DELHI, TZ);
});

describe('band geometry', () => {
  it('maps sunrise to 0, sunset to 75 % and next sunrise to the full width', () => {
    const ticks = gh.ticks!;
    expect(markerX(ticks.sunrise, ticks, WIDTH)).toBe(0);
    expect(markerX(ticks.sunset, ticks, WIDTH)).toBeCloseTo(DAY_FRACTION * WIDTH, 6);
    expect(markerX(ticks.nextSunrise, ticks, WIDTH)).toBe(WIDTH);
    // Local noon (Abhijit centre) sits at half the daylight = 37.5 %.
    expect(markerX(ticks.noon, ticks, WIDTH)).toBeCloseTo((DAY_FRACTION / 2) * WIDTH, 0);
  });

  it('span rectangles tile the band without gaps: day spans end at 75 %, night spans fill the last 25 %', () => {
    const rects = spanRects(gh, WIDTH);
    expect(rects.length).toBe(gh.spans.length);
    let x = 0;
    for (const r of rects) {
      expect(r.x).toBeCloseTo(x, 6);
      x += r.w;
    }
    expect(x).toBeCloseTo(WIDTH, 6);
    const dayWidth = rects.filter((r) => !r.span.night).reduce((s, r) => s + r.w, 0);
    expect(dayWidth).toBeCloseTo(DAY_FRACTION * WIDTH, 6);
    // Night minutes are compressed: a night minute is narrower than a day minute.
    const ticks = gh.ticks!;
    const dayPerMin = (DAY_FRACTION * WIDTH) / ((ticks.sunset - ticks.sunrise) / 60000);
    const nightPerMin = ((1 - DAY_FRACTION) * WIDTH) / ((ticks.nextSunrise - ticks.sunset) / 60000);
    expect(nightPerMin).toBeLessThan(dayPerMin);
  });

  it('tick row carries sunrise, noon, sunset and next sunrise', () => {
    const marks = tickMarks(gh.ticks!, WIDTH, TZ);
    expect(marks.map((m) => m.align)).toEqual(['left', 'center', 'center', 'right']);
    expect(marks[0].text).toMatch(/^\d\d:\d\d$/);
    expect(marks[3].x).toBe(WIDTH);
  });
});

describe('inline labels (N3)', () => {
  it('a span between 60 and 78 dp is labelled at fontScale 1.0 and hidden at 1.3', () => {
    const widths = gh.spans.map((s) => spanWidthDp(s, gh.ticks!, WIDTH));
    const between = gh.spans.filter((_, i) => widths[i] >= LABEL_MIN_DP && widths[i] < LABEL_MIN_DP * 1.3);
    expect(between.length).toBeGreaterThan(0);
    const at10 = bandLabels(gh, WIDTH, 1.0, t);
    const at13 = bandLabels(gh, WIDTH, 1.3, t);
    for (const span of between) {
      expect(at10.some((l) => l.span === span)).toBe(true);
      expect(at13.some((l) => l.span === span)).toBe(false);
    }
    // Every labelled span is at least the threshold wide; narrower spans never get a label (hidden, not clipped).
    for (const l of at13) expect(l.w).toBeGreaterThanOrEqual(LABEL_MIN_DP * 1.3);
    for (const l of at10) expect(l.text.length).toBeGreaterThan(0);
  });

  it('at 390 dp no single 84-minute segment reaches 60 dp, so labels are verdict words', () => {
    const labels = bandLabels(gh, WIDTH, 1.0, t);
    expect(labels.length).toBeGreaterThan(0);
    for (const l of labels) expect(['Good', 'Neutral', 'Avoid']).toContain(l.text);
  });

  it('on a wide band (tablet) a span whose every reason is >= 60 dp is labelled with the reason names', () => {
    const labels = bandLabels(gh, 2000, 1.0, t);
    expect(labels.some((l) => !['Good', 'Neutral', 'Avoid'].includes(l.text))).toBe(true);
  });
});

describe('accessibility text', () => {
  it('reads every merged span with its reasons, marks the night and ends with now and the flags', () => {
    const nowMs = Date.UTC(2026, 9, 22, 5, 28); // 10:58 IST
    const text = bandA11yText(gh, nowMs, t, flagsText(gh, t, 'en'));
    expect(text.startsWith('Good hours band.')).toBe(true);
    expect(text).toContain('Night:');
    expect(text).toContain('Now 10:58.');
    expect(text).toContain('Panchak');
    expect(text).toMatch(/Avoid \d\d:\d\d to \d\d:\d\d \(/);
  });
});

describe('<GoodHoursBand>', () => {
  it('renders one image with the generated label, one rect per span, the now-marker and the moonrise tick', async () => {
    const nowMs = Date.UTC(2026, 9, 22, 5, 28);
    await renderWithProviders(<GoodHoursBand gh={gh} nowMs={nowMs} flagsText={null} width={WIDTH} fontScale={1} />);
    const band = screen.getByTestId('good-hours-band');
    expect(band.props.accessibilityRole).toBe('image');
    expect(band.props.accessibilityLabel).toContain('Good hours band.');
    expect(screen.getAllByTestId(/^band-span-\d+$/).length).toBe(gh.spans.length);
    expect(screen.getByTestId('band-now-marker')).toBeTruthy();
    // The now-time label is decorative for TalkBack (the band's label already says "Now 10:58"), hence hidden.
    expect(screen.getByTestId('band-now-time', { includeHiddenElements: true }).props.children).toBe('10:58');
    if (gh.ticks!.moonrise !== null) expect(screen.getByTestId('band-moonrise')).toBeTruthy();
    const labels = screen.queryAllByTestId('band-label');
    expect(labels.length).toBe(bandLabels(gh, WIDTH, 1, t).length);
  });

  it('hides the now-marker when the instant is outside the Vedic day', async () => {
    await renderWithProviders(<GoodHoursBand gh={gh} nowMs={gh.ticks!.sunrise - 3600_000} flagsText={null} width={WIDTH} fontScale={1} />);
    expect(screen.queryByTestId('band-now-marker')).toBeNull();
  });
});

describe('polar day (design 11)', () => {
  it('replaces the band with the no-sun text and keeps the panchang usable by city', async () => {
    const tromso = { lat: 69.65, lon: 18.96 };
    const ghPolar = goodHours('2026-12-21', tromso, 'Europe/Oslo');
    const pPolar = panchang('2026-12-21', tromso, 'Europe/Oslo');
    expect(ghPolar.noSun).toBe(true);
    expect(ghPolar.spans).toEqual([]);
    expect(pPolar.tithi).toBeTruthy();
    await renderWithProviders(<GoodHoursCard gh={ghPolar} panchang={pPolar} nowMs={Date.UTC(2026, 11, 21, 11)} expanded={false} onToggleExpanded={() => {}} />);
    expect(screen.getByText('No sunrise or sunset at this latitude today; the panchang is shown by city instead.')).toBeTruthy();
    expect(screen.queryByTestId('good-hours-band')).toBeNull();
    expect(screen.queryByTestId('segments-toggle')).toBeNull();
  });
});

describe('<Legend>', () => {
  it('shows only the colours present today and the Night "(pattern = verdict)" note', async () => {
    await renderWithProviders(<Legend legend={['good', 'avoid', 'night']} />);
    expect(screen.getByText('Good')).toBeTruthy();
    expect(screen.getByText('Avoid')).toBeTruthy();
    expect(screen.queryByText('Neutral')).toBeNull();
    expect(screen.getByText('Night (pattern = verdict)')).toBeTruthy();
    expect(screen.queryAllByTestId(/^legend-/).length).toBe(3);
  });

  it("today's legend equals the engine's legend for the spans (R2-2)", async () => {
    await renderWithProviders(<Legend legend={gh.legend} />);
    for (const c of gh.legend) expect(screen.getByTestId(`legend-${c}`)).toBeTruthy();
    const present = new Set(gh.spans.map((s) => (s.night ? 'night' : s.verdict)));
    expect(new Set(gh.legend)).toEqual(present);
  });
});
