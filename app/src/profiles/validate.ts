// Birth-form validation at the system boundary (design.md 11): date required within 1900-01-01..today; time optional
// HH:MM; approx minutes 15/30/60; place required with lat -90..90, lon -180..180 and a zone the engine table knows;
// name <= 40 characters. Pure functions; the screens map error codes to strings.
import { canonicalZone, type ApproxMinutes } from '@shubhvela/engine';
import type { Gender, Relationship } from '../db/profiles';
import type { Lang, Tradition } from '../db/settings';

export type PlaceSource = 'gazetteer' | 'online' | 'manual';

export interface PlaceChoice {
  name: string;
  admin1: string;
  country: string;
  lat: number;
  lon: number;
  tz: string;
  source: PlaceSource;
}

export interface BirthFormValue {
  birthDate: string | null;
  birthTime: string | null;
  timeUnknown: boolean;
  timeApprox: boolean;
  approxMinutes: 15 | 30 | 60;
  place: PlaceChoice | null;
  name: string;
  gender: Gender | null;
  relationship: Relationship;
  tradition: Tradition;
  pdfLanguage: Lang;
}

export const EMPTY_FORM = (defaults: { tradition: Tradition; pdfLanguage: Lang; relationship: Relationship }): BirthFormValue => ({
  birthDate: null,
  birthTime: null,
  timeUnknown: false,
  timeApprox: false,
  approxMinutes: 30,
  place: null,
  name: '',
  gender: null,
  relationship: defaults.relationship,
  tradition: defaults.tradition,
  pdfLanguage: defaults.pdfLanguage,
});

export type FieldError = 'date' | 'time' | 'place' | 'name';
export type FormErrors = Partial<Record<FieldError, true>>;

export const MIN_DATE = '1900-01-01';
export const NAME_MAX = 40;

export function todayIso(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function isValidDate(s: string | null, now: Date = new Date()): s is string {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return false;
  return s >= MIN_DATE && s <= todayIso(now);
}

export function isValidTime(s: string | null): s is string {
  if (!s || !/^\d{2}:\d{2}$/.test(s)) return false;
  const [hh, mm] = s.split(':').map(Number);
  return hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59;
}

export function isValidLat(n: number): boolean {
  return Number.isFinite(n) && n >= -90 && n <= 90;
}

export function isValidLon(n: number): boolean {
  return Number.isFinite(n) && n >= -180 && n <= 180;
}

export function isValidPlace(p: PlaceChoice | null): p is PlaceChoice {
  return !!p && isValidLat(p.lat) && isValidLon(p.lon) && canonicalZone(p.tz) !== undefined;
}

export function nameLength(s: string): number {
  return Array.from(s.trim()).length;
}

export function validateForm(v: BirthFormValue, now: Date = new Date()): FormErrors {
  const e: FormErrors = {};
  if (!isValidDate(v.birthDate, now)) e.date = true;
  if (!v.timeUnknown && !isValidTime(v.birthTime)) e.time = true;
  if (!isValidPlace(v.place)) e.place = true;
  if (nameLength(v.name) > NAME_MAX) e.name = true;
  return e;
}

export function approxMinutesOf(v: BirthFormValue): ApproxMinutes {
  if (v.timeUnknown || !v.timeApprox) return 0;
  return v.approxMinutes;
}

/** Parses "26.85" / "-33.9" style input; null when not a finite number. */
export function parseCoord(s: string): number | null {
  const n = Number(s.trim().replace(',', '.'));
  return Number.isFinite(n) && s.trim() !== '' ? n : null;
}
