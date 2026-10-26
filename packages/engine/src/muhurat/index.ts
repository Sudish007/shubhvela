// Muhurat finder scorer (spec F26, design 10.5 F26 (M25), plan B01, review N18).
// score(activity, {from, to}, profiles, geo, tz) -> MuhuratWindow[]: ranked candidate windows with the 10-rule
// breakdown. Scores are COUNTS of rules met ("8/10 rules met"), never percentages (spec D8, design 6).
//
// Candidate windows (design 10.5, binding): every daytime choghadiya segment of each Vedic day in the range (night
// segments only when the activity's table says nightAllowed), each clipped to exclude Rahu Kaal (a segment fully
// inside Rahu Kaal is dropped, a partly covered one keeps its uncovered part), then adjacent candidates that meet
// exactly the same set of rules are merged into one window. Abhijit is a bonus rule (overlay), never a window of its
// own. Windows meeting fewer than 4 rules are `partial` (shown under "Best partial matches").
//
// The 10 rules, in the fixed order of data/muhurat-activities.json `ruleOrder`:
//   tithi        the tithi running for most of the window is in the activity's allowed list
//   nakshatra    the nakshatra running for most of the window is allowed
//   vara         the weekday (vara of the Vedic day) is allowed
//   chandra-bala the transit Moon is in a favourable house (1,3,6,7,10,11) from the natal Moon of EVERY profile given
//   tara-bala    the day's nakshatra is a favourable tara (2 sampat, 4 kshema, 6 sadhana, 8 mitra, 9 parama-mitra) for every profile
//   rahu-kaal    the window does not touch Rahu Kaal (true for every candidate after clipping; kept so the count reads 10)
//   bhadra       the window does not overlap a Bhadra (Vishti karana) whose residence is earth (heaven/patal Bhadra is harmless, Muhurta Chintamani)
//   panchak      the window does not overlap Panchak (Moon in Dhanishta 3 -> Revati)
//   abhijit      bonus: the window overlaps the Abhijit muhurta (daytime only)
//   choghadiya   every choghadiya segment of the window is Shubh, Labh or Amrit (Chal is neutral -> not met)
// Without a profile the two natal rules read not met with detail.reason = 'no-profile' (the UI always passes one).
//
// Ranking (N18, binding): rules met desc -> Abhijit met first -> earlier start -> longer window; partials use the same order.
import activitiesJson from '../../data/muhurat-activities.json';
import { type ChartData } from '../kundli/index';
import { type Lang } from '../locale/index';
import { type GeoPoint, addDays, daysBetween, parseLocalDate, resolveZone } from '../panchang/astro';
import { type ChoghadiyaName, type ChoghadiyaSlot, type PanchangDay, type Window, panchang } from '../panchang/panchang';
import { CHANDRA_BALA_GOOD, TARA_GOOD, moonHouseFrom, taraNumber } from '../rules/daily';
import { formatInZone } from '../tz/index';

export type MuhuratRuleId = 'tithi' | 'nakshatra' | 'vara' | 'chandra-bala' | 'tara-bala' | 'rahu-kaal' | 'bhadra' | 'panchak' | 'abhijit' | 'choghadiya';

export interface MuhuratActivity {
  id: string;
  names: Record<Lang, string>;
  /** Tithis 1-30 that meet the tithi rule. */
  allowedTithis: number[];
  forbiddenTithis: number[];
  /** Nakshatras 1-27. */
  allowedNakshatras: number[];
  /** Weekdays 0-6 (Sunday = 0). */
  allowedVaras: number[];
  nightAllowed: boolean;
  /** Number of profiles the For field takes (2 for marriage / engagement). */
  profiles: 1 | 2;
  sources: string[];
}

interface ActivitiesFile {
  version: number;
  ruleOrder: MuhuratRuleId[];
  activities: MuhuratActivity[];
}

const FILE = activitiesJson as unknown as ActivitiesFile;

