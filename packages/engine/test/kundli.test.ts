import { describe, expect, it } from 'vitest';
import {
  COMBUSTION_ORBS,
  MEAN_NODE_METHOD,
  TRUE_NODE_METHOD,
  chalit,
  computeChart,
  moonChart,
  signDignity,
  sunChart,
  trueNodeLongitude,
  varga,
  type BirthInput,
} from '../src/kundli/index';
import { SIGN_LORDS } from '../src/locale/index';
import { getAyanamsa } from '../vendor/jyotish/src/core/ayanamsa';

// Sample birth used by the design mocks (plan P12): 1998-03-14 06:42 IST, Lucknow 26.85 N / 80.95 E.
const SAMPLE: BirthInput = { date: '1998-03-14', time: '06:42', approxMinutes: 30, tz: 'Asia/Kolkata', lat: 26.85, lon: 80.95 };

describe('computeChart (F11, F19)', () => {
  const chart = computeChart(SAMPLE);

  it('converts the wall time with the bundled tz table', () => {
    expect(new Date(chart.meta.utcMs).toISOString()).toBe('1998-03-14T01:12:00.000Z');
    expect(chart.meta.offsetMinutes).toBe(330);
    expect(chart.meta.tz).toBe('Asia/Kolkata');
    expect(chart.meta.ephemeris).toBe('astronomy-engine 2.1.19');
    expect(chart.meta.ayanamsa).toBe('lahiri');
    expect(chart.meta.ayanamsaDegrees).toBeGreaterThan(23.8);
    expect(chart.meta.ayanamsaDegrees).toBeLessThan(23.9);
    expect(chart.meta.nodeMethod).toBe(MEAN_NODE_METHOD);
    expect(chart.meta.combustionOrbs).toBe(COMBUSTION_ORBS);
  });

  it('has nine planets, a Lagna and twelve whole-sign houses with lords and occupants', () => {
    expect(chart.planets.map((p) => p.id)).toEqual(['Su', 'Mo', 'Ma', 'Me', 'Ju', 'Ve', 'Sa', 'Ra', 'Ke']);
    expect(chart.lagna).toBeDefined();
    expect(chart.moonChart).toBe(false);
    expect(chart.houses).toHaveLength(12);
    expect(chart.houses[0].sign).toBe(chart.firstHouseSign);
    expect(chart.firstHouseSign).toBe(chart.lagna!.sign);
    for (const h of chart.houses) {
      expect(h.lord).toBe(SIGN_LORDS[h.sign - 1]);
      for (const id of h.occupants) expect(chart.planets.find((p) => p.id === id)!.house).toBe(h.n);
    }
    expect(chart.houses.flatMap((h) => h.occupants)).toHaveLength(9);
    for (const p of chart.planets) {
      expect(p.longitude).toBeGreaterThanOrEqual(0);
      expect(p.longitude).toBeLessThan(360);
      expect(p.sign).toBe(Math.floor(p.longitude / 30) + 1);
      expect(p.nakshatra).toBe(Math.floor(p.longitude / (360 / 27)) + 1);
      expect(p.pada).toBeGreaterThanOrEqual(1);
      expect(p.pada).toBeLessThanOrEqual(4);
      expect(p.house).toBe(((p.sign - chart.firstHouseSign + 12) % 12) + 1);
      expect(p.degree).toBeLessThan(30);
      expect(p.minute).toBeLessThan(60);
    }
  });

  it('matches the vendored fork positions and is consistent with the A01 smoke test birth', () => {
    const moon = chart.planets.find((p) => p.id === 'Mo')!;
    const sun = chart.planets.find((p) => p.id === 'Su')!;
    // Ketu is exactly opposite Rahu.
    const ra = chart.planets.find((p) => p.id === 'Ra')!;
    const ke = chart.planets.find((p) => p.id === 'Ke')!;
    expect(((ke.longitude - ra.longitude + 360) % 360)).toBeCloseTo(180, 6);
    // One day after the 1998-03-13 full moon the Moon is ~190 deg ahead of the Sun.
    const elong = (moon.longitude - sun.longitude + 360) % 360;
    expect(elong).toBeGreaterThan(180);
    expect(elong).toBeLessThan(200);
  });

  it('tags dignities per Parashara (design 4 table) with moolatrikona folded into own', () => {
    expect(signDignity('Su', 1)).toBe('exalted');
    expect(signDignity('Su', 7)).toBe('debilitated');
    expect(signDignity('Su', 5)).toBe('own');
    expect(signDignity('Su', 11)).toBe('enemy'); // Kumbha, lord Saturn
    expect(signDignity('Su', 4)).toBe('friend'); // Karka, lord Moon
    expect(signDignity('Su', 3)).toBe('neutral'); // Mithuna, lord Mercury
    expect(signDignity('Mo', 2)).toBe('exalted');
    expect(signDignity('Mo', 4)).toBe('own');
    expect(signDignity('Mo', 6)).toBe('friend'); // Kanya, lord Mercury
    expect(signDignity('Ma', 12)).toBe('friend'); // Meena, lord Jupiter
    expect(signDignity('Ma', 6)).toBe('enemy'); // Kanya, lord Mercury
    expect(signDignity('Me', 12)).toBe('debilitated');
    expect(signDignity('Ju', 11)).toBe('neutral');
    expect(signDignity('Ve', 10)).toBe('friend'); // Makara, lord Saturn
    expect(signDignity('Sa', 1)).toBe('debilitated');
    expect(signDignity('Sa', 10)).toBe('own'); // moolatrikona Kumbha and own Makara both read "own"
    expect(signDignity('Ra', 2)).toBeUndefined();
    for (const p of chart.planets) {
      const rel = p.tags.filter((t) => ['exalted', 'debilitated', 'own', 'friend', 'enemy', 'neutral'].includes(t));
      expect(rel.length, p.id).toBe(p.id === 'Ra' || p.id === 'Ke' ? 0 : 1);
      if (p.combust) expect(p.tags).toContain('combust');
      if (p.vargottama) expect(p.tags).toContain('vargottama');
      if (p.retrograde && p.id !== 'Ra' && p.id !== 'Ke') expect(p.tags).toContain('retro');
    }
    // Sample chart: Mars within 17 deg of the Sun is combust; Jupiter, Rahu and Ketu are vargottama.
    expect(chart.planets.find((p) => p.id === 'Ma')!.tags).toContain('combust');
    expect(chart.planets.find((p) => p.id === 'Ju')!.tags).toContain('vargottama');
    expect(chart.planets.find((p) => p.id === 'Su')!.tags).toEqual(['enemy']);
  });

  it('F2: approx flags from the +-30 min drift (Lagna) and the 1 deg boundary rule (Sun at Kumbha 29 deg)', () => {
    expect(chart.lagna!.approx).toBe(true);
    expect(chart.lagna!.drift).toBeDefined();
    expect(Math.floor(chart.lagna!.drift!.minus / 30)).not.toBe(Math.floor(chart.lagna!.longitude / 30));
    const sun = chart.planets.find((p) => p.id === 'Su')!;
    expect(sun.sign).toBe(11);
    expect(sun.degree).toBe(29);
    expect(sun.approx).toBe(true);
    const moon = chart.planets.find((p) => p.id === 'Mo')!;
    expect(moon.approx).toBe(false);
    expect(chart.approx.lagna).toBe(true);
    expect(chart.meta.approxMinutes).toBe(30);
  });

  it('F2: with an exact time only the boundary rule applies', () => {
    const exact = computeChart({ ...SAMPLE, approxMinutes: 0 });
    expect(exact.lagna!.approx).toBe(false); // Meena 6 deg 44, not within 1 deg
    expect(exact.lagna!.drift).toBeUndefined();
    expect(exact.planets.find((p) => p.id === 'Su')!.approx).toBe(true);
    expect(exact.planets.filter((p) => p.approx).map((p) => p.id)).toEqual(['Su']);
  });

  it('F2: a constructed near-boundary Lagna is flagged at approx 15 even when the drift is small', () => {
    // Search the sample day for a minute where the Lagna sits within 0.5 deg of a sign boundary.
    let found: BirthInput | undefined;
    for (let hh = 0; hh < 24 && !found; hh++) {
      for (let mm = 0; mm < 60 && !found; mm += 2) {
        const b: BirthInput = { ...SAMPLE, time: `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`, approxMinutes: 0 };
        const c = computeChart(b);
        const inSign = c.lagna!.longitude % 30;
        if (inSign < 0.5 || inSign > 29.5) found = b;
      }
    }
    expect(found).toBeDefined();
    const c = computeChart({ ...found!, approxMinutes: 15 });
    expect(c.lagna!.approx).toBe(true);
  });

  it('F2: timeUnknown switches to Moon-chart mode (no Lagna, houses from the Moon, +-12 h drift)', () => {
    const u = computeChart({ date: '1998-03-14', timeUnknown: true, tz: 'Asia/Kolkata', lat: 26.85, lon: 80.95 });
    expect(u.moonChart).toBe(true);
    expect(u.lagna).toBeUndefined();
    expect(u.approx.lagna).toBe(false);
    expect(u.meta.timeUnknown).toBe(true);
    expect(u.meta.approxMinutes).toBe(720);
    const moon = u.planets.find((p) => p.id === 'Mo')!;
    expect(u.firstHouseSign).toBe(moon.sign);
    expect(moon.house).toBe(1);
    expect(u.houses[0].occupants).toContain('Mo');
    // positions are taken at local noon
    expect(new Date(u.meta.utcMs).toISOString()).toBe('1998-03-14T06:30:00.000Z');
    expect(() => chalit(u)).toThrow(/birth time/);
    // omitting the time behaves the same as timeUnknown
    const u2 = computeChart({ date: '1998-03-14', tz: 'Asia/Kolkata', lat: 26.85, lon: 80.95 });
    expect(u2.moonChart).toBe(true);
  });

  it('F4: the same wall time in a historical zone offset gives a different chart (Delhi 1944 war time)', () => {
    const war = computeChart({ date: '1944-06-15', time: '12:00', tz: 'Asia/Kolkata', lat: 28.6139, lon: 77.209 });
    expect(war.meta.offsetMinutes).toBe(390);
    expect(new Date(war.meta.utcMs).toISOString()).toBe('1944-06-15T05:30:00.000Z');
    const ktm = computeChart({ date: '1990-01-01', time: '08:00', tz: 'Asia/Katmandu', lat: 27.7, lon: 85.3 });
    expect(ktm.meta.tz).toBe('Asia/Kathmandu');
    expect(ktm.meta.offsetMinutes).toBe(345);
    const gap = computeChart({ date: '2024-03-10', time: '02:30', tz: 'America/New_York', lat: 40.7, lon: -74 });
    expect(gap.meta.clockGap).toBe(true);
  });

  it('validates its inputs at the boundary', () => {
    expect(() => computeChart({ ...SAMPLE, tz: 'Mars/Olympus' })).toThrow(/Unknown time zone/);
    expect(() => computeChart({ ...SAMPLE, date: '14-03-1998' })).toThrow(/YYYY-MM-DD/);
    expect(() => computeChart({ ...SAMPLE, time: '25:00' })).toThrow(/Invalid birth time/);
    expect(() => computeChart({ ...SAMPLE, lat: 95 })).toThrow(/latitude/);
  });

  it('ayanamsa options change the longitudes by the documented offsets', () => {
    // A04: Lahiri = 23 deg 15' 00.658" at 1956-03-21 (Lahiri's definition) + the 7.584" Drik calibration, KP =
    // 22.363889 deg and Raman = 21.013889 deg at J1900 (Swiss Ephemeris anchors), all moved with the IAU 2006
    // precession. At J1900 the calibrated Lahiri value is 22.467239 deg, so KP = Lahiri - 372.1" and
    // Raman = Lahiri - 5232.1" (constant offsets); the assertions derive them from getAyanamsa so a future
    // re-calibration of the Lahiri anchor cannot silently break them.
    const kp = computeChart(SAMPLE, { ayanamsa: 'kp' });
    const raman = computeChart(SAMPLE, { ayanamsa: 'raman' });
    const d = (a: number, b: number): number => ((a - b + 540) % 360) - 180;
    const at = new Date(chart.meta.utcMs);
    const kpOffset = getAyanamsa(at, 'lahiri') - getAyanamsa(at, 'kp');
    const ramanOffset = getAyanamsa(at, 'lahiri') - getAyanamsa(at, 'raman');
    expect(kpOffset).toBeCloseTo(372.1 / 3600, 3);
    expect(ramanOffset).toBeCloseTo(5232.1 / 3600, 3);
    expect(d(kp.planets[0].longitude, chart.planets[0].longitude)).toBeCloseTo(kpOffset, 4);
    expect(d(raman.planets[0].longitude, chart.planets[0].longitude)).toBeCloseTo(ramanOffset, 4);
    expect(kp.meta.ayanamsa).toBe('kp');
    // Drik Panchang prints 24.238279 for 2026-10-22 (reference/panchang/drikpanchang/delhi-2026-10-22.json).
    expect(Math.abs(getAyanamsa(new Date(Date.UTC(2026, 9, 22, 0, 56)), 'lahiri') - 24.238279)).toBeLessThan(0.003);
  });
});

