// goodHours(day, observer, tz): the ONE merge function behind the Today band, the segment list, the widgets and
// the web panchang pages (spec F5/F27, design 10.2 "Merge function", R2-1, R2-2, N3; plan A03).
// It is the only producer of verdicts in the product: UI code never classifies a segment.
//
// Precedence table (design 10.2, binding):
//   1. Avoid   = Rahu Kaal U Yamaganda U Gulika U Kaal/Rog/Udveg choghadiya
//   2. Good    = (Abhijit U Brahma muhurat U Shubh/Labh/Amrit choghadiya) - Avoid
//   3. Neutral = Chal choghadiya and every remaining minute
//   4. Night   = sunset -> next sunrise, drawn at 25 % of the band width; its choghadiya are listed under "Tonight"
//   5. Bhadra (Vishti karana on earth) and Panchak are text flags; they never recolour a span or a row.
// The partition is the set of all segment boundaries; adjacent spans with the same verdict (and the same
// day/night side) are merged for the band; the list keeps every named segment as its own row with exactly one
// verdict chip. A row whose whole extent is overridden carries `overriddenBy`; a row partly changed by an overlay
// carries `parts` (sub-ranges with the other verdict: "overridden by Rahu Kaal" / "lifted by Abhijit").
import { type AyanamsaType } from '../../vendor/jyotish/src/core/ayanamsa';
import {
  type ChoghadiyaName,
  type ChoghadiyaSlot,
  type HoraSlot,
  type BhadraWindow,
  type Window,
  abhijitWindow,
  bhadraWindows,
  brahmaWindow,
  choghadiyaSlots,
  eighth,
  GULIKA_PART,
  horaSlots,
  panchakWindow,
  RAHU_PART,
  YAMAGANDA_PART,
} from './panchang';
import { type DayFrame, type GeoPoint, dayFrame, moonriseBetween, parseLocalDate, resolveZone } from './astro';

export type Verdict = 'good' | 'neutral' | 'avoid';
export type LegendColour = Verdict | 'night';
export type SegmentKind = 'rahu' | 'yamaganda' | 'gulika' | 'abhijit' | 'brahma' | 'choghadiya';
export type SegmentFlag = 'bhadra' | 'panchak';

/** Fraction of the band width given to daylight (design 10.2: 75 % day, 25 % night). */
export const DAY_FRACTION = 0.75;
/** Minimum inline-label width in dp at fontScale 1 (design 10.2 / N3). */
export const LABEL_MIN_DP = 60;

export interface SegmentInput {
  id: string;
  kind: SegmentKind;
  /** i18n key: rahu-kaal | yamaganda | gulika | abhijit | brahma-muhurat | choghadiya-<name lower-case>. */
  name: string;
  choghadiya?: ChoghadiyaName;
  start: number;
  end: number;
  /** The segment's own classical nature before the merge. */
  nature: Verdict;
  night: boolean;
  /** Rule id for the "Why?" sheet (content package key). */
  ruleId: string;
}

export interface SegmentPart {
  start: number;
  end: number;
  verdict: Verdict;
  /** Segment ids that cause the different verdict in this sub-range (empty for `own`). */
  by: string[];
  /** overridden = worse than the chip; lifted = better than the chip; own = the row's own nature shows through. */
  kind: 'overridden' | 'lifted' | 'own';
}

export interface GoodHoursSegment extends SegmentInput {
  /**
   * The ONE verdict chip of the row: the merged verdict over the row's extent, or when overlays split it,
   * the verdict covering most of the extent (ties keep the row's own nature).
   */
  verdict: Verdict;
  /** The chip is worse than `nature` because of these segments (whole extent, or all but the `parts`). */
  overriddenBy?: string[];
  /** The chip is better than `nature` because of these segments (rare). */
  liftedBy?: string[];
  /** Sub-ranges whose verdict differs from the chip (design: "<sub-range> lifted by Abhijit"). */
  parts?: SegmentPart[];
  /** Different-kind segments strictly inside this one with the same verdict ("Amrit · includes Brahma muhurat"). */
  includes?: string[];
  flags: SegmentFlag[];
}

export interface GoodHoursSpan {
  start: number;
  end: number;
  verdict: Verdict;
  night: boolean;
  /** Ids of the segments that decide the verdict (avoid causes, good causes, or the Chal choghadiya). */
  reasons: string[];
}

