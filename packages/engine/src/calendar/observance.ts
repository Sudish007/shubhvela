// Shared "which civil day observes this tithi" machinery for tithi events, vrats and festivals (plan A03).
//
// CONVENTIONS (binding; also recorded in FEAT-A03 findings and the rules corpus):
// - udaya      : the day whose sunrise falls inside the tithi. Two such days (vriddhi) -> the first unless the
//                rule says `prefer: 'last'`. None (kshaya) -> the day on which the tithi begins.
// - aparahna   : the tithi must prevail at the aparahna reference instant = sunrise + 0.7 x daylight (middle of
//                the 4th fifth of the day). Used for shraddha/barsi, Raksha Bandhan, Vijaya Dashami.
// - madhyahna  : reference instant = sunrise + 0.5 x daylight (Ganesh Chaturthi, Rama Navami).
// - pradosh    : reference instant = sunset + night/10 (the first 3 of 15 night muhurtas = the Pradosha kala,
//                window sunset -> sunset + night/5). Diwali/Dhanteras/Holika Dahan prefer the LATER day
//                (Dharmasindhu: "dinadvaye para").
// - nishita    : reference instant = the middle of the night (sunset + night/2), window +-24 min
//                (Shivaratri, Janmashtami, Masik Shivaratri).
// - moonrise   : the tithi must prevail at the moonrise of the Vedic day (Sankashti, Karwa Chauth).
// - begin      : the civil day on which the tithi begins.
// - Adhik month: recurrence always uses the nija (regular) month of the same name; the Adhik month is skipped.
// - Kshaya month (two sankrantis in one lunation, next 2122): the lunation is named by its first sankranti and
//   the following name is skipped for that year.
import {
  DAY_MS,
  MIN_MS,
  STEP,
  type GeoPoint,
  type Lunation,
  type Paksha,
  type Tradition,
  addDays,
  dayFrame,
  elongation,
  localDateOf,
  moonriseBetween,
  nextCrossing,
  sunriseOn,
  sunsetOn,
  tithiIndexAt,
} from '../panchang/astro';

export type Timing = 'udaya' | 'aparahna' | 'madhyahna' | 'pradosh' | 'nishita' | 'moonrise' | 'begin';
export type Prefer = 'first' | 'last';

export interface TithiSpan {
  /** 0-29. */
  index: number;
  start: number;
  end: number;
}

/** Exact start/end of tithi `index` (0-29) inside a lunation. */
export function tithiSpanIn(lunation: Lunation, index: number): TithiSpan {
  // Start the search well before the earliest possible start (elongation grows at most ~15.5 deg/day).
  const start = index === 0 ? lunation.start : nextCrossing(elongation, index * 12, lunation.start + DAY_MS * index * 0.7, STEP.elongation);
  const end = index === 29 ? lunation.end : nextCrossing(elongation, ((index + 1) * 12) % 360, start, STEP.elongation);
  return { index, start, end };
}

/** 0-29 tithi index for a paksha + 1-15 number (15 = Purnima / Amavasya). */
export function tithiIndexOf(paksha: Paksha, tithi: number): number {
  if (tithi < 1 || tithi > 15) throw new Error(`Invalid tithi number ${tithi}`);
  return (paksha === 'shukla' ? 0 : 15) + tithi - 1;
}

export interface DayRef {
  date: string;
  sunrise: number;
  sunset: number;
  nextSunrise: number;
}

export function dayRef(date: string, zone: string, geo: GeoPoint): DayRef | null {
  const f = dayFrame(date, zone, geo);
  return f ? { date, sunrise: f.sunrise, sunset: f.sunset, nextSunrise: f.nextSunrise } : null;
}

/** Reference instant and (where it exists) the window of a timing rule on a civil day. */
export function timingPoint(d: DayRef, timing: Timing, geo: GeoPoint): { at: number; window?: { start: number; end: number } } | null {
  const daylight = d.sunset - d.sunrise;
  const night = d.nextSunrise - d.sunset;
  switch (timing) {
    case 'udaya':
      return { at: d.sunrise };
    case 'aparahna':
      return { at: Math.round(d.sunrise + 0.7 * daylight), window: { start: Math.round(d.sunrise + 0.6 * daylight), end: Math.round(d.sunrise + 0.8 * daylight) } };
    case 'madhyahna':
      return { at: Math.round(d.sunrise + 0.5 * daylight), window: { start: Math.round(d.sunrise + 0.4 * daylight), end: Math.round(d.sunrise + 0.6 * daylight) } };
    case 'pradosh':
      return { at: Math.round(d.sunset + night / 10), window: { start: d.sunset, end: Math.round(d.sunset + night / 5) } };
    case 'nishita': {
      const mid = Math.round(d.sunset + night / 2);
      return { at: mid, window: { start: mid - 24 * MIN_MS, end: mid + 24 * MIN_MS } };
    }
    case 'moonrise': {
      const mr = moonriseBetween(d.sunrise, d.nextSunrise, geo);
      return mr === null ? null : { at: mr };
    }
    case 'begin':
      return { at: d.sunrise };
  }
}

export interface Observance {
  date: string;
  /** How the day was chosen (for the "Why?" sheet and A04's convention notes). */
  convention: string;
  /** The timing window on the chosen day (pradosh kala, nishita, aparahna ...), when the rule has one. */
  window?: { start: number; end: number };
  /** Reference instant used (moonrise, nishita midpoint ...). */
  at?: number;
  /** The tithi (or nakshatra) span that was observed. */
  span: { start: number; end: number };
}

/**
 * Civil day that observes a span under a timing rule. Candidates are the day the span begins and the next two;
 * fallback is the begin day with a `-begin-day` convention suffix.
 */
export function observanceDay(span: { start: number; end: number }, timing: Timing, zone: string, geo: GeoPoint, prefer: Prefer = 'first'): Observance {
  const d0 = localDateOf(span.start, zone);
  if (timing === 'begin') return { date: d0, convention: 'begin-day', span };
  const hits: Observance[] = [];
  for (let i = 0; i < 3; i++) {
    const date = addDays(d0, i);
    const ref = dayRef(date, zone, geo);
    if (!ref) continue;
    if (ref.sunrise >= span.end) break; // every reference instant of this day is after the span
    const p = timingPoint(ref, timing, geo);
    if (!p) continue;
    if (p.at >= span.start && p.at < span.end) hits.push({ date, convention: timing, window: p.window, at: p.at, span });
  }
  if (hits.length === 0) return { date: d0, convention: `${timing}-begin-day`, span };
  if (hits.length === 1) return hits[0];
  const pick = prefer === 'last' ? hits[hits.length - 1] : hits[0];
  return { ...pick, convention: `${timing}-${prefer}-of-two` };
}

/** Local date of the day on which `utcMs` falls, shifted to the next day when it is after that day's sunset. */
export function sunsetRuleDay(utcMs: number, zone: string, geo: GeoPoint): { date: string; convention: string } {
  const d = localDateOf(utcMs, zone);
  const sunset = sunsetOn(d, zone, geo);
  if (sunset !== null && utcMs > sunset) return { date: addDays(d, 1), convention: 'after-sunset-next-day' };
  return { date: d, convention: 'same-day' };
}

/** Sunrise of a civil date or null (polar); small wrapper so callers do not import astro directly. */
export function sunriseOf(date: string, zone: string, geo: GeoPoint): number | null {
  return sunriseOn(date, zone, geo);
}

/** Tithi (0-29) running at an instant. */
export function tithiAtInstant(utcMs: number): number {
  return tithiIndexAt(utcMs);
}

export type { Paksha, Tradition };
