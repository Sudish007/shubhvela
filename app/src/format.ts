// Display formatting for dates and places in the UI language (engine locale tables; Latin digits everywhere).
import { formatOffset, locale, localToUtc, offsetAt } from '@shubhvela/engine';
import type { Lang } from './i18n';
import type { PlaceChoice } from './profiles/validate';

/** "14 Mar 1998" with the engine's month abbreviations in the UI language. */
export function formatIsoDate(iso: string, lang: Lang): string {
  const [y, m, d] = iso.split('-').map(Number);
  const month = locale.monthShort[lang][m - 1] ?? String(m);
  return `${d} ${month} ${y}`;
}

export function formatPlace(p: PlaceChoice): string {
  return [p.name, p.admin1, p.country].filter(Boolean).join(', ');
}

export interface ZoneHint {
  zone: string;
  offset: string;
  /** Asia/Kolkata births in the 1942-45 war-time period ran on +06:30 (design.md 10.1 F4). */
  warTime: boolean;
}

/** Zone and offset in force at the birth instant (noon when the time is unknown). */
export function zoneHint(tz: string, birthDate: string | null, birthTime: string | null): ZoneHint {
  const [y, m, d] = (birthDate ?? '2000-01-01').split('-').map(Number);
  const [hh, mm] = (birthTime ?? '12:00').split(':').map(Number);
  const utcMs = localToUtc(tz, { y, m, d, hh, mm }).utcMs;
  const off = offsetAt(tz, utcMs);
  return { zone: tz, offset: formatOffset(off), warTime: tz === 'Asia/Kolkata' && off !== 330 };
}