export interface GoodHoursTicks {
  sunrise: number;
  /** Midpoint of daylight = Abhijit centre (design 10.2 tick row). */
  noon: number;
  sunset: number;
  nextSunrise: number;
  /** Moonrise inside the Vedic day, null when the Moon does not rise before the next sunrise. */
  moonrise: number | null;
}

export interface GoodHoursFlags {
  panchak?: Window;
  bhadra?: BhadraWindow;
}

export interface GoodHours {
  day: string;
  tz: string;
  /** 0 = Sunday. */
  vara: number;
  /** No sunrise/sunset at this latitude today (design 11): spans/segments are empty and the UI shows the fallback text. */
  noSun: boolean;
  ticks: GoodHoursTicks | null;
  spans: GoodHoursSpan[];
  segments: GoodHoursSegment[];
  flags: GoodHoursFlags;
  hora: HoraSlot[];
  /** Verdict colours present in the spans, in legend order (design 10.2 legend; R2-2). */
  legend: LegendColour[];
}

export interface GoodHoursOptions {
  ayanamsa?: AyanamsaType;
}

const CHOGHADIYA_NATURE: Record<ChoghadiyaName, Verdict> = {
  Udveg: 'avoid',
  Chal: 'neutral',
  Labh: 'good',
  Amrit: 'good',
  Kaal: 'avoid',
  Rog: 'avoid',
  Shubh: 'good',
};

function choghadiyaInput(c: ChoghadiyaSlot): SegmentInput {
  return {
    id: `chog-${c.night ? 'night' : 'day'}-${c.n}`,
    kind: 'choghadiya',
    name: `choghadiya-${c.name.toLowerCase()}`,
    choghadiya: c.name,
    start: c.start,
    end: c.end,
    nature: CHOGHADIYA_NATURE[c.name],
    night: c.night,
    ruleId: `choghadiya-${c.name.toLowerCase()}`,
  };
}

/** The classical segments of a Vedic day as merge inputs (13 for the daytime list + 8 night choghadiya). */
export function segmentInputs(frame: DayFrame): SegmentInput[] {
  const w = (id: string, kind: SegmentKind, name: string, win: Window, nature: Verdict, night: boolean, ruleId = name): SegmentInput => ({
    id,
    kind,
    name,
    start: win.start,
    end: win.end,
    nature,
    night,
    ruleId,
  });
  const chog = choghadiyaSlots(frame);
  return [
    w('rahu', 'rahu', 'rahu-kaal', eighth(frame, RAHU_PART[frame.vara]), 'avoid', false),
    w('yamaganda', 'yamaganda', 'yamaganda', eighth(frame, YAMAGANDA_PART[frame.vara]), 'avoid', false),
    w('gulika', 'gulika', 'gulika', eighth(frame, GULIKA_PART[frame.vara]), 'avoid', false),
    w('abhijit', 'abhijit', 'abhijit', abhijitWindow(frame), 'good', false),
    w('brahma', 'brahma', 'brahma-muhurat', brahmaWindow(frame.nextSunrise, frame.sunset), 'good', true),
    ...chog.day.map(choghadiyaInput),
    ...chog.night.map(choghadiyaInput),
  ];
}

interface Atom {
  start: number;
  end: number;
  verdict: Verdict;
  night: boolean;
  reasons: string[];
  covering: string[];
}

function uniq(xs: string[]): string[] {
  return Array.from(new Set(xs));
}

