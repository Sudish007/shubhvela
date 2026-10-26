// F12: all 15 divisional charts (plan B01). D9 must equal the A02 varga('D9'); every varga keeps 9 planets in 12
// signs with whole-sign houses from its own first house; the D2 Hora and D30 Trimsamsa sign maps follow BPHS.
import { describe, expect, it } from 'vitest';
import { computeChart, varga } from '../src/kundli/index';
import { DIVISIONAL_CHART_IDS, LOCKED_VARGA_IDS, VARGA_RULE_IDS, allVargas, isDivisionalChartId, vargaDivisor, vargaInfo } from '../src/vargas/index';

const PRIYA = { date: '1998-03-14', time: '06:42', tz: 'Asia/Kolkata', lat: 26.85, lon: 80.95 };

describe('vargas (F12)', () => {
  const chart = computeChart(PRIYA);
  const all = allVargas(chart);

  it('lists the 15 charts of spec F12 with D9 free and 14 locked', () => {
    expect(DIVISIONAL_CHART_IDS).toEqual(['D2', 'D3', 'D4', 'D7', 'D9', 'D10', 'D12', 'D16', 'D20', 'D24', 'D27', 'D30', 'D40', 'D45', 'D60']);
    expect(LOCKED_VARGA_IDS).toHaveLength(14);
    expect(LOCKED_VARGA_IDS).not.toContain('D9');
    expect(vargaInfo('D9').free).toBe(true);
    expect(vargaInfo('D30').free).toBe(false);
    expect(VARGA_RULE_IDS).toHaveLength(15);
    expect(VARGA_RULE_IDS[0]).toBe('varga-d2');
    expect(isDivisionalChartId('D5')).toBe(false);
    expect(vargaDivisor('D60')).toBe(60);
  });

  it('computes every varga with 9 planets in 12 signs and consistent houses', () => {
    for (const id of DIVISIONAL_CHART_IDS) {
      const v = all[id];
      expect(v.variant).toBe(id);
      expect(v.planets).toHaveLength(9);
      expect(v.houses).toHaveLength(12);
      for (const p of v.planets) {
        expect(p.sign).toBeGreaterThanOrEqual(1);
        expect(p.sign).toBeLessThanOrEqual(12);
        expect(p.house).toBe(((p.sign - v.firstHouseSign + 12) % 12) + 1);
        expect(v.houses[p.house - 1].occupants).toContain(p.id);
        expect(p.longitude).toBeGreaterThanOrEqual(0);
        expect(p.longitude).toBeLessThan(360);
      }
      expect(vargaInfo(id).divisor).toBe(Number(id.slice(1)));
    }
  });

  it('D9 equals the kundli module varga("D9") of A02', () => {
    const d9 = varga(chart, 'D9');
    expect(all.D9.planets.map((p) => [p.id, p.sign, p.house])).toEqual(d9.planets.map((p) => [p.id, p.sign, p.house]));
    expect(all.D9.firstHouseSign).toBe(d9.firstHouseSign);
  });

  it('D2 Hora follows Parashara: odd signs 0-15 Simha / 15-30 Karka, even signs the reverse', () => {
    const probe = (lon: number): number => varga({ ...chart, planets: chart.planets.map((p) => (p.id === 'Su' ? { ...p, longitude: lon, sign: Math.floor(lon / 30) + 1, drift: undefined } : p)) }, 'D2').planets.find((p) => p.id === 'Su')!.sign;
    expect(probe(5)).toBe(5); // Mesha 5 deg -> Simha
    expect(probe(20)).toBe(4); // Mesha 20 deg -> Karka
    expect(probe(35)).toBe(4); // Vrishabha 5 deg -> Karka
    expect(probe(50)).toBe(5); // Vrishabha 20 deg -> Simha
  });

  it('D30 Trimsamsa follows the BPHS table (odd: Ma 5, Sa 5, Ju 8, Me 7, Ve 5; even reversed)', () => {
    const probe = (lon: number): number => varga({ ...chart, planets: chart.planets.map((p) => (p.id === 'Su' ? { ...p, longitude: lon, sign: Math.floor(lon / 30) + 1, drift: undefined } : p)) }, 'D30').planets.find((p) => p.id === 'Su')!.sign;
    // Odd sign (Mesha): 0-5 Mesha(1), 5-10 Kumbha(11), 10-18 Dhanu(9), 18-25 Mithuna(3), 25-30 Tula(7).
    expect([probe(2), probe(7), probe(14), probe(20), probe(27)]).toEqual([1, 11, 9, 3, 7]);
    // Even sign (Vrishabha): 0-5 Vrishabha(2), 5-12 Kanya(6), 12-20 Meena(12), 20-25 Makara(10), 25-30 Vrishchika(8).
    expect([probe(32), probe(38), probe(45), probe(52), probe(57)]).toEqual([2, 6, 12, 10, 8]);
  });

  it('works in Moon-chart mode (unknown time): first house = Moon varga sign, no lagna', () => {
    const unknown = computeChart({ ...PRIYA, time: undefined, timeUnknown: true });
    const v = allVargas(unknown);
    for (const id of DIVISIONAL_CHART_IDS) {
      expect(v[id].lagna).toBeUndefined();
      expect(v[id].firstHouseSign).toBe(v[id].planets.find((p) => p.id === 'Mo')!.sign);
    }
  });
});
