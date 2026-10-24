import { describe, expect, it } from 'vitest';
import {
  DAY_FRACTION,
  LABEL_MIN_DP,
  at,
  bandPosition,
  bandTime,
  goodHours,
  goodHoursFromFrame,
  labelFor,
  legendFor,
  mergeVerdicts,
  rowVerdictAt,
  segmentInputs,
  spanWidthDp,
  verdictAt,
  type GoodHoursSpan,
  type SegmentInput,
} from '../src/panchang/goodHours';
import { type DayFrame } from '../src/panchang/astro';
import { localToUtc } from '../src/tz/index';

const ZONE = 'Asia/Kolkata';
const H = 3_600_000;
const M = 60_000;

/** A constructed Thursday: sunrise 06:00, sunset 18:00, next sunrise 06:00 (12 h day, 12 h night). */
function thursday(): DayFrame {
  const sunrise = localToUtc(ZONE, { y: 2026, m: 10, d: 22, hh: 6, mm: 0 }).utcMs; // 2026-10-22 is a Thursday
  return { date: '2026-10-22', zone: ZONE, sunrise, sunset: sunrise + 12 * H, nextSunrise: sunrise + 24 * H, vara: 4 };
}

describe('goodHours merge (design 10.2 precedence table, constructed inputs)', () => {
  const frame = thursday();
  const gh = goodHoursFromFrame(frame);
  const row = (id: string) => gh.segments.find((s) => s.id === id)!;

  it('lists 13 daytime segments (3 kaals, Abhijit, Brahma, 8 choghadiya) and 8 night choghadiya', () => {
    expect(gh.segments.filter((s) => !s.night)).toHaveLength(12);
    expect(gh.segments.filter((s) => s.night)).toHaveLength(9); // 8 night choghadiya + Brahma muhurat (before next sunrise)
    expect(gh.segments.map((s) => s.id)).toContain('brahma');
    expect(segmentInputs(frame)).toHaveLength(21);
  });

  it('Avoid = Rahu Kaal U Yamaganda U Gulika U Kaal/Rog/Udveg: Thursday eighths 6, 1, 3', () => {
    const unit = 12 * H / 8;
    expect(row('rahu').start).toBe(frame.sunrise + 5 * unit);
    expect(row('yamaganda').start).toBe(frame.sunrise);
    expect(row('gulika').start).toBe(frame.sunrise + 2 * unit);
    for (const id of ['rahu', 'yamaganda', 'gulika', 'chog-day-2', 'chog-day-3', 'chog-day-7']) expect(row(id).verdict).toBe('avoid');
  });

  it('a good choghadiya under a kaal is overridden as a whole and keeps exactly one chip', () => {
    const shubh = row('chog-day-1'); // Thursday day sequence starts with Shubh = Yamaganda's eighth
    expect(shubh.nature).toBe('good');
    expect(shubh.verdict).toBe('avoid');
    expect(shubh.overriddenBy).toEqual(['yamaganda']);
    expect(shubh.parts).toBeUndefined();
    const amrit = row('chog-day-6'); // Amrit in Rahu Kaal's eighth
    expect(amrit.verdict).toBe('avoid');
    expect(amrit.overriddenBy).toEqual(['rahu']);
  });

  it('Good = Abhijit U Brahma U Shubh/Labh/Amrit minus Avoid; Abhijit partly lifts a neutral Chal', () => {
    const chal = row('chog-day-4');
    expect(chal.nature).toBe('neutral');
    expect(chal.verdict).toBe('neutral');
    expect(chal.parts).toBeDefined();
    expect(chal.parts![0]).toMatchObject({ kind: 'lifted', verdict: 'good', by: ['abhijit'] });
    expect(chal.parts![0].start).toBe(row('abhijit').start);
    expect(chal.parts![0].end).toBe(chal.end);
    expect(row('abhijit').verdict).toBe('good');
    expect(row('chog-day-5').verdict).toBe('good'); // Labh
    expect(row('chog-day-8').verdict).toBe('good'); // Shubh
  });

  it('spans merge adjacent equal verdicts, never cross sunset, and cover the whole Vedic day', () => {
    expect(gh.spans[0].start).toBe(frame.sunrise);
    expect(gh.spans[gh.spans.length - 1].end).toBe(frame.nextSunrise);
    for (let i = 1; i < gh.spans.length; i++) {
      expect(gh.spans[i].start).toBe(gh.spans[i - 1].end);
      const same = gh.spans[i].verdict === gh.spans[i - 1].verdict && gh.spans[i].night === gh.spans[i - 1].night;
      expect(same).toBe(false);
    }
    expect(gh.spans.some((s) => s.start < frame.sunset && s.end > frame.sunset)).toBe(false);
    // Thursday: Yamaganda+Rog+Udveg merge into one avoid span 06:00 -> 10:30.
    expect(gh.spans[0]).toMatchObject({ verdict: 'avoid', start: frame.sunrise, end: frame.sunrise + 4.5 * H });
    expect(gh.spans[0].reasons).toEqual(expect.arrayContaining(['yamaganda', 'chog-day-2', 'gulika', 'chog-day-3']));
  });

  it('night spans are flagged night; the Brahma muhurat sits 96-48 min before the next sunrise and stays good inside good choghadiya', () => {
    const night = gh.spans.filter((s) => s.night);
    expect(night.length).toBeGreaterThan(0);
    expect(night[0].start).toBe(frame.sunset);
    // With a 12 h night the Brahma muhurat (04:24-05:12) straddles the 7th (Shubh) and 8th (Amrit) night
    // choghadiya; both are good, so nothing is overridden or lifted and no row gets `parts`.
    expect(row('brahma')).toMatchObject({ start: frame.nextSunrise - 96 * M, end: frame.nextSunrise - 48 * M, verdict: 'good', night: true });
    expect(row('chog-night-7').parts).toBeUndefined();
    expect(row('chog-night-8').parts).toBeUndefined();
    expect(row('brahma').parts).toBeUndefined();
    // With a 14 h night the last choghadiya is 105 min long and strictly contains the Brahma muhurat:
    // the row reads "Amrit choghadiya · includes Brahma muhurat" (same verdict, informational).
    const long: DayFrame = { ...frame, sunset: frame.sunrise + 10 * H, nextSunrise: frame.sunrise + 24 * H };
    const ghLong = goodHoursFromFrame(long);
    expect(ghLong.segments.find((s) => s.id === 'chog-night-8')!.includes).toEqual(['brahma']);
    expect(ghLong.segments.find((s) => s.id === 'brahma')!.includes).toBeUndefined();
  });

  it('every row has exactly one verdict and agrees with the band at every minute', () => {
    for (const s of gh.segments) {
      expect(['good', 'neutral', 'avoid']).toContain(s.verdict);
      for (let t = s.start; t < s.end; t += M) expect(rowVerdictAt(s, t)).toBe(verdictAt(gh.spans, t));
    }
  });

  it('exotic constructed inputs: Brahma inside Kaal is overridden; Abhijit half in Rahu Kaal gets an overridden part', () => {
    const f = thursday();
    const inputs: SegmentInput[] = [
      { id: 'rahu', kind: 'rahu', name: 'rahu-kaal', start: f.sunrise + 5 * H, end: f.sunrise + 6 * H, nature: 'avoid', night: false, ruleId: 'rahu-kaal' },
      { id: 'abhijit', kind: 'abhijit', name: 'abhijit', start: f.sunrise + 5.5 * H, end: f.sunrise + 6.5 * H, nature: 'good', night: false, ruleId: 'abhijit' },
      { id: 'kaal', kind: 'choghadiya', name: 'choghadiya-kaal', choghadiya: 'Kaal', start: f.sunset, end: f.sunset + 2 * H, nature: 'avoid', night: true, ruleId: 'choghadiya-kaal' },
      { id: 'brahma', kind: 'brahma', name: 'brahma-muhurat', start: f.sunset + 0.5 * H, end: f.sunset + 1 * H, nature: 'good', night: true, ruleId: 'brahma-muhurat' },
    ];
    const m = mergeVerdicts(inputs, f);
    const abhijit = m.segments.find((s) => s.id === 'abhijit')!;
    expect(abhijit.verdict).toBe('good');
    expect(abhijit.parts).toEqual([{ start: f.sunrise + 5.5 * H, end: f.sunrise + 6 * H, verdict: 'avoid', by: ['rahu'], kind: 'overridden' }]);
    const brahma = m.segments.find((s) => s.id === 'brahma')!;
    expect(brahma.verdict).toBe('avoid');
    expect(brahma.overriddenBy).toEqual(['kaal']);
    // Remainder is neutral with no reasons.
    const remainder = m.spans.find((s) => s.start === f.sunrise)!;
    expect(remainder).toMatchObject({ verdict: 'neutral', reasons: [] });
    expect(verdictAt(m.spans, f.sunrise + 6.25 * H)).toBe('good');
    expect(verdictAt(m.spans, f.sunrise + 5.75 * H)).toBe('avoid');
  });

  it('the chip follows the majority of the row when overlays split it: a mostly-overridden Abhijit reads avoid with an "own" part', () => {
    const f = thursday();
    const inputs: SegmentInput[] = [
      { id: 'rahu', kind: 'rahu', name: 'rahu-kaal', start: f.sunrise + 5 * H, end: f.sunrise + 5.6 * H, nature: 'avoid', night: false, ruleId: 'rahu-kaal' },
      { id: 'abhijit', kind: 'abhijit', name: 'abhijit', start: f.sunrise + 5 * H, end: f.sunrise + 5.75 * H, nature: 'good', night: false, ruleId: 'abhijit' },
    ];
    const m = mergeVerdicts(inputs, f);
    const abhijit = m.segments.find((s) => s.id === 'abhijit')!;
    expect(abhijit.verdict).toBe('avoid');
    expect(abhijit.overriddenBy).toEqual(['rahu']);
    expect(abhijit.parts).toEqual([{ start: f.sunrise + 5.6 * H, end: f.sunrise + 5.75 * H, verdict: 'good', by: [], kind: 'own' }]);
    for (let t = abhijit.start; t < abhijit.end; t += M) expect(rowVerdictAt(abhijit, t)).toBe(verdictAt(m.spans, t));
  });

  it('flags (Bhadra on earth, Panchak) mark rows as text and never change spans or verdicts', () => {
    const f = thursday();
    const plain = goodHoursFromFrame(f);
    const flagged = goodHoursFromFrame(f, { flags: { bhadra: { start: f.sunrise + 2 * H, end: f.sunrise + 9 * H, location: 'earth', moonSign: 10 }, panchak: { start: f.sunrise - DAY_FRACTION, end: f.nextSunrise + H } } });
    expect(flagged.spans).toEqual(plain.spans);
    expect(flagged.segments.map((s) => s.verdict)).toEqual(plain.segments.map((s) => s.verdict));
    expect(flagged.segments.every((s) => s.flags.includes('panchak'))).toBe(true);
    expect(flagged.segments.find((s) => s.id === 'rahu')!.flags).toContain('bhadra'); // Rahu Kaal 13:30-15:00 overlaps Bhadra till 15:00
    expect(flagged.segments.find((s) => s.id === 'chog-day-8')!.flags).not.toContain('bhadra');
    // Bhadra in heaven/patal is not a row flag (design: "Bhadra on earth").
    const heaven = goodHoursFromFrame(f, { flags: { bhadra: { start: f.sunrise, end: f.sunset, location: 'heaven', moonSign: 0 } } });
    expect(heaven.segments.some((s) => s.flags.includes('bhadra'))).toBe(false);
  });
});

