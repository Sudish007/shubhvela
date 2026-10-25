// Festival calendar (spec F23, design 10.4 F23, plan A03): evaluates data/festival-rules.json for a Gregorian
// year, tradition (month naming) and region. Dates are computed; `verifiedAgainst` stays null until the A04
// festival suite / release checklist fills it. Conventions: see observance.ts and the JSON `conventions` block.
import rulesJson from '../../data/festival-rules.json';
import { type Lang } from '../locale/index';
import {
  DAY_MS,
  type GeoPoint,
  type LunarMonth,
  type Lunation,
  type Paksha,
  type Tradition,
  NAKSHATRA_DEG,
  STEP,
  addDays,
  amantaMonthOf,
  dayFrame,
  daysBetween,
  elongation,
  localDateOf,
  localMidnight,
  lunationsBetween,
  nakshatraIndexAt,
  nextCrossing,
  prevCrossing,
  purnimantaMonth,
  resolveZone,
  siderealMoon,
  siderealSun,
  sunriseOn,
  tithiIndexAt,
  weekdayOf,
} from '../panchang/astro';
import { bhadraWindows } from '../panchang/panchang';
import { type Observance, type Prefer, type Timing, dayRef, observanceDay, sunsetRuleDay, timingPoint, tithiIndexOf, tithiSpanIn } from './observance';
import { pitruPaksha } from './tithiEvents';
import { spanTithiIndex } from './vrats';

export type Region = 'north' | 'south';

export type FestivalRuleSpec =
  /** minMuhurtas: udaya tithi must run >= N muhurtas after its only sunrise, else the previous day (Akshaya Tritiya). ekadashiVrata: kshaya-Dwadashi rule (see lunar()). */
  | { kind: 'lunar'; month: number; paksha: Paksha; tithi: number; timing: Timing; prefer?: Prefer; nakshatraPreference?: number; bhadraFree?: boolean; minMuhurtas?: number; ekadashiVrata?: boolean }
  /** dayRule: sunset = next day when the sankranti is after sunset; sunrise = next day when it is after sunrise (Malayalam Vishu); same-day = the civil date of the sankranti (Baisakhi). */
  | { kind: 'solar'; sign: number; dayRule: 'sunset' | 'sunrise' | 'same-day' }
  | { kind: 'offset'; from: string; days: number }
  | { kind: 'nakshatra'; solarSign: number; nakshatra: number }
  | { kind: 'weekday-in-month'; month: number; weekday: number }
  | { kind: 'weekday-before'; month: number; paksha: Paksha; tithi: number; weekday: number }
  | { kind: 'span'; month: number; paksha: Paksha; fromTithi: number; toTithi: number }
  | { kind: 'pitru-paksha' };

export interface FestivalRule {
  slug: string;
  names: Record<Lang, string>;
  rule: FestivalRuleSpec;
  regions?: Region[];
  traditionDependent: boolean;
  verifiedAgainst: null | { source: string; date: string };
}

export interface FestivalTithiText {
  /** Month index in the requested tradition's naming, 0 = Chaitra. */
  month: number;
  adhik: boolean;
  paksha: Paksha;
  /** 1-15. */
  tithi: number;
  system: Tradition;
}

export interface FestivalOccurrence {
  slug: string;
  names: Record<Lang, string>;
  date: string;
  /** For multi-day spans: the day number and the span's last date. */
  day?: number;
  end?: string;
  tithiText: FestivalTithiText | null;
  /** The tithi/nakshatra span or the sankranti instant the rule evaluated. */
  span?: { start: number; end: number };
  sankranti?: number;
  /** Puja window computed by the rule (pradosh kala, aparahna, nishita, Bhadra-free part ...). */
  window?: { start: number; end: number };
  /** Bhadra (Vishti) windows that touched the rule's window (Raksha Bandhan, Holika Dahan). */
  bhadra?: { start: number; end: number }[];
  ruleId: string;
  convention: string;
  region?: Region[];
  traditionDependent: boolean;
  verifiedAgainst: FestivalRule['verifiedAgainst'];
}

const TABLE = rulesJson as unknown as { version: number; rules: FestivalRule[] };

/** The committed rules table (>= 60 festivals). */
export const FESTIVAL_RULES: readonly FestivalRule[] = TABLE.rules;

