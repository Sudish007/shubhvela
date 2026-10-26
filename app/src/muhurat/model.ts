// Muhurat finder model (F26, design.md 10.5; plan B05): pure helpers between engine.muhurat and the screen. The engine
// scores and ranks (N18); this file only decides the free/Pro date range, formats what a window says and builds the
// Why? inputs. Scores stay counts ("N/10 rules met"), never percentages (design.md 6).
import {
  MUHURAT_ACTIVITIES,
  MUHURAT_MIN_RULES,
  TARA_KEYS,
  addDays,
  localDateOf,
  muhurat,
  muhuratActivity,
  splitWindows,
  type ChartData,
  type DateRange,
  type MuhuratActivity,
  type MuhuratRule,
  type MuhuratWindow,
  type PanchangDay,
} from '@shubhvela/engine';
import type { Profile } from '../db/profiles';
import { chartFor } from '../engine-bridge/charts';
import type { Lang, TFn } from '../i18n';
import { fmtDayShort, fmtRange, fmtTime, fmtTimeOrDayTime, glueRanges, nakshatraName, ordinal, tithiName, weekdayName } from '../today/format';

/** Free tier: today + 7 days (spec section 9). */
export const FREE_RANGE_DAYS = 7;
/** Pro range picker bound (the engine refuses longer ranges). */
export const MAX_RANGE_DAYS = 400;

export interface MuhuratObserver {
  lat: number;
  lon: number;
  tz: string;
  placeName: string | null;
}

/** "today .. today + 7" in the observer's zone: the only range the free tier searches. */
export function freeRange(nowMs: number, tz: string): DateRange {
  const from = localDateOf(nowMs, tz);
  return { from, to: addDays(from, FREE_RANGE_DAYS) };
}

/** Clamps a Pro range to today .. today + MAX_RANGE_DAYS with to >= from. */
export function clampRange(range: DateRange, nowMs: number, tz: string): DateRange {
  const today = localDateOf(nowMs, tz);
  const from = range.from < today ? today : range.from;
  const max = addDays(today, MAX_RANGE_DAYS);
  let to = range.to < from ? from : range.to;
  if (to > max) to = max;
  return { from, to };
}

export function activityName(id: string, lang: Lang): string {
  return muhuratActivity(id).names[lang];
}

/** The 14 activities in the data-file order (spec F26 list). */
export const ACTIVITIES: readonly MuhuratActivity[] = MUHURAT_ACTIVITIES;

/** Number of For profiles an activity takes (2 for marriage / engagement). */
export function profilesNeeded(activityId: string): 1 | 2 {
  return muhuratActivity(activityId).profiles;
}

export interface MuhuratSearch {
  all: MuhuratWindow[];
  matches: MuhuratWindow[];
  partials: MuhuratWindow[];
  range: DateRange;
}

/** Runs the engine scorer for the chosen profiles at the observer's place (synchronous, ~120 ms for 8 days). */
export function searchMuhurat(activityId: string, range: DateRange, profiles: readonly Profile[], observer: MuhuratObserver): MuhuratSearch {
  const charts: ChartData[] = profiles.map((p) => chartFor(p));
  const cache = new Map<string, PanchangDay>();
  const all = muhurat.score(activityId, range, charts, { lat: observer.lat, lon: observer.lon }, observer.tz, { panchangCache: cache });
  const { matches, partials } = splitWindows(all);
  return { all, matches, partials, range };
}

/** "Mon 26 Oct · 14:51–17:38" (today reads "Today"); the range is glued so it never splits (N4). */
export function whenLine(w: MuhuratWindow, tz: string, lang: Lang, t: TFn, todayDate: string): string {
  const day = w.day === todayDate ? t('common.today') : fmtDayShort(w.start, tz, lang);
  return t('muhurat.whenLine', { day, from: fmtTime(w.start, tz), to: fmtTime(w.end, tz) });
}

/** Choghadiya names of the window: "Labh" or "Labh then Amrit". */
export function choghadiyaText(w: MuhuratWindow, t: TFn): string {
  const names = [...new Set(w.choghadiya)].map((n) => t(`band.chog.${n.toLowerCase()}`));
  if (names.length === 1) return names[0];
  return names.slice(1).reduce((acc, n) => t('muhurat.then', { a: acc, b: n }), names[0]);
}

/** "Purnima · Ashwini · Monday · Labh then Amrit choghadiya". */
export function subLine(w: MuhuratWindow, lang: Lang, t: TFn): string {
  return t('muhurat.subLine', {
    tithi: tithiName(lang, w.tithi.index),
    nakshatra: nakshatraName(lang, w.nakshatra.n),
    vara: weekdayName(lang, w.vara),
    choghadiya: choghadiyaText(w, t),
  });
}

function taraName(t: TFn, tara: number): string {
  const key = TARA_KEYS[tara];
  return key ? t(`note.tara.${key}`) : String(tara);
}

