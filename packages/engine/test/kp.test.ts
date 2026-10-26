// F15/F19 KP: 12 Placidus cusps in order, cusp 1 = Lagna and cusp 10 = MC with their opposites, four-fold lords are
// valid planets, every planet sits in exactly one house, significators A-D are consistent, ruling planets de-duplicated.
import { describe, expect, it } from 'vitest';
import { getAyanamsa } from '../vendor/jyotish/src/core/ayanamsa';
import { KP_RULE_IDS, kp, kpAt, placidusCusps, rulingPlanets } from '../src/kp/index';
import { computeChart } from '../src/kundli/index';
import { PLANET_IDS } from '../src/locale/index';

const PRIYA = { date: '1998-03-14', time: '06:42', tz: 'Asia/Kolkata', lat: 26.85, lon: 80.95 };
const norm = (x: number): number => ((x % 360) + 360) % 360;
/** Smallest angular difference between two longitudes (0..180). */
const diff = (a: number, b: number): number => Math.abs(((((a - b) % 360) + 540) % 360) - 180);

describe('kp (F15)', () => {
  const r = kp(PRIYA);

  it('returns 12 cusps in zodiacal order with opposite cusps 180 deg apart', () => {
    expect(r.cusps).toHaveLength(12);
    expect(r.houseSystem).toBe('placidus');
    expect(r.ayanamsa).toBe('kp');
    for (let i = 0; i < 6; i++) expect(diff(r.cusps[i].longitude, r.cusps[i + 6].longitude + 180)).toBeLessThan(1e-6);
    for (let i = 0; i < 12; i++) {
      const c = r.cusps[i];
      expect(c.n).toBe(i + 1);
      expect(c.sign).toBe(Math.floor(c.longitude / 30) + 1);
      expect(c.span).toBeGreaterThan(0);
      expect(c.span).toBeLessThan(180);
      expect(norm(c.longitude + c.span)).toBeCloseTo(r.cusps[(i + 1) % 12].longitude, 6);
    }
    expect(r.cusps.reduce((s, c) => s + c.span, 0)).toBeCloseTo(360, 6);
  });

  it('cusp 1 equals the KP-ayanamsa Lagna of the chart and planets keep their positions', () => {
    const chart = computeChart(PRIYA, { ayanamsa: 'kp' });
    expect(diff(r.cusps[0].longitude, chart.lagna!.longitude)).toBeLessThan(1e-6);
    for (const p of chart.planets) {
      const row = r.planets.find((x) => x.id === p.id)!;
      expect(row.longitude).toBeCloseTo(p.longitude, 9);
      expect(row.sign).toBe(p.sign);
    }
    // KP vs Lahiri ayanamsa differ by ~6' (372") at the same instant.
    const d = new Date(chart.meta.utcMs);
    expect((getAyanamsa(d, 'lahiri') - getAyanamsa(d, 'kp')) * 3600).toBeCloseTo(372.1, 0);
  });

  it('four-fold lords are planets, every planet is in exactly one house and houses list their occupants', () => {
    for (const row of [...r.cusps, ...r.planets]) {
      for (const l of [row.signLord, row.starLord, row.subLord, row.subSubLord]) expect(PLANET_IDS).toContain(l);
    }
    for (const p of r.planets) {
      const c = r.cusps[p.house - 1];
      const inside = c.longitude < c.end ? p.longitude >= c.longitude && p.longitude < c.end : p.longitude >= c.longitude || p.longitude < c.end;
      expect(inside).toBe(true);
      expect(c.occupants).toContain(p.id);
    }
    expect(r.cusps.flatMap((c) => c.occupants).sort()).toEqual([...PLANET_IDS].sort());
  });

  it('significators follow the A/B/C/D definitions and the planet view inverts the house view', () => {
    expect(r.significators).toHaveLength(12);
    for (const s of r.significators) {
      const cusp = r.cusps[s.house - 1];
      expect(s.B).toEqual(cusp.occupants);
      expect(s.D).toEqual([cusp.signLord]);
      for (const id of s.A) expect(s.B).toContain(r.planets.find((p) => p.id === id)!.starLord);
      for (const id of s.C) expect(r.planets.find((p) => p.id === id)!.starLord).toBe(cusp.signLord);
      for (const id of PLANET_IDS) {
        expect(r.planetSignificators[id].A.includes(s.house)).toBe(s.A.includes(id));
        expect(r.planetSignificators[id].B.includes(s.house)).toBe(s.B.includes(id));
      }
    }
    expect(r.ruleIds).toEqual(KP_RULE_IDS);
  });

  it('ruling planets: 3 Lagna lords + 3 Moon lords + day lord, de-duplicated and in KP order', () => {
    const rp = r.rulingPlanetsAtBirth;
    const order = [rp.lagna.subLord, rp.lagna.starLord, rp.lagna.signLord, rp.moon.subLord, rp.moon.starLord, rp.moon.signLord, rp.dayLord];
    const expected: string[] = [];
    for (const id of order) if (!expected.includes(id)) expected.push(id);
    expect(rp.list).toEqual(expected);
    expect(new Set(rp.list).size).toBe(rp.list.length);
    // 1998-03-14 was a Saturday; the birth at 06:42 is after sunrise (06:25 Lucknow) so the day lord is Saturn.
    expect(rp.dayLord).toBe('Sa');
    // Ruling planets for "now" (design 10.3) at Delhi, Thursday 2026-10-22 10:58 IST -> Jupiter day lord.
    const now = rulingPlanets(Date.UTC(2026, 9, 22, 5, 28), { lat: 28.6139, lon: 77.209 }, 'Asia/Kolkata');
    expect(now.dayLord).toBe('Ju');
    expect(now.list.length).toBeGreaterThanOrEqual(3);
    // Before sunrise the Vedic day is still the previous weekday (Wednesday -> Mercury).
    const early = rulingPlanets(Date.UTC(2026, 9, 21, 23, 30), { lat: 28.6139, lon: 77.209 }, 'Asia/Kolkata');
    expect(early.dayLord).toBe('Me');
  });

  it('kpAt and placidusCusps agree; unknown time and polar latitudes are flagged', () => {
    const chart = computeChart(PRIYA, { ayanamsa: 'kp' });
    const at = kpAt(chart.meta.utcMs, { lat: PRIYA.lat, lon: PRIYA.lon }, PRIYA.tz);
    expect(at.cusps.map((c) => c.longitude)).toEqual(r.cusps.map((c) => c.longitude));
    expect(placidusCusps(chart.meta.utcMs, { lat: PRIYA.lat, lon: PRIYA.lon }, 'kp')[9]).toBeCloseTo(r.cusps[9].longitude, 9);
    expect(kp({ ...PRIYA, time: undefined, timeUnknown: true }).timeUnknown).toBe(true);
    expect(kp({ ...PRIYA, lat: 70, lon: 25, tz: 'Europe/Oslo' }).polar).toBe(true);
    expect(r.polar).toBe(false);
    expect(kp(PRIYA, { ayanamsa: 'lahiri' }).ayanamsa).toBe('lahiri');
  });
});
