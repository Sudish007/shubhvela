// Carry-over A-REVIEW-MEDIUM-1 (F23): the eclipse rule for Holika Dahan. 2026: the total lunar eclipse of 03-03 falls
// in the Phalguna Purnima and is visible from India at moonrise, so the dahan moves to the 03-03 pradosh after the
// moksha and Holi to 03-04 (Drik Panchang); 2027 and 2028 have no eclipse on that Purnima and keep their dates.
import { describe, expect, it } from 'vitest';
import { festivals, lunarEclipseIn } from '../src/calendar/festivals';
import { formatInZone } from '../src/tz/index';

const DELHI = { lat: 28.6139, lon: 77.209 };
const CHENNAI = { lat: 13.0827, lon: 80.2707 };
const TZ = 'Asia/Kolkata';
const hm = (ms: number): string => formatInZone(ms, TZ, 'yyyy-MM-dd HH:mm');

describe('Holika Dahan eclipse rule (F23 carry-over)', () => {
  it('2026 Delhi (Purnimanta): Holika Dahan on 03-03 after the eclipse moksha, Holi on 03-04', () => {
    const f = festivals(2026, 'purnimanta', 'north', DELHI, TZ);
    const dahan = f.find((x) => x.slug === 'holika-dahan')!;
    const holi = f.find((x) => x.slug === 'holi')!;
    expect(dahan.date).toBe('2026-03-03');
    expect(dahan.convention).toBe('pradosh-after-eclipse-moksha');
    expect(dahan.eclipse).toBeDefined();
    expect(dahan.eclipse!.kind).toBe('total');
    expect(dahan.eclipse!.visible).toBe(true);
    // Umbral phases 15:20 -> 18:47 IST (penumbral phases are not sutak).
    expect(hm(dahan.eclipse!.start)).toBe('2026-03-03 15:19');
    expect(hm(dahan.eclipse!.end)).toBe('2026-03-03 18:47');
    expect(dahan.window!.start).toBe(dahan.eclipse!.end);
    expect(dahan.window!.end).toBeGreaterThan(dahan.window!.start);
    expect(holi.date).toBe('2026-03-04');
    expect(holi.tithiText).toMatchObject({ paksha: 'krishna', tithi: 1 });
  });

  it('2026 Chennai (Amanta) agrees; 2027 and 2028 are unchanged', () => {
    const c = festivals(2026, 'amanta', 'south', CHENNAI, TZ);
    expect(c.find((x) => x.slug === 'holika-dahan')!.date).toBe('2026-03-03');
    expect(c.find((x) => x.slug === 'holi')!.date).toBe('2026-03-04');
    const d27 = festivals(2027, 'purnimanta', 'north', DELHI, TZ);
    expect(d27.find((x) => x.slug === 'holika-dahan')!.date).toBe('2027-03-21');
    expect(d27.find((x) => x.slug === 'holika-dahan')!.eclipse).toBeUndefined();
    expect(d27.find((x) => x.slug === 'holi')!.date).toBe('2027-03-22');
    const d28 = festivals(2028, 'purnimanta', 'north', DELHI, TZ);
    expect(d28.find((x) => x.slug === 'holika-dahan')!.date).toBe('2028-03-10');
    expect(d28.find((x) => x.slug === 'holi')!.date).toBe('2028-03-11');
  });

  it('lunarEclipseIn finds the umbral eclipse inside a span and reports visibility by place', () => {
    const span = { start: Date.UTC(2026, 2, 2, 12), end: Date.UTC(2026, 2, 3, 12) }; // the 2026 Phalguna Purnima
    const delhi = lunarEclipseIn(span, DELHI)!;
    expect(delhi.kind).toBe('total');
    expect(delhi.visible).toBe(true);
    // Paris: the umbral phases run 10:50 -> 14:17 local time with the Moon below the horizon -> not visible.
    const paris = lunarEclipseIn(span, { lat: 48.85, lon: 2.35 })!;
    expect(paris.kind).toBe('total');
    expect(paris.visible).toBe(false);
    // A span with no eclipse (the 2027 Phalguna Purnima).
    expect(lunarEclipseIn({ start: Date.UTC(2027, 2, 21), end: Date.UTC(2027, 2, 22, 12) }, DELHI)).toBeNull();
  });
});
