// F29: ashtakoota() equals the fork koota functions the reference suite compares with Drik (same Moons -> same
// totals), the Nadi / Bhakoot exceptions fire where defined, Mangal dosha cancellations are explicit rules, and the
// four beyond-gun-milan rows carry tones and rule ids.
import { describe, expect, it } from 'vitest';
import { computeChart } from '../src/kundli/index';
import {
  BEYOND_RULE_IDS,
  KOOTA_IDS,
  KOOTA_MAX,
  MANGAL_HOUSES,
  MANGAL_RULE_IDS,
  ashtakoota,
  beyondGunMilan,
  mangalDosha,
  mangalDoshaPair,
  vashyaClass,
} from '../src/matching/index';
import { calculateBhakoot, calculateGana, calculateGrahaMaitri, calculateNadi, calculateTara, calculateVarna, calculateVashya, calculateYoni } from '../vendor/jyotish/src/matching/kootas';
import { signsWith, syntheticChart } from './_synthetic';

/** The same fork koota calls the A04 reference suite (test/suites/matching.suite.test.ts) compares with Drik Panchang. */
function ashtakootaFromMoons(boyMoon: number, girlMoon: number): { total: number; kootas: Record<string, number> } {
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
  return { total: Object.values(kootas).reduce((s, x) => s + x, 0), kootas };
}

const TZ = 'Asia/Kolkata';
const PRIYA = computeChart({ date: '1998-03-14', time: '06:42', tz: TZ, lat: 26.85, lon: 80.95 });
const AMMA = computeChart({ date: '1970-07-05', time: '04:30', tz: TZ, lat: 25.61, lon: 85.14 });