export function festivalRule(slug: string): FestivalRule | undefined {
  return FESTIVAL_RULES.find((r) => r.slug === slug);
}

interface Ctx {
  year: number;
  tradition: Tradition;
  zone: string;
  geo: GeoPoint;
  lunations: Lunation[];
  yearStart: number;
  yearEnd: number;
}

function inYear(ctx: Ctx, date: string): boolean {
  return date.startsWith(`${ctx.year}-`);
}

function tithiText(ctx: Ctx, l: Lunation, paksha: Paksha, tithi: number): FestivalTithiText {
  const amanta: LunarMonth = { index: l.monthIndex, adhik: l.adhik };
  const m = ctx.tradition === 'amanta' ? amanta : purnimantaMonth(amanta, paksha);
  return { month: m.index, adhik: m.adhik, paksha, tithi, system: ctx.tradition };
}

function base(rule: FestivalRule, date: string, convention: string, ctx: Ctx): FestivalOccurrence {
  return {
    slug: rule.slug,
    names: rule.names,
    date,
    tithiText: null,
    ruleId: `festival-${rule.slug}`,
    convention,
    region: rule.regions,
    traditionDependent: rule.traditionDependent,
    verifiedAgainst: rule.verifiedAgainst,
  };
}

/** Lunations of the Amanta month (nija) that can place a festival inside the year. */
function lunationsOfMonth(ctx: Ctx, amantaMonth: number): Lunation[] {
  return ctx.lunations.filter((l) => l.monthIndex === amantaMonth && !l.adhik);
}

function clipBhadra(window: { start: number; end: number } | undefined, bhadra: { start: number; end: number }[]): { start: number; end: number } | undefined {
  if (!window) return window;
  let { start, end } = window;
  for (const b of bhadra) {
    if (b.start <= start && b.end >= end) return undefined; // fully covered
    if (b.start <= start && b.end > start) start = b.end;
    if (b.start < end && b.end >= end) end = b.start;
  }
  return end > start ? { start, end } : undefined;
}

