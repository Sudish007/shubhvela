// Profiles repository (F1-F3). Ancestors are NOT profiles (design.md 10.1 F3, M16) and never count toward the cap.
import type { ApproxMinutes } from '@shubhvela/engine';
import { getDb } from './connection';
import type { Lang, Tradition } from './settings';

export type Gender = 'female' | 'male' | 'other';
export type Relationship =
  | 'self'
  | 'mother'
  | 'father'
  | 'spouse'
  | 'son'
  | 'daughter'
  | 'child'
  | 'brother'
  | 'sister'
  | 'grandmother'
  | 'grandfather'
  | 'friend'
  | 'other';
export const RELATIONSHIPS: readonly Relationship[] = [
  'self',
  'mother',
  'father',
  'spouse',
  'son',
  'daughter',
  'child',
  'brother',
  'sister',
  'grandmother',
  'grandfather',
  'friend',
  'other',
];
export type Intent = 'marriage' | 'career' | 'familyDates' | 'learn';
export const INTENTS: readonly Intent[] = ['marriage', 'career', 'familyDates', 'learn'];

export interface ProfileInput {
  name: string | null;
  gender: Gender | null;
  /** YYYY-MM-DD */
  birthDate: string;
  /** HH:MM, null when unknown */
  birthTime: string | null;
  timeUnknown: boolean;
  timeApproxMinutes: ApproxMinutes;
  lat: number;
  lon: number;
  /** Canonical IANA zone id (engine canonicalZone). */
  tz: string;
  placeName: string;
  relationship: Relationship;
  tradition: Tradition;
  pdfLanguage: Lang;
  intent: Intent | null;
  isSelf: boolean;
}

export interface Profile extends ProfileInput {
  id: number;
  createdAt: string;
}

interface Row {
  id: number;
  name: string | null;
  gender: string | null;
  birth_date: string;
  birth_time: string | null;
  time_unknown: number;
  time_approx_minutes: number;
  lat: number;
  lon: number;
  tz: string;
  place_name: string;
  relationship: string;
  tradition: string;
  pdf_language: string;
  intent: string | null;
  is_self: number;
  created_at: string;
}

function fromRow(r: Row): Profile {
  return {
    id: r.id,
    name: r.name,
    gender: (r.gender as Gender | null) ?? null,
    birthDate: r.birth_date,
    birthTime: r.birth_time,
    timeUnknown: r.time_unknown === 1,
    timeApproxMinutes: ([0, 15, 30, 60].includes(r.time_approx_minutes) ? r.time_approx_minutes : 0) as ApproxMinutes,
    lat: r.lat,
    lon: r.lon,
    tz: r.tz,
    placeName: r.place_name,
    relationship: r.relationship as Relationship,
    tradition: r.tradition as Tradition,
    pdfLanguage: r.pdf_language as Lang,
    intent: (r.intent as Intent | null) ?? null,
    isSelf: r.is_self === 1,
    createdAt: r.created_at,
  };
}

const COLS =
  'id, name, gender, birth_date, birth_time, time_unknown, time_approx_minutes, lat, lon, tz, place_name, relationship, tradition, pdf_language, intent, is_self, created_at';

export function listProfiles(): Profile[] {
  return getDb()
    .getAllSync<Row>(`SELECT ${COLS} FROM profiles ORDER BY is_self DESC, created_at ASC, id ASC`)
    .map(fromRow);
}

export function countProfiles(): number {
  return getDb().getFirstSync<{ n: number }>('SELECT COUNT(*) AS n FROM profiles')?.n ?? 0;
}

export function getProfile(id: number): Profile | null {
  const r = getDb().getFirstSync<Row>(`SELECT ${COLS} FROM profiles WHERE id = ?`, [id]);
  return r ? fromRow(r) : null;
}

export function getSelfProfile(): Profile | null {
  const r = getDb().getFirstSync<Row>(`SELECT ${COLS} FROM profiles WHERE is_self = 1 ORDER BY id ASC LIMIT 1`);
  return r ? fromRow(r) : null;
}

function params(p: ProfileInput): unknown[] {
  return [
    p.name,
    p.gender,
    p.birthDate,
    p.timeUnknown ? null : p.birthTime,
    p.timeUnknown ? 1 : 0,
    p.timeUnknown ? 0 : p.timeApproxMinutes,
    p.lat,
    p.lon,
    p.tz,
    p.placeName,
    p.relationship,
    p.tradition,
    p.pdfLanguage,
    p.intent,
    p.isSelf ? 1 : 0,
  ];
}

/** Inserts and returns the new id. The caller checks entitlements.canAddProfile() first (the UI explains refusals). */
export function insertProfile(p: ProfileInput, now: Date = new Date()): number {
  const db = getDb();
  if (p.isSelf) db.runSync('UPDATE profiles SET is_self = 0 WHERE is_self = 1');
  const r = db.runSync(
    `INSERT INTO profiles (name, gender, birth_date, birth_time, time_unknown, time_approx_minutes, lat, lon, tz, place_name, relationship, tradition, pdf_language, intent, is_self, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [...params(p), now.toISOString()],
  );
  return r.lastInsertRowId;
}

export function updateProfile(id: number, p: ProfileInput): void {
  const db = getDb();
  if (p.isSelf) db.runSync('UPDATE profiles SET is_self = 0 WHERE is_self = 1 AND id <> ?', [id]);
  db.runSync(
    `UPDATE profiles SET name = ?, gender = ?, birth_date = ?, birth_time = ?, time_unknown = ?, time_approx_minutes = ?, lat = ?, lon = ?, tz = ?, place_name = ?, relationship = ?, tradition = ?, pdf_language = ?, intent = ?, is_self = ?
     WHERE id = ?`,
    [...params(p), id],
  );
}

export function setProfileIntent(id: number, intent: Intent | null): void {
  getDb().runSync('UPDATE profiles SET intent = ? WHERE id = ?', [intent, id]);
}

/** Deletes the profile and its reminder series/schedules (tithi_birthday series reference profiles by ref_id). */
export function deleteProfile(id: number): void {
  const db = getDb();
  db.runSync(`DELETE FROM scheduled WHERE series_id IN (SELECT id FROM event_series WHERE kind = 'tithi_birthday' AND ref_id = ?)`, [String(id)]);
  db.runSync(`DELETE FROM event_series WHERE kind = 'tithi_birthday' AND ref_id = ?`, [String(id)]);
  db.runSync('DELETE FROM profiles WHERE id = ?', [id]);
}
