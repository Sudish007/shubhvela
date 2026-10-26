// F26 muhurat scorer: candidate generation from choghadiya segments (Thursday Delhi), Rahu Kaal clipping, same-rule
// merging, the >= 4-rule threshold, the N18 tie-break order, every activity over today + 7 days, .ics fields.
import { describe, expect, it } from 'vitest';
import { computeChart } from '../src/kundli/index';
import {
  MUHURAT_ACTIVITIES,
  MUHURAT_ACTIVITY_IDS,
  MUHURAT_ACTIVITY_RULE_IDS,
  MUHURAT_MIN_RULES,
  MUHURAT_RULE_IDS,
  MUHURAT_RULE_ORDER,
  type MuhuratWindow,
  clipWindow,
  compareWindows,
  mergeWindows,
  muhuratActivity,
  score,
  splitWindows,
  toIcs,
} from '../src/muhurat/index';
import { panchang } from '../src/panchang/panchang';
import { travelNote } from '../src/panchang/dishaShool';
import { formatInZone } from '../src/tz/index';

const DELHI = { lat: 28.6139, lon: 77.209 };
const TZ = 'Asia/Kolkata';
const PRIYA = computeChart({ date: '1998-03-14', time: '06:42', tz: TZ, lat: 26.85, lon: 80.95 });
const hm = (ms: number): string => formatInZone(ms, TZ, 'HH:mm');

function fakeWindow(over: Partial<MuhuratWindow>, met: string[]): MuhuratWindow {
  const rules = MUHURAT_RULE_ORDER.map((id) => ({ id, met: met.includes(id), detail: {}, ruleId: `muhurat-rule-${id}` }));
  return {
    activity: 'travel',
    start: 0,
    end: 3_600_000,
    day: '2026-10-22',
    night: false,
    vara: 4,
    tithi: { n: 11, paksha: 'shukla', index: 10 },
    nakshatra: { index: 23, n: 24 },
    choghadiya: ['Labh'],
    rules,
    met: rules.filter((r) => r.met).length,
    of: 10,
    partial: met.length < MUHURAT_MIN_RULES,
    ruleId: 'muhurat-travel',
    rahuKaal: null,
    clippedByRahuKaal: false,
    abhijit: null,
    ...over,
  };
}

