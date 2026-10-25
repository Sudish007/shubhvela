import { describe, expect, it } from 'vitest';
import { computeChart } from '../src/kundli/index';
import { FESTIVAL_RULES, festivalRule, festivals } from '../src/calendar/festivals';
import { barsiDates, janmaTithiFromBirth, pitruPaksha, tithiEventDates } from '../src/calendar/tithiEvents';
import { observanceDay, tithiIndexOf, tithiSpanIn } from '../src/calendar/observance';
import { upcoming } from '../src/calendar/upcoming';
import { lunationAt, lunationsBetween, localMidnight, DAY_MS } from '../src/panchang/astro';
import { formatInZone } from '../src/tz/index';

const ZONE = 'Asia/Kolkata';
const DELHI = { lat: 28.6139, lon: 77.209 };
const CHENNAI = { lat: 13.0827, lon: 80.2707 };
const d = (ms: number) => formatInZone(ms, ZONE, 'yyyy-MM-dd');

describe('lunations and Adhik months', () => {
  it('2026 has Adhik Jyeshtha (17 May - 15 June) followed by nija Jyeshtha; no kshaya month', () => {
    const ls = lunationsBetween(localMidnight('2026-01-01', ZONE), localMidnight('2026-12-31', ZONE));
    const adhik = ls.filter((l) => l.adhik);
    expect(adhik).toHaveLength(1);
    expect(adhik[0].monthIndex).toBe(2);
    expect(d(adhik[0].start)).toBe('2026-05-17');
    expect(d(adhik[0].end)).toBe('2026-06-15');
    const after = ls[ls.indexOf(adhik[0]) + 1];
    expect(after.monthIndex).toBe(2);
    expect(after.adhik).toBe(false);
    expect(ls.some((l) => l.kshaya)).toBe(false);
    // Month indexes advance by one per lunation except across the Adhik month.
    for (let i = 1; i < ls.length; i++) {
      const expected = ls[i - 1].adhik ? ls[i - 1].monthIndex : (ls[i - 1].monthIndex + 1) % 12;
      expect(ls[i].monthIndex).toBe(expected);
    }
    // 2027 and 2028 have no Adhik month.
    for (const y of [2027, 2028]) expect(lunationsBetween(localMidnight(`${y}-01-01`, ZONE), localMidnight(`${y}-12-31`, ZONE)).some((l) => l.adhik)).toBe(false);
  });

  it('lunationAt picks the lunation containing the instant, consistent across its range', () => {
    const l = lunationAt(localMidnight('2026-10-22', ZONE));
    expect(d(l.start)).toBe('2026-10-10');
    expect(d(l.end)).toBe('2026-11-09');
    expect(l.monthIndex).toBe(6); // Ashwin (Amanta)
    expect(lunationAt(l.start).start).toBe(l.start);
    expect(lunationAt(l.end - 2000).start).toBe(l.start);
    // The same new moon found from a different starting point agrees to the second.
    expect(Math.abs(lunationAt(l.end + 2000).start - l.end)).toBeLessThanOrEqual(1000);
  });
});

