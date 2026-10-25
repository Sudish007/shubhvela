// Family tab model (plan A12): the next tithi birthday per profile (F20), the next barsi + Pitru Paksha day per
// ancestor (F21), the next occurrence of every ENABLED vrat family (F22) and the Family Today rows (F24), all computed
// by the engine at the observer's place for one instant. Pure and synchronous; the screen calls it from an effect.
// Display-name rule (N5): the event title is the profile/ancestor name, the relationship goes into the kind label.
import {
  type BarsiDate,
  type ChartData,
  type FamilyTodayRow,
  type GeoPoint,
  type KeyTime,
  type Tradition,
  type VratFamily,
  type VratOccurrence,
  DAY_MS,
  barsiDates,
  familyToday,
  janmaTithiFromBirth,
  localDateOf,
  tithiEventDates,
  vratOccurrences,
} from '@shubhvela/engine';
import type { Ancestor } from '../db/ancestors';
import { seriesKey, type SeriesKind } from '../db/eventSeries';
import type { Profile } from '../db/profiles';
import { chartFor } from '../engine-bridge/charts';
import { vedicDayFor } from '../today/model';

export interface FamilyEvent {
  kind: SeriesKind;
  refId: string;
  /** eventSeries.seriesKey(kind, refId); also the React key. */
  key: string;
  /** Next civil date of the event. */
  date: string;
  /** Profile / ancestor / vrat-family subject. */
  profile?: Profile;
  ancestor?: Ancestor;
  vratFamily?: VratFamily;
  /** Engine facts behind the card (formatted by the component). */
  tithi?: { month: number; adhik: boolean; paksha: 'shukla' | 'krishna'; tithi: number; system: Tradition };
  convention: string;
  /** Years since birth / passing when known. */
  nth?: number;
  /** F21: the Pitru Paksha day of the same year for an ancestor (may be before `date`). */
  pitruPakshaDay?: string | null;
  /** F22: the vrat occurrence with its key time. */
  vrat?: VratOccurrence;
  keyTime?: KeyTime;
  ruleId: string;
}

export interface FamilyModel {
  day: string;
  nowMs: number;
  today: FamilyTodayRow[];
  events: FamilyEvent[];
}

export interface FamilyObserver {
  geo: GeoPoint;
  tz: string;
}

/** Next janma-tithi recurrence on or after `today` for a profile (F20). Null when the chart cannot be computed. */
export function nextTithiBirthday(p: Profile, today: string, obs: FamilyObserver, chart?: ChartData): FamilyEvent | null {
  let c: ChartData;
  try {
    c = chart ?? chartFor(p);
  } catch {
    return null;
  }
  const janma = janmaTithiFromBirth(c);
  const y0 = Number(today.slice(0, 4));
  const hit = tithiEventDates(janma.amanta, y0, y0 + 1, 'amanta', obs.geo, obs.tz).find((d) => d.date >= today);
  if (!hit) return null;
  const month = p.tradition === 'amanta' ? hit.month.amanta : hit.month.purnimanta;
  const birthYear = Number(localDateOf(c.meta.utcMs, c.meta.tz).slice(0, 4));
  return {
    kind: 'tithi_birthday',
    refId: String(p.id),
    key: seriesKey('tithi_birthday', String(p.id)),
    date: hit.date,
    profile: p,
    tithi: { month: month.index, adhik: month.adhik, paksha: janma.paksha, tithi: janma.amanta.tithi, system: p.tradition },
    convention: hit.convention,
    nth: hit.year - birthYear,
    ruleId: 'janma-tithi',
  };
}

