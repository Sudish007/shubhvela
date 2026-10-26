// The `scheduled` table (plan.md section 2): one row per notification handed to the OS by the last re-plan, so Settings
// -> Notifications can show the real "Scheduled" count and list, and deleteEverything can cancel by id. Rewritten
// wholesale on every re-plan (the planner cancels everything first, N12). Rows without an event series (daily note,
// dasha change, Vedic-year instant; series_id 0) carry their `kind` directly (schema v2, B04).
import { getDb } from './connection';

export interface ScheduledRow {
  id: number;
  /** event_series.id, or 0 for notifications that belong to no series (daily note, dasha change, year begins). */
  seriesId: number;
  /** ISO instant (UTC). */
  fireAt: string;
  notificationId: string;
  /** Kind of a series-less notification ('daily_note' | 'dasha_change' | 'year_begins'); null for series rows. */
  kind?: string | null;
}

interface Row {
  id: number;
  series_id: number;
  fire_at: string;
  notification_id: string;
  kind: string | null;
}

export function countScheduled(): number {
  return getDb().getFirstSync<{ n: number }>('SELECT COUNT(*) AS n FROM scheduled')?.n ?? 0;
}

export function listScheduled(limit?: number): ScheduledRow[] {
  const sql = `SELECT id, series_id, fire_at, notification_id, kind FROM scheduled ORDER BY fire_at ASC${limit ? ` LIMIT ${Math.max(0, Math.floor(limit))}` : ''}`;
  return getDb()
    .getAllSync<Row>(sql)
    .map((r) => ({ id: r.id, seriesId: r.series_id, fireAt: r.fire_at, notificationId: r.notification_id, kind: r.kind }));
}

export interface ScheduledDetail {
  fireAt: string;
  /** event_series kind, or the row's own kind for series-less notifications, or null for the daily note. */
  kind: string | null;
  refId: string | null;
}

/** The next scheduled notifications with their series (Settings -> Notifications "Scheduled" list). */
export function listScheduledDetailed(limit = 20): ScheduledDetail[] {
  return getDb()
    .getAllSync<{ fire_at: string; kind: string | null; ref_id: string | null }>(
      `SELECT s.fire_at, COALESCE(e.kind, s.kind) AS kind, e.ref_id FROM scheduled s LEFT JOIN event_series e ON e.id = s.series_id ORDER BY s.fire_at ASC LIMIT ${Math.max(0, Math.floor(limit))}`,
    )
    .map((r) => ({ fireAt: r.fire_at, kind: r.kind, refId: r.ref_id }));
}

export function clearScheduled(): void {
  getDb().runSync('DELETE FROM scheduled');
}

export function insertScheduled(rows: readonly Omit<ScheduledRow, 'id'>[]): void {
  const db = getDb();
  for (const r of rows) db.runSync('INSERT INTO scheduled (series_id, fire_at, notification_id, kind) VALUES (?, ?, ?, ?)', [r.seriesId, r.fireAt, r.notificationId, r.kind ?? null]);
}