describe('tithiEventDates (F20/F21 recurrence conventions)', () => {
  it('a Jyeshtha janma tithi skips Adhik Jyeshtha 2026 and falls in the nija month', () => {
    const dates = tithiEventDates({ month: 2, paksha: 'shukla', tithi: 10 }, 2026, 2027, 'amanta', DELHI, ZONE);
    expect(dates.map((x) => x.date)).toEqual(['2026-06-24', '2027-06-13']);
    expect(dates[0].month.amanta).toEqual({ index: 2, adhik: false });
    expect(dates[0].convention).toBe('udaya');
    // The Adhik lunation (17 May - 15 June) never hosts the event.
    expect(dates.some((x) => x.date >= '2026-05-17' && x.date <= '2026-06-15')).toBe(false);
  });

  it('kshaya tithi: Chaitra Shukla Pratipada 2026 touches no sunrise and falls on its begin day (19 March)', () => {
    const dates = tithiEventDates({ month: 0, paksha: 'shukla', tithi: 1 }, 2026, 2026, 'purnimanta', DELHI, ZONE);
    expect(dates).toHaveLength(1);
    expect(dates[0].date).toBe('2026-03-19');
    expect(dates[0].convention).toBe('udaya-begin-day');
    expect(d(dates[0].span.start)).toBe('2026-03-19');
    expect(d(dates[0].span.end)).toBe('2026-03-20');
  });

  it('vriddhi tithi: Jyeshtha Purnima 2026 is at two sunrises and takes the first (29 June)', () => {
    const dates = tithiEventDates({ month: 2, paksha: 'shukla', tithi: 15 }, 2026, 2026, 'purnimanta', DELHI, ZONE);
    expect(dates.map((x) => `${x.date} ${x.convention}`)).toEqual(['2026-06-29 udaya-first-of-two']);
  });

  it('Purnimanta Krishna-paksha rules map to the previous Amanta month (Kartik Krishna Amavasya = Amanta Ashwin Amavasya)', () => {
    const p = tithiEventDates({ month: 7, paksha: 'krishna', tithi: 15 }, 2026, 2028, 'purnimanta', DELHI, ZONE);
    const a = tithiEventDates({ month: 6, paksha: 'krishna', tithi: 15 }, 2026, 2028, 'amanta', DELHI, ZONE);
    expect(p.map((x) => x.date)).toEqual(a.map((x) => x.date));
    expect(p.map((x) => x.date)).toEqual(['2026-11-09', '2027-10-29', '2028-10-18']);
    expect(p[0].month.purnimanta).toEqual({ index: 7, adhik: false });
    expect(p[0].month.amanta).toEqual({ index: 6, adhik: false });
  });

  it('janmaTithiFromBirth: the sample birth (1998-03-14 06:42) is Phalguna Krishna Pratipada (Amanta) = Chaitra Krishna Pratipada (Purnimanta)', () => {
    const chart = computeChart({ date: '1998-03-14', time: '06:42', tz: ZONE, lat: 26.85, lon: 80.95 });
    const j = janmaTithiFromBirth(chart);
    expect(j.amanta).toEqual({ month: 11, paksha: 'krishna', tithi: 1, adhik: false });
    expect(j.purnimanta).toEqual({ month: 0, paksha: 'krishna', tithi: 1, adhik: false });
    expect(j.tithiIndex).toBe(15);
    expect(j.birthTithi.start).toBeLessThanOrEqual(chart.meta.utcMs);
    expect(j.birthTithi.end).toBeGreaterThan(chart.meta.utcMs);
    const next = tithiEventDates(j.amanta, 2027, 2027, 'amanta', DELHI, ZONE);
    expect(next).toHaveLength(1);
    expect(next[0].date).toBe('2027-03-23');
  });

  it('observanceDay conventions on the Diwali Amavasya 2026: udaya 9 Nov, pradosh (later day) 8 Nov', () => {
    const l = lunationAt(localMidnight('2026-10-22', ZONE));
    const span = tithiSpanIn(l, tithiIndexOf('krishna', 15));
    expect(observanceDay(span, 'udaya', ZONE, DELHI).date).toBe('2026-11-09');
    expect(observanceDay(span, 'pradosh', ZONE, DELHI, 'last').date).toBe('2026-11-08');
    expect(observanceDay(span, 'begin', ZONE, DELHI)).toMatchObject({ date: '2026-11-08', convention: 'begin-day' });
  });
});