describe('matching (F29)', () => {
  it('ashtakoota sums its eight rows; Varna/Tara/Yoni/Maitri/Gana equal the fork kootas (the Drik-matched tables)', () => {
    const r = ashtakoota(AMMA, PRIYA);
    const ref = ashtakootaFromMoons(AMMA.planets.find((p) => p.id === 'Mo')!.longitude, PRIYA.planets.find((p) => p.id === 'Mo')!.longitude);
    expect(r.max).toBe(36);
    expect(r.kootas.map((k) => k.id)).toEqual([...KOOTA_IDS]);
    for (const k of r.kootas) {
      if (['varna', 'tara', 'yoni', 'grahaMaitri', 'gana'].includes(k.id)) expect(k.points).toBe(ref.kootas[k.id]);
      expect(k.max).toBe(KOOTA_MAX[k.id]);
      expect(k.points).toBeLessThanOrEqual(k.max);
      expect(k.ruleId).toBe(`koota-${k.id}`);
      expect(k.a).toBeTruthy();
      expect(k.b).toBeTruthy();
    }
    expect(r.kootas.reduce((s, k) => s + k.points, 0)).toBe(r.total);
    expect(r.a.moonSign).toBe(AMMA.planets.find((p) => p.id === 'Mo')!.sign);
    expect(r.b.nakshatra).toBe(PRIYA.planets.find((p) => p.id === 'Mo')!.nakshatra);
  });

  it('Nadi exceptions (same rashi / same nakshatra with different padas) restore 8; identical nakshatra-pada keeps the dosha', () => {
    // Mithuna: Ardra (adi) and Punarvasu 1-3 (adi) share the Adi nadi in the same rashi -> exception.
    const a = syntheticChart(signsWith({ Mo: 3 }), { degree: 10 }); // Mithuna 10 = Ardra
    const b = syntheticChart(signsWith({ Mo: 3 }), { degree: 24 }); // Mithuna 24 = Punarvasu
    const r = ashtakoota(a, b);
    expect(r.kootas.find((k) => k.id === 'nadi')!.points).toBe(8);
    expect(r.nadiException).toBe('nadi-exception-same-rashi');
    expect(r.kootas.find((k) => k.id === 'nadi')!.detail.exception).toBe('nadi-exception-same-rashi');
    // Same nakshatra, different padas (Drik m02): exception.
    const p1 = syntheticChart(signsWith({ Mo: 6 }), { degree: 1 }); // Kanya 1 = Uttara Phalguni pada 2
    const p4 = syntheticChart(signsWith({ Mo: 6 }), { degree: 8 }); // Kanya 8 = Uttara Phalguni pada 4
    const np = ashtakoota(p1, p4);
    expect(np.kootas.find((k) => k.id === 'nadi')!.points).toBe(8);
    expect(np.nadiException).toBe('nadi-exception-same-nakshatra-pada');
    expect(np.kootas.find((k) => k.id === 'bhakoot')!.points).toBe(7);
    // Identical nakshatra AND pada (Drik m15): Nadi 0 and Bhakoot 0 (eka-nakshatra eka-pada).
    const same = ashtakoota(a, a);
    expect(same.kootas.find((k) => k.id === 'nadi')!.points).toBe(0);
    expect(same.nadiException).toBeUndefined();
    expect(same.kootas.find((k) => k.id === 'bhakoot')!.points).toBe(0);
    expect(same.bhakootException).toBe('bhakoot-same-nakshatra-pada');
  });

  it('Bhakoot: 2/12, 5/9, 6/8 score 0 even with the same lord (Drik), the traditional exception is only named', () => {
    // Mesha (Mars) and Vrishchika (Mars) are 8 apart: Drik m17 gives 0; the engine names the same-lord exception.
    const m1 = syntheticChart(signsWith({ Mo: 1 }), { degree: 20 });
    const m8 = syntheticChart(signsWith({ Mo: 8 }), { degree: 5 });
    const bk = ashtakoota(m1, m8);
    expect(bk.kootas.find((k) => k.id === 'bhakoot')!.points).toBe(0);
    expect(bk.bhakootException).toBeUndefined();
    expect(bk.bhakootNote).toBe('bhakoot-exception-same-lord');
    expect(bk.kootas.find((k) => k.id === 'bhakoot')!.detail.note).toBe('bhakoot-exception-same-lord');
    // Mesha and Kanya (6-8, different lords): Bhakoot dosha -> 0, no note.
    const m6 = syntheticChart(signsWith({ Mo: 6 }), { degree: 5 });
    const bad = ashtakoota(m1, m6);
    expect(bad.kootas.find((k) => k.id === 'bhakoot')!.points).toBe(0);
    expect(bad.bhakootNote).toBeUndefined();
    // Mesha and Simha (5-9 distance 5): 0; Mesha and Karka (4-10): 7.
    expect(ashtakoota(m1, syntheticChart(signsWith({ Mo: 5 }), { degree: 5 })).kootas.find((k) => k.id === 'bhakoot')!.points).toBe(0);
    expect(ashtakoota(m1, syntheticChart(signsWith({ Mo: 4 }), { degree: 5 })).kootas.find((k) => k.id === 'bhakoot')!.points).toBe(7);
  });

  it('Vashya: Dhanu and Makara split by half (Drik m04 / m16)', () => {
    expect(vashyaClass(240 + 1)).toBe(1); // Dhanu first half Manava
    expect(vashyaClass(240 + 24)).toBe(0); // Dhanu second half Chatushpada
    expect(vashyaClass(270 + 5)).toBe(0); // Makara first half Chatushpada
    expect(vashyaClass(270 + 20)).toBe(2); // Makara second half Jalachara
    expect(vashyaClass(330 + 10)).toBe(2); // Meena Jalachara
    const dhanuEarly = syntheticChart(signsWith({ Mo: 9 }), { degree: 1 });
    const dhanuLate = syntheticChart(signsWith({ Mo: 9 }), { degree: 24 });
    const r = ashtakoota(dhanuEarly, dhanuLate);
    expect(r.kootas.find((k) => k.id === 'vashya')!.points).toBe(1);
    expect(r.kootas.find((k) => k.id === 'vashya')!.a).toBe('manava');
    expect(r.kootas.find((k) => k.id === 'vashya')!.b).toBe('chatushpada');
  });

  it('Mangal dosha: present from Lagna/Moon/Venus in houses 1,2,4,7,8,12 with every cancellation rule evaluated', () => {
    expect(MANGAL_HOUSES).toEqual([1, 2, 4, 7, 8, 12]);
    // Mars in the 7th from the Lagna (Lagna Mesha, Mars Tula), Moon Dhanu (Mars 11th from Moon), Venus Karka (Mars 4th from Venus).
    const r = mangalDosha(syntheticChart(signsWith({ Ma: 7, Mo: 9, Ve: 4, Ju: 2, Su: 11 }), { lagnaSign: 1 }));
    expect(r.present).toBe(true);
    expect(r.fromLagna).toEqual({ from: 'lagna', house: 7, dosha: true });
    expect(r.fromMoon).toEqual({ from: 'moon', house: 11, dosha: false });
    expect(r.fromVenus).toEqual({ from: 'venus', house: 4, dosha: true });
    expect(r.cancellations.map((c) => c.ruleId)).toEqual(MANGAL_RULE_IDS.slice(1, 6));
    expect(r.cancellations.every((c) => !c.applies)).toBe(true);
    expect(r.cancelled).toBe(false);
    expect(r.effective).toBe(true);
    // Mars in Makara (exalted) in the 7th: own/exalted cancellation.
    const ex = mangalDosha(syntheticChart(signsWith({ Ma: 10, Mo: 9, Ve: 4, Ju: 2, Su: 11 }), { lagnaSign: 4 }));
    expect(ex.present).toBe(true);
    expect(ex.cancellations.find((c) => c.ruleId === 'mangal-cancel-own-exalted')!.applies).toBe(true);
    // Also the sign-house exception: Makara in the 7th.
    expect(ex.cancellations.find((c) => c.ruleId === 'mangal-cancel-sign-house')!.applies).toBe(true);
    expect(ex.effective).toBe(false);
    // Jupiter aspecting Mars (Mars 9th from Jupiter) cancels.
    const ja = mangalDosha(syntheticChart(signsWith({ Ma: 7, Ju: 11, Mo: 9, Ve: 4, Su: 10 }), { lagnaSign: 1 }));
    expect(ja.cancellations.find((c) => c.ruleId === 'mangal-cancel-jupiter-aspect')!.applies).toBe(true);
    expect(ja.cancellations.find((c) => c.ruleId === 'mangal-cancel-jupiter-aspect')!.detail.marsFromJupiter).toBe(9);
    // No dosha at all: Mars in the 3rd from Lagna, Moon and Venus.
    const none = mangalDosha(syntheticChart(signsWith({ Ma: 3, Mo: 1, Ve: 1, Ju: 9, Su: 1 }), { lagnaSign: 1 }));
    expect(none.present).toBe(false);
    expect(none.effective).toBe(false);
    // Unknown time: no Lagna reference.
    const unknown = mangalDosha(computeChart({ date: '1998-03-14', timeUnknown: true, tz: TZ, lat: 26.85, lon: 80.95 }));
    expect(unknown.lagnaUnknown).toBe(true);
    expect(unknown.fromLagna).toBeNull();
    expect(unknown.references).toHaveLength(2);
    // Real chart: Priya's Mars in the 1st (Meena) is combust -> cancelled by the combust rule.
    const p = mangalDosha(PRIYA);
    expect(p.present).toBe(true);
    expect(p.cancellations.find((c) => c.ruleId === 'mangal-cancel-debilitated-combust')!.applies).toBe(true);
    expect(p.effective).toBe(false);
  });

  it('mangalDoshaPair adds the mutual-cancellation row', () => {
    const manglik = syntheticChart(signsWith({ Ma: 7, Mo: 9, Ve: 4, Ju: 2, Su: 11 }), { lagnaSign: 1 });
    const both = mangalDoshaPair(manglik, manglik);
    expect(both.bothManglik.ruleId).toBe('mangal-cancel-both-manglik');
    expect(both.bothManglik.applies).toBe(true);
    expect(both.balanced).toBe(true);
    const one = mangalDoshaPair(manglik, PRIYA);
    expect(one.bothManglik.applies).toBe(false);
    expect(one.balanced).toBe(false);
  });

  it('beyond gun milan: four rows with tones, rule ids and a 5-year dasha overlap list', () => {
    const now = Date.UTC(2026, 9, 22);
    const r = beyondGunMilan(AMMA, PRIYA, now);
    expect(r.rows.map((x) => x.id)).toEqual(['seventh-lords', 'venus', 'moon-sign-relation', 'dasha-overlap']);
    expect(r.rows.map((x) => x.ruleId)).toEqual([...BEYOND_RULE_IDS]);
    for (const row of r.rows) expect(['harmonious', 'mixed', 'challenging']).toContain(row.tone);
    expect(r.horizon.from).toBe(now);
    expect(r.horizon.to - now).toBeCloseTo(5 * 365.2425 * 86_400_000, -3);
    expect(r.dashaOverlaps.length).toBeGreaterThan(0);
    for (let i = 0; i < r.dashaOverlaps.length; i++) {
      const o = r.dashaOverlaps[i];
      expect(o.end).toBeGreaterThan(o.start);
      expect(o.start).toBeGreaterThanOrEqual(now);
      expect(o.end).toBeLessThanOrEqual(r.horizon.to);
      if (i > 0) expect(o.start).toBeGreaterThanOrEqual(r.dashaOverlaps[i - 1].start);
    }
    // The overlaps tile the five years without gaps.
    expect(r.dashaOverlaps.reduce((s, o) => s + (o.end - o.start), 0)).toBeCloseTo(r.horizon.to - now, -3);
    const seventh = r.rows[0];
    expect(seventh.params.aSeventhLord).toBeTruthy();
    expect(seventh.approx).toBe(false);
    const u = beyondGunMilan(computeChart({ date: '1998-03-14', timeUnknown: true, tz: TZ, lat: 26.85, lon: 80.95 }), AMMA, now);
    expect(u.rows[0].approx).toBe(true);
  });
});