/** The 14 activity rule tables (spec F26). */
export const MUHURAT_ACTIVITIES: readonly MuhuratActivity[] = FILE.activities;
export const MUHURAT_ACTIVITY_IDS: readonly string[] = MUHURAT_ACTIVITIES.map((a) => a.id);
/** The ten rules in display order. */
export const MUHURAT_RULE_ORDER: readonly MuhuratRuleId[] = FILE.ruleOrder;
/** `muhurat-rule-<rule>` for the ten rules (RULE_IDS; the Why? sheet of a rule chip). */
export const MUHURAT_RULE_IDS: readonly string[] = MUHURAT_RULE_ORDER.map((r) => `muhurat-rule-${r}`);
/** `muhurat-<activity>` for the 14 activities (RULE_IDS; the activity's rule table, also the Upcoming strip's saved-muhurat rule id). */
export const MUHURAT_ACTIVITY_RULE_IDS: readonly string[] = MUHURAT_ACTIVITY_IDS.map((id) => `muhurat-${id}`);
/** Minimum rules met for a window to count as a match (design 10.5). */
export const MUHURAT_MIN_RULES = 4;
export const MUHURAT_RULE_COUNT = 10;

export function muhuratActivity(id: string): MuhuratActivity {
  const a = MUHURAT_ACTIVITIES.find((x) => x.id === id);
  if (!a) throw new Error(`Unknown muhurat activity: ${id}`);
  return a;
}

export type RuleDetail = Record<string, string | number | boolean | null | number[] | string[]>;

export interface MuhuratRule {
  id: MuhuratRuleId;
  met: boolean;
  /** Inputs of the rule for the Why? sheet (raw values; the UI formats them). */
  detail: RuleDetail;
  ruleId: string;
}

export interface MuhuratWindow {
  activity: string;
  start: number;
  end: number;
  /** Civil date of the Vedic day (sunrise) the window belongs to. */
  day: string;
  night: boolean;
  /** 0 = Sunday. */
  vara: number;
  /** Tithi running for most of the window (1-30) and its paksha. */
  tithi: { n: number; paksha: 'shukla' | 'krishna'; index: number };
  nakshatra: { index: number; n: number };
  /** Choghadiya names covered by the window, in time order. */
  choghadiya: ChoghadiyaName[];
  rules: MuhuratRule[];
  /** Number of rules met (the score). */
  met: number;
  of: number;
  /** Fewer than MUHURAT_MIN_RULES met: listed under "Best partial matches". */
  partial: boolean;
  /** Rule id of the activity's table (`muhurat-<activity>`) for the window's Why?. */
  ruleId: string;
  /** Rahu Kaal of the day (for the Why? sheet and the "clipped" note). */
  rahuKaal: Window | null;
  clippedByRahuKaal: boolean;
  abhijit: Window | null;
}

export interface MuhuratOptions {
  /** Pass the already computed panchang days to avoid recomputation (keyed by civil date). */
  panchangCache?: Map<string, PanchangDay>;
}

const GOOD_CHOGHADIYA: readonly ChoghadiyaName[] = ['Shubh', 'Labh', 'Amrit'];

function overlaps(a: Window, b: Window): boolean {
  return a.start < b.end && b.start < a.end;
}

/** Clips a window to exclude [cut.start, cut.end): zero, one or two pieces. */
export function clipWindow(w: Window, cut: Window | null): Window[] {
  if (!cut || !overlaps(w, cut)) return [w];
  const out: Window[] = [];
  if (w.start < cut.start) out.push({ start: w.start, end: cut.start });
  if (cut.end < w.end) out.push({ start: cut.end, end: w.end });
  return out;
}

/** The value (tithi/nakshatra interval) covering the largest part of a window. */
function dominantInterval<T extends { start: number; end: number }>(list: T[], w: Window): T {
  let best = list[0];
  let bestCover = -1;
  for (const x of list) {
    const cover = Math.min(x.end, w.end) - Math.max(x.start, w.start);
    if (cover > bestCover) {
      bestCover = cover;
      best = x;
    }
  }
  return best;
}

interface Candidate {
  w: Window;
  slots: ChoghadiyaSlot[];
  night: boolean;
  clipped: boolean;
}

