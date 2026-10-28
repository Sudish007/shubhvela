// Widget state (design.md 10.2 F9, plan P4): the data contract between the app and the hand-written Kotlin widgets under
// android/app/src/main/java/com/shubhvela/app/widgets. The app computes SEVEN Vedic days of merged good-hours spans for the
// current observer with engine.goodHours (the only verdict producer) and writes them, already localised in the UI language,
// to files/widget_state.json; the widgets only choose the span for "now", map spans to pixels and draw. Every number in the
// file is engine output; the strings are the same UI keys the Today screen uses, so the band reads the same on the home screen.
// Pure module (no file system, no React): tested in app/test/widgets.test.ts; writeState.ts does the I/O.
import { addDays, goodHours, offsetAt, upcoming, type Ayanamsa, type ChartData, type GoodHours, type Verdict } from '@shubhvela/engine';
import type { Profile } from '../db/profiles';
import type { Lang, TFn } from '../i18n';
import { fmtCivilDate, planetName, segmentName, segmentNameById, verdictBandLabel, verdictWord } from '../today/format';
import { vedicDayFor, type Observer } from '../today/model';
import { upcomingCardText } from '../today/UpcomingStrip';

export const WIDGET_STATE_FILE = 'widget_state.json';
export const WIDGET_STATE_VERSION = 1;
/** Days written per state file (design 10.2: seven). */
export const WIDGET_STATE_DAYS = 7;
/** A file older than this renders the last known day with the footer "Open Shubhvela to refresh" (plan P4). */
export const WIDGET_STALE_AFTER_MS = 36 * 3_600_000;
/** The background task rewrites the file when fewer than this many Vedic days (today included) remain in it. */
export const WIDGET_EXTEND_WHEN_DAYS_LEFT = 2;
/** The background task also rewrites a file older than this so `writtenAt` stays within the 36 h stale window while it runs. */
export const WIDGET_REWRITE_AFTER_MS = 12 * 3_600_000;

export interface WidgetReason {
  id: string;
  /** Segment display name in the UI language ("Rahu Kaal", "Shubh choghadiya"). */
  name: string;
  start: number;
  end: number;
}

export interface WidgetSpan {
  start: number;
  end: number;
  verdict: Verdict;
  night: boolean;
  /** The verdict word for the inline label and the small widget ("Good" / "Avoid" / "Neutral"). */
  label: string;
  /** Deciding segments (N3: the band shows their names when every one is >= 60 dp wide). */
  reasons: WidgetReason[];
}

export interface WidgetSegment {
  id: string;
  name: string;
  start: number;
  end: number;
  verdict: Verdict;
  kind: string;
}

export interface WidgetHora {
  /** Planet name in the UI language. */
  name: string;
  start: number;
  end: number;
}

export interface WidgetDay {
  /** Civil date of the Vedic day, YYYY-MM-DD in the observer's zone. */
  date: string;
  /** "Thu 22 Oct 2026" in the UI language (for the "Last known day" footer). */
  dateText: string;
  /** Zone offset in minutes at sunrise so the widget formats HH:mm with the engine's table, not the device zone database. */
  offsetMinutes: number;
  sunrise: number;
  sunset: number;
  nextSunrise: number;
  moonrise: number | null;
  spans: WidgetSpan[];
  segments: WidgetSegment[];
  hora: WidgetHora[];
}

/** UI strings the Kotlin side needs (localised here so the widget follows the app language, not the system locale). */
export interface WidgetStrings {
  now: string;
  /** Template with {segment} and {time}. */
  next: string;
  good: string;
  neutral: string;
  avoid: string;
  night: string;
  stale: string;
  lastKnown: string;
  noUpcoming: string;
}

export interface WidgetStateFile {
  version: 1;
  /** UTC ms when the file was written. */
  writtenAt: number;
  tz: string;
  location: { name: string | null; lat: number; lon: number };
  lang: Lang;
  theme: 'system' | 'light' | 'dark';
  strings: WidgetStrings;
  /** "<kind> · <title> · <date>" of the first Upcoming item, or null. */
  nextEvent: string | null;
  days: WidgetDay[];
}

export interface BuildWidgetStateInput {
  observer: Pick<Observer, 'lat' | 'lon' | 'tz' | 'placeName'>;
  lang: Lang;
  theme: WidgetStateFile['theme'];
  nowMs: number;
  t: TFn;
  ayanamsa?: Ayanamsa;
  /** Self profile + chart for the Upcoming strip's first item (omitted -> nextEvent null). */
  self?: { profile: Profile; chart: ChartData } | null;
  days?: number;
}

export function widgetStrings(t: TFn): WidgetStrings {
  return {
    now: t('widget.now'),
    next: t('widget.next'),
    good: verdictWord(t, 'good'),
    neutral: verdictWord(t, 'neutral'),
    avoid: verdictWord(t, 'avoid'),
    night: verdictWord(t, 'night'),
    stale: t('errors.widgetStale'),
    lastKnown: t('widget.lastKnown'),
    noUpcoming: t('widget.noUpcoming'),
  };
}