describe('pitruPaksha and barsi (F21)', () => {
  it('Pitru Paksha 2026 runs 26 Sep (Purnima Shraddha) to 10 Oct (Sarvapitri Amavasya) with 15 shraddha days', () => {
    const pp = pitruPaksha(2026, DELHI, ZONE);
    expect(pp.start).toBe('2026-09-26');
    expect(pp.end).toBe('2026-10-10');
    expect(pp.days.length).toBeGreaterThanOrEqual(15);
    expect(pp.days.length).toBeLessThanOrEqual(16);
    expect(pp.days[0].key).toBe('purnima-shraddha');
    expect(pp.days[pp.days.length - 1].key).toBe('sarvapitri-amavasya');
    for (let i = 1; i < pp.days.length; i++) expect(pp.days[i].tithiIndex).toBeGreaterThan(pp.days[i - 1].tithiIndex);
    for (const day of pp.days) expect(day.aparahna.end).toBeGreaterThan(day.aparahna.start);
    for (const y of [2027, 2028]) {
      const r = pitruPaksha(y, DELHI, ZONE);
      expect(r.days.length).toBeGreaterThanOrEqual(15);
      expect(r.days.length).toBeLessThanOrEqual(16);
      expect(r.start.startsWith(String(y))).toBe(true);
    }
  });

  it('barsi: Ashwin Krishna Dashami (P12 ancestor Dadaji) on the aparahna day, with the matching Pitru Paksha day', () => {
    const b = barsiDates({ deathMonth: 6, paksha: 'krishna', tithi: 10, year: 2019 }, 2026, 2027, 'purnimanta', DELHI, ZONE);
    expect(b.map((x) => x.date)).toEqual(['2026-10-05', '2027-09-25']);
    expect(b[0].convention).toBe('aparahna');
    expect(b[0].nth).toBe(7);
    expect(b[0].pitruPakshaDay).toMatchObject({ date: '2026-10-05', key: 'dashami-shraddha', tithi: 10, paksha: 'krishna' });
  });
});

