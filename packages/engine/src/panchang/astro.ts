// Shared astronomy helpers for the panchang, calendar, rules and dasha modules (plan.md A03).
// Everything here works in UTC milliseconds; civil dates are resolved through the bundled tz table
// (never Intl, never the device offset). Longitudes are degrees; sidereal values use the fork's ayanamsa.
import { Body, Ecliptic, GeoVector, Observer, SearchMoonPhase, SearchRiseSet } from 'astronomy-engine';
import { getAyanamsa, type AyanamsaType } from '../../vendor/jyotish/src/core/ayanamsa';
import { getUdayaLagna } from '../../vendor/jyotish/src/core/calculations';
import { canonicalZone, localToUtc, utcToWall } from '../tz/index';

export const DAY_MS = 86_400_000;
export const HOUR_MS = 3_600_000;
export const MIN_MS = 60_000;
export const NAKSHATRA_DEG = 360 / 27;

/** Observer location (design: explicit Observer {lat, lon, elevation}). */
export interface GeoPoint {
  lat: number;
  lon: number;
  elevation?: number;
}

export function toObserver(p: GeoPoint): Observer {
  if (!Number.isFinite(p.lat) || p.lat < -90 || p.lat > 90) throw new Error(`Invalid latitude: ${p.lat}`);
  if (!Number.isFinite(p.lon) || p.lon < -180 || p.lon > 180) throw new Error(`Invalid longitude: ${p.lon}`);
  return new Observer(p.lat, p.lon, p.elevation ?? 0);
}

export function norm360(x: number): number {
  return ((x % 360) + 360) % 360;
}

/** Wraps an angle difference into [-180, 180). */
export function wrap180(x: number): number {
  return norm360(x + 180) - 180;
}

export function resolveZone(tz: string): string {
  const zone = canonicalZone(tz);
  if (!zone) throw new Error(`Unknown time zone: ${tz}`);
  return zone;
}

// ---------------------------------------------------------------- civil dates

export function parseLocalDate(date: string): { y: number; m: number; d: number } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) throw new Error(`Invalid date (expected YYYY-MM-DD): ${date}`);
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) throw new Error(`Invalid date: ${date}`);
  return { y, m: mo, d };
}

export function formatLocalDate(y: number, m: number, d: number): string {
  return `${y}-${m < 10 ? '0' : ''}${m}-${d < 10 ? '0' : ''}${d}`;
}

/** Civil date (YYYY-MM-DD) of a UTC instant in a zone. */
export function localDateOf(utcMs: number, zone: string): string {
  const w = utcToWall(utcMs, zone);
  return formatLocalDate(w.y, w.m, w.d);
}

/** UTC instant of local midnight at the start of a civil date. */
export function localMidnight(date: string, zone: string): number {
  const { y, m, d } = parseLocalDate(date);
  return localToUtc(zone, { y, m, d, hh: 0, mm: 0 }).utcMs;
}

