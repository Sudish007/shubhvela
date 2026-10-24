// Tithi-event recurrence: janma tithi (F20), shraddha/barsi (F21) and Pitru Paksha (plan A03).
// Conventions are documented in observance.ts; this file adds:
// - janma tithi: the tithi running at the birth instant, in the Amanta lunation of birth; yearly recurrence on
//   the udaya day of that tithi in the nija month of the same name (Adhik birth month -> nija month).
// - barsi: the death tithi observed on the day it prevails at aparahna (shraddha convention); the Pitru Paksha
//   day is the day of Pitru Paksha whose aparahna tithi has the same number (Purnima -> Purnima Shraddha,
//   Amavasya -> Sarvapitri Amavasya).
// - Pitru Paksha: Bhadrapada Purnima (Purnima Shraddha) to Ashwin Amavasya (Purnimanta naming; Amanta
//   Bhadrapada Amavasya), one day per aparahna tithi.
import { type ChartData } from '../kundli/index';
import {
  DAY_MS,
  type GeoPoint,
  type LunarMonth,
  type Lunation,
  type Paksha,
  type Tradition,
  addDays,
  amantaMonthOf,
  localDateOf,
  localMidnight,
  lunationAt,
  lunationsBetween,
  pakshaOfTithi,
  purnimantaMonth,
  resolveZone,
  tithiIndexAt,
} from '../panchang/astro';
import { type Observance, type Timing, dayRef, observanceDay, timingPoint, tithiIndexOf, tithiSpanIn } from './observance';

export interface TithiRule {
  /** Lunar month, 0 = Chaitra, in the naming system given by `tradition` when the dates are requested. */
  month: number;
  paksha: Paksha;
  /** 1-15 (15 = Purnima in shukla, Amavasya in krishna). */
  tithi: number;
  /** The original event fell in an Adhik month (display only; recurrence uses the nija month). */
  adhik?: boolean;
}

export interface TithiEventDate extends Observance {
  /** Gregorian year of `date`. */
  year: number;
  tithiIndex: number;
  month: { amanta: LunarMonth; purnimanta: LunarMonth };
  lunation: { start: number; end: number };
}

export type TithiEventConvention = Extract<Timing, 'udaya' | 'aparahna' | 'begin'>;

function lunationsForYears(fromYear: number, toYear: number, zone: string): Lunation[] {
  const from = localMidnight(`${fromYear}-01-01`, zone) - 40 * DAY_MS;
  const to = localMidnight(`${toYear}-12-31`, zone) + 40 * DAY_MS;
  return lunationsBetween(from, to);
}

/**
 * Civil dates on which a lunar-calendar rule recurs between two Gregorian years (inclusive), in the given
 * month-naming tradition. Adhik months are skipped (nija month used); kshaya tithis fall on their begin day.
 */
export function tithiEventDates(
  rule: TithiRule,
  fromYear: number,
  toYear: number,
  tradition: Tradition,
  geo: GeoPoint,
  tz: string,
  convention: TithiEventConvention = 'udaya',
): TithiEventDate[] {
  const zone = resolveZone(tz);
  const amanta = amantaMonthOf(rule.month, rule.paksha, tradition);
  const index = tithiIndexOf(rule.paksha, rule.tithi);
  const out: TithiEventDate[] = [];
  for (const l of lunationsForYears(fromYear, toYear, zone)) {
    if (l.monthIndex !== amanta || l.adhik) continue;
    const span = tithiSpanIn(l, index);
    const obs = observanceDay(span, convention, zone, geo);
    const year = Number(obs.date.slice(0, 4));
    if (year < fromYear || year > toYear) continue;
    const am: LunarMonth = { index: l.monthIndex, adhik: false };
    out.push({ ...obs, year, tithiIndex: index, month: { amanta: am, purnimanta: purnimantaMonth(am, rule.paksha) }, lunation: { start: l.start, end: l.end } });
  }
  return out;
}

export interface JanmaTithi {
  /** Rule in Amanta naming (use tradition 'amanta' with tithiEventDates). */
  amanta: TithiRule;
  /** The same event in Purnimanta naming. */
  purnimanta: TithiRule;
  tithiIndex: number;
  paksha: Paksha;
  /** The birth fell in an Adhik month: recurrence uses the nija month of the same name. */
  adhik: boolean;
  birthTithi: { start: number; end: number };
}

/** The birth tithi and lunar month of a chart (tithi at the birth instant, Amanta lunation of birth). */
export function janmaTithiFromBirth(chart: ChartData): JanmaTithi {
  const t = chart.meta.utcMs;
  const l = lunationAt(t);
  const index = tithiIndexAt(t);
  const paksha = pakshaOfTithi(index);
  const span = tithiSpanIn(l, index);
  const am: LunarMonth = { index: l.monthIndex, adhik: l.adhik };
  const pm = purnimantaMonth(am, paksha);
  const tithi = (index % 15) + 1;
  return {
    amanta: { month: am.index, paksha, tithi, adhik: l.adhik },
    purnimanta: { month: pm.index, paksha, tithi, adhik: pm.adhik },
    tithiIndex: index,
    paksha,
    adhik: l.adhik,
    birthTithi: { start: span.start, end: span.end },
  };
}

