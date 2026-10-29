// Unit tests for the D02 building blocks that do not need a full build: the band renderer (same spans/patterns/N3
// labels as the app's GoodHoursBand), the monthly roll-forward calendar, the vrat slugs and the muhurat row renderer.
import { describe, expect, it } from 'vitest';
import { goodHours, bandPosition, labelFor } from '../../packages/engine/src/panchang/index.ts';
import { formatInZone, utcToWall } from '../../packages/engine/src/tz/index.ts';
import * as locale from '../../packages/engine/src/locale/index.ts';
import { bandA11yText, bandLabels, bandSvg, bandTickTexts, fillTokenFor, flagSentences, patternTokenFor } from '../src/band-svg.mjs';
import { buildCalendar, monthLabel } from '../src/data/panchang.mjs';
import { monthDates } from '../src/dates.mjs';
import { vratSlug } from '../src/data/vrats.mjs';
import { tr } from '../src/i18n.mjs';

const engine = { goodHours, bandPosition, labelFor, formatInZone, utcToWall, locale };
const DELHI = { lat: 28.6139, lon: 77.209 };
const TZ = 'Asia/Kolkata';

describe('band-svg (design.md 10.2; A03 sample truths for 2026-10-22 at Delhi)', () => {
  const gh = goodHours('2026-10-22', DELHI, TZ);
  const t = tr('en');

  it('maps verdicts to the app fills and patterns: good = saffron + dots, avoid = hatch, neutral plain, night = indigo with the pattern', () => {
    expect(fillTokenFor({ verdict: 'good', night: false })).toBe('good');
    expect(fillTokenFor({ verdict: 'avoid', night: false })).toBe('avoid');
    expect(fillTokenFor({ verdict: 'neutral', night: false })).toBe('neutral');
    expect(fillTokenFor({ verdict: 'good', night: true })).toBe('night');
    expect(patternTokenFor({ verdict: 'good', night: false })).toBe('dots');
    expect(patternTokenFor({ verdict: 'avoid', night: false })).toBe('hatch');
    expect(patternTokenFor({ verdict: 'neutral', night: false })).toBeNull();
    expect(patternTokenFor({ verdict: 'good', night: true })).toBe('dotsNight');
    expect(patternTokenFor({ verdict: 'avoid', night: true })).toBe('hatchNight');
  });

  it('web mode: percentage geometry, one rect per span, patterns from the tokens, tick row, a11y label with the merged spans', () => {
    const svg = bandSvg(engine, gh, { mode: 'web', t, lang: 'en', id: 'x', ariaLabel: bandA11yText(engine, gh, t, null) });
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" width="100%"')).toBe(true);
    expect((svg.match(/<rect class="sp-(good|avoid|neutral|night)" x="[\d.]+%"/g) ?? []).length).toBe(gh.spans.length);
    expect(svg).toContain('fill="url(#x-hatch)"');
    expect(svg).toContain('fill="url(#x-dots)"');
    expect(svg).toContain('<circle class="pd" cx="3" cy="3" r="1.1"/>');
    expect(svg).toContain('d="M-2 2L2 -2M0 8L8 0M6 10L10 6" stroke-width="1.4"');
    // Tick row: sunrise, noon, sunset, next sunrise as HH:mm.
    const ticks = [...svg.matchAll(/<text class="tkt num"[^>]*>(\d\d:\d\d)<\/text>/g)].map((m) => m[1]);
    expect(ticks).toEqual(bandTickTexts(engine, gh).map((x) => x.text));
    expect(ticks[0]).toBe('06:26');
    // Daylight = 75 % of the width (DAY_FRACTION): the sunset tick sits at 75 %.
    expect(svg).toContain('x1="75%"');
    expect(svg).toContain('aria-label="Good hours band. Avoid 06:26 to 10:40 (Yamaganda, Rog choghadiya, Gulika, Udveg choghadiya).');
    // No "now" marker on a static page.
    expect(svg).not.toContain('class="now"');
    // The moonrise tick (15:21) sits on the top edge.
    expect(svg).toContain('class="moon"');
  });

  it('N3 labels come from engine.labelFor at the nominal width: reason names when every reason is >= 60 dp, else the verdict word, else hidden', () => {
    const labels = bandLabels(engine, gh, 326, 1, t);
    expect(labels.length).toBeGreaterThan(0);
    expect(labels.length).toBeLessThan(gh.spans.length);
    for (const l of labels) {
      const lab = labelFor(l.span, gh, 326, 1);
      expect(lab).not.toBeNull();
      if (lab.kind === 'verdict') expect(l.text).toBe(t(`band.${lab.verdict}_band`));
      else expect(l.text.split(' · ').length).toBe(lab.segments.length);
    }
    // The 06:26-10:40 avoid span (28 % of 326 dp = 91 dp) shows the verdict word: four reasons cannot each have 60 dp.
    const first = labels.find((l) => l.span === gh.spans[0]);
    expect(first.text).toBe(t('band.avoid_band'));
    // A wider nominal band shows more labels, never fewer.
    expect(bandLabels(engine, gh, 1000, 1, t).length).toBeGreaterThanOrEqual(labels.length);
  });

  it('standalone mode (OG): fixed width, inline light-palette fills, no text', () => {
    const svg = bandSvg(engine, gh, { mode: 'standalone', width: 1000, stripHeight: 44, ticksRow: false, id: 'og' });
    expect(svg).toContain('width="1000" height="44" viewBox="0 0 1000 44"');
    expect(svg).toContain('fill="#C57030"');
    expect(svg).toContain('fill="#2E2A6E"');
    expect(svg).not.toContain('<text');
  });

  it('flags are sentences, never colours: Panchak + Bhadra on earth on 2026-10-22', () => {
    const flags = flagSentences(engine, gh, t, 'en');
    expect(flags.length).toBe(2);
    expect(flags[0]).toMatch(/^Panchak till /);
    expect(flags[1]).toMatch(/^Bhadra on earth \d\d:\d\d–\d\d:\d\d/);
    expect(bandA11yText(engine, gh, t, flags.join(' · '))).toMatch(/Flags: Panchak till .*\.$/);
  });
});

