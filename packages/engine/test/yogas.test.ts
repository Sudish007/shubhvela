// F16 yogas on constructed charts: Gaja Kesari formed, Kemadruma cancelled by a planet in the 2nd from the Moon
// (that is Sunapha, so not Kemadruma) and by a kendra planet, Pancha Mahapurusha, Vipreet, Dhana, Raja, exchange,
// Kala Sarpa, Neecha Bhanga; every result carries formed/cancelledBy/ruleId and the catalogue has >= 25 yogas.
import { describe, expect, it } from 'vitest';
import { computeChart } from '../src/kundli/index';
import { YOGA_BHANGA_IDS, YOGA_IDS, YOGA_RULE_IDS, yogas } from '../src/yogas/index';
import { signsWith, syntheticChart } from './_synthetic';

const ids = (r: ReturnType<typeof yogas>): string[] => r.yogas.map((y) => y.id);
const get = (r: ReturnType<typeof yogas>, id: string) => r.yogas.find((y) => y.id === id);

describe('yogas (F16)', () => {
  it('catalogue: >= 25 named yogas, unique ids, one rule id per yoga and per bhanga', () => {
    expect(YOGA_IDS.length).toBeGreaterThanOrEqual(25);
    expect(new Set(YOGA_IDS).size).toBe(YOGA_IDS.length);
    expect(YOGA_RULE_IDS).toHaveLength(YOGA_IDS.length + YOGA_BHANGA_IDS.length);
    for (const id of YOGA_IDS) expect(YOGA_RULE_IDS).toContain(`yoga-${id}`);
  });

  it('Gaja Kesari forms with Jupiter in a kendra from the Moon and is cancelled when Jupiter is combust', () => {
    // Moon Karka (4), Jupiter Tula (7) = 4th from the Moon; Lagna Mesha.
    const chart = syntheticChart(signsWith({ Mo: 4, Ju: 7, Ma: 10, Me: 8, Ve: 9, Sa: 12, Su: 2, Ra: 3, Ke: 9 }), { lagnaSign: 1 });
    const r = yogas(chart);
    const gk = get(r, 'gaja-kesari');
    expect(gk).toBeDefined();
    expect(gk!.formed).toBe(true);
    expect(gk!.ruleId).toBe('yoga-gaja-kesari');
    expect(gk!.participants).toEqual(['Ju', 'Mo']);
    expect(gk!.params.houseFromMoon).toBe(4);
    const combust = yogas(syntheticChart(signsWith({ Mo: 4, Ju: 7, Ma: 10, Me: 8, Ve: 9, Sa: 12, Su: 7, Ra: 3, Ke: 9 }), { lagnaSign: 1, combust: ['Ju'] }));
    expect(get(combust, 'gaja-kesari')!.formed).toBe(false);
    expect(get(combust, 'gaja-kesari')!.cancelledBy).toBe('gaja-kesari-bhanga-jupiter-weak');
  });

  it('Kemadruma: no planet in the 2nd/12th from the Moon; a planet in the 2nd makes it Sunapha instead; a kendra planet cancels it', () => {
    // Moon Karka (4). Nothing in Mithuna (3) or Simha (5) apart from Sun/nodes; Mars Tula (7) = kendra from Moon -> bhanga.
    const base = signsWith({ Mo: 4, Su: 5, Ma: 7, Me: 9, Ju: 11, Ve: 12, Sa: 2, Ra: 3, Ke: 9 });
    const r = yogas(syntheticChart(base, { lagnaSign: 11 }));
    const k = get(r, 'kemadruma');
    expect(k).toBeDefined();
    expect(k!.formed).toBe(false);
    expect(k!.cancelledBy).toBe('kemadruma-bhanga-kendra-from-moon');
    expect(k!.params.kendraFromMoon).toEqual(['Ma']);
    // Move Mars to Simha (2nd from the Moon): Sunapha, no Kemadruma row at all.
    const sunapha = yogas(syntheticChart({ ...base, Ma: 5 }, { lagnaSign: 11 }));
    expect(get(sunapha, 'kemadruma')).toBeUndefined();
    expect(get(sunapha, 'sunapha')!.formed).toBe(true);
    expect(get(sunapha, 'sunapha')!.participants).toContain('Ma');
    // No planet in 2/12 and none in any kendra from Moon or Lagna: Kemadruma stands.
    const bare = yogas(syntheticChart(signsWith({ Mo: 4, Su: 5, Ma: 9, Me: 9, Ju: 11, Ve: 12, Sa: 2, Ra: 3, Ke: 9 }), { lagnaSign: 1 }));
    expect(get(bare, 'kemadruma')!.formed).toBe(true);
    expect(get(bare, 'kemadruma')!.cancelledBy).toBeUndefined();
  });

  it('Pancha Mahapurusha: a planet in own/exalted sign in a kendra, cancelled when combust', () => {
    // Lagna Mesha: Mars in Mesha (1st, own) -> Ruchaka; Jupiter in Karka (4th, exalted) -> Hamsa; Saturn in Tula (7th, exalted) -> Sasa.
    const r = yogas(syntheticChart(signsWith({ Ma: 1, Ju: 4, Sa: 7, Ve: 5, Me: 8, Mo: 6, Su: 9, Ra: 2, Ke: 8 }), { lagnaSign: 1 }));
    expect(ids(r)).toEqual(expect.arrayContaining(['ruchaka', 'hamsa', 'sasa']));
    expect(get(r, 'hamsa')!.params.dignity).toBe('exalted');
    expect(get(r, 'ruchaka')!.houses).toEqual([1]);
    const c = yogas(syntheticChart(signsWith({ Ma: 1, Ju: 4, Sa: 7, Ve: 5, Me: 8, Mo: 6, Su: 1, Ra: 2, Ke: 8 }), { lagnaSign: 1, combust: ['Ma'] }));
    expect(get(c, 'ruchaka')!.formed).toBe(false);
    expect(get(c, 'ruchaka')!.cancelledBy).toBe('mahapurusha-bhanga-combust');
  });

  it('Budhaditya, Chandra-Mangala, Guru-Chandala, Vesi/Vasi/Ubhayachari, Anapha/Durudhara', () => {
    const r = yogas(syntheticChart(signsWith({ Su: 5, Me: 5, Mo: 10, Ma: 10, Ju: 11, Ra: 11, Ve: 6, Sa: 4, Ke: 5 }), { lagnaSign: 2 }));
    expect(get(r, 'budhaditya')!.formed).toBe(true);
    expect(get(r, 'chandra-mangala')!.formed).toBe(true);
    expect(get(r, 'guru-chandala')!.participants).toEqual(['Ju', 'Ra']);
    // Venus in Tula (6) = 2nd from the Sun (5), Saturn in Karka (4) = 12th from the Sun -> Ubhayachari.
    expect(get(r, 'ubhayachari')!.formed).toBe(true);
    // Moon Makara (10): Jupiter Kumbha (11) = 2nd -> Sunapha (Mars conjunct Moon does not count as 2nd/12th).
    expect(get(r, 'sunapha')).toBeDefined();
    const an = yogas(syntheticChart(signsWith({ Su: 5, Me: 7, Mo: 10, Ma: 2, Ju: 9, Ra: 1, Ve: 6, Sa: 3, Ke: 7 }), { lagnaSign: 2 }));
    expect(get(an, 'anapha')!.formed).toBe(true); // Jupiter Dhanu (9) = 12th from Moon Makara
    expect(get(an, 'vesi')!.formed).toBe(true); // Venus Tula 2nd from Sun Simha, nothing in 12th (Karka)
    const dd = yogas(syntheticChart(signsWith({ Su: 5, Me: 11, Mo: 10, Ma: 2, Ju: 9, Ra: 1, Ve: 6, Sa: 4, Ke: 7 }), { lagnaSign: 2 }));
    expect(get(dd, 'durudhara')!.formed).toBe(true);
  });

  it('Vipreet Raja (Harsha/Sarala/Vimala), Dhana 2-11, Raja kendra-trikona, Dharma-Karmadhipati, Parivartana', () => {
    // Lagna Mesha: 6th lord Mercury (Kanya) in the 8th (Vrishchika) -> Harsha; 8th lord Mars in 12th (Meena) -> Sarala;
    // 12th lord Jupiter in 6th (Kanya) -> Vimala. 2nd lord Venus and 11th lord Saturn conjunct in Makara -> Dhana.
    // 9th lord Jupiter (Dhanu) ... Jupiter is in Kanya here; 10th lord Saturn in Makara (own). Moon Vrishabha, Sun Tula.
    const r = yogas(syntheticChart(signsWith({ Me: 8, Ma: 12, Ju: 6, Ve: 10, Sa: 10, Mo: 2, Su: 7, Ra: 3, Ke: 9 }), { lagnaSign: 1 }));
    expect(get(r, 'harsha')!.formed).toBe(true);
    expect(get(r, 'harsha')!.params).toEqual({ lordOf: 6, inHouse: 8 });
    expect(get(r, 'sarala')!.formed).toBe(true);
    expect(get(r, 'vimala')!.formed).toBe(true);
    expect(get(r, 'dhana-2-11')!.params.relation).toBe('conjunction');
    // Raja: kendra lord (7th Venus / 10th Saturn) conjunct a trikona lord? Venus owns 2 and 7, Saturn 10 and 11; the
    // trikona lords are Mars (1), Sun (5), Jupiter (9): Mars (Meena) with Jupiter? Jupiter in Kanya -> no; so none.
    expect(get(r, 'raja-kendra-trikona')).toBeUndefined();
    // Lagna Simha: 9th lord Mars (Mesha) and 10th lord Venus (Vrishabha) in exchange -> Dharma-Karmadhipati + Raja +
    // Parivartana (maha: houses 9 and 10).
    const dk = yogas(syntheticChart(signsWith({ Ma: 2, Ve: 1, Su: 5, Mo: 11, Me: 6, Ju: 9, Sa: 10, Ra: 3, Ke: 9 }), { lagnaSign: 5 }));
    expect(get(dk, 'dharma-karmadhipati')!.params.relation).toBe('exchange');
    expect(get(dk, 'raja-kendra-trikona')!.participants).toEqual(expect.arrayContaining(['Ma', 'Ve']));
    expect(get(dk, 'parivartana')!.params.kinds).toEqual(['maha']);
    expect(get(dk, 'parivartana')!.formed).toBe(true);
  });

  it('Kala Sarpa: all seven planets strictly between Rahu and Ketu; absent when one planet crosses the axis', () => {
    // Rahu Mesha (1), Ketu Tula (7): planets in Vrishabha..Kanya (2-6).
    const inside = signsWith({ Ra: 1, Ke: 7, Su: 2, Mo: 3, Ma: 4, Me: 5, Ju: 6, Ve: 2, Sa: 3 });
    const r = yogas(syntheticChart(inside, { lagnaSign: 2 }));
    expect(get(r, 'kala-sarpa')!.formed).toBe(true);
    expect(get(r, 'kala-sarpa')!.params.direction).toBe('rahu-to-ketu');
    const out = yogas(syntheticChart({ ...inside, Sa: 9 }, { lagnaSign: 2 }));
    expect(get(out, 'kala-sarpa')).toBeUndefined();
    const rev = yogas(syntheticChart({ ...inside, Su: 8, Mo: 9, Ma: 10, Me: 11, Ju: 12, Ve: 8, Sa: 9 }, { lagnaSign: 2 }));
    expect(get(rev, 'kala-sarpa')!.params.direction).toBe('ketu-to-rahu');
  });

  it('Neecha Bhanga Raja: a debilitated planet whose debilitation lord is in a kendra', () => {
    // Saturn debilitated in Mesha; Mars (lord of Mesha) in Karka = 4th from Lagna Mesha -> bhanga.
    // Mars in Karka is itself debilitated (exaltation lord Saturn in the 1st) -> one Neecha Bhanga row per planet.
    const r = yogas(syntheticChart(signsWith({ Sa: 1, Ma: 4, Mo: 11, Su: 5, Me: 6, Ju: 9, Ve: 2, Ra: 3, Ke: 9 }), { lagnaSign: 1 }));
    const rows = r.yogas.filter((y) => y.id === 'neecha-bhanga-raja');
    expect(rows.map((y) => y.params.planet).sort()).toEqual(['Ma', 'Sa']);
    const nb = rows.find((y) => y.params.planet === 'Sa')!;
    expect(nb.params.reasons).toContain('debilitation-lord-in-kendra');
    expect(nb.participants).toEqual(expect.arrayContaining(['Sa', 'Ma']));
    expect(rows.find((y) => y.params.planet === 'Ma')!.params.reasons).toContain('exaltation-lord-in-kendra');
  });

  it('Shakata is cancelled by Jupiter in a kendra from the Lagna; Adhi needs all three benefics in 6/7/8 from the Moon', () => {
    // Moon Mesha (1), Jupiter Kanya (6) = 6th from Moon; Lagna Dhanu (9) -> Jupiter in Kanya is the 10th house -> bhanga.
    const r = yogas(syntheticChart(signsWith({ Mo: 1, Ju: 6, Su: 5, Ma: 2, Me: 7, Ve: 8, Sa: 10, Ra: 3, Ke: 9 }), { lagnaSign: 9 }));
    expect(get(r, 'shakata')!.formed).toBe(false);
    expect(get(r, 'shakata')!.cancelledBy).toBe('shakata-bhanga-jupiter-kendra');
    // Mercury Tula (7th from Moon), Venus Vrishchika (8th), Jupiter Kanya (6th) -> Adhi.
    expect(get(r, 'adhi')!.formed).toBe(true);
    const plain = yogas(syntheticChart(signsWith({ Mo: 1, Ju: 6, Su: 5, Ma: 2, Me: 7, Ve: 8, Sa: 10, Ra: 3, Ke: 9 }), { lagnaSign: 2 }));
    expect(get(plain, 'shakata')!.formed).toBe(true);
  });

  it('runs on a real chart and in Moon-chart mode (Lagna-based yogas flagged fromMoonChart)', () => {
    const PRIYA = { date: '1998-03-14', time: '06:42', tz: 'Asia/Kolkata', lat: 26.85, lon: 80.95 };
    const r = yogas(computeChart(PRIYA));
    expect(r.yogas.length).toBeGreaterThan(0);
    expect(r.found).toBe(r.yogas.filter((y) => y.formed).length);
    for (const y of r.yogas) {
      expect(YOGA_IDS).toContain(y.id);
      expect(y.ruleId).toBe(`yoga-${y.id}`);
      expect(y.participants.length).toBeGreaterThan(0);
      expect(y.houses).toHaveLength(y.participants.length);
      if (!y.formed) expect(YOGA_BHANGA_IDS).toContain(y.cancelledBy);
    }
    const u = yogas(computeChart({ ...PRIYA, time: undefined, timeUnknown: true }));
    for (const y of u.yogas) if (!['lunar', 'solar'].includes(y.family)) expect(y.fromMoonChart).toBe(true);
    expect(u.yogas.some((y) => y.family === 'vipreet' || y.family === 'dhana')).toBe(false);
  });
});