export function addDays(date: string, n: number): string {
  const { y, m, d } = parseLocalDate(date);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return formatLocalDate(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

/** 0 = Sunday, for a civil date (calendar arithmetic, zone independent). */
export function weekdayOf(date: string): number {
  const { y, m, d } = parseLocalDate(date);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function daysBetween(a: string, b: string): number {
  const pa = parseLocalDate(a);
  const pb = parseLocalDate(b);
  return Math.round((Date.UTC(pb.y, pb.m - 1, pb.d) - Date.UTC(pa.y, pa.m - 1, pa.d)) / DAY_MS);
}

// ---------------------------------------------------------------- longitudes

export function sunTropical(utcMs: number): number {
  return Ecliptic(GeoVector(Body.Sun, new Date(utcMs), true)).elon;
}

export function moonTropical(utcMs: number): number {
  return Ecliptic(GeoVector(Body.Moon, new Date(utcMs), true)).elon;
}

export function ayanamsaAt(utcMs: number, type: AyanamsaType = 'lahiri'): number {
  return getAyanamsa(new Date(utcMs), type);
}

export function siderealSun(utcMs: number, ay: AyanamsaType = 'lahiri'): number {
  return norm360(sunTropical(utcMs) - ayanamsaAt(utcMs, ay));
}

export function siderealMoon(utcMs: number, ay: AyanamsaType = 'lahiri'): number {
  return norm360(moonTropical(utcMs) - ayanamsaAt(utcMs, ay));
}

/** Moon minus Sun, 0..360 (ayanamsa independent). */
export function elongation(utcMs: number): number {
  const d = new Date(utcMs);
  return norm360(Ecliptic(GeoVector(Body.Moon, d, true)).elon - Ecliptic(GeoVector(Body.Sun, d, true)).elon);
}

/** Sun + Moon sidereal longitudes (the yoga angle), 0..360. */
export function yogaAngle(utcMs: number, ay: AyanamsaType = 'lahiri'): number {
  const a = ayanamsaAt(utcMs, ay);
  const d = new Date(utcMs);
  return norm360(Ecliptic(GeoVector(Body.Moon, d, true)).elon - a + Ecliptic(GeoVector(Body.Sun, d, true)).elon - a);
}

/** 0 = Shukla Pratipada ... 14 = Purnima, 15 = Krishna Pratipada ... 29 = Amavasya. */
export function tithiIndexAt(utcMs: number): number {
  return Math.min(29, Math.floor(elongation(utcMs) / 12));
}

/** Half-tithi slot 0..59 (karana position inside the lunation). */
export function karanaSlotAt(utcMs: number): number {
  return Math.min(59, Math.floor(elongation(utcMs) / 6));
}

/**
 * Karana index for a half-tithi slot: 0-6 = Bava, Balava, Kaulava, Taitila, Gara, Vanija, Vishti (repeating);
 * 7 = Shakuni, 8 = Chatushpada, 9 = Naga, 10 = Kimstughna (fixed). Same order as locale.karanaNames.
 */
export function karanaIndexForSlot(slot: number): number {
  if (slot === 0) return 10;
  if (slot === 57) return 7;
  if (slot === 58) return 8;
  if (slot === 59) return 9;
  return (slot - 1) % 7;
}

export const VISHTI_KARANA = 6;

export function nakshatraIndexAt(utcMs: number, ay: AyanamsaType = 'lahiri'): number {
  return Math.min(26, Math.floor(siderealMoon(utcMs, ay) / NAKSHATRA_DEG));
}

export function yogaIndexAt(utcMs: number, ay: AyanamsaType = 'lahiri'): number {
  return Math.min(26, Math.floor(yogaAngle(utcMs, ay) / NAKSHATRA_DEG));
}

/** 0 = Mesha. */
export function moonSignIndexAt(utcMs: number, ay: AyanamsaType = 'lahiri'): number {
  return Math.min(11, Math.floor(siderealMoon(utcMs, ay) / 30));
}

export function sunSignIndexAt(utcMs: number, ay: AyanamsaType = 'lahiri'): number {
  return Math.min(11, Math.floor(siderealSun(utcMs, ay) / 30));
}

/** Mean lunar node (Meeus ch. 47), tropical longitude. Always retrograde. */
export function meanNodeTropical(utcMs: number): number {
  const jd = utcMs / DAY_MS + 2440587.5;
  const T = (jd - 2451545.0) / 36525.0;
  return norm360(125.04452 - 1934.136261 * T + 0.0020708 * T * T + (T * T * T) / 450000);
}

// ---------------------------------------------------------------- crossings

/**
 * First instant after `fromMs` at which an increasing angle (mod 360) crosses `target` upward. The angle must
 * advance by less than 180 deg per step. Bisection to 1 s.
 */
export function nextCrossing(angle: (ms: number) => number, target: number, fromMs: number, stepMs: number, maxSteps = 2000): number {
  let a = fromMs;
  let fa = wrap180(angle(a) - target);
  for (let i = 0; i < maxSteps; i++) {
    const b = a + stepMs;
    const fb = wrap180(angle(b) - target);
    if (fa < 0 && fb >= 0) return bisect(angle, target, a, b);
    a = b;
    fa = fb;
  }
  throw new Error(`nextCrossing: no crossing of ${target} within ${maxSteps} steps`);
}

/** Last instant at or before `fromMs` at which an increasing angle crossed `target` upward. */
export function prevCrossing(angle: (ms: number) => number, target: number, fromMs: number, stepMs: number, maxSteps = 2000): number {
  let b = fromMs;
  let fb = wrap180(angle(b) - target);
  for (let i = 0; i < maxSteps; i++) {
    const a = b - stepMs;
    const fa = wrap180(angle(a) - target);
    if (fa < 0 && fb >= 0) return bisect(angle, target, a, b);
    b = a;
    fb = fa;
  }
  throw new Error(`prevCrossing: no crossing of ${target} within ${maxSteps} steps`);
}

function bisect(angle: (ms: number) => number, target: number, lo: number, hi: number): number {
  for (let i = 0; i < 60 && hi - lo > 1000; i++) {
    const mid = (lo + hi) / 2;
    if (wrap180(angle(mid) - target) < 0) lo = mid;
    else hi = mid;
  }
  return Math.round((lo + hi) / 2);
}

/** Step sizes that keep each angle's motion well under 180 deg per step. */
export const STEP = {
  elongation: 12 * HOUR_MS, // Moon - Sun: <= 7.5 deg per half day
  moon: 12 * HOUR_MS, // sidereal Moon: <= 7.5 deg per half day
  yoga: 12 * HOUR_MS,
  sun: 5 * DAY_MS, // ~5 deg
};

/** Start (inclusive) and end (exclusive) of the tithi (0-29) that is running at `utcMs`. */
export function tithiInterval(utcMs: number): { index: number; start: number; end: number } {
  const index = tithiIndexAt(utcMs);
  const start = prevCrossing(elongation, index * 12, utcMs, STEP.elongation);
  const end = nextCrossing(elongation, ((index + 1) * 12) % 360, utcMs, STEP.elongation);
  return { index, start, end };
}

export function nakshatraInterval(utcMs: number, ay: AyanamsaType = 'lahiri'): { index: number; start: number; end: number } {
  const f = (ms: number): number => siderealMoon(ms, ay);
  const index = nakshatraIndexAt(utcMs, ay);
  const start = prevCrossing(f, index * NAKSHATRA_DEG, utcMs, STEP.moon);
  const end = nextCrossing(f, ((index + 1) * NAKSHATRA_DEG) % 360, utcMs, STEP.moon);
  return { index, start, end };
}

export function yogaInterval(utcMs: number, ay: AyanamsaType = 'lahiri'): { index: number; start: number; end: number } {
  const f = (ms: number): number => yogaAngle(ms, ay);
  const index = yogaIndexAt(utcMs, ay);
  const start = prevCrossing(f, index * NAKSHATRA_DEG, utcMs, STEP.yoga);
  const end = nextCrossing(f, ((index + 1) * NAKSHATRA_DEG) % 360, utcMs, STEP.yoga);
  return { index, start, end };
}

export function karanaInterval(utcMs: number): { slot: number; index: number; start: number; end: number } {
  const slot = karanaSlotAt(utcMs);
  const start = prevCrossing(elongation, slot * 6, utcMs, STEP.elongation);
  const end = nextCrossing(elongation, ((slot + 1) * 6) % 360, utcMs, STEP.elongation);
  return { slot, index: karanaIndexForSlot(slot), start, end };
}

export function moonSignInterval(utcMs: number, ay: AyanamsaType = 'lahiri'): { index: number; start: number; end: number } {
  const f = (ms: number): number => siderealMoon(ms, ay);
  const index = moonSignIndexAt(utcMs, ay);
  const start = prevCrossing(f, index * 30, utcMs, STEP.moon);
  const end = nextCrossing(f, ((index + 1) * 30) % 360, utcMs, STEP.moon);
  return { index, start, end };
}

/**
 * Consecutive intervals of a stepping quantity (tithi, nakshatra, ...) covering [fromMs, toMs): the interval
 * running at fromMs, then every following one that starts before toMs.
 */
export function intervalsCovering<T extends { start: number; end: number }>(first: T, next: (prev: T) => T, toMs: number, max = 8): T[] {
  const out: T[] = [first];
  let cur = first;
  for (let i = 0; i < max && cur.end < toMs; i++) {
    // Each interval is bisected independently (1 s tolerance); pin the start to the previous end so the list is
    // exactly contiguous.
    cur = { ...next(cur), start: cur.end };
    out.push(cur);
  }
  return out;
}

// ---------------------------------------------------------------- rise and set

function riseSet(body: Body, observer: Observer, direction: 1 | -1, fromMs: number, limitDays: number): number | null {
  const t = SearchRiseSet(body, observer, direction, new Date(fromMs), limitDays);
  return t ? t.date.getTime() : null;
}

/** Sunrise on a civil date (null in polar day/night). */
export function sunriseOn(date: string, zone: string, geo: GeoPoint): number | null {
  const midnight = localMidnight(date, zone);
  const t = riseSet(Body.Sun, toObserver(geo), 1, midnight, 1.5);
  return t !== null && localDateOf(t, zone) === date ? t : null;
}

export function sunsetOn(date: string, zone: string, geo: GeoPoint): number | null {
  const midnight = localMidnight(date, zone);
  const t = riseSet(Body.Sun, toObserver(geo), -1, midnight, 1.5);
  return t !== null && localDateOf(t, zone) === date ? t : null;
}

/** First moonrise at or after `fromMs` that is before `toMs`, else null. */
export function moonriseBetween(fromMs: number, toMs: number, geo: GeoPoint): number | null {
  const t = riseSet(Body.Moon, toObserver(geo), 1, fromMs, (toMs - fromMs) / DAY_MS + 0.1);
  return t !== null && t < toMs ? t : null;
}

export function moonsetBetween(fromMs: number, toMs: number, geo: GeoPoint): number | null {
  const t = riseSet(Body.Moon, toObserver(geo), -1, fromMs, (toMs - fromMs) / DAY_MS + 0.1);
  return t !== null && t < toMs ? t : null;
}

export interface DayFrame {
  /** Civil date of the sunrise that opens the Vedic day. */
  date: string;
  zone: string;
  sunrise: number;
  sunset: number;
  nextSunrise: number;
  /** 0 = Sunday; the weekday of `date`. */
  vara: number;
}

/** Sunrise, sunset and next sunrise for a civil date; null when any of them is undefined (polar guard). */
export function dayFrame(date: string, zone: string, geo: GeoPoint): DayFrame | null {
  const sunrise = sunriseOn(date, zone, geo);
  const sunset = sunsetOn(date, zone, geo);
  const nextSunrise = sunriseOn(addDays(date, 1), zone, geo);
  if (sunrise === null || sunset === null || nextSunrise === null || sunset <= sunrise || nextSunrise <= sunset) return null;
  return { date, zone, sunrise, sunset, nextSunrise, vara: weekdayOf(date) };
}

// ---------------------------------------------------------------- lunations and months

export interface Lunation {
  /** New moon (elongation 0) that opens the Amanta month. */
  start: number;
  /** Next new moon (exclusive end). */
  end: number;
  /** Full moon inside the lunation. */
  fullMoon: number;
  /** Sidereal Sun sign (0 = Mesha) at start and end. */
  sunSignStart: number;
  sunSignEnd: number;
  /** Amanta month index, 0 = Chaitra (named by the sankranti the lunation contains). */
  monthIndex: number;
  /** No sankranti inside the lunation: Adhik (extra) month carrying the next month's name. */
  adhik: boolean;
  /** Two sankrantis inside one lunation (very rare): the following month name is skipped. */
  kshaya: boolean;
}

const CALENDAR_AYANAMSA: AyanamsaType = 'lahiri';

// New/full moon instants are rounded to the second so the same event found from different starting points
// compares equal (astronomy-engine's phase search converges to ~1 s).
function newMoonAfter(utcMs: number): number {
  const t = SearchMoonPhase(0, new Date(utcMs), 40);
  if (!t) throw new Error('newMoonAfter: search failed');
  return Math.round(t.date.getTime() / 1000) * 1000;
}

function fullMoonAfter(utcMs: number): number {
  const t = SearchMoonPhase(180, new Date(utcMs), 40);
  if (!t) throw new Error('fullMoonAfter: search failed');
  return Math.round(t.date.getTime() / 1000) * 1000;
}

function lunationFrom(start: number): Lunation {
  const end = newMoonAfter(start + DAY_MS);
  const fullMoon = fullMoonAfter(start + DAY_MS);
  const sunSignStart = sunSignIndexAt(start, CALENDAR_AYANAMSA);
  const sunSignEnd = sunSignIndexAt(end, CALENDAR_AYANAMSA);
  const diff = (sunSignEnd - sunSignStart + 12) % 12;
  return {
    start,
    end,
    fullMoon,
    sunSignStart,
    sunSignEnd,
    monthIndex: (sunSignStart + 1) % 12,
    adhik: diff === 0,
    kshaya: diff === 2,
  };
}

/** The lunation (Amanta month) containing `utcMs`: start <= utcMs < end. */
export function lunationAt(utcMs: number): Lunation {
  let start = newMoonAfter(utcMs - 31 * DAY_MS);
  // The 31-day window can hold two new moons; take the latest one not after utcMs.
  for (;;) {
    const next = newMoonAfter(start + DAY_MS);
    if (next > utcMs) break;
    start = next;
  }
  return lunationFrom(start);
}

export function nextLunation(l: Lunation): Lunation {
  return lunationFrom(l.end);
}

export function prevLunation(l: Lunation): Lunation {
  return lunationFrom(newMoonAfter(l.start - 31 * DAY_MS));
}

/** Every lunation overlapping [fromMs, toMs]. */
export function lunationsBetween(fromMs: number, toMs: number): Lunation[] {
  const out: Lunation[] = [];
  let l = lunationAt(fromMs);
  while (l.start <= toMs) {
    out.push(l);
    l = nextLunation(l);
  }
  return out;
}

export type Paksha = 'shukla' | 'krishna';
export type Tradition = 'purnimanta' | 'amanta';

export interface LunarMonth {
  /** 0 = Chaitra. */
  index: number;
  adhik: boolean;
}

export function pakshaOfTithi(tithiIndex: number): Paksha {
  return tithiIndex < 15 ? 'shukla' : 'krishna';
}

/**
 * Purnimanta month for a day inside an Amanta lunation (convention used by Drik Panchang and the North Indian
 * almanacs): Shukla paksha days keep the Amanta name; Krishna paksha days belong to the NEXT month name,
 * except inside an Adhik lunation, whose Krishna paksha stays "Adhik <name>" (the Adhik month is counted
 * new moon to new moon in both systems, so the preceding Krishna paksha belongs to the nija month).
 */
export function purnimantaMonth(amanta: LunarMonth, paksha: Paksha): LunarMonth {
  if (paksha === 'shukla' || amanta.adhik) return amanta;
  return { index: (amanta.index + 1) % 12, adhik: false };
}

/** Converts a month name given in one naming system to the Amanta lunation that holds the paksha. */
export function amantaMonthOf(month: number, paksha: Paksha, system: Tradition): number {
  if (system === 'amanta' || paksha === 'shukla') return month;
  return (month + 11) % 12;
}

export interface Samvat {
  vikram: number;
  shaka: number;
  /** Gregorian year in which the lunar year began (Chaitra Shukla Pratipada). */
  lunarYearStart: number;
}

/**
 * Vikram (Chaitradi, North) and Shaka years for a day whose Amanta month is `monthIndex` and whose local
 * Gregorian year/month are given. The lunar year begins at Chaitra Shukla Pratipada; Pausha, Magha and
 * Phalguna days in January-April belong to the lunar year that began the previous Gregorian year.
 * Convention: when Chaitra is Adhik, the year number changes at the first (Adhik) Chaitra.
 */
export function samvatFor(monthIndex: number, localYear: number, localMonth: number): Samvat {
  const lunarYearStart = monthIndex >= 9 && localMonth <= 4 ? localYear - 1 : localYear;
  return { vikram: lunarYearStart + 57, shaka: lunarYearStart - 78, lunarYearStart };
}

// ---------------------------------------------------------------- lagna helper

/** First instant after `fromMs` at which the sidereal ascendant leaves its current sign (step 2 min, bisect). */
export function lagnaSignEnd(fromMs: number, geo: GeoPoint, ay: AyanamsaType = 'lahiri'): number {
  const observer = toObserver(geo);
  const lagna = (ms: number): number => getUdayaLagna(new Date(ms), observer, ayanamsaAt(ms, ay));
  const sign = Math.floor(lagna(fromMs) / 30);
  const boundary = ((sign + 1) * 30) % 360;
  return nextCrossing(lagna, boundary, fromMs, 2 * MIN_MS, 200);
}