describe('band geometry and labels (design 10.2: 75 % day / 25 % night, N3 labels)', () => {
  const frame = thursday();
  const gh = goodHoursFromFrame(frame);
  const ticks = gh.ticks!;

  it('compresses the night to 25 % of the width, linearly on each side', () => {
    expect(bandPosition(frame.sunrise, ticks)).toBe(0);
    expect(bandPosition(frame.sunset, ticks)).toBeCloseTo(0.75, 10);
    expect(bandPosition(frame.sunrise + 6 * H, ticks)).toBeCloseTo(0.375, 10);
    expect(bandPosition(frame.sunset + 6 * H, ticks)).toBeCloseTo(0.875, 10);
    expect(bandPosition(frame.nextSunrise, ticks)).toBe(1);
    expect(ticks.noon).toBe(frame.sunrise + 6 * H);
    for (const p of [0, 0.1, 0.5, 0.75, 0.9, 1]) expect(bandPosition(bandTime(p, ticks), ticks)).toBeCloseTo(p, 6);
    // A 90-minute night choghadiya is 1/8 of 25 %; a 90-minute day choghadiya 1/8 of 75 %.
    expect(spanWidthDp({ start: frame.sunset, end: frame.sunset + 1.5 * H }, ticks, 358)).toBeCloseTo(358 * 0.25 / 8, 6);
    expect(spanWidthDp({ start: frame.sunrise, end: frame.sunrise + 1.5 * H }, ticks, 358)).toBeCloseTo(358 * 0.75 / 8, 6);
  });

  it('hides labels under 60 dp x fontScale, names reasons only when every reason is that wide, else the verdict word', () => {
    const merged = gh.spans[0]; // 4.5 h avoid span with four reasons (each 1.5 h = ~33 dp at 358 dp)
    expect(labelFor(merged, gh, 358)).toEqual({ kind: 'verdict', verdict: 'avoid' });
    // At 1200 dp (tablet / web) each 1.5 h reason is 112 dp: reason names.
    expect(labelFor(merged, gh, 1200)).toEqual({ kind: 'reasons', segments: merged.reasons });
    // The last Shubh (16:30-18:00) is a single 1.5 h good span: ~33.6 dp at 358 dp -> hidden; 65.6 dp at 700 dp
    // -> its reason name; at 1.3x the threshold is 78 dp -> hidden again.
    const shubh = gh.spans.find((s) => s.start === frame.sunrise + 10.5 * H)!;
    expect(shubh).toMatchObject({ verdict: 'good', reasons: ['chog-day-8'] });
    expect(labelFor(shubh, gh, 358)).toBeNull();
    expect(labelFor(shubh, gh, 700)).toEqual({ kind: 'reasons', segments: ['chog-day-8'] });
    expect(labelFor(shubh, gh, 700, 1.3)).toBeNull();
    expect(LABEL_MIN_DP).toBe(60);
  });

  it('legend lists only the colours present in the spans (R2-2)', () => {
    expect(legendFor(gh.spans)).toEqual(['good', 'neutral', 'avoid', 'night']);
    const dayOnly: GoodHoursSpan[] = [{ start: 0, end: 1, verdict: 'avoid', night: false, reasons: [] }];
    expect(legendFor(dayOnly)).toEqual(['avoid']);
    const nightGood: GoodHoursSpan[] = [{ start: 0, end: 1, verdict: 'good', night: true, reasons: [] }];
    expect(legendFor(nightGood)).toEqual(['night']);
  });

  it('at(now) names the span, choghadiya, hora and the next boundary; null outside the Vedic day', () => {
    const now = frame.sunrise + 5 * H; // 11:00 in Chal, before Abhijit
    const state = at(gh, now)!;
    expect(state.span.verdict).toBe('neutral');
    expect(state.choghadiya!.choghadiya).toBe('Chal');
    expect(state.hora!.lord).toBe('Mo'); // Thursday: Ju Ma Su Ve Me Mo -> 6th hora (11:00-12:00) is the Moon
    expect(state.next!.verdict).toBe('good');
    expect(state.next!.starting).toContain('abhijit');
    expect(at(gh, frame.sunrise - 1)).toBeNull();
    expect(at(gh, frame.nextSunrise)).toBeNull();
  });

  it('hora grid: 24 slots, 12 day + 12 night, Thursday starts with Jupiter in Chaldean order', () => {
    expect(gh.hora).toHaveLength(24);
    expect(gh.hora.slice(0, 7).map((h) => h.lord)).toEqual(['Ju', 'Ma', 'Su', 'Ve', 'Me', 'Mo', 'Sa']);
    expect(gh.hora[11].end).toBe(frame.sunset);
    expect(gh.hora[12].start).toBe(frame.sunset);
    expect(gh.hora[23].end).toBe(frame.nextSunrise);
  });
});