function candidates(p: PanchangDay, nightAllowed: boolean): Candidate[] {
  const out: Candidate[] = [];
  const slots = [...p.choghadiya.day, ...(nightAllowed ? p.choghadiya.night : [])];
  for (const s of slots) {
    const pieces = clipWindow({ start: s.start, end: s.end }, p.rahuKaal);
    for (const w of pieces) {
      if (w.end - w.start < 60_000) continue;
      out.push({ w, slots: [s], night: s.night, clipped: pieces.length !== 1 || w.start !== s.start || w.end !== s.end });
    }
  }
  return out;
}

function evaluate(activity: MuhuratActivity, p: PanchangDay, c: Candidate, profiles: ChartData[]): MuhuratWindow {
  const w = c.w;
  const tithi = dominantInterval(p.tithis, w);
  const nak = dominantInterval(p.nakshatras, w);
  const moonSign = dominantInterval(p.moonSigns, w);
  const natal = profiles.map((chart) => {
    const moon = chart.planets.find((x) => x.id === 'Mo');
    if (!moon) throw new Error('Profile chart has no Moon');
    return { moonSign: moon.sign, nakshatra: moon.nakshatra };
  });
  const chandra = natal.map((n) => moonHouseFrom(n.moonSign, moonSign.index + 1));
  const taras = natal.map((n) => taraNumber(n.nakshatra, nak.index + 1));
  const earthBhadra = p.bhadra.filter((b) => b.location === 'earth' && overlaps(w, b));
  const anyBhadra = p.bhadra.filter((b) => overlaps(w, b));
  const panchak = p.panchak && overlaps(w, p.panchak) ? p.panchak : null;
  const abhijit = p.abhijit && !c.night && overlaps(w, p.abhijit) ? p.abhijit : null;
  const names = c.slots.map((s) => s.name);
  const rules: MuhuratRule[] = [
    { id: 'tithi', met: activity.allowedTithis.includes(tithi.n), detail: { tithi: tithi.n, paksha: tithi.paksha, tithiEndsAt: tithi.end, allowed: activity.allowedTithis }, ruleId: 'muhurat-rule-tithi' },
    { id: 'nakshatra', met: activity.allowedNakshatras.includes(nak.index + 1), detail: { nakshatra: nak.index + 1, nakshatraEndsAt: nak.end, allowed: activity.allowedNakshatras }, ruleId: 'muhurat-rule-nakshatra' },
    { id: 'vara', met: activity.allowedVaras.includes(p.vara), detail: { vara: p.vara, allowed: activity.allowedVaras }, ruleId: 'muhurat-rule-vara' },
    {
      id: 'chandra-bala',
      met: natal.length > 0 && chandra.every((h) => (CHANDRA_BALA_GOOD as readonly number[]).includes(h)),
      detail: natal.length ? { houses: chandra, transitMoonSign: moonSign.index + 1, natalMoonSigns: natal.map((n) => n.moonSign), favourable: [...CHANDRA_BALA_GOOD] } : { reason: 'no-profile' },
      ruleId: 'muhurat-rule-chandra-bala',
    },
    {
      id: 'tara-bala',
      met: natal.length > 0 && taras.every((t) => (TARA_GOOD as readonly number[]).includes(t)),
      detail: natal.length ? { taras, dayNakshatra: nak.index + 1, natalNakshatras: natal.map((n) => n.nakshatra), favourable: [...TARA_GOOD] } : { reason: 'no-profile' },
      ruleId: 'muhurat-rule-tara-bala',
    },
    { id: 'rahu-kaal', met: !p.rahuKaal || !overlaps(w, p.rahuKaal), detail: { rahuKaalStart: p.rahuKaal?.start ?? null, rahuKaalEnd: p.rahuKaal?.end ?? null, clipped: c.clipped }, ruleId: 'muhurat-rule-rahu-kaal' },
    {
      id: 'bhadra',
      met: earthBhadra.length === 0,
      detail: { bhadraStart: anyBhadra[0]?.start ?? null, bhadraEnd: anyBhadra[0]?.end ?? null, location: anyBhadra[0]?.location ?? null },
      ruleId: 'muhurat-rule-bhadra',
    },
    { id: 'panchak', met: panchak === null, detail: { panchakStart: panchak?.start ?? null, panchakEnd: panchak?.end ?? null }, ruleId: 'muhurat-rule-panchak' },
    { id: 'abhijit', met: abhijit !== null, detail: { abhijitStart: p.abhijit?.start ?? null, abhijitEnd: p.abhijit?.end ?? null }, ruleId: 'muhurat-rule-abhijit' },
    { id: 'choghadiya', met: names.every((n) => GOOD_CHOGHADIYA.includes(n)), detail: { choghadiya: names, good: [...GOOD_CHOGHADIYA] }, ruleId: 'muhurat-rule-choghadiya' },
  ];
  const met = rules.filter((r) => r.met).length;
  return {
    activity: activity.id,
    start: w.start,
    end: w.end,
    day: p.date,
    night: c.night,
    vara: p.vara,
    tithi: { n: tithi.n, paksha: tithi.paksha, index: tithi.index },
    nakshatra: { index: nak.index, n: nak.index + 1 },
    choghadiya: names,
    rules,
    met,
    of: MUHURAT_RULE_COUNT,
    partial: met < MUHURAT_MIN_RULES,
    ruleId: `muhurat-${activity.id}`,
    rahuKaal: p.rahuKaal,
    clippedByRahuKaal: c.clipped,
    abhijit: p.abhijit,
  };
}

