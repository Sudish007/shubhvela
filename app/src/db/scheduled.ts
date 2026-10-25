// The `scheduled` table (plan.md section 2): one row per notification handed to the OS by the last re-plan, so Settings
// -> Notifications can show the real "Scheduled" count and list, and deleteEverything can cancel by id. Rewritten
// wholesale on every re-plan (the planner cancels everything first, N12).
import { getDb } from './connection';

export interface ScheduledRow {
  id: number;
  /** event_series.id, or 0 for the opt-in daily-note notification. */
  seriesId: number;
  /** ISO instant (UTC). */
  fireAt: string;
  notificationId: string;
}

interface Row {
  id: number;
  series_id: number;
  fire_at: string;
  notification_id: string;
}

export function countScheduled(): number {
  return getDb().getFirstSync<{ n: number }>('SELECT COUNT(*) AS n FROM scheduled')?.n ?? 0;
}

export function listScheduled(limit?: number): ScheduledRow[] {
  const sql = `SELECT id, series_id, fire_at, notification_id FROM scheduled ORDER BY fire_at ASC${limit ? ` LIMIT ${Math.max(0, Math.floor(limit))}` : ''}`;
  return getDb()
    .getAllSync<Row>(sql)
    .map((r) => ({ id: r.id, seriesId: r.series_id, fireAt: r.fire_at, notificationId: r.notification_id }));
}

export interface ScheduledDetail {
  fireAt: string;
  /** event_series kind, or null for the daily note (series_id 0). */
  kind: string | null;
  refId: string | null;
}

/** The next scheduled notifications with their series (Settings -> Notifications "Scheduled" list). */
export function listScheduledDetailed(limit = 20): ScheduledDetail[] {
  return getDb()
    .getAllSync<{ fire_at: string; kind: string | null; ref_id: string | null }>(
      `SELECT s.fire_at, e.kind, e.ref_id FROM scheduled s LEFT JOIN event_series e ON e.id = s.series_id ORDER BY s.fire_at ASC LIMIT ${Math.max(0, Math.floor(limit))}`,
    )
    .map((r) => ({ fireAt: r.fire_at, kind: r.kind, refId: r.ref_id }));
}

export function clearScheduled(): void {
  getDb().runSync('DELETE FROM scheduled');
}

export function insertScheduled(rows: readonly Omit<ScheduledRow, 'id'>[]): void {
  const db = getDb();
  for (const r of rows) db.runSync('INSERT INTO scheduled (series_id, fire_at, notification_id) VALUES (?, ?, ?)', [r.seriesId, r.fireAt, r.notificationId]);
}