function lunar(rule: FestivalRule, spec: Extract<FestivalRuleSpec, { kind: 'lunar' }>, ctx: Ctx): FestivalOccurrence[] {
  const amanta = amantaMonthOf(spec.month, spec.paksha, 'purnimanta');
  const index = tithiIndexOf(spec.paksha, spec.tithi);
  const out: FestivalOccurrence[] = [];
  for (const l of lunationsOfMonth(ctx, amanta)) {
    const span = tithiSpanIn(l, index);
    let obs: Observance = observanceDay(span, spec.timing, ctx.zone, ctx.geo, spec.prefer ?? 'first', { minMuhurtas: spec.minMuhurtas });
    // Ekadashi fasts (A04 vs Drik Panchang 2026-2028): when the Ekadashi touches only one sunrise but the
    // following Dwadashi touches none (kshaya Dwadashi), the fast moves back to the day the Ekadashi began so
    // that the parana still falls inside the Dwadashi. Two Ekadashi sunrises (vriddhi) take the later day
    // (`prefer: last` in the table).
    if (spec.ekadashiVrata && obs.convention === 'udaya') {
      const dwadashi = tithiSpanIn(l, index + 1);
      const nextSunrise = sunriseOn(addDays(obs.date, 1), ctx.zone, ctx.geo);
      if (nextSunrise !== null && dwadashi.end <= nextSunrise) {
        obs = { date: localDateOf(span.start, ctx.zone), convention: 'udaya-dwadashi-kshaya-previous-day', span };
      }
    }
    // Nakshatra preference (Janmashtami: Rohini). (1) Jayanti yoga: when Ashtami and Rohini coincide at some
    // instant, the Vedic day holding that overlap is taken even if the tithi is at nishita on another day (Drik
    // 2027-08-25; Dharmasindhu's "rohini-yukta ashtami"); (2) otherwise, when two days qualify by timing, the
    // one whose reference instant has the nakshatra.
    if (spec.nakshatraPreference !== undefined) {
      const nakStart = nextCrossing(siderealMoon, spec.nakshatraPreference * NAKSHATRA_DEG, span.start - 2 * DAY_MS, STEP.moon);
      const nakEnd = nextCrossing(siderealMoon, ((spec.nakshatraPreference + 1) * NAKSHATRA_DEG) % 360, nakStart, STEP.moon);
      const oStart = Math.max(span.start, nakStart);
      const oEnd = Math.min(span.end, nakEnd);
      if (oEnd > oStart) {
        const d0 = localDateOf(span.start, ctx.zone);
        for (let i = 0; i < 3; i++) {
          const date = addDays(d0, i);
          const ref = dayRef(date, ctx.zone, ctx.geo);
          if (!ref) continue;
          if (oStart < ref.nextSunrise && oEnd > ref.sunrise && date !== obs.date) {
            obs = { date, convention: `${spec.timing}-jayanti-yoga`, window: timingPoint(ref, spec.timing, ctx.geo)?.window, at: oStart, span };
            break;
          }
          if (oStart < ref.nextSunrise && oEnd > ref.sunrise) break; // the overlap day is already the chosen day
        }
      }
    }
    if (spec.nakshatraPreference !== undefined && obs.convention.endsWith('-of-two')) {
      const d0 = localDateOf(span.start, ctx.zone);
      for (let i = 0; i < 3; i++) {
        const date = addDays(d0, i);
        const ref = dayRef(date, ctx.zone, ctx.geo);
        if (!ref) continue;
        const p = timingPoint(ref, spec.timing, ctx.geo);
        if (p && p.at >= span.start && p.at < span.end && nakshatraIndexAt(p.at) === spec.nakshatraPreference) {
          obs = { date, convention: `${spec.timing}-with-nakshatra`, window: p.window, at: p.at, span };
          break;
        }
      }
    }
    let date = obs.date;
    let convention = obs.convention;
    let window = obs.window;
    let bhadra: { start: number; end: number }[] | undefined;
    if (spec.bhadraFree && obs.window) {
      // Raksha Bandhan / Holika Dahan must avoid Bhadra (Vishti karana). The puja window is clipped to its
      // Bhadra-free part; when Bhadra covers it entirely:
      //  - aparahna rule (Raksha Bandhan): the next morning if the tithi still runs >= 3 muhurtas (144 min)
      //    after sunrise (Dharmasindhu), else after Bhadra ends on the same day;
      //  - pradosh rule (Holika Dahan): after Bhadra ends (before the next sunrise).
      const ref = dayRef(obs.date, ctx.zone, ctx.geo);
      if (ref) {
        const found = bhadraWindows(ref.sunrise, ref.nextSunrise).filter((b) => b.start < obs.window!.end && b.end > obs.window!.start);
        bhadra = found.map((b) => ({ start: b.start, end: b.end }));
        const clipped = clipBhadra(obs.window, found);
        if (clipped) {
          window = clipped;
          if (found.length) convention += '-bhadra-clipped';
        } else {
          const after = found.reduce((m, b) => Math.max(m, b.end), obs.window.start);
          const nextDate = addDays(obs.date, 1);
          const next = spec.timing === 'aparahna' ? dayRef(nextDate, ctx.zone, ctx.geo) : null;
          if (next && span.end - next.sunrise >= 144 * 60_000) {
            date = nextDate;
            window = { start: next.sunrise, end: span.end };
            convention = `${spec.timing}-bhadra-next-morning`;
          } else {
            const night = ref.nextSunrise - ref.sunset;
            window = { start: Math.max(after, ref.sunset), end: Math.min(ref.nextSunrise, Math.max(after, ref.sunset) + Math.round(night / 5)) };
            convention = `${spec.timing}-after-bhadra`;
          }
        }
      }
    }
    if (!inYear(ctx, date)) continue;
    const occ = base(rule, date, convention, ctx);
    occ.tithiText = tithiText(ctx, l, spec.paksha, spec.tithi);
    occ.span = span;
    occ.window = window;
    if (bhadra && bhadra.length) occ.bhadra = bhadra;
    out.push(occ);
  }
  return out;
}