export interface PitruPakshaDay {
  date: string;
  /** 0-29 tithi prevailing at aparahna. */
  tithiIndex: number;
  /** 1-15 within the paksha; 15 on the Purnima and Amavasya days. */
  tithi: number;
  paksha: Paksha;
  /** Shraddha name key: purnima-shraddha | pratipada-shraddha ... | sarvapitri-amavasya. */
  key: string;
  aparahna: { start: number; end: number };
}

export interface PitruPakshaReport {
  year: number;
  start: string;
  end: string;
  days: PitruPakshaDay[];
  lunation: { start: number; end: number };
}

const SHRADDHA_KEYS = ['pratipada', 'dwitiya', 'tritiya', 'chaturthi', 'panchami', 'shashthi', 'saptami', 'ashtami', 'navami', 'dashami', 'ekadashi', 'dwadashi', 'trayodashi', 'chaturdashi'];

/** Pitru Paksha of a Gregorian year (Bhadrapada Purnima -> Amavasya, Purnimanta naming), one row per shraddha day. */
export function pitruPaksha(year: number, geo: GeoPoint, tz: string): PitruPakshaReport {
  const zone = resolveZone(tz);
  const candidates = lunationsForYears(year, year, zone).filter((l) => l.monthIndex === 5 && !l.adhik);
  const l = candidates.find((c) => localDateOf(c.fullMoon, zone).startsWith(String(year))) ?? candidates[0];
  if (!l) throw new Error(`No Bhadrapada lunation found for ${year}`);
  const purnima = tithiSpanIn(l, 14);
  const amavasya = tithiSpanIn(l, 29);
  const first = observanceDay(purnima, 'aparahna', zone, geo).date;
  const last = observanceDay(amavasya, 'aparahna', zone, geo).date;
  const days: PitruPakshaDay[] = [];
  for (let d = first; d <= last; d = addDays(d, 1)) {
    const ref = dayRef(d, zone, geo);
    if (!ref) continue;
    const p = timingPoint(ref, 'aparahna', geo);
    if (!p || !p.window) continue;
    const idx = tithiIndexAt(p.at);
    const paksha = pakshaOfTithi(idx);
    const tithi = (idx % 15) + 1;
    const key = idx === 14 ? 'purnima-shraddha' : idx === 29 ? 'sarvapitri-amavasya' : `${SHRADDHA_KEYS[idx % 15]}-shraddha`;
    days.push({ date: d, tithiIndex: idx, tithi, paksha, key, aparahna: p.window });
    if (days.length > 20) break;
  }
  return { year, start: first, end: last, days, lunation: { start: l.start, end: l.end } };
}

export interface AncestorRecord {
  /** Lunar month of death, 0 = Chaitra, in the tradition passed to barsiDates. */
  deathMonth: number;
  paksha: Paksha;
  /** 1-15. */
  tithi: number;
  /** Gregorian year of death when known (for the "Nth barsi" count). */
  year?: number;
}

export interface BarsiDate extends TithiEventDate {
  /** Years since death when `year` is known. */
  nth?: number;
  /** The Pitru Paksha day of the same year that carries this tithi (aparahna rule). */
  pitruPakshaDay: PitruPakshaDay | null;
}

/** Yearly barsi (death-tithi shraddha, aparahna rule) plus the matching Pitru Paksha day for each year. */
export function barsiDates(ancestor: AncestorRecord, fromYear: number, toYear: number, tradition: Tradition, geo: GeoPoint, tz: string): BarsiDate[] {
  const rule: TithiRule = { month: ancestor.deathMonth, paksha: ancestor.paksha, tithi: ancestor.tithi };
  const dates = tithiEventDates(rule, fromYear, toYear, tradition, geo, tz, 'aparahna');
  const pp = new Map<number, PitruPakshaReport>();
  return dates.map((d) => {
    let report = pp.get(d.year);
    if (!report) {
      report = pitruPaksha(d.year, geo, tz);
      pp.set(d.year, report);
    }
    const wanted = tithiIndexOf(ancestor.paksha, ancestor.tithi) % 15; // shraddha tithis are matched by number inside the krishna paksha
    const day =
      ancestor.paksha === 'shukla' && ancestor.tithi === 15
        ? report.days.find((x) => x.tithiIndex === 14) ?? null
        : report.days.find((x) => x.tithiIndex === 15 + wanted) ?? null;
    return { ...d, nth: ancestor.year ? d.year - ancestor.year : undefined, pitruPakshaDay: day };
  });
}

export type { Tradition, Paksha, LunarMonth };