function atomsOf(segments: SegmentInput[], frame: Pick<DayFrame, 'sunrise' | 'sunset' | 'nextSunrise'>): Atom[] {
  const lo = frame.sunrise;
  const hi = frame.nextSunrise;
  const bounds = new Set<number>([lo, frame.sunset, hi]);
  for (const s of segments) {
    if (s.start > lo && s.start < hi) bounds.add(s.start);
    if (s.end > lo && s.end < hi) bounds.add(s.end);
  }
  const sorted = Array.from(bounds).sort((a, b) => a - b);
  const atoms: Atom[] = [];
  for (let i = 0; i + 1 < sorted.length; i++) {
    const start = sorted[i];
    const end = sorted[i + 1];
    if (end <= start) continue;
    const mid = (start + end) / 2;
    const covering = segments.filter((s) => s.start <= mid && mid < s.end);
    const avoid = covering.filter((s) => s.nature === 'avoid');
    const good = covering.filter((s) => s.nature === 'good');
    const neutral = covering.filter((s) => s.nature === 'neutral');
    let verdict: Verdict;
    let reasons: SegmentInput[];
    if (avoid.length) {
      verdict = 'avoid';
      reasons = avoid;
    } else if (good.length) {
      verdict = 'good';
      reasons = good;
    } else {
      verdict = 'neutral';
      reasons = neutral;
    }
    atoms.push({ start, end, verdict, night: start >= frame.sunset, reasons: reasons.map((s) => s.id), covering: covering.map((s) => s.id) });
  }
  return atoms;
}

function mergeSpans(atoms: Atom[]): GoodHoursSpan[] {
  const spans: GoodHoursSpan[] = [];
  for (const a of atoms) {
    const last = spans[spans.length - 1];
    if (last && last.verdict === a.verdict && last.night === a.night && last.end === a.start) {
      last.end = a.end;
      last.reasons = uniq([...last.reasons, ...a.reasons]);
    } else {
      spans.push({ start: a.start, end: a.end, verdict: a.verdict, night: a.night, reasons: [...a.reasons] });
    }
  }
  return spans;
}

function overlaps(a: Window, b: Window): boolean {
  return a.start < b.end && b.start < a.end;
}

function rowsOf(segments: SegmentInput[], atoms: Atom[], flags: GoodHoursFlags): GoodHoursSegment[] {
  return segments.map((s) => {
    const mine = atoms.filter((a) => a.start >= s.start && a.end <= s.end && a.end > a.start);
    const verdicts = uniq(mine.map((a) => a.verdict)) as Verdict[];
    // The chip: the uniform merged verdict, else the verdict covering most of the row (ties -> own nature).
    const verdict: Verdict = verdicts.length <= 1 ? (verdicts[0] ?? s.nature) : dominant(mine, s.nature);
    let overriddenBy: string[] | undefined;
    let liftedBy: string[] | undefined;
    let parts: SegmentPart[] | undefined;
    if (verdict !== s.nature) {
      const by = uniq(mine.filter((a) => a.verdict === verdict).flatMap((a) => a.reasons)).filter((id) => id !== s.id);
      if (worse(verdict, s.nature)) overriddenBy = by;
      else liftedBy = by;
    }
    if (verdicts.length > 1) {
      parts = [];
      for (const a of mine) {
        if (a.verdict === verdict) continue;
        const own = a.verdict === s.nature;
        const by = own ? [] : a.reasons.filter((id) => id !== s.id);
        const kind: SegmentPart['kind'] = own ? 'own' : worse(a.verdict, verdict) ? 'overridden' : 'lifted';
        const last = parts[parts.length - 1];
        if (last && last.end === a.start && last.verdict === a.verdict && last.kind === kind && sameIds(last.by, by)) last.end = a.end;
        else parts.push({ start: a.start, end: a.end, verdict: a.verdict, by, kind });
      }
    }
    const includes = segments
      .filter((o) => o.id !== s.id && o.kind !== s.kind && o.start >= s.start && o.end <= s.end && (o.start > s.start || o.end < s.end))
      .filter((o) => {
        const theirs = atoms.filter((a) => a.start >= o.start && a.end <= o.end);
        return theirs.length > 0 && theirs.every((a) => a.verdict === verdict) && o.nature === verdict;
      })
      .map((o) => o.id);
    const rowFlags: SegmentFlag[] = [];
    if (flags.bhadra && flags.bhadra.location === 'earth' && overlaps(s, flags.bhadra)) rowFlags.push('bhadra');
    if (flags.panchak && overlaps(s, flags.panchak)) rowFlags.push('panchak');
    const row: GoodHoursSegment = { ...s, verdict, flags: rowFlags };
    if (overriddenBy) row.overriddenBy = overriddenBy;
    if (liftedBy) row.liftedBy = liftedBy;
    if (parts && parts.length) row.parts = parts;
    if (includes.length) row.includes = includes;
    return row;
  });
}

const RANK: Record<Verdict, number> = { avoid: 0, neutral: 1, good: 2 };