function solar(rule: FestivalRule, spec: Extract<FestivalRuleSpec, { kind: 'solar' }>, ctx: Ctx): FestivalOccurrence[] {
  const out: FestivalOccurrence[] = [];
  const target = spec.sign * 30;
  let from = ctx.yearStart - 40 * DAY_MS;
  for (let i = 0; i < 2; i++) {
    const at = nextCrossing((ms) => siderealSun(ms), target, from, STEP.sun, 120);
    if (at > ctx.yearEnd + 2 * DAY_MS) break;
    let day: { date: string; convention: string };
    if (spec.dayRule === 'sunset') day = sunsetRuleDay(at, ctx.zone, ctx.geo);
    else if (spec.dayRule === 'sunrise') {
      // Malayalam month start (Vishu): the day of the sankranti only when it falls before that day's sunrise.
      const d = localDateOf(at, ctx.zone);
      const sr = sunriseOn(d, ctx.zone, ctx.geo);
      day = sr !== null && at > sr ? { date: addDays(d, 1), convention: 'after-sunrise-next-day' } : { date: d, convention: 'before-sunrise-same-day' };
    } else day = { date: localDateOf(at, ctx.zone), convention: 'same-day' };
    if (inYear(ctx, day.date)) {
      const occ = base(rule, day.date, `sankranti-${day.convention}`, ctx);
      occ.sankranti = at;
      out.push(occ);
    }
    from = at + 300 * DAY_MS;
  }
  return out;
}

/**
 * Solar-month nakshatra festivals (Onam, Karthigai Deepam, Thaipusam): the day in the solar month whose sunrise
 * has the nakshatra. The Moon can pass the nakshatra twice in a solar month; the passage nearest the full moon
 * is the festival (all three fall in Shukla paksha). Two consecutive qualifying days -> the one with more
 * daylight coverage; no sunrise inside the nakshatra -> the day it begins.
 */
function nakshatraRule(rule: FestivalRule, spec: Extract<FestivalRuleSpec, { kind: 'nakshatra' }>, ctx: Ctx): FestivalOccurrence[] {
  const out: FestivalOccurrence[] = [];
  const moon = (ms: number): number => siderealMoon(ms);
  const sun = (ms: number): number => siderealSun(ms);
  let from = ctx.yearStart - 40 * DAY_MS;
  for (let i = 0; i < 2; i++) {
    const enter = nextCrossing(sun, spec.solarSign * 30, from, STEP.sun, 120);
    if (enter > ctx.yearEnd) break;
    const leave = nextCrossing(sun, ((spec.solarSign + 1) * 30) % 360, enter, STEP.sun, 120);
    interface Hit {
      date: string;
      coverage: number;
      fullness: number;
      span: { start: number; end: number };
    }
    // Every day whose DAYLIGHT overlaps the nakshatra is a candidate (not only days whose sunrise is inside it):
    // Drik's Onam 2027 and Thaipusam 2027 fall on the day the nakshatra covers most of the daylight even though
    // it still runs for a few minutes after the next sunrise (A04, reference/CONVENTIONS.md).
    const hits: Hit[] = [];
    for (let d = localDateOf(enter, ctx.zone); d <= localDateOf(leave, ctx.zone); d = addDays(d, 1)) {
      const f = dayFrame(d, ctx.zone, ctx.geo);
      if (!f) continue;
      let nakStart: number;
      let nakEnd: number;
      if (nakshatraIndexAt(f.sunrise) === spec.nakshatra) {
        nakEnd = nextCrossing(moon, ((spec.nakshatra + 1) * NAKSHATRA_DEG) % 360, f.sunrise, STEP.moon);
        nakStart = prevCrossing(moon, spec.nakshatra * NAKSHATRA_DEG, f.sunrise, STEP.moon);
      } else {
        nakStart = nextCrossing(moon, spec.nakshatra * NAKSHATRA_DEG, f.sunrise, STEP.moon);
        if (nakStart >= f.sunset) continue; // the nakshatra does not begin during this day's daylight
        nakEnd = nextCrossing(moon, ((spec.nakshatra + 1) * NAKSHATRA_DEG) % 360, nakStart, STEP.moon);
      }
      const coverage = Math.min(nakEnd, f.sunset) - Math.max(nakStart, f.sunrise);
      if (coverage <= 0) continue;
      hits.push({ date: d, coverage, fullness: Math.abs(elongation(nakStart) - 180), span: { start: nakStart, end: nakEnd } });
    }
    let picked: { date: string; convention: string; span?: { start: number; end: number } } | null = null;
    if (hits.length) {
      const nearestFull = hits.reduce((a, b) => (b.fullness < a.fullness ? b : a));
      // Same passage = same start instant (bisected from different brackets, so compare within an hour).
      const samePassage = hits.filter((h) => Math.abs(h.span.start - nearestFull.span.start) < 3_600_000);
      const best = samePassage.reduce((a, b) => (b.coverage > a.coverage ? b : a));
      const sunriseInside = (() => {
        const f = dayFrame(best.date, ctx.zone, ctx.geo);
        return !!f && f.sunrise >= best.span.start && f.sunrise < best.span.end;
      })();
      picked = { date: best.date, convention: samePassage.length > 1 ? 'nakshatra-longer-daylight' : sunriseInside ? 'nakshatra-udaya' : 'nakshatra-daylight', span: best.span };
    } else {
      const begin = nextCrossing(moon, spec.nakshatra * NAKSHATRA_DEG, enter, STEP.moon);
      if (begin < leave) picked = { date: localDateOf(begin, ctx.zone), convention: 'nakshatra-begin-day' };
    }
    if (picked && inYear(ctx, picked.date)) {
      const occ = base(rule, picked.date, picked.convention, ctx);
      occ.span = picked.span;
      out.push(occ);
    }
    from = leave + 300 * DAY_MS;
  }
  return out;
}

