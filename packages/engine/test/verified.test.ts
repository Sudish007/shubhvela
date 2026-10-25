// data/verified-dates.json (A12, F23 footer): every entry is a well-formed slug|year|tradition|date key whose engine
// date at the reference city still equals the recorded one, and festivalVerification() answers only for that exact date.
import { describe, expect, it } from 'vitest';
import { FESTIVAL_RULES, festivals } from '../src/calendar/festivals';
import { festivalVerification, verifiedFestivalCount } from '../src/calendar/verified';
import verifiedJson from '../data/verified-dates.json';

const verified = verifiedJson as unknown as { generatedAt: string; entries: Record<string, { date: string; fetchedAt: string; city: string; source: string }> };

const DELHI = { lat: 28.61394, lon: 77.20902 };
const ZONE = 'Asia/Kolkata';

describe('verified-dates.json', () => {
  it('has well-formed keys that match their entries and known slugs', () => {
    const entries = Object.entries(verified.entries);
    expect(entries.length).toBeGreaterThan(300);
    const slugs = new Set(FESTIVAL_RULES.map((r) => r.slug));
    for (const [key, e] of entries) {
      const [slug, year, tradition, date] = key.split('|');
      expect(slugs.has(slug), `${key}: unknown slug`).toBe(true);
      expect(['purnimanta', 'amanta']).toContain(tradition);
      expect(date).toBe(e.date);
      expect(date.startsWith(year)).toBe(true);
      expect(e.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(e.source).toBe('drikpanchang');
    }
  });

  it('festivalVerification answers for the engine date at Delhi (Purnimanta) and not for a shifted date', () => {
    const all = festivals(2026, 'purnimanta', 'north', DELHI, ZONE);
    const diwali = all.find((f) => f.slug === 'diwali')!;
    const v = festivalVerification('diwali', 2026, 'purnimanta', diwali.date);
    expect(v).not.toBeNull();
    expect(v!.city).toBe('delhi');
    expect(v!.fetchedAt).toBe(verified.entries[`diwali|2026|purnimanta|${diwali.date}`].fetchedAt);
    expect(festivalVerification('diwali', 2026, 'purnimanta', '2026-01-01')).toBeNull();
    expect(festivalVerification('diwali', 2029, 'purnimanta', diwali.date)).toBeNull();
    expect(verifiedFestivalCount()).toBe(Object.keys(verified.entries).length);
  });
});
