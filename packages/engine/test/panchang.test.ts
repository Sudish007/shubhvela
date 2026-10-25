import { describe, expect, it } from 'vitest';
import { bhadraLocation, dishaShool, panchang, panchakWindow, specialYogas, VARA_LORDS, HORA_ORDER } from '../src/panchang/panchang';
import { amantaMonthOf, purnimantaMonth, samvatFor, lunationAt, localMidnight } from '../src/panchang/astro';
import { formatInZone } from '../src/tz/index';

const ZONE = 'Asia/Kolkata';
const DELHI = { lat: 28.6139, lon: 77.209 };
const hm = (ms: number | null) => (ms === null ? null : formatInZone(ms, ZONE, 'HH:mm'));

describe('panchang(day, observer, tz) — F8 fields', () => {
  const p = panchang('2026-03-15', DELHI, ZONE);

  it('returns every F8 field for Delhi 2026-03-15 (smoke pending the A04 Drik Panchang suite)', () => {
    expect(p.noSun).toBe(false);
    expect(hm(p.sunrise)).toBe('06:31'); // FEAT-A03: within 2 min of 06:31 IST
    expect(hm(p.sunset)).toBe('18:29');
    expect(p.nextSunrise).toBeGreaterThan(p.sunset!);
    expect(p.moonrise).not.toBeNull();
    expect(p.moonset).not.toBeNull();
    // Tithi, nakshatra, yoga, karana with end times (all after sunrise).
    for (const v of [p.tithi, p.nakshatra, p.yoga, p.karana]) {
      expect(v.start).toBeLessThanOrEqual(p.sunrise!);
      expect(v.end).toBeGreaterThan(p.sunrise!);
    }
    expect(p.tithi.n).toBeGreaterThanOrEqual(1);
    expect(p.tithi.n).toBeLessThanOrEqual(30);
    expect(p.tithi.paksha).toBe(p.tithi.n <= 15 ? 'shukla' : 'krishna');
    expect(p.nakshatra.pada).toBeGreaterThanOrEqual(1);
    expect(p.nakshatra.pada).toBeLessThanOrEqual(4);
    expect(p.nakshatra.lord).toBeDefined();
    expect(p.yoga.index).toBeGreaterThanOrEqual(0);
    expect(p.karana.index).toBeGreaterThanOrEqual(0);
    // Samvat, both month systems, ritu, ayana, signs.
    expect(p.vikramSamvat).toBe(2082); // Chaitra Shukla Pratipada 2026 is 19 March; 15 March is still Vikram 2082
    expect(p.shakaSamvat).toBe(1947);
    expect(p.vikramSamvat - p.shakaSamvat).toBe(135);
    expect(p.monthAmanta).toEqual({ index: 11, adhik: false }); // Phalguna (Amanta)
    expect(p.monthPurnimanta).toEqual({ index: 0, adhik: false }); // Chaitra Krishna paksha (Purnimanta)
    expect(p.ritu.vedic).toBe(5); // Shishira: Amanta month Phalguna (Drik "Vedic Ritu" follows the lunar month, A04)
    expect(p.ritu.drik).toBe(0); // Vasanta: tropical Sun past 330 deg
    expect(p.ayana.drik).toBe('uttarayana');
    expect(p.ayana.vedic).toBe('uttarayana');
    expect(p.sunSign).toBe(11); // Meena
    expect(p.moonSign).toBeGreaterThanOrEqual(0);
    expect(p.moonSign).toBeLessThanOrEqual(11);
    // Segments and grids.
    expect(p.rahuKaal).not.toBeNull();
    expect(p.yamaganda).not.toBeNull();
    expect(p.gulika).not.toBeNull();
    expect(p.abhijit).not.toBeNull();
    expect(p.brahma).not.toBeNull();
    expect(p.choghadiya.day).toHaveLength(8);
    expect(p.choghadiya.night).toHaveLength(8);
    expect(p.hora).toHaveLength(24);
    expect(p.vara).toBe(0); // Sunday
    expect(p.varaLord).toBe('Su');
    expect(p.dishaShool.avoid).toBe('west');
    expect(p.ayanamsaDeg).toBeGreaterThan(24.2);
    expect(p.ayanamsaDeg).toBeLessThan(24.3);
    expect(p.offsetMinutes).toBe(330);
  });

  it('lists every tithi/nakshatra/yoga/karana interval touching the Vedic day, contiguous and in order', () => {
    for (const list of [p.tithis, p.nakshatras, p.yogas, p.karanas, p.moonSigns]) {
      expect(list.length).toBeGreaterThan(0);
      expect(list[0].start).toBeLessThanOrEqual(p.sunrise!);
      expect(list[list.length - 1].end).toBeGreaterThanOrEqual(p.nextSunrise!);
      for (let i = 1; i < list.length; i++) expect(list[i].start).toBe(list[i - 1].end);
    }
    // 2026-10-22 Delhi vs Drik Panchang (reference/panchang/drikpanchang/delhi-2026-10-22.json, rounded minutes):
    // Shukla Ekadashi upto 02:47 PM, Shatabhisha upto 08:49 PM, Vriddhi upto 11:40 PM, Vishti (Bhadra) upto 02:47 PM,
    // moonrise 03:25 PM, moonset 03:17 AM Oct 23, Brahma Muhurta 04:45-05:35 AM. `hm` floors to the minute.
    const q = panchang('2026-10-22', DELHI, ZONE);
    expect(q.tithi.n).toBe(11);
    expect(q.tithi.paksha).toBe('shukla');
    expect(hm(q.tithi.end)).toBe('14:48'); // 14:48:0x; Drik prints 02:47 PM (1 min, within the 2-min gate)
    expect(q.nakshatra.index).toBe(23);
    expect(hm(q.nakshatra.end)).toBe('20:49');
    expect(q.yoga.index).toBe(10);
    expect(hm(q.yoga.end)).toBe('23:40'); // Drik: Vriddhi upto 11:40 PM
    expect(q.karana.index).toBe(6);
    expect(q.karana.bhadra).toBe(true);
    expect(hm(q.karana.end)).toBe('14:48'); // = tithi end
    expect(q.bhadra[0]).toMatchObject({ location: 'earth', moonSign: 10 });
    expect(q.monthAmanta).toEqual({ index: 6, adhik: false }); // Ashwin
    expect(q.monthPurnimanta).toEqual({ index: 6, adhik: false }); // Shukla paksha: same name
    expect(q.vikramSamvat).toBe(2083);
    expect(q.shakaSamvat).toBe(1948);
    // Vedic-day moonrise/moonset (sunrise 22 Oct -> sunrise 23 Oct), Moon's centre on the true horizon.
    expect(hm(q.moonrise)).toBe('15:25');
    expect(formatInZone(q.moonset!, ZONE, 'yyyy-MM-dd HH:mm')).toBe('2026-10-23 03:16');
    expect(hm(q.brahmaMorning!.start)).toBe('04:44'); // Drik 04:45 AM (rounded); 2/15 of the 21->22 Oct night before sunrise
    expect(hm(q.brahmaMorning!.end)).toBe('05:35');
    expect(q.brahma!.start).toBe(Math.round(q.nextSunrise! - (2 * (q.nextSunrise! - q.sunset!)) / 15));
    expect(q.ritu.drik).toBe(3); // Sharad (tropical) on 22 Oct
    expect(q.ritu.vedic).toBe(3); // Sharad (Amanta month Ashwin; Drik "Vedic Ritu")
    expect(q.ayana.drik).toBe('dakshinayana');
  });

  it('Adhik Jyeshtha 2026: Amanta and Purnimanta both carry the Adhik month; the preceding Krishna paksha is nija Jyeshtha only in Purnimanta', () => {
    const adhik = panchang('2026-05-20', DELHI, ZONE);
    expect(adhik.monthAmanta).toEqual({ index: 2, adhik: true });
    expect(adhik.monthPurnimanta).toEqual({ index: 2, adhik: true });
    const before = panchang('2026-05-10', DELHI, ZONE); // Vaishakha Krishna paksha
    expect(before.tithi.paksha).toBe('krishna');
    expect(before.monthAmanta).toEqual({ index: 1, adhik: false });
    expect(before.monthPurnimanta).toEqual({ index: 2, adhik: false });
    const nija = panchang('2026-06-20', DELHI, ZONE);
    expect(nija.monthAmanta).toEqual({ index: 2, adhik: false });
    const l = lunationAt(localMidnight('2026-05-20', ZONE));
    expect(l.adhik).toBe(true);
    expect(formatInZone(l.start, ZONE, 'yyyy-MM-dd')).toBe('2026-05-17');
    expect(formatInZone(l.end, ZONE, 'yyyy-MM-dd')).toBe('2026-06-15');
  });

  it('month-name helpers: Krishna paksha moves one month in Purnimanta; samvat changes at Chaitra', () => {
    expect(purnimantaMonth({ index: 6, adhik: false }, 'krishna')).toEqual({ index: 7, adhik: false }); // Ashwin K -> Kartik K
    expect(purnimantaMonth({ index: 6, adhik: false }, 'shukla')).toEqual({ index: 6, adhik: false });
    expect(purnimantaMonth({ index: 2, adhik: true }, 'krishna')).toEqual({ index: 2, adhik: true });
    expect(amantaMonthOf(7, 'krishna', 'purnimanta')).toBe(6);
    expect(amantaMonthOf(7, 'shukla', 'purnimanta')).toBe(7);
    expect(amantaMonthOf(7, 'krishna', 'amanta')).toBe(7);
    expect(samvatFor(9, 2027, 1)).toEqual({ vikram: 2083, shaka: 1948, lunarYearStart: 2026 }); // Pausha in January
    expect(samvatFor(9, 2026, 12)).toEqual({ vikram: 2083, shaka: 1948, lunarYearStart: 2026 }); // Pausha in December
    expect(samvatFor(0, 2026, 3)).toEqual({ vikram: 2083, shaka: 1948, lunarYearStart: 2026 });
  });

  it('weekday tables: Disha Shool, vara lords, hora order, Bhadra residence', () => {
    expect(dishaShool(1)).toMatchObject({ avoid: 'east', safe: ['west', 'north', 'south'] });
    expect(dishaShool(4).avoid).toBe('south');
    expect(dishaShool(7).avoid).toBe('west');
    expect(VARA_LORDS).toEqual(['Su', 'Mo', 'Ma', 'Me', 'Ju', 'Ve', 'Sa']);
    expect(HORA_ORDER).toEqual(['Su', 'Ve', 'Me', 'Mo', 'Sa', 'Ju', 'Ma']);
    expect(bhadraLocation(3)).toBe('earth'); // Karka
    expect(bhadraLocation(0)).toBe('heaven'); // Mesha
    expect(bhadraLocation(5)).toBe('patal'); // Kanya
  });

  it('special yogas: Guru Pushya, Sarvartha Siddhi, Tripushkar, Ravi yoga', () => {
    expect(specialYogas(4, 7, 0, 20).map((y) => y.key)).toEqual(expect.arrayContaining(['guru-pushya', 'sarvartha-siddhi']));
    expect(specialYogas(0, 2, 1, 0).map((y) => y.key)).toContain('tripushkar'); // Sunday, Dwitiya, Krittika
    expect(specialYogas(1, 0, 0, 24).map((y) => y.key)).toContain('ravi-yoga'); // count from Sun nak 25 to Moon nak 1 = 4
    expect(specialYogas(3, 1, 2, 10).map((y) => y.key)).toEqual([]);
  });

  it('Panchak window: Moon in Kumbha/Meena, full extent even when it started before the day', () => {
    const q = panchang('2026-10-23', DELHI, ZONE);
    expect(q.panchak).not.toBeNull();
    expect(formatInZone(q.panchak!.start, ZONE, 'yyyy-MM-dd HH:mm')).toBe('2026-10-21 07:00');
    expect(formatInZone(q.panchak!.end, ZONE, 'yyyy-MM-dd')).toBe('2026-10-25');
    expect(panchakWindow(localMidnight('2026-10-01', ZONE), localMidnight('2026-10-02', ZONE))).toBeNull();
  });

  it('polar day: noSun with null sun fields but the lunar fields still computed', () => {
    const q = panchang('2026-06-21', { lat: 78.2232, lon: 15.6267 }, 'Arctic/Longyearbyen');
    expect(q.noSun).toBe(true);
    expect(q.sunrise).toBeNull();
    expect(q.hora).toEqual([]);
    expect(q.tithi.n).toBeGreaterThanOrEqual(1);
  });
});
