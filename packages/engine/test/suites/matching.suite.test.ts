// Matching suite (spec section 6, F29): 20 pairs vs Drik Panchang Horoscope Matching — the Ashta Kuta total and the
// eight koota scores must match exactly. Phase A ran the fork's koota functions (and had no reference data: Drik
// blocked the fetcher); B01 fixed the fetcher, fetched the 20 pairs and runs the engine's ashtakoota() (src/matching),
// whose conventions were calibrated on these pages (reference/CONVENTIONS.md section 1c).
// A koota difference is accepted ONLY when CONVENTIONS.md section 3 carries `koota-<id>@<pair>` for it AND the total
// differs by exactly that koota's difference (the Yoni friendly/unfriendly table Drik uses could not be sourced in
// B01; those pairs are listed there). Every other difference fails.
import { afterAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { computeChart } from '../../src/kundli/index';
import { ashtakoota } from '../../src/matching/index';
import { REFERENCE_DIR, loadCases, loadReference, warnMissing, writeSuiteResult } from './_shared';

interface Pair {
  id: string;
  boy: string;
  girl: string;
}
interface ChartCase {
  id: string;
  date: string;
  time: string | null;
  tz: string;
  lat: number;
  lon: number;
}
interface DrikMatch {
  total: number | null;
  totalMax: number | null;
  kootas: Record<string, { score: number; max: number; raw: string }>;
  mangal?: Record<string, unknown>;
  moons?: { boyMoon?: number; girlMoon?: number };
}

const pairs = loadCases<{ pairs: Pair[] }>('matching').pairs;
const charts = loadCases<{ cases: ChartCase[] }>('charts').cases;
const conventions = readFileSync(join(REFERENCE_DIR, 'CONVENTIONS.md'), 'utf8');
const KOOTA_ORDER = ['varna', 'vashya', 'tara', 'yoni', 'grahaMaitri', 'gana', 'bhakoot', 'nadi'] as const;

/** CONVENTIONS.md section 3 entries look like "- `koota-yoni@m03` ...": the key makes that koota's difference intentional. */
function documentedKootaDifference(koota: string, pairId: string): boolean {
  return conventions.includes(`\`koota-${koota}@${pairId}\``);
}

describe('matching suite — 20 pairs vs Drik Panchang Ashta Kuta (spec section 6)', () => {
  const missing: string[] = [];
  const failures: string[] = [];
  const documented: string[] = [];
  let compared = 0;
  let passed = 0;
  let exact = 0;
  let maxTotalDiff = 0;
  let maxMoonDiff = 0;
  for (const p of pairs) {
    const ref = loadReference<DrikMatch>('matching', 'drikpanchang', p.id);
    if (!ref) {
      missing.push(p.id);
      continue;
    }
    compared++;
    it(`${p.id}: ${p.boy} x ${p.girl} guna total and kootas match Drik Panchang`, () => {
      const boy = charts.find((c) => c.id === p.boy)!;
      const girl = charts.find((c) => c.id === p.girl)!;
      const bc = computeChart({ date: boy.date, time: boy.time ?? undefined, timeUnknown: boy.time === null, tz: boy.tz, lat: boy.lat, lon: boy.lon });
      const gc = computeChart({ date: girl.date, time: girl.time ?? undefined, timeUnknown: girl.time === null, tz: girl.tz, lat: girl.lat, lon: girl.lon });
      const res = ashtakoota(bc, gc);
      const v = ref.values;
      // The site's own Moon longitudes (0.01 deg) must agree with the engine's, otherwise the kootas are not comparable.
      if (v.moons?.boyMoon !== undefined) maxMoonDiff = Math.max(maxMoonDiff, Math.abs(bc.planets.find((x) => x.id === 'Mo')!.longitude - v.moons.boyMoon));
      if (v.moons?.girlMoon !== undefined) maxMoonDiff = Math.max(maxMoonDiff, Math.abs(gc.planets.find((x) => x.id === 'Mo')!.longitude - v.moons.girlMoon));
      const errors: string[] = [];
      let documentedDelta = 0;
      for (const k of KOOTA_ORDER) {
        const r = v.kootas?.[k];
        if (!r) continue;
        const mine = res.kootas.find((x) => x.id === k)!.points;
        if (Math.abs(mine - r.score) > 1e-9) {
          if (documentedKootaDifference(k, p.id)) {
            documented.push(`${p.id}: ${k} engine ${mine} vs Drik ${r.score} (${r.raw})`);
            documentedDelta += mine - r.score;
          } else errors.push(`${k} ${mine} vs Drik ${r.score} (${r.raw})`);
        }
      }
      if (v.total !== null && v.total !== undefined) {
        // Drik prints the guna total truncated to a whole number (23.5 -> 23, 14.5 -> 14; CONVENTIONS section 1c); the
        // engine keeps the exact sum of the eight kootas, so the comparison is on the truncated value.
        const comparable = res.total - documentedDelta;
        const d = Math.abs(Math.floor(comparable + 1e-9) - v.total);
        maxTotalDiff = Math.max(maxTotalDiff, d);
        if (d > 0) errors.push(`total ${res.total} (${comparable} after documented kootas, floor ${Math.floor(comparable + 1e-9)}) vs Drik ${v.total}`);
        const drikSum = KOOTA_ORDER.reduce((s, k) => s + (v.kootas?.[k]?.score ?? 0), 0);
        if (Math.floor(drikSum + 1e-9) !== v.total) errors.push(`Drik's own kootas sum to ${drikSum} but it prints ${v.total}`);
      }
      if (errors.length) failures.push(`${p.id}: ${errors.join(' | ')}`);
      else {
        passed++;
        if (documentedDelta === 0) exact++;
      }
      expect(errors, `${p.id} ${ref.source_url}`).toEqual([]);
    });
  }
  if (compared === 0) {
    it.skip(`0 of ${pairs.length} pairs have a Drik Panchang reference yet (run reference/fetch/drik-matching.mjs)`, () => {});
  }
  afterAll(() => {
    warnMissing('matching', 'drikpanchang', missing, pairs.length);
    writeSuiteResult({
      suite: 'matching',
      required: pairs.length,
      compared,
      passed,
      failed: compared - passed,
      skipped: missing.length,
      maxDeviation: { gunaTotal: maxTotalDiff, moonDeg: maxMoonDiff },
      sources: { drikpanchang: compared },
      failures,
      exactPairs: exact,
      documentedDifferences: documented,
      missing,
      generatedAt: new Date().toISOString(),
    });
  });
});