/** Next barsi on or after `today` for an ancestor, with that year's Pitru Paksha day (F21). */
export function nextBarsi(a: Ancestor, today: string, tradition: Tradition, obs: FamilyObserver): FamilyEvent | null {
  const y0 = Number(today.slice(0, 4));
  const dates: BarsiDate[] = barsiDates({ deathMonth: a.deathMonth, paksha: a.paksha, tithi: a.tithi, year: a.year ?? undefined }, y0, y0 + 1, tradition, obs.geo, obs.tz);
  // The series' next fire is the earlier of the next barsi and the next Pitru Paksha day; the card leads with the barsi.
  const hit = dates.find((d) => d.date >= today || (d.pitruPakshaDay && d.pitruPakshaDay.date >= today));
  if (!hit) return null;
  const month = tradition === 'amanta' ? hit.month.amanta : hit.month.purnimanta;
  const barsiDate = hit.date >= today ? hit.date : dates.find((d) => d.date >= today)?.date ?? hit.date;
  return {
    kind: 'barsi',
    refId: String(a.id),
    key: seriesKey('barsi', String(a.id)),
    date: barsiDate,
    ancestor: a,
    tithi: { month: month.index, adhik: month.adhik, paksha: a.paksha, tithi: a.tithi, system: tradition },
    convention: hit.convention,
    nth: hit.nth,
    pitruPakshaDay: hit.pitruPakshaDay?.date ?? null,
    ruleId: 'barsi',
  };
}

/** Next occurrence of a vrat family whose key time has not passed: 60 days first, then a full year (yearly vrats). */
export function nextVratOccurrence(family: VratFamily, nowMs: number, obs: FamilyObserver): VratOccurrence | null {
  const today = localDateOf(nowMs, obs.tz);
  for (const days of [60, 400]) {
    const hit = vratOccurrences(family, nowMs - DAY_MS, nowMs + days * DAY_MS, obs.geo, obs.tz).find((o) => o.date > today || (o.date === today && (o.keyTime.end ?? o.keyTime.start) >= nowMs));
    if (hit) return hit;
  }
  return null;
}

export function vratEvent(family: VratFamily, occ: VratOccurrence): FamilyEvent {
  return { kind: 'vrat_family', refId: family, key: seriesKey('vrat_family', family), date: occ.date, vratFamily: family, vrat: occ, keyTime: occ.keyTime, convention: occ.convention, ruleId: occ.ruleId };
}

/** Vrat occurrences of the enabled families that fall on `day` (Today's F22 card). */
export function vratsOnDay(families: readonly VratFamily[], day: string, nowMs: number, obs: FamilyObserver): VratOccurrence[] {
  const out: VratOccurrence[] = [];
  for (const f of families) {
    for (const o of vratOccurrences(f, nowMs - 2 * DAY_MS, nowMs + 2 * DAY_MS, obs.geo, obs.tz)) if (o.date === day) out.push(o);
  }
  return out;
}

export interface ComputeFamilyOptions {
  profiles: readonly Profile[];
  ancestors: readonly Ancestor[];
  enabledVrats: readonly VratFamily[];
  /** Month-naming tradition the ancestors were entered in (the self profile's). */
  tradition: Tradition;
  observer: FamilyObserver;
  nowMs: number;
}

/** The whole Family model for one instant; events sorted by next date. */
export function computeFamily(o: ComputeFamilyOptions): FamilyModel {
  const day = vedicDayFor(o.nowMs, o.observer.geo, o.observer.tz);
  const today = localDateOf(o.nowMs, o.observer.tz);
  const charts = new Map<number, ChartData>();
  for (const p of o.profiles) {
    try {
      charts.set(p.id, chartFor(p));
    } catch (e) {
      if (__DEV__) console.warn('chart failed', p.id, e);
    }
  }
  const todayRows = familyToday(
    o.profiles.filter((p) => charts.has(p.id)).map((p) => ({ id: String(p.id), name: p.name ?? undefined, chart: charts.get(p.id)!, tradition: p.tradition })),
    day,
    o.observer.geo,
    o.observer.tz,
  );
  const events: FamilyEvent[] = [];
  for (const p of o.profiles) {
    const c = charts.get(p.id);
    if (!c) continue;
    const e = nextTithiBirthday(p, today, o.observer, c);
    if (e) events.push(e);
  }
  for (const a of o.ancestors) {
    const e = nextBarsi(a, today, o.tradition, o.observer);
    if (e) events.push(e);
  }
  for (const f of o.enabledVrats) {
    const occ = nextVratOccurrence(f, o.nowMs, o.observer);
    if (occ) events.push(vratEvent(f, occ));
  }
  events.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.key < b.key ? -1 : 1));
  return { day, nowMs: o.nowMs, today: todayRows, events };
}
