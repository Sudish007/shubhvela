import { describe, expect, it } from 'vitest';
import {
  TZDB_VERSION,
  canonicalZone,
  formatInZone,
  formatOffset,
  hasZone,
  localToUtc,
  offsetAt,
  utcToWall,
  zoneAt,
  zoneIndex,
  zoneList,
} from '../src/tz/index';

const utc = (y: number, m: number, d: number, hh = 0, mm = 0): number => Date.UTC(y, m - 1, d, hh, mm);

describe('tz table (F4, design 10.1)', () => {
  it('names the tzdb release', () => {
    expect(TZDB_VERSION).toMatch(/^20\d\d[a-z]$/);
  });

  it('F4: Delhi 1944-06-15 12:00 is war time +06:30', () => {
    expect(offsetAt('Asia/Kolkata', utc(1944, 6, 15, 6, 30))).toBe(390);
    const r = localToUtc('Asia/Kolkata', { y: 1944, m: 6, d: 15, hh: 12, mm: 0 });
    expect(r.offsetMinutes).toBe(390);
    expect(new Date(r.utcMs).toISOString()).toBe('1944-06-15T05:30:00.000Z');
    expect(r.clockGap).toBe(false);
    expect(r.overlap).toBe(false);
  });

  it('F4: war time starts 1942-09-01 (IST +05:30 on 1942-08-31)', () => {
    expect(offsetAt('Asia/Kolkata', utc(1942, 8, 31, 6, 0))).toBe(330);
    expect(offsetAt('Asia/Kolkata', utc(1942, 9, 1, 6, 0))).toBe(390);
    // and ends 1945-10-15
    expect(offsetAt('Asia/Kolkata', utc(1945, 10, 14, 6, 0))).toBe(390);
    expect(offsetAt('Asia/Kolkata', utc(1945, 10, 16, 6, 0))).toBe(330);
  });

  it('F4: Kathmandu 1990-01-01 is +05:45 (and +05:30 before 1986)', () => {
    expect(offsetAt('Asia/Kathmandu', utc(1990, 1, 1))).toBe(345);
    expect(offsetAt('Asia/Kathmandu', utc(1985, 1, 1))).toBe(330);
  });

  it('F4: Dubai 2005 is +04:00', () => {
    expect(offsetAt('Asia/Dubai', utc(2005, 6, 1))).toBe(240);
    expect(offsetAt('Asia/Dubai', utc(2005, 1, 1))).toBe(240);
  });

  it('F4: London 1988-07-01 is BST +01:00 and 1988-01-15 is GMT +00:00', () => {
    expect(offsetAt('Europe/London', utc(1988, 7, 1))).toBe(60);
    expect(offsetAt('Europe/London', utc(1988, 1, 15))).toBe(0);
    const bst = localToUtc('Europe/London', { y: 1988, m: 7, d: 1, hh: 9, mm: 0 });
    expect(new Date(bst.utcMs).toISOString()).toBe('1988-07-01T08:00:00.000Z');
  });

  it('spring-forward gap (US): 2024-03-10 02:30 New York does not exist, shifts to 03:30 EDT', () => {
    const r = localToUtc('America/New_York', { y: 2024, m: 3, d: 10, hh: 2, mm: 30 });
    expect(r.clockGap).toBe(true);
    expect(r.overlap).toBe(false);
    expect(r.offsetMinutes).toBe(-240);
    expect(new Date(r.utcMs).toISOString()).toBe('2024-03-10T07:30:00.000Z');
    const wall = utcToWall(r.utcMs, 'America/New_York');
    expect([wall.hh, wall.mm]).toEqual([3, 30]);
  });

  it('autumn overlap (UK): 2024-10-27 01:30 London happens twice, the earlier (BST) instant is used', () => {
    const r = localToUtc('Europe/London', { y: 2024, m: 10, d: 27, hh: 1, mm: 30 });
    expect(r.overlap).toBe(true);
    expect(r.clockGap).toBe(false);
    expect(r.offsetMinutes).toBe(60);
    expect(new Date(r.utcMs).toISOString()).toBe('2024-10-27T00:30:00.000Z');
  });

  it('ordinary wall times convert without flags', () => {
    const r = localToUtc('Asia/Kolkata', { y: 1998, m: 3, d: 14, hh: 6, mm: 42 });
    expect(new Date(r.utcMs).toISOString()).toBe('1998-03-14T01:12:00.000Z');
    expect(r.clockGap || r.overlap).toBe(false);
    expect(offsetAt('Asia/Kolkata', utc(2026, 10, 22))).toBe(330);
  });

  it('LMT-era offsets keep seconds (Madras Mean Time +05:21:10 before 1906)', () => {
    const off = offsetAt('Asia/Kolkata', utc(1903, 6, 15));
    expect(formatOffset(off)).toBe('+05:21:10');
  });

  it('canonicalZone maps links and case to canonical ids (N8)', () => {
    expect(canonicalZone('Asia/Calcutta')).toBe('Asia/Kolkata');
    expect(canonicalZone('Asia/Katmandu')).toBe('Asia/Kathmandu');
    expect(canonicalZone('Europe/Kiev')).toBe('Europe/Kyiv');
    expect(canonicalZone('Europe/Kyiv')).toBe('Europe/Kyiv');
    expect(canonicalZone('Asia/Kuala_Lumpur')).toBe('Asia/Singapore');
    expect(canonicalZone('US/Eastern')).toBe('America/New_York');
    expect(canonicalZone('asia/kolkata')).toBe('Asia/Kolkata');
    expect(canonicalZone('Mars/Olympus')).toBeUndefined();
    expect(hasZone('Etc/GMT+5')).toBe(true);
    expect(hasZone('UTC')).toBe(true);
    expect(() => offsetAt('Mars/Olympus', 0)).toThrow(/Unknown time zone/);
  });

  it('zoneIndex/zoneAt round-trip over the sorted canonical list (share-code)', () => {
    const list = zoneList();
    expect(list.length).toBeGreaterThan(300);
    expect([...list].sort()).toEqual([...list]);
    for (const [i, z] of list.entries()) {
      expect(zoneIndex(z)).toBe(i);
      expect(zoneAt(i)).toBe(z);
    }
    expect(zoneIndex('Asia/Calcutta')).toBe(zoneIndex('Asia/Kolkata'));
    expect(zoneIndex('Nowhere/Zone')).toBe(-1);
  });

  it('formatInZone uses Latin digits and the locale tables', () => {
    const t = Date.UTC(2026, 9, 22, 0, 57); // 06:27 IST
    expect(formatInZone(t, 'Asia/Kolkata', 'EEE d MMM yyyy · HH:mm', 'en')).toBe('Thu 22 Oct 2026 · 06:27');
    expect(formatInZone(t, 'Asia/Kolkata', 'EEE d MMM yyyy · HH:mm', 'hi')).toBe('गुरु 22 अक्टू 2026 · 06:27');
    expect(formatInZone(t, 'Asia/Kolkata', 'EEEE d MMMM yyyy', 'bho')).toBe('बियफे 22 अक्टूबर 2026');
    expect(formatInZone(t, 'Asia/Kolkata', "yyyy-MM-dd'T'HH:mm:ss", 'en')).toBe('2026-10-22T06:27:00');
    expect(formatInZone(t, 'Europe/London', 'HH:mm', 'en')).toBe('01:57');
  });
});

