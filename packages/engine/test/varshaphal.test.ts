// F17 Varshaphal: solar-return Sun within 0.01 deg of natal, Mudda periods sum to the year, Muntha advances one
// sign per year, the year lord comes from the five candidates with Panchavargiya bala, Tajika aspects are sign based.
import { describe, expect, it } from 'vitest';
import { computeChart } from '../src/kundli/index';
import { DASHA_YEAR_DAYS } from '../src/dasha/index';
import {
  HADDA,
  TRI_RASHI_LORDS,
  VARSHAPHAL_RULE_IDS,
  compoundRelation,
  drekkanaLord,
  haddaLord,
  muddaDasha,
  navamsaLord,
  panchavargiyaBala,
  solarReturnInstant,
  tajikaAspectKind,
  tajikaAspects,
  varshaphal,
} from '../src/varshaphal/index';
import { signsWith, syntheticChart } from './_synthetic';

const PRIYA = { date: '1998-03-14', time: '06:42', tz: 'Asia/Kolkata', lat: 26.85, lon: 80.95 };
const DAY_MS = 86_400_000;

describe('varshaphal (F17)', () => {
  const chart = computeChart(PRIYA);
  const v = varshaphal(chart, 2026);

  it('solar return: the sidereal Sun of the annual chart equals the natal Sun within 0.01 deg', () => {
    const natal = chart.planets.find((p) => p.id === 'Su')!.longitude;
    const ret = v.chart.planets.find((p) => p.id === 'Su')!.longitude;
    expect(Math.abs(((ret - natal + 540) % 360) - 180)).toBeLessThan(0.01);
    expect(v.year).toBe(2026);
    expect(v.age).toBe(28);
    // 2026-03-14 is around the 28th birthday; the return falls within 2 days of the birthday.
    expect(Math.abs(v.instant - Date.UTC(2026, 2, 14))).toBeLessThan(2 * DAY_MS);
    expect(v.nextInstant - v.instant).toBeGreaterThan(364 * DAY_MS);
    expect(v.nextInstant - v.instant).toBeLessThan(367 * DAY_MS);
    expect(solarReturnInstant(chart, 1998)).toBe(chart.meta.utcMs);
    expect(() => solarReturnInstant(chart, 1997)).toThrow();
    expect(v.chart.meta.lat).toBe(PRIYA.lat);
    expect(v.tz).toBe('Asia/Kolkata');
  });

  it('Mudda dasha: nine Vimshottari-proportional periods that cover the year exactly, starting from the natal Moon nakshatra lord', () => {
    expect(v.muddaDasha).toHaveLength(9);
    expect(v.muddaDasha[0].start).toBe(v.instant);
    expect(v.muddaDasha[8].end).toBe(v.nextInstant);
    for (let i = 1; i < 9; i++) expect(v.muddaDasha[i].start).toBe(v.muddaDasha[i - 1].end);
    expect(v.muddaDasha.reduce((s, m) => s + m.share, 0)).toBeCloseTo(1, 12);
    const moon = chart.planets.find((p) => p.id === 'Mo')!;
    // Uttara Phalguni (12) -> Sun.
    expect(moon.nakshatra).toBe(12);
    expect(v.muddaDasha[0].lord).toBe('Su');
    const year = v.nextInstant - v.instant;
    expect(v.muddaDasha[0].end - v.muddaDasha[0].start).toBeCloseTo((year * 6) / 120, -3);
    const direct = muddaDasha(1, 0, 120);
    expect(direct.map((m) => m.lord)).toEqual(['Ke', 'Ve', 'Su', 'Mo', 'Ma', 'Ra', 'Ju', 'Sa', 'Me']);
    expect(direct.map((m) => m.end - m.start)).toEqual([7, 20, 6, 10, 7, 18, 16, 19, 17]);
  });

  it('Muntha advances one sign per completed year from the natal Lagna and is read in the annual chart', () => {
    const lagna = chart.lagna!.sign;
    expect(v.muntha.sign).toBe(((lagna - 1 + 28) % 12) + 1);
    expect(v.muntha.base).toBe('lagna');
    expect(v.muntha.house).toBe(((v.muntha.sign - v.chart.firstHouseSign + 12) % 12) + 1);
    const next = varshaphal(chart, 2027);
    expect(next.muntha.sign).toBe((v.muntha.sign % 12) + 1);
    const unknown = varshaphal(computeChart({ ...PRIYA, time: undefined, timeUnknown: true }), 2026);
    expect(unknown.muntha.base).toBe('moon');
    expect(unknown.approx).toBe(true);
  });

  it('year lord: five candidates with roles, the chosen one aspects the Lagna (friendly first) with the highest bala', () => {
    const roles = v.yearLord.candidates.map((c) => c.role);
    expect(roles).toEqual(['muntha-lord', 'janma-lagna-lord', 'varsha-lagna-lord', 'tri-rashi-lord', 'dina-ratri-lord']);
    expect(v.yearLord.candidates.some((c) => c.planet === v.yearLord.planet && c.role === v.yearLord.role)).toBe(true);
    expect(v.yearLord.method).toBe('tajika-panchadhikari');
    const chosen = v.yearLord.candidates.find((c) => c.role === v.yearLord.role)!;
    expect(chosen.aspectsLagna).toBe(true);
    const friendly = v.yearLord.candidates.filter((c) => c.aspectKind === 'friendly-3-11' || c.aspectKind === 'secret-friendly-5-9');
    const pool = friendly.length ? friendly : v.yearLord.candidates.filter((c) => c.aspectsLagna);
    expect(chosen.bala).toBe(Math.max(...pool.map((c) => c.bala)));
    expect(v.yearLord.candidates.find((c) => c.role === 'janma-lagna-lord')!.planet).toBe('Ju'); // Meena Lagna
    expect(v.yearLord.candidates.find((c) => c.role === 'tri-rashi-lord')!.planet).toBe(TRI_RASHI_LORDS[v.chart.firstHouseSign - 1][v.dayReturn ? 0 : 1]);
    expect(v.ruleIds).toEqual(VARSHAPHAL_RULE_IDS);
  });

  it('Panchavargiya bala: components within their maxima, total/4 graded; own sign gives 30 kshetra', () => {
    for (const id of ['Su', 'Mo', 'Ma', 'Me', 'Ju', 'Ve', 'Sa'] as const) {
      const b = v.balas[id]!;
      expect(b.kshetra.value).toBeLessThanOrEqual(30);
      expect(b.uccha.value).toBeGreaterThanOrEqual(0);
      expect(b.uccha.value).toBeLessThanOrEqual(20);
      expect(b.hadda.value).toBeLessThanOrEqual(15);
      expect(b.drekkana.value).toBeLessThanOrEqual(10);
      expect(b.navamsa.value).toBeLessThanOrEqual(5);
      expect(b.total).toBeCloseTo(b.kshetra.value + b.uccha.value + b.hadda.value + b.drekkana.value + b.navamsa.value, 9);
      expect(b.rupas).toBeCloseTo(b.total / 4, 9);
    }
    expect(v.balas.Ra).toBeNull();
    // Saturn in Kumbha (own) at its deep exaltation distance: kshetra 30.
    const own = syntheticChart(signsWith({ Sa: 11, Su: 4, Mo: 8, Ma: 1, Me: 3, Ju: 9, Ve: 2, Ra: 5, Ke: 11 }), { lagnaSign: 10 });
    const b = panchavargiyaBala(own, 'Sa')!;
    expect(b.kshetra).toEqual({ value: 30, relation: 'own', signLord: 'Sa' });
    expect(compoundRelation(own, 'Sa', 'Sa')).toBe('own');
    // Sun at 10 Mesha = deep exaltation -> uccha 20; at 10 Tula -> 0.
    const ex = syntheticChart(signsWith({ Su: 1 }), { degree: 10 });
    expect(panchavargiyaBala(ex, 'Su')!.uccha.value).toBeCloseTo(20, 9);
    const deb = syntheticChart(signsWith({ Su: 7 }), { degree: 10 });
    expect(panchavargiyaBala(deb, 'Su')!.uccha.value).toBeCloseTo(0, 9);
  });

  it('hadda, drekkana and navamsa lords follow their tables', () => {
    expect(HADDA).toHaveLength(12);
    for (const row of HADDA) expect(row[4][0]).toBe(30);
    expect(haddaLord(3)).toBe('Ju'); // Mesha 0-6 Jupiter
    expect(haddaLord(29.5)).toBe('Sa'); // Mesha 25-30 Saturn
    expect(haddaLord(30 + 5)).toBe('Ve'); // Vrishabha 0-8 Venus
    expect(drekkanaLord(5)).toBe('Ma'); // Mesha 1st drekkana -> Mesha lord
    expect(drekkanaLord(15)).toBe('Su'); // 2nd drekkana -> 5th sign Simha
    expect(drekkanaLord(25)).toBe('Ju'); // 3rd -> 9th sign Dhanu
    expect(navamsaLord(0)).toBe('Ma'); // first navamsa of Mesha is Mesha
    expect(navamsaLord(3.4)).toBe('Ve'); // second navamsa Vrishabha
  });

  it('Tajika aspects are sign based: 3/11 friendly, 5/9 secret friendly, 1/7 inimical, 4/10 secret inimical, 2/12 and 6/8 none', () => {
    expect(tajikaAspectKind(3)).toBe('friendly-3-11');
    expect(tajikaAspectKind(11)).toBe('friendly-3-11');
    expect(tajikaAspectKind(5)).toBe('secret-friendly-5-9');
    expect(tajikaAspectKind(7)).toBe('inimical-1-7');
    expect(tajikaAspectKind(10)).toBe('secret-inimical-4-10');
    expect(tajikaAspectKind(2)).toBeNull();
    expect(tajikaAspectKind(6)).toBeNull();
    const list = tajikaAspects(v.chart);
    expect(list.length).toBeGreaterThan(0);
    expect(list.length).toBeLessThanOrEqual(45);
    for (const a of list) expect(tajikaAspectKind(a.distance)).toBe(a.kind);
    expect(v.tajikaAspects).toEqual(list);
  });

  it('transit calendar covers the year for Sun, Mars, Jupiter, Saturn, Rahu and Ketu with contiguous sign intervals', () => {
    for (const planet of ['Su', 'Ma', 'Ju', 'Sa', 'Ra', 'Ke'] as const) {
      const rows = v.transitCalendar.filter((t) => t.planet === planet);
      expect(rows.length).toBeGreaterThan(0);
      expect(rows[0].from).toBe(v.instant);
      expect(rows[rows.length - 1].to).toBe(v.nextInstant);
      for (let i = 1; i < rows.length; i++) {
        expect(rows[i].from).toBe(rows[i - 1].to);
        expect(rows[i].sign).not.toBe(rows[i - 1].sign);
      }
    }
    // The Sun crosses every sign once in a year: 13 intervals (the first and last share the natal sign).
    expect(v.transitCalendar.filter((t) => t.planet === 'Su')).toHaveLength(13);
    expect(DASHA_YEAR_DAYS).toBeCloseTo(365.2425, 6);
  });
});