describe('true node (P11)', () => {
  it('interpolates the Moon longitude between the surrounding node crossings', () => {
    const utcMs = Date.UTC(1998, 2, 14, 1, 12);
    const tn = trueNodeLongitude(utcMs);
    expect(tn.tropical).toBeGreaterThanOrEqual(0);
    expect(tn.tropical).toBeLessThan(360);
    expect(tn.speed).toBeLessThan(0); // nodes move backwards
    const mean = computeChart(SAMPLE).planets.find((p) => p.id === 'Ra')!;
    const truth = computeChart(SAMPLE, { node: 'true' });
    const ra = truth.planets.find((p) => p.id === 'Ra')!;
    expect(Math.abs(((ra.longitude - mean.longitude + 540) % 360) - 180)).toBeLessThan(2); // true node oscillates +-1.75 deg around the mean
    expect(truth.meta.node).toBe('true');
    expect(truth.meta.nodeMethod).toBe(TRUE_NODE_METHOD);
  });
});

describe('derived charts', () => {
  const chart = computeChart(SAMPLE);

  it('varga D9 keeps planet ids, uses the fork navamsa rule and marks vargottama', () => {
    const d9 = varga(chart, 'D9');
    expect(d9.variant).toBe('D9');
    expect(d9.planets.map((p) => p.id)).toEqual(chart.planets.map((p) => p.id));
    expect(d9.lagna).toBeDefined();
    for (const p of d9.planets) {
      const d1 = chart.planets.find((q) => q.id === p.id)!;
      const expectedSign = (Math.floor(d1.longitude / (360 / 108)) % 12) + 1;
      expect(p.sign).toBe(expectedSign);
      expect(p.house).toBe(((p.sign - d9.firstHouseSign + 12) % 12) + 1);
      expect(p.tags.includes('vargottama')).toBe(d1.vargottama);
      if (d1.vargottama) expect(p.sign).toBe(d1.sign);
    }
    expect(d9.houses).toHaveLength(12);
    expect(() => varga(chart, 'D13' as never)).toThrow(/Unknown varga/);
    for (const id of ['D2', 'D3', 'D7', 'D10', 'D12', 'D60'] as const) expect(varga(chart, id).planets).toHaveLength(9);
  });

  it('moonChart and sunChart re-count houses from the Moon / Sun sign', () => {
    const mc = moonChart(chart);
    const sc = sunChart(chart);
    expect(mc.variant).toBe('moon');
    expect(mc.lagna).toBeUndefined();
    expect(mc.firstHouseSign).toBe(chart.planets.find((p) => p.id === 'Mo')!.sign);
    expect(mc.planets.find((p) => p.id === 'Mo')!.house).toBe(1);
    expect(sc.planets.find((p) => p.id === 'Su')!.house).toBe(1);
    expect(mc.planets.map((p) => p.longitude)).toEqual(chart.planets.map((p) => p.longitude));
    expect(mc.houses.flatMap((h) => h.occupants)).toHaveLength(9);
  });

  it('chalit (Sripati) keeps longitudes, may shift houses, and lists cusps per bhava', () => {
    const ch = chalit(chart);
    expect(ch.variant).toBe('chalit');
    expect(ch.houses).toHaveLength(12);
    expect(ch.planets.map((p) => p.longitude)).toEqual(chart.planets.map((p) => p.longitude));
    expect(ch.houses.flatMap((h) => h.occupants)).toHaveLength(9);
    for (const p of ch.planets) expect(ch.houses.find((h) => h.n === p.house)!.occupants).toContain(p.id);
    // Sample: Sun at Kumbha 29 deg, 7 deg before the Lagna, moves from D1 house 12 into bhava 1.
    expect(chart.planets.find((p) => p.id === 'Su')!.house).toBe(12);
    expect(ch.planets.find((p) => p.id === 'Su')!.house).toBe(1);
  });
});