/** One day of the file from one engine goodHours result (null when the day has no sunrise: polar latitudes). */
export function widgetDay(gh: GoodHours, lang: Lang, t: TFn): WidgetDay | null {
  if (!gh.ticks) return null;
  const ticks = gh.ticks;
  const segments: WidgetSegment[] = gh.segments.map((s) => ({ id: s.id, name: segmentName(t, s), start: s.start, end: s.end, verdict: s.verdict, kind: s.kind }));
  const byId = new Map(gh.segments.map((s) => [s.id, s]));
  const spans: WidgetSpan[] = gh.spans.map((s) => ({
    start: s.start,
    end: s.end,
    verdict: s.verdict,
    night: s.night,
    label: verdictBandLabel(t, s.verdict),
    reasons: s.reasons
      .map((id) => byId.get(id))
      .filter((seg) => !!seg)
      .map((seg) => ({ id: seg.id, name: segmentNameById(t, gh, seg.id), start: seg.start, end: seg.end })),
  }));
  return {
    date: gh.day,
    dateText: fmtCivilDate(gh.day, lang),
    offsetMinutes: offsetAt(gh.tz, ticks.sunrise),
    sunrise: ticks.sunrise,
    sunset: ticks.sunset,
    nextSunrise: ticks.nextSunrise,
    moonrise: ticks.moonrise,
    spans,
    segments,
    hora: gh.hora.map((h) => ({ name: planetName(lang, h.lord), start: h.start, end: h.end })),
  };
}

/** The first Upcoming item as one line, or null (empty strip / no profile). */
export function nextEventText(input: Pick<BuildWidgetStateInput, 'observer' | 'nowMs' | 't' | 'lang' | 'self'>): string | null {
  if (!input.self) return null;
  const { profile, chart } = input.self;
  const geo = { lat: input.observer.lat, lon: input.observer.lon };
  const items = upcoming({ id: String(profile.id), name: profile.name ?? undefined, chart, tradition: profile.tradition }, [], input.nowMs, geo, input.observer.tz);
  if (!items.length) return null;
  const text = upcomingCardText(items[0], input.observer.tz, profile.id, input.t, input.lang);
  return input.t('widget.nextEvent', { kind: text.kind, title: text.title, date: text.date });
}

/** Seven Vedic days from the one containing `nowMs`, at the observer, in the UI language. Pure. */
export function buildWidgetState(input: BuildWidgetStateInput): WidgetStateFile {
  const { observer, lang, nowMs, t } = input;
  const geo = { lat: observer.lat, lon: observer.lon };
  const first = vedicDayFor(nowMs, geo, observer.tz);
  const count = input.days ?? WIDGET_STATE_DAYS;
  const days: WidgetDay[] = [];
  for (let i = 0; i < count; i++) {
    const day = widgetDay(goodHours(addDays(first, i), geo, observer.tz, { ayanamsa: input.ayanamsa }), lang, t);
    if (day) days.push(day);
  }
  return {
    version: WIDGET_STATE_VERSION,
    writtenAt: nowMs,
    tz: observer.tz,
    location: { name: observer.placeName, lat: observer.lat, lon: observer.lon },
    lang,
    theme: input.theme,
    strings: widgetStrings(t),
    nextEvent: nextEventText(input),
    days,
  };
}

/** Days of the file still usable at `nowMs` (today included): a day is usable until its next sunrise. */
export function daysRemaining(file: Pick<WidgetStateFile, 'days'>, nowMs: number): number {
  return file.days.filter((d) => d.nextSunrise > nowMs).length;
}

/** Why the background task should rewrite the file now, or null when it can leave it alone. */
export function extensionReason(file: Pick<WidgetStateFile, 'days' | 'writtenAt'> | null, nowMs: number): 'missing' | 'exhausting' | 'aging' | null {
  if (!file) return 'missing';
  if (daysRemaining(file, nowMs) < WIDGET_EXTEND_WHEN_DAYS_LEFT) return 'exhausting';
  if (nowMs - file.writtenAt > WIDGET_REWRITE_AFTER_MS) return 'aging';
  return null;
}

/** Mirror of the Kotlin WidgetState.resolve() for tests and the dev route: which day/span the widget shows and its status. */
export function resolveWidgetState(file: WidgetStateFile | null, nowMs: number): { status: 'missing' | 'fresh' | 'stale' | 'exhausted'; day: WidgetDay | null; span: WidgetSpan | null } {
  if (!file || !file.days.length) return { status: 'missing', day: null, span: null };
  const day = file.days.find((d) => d.sunrise <= nowMs && nowMs < d.nextSunrise) ?? null;
  if (!day) return { status: 'exhausted', day: file.days[file.days.length - 1], span: null };
  const span = day.spans.find((s) => s.start <= nowMs && nowMs < s.end) ?? null;
  return { status: nowMs - file.writtenAt > WIDGET_STALE_AFTER_MS ? 'stale' : 'fresh', day, span };
}
