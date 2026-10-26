// F15 Ashtakavarga: BAV totals are the fixed table totals, SAV sums to 337, grids are counted from the first house.
import { describe, expect, it } from 'vitest';
import { ASHTAKAVARGA_PLANETS, ASHTAKAVARGA_RULE_IDS, ashtakavarga, savStrength } from '../src/ashtakavarga/index';
import { computeChart } from '../src/kundli/index';

const PRIYA = { date: '1998-03-14', time: '06:42', tz: 'Asia/Kolkata', lat: 26.85, lon: 80.95 };

describe('ashtakavarga (F15)', () => {
  const chart = computeChart(PRIYA);
  const r = ashtakavarga(chart);

  it('SAV totals 337 and every BAV total matches the BPHS table', () => {
    expect(r.total).toBe(337);
    expect(r.sav.reduce((a, b) => a + b, 0)).toBe(337);
    expect(r.savBySign.reduce((a, b) => a + b, 0)).toBe(337);
    const totals: Record<string, number> = { Su: 48, Mo: 49, Ma: 39, Me: 54, Ju: 56, Ve: 52, Sa: 39 };
    for (const id of ASHTAKAVARGA_PLANETS) {
      expect(r.bav[id].byHouse.reduce((a, b) => a + b, 0)).toBe(totals[id]);
      expect(r.bav[id].bySign.reduce((a, b) => a + b, 0)).toBe(totals[id]);
      expect(r.bav[id].total).toBe(totals[id]);
      expect(r.bav[id].byHouse).toHaveLength(12);
      for (const b of r.bav[id].byHouse) {
        expect(b).toBeGreaterThanOrEqual(0);
        expect(b).toBeLessThanOrEqual(8);
      }
    }
  });

  it('grids are rotated from the first house sign and the house strength classes follow the thresholds', () => {
    expect(r.firstHouseSign).toBe(chart.firstHouseSign);
    expect(r.lagnaAssumed).toBe('lagna');
    for (let h = 0; h < 12; h++) {
      const sign = (r.firstHouseSign - 1 + h) % 12;
      expect(r.sav[h]).toBe(r.savBySign[sign]);
      expect(r.houseStrength[h].house).toBe(h + 1);
      expect(r.houseStrength[h].sign).toBe(sign + 1);
      expect(r.houseStrength[h].bindus).toBe(r.sav[h]);
      expect(r.houseStrength[h].strength).toBe(savStrength(r.sav[h]));
      expect(r.houseStrength[h].ruleId).toBe('ashtakavarga-house-strength');
    }
    expect(savStrength(28)).toBe('strong');
    expect(savStrength(27)).toBe('average');
    expect(savStrength(25)).toBe('average');
    expect(savStrength(24)).toBe('weak');
    expect(r.ruleIds).toEqual(ASHTAKAVARGA_RULE_IDS);
  });

  it('uses the Moon sign for the Lagna reference when the birth time is unknown', () => {
    const unknown = computeChart({ ...PRIYA, time: undefined, timeUnknown: true });
    const u = ashtakavarga(unknown);
    expect(u.lagnaAssumed).toBe('moon');
    expect(u.firstHouseSign).toBe(unknown.planets.find((p) => p.id === 'Mo')!.sign);
    expect(u.sav.reduce((a, b) => a + b, 0)).toBe(337);
  });
});
