// Today model (plan A10): everything the Today screen shows, computed by the engine for one instant at one place.
// Pure and synchronous so the hook (useToday) only decides WHEN to recompute and the components only format.
// engine.goodHours is the only verdict producer; nothing here classifies a segment (design.md 11 invariants).
import {
  type ChartData,
  type DailyRule,
  type GoodHours,
  type PanchangDay,
  type Tradition,
  type UpcomingItem,
  dailyNote,
  goodHours,
  janmaTithiFromBirth,
  localDateOf,
  panchang,
  sunriseOn,
  tithiEventDates,
  upcoming,
  addDays,
} from '@shubhvela/engine';
import type { Profile } from '../db/profiles';
import type { LocationMode } from '../db/settings';
import { chartFor } from '../engine-bridge/charts';

/** Where Today is computed: the self profile's place or the device fix. */
export interface Observer {
  lat: number;
  lon: number;
  tz: string;
  /** Display name: the profile's place, or null for the device fix ("Your location"). */
  placeName: string | null;
  source: LocationMode;
}

export interface TithiTodayRow {
  profileId: number;
  name: string | null;
  ruleId: 'janma-tithi';
  params: Record<string, string | number | boolean | null>;
}

export interface TodayModel {
  /** Civil date of the Vedic day being shown (sunrise -> next sunrise that contains `nowMs`). */
  day: string;
  nowMs: number;
  observer: Observer;
  profile: Profile;
  chart: ChartData;
  panchang: PanchangDay;
  goodHours: GoodHours;
  note: DailyRule[];
  upcoming: UpcomingItem[];
  tithiToday: TithiTodayRow[];
}

export function observerFromProfile(p: Profile): Observer {
  return { lat: p.lat, lon: p.lon, tz: p.tz, placeName: p.placeName, source: 'city' };
}

/**
 * The Vedic day holding `nowMs`: the civil date in the zone, or the previous date before today's sunrise (the band
 * runs sunrise -> next sunrise, design.md 10.2). Polar days without a sunrise fall back to the civil date.
 */
export function vedicDayFor(nowMs: number, geo: { lat: number; lon: number }, tz: string): string {
  const civil = localDateOf(nowMs, tz);
  const sunrise = sunriseOn(civil, tz, geo);
  if (sunrise !== null && nowMs < sunrise) return addDays(civil, -1);
  return civil;
}

/** Next instant at which the band changes: the next span boundary after now, else the next sunrise (new Vedic day). */
export function nextBoundaryAfter(gh: GoodHours, nowMs: number): number | null {
  if (!gh.ticks) return null;
  const starts = gh.spans.map((s) => s.end).filter((e) => e > nowMs);
  if (starts.length) return Math.min(...starts);
  return gh.ticks.nextSunrise > nowMs ? gh.ticks.nextSunrise : null;
}

/** Profiles whose janma tithi recurs on `day` at this place (F20 "Today is <name>'s janma tithi"). */
export function tithiTodayRows(profiles: readonly Profile[], day: string, geo: { lat: number; lon: number }, tz: string): TithiTodayRow[] {
  const year = Number(day.slice(0, 4));
  const rows: TithiTodayRow[] = [];
  for (const p of profiles) {
    let chart: ChartData;
    try {
      chart = chartFor(p);
    } catch {
      continue;
    }
    const janma = janmaTithiFromBirth(chart);
    const hit = tithiEventDates(janma.amanta, year, year, 'amanta', geo, tz).find((d) => d.date === day);
    if (!hit) continue;
    const tradition: Tradition = p.tradition;
    const month = tradition === 'amanta' ? hit.month.amanta : hit.month.purnimanta;
    rows.push({
      profileId: p.id,
      name: p.name,
      ruleId: 'janma-tithi',
      params: { month: month.index, adhik: month.adhik, paksha: janma.paksha, tithi: janma.amanta.tithi, system: tradition, convention: hit.convention, date: hit.date },
    });
  }
  return rows;
}

export interface ComputeOptions {
  /** Pre-computed chart of the self profile (avoids a cache lookup). */
  chart?: ChartData;
  /** Other profiles for the janma-tithi row (default: just the self profile). */
  profiles?: readonly Profile[];
}

/** The whole Today model for one instant. ~0.3 s on a mid-range phone (dailyNote dominates); call from an effect. */
export function computeToday(self: Profile, observer: Observer, nowMs: number, opts: ComputeOptions = {}): TodayModel {
  const geo = { lat: observer.lat, lon: observer.lon };
  const tz = observer.tz;
  const chart = opts.chart ?? chartFor(self);
  const day = vedicDayFor(nowMs, geo, tz);
  const p = panchang(day, geo, tz, { ayanamsa: chart.meta.ayanamsa });
  const gh = goodHours(day, geo, tz, { ayanamsa: chart.meta.ayanamsa });
  const note = dailyNote(chart, day, geo, tz, { panchang: p });
  const up = upcoming({ id: String(self.id), name: self.name ?? undefined, chart, tradition: self.tradition }, [], nowMs, geo, tz);
  const tithiToday = tithiTodayRows(opts.profiles ?? [self], day, geo, tz);
  return { day, nowMs, observer, profile: self, chart, panchang: p, goodHours: gh, note, upcoming: up, tithiToday };
}