describe('monthly roll-forward (build date in Asia/Kolkata)', () => {
  it('derives today, current month, next month and 12 rolling months from the build instant in IST', () => {
    // 2026-10-31 20:00 UTC = 2026-11-01 01:30 IST: the IST date already belongs to November.
    const cal = buildCalendar(engine, Date.UTC(2026, 9, 31, 20, 0));
    expect(cal.today).toBe('2026-11-01');
    expect(cal.currentMonth).toBe('2026-11');
    expect(cal.nextMonth).toBe('2026-12');
    expect(cal.year).toBe(2026);
    expect(cal.months12).toHaveLength(12);
    expect(cal.months12[0]).toBe('2026-11');
    expect(cal.months12[1]).toBe('2026-12');
    expect(cal.months12[2]).toBe('2027-01');
    expect(cal.months12[11]).toBe('2027-10');
    // The cron fires 03:23 UTC on the 1st = 08:53 IST: the new month everywhere in IST.
    const cron = buildCalendar(engine, Date.UTC(2027, 0, 1, 3, 23));
    expect(cron.currentMonth).toBe('2027-01');
    expect(cron.nextMonth).toBe('2027-02');
    expect(monthDates('2027-02')).toHaveLength(28);
    expect(monthDates('2028-02')).toHaveLength(29);
    expect(monthLabel(engine, '2026-11', 'en')).toBe('November 2026');
    expect(monthLabel(engine, '2026-11', 'hi')).toMatch(/2026$/);
  });

  it('vrat family slugs are kebab-case', () => {
    expect(vratSlug('vinayakaChaturthi')).toBe('vinayaka-chaturthi');
    expect(vratSlug('masikShivaratri')).toBe('masik-shivaratri');
    expect(vratSlug('ekadashi')).toBe('ekadashi');
  });
});
