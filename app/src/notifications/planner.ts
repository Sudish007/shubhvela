// Reminder planner (design.md 10.4 F25, plan A12, N12): PURE. Given the enabled series (tithi birthdays, ancestors,
// vrat families), the per-kind times and the clock, it computes every event occurrence in the next 60 days with the
// engine and turns each into two local notifications: the evening before (default 19:00) and the morning of (default
// 07:00), in the profile's zone. The result is sorted nearest first and capped at MAX_SCHEDULED (300) so Android's
// per-app alarm limit is never reached. No series enabled -> an empty plan (quiet by default). The opt-in daily-note
// notification adds one morning entry per day when the user switched it on. schedule.ts hands the plan to the OS.
import {
  type ChartData,
  type GeoPoint,
  type KeyTime,
  type Paksha,
  type Tradition,
  type VratFamily,
  DAY_MS,
  addDays,
  barsiDates,
  janmaTithiFromBirth,
  localDateOf,
  localToUtc,
  tithiEventDates,
  vratOccurrences,
} from '@shubhvela/engine';
import type { SeriesKind } from '../db/eventSeries';
import { seriesKey } from '../db/eventSeries';
import type { ReminderTimes } from '../db/reminderSettings';
import { makeT, type Lang, type TFn } from '../i18n';
import { tithiText, vratKeyTimeText, vratName } from '../family/format';
import { fmtCivilDate } from '../today/format';

/** Hard cap on notifications handed to the OS at once (design-review N12). */
export const MAX_SCHEDULED = 300;
/** Planning horizon in days (design.md F25). */
export const HORIZON_DAYS = 60;

export interface PlannerProfile {
  id: number;
  name: string | null;
  /** Relationship label already translated (N5: the kind label carries it; the display name is the profile name). */
  relationLabel: string;
  chart: ChartData;
  tradition: Tradition;
}

export interface PlannerAncestor {
  id: number;
  name: string;
  deathMonth: number;
  paksha: Paksha;
  tithi: number;
  year: number | null;
}

export interface PlannerInput {
  nowMs: number;
  geo: GeoPoint;
  tz: string;
  lang: Lang;
  /** Month-naming tradition the ancestor months were entered in. */
  tradition: Tradition;
  /** Profiles whose tithi_birthday series is enabled. */
  profiles: readonly PlannerProfile[];
  /** Ancestors whose barsi series is enabled. */
  ancestors: readonly PlannerAncestor[];
  /** Enabled vrat families. */
  vratFamilies: readonly VratFamily[];
  times: ReminderTimes;
  dailyNote?: { enabled: boolean; time: string };
  horizonDays?: number;
  cap?: number;
}

export type OccurrenceKind = SeriesKind;

export interface Occurrence {
  kind: OccurrenceKind;
  refId: string;
  /** eventSeries.seriesKey(kind, refId). */
  key: string;
  /** Civil date of the event in `tz`. */
  date: string;
  /** Who / what: profile name, ancestor name, vrat name. */
  name: string;
  /** Second line for the body: tithi text, key time ... */
  detail: string;
  /** Barsi series also fire for the Pitru Paksha day. */
  pitruPaksha?: boolean;
  keyTime?: KeyTime;
}

export type Slot = 'evening' | 'morning' | 'daily';

export interface PlannedNotification {
  /** Series key, or 'daily_note'. */
  key: string;
  kind: OccurrenceKind | 'daily_note';
  refId: string | null;
  /** Civil date of the event (not of the notification). */
  date: string;
  slot: Slot;
  fireAtMs: number;
  title: string;
  body: string;
}

function wallToUtc(date: string, hhmm: string, tz: string): number {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = hhmm.split(':').map(Number);
  return localToUtc(tz, { y, m, d, hh, mm }).utcMs;
}

function yearOf(date: string): number {
  return Number(date.slice(0, 4));
}

