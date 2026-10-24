import { describe, expect, it } from 'vitest';
import { VRAT_FAMILIES, allVratOccurrences, ekadashiKey, spanTithiIndex, vratOccurrences } from '../src/calendar/vrats';
import { localMidnight } from '../src/panchang/astro';
import { formatInZone } from '../src/tz/index';

const ZONE = 'Asia/Kolkata';
const DELHI = { lat: 28.6139, lon: 77.209 };
const Y0 = localMidnight('2026-01-01', ZONE);
const Y1 = localMidnight('2026-12-31', ZONE);
const dt = (ms: number) => formatInZone(ms, ZONE, 'yyyy-MM-dd HH:mm');

describe('vratOccurrences (F22): twelve families with the time that matters', () => {
  it('has exactly twelve families and every family yields occurrences in 2026 with a key time and both month names', () => {
    expect(VRAT_FAMILIES).toHaveLength(12);
    for (const family of VRAT_FAMILIES) {
      const occ = vratOccurrences(family, Y0, Y1, DELHI, ZONE);
      expect(occ.length, family).toBeGreaterThan(0);
      for (const o of occ) {
        expect(o.family).toBe(family);
        expect(o.ruleId).toBe(`vrat-${family}`);
        expect(o.date >= '2026-01-01' && o.date <= '2026-12-31').toBe(true);
        expect(o.keyTime.start).toBeGreaterThan(0);
        if (o.keyTime.end !== undefined) expect(o.keyTime.end).toBeGreaterThan(o.keyTime.start);
        expect(o.month.amanta.index).toBeGreaterThanOrEqual(0);
        expect(o.month.purnimanta.index).toBeGreaterThanOrEqual(0);
        expect(o.tithi).toBeGreaterThanOrEqual(1);
        expect(o.tithi).toBeLessThanOrEqual(15);
      }
    }
  });

  it('Ekadashi: 24 fasts in 2026 including the Adhik-month Padmini/Parama, parana after the next sunrise and before Dwadashi ends', () => {
    const ek = vratOccurrences('ekadashi', Y0, Y1, DELHI, ZONE);
    // 13 lunations touch 2026 (Adhik Jyeshtha), but the first and last each put one Ekadashi outside the year.
    expect(ek).toHaveLength(24);
    expect(ek.map((o) => o.name)).toContain('ekadashi-nirjala');
    expect(ek.map((o) => o.name)).toContain('ekadashi-padmini');
    expect(ek.map((o) => o.name)).toContain('ekadashi-parama');
    expect(ek.find((o) => o.name === 'ekadashi-nirjala')!.date).toBe('2026-06-25');
    expect(ek.find((o) => o.name === 'ekadashi-devshayani')!.date).toBe('2026-07-25');
    expect(ek.find((o) => o.name === 'ekadashi-devutthana')!.date).toBe('2026-11-20');
    for (const o of ek) {
      expect(o.keyTime.kind).toBe('parana');
      const paranaDate = String(o.extra!.paranaDate);
      expect(paranaDate > o.date).toBe(true);
      const sunrise = localMidnight(paranaDate, ZONE); // parana starts after the parana day's midnight
      expect(o.keyTime.start).toBeGreaterThan(sunrise);
      expect(o.keyTime.end!).toBeLessThanOrEqual(Number(o.extra!.dwadashiEnd) + 1);
      expect(o.keyTime.start).toBeGreaterThanOrEqual(Number(o.extra!.hariVasaraEnd) - 1);
      expect(String(o.extra!.vaishnavaDate) >= o.date).toBe(true);
    }
    // The name table is keyed by the Amanta lunation: Rama Ekadashi = Amanta Ashwin Krishna (= Purnimanta Kartik Krishna).
    expect(ekadashiKey(2, 'shukla', false)).toBe('nirjala');
    expect(ekadashiKey(2, 'shukla', true)).toBe('padmini');
    expect(ekadashiKey(6, 'krishna', false)).toBe('rama');
    expect(ekadashiKey(7, 'krishna', false)).toBe('utpanna');
  });

  it('Pradosh: Trayodashi at pradosh kala with a sunset window and the weekday name', () => {
    const pr = vratOccurrences('pradosh', Y0, Y1, DELHI, ZONE);
    expect(pr.length).toBeGreaterThanOrEqual(24);
    const timed = pr.filter((o) => o.keyTime.kind === 'pradosh');
    expect(timed.length).toBeGreaterThan(20);
    for (const o of timed) {
      expect(o.tithi).toBe(13);
      expect(o.name).toMatch(/^pradosh-(ravi|soma|bhauma|saumya|guru|bhrigu|shani)$/);
      const length = o.keyTime.end! - o.keyTime.start;
      expect(length).toBeGreaterThan(2 * 3_600_000);
      expect(length).toBeLessThan(3 * 3_600_000);
    }
  });

  it('Sankashti: Krishna Chaturthi at moonrise, Angaraki on Tuesdays; Vinayaka at madhyahna', () => {
    const sk = vratOccurrences('sankashti', Y0, Y1, DELHI, ZONE);
    expect(sk.length).toBeGreaterThanOrEqual(12);
    for (const o of sk) {
      expect(o.paksha).toBe('krishna');
      expect(o.tithi).toBe(4);
      expect(o.keyTime.kind).toBe('moonrise');
      const hour = Number(formatInZone(o.keyTime.start, ZONE, 'HH'));
      expect(hour).toBeGreaterThanOrEqual(18); // evening moonrise
    }
    expect(sk.filter((o) => o.name === 'sankashti-angaraki').length).toBeGreaterThan(0);
    expect(sk.find((o) => o.date === '2026-01-06')!.name).toBe('sankashti-angaraki'); // Tuesday
    const vi = vratOccurrences('vinayakaChaturthi', Y0, Y1, DELHI, ZONE);
    expect(vi.length).toBeGreaterThanOrEqual(12);
    for (const o of vi) expect(o.paksha).toBe('shukla');
  });

  it('Masik Shivaratri at nishita (window around midnight); Maha Shivaratri 2026 = 15 February', () => {
    const ms = vratOccurrences('masikShivaratri', Y0, Y1, DELHI, ZONE);
    expect(ms.length).toBeGreaterThanOrEqual(12);
    expect(ms.map((o) => o.date)).toContain('2026-02-15');
    for (const o of ms.filter((x) => x.keyTime.kind === 'nishita')) {
      expect(o.keyTime.end! - o.keyTime.start).toBe(48 * 60_000);
      const hh = Number(formatInZone(o.keyTime.start, ZONE, 'HH'));
      expect(hh === 23 || hh === 0).toBe(true);
    }
  });

  it('Purnima/Amavasya (udaya) and Satyanarayan (Purnima evening): 12-13 each in 2026', () => {
    for (const fam of ['purnima', 'amavasya', 'satyanarayan'] as const) {
      const occ = vratOccurrences(fam, Y0, Y1, DELHI, ZONE);
      expect(occ.length, fam).toBeGreaterThanOrEqual(12);
      expect(occ.length, fam).toBeLessThanOrEqual(13);
    }
    expect(vratOccurrences('amavasya', Y0, Y1, DELHI, ZONE).map((o) => o.date)).toContain('2026-11-09');
    expect(vratOccurrences('satyanarayan', Y0, Y1, DELHI, ZONE).every((o) => o.keyTime.kind === 'sandhya')).toBe(true);
  });

  it('Karwa Chauth (moonrise), Chhath (sunset -> next sunrise) and the three Teej once a year', () => {
    const kc = vratOccurrences('karwaChauth', Y0, Y1, DELHI, ZONE);
    expect(kc).toHaveLength(1);
    expect(kc[0]).toMatchObject({ date: '2026-10-29', paksha: 'krishna', tithi: 4 });
    expect(kc[0].keyTime.kind).toBe('moonrise');
    expect(kc[0].month.purnimanta).toEqual({ index: 7, adhik: false }); // Kartik (Purnimanta)
    expect(kc[0].month.amanta).toEqual({ index: 6, adhik: false }); // Ashwin (Amanta)
    const ch = vratOccurrences('chhath', Y0, Y1, DELHI, ZONE);
    expect(ch).toHaveLength(1);
    expect(ch[0]).toMatchObject({ date: '2026-11-15', paksha: 'shukla', tithi: 6 });
    expect(ch[0].keyTime.kind).toBe('sunset-to-sunrise');
    expect(ch[0].extra).toMatchObject({ nahayKhay: '2026-11-13', kharna: '2026-11-14', ushaArghya: '2026-11-16' });
    const teej = vratOccurrences('teej', Y0, Y1, DELHI, ZONE);
    expect(teej.map((o) => `${o.date} ${o.name}`)).toEqual(['2026-08-15 teej-hariyali', '2026-08-31 teej-kajari', '2026-09-14 teej-hartalika']);
  });

  it('Navratri: Chaitra and Sharad, one row per day with day numbers 1..9 and a Ghatasthapana window on day 1', () => {
    const nv = vratOccurrences('navratri', Y0, Y1, DELHI, ZONE);
    const chaitra = nv.filter((o) => o.extra!.which === 'chaitra');
    const sharad = nv.filter((o) => o.extra!.which === 'sharad');
    expect(chaitra.map((o) => o.extra!.day)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(chaitra[0].date).toBe('2026-03-19');
    expect(chaitra[0].tithi).toBe(1); // begin-day Pratipada, not the Amavasya still running at sunrise
    expect(chaitra[0].keyTime.kind).toMatch(/^ghatasthapana/);
    expect(chaitra[0].keyTime.end!).toBeGreaterThan(chaitra[0].keyTime.start);
    expect(sharad[0].date).toBe('2026-10-11');
    expect(sharad.length).toBeGreaterThanOrEqual(9);
    expect(sharad.length).toBeLessThanOrEqual(10);
    expect(spanTithiIndex(29, 0, 8)).toBe(0);
    expect(spanTithiIndex(9, 0, 8)).toBe(8);
    expect(spanTithiIndex(4, 0, 8)).toBe(4);
  });

  it('allVratOccurrences merges families in date order', () => {
    const all = allVratOccurrences(localMidnight('2026-10-01', ZONE), localMidnight('2026-10-31', ZONE), DELHI, ZONE);
    expect(all.length).toBeGreaterThan(10);
    for (let i = 1; i < all.length; i++) expect(all[i].date >= all[i - 1].date).toBe(true);
    expect(new Set(all.map((o) => o.family)).size).toBeGreaterThanOrEqual(8);
  });
});