function sameRuleSet(a: MuhuratWindow, b: MuhuratWindow): boolean {
  return a.rules.length === b.rules.length && a.rules.every((r, i) => r.met === b.rules[i].met);
}

/** Merges adjacent windows of the same day that meet exactly the same rule set (design 10.5). */
export function mergeWindows(windows: MuhuratWindow[]): MuhuratWindow[] {
  const out: MuhuratWindow[] = [];
  for (const w of windows) {
    const last = out[out.length - 1];
    if (last && last.day === w.day && last.end === w.start && last.night === w.night && sameRuleSet(last, w)) {
      last.end = w.end;
      last.choghadiya = [...last.choghadiya, ...w.choghadiya];
      last.clippedByRahuKaal = last.clippedByRahuKaal || w.clippedByRahuKaal;
      // The merged window keeps the first segment's rule details apart from the choghadiya list.
      const chog = last.rules.find((r) => r.id === 'choghadiya');
      if (chog) chog.detail = { ...chog.detail, choghadiya: last.choghadiya };
    } else {
      out.push({ ...w, choghadiya: [...w.choghadiya], rules: w.rules.map((r) => ({ ...r, detail: { ...r.detail } })) });
    }
  }
  return out;
}

/** N18 ordering: rules met desc, Abhijit met first, earlier start, longer window. */
export function compareWindows(a: MuhuratWindow, b: MuhuratWindow): number {
  if (a.met !== b.met) return b.met - a.met;
  const aA = a.rules.find((r) => r.id === 'abhijit')?.met ? 1 : 0;
  const bA = b.rules.find((r) => r.id === 'abhijit')?.met ? 1 : 0;
  if (aA !== bA) return bA - aA;
  if (a.start !== b.start) return a.start - b.start;
  return (b.end - b.start) - (a.end - a.start);
}

export interface DateRange {
  /** Civil dates YYYY-MM-DD, inclusive, in the observer's zone. */
  from: string;
  to: string;
}

/**
 * Scores every candidate window of the activity over the date range for the given profiles at the observer's place.
 * Returns ALL windows (matches and partials) in N18 order; the UI splits on `partial`.
 */
export function score(activityId: string, range: DateRange, profiles: ChartData[], geo: GeoPoint, tz: string, opts: MuhuratOptions = {}): MuhuratWindow[] {
  const activity = muhuratActivity(activityId);
  const zone = resolveZone(tz);
  parseLocalDate(range.from);
  parseLocalDate(range.to);
  const days = daysBetween(range.from, range.to);
  if (days < 0) throw new Error(`Date range ends before it starts: ${range.from} > ${range.to}`);
  if (days > 400) throw new Error('Date range longer than 400 days');
  const cache = opts.panchangCache ?? new Map<string, PanchangDay>();
  const out: MuhuratWindow[] = [];
  for (let i = 0; i <= days; i++) {
    const date = addDays(range.from, i);
    let p = cache.get(date);
    if (!p) {
      p = panchang(date, geo, zone, { ayanamsa: profiles[0]?.meta.ayanamsa ?? 'lahiri' });
      cache.set(date, p);
    }
    if (p.noSun) continue;
    const evaluated = candidates(p, activity.nightAllowed).map((c) => evaluate(activity, p as PanchangDay, c, profiles));
    out.push(...mergeWindows(evaluated));
  }
  return out.sort(compareWindows);
}