describe('festivals (F23): >= 60 rules, both traditions and regions, 2026-2028', () => {
  it('the rules table has at least 60 festivals with three names each and unique slugs', () => {
    expect(FESTIVAL_RULES.length).toBeGreaterThanOrEqual(60);
    const slugs = new Set(FESTIVAL_RULES.map((r) => r.slug));
    expect(slugs.size).toBe(FESTIVAL_RULES.length);
    for (const r of FESTIVAL_RULES) {
      expect(r.names.en.length).toBeGreaterThan(0);
      expect(r.names.hi.length).toBeGreaterThan(0);
      expect(r.names.bho.length).toBeGreaterThan(0);
      expect(r.verifiedAgainst).toBeNull();
    }
    for (const slug of ['diwali', 'holi', 'maha-shivaratri', 'krishna-janmashtami', 'ganesh-chaturthi', 'raksha-bandhan', 'onam', 'pongal', 'makar-sankranti', 'chhath-puja', 'karwa-chauth', 'dussehra', 'sharad-navratri', 'chaitra-navratri', 'pitru-paksha'])
      expect(festivalRule(slug), slug).toBeDefined();
  });

  it('returns >= 60 entries for every year 2026-2028 in (purnimanta, north) at Delhi and (amanta, south) at Chennai', () => {
    for (const year of [2026, 2027, 2028]) {
      const north = festivals(year, 'purnimanta', 'north', DELHI, ZONE);
      const south = festivals(year, 'amanta', 'south', CHENNAI, ZONE);
      expect(north.length, `north ${year}`).toBeGreaterThanOrEqual(60);
      expect(south.length, `south ${year}`).toBeGreaterThanOrEqual(60);
      for (const o of [...north, ...south]) {
        expect(o.date.startsWith(`${year}-`)).toBe(true);
        expect(o.ruleId).toBe(`festival-${o.slug}`);
      }
      for (let i = 1; i < north.length; i++) expect(north[i].date >= north[i - 1].date).toBe(true);
    }
  });

  it('Diwali 2026 is 8 November (Kartik Amavasya at pradosh in Purnimanta naming; Ashwin Amavasya in Amanta)', () => {
    const north = festivals(2026, 'purnimanta', 'north', DELHI, ZONE);
    const diwali = north.find((o) => o.slug === 'diwali')!;
    expect(diwali.date).toBe('2026-11-08');
    expect(diwali.tithiText).toMatchObject({ month: 7, paksha: 'krishna', tithi: 15, system: 'purnimanta' });
    expect(diwali.window).toBeDefined();
    const south = festivals(2026, 'amanta', 'south', CHENNAI, ZONE).find((o) => o.slug === 'diwali')!;
    expect(south.date).toBe('2026-11-08');
    expect(south.tithiText).toMatchObject({ month: 6, paksha: 'krishna', tithi: 15, system: 'amanta' });
    const by = (slug: string) => north.find((o) => o.slug === slug)!.date;
    expect(by('dhanteras')).toBe('2026-11-06');
    expect(by('makar-sankranti')).toBe('2026-01-14');
    expect(by('maha-shivaratri')).toBe('2026-02-15');
    expect(by('holi')).toBe('2026-03-03');
    expect(by('ram-navami')).toBe('2026-03-26');
    expect(by('ganesh-chaturthi')).toBe('2026-09-14');
    expect(by('dussehra')).toBe('2026-10-20');
    expect(by('chhath-puja')).toBe('2026-11-15');
    expect(by('karwa-chauth')).toBe('2026-10-29');
    expect(north.find((o) => o.slug === 'sharad-navratri' && o.day === 1)!.date).toBe('2026-10-11');
    expect(north.find((o) => o.slug === 'chaitra-navratri' && o.day === 1)!.tithiText).toMatchObject({ paksha: 'shukla', tithi: 1 });
  });

  it('Bhadra-free rules: Raksha Bandhan 2026 moves to the morning of 28 Aug; Holika Dahan 2026 is after Bhadra on 2 Mar', () => {
    const north = festivals(2026, 'purnimanta', 'north', DELHI, ZONE);
    const rakhi = north.find((o) => o.slug === 'raksha-bandhan')!;
    expect(rakhi.date).toBe('2026-08-28');
    expect(rakhi.convention).toBe('aparahna-bhadra-next-morning');
    expect(rakhi.bhadra!.length).toBeGreaterThan(0);
    expect(rakhi.window!.end).toBe(rakhi.span!.end);
    const holika = north.find((o) => o.slug === 'holika-dahan')!;
    expect(holika.date).toBe('2026-03-02');
    expect(holika.convention).toBe('pradosh-after-bhadra');
    expect(holika.window!.start).toBeGreaterThanOrEqual(holika.bhadra![0].end);
    const holi = north.find((o) => o.slug === 'holi')!;
    expect(holi.date).toBe('2026-03-03');
  });

  it('tradition-dependent dates: Shravan Somvar spans differ between Purnimanta and Amanta; others only relabel the month', () => {
    const p = festivals(2026, 'purnimanta', 'north', DELHI, ZONE).filter((o) => o.slug === 'shravan-somvar').map((o) => o.date);
    const a = festivals(2026, 'amanta', 'north', DELHI, ZONE).filter((o) => o.slug === 'shravan-somvar').map((o) => o.date);
    expect(p[0] < a[0]).toBe(true); // Purnimanta Shravan starts a fortnight earlier
    expect(p.length).toBeGreaterThanOrEqual(4);
    expect(a.length).toBeGreaterThanOrEqual(4);
    expect(festivalRule('shravan-somvar')!.traditionDependent).toBe(true);
    const jp = festivals(2026, 'purnimanta', 'north', DELHI, ZONE).find((o) => o.slug === 'krishna-janmashtami')!;
    const ja = festivals(2026, 'amanta', 'north', DELHI, ZONE).find((o) => o.slug === 'krishna-janmashtami')!;
    expect(jp.date).toBe(ja.date);
    expect(jp.tithiText!.month).toBe(5); // Bhadrapada Krishna Ashtami
    expect(ja.tithiText!.month).toBe(4); // Shravana Krishna Ashtami
  });

  it('solar and nakshatra rules: Pongal/Vishu with the sunset rule, Onam on the Thiruvonam day of Chingam', () => {
    const south = festivals(2026, 'amanta', 'south', CHENNAI, ZONE);
    const by = (slug: string) => south.find((o) => o.slug === slug)!;
    expect(by('pongal').date).toBe('2026-01-14');
    expect(by('pongal').sankranti).toBeTypeOf('number');
    // Vishu follows the Malayalam month-start rule (A04 vs Drik 2026-2028): the Mesha sankranti of 2026-04-14 09:40
    // IST is after sunrise, so Medam 1 / Vishu is the next day; Puthandu (Tamil, sunset rule) stays on the 14th.
    expect(by('vishu')).toMatchObject({ date: '2026-04-15', convention: 'sankranti-after-sunrise-next-day' });
    expect(by('puthandu').date).toBe('2026-04-14');
    expect(by('onam').date).toBe('2026-08-26');
    expect(by('onam').convention).toMatch(/^nakshatra-(udaya|longer-daylight)/);
    expect(by('karthigai-deepam').date).toBe('2026-11-24');
    expect(south.some((o) => o.slug === 'chhath-puja')).toBe(false); // north-only rule
    expect(festivals(2027, 'purnimanta', 'north', DELHI, ZONE).find((o) => o.slug === 'makar-sankranti')).toMatchObject({ date: '2027-01-15', convention: 'sankranti-after-sunset-next-day' });
  });
});

