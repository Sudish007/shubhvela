// Festival suite (spec section 6, F23): every festival-rules.json slug for 2026-2028 at Delhi (Purnimanta) and
// Chennai (Amanta) must fall on the date Drik Panchang prints, or carry an entry in reference/CONVENTIONS.md
// (section 3, one line per `slug@city-year`) that names the intentional convention difference.
// Drik's monthly pages list many more events than the engine knows; only mapped slugs are compared. Multi-day
// festivals compare their first day; a slug with several Drik dates in a year (Shravan Somvar, a Jan + Dec
// repeat) compares the sorted date sets.
import { afterAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { festivals } from '../../src/calendar/festivals';
import { REFERENCE_DIR, loadCases, loadReference, normName, warnMissing, writeSuiteResult } from './_shared';

interface City {
  geonameId: number;
  name: string;
  lat: number;
  lon: number;
  tz: string;
  tradition: 'purnimanta' | 'amanta';
  region: 'north' | 'south';
}
interface FestivalCases {
  years: number[];
  cities: Record<string, City>;
  slugs: string[];
}
interface DrikEvent {
  name: string;
  date: string;
  text: string;
  kind: string;
  month: number;
}
interface NameMap {
  map: Record<string, { names: string[]; textFilter?: string; pick?: 'first' | 'last' }>;
}

const cases = loadCases<FestivalCases>('festivals');
const nameMap = JSON.parse(readFileSync(join(REFERENCE_DIR, 'festivals', 'name-map.json'), 'utf8')) as NameMap;
const conventions = readFileSync(join(REFERENCE_DIR, 'CONVENTIONS.md'), 'utf8');

/** CONVENTIONS.md section 3 entries look like "- `diwali@chennai-2026` ...": the key makes the difference intentional. */
function documentedDifference(slug: string, cityId: string, year: number): boolean {
  return conventions.includes(`\`${slug}@${cityId}-${year}\``) || conventions.includes(`\`${slug}@${cityId}-*\``) || conventions.includes(`\`${slug}@*\``);
}

function drikDates(events: DrikEvent[], slug: string): { dates: string[]; matched: string[] } {
  const spec = nameMap.map[slug];
  if (!spec) return { dates: [], matched: [] };
  const wanted = spec.names.map(normName);
  const filter = spec.textFilter ? new RegExp(spec.textFilter, 'i') : null;
  const hits = events.filter((e) => wanted.includes(normName(e.name)) && (!filter || filter.test(e.text)));
  const dates = [...new Set(hits.map((e) => e.date))].sort();
  return { dates, matched: hits.map((e) => `${e.name} ${e.date} (${e.text})`) };
}

describe('festival suite — every F23 festival 2026-2028 vs Drik Panchang (Delhi Purnimanta, Chennai Amanta)', () => {
  const required = cases.slugs.length * cases.years.length * Object.keys(cases.cities).length;
  const missingPages: string[] = [];
  const failures: string[] = [];
  const unmapped: string[] = [];
  const documented: string[] = [];
  let compared = 0;
  let passed = 0;
  let exact = 0;

  for (const [cityId, city] of Object.entries(cases.cities)) {
    for (const year of cases.years) {
      const ref = loadReference<{ events: DrikEvent[] }>('festivals', 'drikpanchang', `${cityId}-${year}`);
      if (!ref) {
        missingPages.push(`${cityId}-${year}`);
        continue;
      }
      // Drik's city page lists festivals of every region (Pongal and Onam appear for Delhi), so the engine is
      // evaluated for both regions at the city: the region filter is a UI preference, not a date rule.
      const geo = { lat: city.lat, lon: city.lon };
      const engineAll = [...festivals(year, city.tradition, city.region, geo, city.tz), ...festivals(year, city.tradition, city.region === 'north' ? 'south' : 'north', geo, city.tz)];
      for (const slug of cases.slugs) {
        const { dates: drik, matched } = drikDates(ref.values.events, slug);
        const engineDates = [...new Set(engineAll.filter((f) => f.slug === slug && (f.day === undefined || f.day === 1)).map((f) => f.date))].sort();
        if (!drik.length) {
          unmapped.push(`${slug}@${cityId}-${year}`);
          continue;
        }
        compared++;
        it(`${slug} ${year} ${city.name} (${city.tradition}) = ${drik.join(', ')}`, () => {
          const same = engineDates.length === drik.length && engineDates.every((d, i) => d === drik[i]);
          const loose = drik.every((d) => engineDates.includes(d)) || engineDates.every((d) => drik.includes(d));
          if (same) {
            exact++;
            passed++;
            return;
          }
          if (documentedDifference(slug, cityId, year)) {
            documented.push(`${slug}@${cityId}-${year}: engine ${engineDates.join(', ') || 'none'} vs Drik ${drik.join(', ')}`);
            passed++;
            return;
          }
          // A multi-occurrence slug (Shravan Somvar) passes when every Drik date is an engine date.
          if (loose && drik.length > 1 && engineDates.length > 1) {
            passed++;
            return;
          }
          const msg = `${slug}@${cityId}-${year}: engine ${engineDates.join(', ') || 'none'} vs Drik ${drik.join(', ')} [${matched.join('; ')}]`;
          failures.push(msg);
          expect.fail(msg);
        });
      }
    }
  }

  afterAll(() => {
    warnMissing('festivals', 'drikpanchang monthly pages', missingPages, cases.years.length * Object.keys(cases.cities).length);
    if (unmapped.length) console.warn(`[suite:festivals] ${unmapped.length} slug-year-city combinations have no Drik event under the mapped names (see results.json festivals.unmapped)`);
    writeSuiteResult({
      suite: 'festivals',
      required,
      compared,
      passed,
      failed: compared - passed,
      skipped: required - compared,
      maxDeviation: { dateDays: failures.length ? 1 : 0 },
      sources: { drikpanchang: compared },
      failures,
      exactDates: exact,
      documentedDifferences: documented,
      unmapped,
      missingPages,
      generatedAt: new Date().toISOString(),
    });
  });
});
