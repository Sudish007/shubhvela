// Matching suite (spec section 6, F29): 20 pairs vs Drik Panchang Horoscope Matching — the Ashta Kuta total and
// the eight koota scores must match exactly. Phase A runs it against the vendored fork's koota functions (the
// B01 `ashtakoota()` wrapper will call the same functions; B01 re-runs this suite). Mangal dosha: the site's
// statement is recorded in the reference files and compared with the fork rule set where the statement is
// unambiguous (see CONVENTIONS.md section 2).
import { afterAll, describe, expect, it } from 'vitest';
import { computeChart } from '../../src/kundli/index';
import {
  calculateBhakoot,
  calculateGana,
  calculateGrahaMaitri,
  calculateNadi,
  calculateTara,
  calculateVarna,
  calculateVashya,
  calculateYoni,
} from '../../vendor/jyotish/src/matching/kootas';
import { loadCases, loadReference, warnMissing, writeSuiteResult } from './_shared';

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
}

const pairs = loadCases<{ pairs: Pair[] }>('matching').pairs;
const charts = loadCases<{ cases: ChartCase[] }>('charts').cases;
const KOOTA_ORDER = ['varna', 'vashya', 'tara', 'yoni', 'grahaMaitri', 'gana', 'bhakoot', 'nadi'] as const;

/** Ashta Kuta from the two Moon longitudes with the fork's koota tables (what B01 wraps). */
export function ashtakootaFromMoons(boyMoon: number, girlMoon: number): { total: number; kootas: Record<string, number> } {
  const nak = (lon: number) => Math.floor(lon / (360 / 27));
  const rashi = (lon: number) => Math.floor(lon / 30);
  const bN = nak(boyMoon);
  const gN = nak(girlMoon);
  const bR = rashi(boyMoon);
  const gR = rashi(girlMoon);
  const kootas = {
    varna: calculateVarna(bR, gR, 'en').score,
    vashya: calculateVashya(bR, gR, 'en').score,
    tara: calculateTara(bN, gN, 'en').score,
    yoni: calculateYoni(bN, gN, 'en').score,
    grahaMaitri: calculateGrahaMaitri(bR, gR, 'en').score,
    gana: calculateGana(bN, gN, 'en').score,
    bhakoot: calculateBhakoot(bR, gR, 'en').score,
    nadi: calculateNadi(bN, gN, bR, gR, 'en').score,
  };
  const total = Object.values(kootas).reduce((s, x) => s + x, 0);
  return { total, kootas };
}

describe('matching suite — 20 pairs vs Drik Panchang Ashta Kuta (spec section 6)', () => {
  const missing: string[] = [];
  const failures: string[] = [];
  let compared = 0;
  let passed = 0;
  let maxTotalDiff = 0;

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
      const res = ashtakootaFromMoons(bc.planets.find((x) => x.id === 'Mo')!.longitude, gc.planets.find((x) => x.id === 'Mo')!.longitude);
      const errors: string[] = [];
      const v = ref.values;
      if (v.total !== null && v.total !== undefined) {
        const d = Math.abs(res.total - v.total);
        maxTotalDiff = Math.max(maxTotalDiff, d);
        if (d !== 0) errors.push(`total ${res.total} vs Drik ${v.total}`);
      }
      for (const k of KOOTA_ORDER) {
        const r = v.kootas?.[k];
        if (!r) continue;
        if (Math.abs(res.kootas[k] - r.score) > 1e-9) errors.push(`${k} ${res.kootas[k]} vs Drik ${r.score} (${r.raw})`);
      }
      if (errors.length) failures.push(`${p.id}: ${errors.join(' | ')}`);
      else passed++;
      expect(errors, `${p.id} ${ref.source_url}`).toEqual([]);
    });
  }

  if (compared === 0) {
    // Nothing fetched yet (Drik served a reCAPTCHA to the A04 fetcher): the shortfall is recorded by results.json and
    // `npm run reference:check`; a skipped test keeps the suite visible without failing `npm test` on known data gaps.
    it.skip(`0 of ${pairs.length} pairs have a Drik Panchang reference yet (run reference/fetch/drik-matching.mjs when the site unblocks)`, () => {});
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
      maxDeviation: { gunaTotal: maxTotalDiff },
      sources: { drikpanchang: compared },
      failures,
      missing,
      generatedAt: new Date().toISOString(),
    });
  });
});