describe('upcoming (F7): five kinds in fixed order', () => {
  it('returns familyTithi, vrat, savedMuhurat, dashaChange and majorTransit for a profile with a saved muhurat', () => {
    const chart = computeChart({ date: '1998-03-14', time: '06:42', tz: ZONE, lat: 26.85, lon: 80.95 });
    const now = localMidnight('2026-10-22', ZONE) + 11 * 3_600_000;
    const items = upcoming({ name: 'Priya', chart, tradition: 'purnimanta' }, [{ activity: 'griha-pravesh', start: now + 5 * DAY_MS, end: now + 5 * DAY_MS + 3_600_000 }], now, DELHI, ZONE);
    expect(items.map((i) => i.kind)).toEqual(['familyTithi', 'vrat', 'savedMuhurat', 'dashaChange', 'majorTransit']);
    for (const i of items) expect(i.date).toBe(formatInZone(i.at, ZONE, 'yyyy-MM-dd'));
    expect(items[0]).toMatchObject({ date: '2027-03-23', ruleId: 'janma-tithi' });
    expect(items[0].params).toMatchObject({ name: 'Priya', month: 0, paksha: 'krishna', tithi: 1, system: 'purnimanta', nth: 29 });
    expect(items[1].ruleId).toMatch(/^vrat-/);
    expect(items[1].date >= '2026-10-22').toBe(true);
    expect(items[2]).toMatchObject({ ruleId: 'muhurat-griha-pravesh', date: '2026-10-27' });
    expect(items[3]).toMatchObject({ date: '2027-04-25' }); // A04 Lahiri anchor; see dasha.test.ts
    expect(items[3].params).toMatchObject({ level: 'antar', from: 'Ke', to: 'Ve' });
    expect(items[4]).toMatchObject({ date: '2026-10-31', ruleId: 'transit-jupiter' });
    expect(items[4].params).toMatchObject({ planet: 'Jupiter', fromSign: 4, toSign: 5 });
  });

  it('omits empty kinds (no saved muhurat, no vrat families)', () => {
    const chart = computeChart({ date: '1998-03-14', time: '06:42', tz: ZONE, lat: 26.85, lon: 80.95 });
    const now = localMidnight('2026-10-22', ZONE);
    const items = upcoming({ chart, tradition: 'amanta', vratFamilies: [] }, [], now, DELHI, ZONE);
    expect(items.map((i) => i.kind)).toEqual(['familyTithi', 'dashaChange', 'majorTransit']);
    expect(items[0].params.month).toBe(11); // Phalguna in Amanta naming
  });
});