function weekdayInMonth(rule: FestivalRule, spec: Extract<FestivalRuleSpec, { kind: 'weekday-in-month' }>, ctx: Ctx): FestivalOccurrence[] {
  const out: FestivalOccurrence[] = [];
  // Month span in the requested tradition: Amanta = the nija lunation; Purnimanta = day after the previous
  // Purnima (udaya) through the Purnima day of the lunation with the same name.
  for (const l of lunationsOfMonth(ctx, spec.month)) {
    const prev = ctx.lunations[ctx.lunations.indexOf(l) - 1];
    let first: string;
    let last: string;
    if (ctx.tradition === 'amanta') {
      first = observanceDay(tithiSpanIn(l, 0), 'udaya', ctx.zone, ctx.geo).date;
      last = observanceDay(tithiSpanIn(l, 29), 'udaya', ctx.zone, ctx.geo).date;
    } else {
      if (!prev) continue;
      first = addDays(observanceDay(tithiSpanIn(prev, 14), 'udaya', ctx.zone, ctx.geo).date, 1);
      last = observanceDay(tithiSpanIn(l, 14), 'udaya', ctx.zone, ctx.geo).date;
    }
    let n = 1;
    for (let d = first; d <= last; d = addDays(d, 1)) {
      if (weekdayOf(d) !== spec.weekday) continue;
      if (inYear(ctx, d)) {
        const occ = base(rule, d, `weekday-in-${ctx.tradition}-month`, ctx);
        occ.day = n;
        const sunrise = sunriseOn(d, ctx.zone, ctx.geo);
        if (sunrise !== null) {
          const idx = tithiIndexAt(sunrise);
          const paksha: Paksha = idx < 15 ? 'shukla' : 'krishna';
          // Krishna-paksha days of a Purnimanta month sit in the previous Amanta lunation.
          const holder = ctx.tradition === 'purnimanta' && paksha === 'krishna' && prev ? prev : l;
          occ.tithiText = tithiText(ctx, holder, paksha, (idx % 15) + 1);
        }
        out.push(occ);
      }
      n++;
    }
  }
  return out;
}

function weekdayBefore(rule: FestivalRule, spec: Extract<FestivalRuleSpec, { kind: 'weekday-before' }>, ctx: Ctx): FestivalOccurrence[] {
  const out: FestivalOccurrence[] = [];
  const amanta = amantaMonthOf(spec.month, spec.paksha, 'purnimanta');
  for (const l of lunationsOfMonth(ctx, amanta)) {
    const anchor = observanceDay(tithiSpanIn(l, tithiIndexOf(spec.paksha, spec.tithi)), 'udaya', ctx.zone, ctx.geo).date;
    let d = anchor;
    while (weekdayOf(d) !== spec.weekday) d = addDays(d, -1);
    if (!inYear(ctx, d)) continue;
    const occ = base(rule, d, 'weekday-before-tithi', ctx);
    const sunrise = sunriseOn(d, ctx.zone, ctx.geo);
    if (sunrise !== null) {
      const idx = tithiIndexAt(sunrise);
      occ.tithiText = tithiText(ctx, l, idx < 15 ? 'shukla' : 'krishna', (idx % 15) + 1);
    }
    out.push(occ);
  }
  return out;
}

