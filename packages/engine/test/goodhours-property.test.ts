// Band-equals-list property test (design 12, R2-2; plan A03): for 365 consecutive days x 5 cities, for every
// minute of the Vedic day the verdict read from the band spans equals the verdict every covering list row
// claims for that minute; every row has exactly one verdict chip; every colour in the legend occurs in the
// spans and no colour absent from the spans appears in the legend.
import { describe, expect, it } from 'vitest';
import { addDays } from '../src/panchang/astro';
import { goodHours, legendFor, rowVerdictAt, verdictAt, type LegendColour } from '../src/panchang/goodHours';

const CITIES = [
  { name: 'Delhi', lat: 28.6139, lon: 77.209, tz: 'Asia/Kolkata' },
  { name: 'Patna', lat: 25.5941, lon: 85.1376, tz: 'Asia/Kolkata' },
  { name: 'Mumbai', lat: 19.076, lon: 72.8777, tz: 'Asia/Kolkata' },
  { name: 'Chennai', lat: 13.0827, lon: 80.2707, tz: 'Asia/Kolkata' },
  { name: 'London', lat: 51.5074, lon: -0.1278, tz: 'Europe/London' },
];
const START = '2026-01-01';
const DAYS = 365;
const VERDICTS = ['good', 'neutral', 'avoid'] as const;

export const propertyRuntime: Record<string, number> = {};

describe('goodHours band == list property (365 days x 5 cities)', () => {
  for (const city of CITIES) {
    it(`${city.name}: per-minute verdict equality, one chip per row, legend = colours of the spans`, { timeout: 600_000 }, () => {
      const t0 = Date.now();
      let minutes = 0;
      let rows = 0;
      let date = START;
      for (let d = 0; d < DAYS; d++, date = addDays(date, 1)) {
        const gh = goodHours(date, { lat: city.lat, lon: city.lon }, city.tz);
        expect(gh.noSun, `${city.name} ${date} noSun`).toBe(false);
        const ticks = gh.ticks!;
        // Spans partition the Vedic day exactly.
        expect(gh.spans[0].start).toBe(ticks.sunrise);
        expect(gh.spans[gh.spans.length - 1].end).toBe(ticks.nextSunrise);
        for (let i = 1; i < gh.spans.length; i++) expect(gh.spans[i].start).toBe(gh.spans[i - 1].end);
        // One chip per row, in the verdict vocabulary; row extents inside the day.
        for (const row of gh.segments) {
          rows++;
          expect(VERDICTS).toContain(row.verdict);
          expect(row.start).toBeGreaterThanOrEqual(ticks.sunrise);
          expect(row.end).toBeLessThanOrEqual(ticks.nextSunrise);
          expect(row.end).toBeGreaterThan(row.start);
        }
        // Per minute: band verdict equals every covering row's verdict for that minute.
        for (let t = ticks.sunrise; t < ticks.nextSunrise; t += 60_000) {
          const band = verdictAt(gh.spans, t);
          if (band === null) throw new Error(`${city.name} ${date}: no span covers ${new Date(t).toISOString()}`);
          for (const row of gh.segments) {
            if (row.start <= t && t < row.end) {
              const claimed = rowVerdictAt(row, t);
              if (claimed !== band) throw new Error(`${city.name} ${date} ${new Date(t).toISOString()}: row ${row.id} says ${claimed}, band says ${band}`);
            }
          }
          minutes++;
        }
        // Legend: derived from the spans only; every listed colour occurs, every occurring colour is listed.
        const present = new Set<LegendColour>();
        for (const s of gh.spans) present.add(s.night ? 'night' : s.verdict);
        expect(new Set(gh.legend)).toEqual(present);
        expect(gh.legend).toEqual(legendFor(gh.spans));
        // Every minute that is not Avoid or Good is Neutral: the three verdicts exhaust the day (no gaps).
        expect(gh.spans.every((s) => VERDICTS.includes(s.verdict))).toBe(true);
      }
      propertyRuntime[city.name] = Date.now() - t0;
      // 365 Vedic days of ~1440 minutes each.
      expect(minutes).toBeGreaterThan(365 * 1400);
      expect(rows).toBe(365 * 21);
      console.log(`[goodhours-property] ${city.name}: ${DAYS} days, ${minutes} minutes, ${rows} rows checked in ${propertyRuntime[city.name]} ms`);
    });
  }
});
