import { describe, expect, it } from 'vitest';
import {
  boxInsidePolygon,
  boxesIntersect,
  distanceToPolygonEdges,
  hitTest,
  itemBox,
  layout,
  pointInPolygon,
  type ChartStyle,
} from '../src/chart-layout/index';
import { computeChart, type ChartData } from '../src/kundli/index';
import { PLANET_IDS, type Lang } from '../src/locale/index';

const SAMPLE = computeChart({ date: '1998-03-14', time: '06:42', approxMinutes: 30, tz: 'Asia/Kolkata', lat: 26.85, lon: 80.95 });
const STYLES: ChartStyle[] = ['north', 'south', 'east'];

/** The sample chart with `k` planets forced into house `h` (the rest spread over the other houses). */
function withPlanetsInHouse(h: number, k: number): ChartData {
  const planets = SAMPLE.planets.map((p, i) => ({
    ...p,
    house: i < k ? h : ((h - 1 + 1 + (i - k)) % 12) + 1,
  }));
  return { ...SAMPLE, planets };
}

function allItems(lay: ReturnType<typeof layout>) {
  return [...lay.glyphs, ...lay.badges, ...lay.labels];
}

describe('chart-layout geometry (design 4)', () => {
  it('builds twelve convex houses that tile the frame and carry the right signs', () => {
    for (const style of STYLES) {
      const lay = layout(style, SAMPLE, 1, 390);
      expect(lay.viewBox).toBe(320);
      expect(lay.houses).toHaveLength(12);
      expect(lay.grid.length).toBeGreaterThan(5);
      for (const h of lay.houses) {
        expect(h.sign).toBe(((SAMPLE.firstHouseSign - 1 + h.n - 1) % 12) + 1);
        expect(h.polygon.length).toBeGreaterThanOrEqual(3);
        expect(pointInPolygon(h.centroid[0], h.centroid[1], h.polygon)).toBe(true);
        for (const [x, y] of h.polygon) {
          expect(x).toBeGreaterThanOrEqual(1);
          expect(x).toBeLessThanOrEqual(319);
          expect(y).toBeGreaterThanOrEqual(1);
          expect(y).toBeLessThanOrEqual(319);
        }
      }
      // Houses do not overlap: no centroid of one house lies inside another.
      for (const a of lay.houses) for (const b of lay.houses) if (a !== b) expect(pointInPolygon(a.centroid[0], a.centroid[1], b.polygon)).toBe(false);
    }
  });

  it('North: Lagna sign in the top diamond, signs anticlockwise, numerals 20-24 units inside the inner vertex', () => {
    const lay = layout('north', SAMPLE, 1, 390);
    const h1 = lay.houses[0];
    expect(h1.sign).toBe(SAMPLE.lagna!.sign);
    expect(h1.centroid[0]).toBeCloseTo(160, 5);
    expect(h1.centroid[1]).toBeLessThan(100);
    expect(lay.houses[1].centroid[0]).toBeLessThan(160); // house 2 is the top-left triangle (anticlockwise)
    expect(lay.houses[1].centroid[1]).toBeLessThan(80);
    expect(lay.houses[11].centroid[0]).toBeGreaterThan(160); // house 12 top-right
    const inner = [160, 160];
    const n1 = lay.houses[0].numeralPos;
    expect(Math.hypot(n1[0] - inner[0], n1[1] - inner[1])).toBeGreaterThanOrEqual(20);
    expect(Math.hypot(n1[0] - inner[0], n1[1] - inner[1])).toBeLessThanOrEqual(24);
    expect(lay.labels.find((l) => l.house === 1)!.text).toBe(String(SAMPLE.lagna!.sign));
  });

  it('South: signs fixed clockwise from Meena top-left, Lagna diagonal in the first-house cell, names bottom-left', () => {
    const lay = layout('south', SAMPLE, 1, 390, { lang: 'en' });
    const meena = lay.houses.find((h) => h.sign === 12)!;
    expect(meena.polygon[0]).toEqual([1, 1]);
    const mesha = lay.houses.find((h) => h.sign === 1)!;
    expect(mesha.polygon[0][0]).toBeCloseTo(80.5, 5);
    expect(mesha.polygon[0][1]).toBe(1);
    const karka = lay.houses.find((h) => h.sign === 4)!;
    expect(karka.polygon[0][0]).toBeCloseTo(239.5, 5);
    expect(karka.polygon[0][1]).toBeCloseTo(80.5, 5);
    expect(lay.lagnaMark).toBeDefined();
    const first = lay.houses[0];
    expect(pointInPolygon(lay.lagnaMark!.x1, lay.lagnaMark!.y1, first.polygon)).toBe(true);
    expect(pointInPolygon(lay.lagnaMark!.x2, lay.lagnaMark!.y2, first.polygon)).toBe(true);
    const label = lay.labels.find((l) => l.house === meena.n)!;
    expect(label.kind).toBe('signName');
    expect(label.text).toBe('Meena');
    expect(label.anchor).toBe('start');
    expect(label.y).toBeGreaterThan(meena.polygon[2][1] - 20); // near the bottom of the cell
    const hi = layout('south', SAMPLE, 1, 390, { lang: 'hi' });
    expect(hi.labels.find((l) => l.house === meena.n)!.text).toBe('मीन');
  });

  it('East: SIGN-FIXED 3x3 with split corners — Mesha always top-centre, signs anticlockwise; corner glyphs anchored toward the outer corner', () => {
    // D-SHIP-1 (2026-10-30): the East Indian (Bengali/Odia/Maithili) chart fixes the signs like the South style.
    // A Mesha-Lagna chart puts house 1 at the top centre; the sign cells themselves never move.
    const mesha = { ...withPlanetsInHouse(2, 3), firstHouseSign: 1 };
    const lay = layout('east', mesha, 1, 390);
    expect(lay.houses[0].polygon).toEqual([[107, 1], [213, 1], [213, 107], [107, 107]]);
    expect(lay.houses[1].polygon).toHaveLength(3);
    const g = lay.glyphs.filter((x) => x.house === 2);
    expect(g).toHaveLength(3);
    for (const x of g) expect(x.anchor).toBe('end');
    const g12 = layout('east', { ...withPlanetsInHouse(12, 2), firstHouseSign: 1 }, 1, 390).glyphs.filter((x) => x.house === 12);
    for (const x of g12) expect(x.anchor).toBe('start');
    const diag = lay.grid.filter((l) => l.x1 !== l.x2 && l.y1 !== l.y2);
    expect(diag).toHaveLength(4);
  });

  it('East with a non-Mesha Lagna: cells stay with their signs, houses count anticlockwise from the Lagna cell, Lagna marked', () => {
    // SAMPLE (Priya, Lucknow 1998-03-14 06:42): Lagna Meena (12).
    expect(SAMPLE.firstHouseSign).toBe(12);
    const lay = layout('east', SAMPLE, 1, 390);
    const topCentre = [[107, 1], [213, 1], [213, 107], [107, 107]];
    const topRightInner = [[213, 1], [319, 1], [213, 107]];
    // Mesha (sign 1) is still the top-centre rectangle = house 2 for a Meena Lagna.
    const h2 = lay.houses.find((h) => h.n === 2)!;
    expect(h2.sign).toBe(1);
    expect(h2.polygon).toEqual(topCentre);
    // House 1 (Meena) is the top-right inner triangle and holds the Lagna's planets.
    const h1 = lay.houses.find((h) => h.n === 1)!;
    expect(h1.sign).toBe(12);
    expect(h1.polygon).toEqual(topRightInner);
    expect(h1.planets).toEqual(SAMPLE.planets.filter((p) => p.house === 1).map((p) => p.id));
    for (const g of lay.glyphs.filter((x) => x.house === 1)) expect(pointInPolygon(g.x, g.y, topRightInner as [number, number][])).toBe(true);
    // Every sign's numeral sits in its fixed cell regardless of the Lagna.
    const meshaLay = layout('east', { ...SAMPLE, firstHouseSign: 1 }, 1, 390);
    for (let s = 1; s <= 12; s++) {
      const a = lay.labels.find((l) => l.kind === 'numeral' && l.text === String(s))!;
      const b = meshaLay.labels.find((l) => l.kind === 'numeral' && l.text === String(s))!;
      expect([a.x, a.y]).toEqual([b.x, b.y]);
    }
    // Lagna marker: the numeral "12" in accent plus a 2 px accent underline just below its baseline.
    const lagnaLabel = lay.labels.find((l) => l.kind === 'numeral' && l.house === 1)!;
    expect(lagnaLabel.text).toBe('12');
    expect(lagnaLabel.accent).toBe(true);
    expect(lay.labels.filter((l) => l.accent)).toHaveLength(1);
    expect(lay.lagnaMark).toBeDefined();
    expect(lay.lagnaMark!.y1).toBeCloseTo(lagnaLabel.baseline + 3, 6);
    expect(lay.lagnaMark!.x1).toBeLessThan(lagnaLabel.x);
    expect(lay.lagnaMark!.x2).toBeGreaterThan(lagnaLabel.x);
    // Hit-testing resolves the Meena triangle to house 1 and the Mesha rectangle to house 2.
    expect(hitTest(lay, 280, 20)!.house).toBe(1);
    expect(hitTest(lay, 160, 60)!.house).toBe(2);
  });

  it('text sizes follow size x fontScale / (width / 320); labelSize >= 12 at 296 and 1.0', () => {
    const l296 = layout('north', SAMPLE, 1, 296);
    expect(l296.labelSize).toBeGreaterThanOrEqual(12);
    expect(l296.labelSize * l296.scale).toBeCloseTo(12, 6); // 12 sp rendered
    expect(l296.glyphSize * l296.scale).toBeCloseTo(13.5, 6);
    const hi = layout('north', SAMPLE, 1.3, 412, { lang: 'hi' });
    expect(hi.glyphSize * hi.scale).toBeCloseTo(14.5 * 1.3, 6);
    expect(hi.labelSize * hi.scale).toBeCloseTo(12 * 1.3, 6);
    expect(() => layout('north', SAMPLE, 0, 390)).toThrow();
  });

  it('density steps: 2x2 up to four planets, 3x2 at five or six, badge "+N" beyond six', () => {
    const l4 = layout('north', withPlanetsInHouse(1, 4), 1, 390);
    expect(l4.houses[0].mode).toBe('2x2');
    expect(l4.glyphs.filter((g) => g.house === 1)).toHaveLength(4);
    const rows = new Set(l4.glyphs.filter((g) => g.house === 1).map((g) => g.y.toFixed(3)));
    expect(rows.size).toBe(2);
    const l5 = layout('north', withPlanetsInHouse(1, 5), 1, 390);
    expect(l5.houses[0].mode).toBe('3x2');
    const s5 = l5.glyphs.find((g) => g.house === 1)!.size;
    expect(s5).toBeCloseTo(l5.glyphSize * 0.9, 6);
    const l7 = layout('north', withPlanetsInHouse(1, 7), 1, 390);
    expect(l7.houses[0].mode).toBe('badge');
    expect(l7.mode).toBe('badge');
    expect(l7.badges).toHaveLength(1);
    expect(l7.badges[0].house).toBe(1);
    expect(l7.badges[0].count).toBe(2);
    expect(l7.badges[0].text).toBe('+2');
    expect(l7.houses[0].hidden).toHaveLength(2);
    expect(l7.glyphs.filter((g) => g.house === 1)).toHaveLength(5);
  });

  it('line gap is 18 units at the nominal glyph size (390 dp, 1.0)', () => {
    const lay = layout('north', withPlanetsInHouse(1, 4), 1, 320);
    const ys = [...new Set(lay.glyphs.filter((g) => g.house === 1).map((g) => g.y))].sort((a, b) => a - b);
    expect(ys[1] - ys[0]).toBeCloseTo(18, 6);
    const xs = lay.glyphs.filter((g) => g.house === 1 && g.y === ys[0]).map((g) => g.x);
    expect(Math.abs(xs[1] - xs[0])).toBeGreaterThanOrEqual(18);
    expect(Math.abs(xs[1] - xs[0])).toBeLessThanOrEqual(25);
  });

  it('no glyph, badge or label crosses its house edges or another box: 3 styles x 12 houses x 1..7 planets x 2 scripts x 2 font scales x 2 widths', () => {
    let layouts = 0;
    for (const style of STYLES) {
      for (const h of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) {
        for (let k = 1; k <= 7; k++) {
          const chart = withPlanetsInHouse(h, k);
          for (const lang of ['en', 'hi'] as Lang[]) {
            for (const fontScale of [1, 1.3]) {
              for (const width of [296, 412]) {
                const lay = layout(style, chart, fontScale, width, { lang });
                layouts++;
                // every planet is either a glyph or hidden behind a badge, exactly once
                const shown = lay.glyphs.map((g) => g.planetId);
                const hidden = lay.badges.flatMap((b) => b.hidden);
                expect([...shown, ...hidden].sort()).toEqual([...PLANET_IDS].sort());
                for (const g of [...lay.glyphs, ...lay.badges]) {
                  const house = lay.houses.find((x) => x.n === g.house)!;
                  expect(boxInsidePolygon(itemBox(g), house.polygon), `${style} h${h} k${k} ${lang} ${fontScale} ${width} ${'planetId' in g ? g.planetId : g.text}`).toBe(true);
                  // rendered size never below the 12 sp floor
                  expect(g.size * lay.scale).toBeGreaterThanOrEqual(12 - 1e-9);
                }
                for (const l of lay.labels) {
                  const house = lay.houses.find((x) => x.n === l.house)!;
                  expect(pointInPolygon(l.x, l.y, house.polygon)).toBe(true);
                  expect(distanceToPolygonEdges(l.x, l.y, house.polygon)).toBeGreaterThan(3);
                }
                const items = allItems(lay);
                for (let i = 0; i < items.length; i++) {
                  for (let j = i + 1; j < items.length; j++) {
                    expect(boxesIntersect(itemBox(items[i]), itemBox(items[j])), `${style} h${h} k${k} ${lang} ${fontScale} ${width}: ${items[i].text} vs ${items[j].text}`).toBe(false);
                  }
                }
              }
            }
          }
        }
      }
    }
    expect(layouts).toBe(3 * 12 * 7 * 2 * 2 * 2);
  });

  it('hitTest: planet when unambiguous, house for empty houses, ambiguous for hidden planets or crowded glyphs', () => {
    const lay = layout('north', SAMPLE, 1, 390);
    const g = lay.glyphs.find((x) => x.house === 1)!;
    const hit = hitTest(lay, g.x, g.y);
    expect(hit).toEqual({ house: 1, sign: SAMPLE.lagna!.sign, planetId: g.planetId, ambiguous: false });
    const empty = lay.houses.find((h) => h.planets.length === 0)!;
    expect(hitTest(lay, empty.centroid[0], empty.centroid[1])).toEqual({ house: empty.n, sign: empty.sign, ambiguous: false });
    // Nominal 2x2 glyphs are 24.3 dp apart, so the midpoint (12.15 dp from each) is still unambiguous...
    const same = lay.glyphs.filter((x) => x.house === 1 && x.y === g.y);
    expect(same.length).toBeGreaterThanOrEqual(2);
    const mid = hitTest(lay, (same[0].x + same[1].x) / 2, same[0].y)!;
    expect(mid.ambiguous).toBe(false);
    expect(mid.planetId).toBeDefined();
    // ...but a touch 8 dp from one glyph and 16 dp from the other picks the nearer, and in the denser 3x2
    // mode (21.9 dp apart) the midpoint is within 12 dp of both -> ambiguous.
    const near = hitTest(lay, same[0].x + (8 / lay.scale) * Math.sign(same[1].x - same[0].x), same[0].y)!;
    expect(near.planetId).toBe(same[0].planetId);
    expect(near.ambiguous).toBe(false);
    const dense = layout('north', withPlanetsInHouse(1, 5), 1, 390);
    const row = dense.glyphs.filter((x) => x.house === 1 && x.y === dense.glyphs.find((y) => y.house === 1)!.y);
    const denseMid = hitTest(dense, (row[0].x + row[1].x) / 2, row[0].y)!;
    expect(denseMid.ambiguous).toBe(true);
    const crowded = layout('north', withPlanetsInHouse(1, 7), 1, 390);
    const c = crowded.glyphs.find((x) => x.house === 1)!;
    expect(hitTest(crowded, c.x, c.y)!.ambiguous).toBe(true);
    // Outside every house (South/East centre) -> null.
    expect(hitTest(layout('south', SAMPLE, 1, 390), 160, 160)).toBeNull();
    expect(hitTest(layout('east', SAMPLE, 1, 390), 160, 160)).toBeNull();
  });

  it('approx flags and centre lines reach the renderer', () => {
    const lay = layout('south', SAMPLE, 1, 390, { lang: 'en', centreLines: ['Priya · D1 Rashi', 'Lahiri · mean node'] });
    expect(lay.glyphs.find((g) => g.planetId === 'Su')!.approx).toBe(true);
    expect(lay.glyphs.find((g) => g.planetId === 'Mo')!.approx).toBe(false);
    const centre = lay.labels.filter((l) => l.kind === 'centre');
    expect(centre).toHaveLength(2);
    expect(centre[0].x).toBe(160);
    expect(centre[1].y).toBeGreaterThan(centre[0].y);
  });

  it('East centre lines wrap at " · " so they stay inside the centre cell (b-fix, 360 dp)', () => {
    // 360 dp screen -> card inner width 296; "Lahiri · Mean node" is wider than the 106-unit centre cell.
    for (const width of [296, 326, 348]) {
      const lay = layout('east', SAMPLE, 1, width, { lang: 'en', centreLines: ['Priya', 'Lahiri · Mean node'] });
      const centre = lay.labels.filter((l) => l.kind === 'centre');
      for (const l of centre) {
        expect(l.x - l.width / 2).toBeGreaterThan(107 + 1.5);
        expect(l.x + l.width / 2).toBeLessThan(213 - 1.5);
      }
      expect(centre.map((l) => l.text)).toEqual(width === 296 ? ['Priya', 'Lahiri', 'Mean node'] : expect.arrayContaining(['Priya']));
      expect(centre.length).toBeLessThanOrEqual(3);
    }
    // South has a 2x2 centre block: the same lines stay unsplit.
    const south = layout('south', SAMPLE, 1, 296, { lang: 'en', centreLines: ['Priya', 'Lahiri · Mean node'] });
    expect(south.labels.filter((l) => l.kind === 'centre').map((l) => l.text)).toEqual(['Priya', 'Lahiri · Mean node']);
  });
});