function span(rule: FestivalRule, spec: Extract<FestivalRuleSpec, { kind: 'span' }>, ctx: Ctx): FestivalOccurrence[] {
  const out: FestivalOccurrence[] = [];
  const amanta = amantaMonthOf(spec.month, spec.paksha, 'purnimanta');
  for (const l of lunationsOfMonth(ctx, amanta)) {
    const first = observanceDay(tithiSpanIn(l, tithiIndexOf(spec.paksha, spec.fromTithi)), 'udaya', ctx.zone, ctx.geo).date;
    const last = observanceDay(tithiSpanIn(l, tithiIndexOf(spec.paksha, spec.toTithi)), 'udaya', ctx.zone, ctx.geo).date;
    const total = daysBetween(first, last) + 1;
    const fromIdx = tithiIndexOf(spec.paksha, spec.fromTithi);
    const toIdx = tithiIndexOf(spec.paksha, spec.toTithi);
    for (let i = 0; i < total && i < 12; i++) {
      const d = addDays(first, i);
      if (!inYear(ctx, d)) continue;
      const occ = base(rule, d, 'span-udaya', ctx);
      occ.day = i + 1;
      occ.end = last;
      const sunrise = sunriseOn(d, ctx.zone, ctx.geo);
      if (sunrise !== null) {
        const idx = spanTithiIndex(tithiIndexAt(sunrise), fromIdx, toIdx);
        occ.tithiText = tithiText(ctx, l, idx < 15 ? 'shukla' : 'krishna', (idx % 15) + 1);
      }
      out.push(occ);
    }
  }
  return out;
}

function pitru(rule: FestivalRule, ctx: Ctx): FestivalOccurrence[] {
  const pp = pitruPaksha(ctx.year, ctx.geo, ctx.zone);
  if (!inYear(ctx, pp.start)) return [];
  const occ = base(rule, pp.start, 'aparahna', ctx);
  occ.end = pp.end;
  occ.day = 1;
  const l = ctx.lunations.find((x) => x.start === pp.lunation.start);
  if (l) occ.tithiText = tithiText(ctx, l, 'shukla', 15);
  return [occ];
}

/**
 * Festivals of a Gregorian year for a tradition (month naming) and region, computed at the observer's place.
 * Multi-day spans (Navratri) return one entry per day; a slug can appear twice when its lunar month falls in
 * both January and December of the same year.
 */
export function festivals(year: number, tradition: Tradition, region: Region, geo: GeoPoint, tz: string): FestivalOccurrence[] {
  const zone = resolveZone(tz);
  const yearStart = localMidnight(`${year}-01-01`, zone);
  const yearEnd = localMidnight(`${year + 1}-01-01`, zone);
  const ctx: Ctx = { year, tradition, zone, geo, lunations: lunationsBetween(yearStart - 45 * DAY_MS, yearEnd + 45 * DAY_MS), yearStart, yearEnd };
  const applicable = FESTIVAL_RULES.filter((r) => !r.regions || r.regions.includes(region));
  const bySlug = new Map<string, FestivalOccurrence[]>();
  const evaluate = (rule: FestivalRule): FestivalOccurrence[] => {
    const cached = bySlug.get(rule.slug);
    if (cached) return cached;
    let res: FestivalOccurrence[] = [];
    const spec = rule.rule;
    switch (spec.kind) {
      case 'lunar':
        res = lunar(rule, spec, ctx);
        break;
      case 'solar':
        res = solar(rule, spec, ctx);
        break;
      case 'nakshatra':
        res = nakshatraRule(rule, spec, ctx);
        break;
      case 'weekday-in-month':
        res = weekdayInMonth(rule, spec, ctx);
        break;
      case 'weekday-before':
        res = weekdayBefore(rule, spec, ctx);
        break;
      case 'span':
        res = span(rule, spec, ctx);
        break;
      case 'pitru-paksha':
        res = pitru(rule, ctx);
        break;
      case 'offset': {
        const from = festivalRule(spec.from);
        if (from) {
          res = evaluate(from)
            .map((o) => ({ ...base(rule, addDays(o.date, spec.days), `offset-${spec.days}-from-${spec.from}`, ctx), tithiText: null }))
            .filter((o) => inYear(ctx, o.date));
        }
        break;
      }
    }
    bySlug.set(rule.slug, res);
    return res;
  };
  const out = applicable.flatMap(evaluate);
  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.slug < b.slug ? -1 : 1));
}

export type { Tradition, Paksha, LunarMonth };