describe('muhurat scorer (F26)', () => {
  it('ships 14 activity tables with the ten rules in the design order', () => {
    expect(MUHURAT_ACTIVITIES).toHaveLength(14);
    expect(MUHURAT_ACTIVITY_IDS).toEqual([
      'griha-pravesh', 'vehicle-purchase', 'business-start', 'job-joining', 'travel', 'naamkaran', 'mundan',
      'engagement', 'marriage', 'property-registration', 'new-venture', 'education-start', 'medical-procedure', 'vrat-start',
    ]);
    expect(MUHURAT_RULE_ORDER).toEqual(['tithi', 'nakshatra', 'vara', 'chandra-bala', 'tara-bala', 'rahu-kaal', 'bhadra', 'panchak', 'abhijit', 'choghadiya']);
    expect(MUHURAT_RULE_IDS).toHaveLength(10);
    expect(MUHURAT_ACTIVITY_RULE_IDS).toHaveLength(14);
    for (const a of MUHURAT_ACTIVITIES) {
      for (const t of a.allowedTithis) {
        expect(t).toBeGreaterThanOrEqual(1);
        expect(t).toBeLessThanOrEqual(30);
        // Rikta tithis (4, 9, 14 of either paksha) and Amavasya never allowed.
        expect([4, 9, 14, 19, 24, 29, 30]).not.toContain(t);
        expect(a.forbiddenTithis).not.toContain(t);
      }
      for (const n of a.allowedNakshatras) expect(n >= 1 && n <= 27).toBe(true);
      for (const v of a.allowedVaras) expect(v >= 0 && v <= 6).toBe(true);
      expect(a.sources.length).toBeGreaterThan(0);
      expect(a.names.en && a.names.hi && a.names.bho).toBeTruthy();
    }
    expect(muhuratActivity('marriage').profiles).toBe(2);
    expect(muhuratActivity('travel').nightAllowed).toBe(true);
    expect(() => muhuratActivity('nope')).toThrow();
  });

  it('Thursday Delhi 2026-10-22: daytime candidates are the choghadiya segments minus the Rahu Kaal eighth', () => {
    const p = panchang('2026-10-22', DELHI, TZ);
    expect(p.vara).toBe(4);
    const w = score('griha-pravesh', { from: '2026-10-22', to: '2026-10-22' }, [PRIYA], DELHI, TZ);
    // 8 day segments, the Rahu Kaal one (13:30-14:55) dropped; adjacent equal-rule segments merged -> <= 7 windows.
    expect(w.length).toBeLessThanOrEqual(7);
    expect(w.length).toBeGreaterThanOrEqual(4);
    for (const x of w) {
      expect(x.night).toBe(false);
      expect(x.start < p.rahuKaal!.end && p.rahuKaal!.start < x.end).toBe(false); // never overlaps Rahu Kaal
      expect(x.rules.find((r) => r.id === 'rahu-kaal')!.met).toBe(true);
      expect(x.of).toBe(10);
      expect(x.met).toBe(x.rules.filter((r) => r.met).length);
      expect(x.partial).toBe(x.met < MUHURAT_MIN_RULES);
      expect(x.rules.map((r) => r.id)).toEqual(MUHURAT_RULE_ORDER);
      expect(x.ruleId).toBe('muhurat-griha-pravesh');
      expect(x.start).toBeGreaterThanOrEqual(p.sunrise!);
      expect(x.end).toBeLessThanOrEqual(p.sunset!);
    }
    // Every daytime minute outside Rahu Kaal is covered by exactly one window.
    const covered = w.reduce((s, x) => s + (x.end - x.start), 0);
    expect(covered).toBe(p.sunset! - p.sunrise! - (p.rahuKaal!.end - p.rahuKaal!.start));
    // Abhijit (11:42-12:28) overlaps the Labh segment 12:05-13:30 and the Chal one before it.
    const abhijit = w.filter((x) => x.rules.find((r) => r.id === 'abhijit')!.met);
    expect(abhijit.length).toBeGreaterThanOrEqual(1);
    expect(abhijit.every((x) => x.start < p.abhijit!.end && p.abhijit!.start < x.end)).toBe(true);
    // The night choghadiya never appear for a day-only activity; they do for travel.
    expect(w.some((x) => x.night)).toBe(false);
    const travel = score('travel', { from: '2026-10-22', to: '2026-10-22' }, [PRIYA], DELHI, TZ);
    expect(travel.some((x) => x.night)).toBe(true);
    expect(travel.filter((x) => x.night).every((x) => !x.rules.find((r) => r.id === 'abhijit')!.met)).toBe(true);
  });

  it('clipWindow keeps the uncovered parts and drops a window inside the cut', () => {
    expect(clipWindow({ start: 0, end: 10 }, null)).toEqual([{ start: 0, end: 10 }]);
    expect(clipWindow({ start: 0, end: 10 }, { start: 20, end: 30 })).toEqual([{ start: 0, end: 10 }]);
    expect(clipWindow({ start: 0, end: 10 }, { start: 3, end: 6 })).toEqual([{ start: 0, end: 3 }, { start: 6, end: 10 }]);
    expect(clipWindow({ start: 0, end: 10 }, { start: 0, end: 10 })).toEqual([]);
    expect(clipWindow({ start: 0, end: 10 }, { start: -5, end: 4 })).toEqual([{ start: 4, end: 10 }]);
    expect(clipWindow({ start: 0, end: 10 }, { start: 7, end: 15 })).toEqual([{ start: 0, end: 7 }]);
  });

  it('merges adjacent windows with identical rule sets only', () => {
    const a = fakeWindow({ start: 0, end: 10, choghadiya: ['Labh'] }, ['tithi', 'vara', 'choghadiya']);
    const b = fakeWindow({ start: 10, end: 20, choghadiya: ['Amrit'] }, ['tithi', 'vara', 'choghadiya']);
    const c = fakeWindow({ start: 20, end: 30, choghadiya: ['Kaal'] }, ['tithi', 'vara']);
    const d = fakeWindow({ start: 40, end: 50, choghadiya: ['Shubh'] }, ['tithi', 'vara']);
    const merged = mergeWindows([a, b, c, d]);
    expect(merged.map((w) => [w.start, w.end])).toEqual([[0, 20], [20, 30], [40, 50]]);
    expect(merged[0].choghadiya).toEqual(['Labh', 'Amrit']);
    expect(merged[0].rules.find((r) => r.id === 'choghadiya')!.detail.choghadiya).toEqual(['Labh', 'Amrit']);
    // Inputs are not mutated.
    expect(a.end).toBe(10);
    expect(a.choghadiya).toEqual(['Labh']);
  });

  it('N18 tie-break: rules met desc -> Abhijit met -> earlier start -> longer', () => {
    const five = fakeWindow({ start: 100, end: 200 }, ['tithi', 'vara', 'nakshatra', 'rahu-kaal', 'bhadra']);
    const fourAbhijit = fakeWindow({ start: 300, end: 400 }, ['tithi', 'vara', 'nakshatra', 'abhijit']);
    const fourEarly = fakeWindow({ start: 50, end: 150 }, ['tithi', 'vara', 'nakshatra', 'rahu-kaal']);
    const fourLateLong = fakeWindow({ start: 60, end: 300 }, ['tithi', 'vara', 'nakshatra', 'rahu-kaal']);
    const fourSameStartShort = fakeWindow({ start: 60, end: 100 }, ['tithi', 'vara', 'nakshatra', 'rahu-kaal']);
    const three = fakeWindow({ start: 0, end: 1000 }, ['tithi', 'vara', 'abhijit']);
    const sorted = [three, fourSameStartShort, fourLateLong, fourEarly, fourAbhijit, five].sort(compareWindows);
    expect(sorted).toEqual([five, fourAbhijit, fourEarly, fourLateLong, fourSameStartShort, three]);
    const { matches, partials } = splitWindows(sorted);
    expect(matches).toHaveLength(5);
    expect(partials).toEqual([three]);
  });

  it('every activity returns >= 1 ranked window with the 10-rule breakdown over today + 7 days in Delhi', () => {
    const range = { from: '2026-10-22', to: '2026-10-29' };
    const cache = new Map();
    for (const id of MUHURAT_ACTIVITY_IDS) {
      const profiles = muhuratActivity(id).profiles === 2 ? [PRIYA, PRIYA] : [PRIYA];
      const w = score(id, range, profiles, DELHI, TZ, { panchangCache: cache });
      expect(w.length).toBeGreaterThanOrEqual(1);
      expect(splitWindows(w).matches.length).toBeGreaterThanOrEqual(1);
      for (let i = 1; i < w.length; i++) expect(compareWindows(w[i - 1], w[i])).toBeLessThanOrEqual(0);
      for (const x of w) {
        expect(x.rules).toHaveLength(10);
        expect(x.activity).toBe(id);
        expect(x.day >= range.from && x.day <= range.to).toBe(true);
        expect(x.choghadiya.length).toBeGreaterThan(0);
      }
    }
    expect(cache.size).toBe(8);
  });

  it('the natal rules use the profile: Chandra bala / Tara bala are met only for favourable houses and taras; no profile -> not met', () => {
    const w = score('naamkaran', { from: '2026-10-22', to: '2026-10-22' }, [PRIYA], DELHI, TZ);
    const first = w[0];
    const cb = first.rules.find((r) => r.id === 'chandra-bala')!;
    expect(cb.detail.transitMoonSign).toBe(11); // Moon in Kumbha on 2026-10-22 (A03 sample truth)
    expect(cb.detail.houses).toEqual([6]); // 6th from Priya's Kanya Moon -> favourable
    expect(cb.met).toBe(true);
    const tb = first.rules.find((r) => r.id === 'tara-bala')!;
    expect(tb.detail.taras).toEqual([4]); // Shatabhisha from Uttara Phalguni = kshema
    expect(tb.met).toBe(true);
    const none = score('naamkaran', { from: '2026-10-22', to: '2026-10-22' }, [], DELHI, TZ);
    expect(none[0].rules.find((r) => r.id === 'chandra-bala')!.met).toBe(false);
    expect(none[0].rules.find((r) => r.id === 'chandra-bala')!.detail).toEqual({ reason: 'no-profile' });
    // Panchak runs the whole day (Wed 21 Oct -> Sun 25 Oct 2026): the panchak rule fails on every window.
    expect(w.every((x) => !x.rules.find((r) => r.id === 'panchak')!.met)).toBe(true);
    // Bhadra on earth 02:36-14:48: windows after 14:48 pass the bhadra rule, earlier ones do not.
    const late = w.find((x) => hm(x.start) === '16:19')!;
    expect(late.rules.find((r) => r.id === 'bhadra')!.met).toBe(true);
    const early = w.find((x) => hm(x.start) === '12:05')!;
    expect(early.rules.find((r) => r.id === 'bhadra')!.met).toBe(false);
  });

  it('toIcs writes an RFC 5545 calendar with the required properties and the rule summary', () => {
    const w = score('griha-pravesh', { from: '2026-10-22', to: '2026-10-22' }, [PRIYA], DELHI, TZ)[0];
    const ics = toIcs(w, { tz: TZ, nowMs: Date.UTC(2026, 9, 21, 12), place: 'Delhi', ruleLabels: { tithi: 'Tithi' } });
    const lines = ics.split('\r\n');
    expect(lines[0]).toBe('BEGIN:VCALENDAR');
    expect(lines).toContain('VERSION:2.0');
    expect(lines.some((l) => l.startsWith('PRODID:'))).toBe(true);
    expect(lines).toContain('BEGIN:VEVENT');
    expect(lines.some((l) => /^UID:griha-pravesh-\d+-\d+@/.test(l))).toBe(true);
    expect(lines).toContain('DTSTAMP:20261021T120000Z');
    expect(lines.some((l) => /^DTSTART:\d{8}T\d{6}Z$/.test(l))).toBe(true);
    expect(lines.some((l) => /^DTEND:\d{8}T\d{6}Z$/.test(l))).toBe(true);
    expect(lines).toContain('SUMMARY:Griha Pravesh · muhurat');
    expect(lines).toContain('LOCATION:Delhi');
    expect(ics).toMatch(/DESCRIPTION:\d+\/10 rules met/);
    expect(ics).toContain('Tithi');
    expect(lines[lines.length - 2]).toBe('END:VCALENDAR');
    expect(ics.endsWith('\r\n')).toBe(true);
    // Folded lines never exceed 75 octets.
    for (const l of lines) expect(Buffer.byteLength(l, 'utf8')).toBeLessThanOrEqual(75);
  });

  it('travel note (F27) wraps Disha Shool with the Panchak / Bhadra flags', () => {
    const n = travelNote('2026-10-22', DELHI, TZ);
    expect(n.ruleId).toBe('disha-shool');
    expect(n.params.vara).toBe(4);
    expect(n.params.avoid).toBe('south');
    expect(n.params.safe).toEqual(['east', 'west', 'north']);
    expect(n.keys).toEqual(['disha-shool-4', 'travel-panchak-south', 'travel-bhadra-earth']);
    expect(n.params.panchakAvoid).toBe('south');
    expect(n.params.bhadraEarth).toBe(true);
  });
});
