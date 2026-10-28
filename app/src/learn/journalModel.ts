// Journal month model (F34, design.md 10.7): the 7-column grid of a civil month in the profile's zone with, per day, the
// stored mood and - from the engine - the transit Moon's house from the natal Moon (Moon sign at that day's sunrise, local
// noon on polar days) and whether a dasha period changes that day (changesBetween on the Vimshottari tree). Pure and
// synchronous; the screen only formats. Nothing here grades a day: the overlay is "for reflection, not proof".
import { addDays, DAY_MS, localDateOf, localMidnight, siderealMoon, sunriseOn, type ChartData, type DashaChange } from '@shubhvela/engine';
import type { JournalEntry, Mood } from '../db/journal';
import { dashaChangesIn, moonHouseOf } from './placeholders';

export interface JournalCell {
  /** YYYY-MM-DD */
  day: string;
  /** 1-31 */
  date: number;
  mood: Mood | null;
  note: string | null;
  /** Transit Moon house from the natal Moon (1-12); null without a chart. */
  moonHouse: number | null;
  /** Dasha changes falling on this civil day (maha/antar; pratyantar when allowed). */
  dashaChanges: DashaChange[];
  isToday: boolean;
}

export interface JournalMonthModel {
  /** yyyy-mm */
  yearMonth: string;
  year: number;
  /** 1-12 */
  month: number;
  /** Leading empty slots so the 1st sits under its weekday (0 = Sunday first). */
  leading: number;
  cells: JournalCell[];
  /** Days that carry at least one entry. */
  entryCount: number;
}

export function yearMonthOf(day: string): string {
  return day.slice(0, 7);
}

export function shiftYearMonth(yearMonth: string, delta: number): string {
  const [y, m] = yearMonth.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  const mm = d.getUTCMonth() + 1;
  return `${d.getUTCFullYear()}-${mm < 10 ? `0${mm}` : mm}`;
}

export function daysInMonth(year: number, month1: number): number {
  return new Date(Date.UTC(year, month1, 0)).getUTCDate();
}

/** Weekday (0 = Sunday) of a civil date, from the Gregorian calendar alone. */
export function weekdayOfDate(day: string): number {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export interface MonthModelOptions {
  chart: ChartData | null;
  geo: { lat: number; lon: number };
  tz: string;
  entries: readonly JournalEntry[];
  nowMs: number;
  /** F14: pratyantar changes are Pro-only; the free grid marks maha and antar changes. */
  withPratyantar: boolean;
}

/** Transit Moon house for a civil day: the Moon's sidereal sign at that day's sunrise (local noon when the Sun does not rise). */
export function moonHouseOnDay(chart: ChartData, day: string, geo: { lat: number; lon: number }, tz: string): number {
  const sunrise = sunriseOn(day, tz, geo);
  const at = sunrise ?? localMidnight(day, tz) + DAY_MS / 2;
  const sign = Math.floor(siderealMoon(at, chart.meta.ayanamsa) / 30) + 1;
  return moonHouseOf(chart, sign);
}

export function journalMonth(yearMonth: string, opts: MonthModelOptions): JournalMonthModel {
  const [year, month] = yearMonth.split('-').map(Number);
  const n = daysInMonth(year, month);
  const first = `${yearMonth}-01`;
  const today = localDateOf(opts.nowMs, opts.tz);
  const byDay = new Map(opts.entries.map((e) => [e.day, e]));
  const changes = opts.chart ? dashaChangesIn(opts.chart, localMidnight(first, opts.tz), localMidnight(addDays(first, n), opts.tz), opts.withPratyantar) : [];
  const changesByDay = new Map<string, DashaChange[]>();
  for (const c of changes) {
    const d = localDateOf(c.at, opts.tz);
    changesByDay.set(d, [...(changesByDay.get(d) ?? []), c]);
  }
  const cells: JournalCell[] = [];
  for (let i = 0; i < n; i++) {
    const day = addDays(first, i);
    const e = byDay.get(day);
    cells.push({
      day,
      date: i + 1,
      mood: e?.mood ?? null,
      note: e?.note ?? null,
      moonHouse: opts.chart ? moonHouseOnDay(opts.chart, day, opts.geo, opts.tz) : null,
      dashaChanges: changesByDay.get(day) ?? [],
      isToday: day === today,
    });
  }
  return { yearMonth, year, month, leading: weekdayOfDate(first), cells, entryCount: cells.filter((c) => c.mood || c.note).length };
}
