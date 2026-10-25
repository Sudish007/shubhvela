// Reminder series (F20-F22, F25). One row per series: tithi_birthday (ref = profile id), barsi (ref = ancestor id,
// covers the yearly barsi AND its Pitru Paksha day), vrat_family (ref = engine VratFamily key, covers every occurrence
// of the family). entitlements.canAddReminder() counts ENABLED rows; the planner (src/notifications) schedules only
// enabled rows, so the app is quiet by default (design.md 10.4 F25).
import type { VratFamily } from '@shubhvela/engine';
import { VRAT_FAMILIES } from '@shubhvela/engine';
import { getDb } from './connection';

export type SeriesKind = 'tithi_birthday' | 'barsi' | 'vrat_family';

export interface SeriesRow {
  id: number;
  kind: SeriesKind;
  refId: string;
  enabled: boolean;
}

interface Row {
  id: number;
  kind: string;
  ref_id: string;
  enabled: number;
}

/** Stable key of a series ("barsi:3", "vrat_family:ekadashi") used by the planner and the "not scheduled" tags. */
export function seriesKey(kind: SeriesKind, refId: string): string {
  return `${kind}:${refId}`;
}

export function countEnabledSeries(): number {
  return getDb().getFirstSync<{ n: number }>('SELECT COUNT(*) AS n FROM event_series WHERE enabled = 1')?.n ?? 0;
}

export function listSeries(): SeriesRow[] {
  return getDb()
    .getAllSync<Row>('SELECT id, kind, ref_id, enabled FROM event_series ORDER BY id ASC')
    .map((r) => ({ id: r.id, kind: r.kind as SeriesKind, refId: r.ref_id, enabled: r.enabled === 1 }));
}

export function listEnabledSeries(): SeriesRow[] {
  return listSeries().filter((s) => s.enabled);
}

export function isSeriesEnabled(kind: SeriesKind, refId: string): boolean {
  const r = getDb().getFirstSync<{ enabled: number }>('SELECT enabled FROM event_series WHERE kind = ? AND ref_id = ?', [kind, refId]);
  return r?.enabled === 1;
}

/** The series id (creating a disabled row when none exists) so `scheduled` rows can reference it. */
export function seriesId(kind: SeriesKind, refId: string): number {
  const db = getDb();
  const r = db.getFirstSync<{ id: number }>('SELECT id FROM event_series WHERE kind = ? AND ref_id = ?', [kind, refId]);
  if (r) return r.id;
  return db.runSync('INSERT INTO event_series (kind, ref_id, enabled) VALUES (?, ?, 0)', [kind, refId]).lastInsertRowId;
}

export function setSeriesEnabled(kind: SeriesKind, refId: string, enabled: boolean): void {
  getDb().runSync(
    'INSERT INTO event_series (kind, ref_id, enabled) VALUES (?, ?, ?) ON CONFLICT(kind, ref_id) DO UPDATE SET enabled = excluded.enabled',
    [kind, refId, enabled ? 1 : 0],
  );
}

/** Enabled vrat families, in the engine's canonical order (Family cards, Settings -> Vrats, the Upcoming strip). */
export function enabledVratFamilies(): VratFamily[] {
  const on = new Set(listEnabledSeries().filter((s) => s.kind === 'vrat_family').map((s) => s.refId));
  return VRAT_FAMILIES.filter((f) => on.has(f));
}
