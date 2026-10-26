// F31 report models: every section present for en/hi/bho, names resolved from the locale tables, Ghatak table
// consistent, "how this was computed" lines and the disclaimer key present; matching and Varshaphal models too.
import { describe, expect, it } from 'vitest';
import { computeChart } from '../src/kundli/index';
import { LANGS, lunarMonthNames, nakshatraNames, planetNames, signNames } from '../src/locale/index';
import { GHATAK_TABLE, REPORT_DISCLAIMER_KEY, REPORT_RULE_IDS, avakahada, degreeString, ghatakChakra, janamPatriModel, matchingReportModel, panchangAtBirth, varshaphalReportModel } from '../src/report/index';

const TZ = 'Asia/Kolkata';
const PRIYA = computeChart({ date: '1998-03-14', time: '06:42', tz: TZ, lat: 26.85, lon: 80.95 });
const AMMA = computeChart({ date: '1970-07-05', time: '04:30', tz: TZ, lat: 25.61, lon: 85.14 });
const NOW = Date.UTC(2026, 9, 22, 5, 28);

describe('report models (F31)', () => {
  it('Janam Patri: every section for en, hi and bho with locale names', () => {
    for (const lang of LANGS) {
      const m = janamPatriModel(PRIYA, { name: 'Priya', placeName: 'Lucknow', gender: 'f' }, lang, { nowMs: NOW });
      expect(m.kind).toBe('janam-patri');
      expect(m.lang).toBe(lang);
      expect(m.header).toMatchObject({ name: 'Priya', birthDate: '1998-03-14', birthTime: '06:42', timeUnknown: false, tz: 'Asia/Kolkata', offset: '+05:30', place: 'Lucknow' });
      expect(m.header.birthLine).toContain('1998');
      expect(m.header.birthLine).toContain('06:42');
      expect(m.panchangAtBirth.tithi.name).toBe(lang === 'en' ? 'Pratipada' : 'प्रतिपदा');
      expect(m.panchangAtBirth.tithi.paksha).toBe('krishna'); // Phalguna Krishna Pratipada (A03 finding)
      expect(m.panchangAtBirth.nakshatra).toMatchObject({ n: 12, pada: 4, lord: 'Su', name: nakshatraNames[lang][11] });
      expect(m.panchangAtBirth.vara).toBe(6); // Saturday
      expect(m.panchangAtBirth.monthAmanta.name).toBe(lunarMonthNames[lang][m.panchangAtBirth.monthAmanta.index]);
      expect(m.panchangAtBirth.vikramSamvat).toBe(2054);
      expect(m.panchangAtBirth.shakaSamvat).toBe(1919);
      expect(m.charts.d1.variant).toBe('lagna');
      expect(m.charts.d9.variant).toBe('D9');
      expect(m.charts.moon.variant).toBe('moon');
      expect(m.planetTable).toHaveLength(9);
      expect(m.planetTable[0].name).toBe(planetNames[lang].Su);
      expect(m.planetTable.every((r) => /^\d{1,2}°\d{2}′$/.test(r.degree))).toBe(true);
      expect(m.dashaTable.length).toBeGreaterThanOrEqual(9);
      expect(m.dashaTable.filter((r) => r.current)).toHaveLength(1);
      expect(m.dashaTable.find((r) => r.current)!.lord).toBe('Ra');
      expect(m.dashaTable.find((r) => r.current)!.antars.filter((a) => a.current)).toHaveLength(1);
      expect(m.dashaBalance.lord).toBeTruthy();
      expect(m.avakahada).toMatchObject({ varna: 'vaishya', rashi: { n: 6, name: signNames[lang][5], lord: 'Me' }, nakshatraCharan: 4, nakshatraLord: 'Su', tatva: 'earth', ruleId: 'avakahada-chakra' });
      expect(m.avakahada.lagna).toMatchObject({ n: 12, lord: 'Ju' });
      expect(m.avakahada.nameSyllable.syllable.latin).toBe('Pi');
      expect(['deva', 'manushya', 'rakshasa']).toContain(m.avakahada.gana);
      expect(m.ghatakChakra).toMatchObject({ moonSign: 6, tithiGroup: 'purna', tithis: [5, 10, 15], vara: { n: 6 }, nakshatra: { n: 22 }, chandra: { n: 3 }, lagna: { n: 6 }, ruleId: 'ghatak-chakra' });
      expect(m.ghatakChakra.month.name).toBe(lunarMonthNames[lang][5]); // Bhadrapada
      expect(m.mangalStatement.ruleId).toBe('mangal-dosha');
      expect(m.mangalStatement.cancellations).toHaveLength(5);
      expect(m.computedWith.map((l) => l.key)).toEqual(['ayanamsa', 'node', 'ephemeris', 'timezone', 'houseSystem', 'rounding', 'conventions']);
      expect(m.computedWith[0].value).toMatch(/^lahiri 2[34]\.\d{4}°$/);
      expect(m.computedWith[3].value).toContain('tzdb');
      expect(m.disclaimer).toBe(REPORT_DISCLAIMER_KEY);
      expect(m.ruleIds).toContain('how-computed');
      expect(m.ruleIds).toContain('ghatak-chakra');
    }
    expect(REPORT_RULE_IDS).toEqual(['avakahada-chakra', 'ghatak-chakra', 'how-computed']);
    expect(degreeString({ degree: 6, minute: 4 })).toBe('6°04′');
  });

  it('unknown birth time: approx panchang, no lagna in the avakahada, moon-chart convention listed', () => {
    const u = computeChart({ date: '1998-03-14', timeUnknown: true, tz: TZ, lat: 26.85, lon: 80.95 });
    const m = janamPatriModel(u, {}, 'en', { nowMs: NOW });
    expect(m.header.timeUnknown).toBe(true);
    expect(m.header.birthTime).toBeNull();
    expect(m.header.birthLine).not.toContain(':');
    expect(m.panchangAtBirth.approx).toBe(true);
    expect(m.avakahada.lagna).toBeNull();
    expect(m.ruleIds).toContain('moon-chart');
    expect(m.mangalStatement.lagnaUnknown).toBe(true);
  });

  it('Ghatak table is complete and internally consistent', () => {
    expect(GHATAK_TABLE).toHaveLength(12);
    expect(GHATAK_TABLE.map((r) => r[0]).sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]); // every month once
    expect(GHATAK_TABLE.map((r) => r[4])).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]); // yogas in order
    for (const [, group, vara, nak, , karana, chandra] of GHATAK_TABLE) {
      expect(['nanda', 'bhadra', 'jaya', 'rikta', 'purna']).toContain(group);
      expect(vara >= 0 && vara <= 6).toBe(true);
      expect(nak >= 1 && nak <= 27).toBe(true);
      expect(karana >= 0 && karana <= 10).toBe(true);
      expect(chandra >= 1 && chandra <= 12).toBe(true);
    }
    const g = ghatakChakra(PRIYA, 'en');
    expect(g.month.name).toBe('Bhadrapada');
    expect(g.nakshatra.name).toBe('Shravana');
    expect(g.vara.name).toBe('Saturday');
    const a = avakahada(PRIYA, 'bho');
    expect(a.nakshatra.name).toBe(nakshatraNames.bho[11]);
  });

  it('a birth before sunrise belongs to the previous Vedic day', () => {
    // Amma 1970-07-05 04:30 Patna: sunrise ~05:10 -> Vedic day 1970-07-04 (Saturday).
    const p = panchangAtBirth(AMMA, 'en');
    expect(p.vedicDate).toBe('1970-07-04');
    expect(p.vara).toBe(6);
    expect(p.varaName).toBe('Saturday');
  });

  it('matching report: both charts, 36-guna table, dosha pair, beyond rows, language of profile A', () => {
    const m = matchingReportModel(AMMA, PRIYA, { a: { name: 'Amma' }, b: { name: 'Priya' } }, 'hi', { nowMs: NOW });
    expect(m.kind).toBe('matching');
    expect(m.lang).toBe('hi');
    expect(m.a.header.name).toBe('Amma');
    expect(m.b.header.name).toBe('Priya');
    expect(m.a.moon.variant).toBe('moon');
    expect(m.ashtakoota.kootas).toHaveLength(8);
    expect(m.ashtakoota.total).toBeLessThanOrEqual(36);
    expect(m.mangal.a.ruleId).toBe('mangal-dosha');
    expect(m.mangal.bothManglik.ruleId).toBe('mangal-cancel-both-manglik');
    expect(m.beyond.rows).toHaveLength(4);
    expect(m.ruleIds).toEqual(expect.arrayContaining(['koota-nadi', 'mangal-dosha', 'beyond-dasha-overlap', 'how-computed']));
    expect(m.disclaimer).toBe(REPORT_DISCLAIMER_KEY);
  });

  it('Varshaphal report: return line, annual planet table, Mudda and transit tables', () => {
    const m = varshaphalReportModel(PRIYA, 2026, { name: 'Priya' }, 'en', { nowMs: NOW });
    expect(m.kind).toBe('varshaphal');
    expect(m.year).toBe(2026);
    expect(m.age).toBe(28);
    expect(m.returnLine).toMatch(/^\w+ 14 March 2026 · \d{2}:\d{2}$/);
    expect(m.planetTable).toHaveLength(9);
    expect(m.muddaTable).toHaveLength(9);
    expect(m.muddaTable[0].name).toBe('Sun');
    expect(m.transitTable.length).toBeGreaterThan(10);
    expect(m.transitTable.every((t) => t.signName === signNames.en[t.sign - 1])).toBe(true);
    expect(m.varshaphal.yearLord.candidates).toHaveLength(5);
    expect(m.ruleIds).toContain('varshaphal-muntha');
    expect(() => varshaphalReportModel(PRIYA, 2026, {}, 'xx' as never)).toThrow();
  });
});
