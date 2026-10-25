// Formatting shared by the Family tab, the vrat/festival screens and the notification planner: every value is engine
// output rendered in the UI language with Latin digits; nothing here computes a date.
import type { FestivalTithiText, KeyTime, Paksha, Tradition } from '@shubhvela/engine';
import type { Lang, TFn } from '../i18n';
import { fmtTime, glueRanges, lunarMonthName, tithiName } from '../today/format';

/** "Kartik Krishna Tritiya" from a lunar month index, paksha and 1-15 tithi number. */
export function tithiText(t: TFn, lang: Lang, month: number, adhik: boolean, paksha: Paksha, tithi: number): string {
  return t('events.tithiDate', {
    month: lunarMonthName(lang, month, adhik),
    paksha: t(paksha === 'krishna' ? 'panchang.krishna' : 'panchang.shukla'),
    tithi: tithiName(lang, tithi - 1 + (paksha === 'krishna' ? 15 : 0)),
  });
}

export function festivalTithiLine(t: TFn, lang: Lang, tt: FestivalTithiText | null): string | null {
  if (!tt) return null;
  return tithiText(t, lang, tt.month, tt.adhik, tt.paksha, tt.tithi);
}

export function systemName(t: TFn, tradition: Tradition): string {
  return tradition === 'amanta' ? t('panchang.amanta') : t('panchang.purnimanta');
}

/** The computed time that matters for a vrat (design.md 10.4 F22): parana window, moonrise, pradosh kala ... */
export function vratKeyTimeText(t: TFn, keyTime: KeyTime, tz: string): string {
  const k = keyTime.kind;
  if (k === 'moonrise' || k === 'sandhya' || k === 'sunrise') return t(`vrat.time.${k}`, { time: fmtTime(keyTime.start, tz) });
  if (keyTime.end === undefined) return fmtTime(keyTime.start, tz);
  // Templates carry "{from}–{to}"; glueRanges makes the range one unbreakable run (N4).
  return glueRanges(t(`vrat.time.${k}`, { from: fmtTime(keyTime.start, tz), to: fmtTime(keyTime.end, tz) }));
}

/** Display name of a vrat occurrence from its content key ("ekadashi-nirjala" -> "Nirjala Ekadashi"). */
export function vratName(t: TFn, nameKey: string): string {
  return t(`vrat.name.${nameKey}`);
}

/** Whole days from `today` (YYYY-MM-DD) to `date`; both civil dates. */
export function daysUntil(today: string, date: string): number {
  const [y1, m1, d1] = today.split('-').map(Number);
  const [y2, m2, d2] = date.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000);
}

/** "in N days" / "today" / "tomorrow" caption for a kind label. */
export function inDaysText(t: TFn, days: number): string {
  if (days <= 0) return t('events.today');
  if (days === 1) return t('common.tomorrow');
  return t('common.inDays', { count: days });
}