describe('goodHours(day, observer, tz) on real days', () => {
  it('Delhi 2026-10-22 (Thursday) reproduces the fork segments: Rahu Kaal 13:30-14:55, Abhijit 11:42-12:28, Brahma 04:50-05:38', () => {
    const gh = goodHours('2026-10-22', { lat: 28.6139, lon: 77.209 }, ZONE);
    const hm = (ms: number) => new Date(ms + 330 * M).toISOString().slice(11, 16);
    const row = (id: string) => gh.segments.find((s) => s.id === id)!;
    expect(hm(gh.ticks!.sunrise)).toBe('06:26');
    expect(hm(gh.ticks!.sunset)).toBe('17:44');
    expect(hm(row('rahu').start)).toBe('13:30');
    expect(hm(row('rahu').end)).toBe('14:55');
    expect(hm(row('abhijit').start)).toBe('11:42');
    expect(hm(row('abhijit').end)).toBe('12:28');
    expect(hm(row('brahma').start)).toBe('04:50');
    expect(hm(row('brahma').end)).toBe('05:38');
    expect(hm(gh.ticks!.moonrise!)).toBe('15:21');
    expect(gh.flags.bhadra).toMatchObject({ location: 'earth' });
    expect(hm(gh.flags.bhadra!.end)).toBe('14:48');
    expect(gh.flags.panchak).toBeDefined();
    expect(gh.legend).toEqual(['good', 'neutral', 'avoid', 'night']);
    expect(gh.noSun).toBe(false);
    // Brahma 04:50 starts one minute before the 8th night choghadiya (04:51), so it straddles 7 and 8 (both good):
    // no `includes`, no `parts`; the merged span 03:16-06:26 is one good night span naming all three.
    expect(row('chog-night-8').includes).toBeUndefined();
    expect(row('brahma').parts).toBeUndefined();
    const lastSpan = gh.spans[gh.spans.length - 1];
    expect(lastSpan).toMatchObject({ verdict: 'good', night: true });
    expect(lastSpan.reasons).toEqual(expect.arrayContaining(['chog-night-7', 'brahma', 'chog-night-8']));
    // Mock wording "Chal choghadiya · 11:42-12:05 lifted by Abhijit" / "Amrit choghadiya · overridden by Rahu Kaal".
    expect(row('chog-day-4').parts).toEqual([{ start: row('abhijit').start, end: row('chog-day-4').end, verdict: 'good', by: ['abhijit'], kind: 'lifted' }]);
    expect(row('chog-day-6')).toMatchObject({ verdict: 'avoid', overriddenBy: ['rahu'] });
    expect(row('chog-day-1')).toMatchObject({ verdict: 'avoid', overriddenBy: ['yamaganda'] });
  });

  it('polar guard: Longyearbyen in June has no sunset -> noSun with empty spans (design 11)', () => {
    const gh = goodHours('2026-06-21', { lat: 78.2232, lon: 15.6267 }, 'Arctic/Longyearbyen');
    expect(gh.noSun).toBe(true);
    expect(gh.spans).toEqual([]);
    expect(gh.segments).toEqual([]);
    expect(gh.ticks).toBeNull();
  });
});