function worse(a: Verdict, b: Verdict): boolean {
  return RANK[a] < RANK[b];
}

/** Verdict covering the longest part of the atoms; a tie keeps the row's own nature. */
function dominant(atoms: Atom[], nature: Verdict): Verdict {
  const total: Record<Verdict, number> = { good: 0, neutral: 0, avoid: 0 };
  for (const a of atoms) total[a.verdict] += a.end - a.start;
  let best: Verdict = nature;
  for (const v of ['avoid', 'neutral', 'good'] as const) if (total[v] > total[best]) best = v;
  return best;
}

function sameIds(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

export function legendFor(spans: GoodHoursSpan[]): LegendColour[] {
  const out: LegendColour[] = [];
  for (const v of ['good', 'neutral', 'avoid'] as const) if (spans.some((s) => !s.night && s.verdict === v)) out.push(v);
  if (spans.some((s) => s.night)) out.push('night');
  return out;
}

/**
 * Pure merge: spans + rows from arbitrary segment inputs over a frame. Exported so the precedence table can be
 * tested on constructed inputs; goodHours() feeds it the classical segments.
 */
export function mergeVerdicts(segments: SegmentInput[], frame: Pick<DayFrame, 'sunrise' | 'sunset' | 'nextSunrise'>, flags: GoodHoursFlags = {}): { spans: GoodHoursSpan[]; segments: GoodHoursSegment[] } {
  const atoms = atomsOf(segments, frame);
  return { spans: mergeSpans(atoms), segments: rowsOf(segments, atoms, flags) };
}

/** goodHours for a frame whose sunrise/sunset are already known (used by tests and by goodHours()). */
export function goodHoursFromFrame(frame: DayFrame, extras: { moonrise?: number | null; flags?: GoodHoursFlags } = {}): GoodHours {
  const inputs = segmentInputs(frame);
  const flags = extras.flags ?? {};
  const merged = mergeVerdicts(inputs, frame, flags);
  return {
    day: frame.date,
    tz: frame.zone,
    vara: frame.vara,
    noSun: false,
    ticks: {
      sunrise: frame.sunrise,
      noon: Math.round((frame.sunrise + frame.sunset) / 2),
      sunset: frame.sunset,
      nextSunrise: frame.nextSunrise,
      moonrise: extras.moonrise ?? null,
    },
    spans: merged.spans,
    segments: merged.segments,
    flags,
    hora: horaSlots(frame),
    legend: legendFor(merged.spans),
  };
}

/**
 * The merged good-hours model of a civil date at a place: band spans, segment rows (one verdict each), text
 * flags, ticks and the hora grid. Polar guard: `noSun` with empty spans when sunrise/sunset are undefined.
 */
export function goodHours(dayLocal: string, geo: GeoPoint, tz: string, opts: GoodHoursOptions = {}): GoodHours {
  const zone = resolveZone(tz);
  parseLocalDate(dayLocal);
  const frame = dayFrame(dayLocal, zone, geo);
  if (!frame) {
    const { y, m, d } = parseLocalDate(dayLocal);
    return {
      day: dayLocal,
      tz: zone,
      vara: new Date(Date.UTC(y, m - 1, d)).getUTCDay(),
      noSun: true,
      ticks: null,
      spans: [],
      segments: [],
      flags: {},
      hora: [],
      legend: [],
    };
  }
  const ay = opts.ayanamsa ?? 'lahiri';
  const flags: GoodHoursFlags = {};
  const panchak = panchakWindow(frame.sunrise, frame.nextSunrise, ay);
  if (panchak) flags.panchak = panchak;
  const bhadra = bhadraWindows(frame.sunrise, frame.nextSunrise, ay);
  if (bhadra.length) flags.bhadra = bhadra[0];
  const moonrise = moonriseBetween(frame.sunrise, frame.nextSunrise, geo);
  return goodHoursFromFrame(frame, { moonrise, flags });
}

// ---------------------------------------------------------------- band geometry (shared by app, widgets, web)

/** Position 0..1 along the band: daylight occupies DAY_FRACTION, the night the rest, both linear. */
export function bandPosition(utcMs: number, ticks: GoodHoursTicks): number {
  if (utcMs <= ticks.sunrise) return 0;
  if (utcMs >= ticks.nextSunrise) return 1;
  if (utcMs <= ticks.sunset) return (DAY_FRACTION * (utcMs - ticks.sunrise)) / (ticks.sunset - ticks.sunrise);
  return DAY_FRACTION + ((1 - DAY_FRACTION) * (utcMs - ticks.sunset)) / (ticks.nextSunrise - ticks.sunset);
}

/** Inverse of bandPosition (for hit-testing a tap on the band). */
export function bandTime(position: number, ticks: GoodHoursTicks): number {
  const p = Math.min(1, Math.max(0, position));
  if (p <= DAY_FRACTION) return Math.round(ticks.sunrise + (p / DAY_FRACTION) * (ticks.sunset - ticks.sunrise));
  return Math.round(ticks.sunset + ((p - DAY_FRACTION) / (1 - DAY_FRACTION)) * (ticks.nextSunrise - ticks.sunset));
}

export function spanWidthDp(span: Window, ticks: GoodHoursTicks, bandWidthDp: number): number {
  return (bandPosition(span.end, ticks) - bandPosition(span.start, ticks)) * bandWidthDp;
}

export type BandLabel = { kind: 'reasons'; segments: string[] } | { kind: 'verdict'; verdict: Verdict };

/**
 * Inline label of a merged span (design 10.2 / N3): hidden when the span is narrower than 60 dp x fontScale;
 * the reason names when every constituent reason's visible extent is at least that wide (tablets, web, large
 * widgets); otherwise the verdict word. Returns keys; the UI localises them.
 */
export function labelFor(span: GoodHoursSpan, gh: Pick<GoodHours, 'ticks' | 'segments'>, bandWidthDp: number, fontScale = 1): BandLabel | null {
  if (!gh.ticks) return null;
  const threshold = LABEL_MIN_DP * fontScale;
  if (spanWidthDp(span, gh.ticks, bandWidthDp) < threshold) return null;
  const reasons = span.reasons.map((id) => gh.segments.find((s) => s.id === id)).filter((s): s is GoodHoursSegment => Boolean(s));
  if (reasons.length) {
    const ticks = gh.ticks;
    const allWide = reasons.every((r) => spanWidthDp({ start: Math.max(r.start, span.start), end: Math.min(r.end, span.end) }, ticks, bandWidthDp) >= threshold);
    if (allWide) return { kind: 'reasons', segments: reasons.map((r) => r.id) };
  }
  return { kind: 'verdict', verdict: span.verdict };
}

export interface NowState {
  span: GoodHoursSpan;
  /** Ids of every segment row covering the instant. */
  segments: string[];
  choghadiya: GoodHoursSegment | null;
  hora: HoraSlot | null;
  /** The next span boundary and what starts there. */
  next: { at: number; verdict: Verdict; starting: string[] } | null;
}

/** State of the band at an instant (the Now line); null outside the Vedic day. */
export function at(gh: GoodHours, utcMs: number): NowState | null {
  const span = gh.spans.find((s) => s.start <= utcMs && utcMs < s.end);
  if (!span) return null;
  const covering = gh.segments.filter((s) => s.start <= utcMs && utcMs < s.end);
  const nextSpan = gh.spans.find((s) => s.start === span.end) ?? null;
  return {
    span,
    segments: covering.map((s) => s.id),
    choghadiya: covering.find((s) => s.kind === 'choghadiya') ?? null,
    hora: gh.hora.find((h) => h.start <= utcMs && utcMs < h.end) ?? null,
    next: nextSpan
      ? { at: nextSpan.start, verdict: nextSpan.verdict, starting: gh.segments.filter((s) => s.start === nextSpan.start).map((s) => s.id) }
      : null,
  };
}

/** Verdict of the band at an instant, read from the spans (the property test compares this with the rows). */
export function verdictAt(spans: GoodHoursSpan[], utcMs: number): Verdict | null {
  const span = spans.find((s) => s.start <= utcMs && utcMs < s.end);
  return span ? span.verdict : null;
}

/** Verdict a row claims for an instant inside its extent: a `parts` sub-range verdict or the chip. */
export function rowVerdictAt(row: GoodHoursSegment, utcMs: number): Verdict {
  const part = row.parts?.find((p) => p.start <= utcMs && utcMs < p.end);
  return part ? part.verdict : row.verdict;
}
