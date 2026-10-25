import { describe, expect, it } from 'vitest';
import { computeChart } from '../src/kundli/index';
import { panchang } from '../src/panchang/panchang';
import { dailyNote, dayStrength, familyToday, moonHouseFrom, taraNumber, CHANDRA_BALA_GOOD, TARA_KEYS } from '../src/rules/daily';
import { formatInZone } from '../src/tz/index';

const ZONE = 'Asia/Kolkata';
const DELHI = { lat: 28.6139, lon: 77.209 };
const SAMPLE = computeChart({ date: '1998-03-14', time: '06:42', approxMinutes: 30, tz: ZONE, lat: 26.85, lon: 80.95 });
const hm = (ms: unknown) => (typeof ms === 'number' ? formatInZone(ms, ZONE, 'HH:mm') : ms);

describe('dailyNote (F6): 3-5 {ruleId, keys, params} rows in the fixed order', () => {
  const rows = dailyNote(SAMPLE, '2026-10-22', DELHI, ZONE);

  it('returns five rows for the sample chart in design order with 1-based `order`', () => {
    expect(rows.length).toBeGreaterThanOrEqual(3);
    expect(rows.length).toBeLessThanOrEqual(5);
    expect(rows.map((r) => r.ruleId)).toEqual(['chandra-bala', 'tara-bala', 'day-tithi-nakshatra', 'sade-sati', 'dasha-lords']);
    expect(rows.map((r) => r.order)).toEqual([1, 2, 3, 4, 5]);
    for (const r of rows) {
      expect(r.keys.length).toBeGreaterThan(0);
      expect(typeof r.params).toBe('object');
    }
  });

  it('Chandra bala: natal Moon Kanya, transit Moon Kumbha -> 6th house (favourable, not Chandrashtama)', () => {
    const r = rows[0];
    expect(r.keys).toEqual(['chandra-bala-6']);
    expect(r.params).toMatchObject({ house: 6, natalMoonSign: 6, transitMoonSign: 11, favourable: true, chandrashtama: false });
    expect(moonHouseFrom(6, 1)).toBe(8); // Mesha from Kanya = Chandrashtama
    expect(CHANDRA_BALA_GOOD).toEqual([1, 3, 6, 7, 10, 11]);
  });

  it('Tara bala: Uttara Phalguni (12) to Purva Bhadrapada (24) = Kshema (4), auspicious', () => {
    const r = rows[1];
    expect(r.keys).toEqual(['tara-bala-4']);
    expect(r.params).toMatchObject({ tara: 4, taraKey: 'kshema', natalNakshatra: 12, dayNakshatra: 24, auspicious: true });
    expect(hm(r.params.nakshatraEndsAt)).toBe('20:49'); // Drik Panchang: Shatabhisha upto 08:49 PM
    expect(taraNumber(12, 12)).toBe(1); // janma
    expect(taraNumber(12, 20)).toBe(9); // parama mitra
    expect(TARA_KEYS[7]).toBe('naidhana');
  });

  it('day row: tithi, nakshatra, vara keys plus Bhadra-on-earth and Panchak advice keys when the flags are active', () => {
    const r = rows[2];
    expect(r.keys).toEqual(['tithi-11', 'nakshatra-24', 'vara-4', 'bhadra-earth', 'panchak']);
    expect(r.params).toMatchObject({ tithi: 11, paksha: 'shukla', nakshatra: 24, vara: 4, bhadraLocation: 'earth' });
    expect(hm(r.params.tithiEndsAt)).toBe('14:48');
    expect(hm(r.params.bhadraEnd)).toBe('14:48');
    expect(r.params.panchakStart).toBeTypeOf('number');
  });

  it('Sade Sati row: Saturn in Meena is the 7th from Kanya -> none, next = Dhaiya start 2027-06-03', () => {
    const r = rows[3];
    expect(r.keys).toEqual(['sade-sati-none']);
    expect(r.params).toMatchObject({ state: 'none', saturnSign: 12, saturnHouseFromMoon: 7, nextKind: 'dhaiya-start', approx: false });
    expect(formatInZone(r.params.nextAt as number, ZONE, 'yyyy-MM-dd')).toBe('2027-06-03');
  });

  it('dasha row: Rahu maha / Ketu antar with day-strength from the vara lord (Thursday = Jupiter)', () => {
    const r = rows[4];
    expect(r.keys).toEqual(['dasha-Ra-Ke', 'day-strength-mixed']);
    expect(r.params).toMatchObject({ maha: 'Ra', antar: 'Ke', varaLord: 'Ju', mahaDayStrength: 'mixed', antarDayStrength: 'strong' });
    expect(Array.isArray(r.params.mahaHoras)).toBe(true);
    expect(dayStrength('Ju', 'Ju')).toBe('strong');
    expect(dayStrength('Sa', 'Su')).toBe('weak');
    expect(dayStrength('Ra', 'Su')).toBe('weak'); // Rahu read as Saturn
    expect(dayStrength('Ke', 'Su')).toBe('strong'); // Ketu read as Mars
  });

  it('accepts a pre-computed panchang and gives the same rows', () => {
    const p = panchang('2026-10-22', DELHI, ZONE);
    const again = dailyNote(SAMPLE, '2026-10-22', DELHI, ZONE, { panchang: p });
    expect(again.map((r) => r.keys)).toEqual(rows.map((r) => r.keys));
  });

  it('a Chandrashtama day is reported with house 8 (Moon in Mesha for a Kanya Moon)', () => {
    // Moon in Mesha on 2026-10-26 (A02 design samples: Moon in Mesha, Ashwini).
    const r = dailyNote(SAMPLE, '2026-10-26', DELHI, ZONE)[0];
    expect(r.keys).toEqual(['chandra-bala-8']);
    expect(r.params).toMatchObject({ house: 8, chandrashtama: true, favourable: false });
  });
});

describe('familyToday (F24)', () => {
  it('one row per profile with Chandra bala + Tara bala keys and the name param', () => {
    const amma = computeChart({ date: '1970-07-05', time: '04:30', tz: ZONE, lat: 25.5941, lon: 85.1376 });
    const rows = familyToday(
      [
        { id: 'p1', name: 'Priya', chart: SAMPLE },
        { id: 'p2', name: 'Amma', chart: amma },
      ],
      '2026-10-22',
      DELHI,
      ZONE,
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ profileId: 'p1', name: 'Priya', ruleId: 'family-today' });
    expect(rows[0].keys).toEqual(['chandra-bala-6', 'tara-bala-4']);
    expect(rows[1].keys[0]).toMatch(/^chandra-bala-\d+$/);
    expect(rows[1].keys[1]).toMatch(/^tara-bala-[1-9]$/);
    expect(rows[1].params.name).toBe('Amma');
    expect(typeof rows[1].params.chandrashtama).toBe('boolean');
  });
});