/** Matches (>= MUHURAT_MIN_RULES) and partials, each already in N18 order. */
export function splitWindows(windows: MuhuratWindow[]): { matches: MuhuratWindow[]; partials: MuhuratWindow[] } {
  return { matches: windows.filter((w) => !w.partial), partials: windows.filter((w) => w.partial) };
}

// ---------------------------------------------------------------- .ics export (RFC 5545)

function icsDate(utcMs: number): string {
  const d = new Date(utcMs);
  const p = (n: number): string => (n < 10 ? `0${n}` : String(n));
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`;
}

function icsEscape(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** UTF-8 byte length of one code point (no TextEncoder dependency, Hermes-safe). */
function utf8Bytes(ch: string): number {
  const cp = ch.codePointAt(0) ?? 0;
  return cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4;
}

/** Folds a content line at 75 octets (RFC 5545 3.1), counting UTF-8 bytes. */
function fold(line: string): string {
  const out: string[] = [];
  let cur = '';
  let bytes = 0;
  const limit = (first: boolean): number => (first ? 75 : 74);
  for (const ch of line) {
    const b = utf8Bytes(ch);
    if (bytes + b > limit(out.length === 0)) {
      out.push(cur);
      cur = ch;
      bytes = b;
    } else {
      cur += ch;
      bytes += b;
    }
  }
  out.push(cur);
  return out.join('\r\n ');
}

export interface IcsOptions {
  lang?: Lang;
  /** Labels for the ten rule ids (UI strings); defaults to the ids. */
  ruleLabels?: Partial<Record<MuhuratRuleId, string>>;
  /** Place name for the LOCATION line. */
  place?: string;
  /** Zone used for the human-readable description (default UTC times). */
  tz?: string;
  /** Deterministic stamp for tests (default: now). */
  nowMs?: number;
  /** Base of the UID domain. */
  uidDomain?: string;
}

/** One VEVENT for a scored window with the rule summary in the description (design 10.5 .ics export). */
export function toIcs(window: MuhuratWindow, opts: IcsOptions = {}): string {
  const lang = opts.lang ?? 'en';
  const activity = muhuratActivity(window.activity);
  const label = (r: MuhuratRule): string => opts.ruleLabels?.[r.id] ?? r.id;
  const summary = `${activity.names[lang]} · muhurat`;
  const metList = window.rules.filter((r) => r.met).map(label).join(', ');
  const notMet = window.rules.filter((r) => !r.met).map(label).join(', ');
  const tz = opts.tz;
  const when = tz ? `${formatInZone(window.start, tz, 'EEE d MMM yyyy HH:mm', lang)} - ${formatInZone(window.end, tz, 'HH:mm', lang)} (${tz})` : `${icsDate(window.start)} - ${icsDate(window.end)}`;
  const description = [`${window.met}/${window.of} rules met`, when, metList ? `Met: ${metList}` : '', notMet ? `Not met: ${notMet}` : '', `Choghadiya: ${window.choghadiya.join(', ')}`, 'Computed by Shubhvela; guidance for reflection, not a prediction.']
    .filter(Boolean)
    .join('\n');
  const stamp = icsDate(opts.nowMs ?? Date.now());
  const uid = `${window.activity}-${window.start}-${window.end}@${opts.uidDomain ?? 'shubhvela.app'}`;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Shubhvela//Muhurat finder//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${icsDate(window.start)}`,
    `DTEND:${icsDate(window.end)}`,
    `SUMMARY:${icsEscape(summary)}`,
    `DESCRIPTION:${icsEscape(description)}`,
    ...(opts.place ? [`LOCATION:${icsEscape(opts.place)}`] : []),
    `CATEGORIES:${icsEscape(activity.id)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.map(fold).join('\r\n') + '\r\n';
}