describe('tz table self-test against Node ICU (plan P10)', () => {
  // Node 24.16 ships ICU tzdata 2026b; the table is tzdb 2026e. Per the tzdb NEWS file
  // (https://data.iana.org/time-zones/tzdb/NEWS) releases 2026c-e changed future timestamps (Alberta permanent
  // -06 from 2026-06-18, Morocco permanent +00 from 2026-09-20, NWT and Manitoba later in 2026), so the window
  // ends before the first of those, and corrected four past details that ICU 2026b still carries the old way:
  const KNOWN_DIVERGENCES: { zone: RegExp; from: number; to: number; release: string }[] = [
    { zone: /^Europe\/Dublin$/, from: Date.UTC(1925, 8, 20), to: Date.UTC(1925, 9, 4, 3), release: '2026e: in 1925 Ireland fell back on 09-20 not 10-04' },
    { zone: /^America\/Bogota$/, from: Date.UTC(1992, 4, 2), to: Date.UTC(1992, 4, 3, 6), release: "2026d: Colombia's 1992-05-02 spring forward was at 00:00, not 24:00" },
    { zone: /^Asia\/Tehran$/, from: Date.UTC(1979, 4, 25, 18), to: Date.UTC(1979, 4, 27), release: "2026d: Iran's 1979-05-26 spring forward was at 00:00, not 24:00" },
    { zone: /^(CST6CDT|EST5EDT|MST7MDT|PST8PDT)$/, from: Date.UTC(1900, 0, 1), to: Date.UTC(1966, 9, 30, 12), release: '2026d: POSIX-style names revert to US federal rules before 1966-10-30' },
  ];
  const START = Date.UTC(1900, 0, 1);
  const END = Date.UTC(2026, 5, 1);
  const INSTANTS_PER_ZONE = 2000;
  const isKnown = (zone: string, ms: number): boolean => KNOWN_DIVERGENCES.some((k) => k.zone.test(zone) && ms >= k.from && ms < k.to);

  function icuOffset(fmt: Intl.DateTimeFormat, ms: number): number {
    const v = fmt.formatToParts(new Date(ms)).find((p) => p.type === 'timeZoneName')!.value;
    const m = /^GMT(?:([+-])(\d{2})(?::(\d{2}))?(?::(\d{2}))?)?$/.exec(v);
    if (!m) throw new Error(`unexpected longOffset ${v}`);
    if (!m[1]) return 0;
    return (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] ?? 0) + Number(m[4] ?? 0) / 60);
  }

  it('offsetAt matches Intl longOffset for 2000 seeded-random instants in every zone (1900 .. 2026-06)', () => {
    let seed = 20261024;
    const rnd = (): number => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    const mismatches: string[] = [];
    let compared = 0;
    for (const zone of zoneList()) {
      const fmt = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'longOffset' });
      for (let i = 0; i < INSTANTS_PER_ZONE; i++) {
        const ms = Math.floor(START + rnd() * (END - START));
        compared++;
        const a = offsetAt(zone, ms);
        const b = icuOffset(fmt, ms);
        if (Math.abs(a - b) > 0.02 && !isKnown(zone, ms) && mismatches.length < 20) mismatches.push(`${zone} ${new Date(ms).toISOString()} table ${a} icu ${b}`);
      }
    }
    expect(compared).toBe(zoneList().length * INSTANTS_PER_ZONE);
    expect(mismatches).toEqual([]);
  });

  it('the documented past divergences really are where the table carries the newer tzdb value', () => {
    expect(offsetAt('Europe/Dublin', Date.UTC(1925, 8, 26, 12))).toBe(0); // 2026e
    expect(offsetAt('America/Bogota', Date.UTC(1992, 4, 2, 12))).toBe(-240); // 2026d
    expect(offsetAt('Asia/Tehran', Date.UTC(1979, 4, 26, 12))).toBe(270); // 2026d
    // US federal rules only: no DST in summer 1950 (New York observed it), war time in 1943, DST from 1967.
    expect(offsetAt('EST5EDT', Date.UTC(1950, 6, 1))).toBe(-300);
    expect(offsetAt('America/New_York', Date.UTC(1950, 6, 1))).toBe(-240);
    expect(offsetAt('EST5EDT', Date.UTC(1943, 6, 1))).toBe(-240);
    expect(offsetAt('EST5EDT', Date.UTC(1970, 6, 1))).toBe(-240);
  });

  it('every zone id known to the table is accepted by Intl (no typos / non-canonical ids)', () => {
    for (const zone of zoneList()) {
      expect(() => new Intl.DateTimeFormat('en-US', { timeZone: zone })).not.toThrow();
    }
  });

  it('carries the tzdb 2026c-e rules that Node ICU 2026b lacks (documented divergence)', () => {
    // Alberta permanent -06 (2026c), Manitoba permanent -05 (2026d), Morocco permanent +00 (2026c).
    expect(offsetAt('America/Edmonton', Date.UTC(2027, 0, 15))).toBe(-360);
    expect(offsetAt('America/Winnipeg', Date.UTC(2027, 0, 15))).toBe(-300);
    expect(offsetAt('Africa/Casablanca', Date.UTC(2027, 0, 15))).toBe(0);
  });
});
