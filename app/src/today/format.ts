// Formatting for the Today screen: every value is engine output rendered in the profile's zone and the UI language
// (Latin digits, tabular numerals via Num). Time ranges are glued with U+2060 so they never split across lines (N4).
import { formatInZone, locale, type GoodHours, type GoodHoursSegment, type HoraSlot, type LegendColour, type Verdict } from '@shubhvela/engine';
import { noBreak } from '../components/Num';
import type { Lang, TFn } from '../i18n';

export const EN_DASH = '\u2013';

export function fmtTime(ms: number, tz: string): string {
  return formatInZone(ms, tz, 'HH:mm');
}

/** "Thu 22 Oct" in the UI language (engine weekday/month tables, never the device locale). */
export function fmtDayShort(ms: number, tz: string, lang: Lang): string {
  return formatInZone(ms, tz, 'EEE d MMM', lang);
}

/** "Thu 22 Oct 2026". */
export function fmtDayLong(ms: number, tz: string, lang: Lang): string {
  return formatInZone(ms, tz, 'EEE d MMM yyyy', lang);
}

/** "14 Dec 2026". */
export function fmtDate(ms: number, tz: string, lang: Lang): string {
  return formatInZone(ms, tz, 'd MMM yyyy', lang);
}

/** "Sun 25 Oct 19:21" for instants that may fall on another day than the one shown. */
export function fmtDayTime(ms: number, tz: string, lang: Lang): string {
  return formatInZone(ms, tz, 'EEE d MMM HH:mm', lang);
}

/** HH:mm when the instant is on `day` (civil date in tz), else weekday + date + time. */
export function fmtTimeOrDayTime(ms: number, tz: string, lang: Lang, day: string): string {
  return formatInZone(ms, tz, 'yyyy-MM-dd') === day ? fmtTime(ms, tz) : fmtDayTime(ms, tz, lang);
}

/** "06:27–07:51" as one unbreakable run. */
export function fmtRange(start: number, end: number, tz: string): string {
  return noBreak(`${fmtTime(start, tz)}${EN_DASH}${fmtTime(end, tz)}`);
}

/** A civil date "2026-10-22" -> "Thu 22 Oct 2026" via the engine month/weekday names. */
export function fmtCivilDate(day: string, lang: Lang): string {
  const [y, m, d] = day.split('-').map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${locale.weekdayShort[lang][weekday]} ${d} ${locale.monthShort[lang][m - 1]} ${y}`;
}

export function verdictWord(t: TFn, v: Verdict | LegendColour): string {
  return t(`verdict.${v}`);
}

export function verdictTag(t: TFn, v: Verdict): string {
  return t(`verdict.${v}_tag`);
}

/** Inline band label for a verdict ("Good" / "Neutral" / "Avoid", budget 10 chars). */
export function verdictBandLabel(t: TFn, v: Verdict): string {
  return t(`band.${v}_band`);
}

/** Display name of a segment row: "Rahu Kaal", "Shubh choghadiya"; night choghadiya rows use the bare name. */
export function segmentName(t: TFn, seg: Pick<GoodHoursSegment, 'name' | 'choghadiya' | 'night' | 'kind'>, bare = false): string {
  if (seg.kind === 'choghadiya' && (bare || seg.night) && seg.choghadiya) return t(`band.chog.${seg.choghadiya.toLowerCase()}`);
  return t(`band.seg.${seg.name}`);
}

export function segmentNameById(t: TFn, gh: Pick<GoodHours, 'segments'>, id: string): string {
  const seg = gh.segments.find((s) => s.id === id);
  return seg ? segmentName(t, seg) : id;
}

export function planetName(lang: Lang, id: HoraSlot['lord']): string {
  return locale.planetNames[lang][id];
}

export function signName(lang: Lang, sign1: number): string {
  return locale.signNames[lang][((sign1 - 1) % 12 + 12) % 12];
}

export function nakshatraName(lang: Lang, n1: number): string {
  return locale.nakshatraNames[lang][((n1 - 1) % 27 + 27) % 27];
}

export function weekdayName(lang: Lang, vara: number): string {
  return locale.weekdayNames[lang][vara];
}

export function lunarMonthName(lang: Lang, index: number, adhik: boolean): string {
  const name = locale.lunarMonthNames[lang][index];
  return adhik ? `${locale.adhikLabel[lang]} ${name}` : name;
}

export function tithiName(lang: Lang, tithiIndex0: number): string {
  return locale.tithiNames[lang][tithiIndex0];
}

/** Ordinal for house counts in English; Hindi/Bhojpuri use the bare numeral (design.md 7: Latin digits). */
export function ordinal(n: number, lang: Lang): string {
  if (lang !== 'en') return String(n);
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

/**
 * Glues every "HH:mm–HH:mm" range in a sentence so it cannot wrap in the middle (N4). Applied to interpolated
 * strings whose templates carry {from}–{to}; a glued range contains U+2060 around the dash and no plain space.
 */
export function glueRanges(text: string): string {
  return text.replace(/(\d{1,2}:\d{2})\s*[\u2013\u2014-]\s*(\d{1,2}:\d{2})/g, (_m, a: string, b: string) => noBreak(`${a}${EN_DASH}${b}`));
}