/** Every event occurrence of the enabled series inside [today, today + horizon], sorted by date. */
export function planOccurrences(input: PlannerInput): Occurrence[] {
  const t = makeT(input.lang);
  const horizon = input.horizonDays ?? HORIZON_DAYS;
  const today = localDateOf(input.nowMs, input.tz);
  const last = addDays(today, horizon);
  const y0 = yearOf(today);
  const y1 = yearOf(last);
  const inRange = (date: string) => date >= today && date <= last;
  const out: Occurrence[] = [];

  for (const p of input.profiles) {
    const janma = janmaTithiFromBirth(p.chart);
    for (const d of tithiEventDates(janma.amanta, y0, y1, 'amanta', input.geo, input.tz)) {
      if (!inRange(d.date)) continue;
      const month = p.tradition === 'amanta' ? d.month.amanta : d.month.purnimanta;
      out.push({
        kind: 'tithi_birthday',
        refId: String(p.id),
        key: seriesKey('tithi_birthday', String(p.id)),
        date: d.date,
        name: p.name ?? p.relationLabel,
        detail: tithiText(t, input.lang, month.index, month.adhik, janma.paksha, janma.amanta.tithi),
      });
    }
  }

  for (const a of input.ancestors) {
    const record = { deathMonth: a.deathMonth, paksha: a.paksha, tithi: a.tithi, year: a.year ?? undefined };
    for (const d of barsiDates(record, y0, y1, input.tradition, input.geo, input.tz)) {
      const key = seriesKey('barsi', String(a.id));
      if (inRange(d.date)) {
        const month = input.tradition === 'amanta' ? d.month.amanta : d.month.purnimanta;
        out.push({ kind: 'barsi', refId: String(a.id), key, date: d.date, name: a.name, detail: tithiText(t, input.lang, month.index, month.adhik, a.paksha, a.tithi) });
      }
      if (d.pitruPakshaDay && inRange(d.pitruPakshaDay.date) && d.pitruPakshaDay.date !== d.date) {
        out.push({ kind: 'barsi', refId: String(a.id), key, date: d.pitruPakshaDay.date, name: a.name, detail: t('events.pitruPaksha'), pitruPaksha: true });
      }
    }
  }

  const fromMs = input.nowMs - DAY_MS;
  const toMs = input.nowMs + (horizon + 1) * DAY_MS;
  for (const family of input.vratFamilies) {
    for (const o of vratOccurrences(family, fromMs, toMs, input.geo, input.tz)) {
      if (!inRange(o.date)) continue;
      out.push({
        kind: 'vrat_family',
        refId: family,
        key: seriesKey('vrat_family', family),
        date: o.date,
        name: vratName(t, o.name),
        detail: vratKeyTimeText(t, o.keyTime, input.tz),
        keyTime: o.keyTime,
      });
    }
  }

  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}

const TITLE_KEY: Record<OccurrenceKind, string> = { tithi_birthday: 'reminders.kind.tithiBirthday', barsi: 'reminders.kind.barsi', vrat_family: 'reminders.kind.vrat' };

/** Notification text for an occurrence in a slot (exported for tests and the Settings "Scheduled" list). */
export function notificationText(o: Occurrence, slot: Exclude<Slot, 'daily'>, t: TFn, lang: Lang): { title: string; body: string } {
  const title = o.pitruPaksha ? t('events.pitruPaksha') : t(TITLE_KEY[o.kind]);
  const date = fmtCivilDate(o.date, lang);
  let body: string;
  switch (o.kind) {
    case 'tithi_birthday':
      body = slot === 'evening' ? t('reminders.body.tithiTomorrow', { name: o.name, date }) : t('reminders.body.tithiToday', { name: o.name });
      break;
    case 'barsi':
      body = o.pitruPaksha
        ? slot === 'evening'
          ? t('reminders.body.pitruTomorrow', { name: o.name, date })
          : t('reminders.body.pitruToday', { name: o.name })
        : slot === 'evening'
          ? t('reminders.body.barsiTomorrow', { name: o.name, date })
          : t('reminders.body.barsiToday', { name: o.name });
      break;
    case 'vrat_family':
      body = slot === 'evening' ? t('reminders.body.vratTomorrow', { name: o.name, keyTime: o.detail }) : t('reminders.body.vratToday', { name: o.name, keyTime: o.detail });
      break;
  }
  // Vrat bodies already carry the key time; tithi/barsi bodies get the tithi text so the notification stands alone.
  return { title, body: o.kind === 'vrat_family' || o.pitruPaksha ? body : `${body} · ${o.detail}` };
}

/**
 * The full plan: two notifications per occurrence (evening before + morning of, per-kind times), only instants still in
 * the future, plus the optional daily note; nearest first; capped at `cap` (default 300).
 */
export function planNotifications(input: PlannerInput): PlannedNotification[] {
  const t = makeT(input.lang);
  const cap = input.cap ?? MAX_SCHEDULED;
  const horizon = input.horizonDays ?? HORIZON_DAYS;
  const out: PlannedNotification[] = [];
  for (const o of planOccurrences(input)) {
    const times = input.times[o.kind];
    const evening = wallToUtc(addDays(o.date, -1), times.evening, input.tz);
    const morning = wallToUtc(o.date, times.morning, input.tz);
    for (const [slot, fireAtMs] of [
      ['evening', evening],
      ['morning', morning],
    ] as const) {
      if (fireAtMs <= input.nowMs) continue;
      const text = notificationText(o, slot, t, input.lang);
      out.push({ key: o.key, kind: o.kind, refId: o.refId, date: o.date, slot, fireAtMs, title: text.title, body: text.body });
    }
  }
  if (input.dailyNote?.enabled) {
    const today = localDateOf(input.nowMs, input.tz);
    for (let i = 0; i <= horizon; i++) {
      const date = addDays(today, i);
      const fireAtMs = wallToUtc(date, input.dailyNote.time, input.tz);
      if (fireAtMs <= input.nowMs) continue;
      out.push({ key: 'daily_note', kind: 'daily_note', refId: null, date, slot: 'daily', fireAtMs, title: t('reminders.kind.dailyNote'), body: t('reminders.body.dailyNote') });
    }
  }
  out.sort((a, b) => a.fireAtMs - b.fireAtMs || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  return out.slice(0, cap);
}