/** Label of a rule chip: the rule name plus the detail that decided it (design.md 10.5 / muhurat.html). */
export function ruleChipLabel(rule: MuhuratRule, w: MuhuratWindow, tz: string, lang: Lang, t: TFn): string {
  const base = t(`muhurat.rule.${rule.id}`);
  const d = rule.detail;
  switch (rule.id) {
    case 'chandra-bala': {
      const houses = d.houses;
      if (!Array.isArray(houses) || houses.length === 0) return `${base} · ${t('muhurat.detail.noProfile')}`;
      return t('muhurat.detail.chandraBala', { house: (houses as number[]).map((h) => ordinal(h, lang)).join(', ') });
    }
    case 'tara-bala': {
      const taras = d.taras;
      if (!Array.isArray(taras) || taras.length === 0) return `${base} · ${t('muhurat.detail.noProfile')}`;
      return t('muhurat.detail.taraBala', { tara: (taras as number[]).map((x) => taraName(t, x)).join(', ') });
    }
    case 'bhadra':
      if (!rule.met && typeof d.bhadraStart === 'number' && typeof d.bhadraEnd === 'number') {
        return glueRanges(t('muhurat.detail.bhadraEarth', { from: fmtTimeOrDayTime(d.bhadraStart, tz, lang, w.day), to: fmtTimeOrDayTime(d.bhadraEnd, tz, lang, w.day) }));
      }
      return base;
    case 'panchak':
      if (!rule.met && typeof d.panchakEnd === 'number') return t('muhurat.detail.panchak', { until: fmtTimeOrDayTime(d.panchakEnd, tz, lang, w.day) });
      return base;
    case 'abhijit':
      if (rule.met && typeof d.abhijitStart === 'number' && typeof d.abhijitEnd === 'number') return glueRanges(t('muhurat.detail.abhijit', { from: fmtTime(d.abhijitStart, tz), to: fmtTime(d.abhijitEnd, tz) }));
      return base;
    case 'choghadiya':
      if (!rule.met && w.choghadiya.includes('Chal')) return t('muhurat.detail.neutral', { rule: base });
      return base;
    default:
      return base;
  }
}

function listNames(list: unknown, name: (n: number) => string): string {
  return Array.isArray(list) ? (list as number[]).map(name).join(', ') : '';
}

/** Why? inputs of the activity's rule table with the window's values (design.md 10.5 "Why?"). */
export function whyInputs(w: MuhuratWindow, tz: string, lang: Lang, t: TFn): Record<string, string | number> {
  const a = muhuratActivity(w.activity);
  const out: Record<string, string | number> = {
    [t('muhurat.activity')]: a.names[lang],
    [t('muhurat.dates')]: `${fmtDayShort(w.start, tz, lang)} ${fmtRange(w.start, w.end, tz)}`,
    [t('muhurat.rulesMet', { met: w.met, of: w.of })]: `${w.met}/${w.of}`,
    [t('muhurat.rule.tithi')]: `${tithiName(lang, w.tithi.index)} (${t(w.tithi.paksha === 'krishna' ? 'panchang.krishna' : 'panchang.shukla')})`,
    [t('muhurat.rule.nakshatra')]: nakshatraName(lang, w.nakshatra.n),
    [t('muhurat.rule.vara')]: weekdayName(lang, w.vara),
    [t('muhurat.rule.choghadiya')]: choghadiyaText(w, t),
    [t('muhurat.allowedTithis')]: a.allowedTithis.join(', '),
    [t('muhurat.allowedNakshatras')]: listNames(a.allowedNakshatras, (n) => nakshatraName(lang, n)),
    [t('muhurat.allowedVaras')]: listNames(a.allowedVaras, (v) => weekdayName(lang, v)),
    [a.nightAllowed ? t('muhurat.nightAllowed') : t('muhurat.dayOnly')]: t(a.nightAllowed ? 'common.yes' : 'common.no'),
    [t('muhurat.sources')]: a.sources.join('; '),
  };
  if (w.rahuKaal) out[t('muhurat.rule.rahu-kaal')] = fmtRange(w.rahuKaal.start, w.rahuKaal.end, tz);
  return out;
}

/** Why? inputs of one rule chip (the rule's own detail). */
export function ruleWhyInputs(rule: MuhuratRule, w: MuhuratWindow, tz: string, lang: Lang, t: TFn): Record<string, string | number> {
  const out: Record<string, string | number> = { [t(`muhurat.rule.${rule.id}`)]: t(rule.met ? 'muhurat.ruleMet_tag' : 'muhurat.ruleNotMet_tag') };
  for (const [k, v] of Object.entries(rule.detail)) {
    if (v === null || v === undefined) continue;
    if (Array.isArray(v)) {
      if (k === 'allowed' && rule.id === 'nakshatra') out[k] = (v as number[]).map((n) => nakshatraName(lang, n)).join(', ');
      else if (k === 'allowed' && rule.id === 'vara') out[k] = (v as number[]).map((n) => weekdayName(lang, n)).join(', ');
      else out[k] = v.join(', ');
    } else if (typeof v === 'number' && /At$|Start$|End$/.test(k)) out[k] = fmtTimeOrDayTime(v, tz, lang, w.day);
    else out[k] = typeof v === 'boolean' ? t(v ? 'common.yes' : 'common.no') : v;
  }
  return out;
}

/** The threshold the "Best partial matches" section explains. */
export const PARTIAL_THRESHOLD = MUHURAT_MIN_RULES;

/** Top-N partial matches listed under the zero-results copy (design.md 10.5: "the top three"). */
export const ZERO_RESULT_PARTIALS = 3;
