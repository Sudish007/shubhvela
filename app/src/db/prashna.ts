// Prashna history (F18, design.md 10.3): the question, the UTC instant it was asked and the place it was asked at
// (plan.md section 2 schema `prashna(question, ts, lat, lon)`), plus the zone so the stored reading renders in the
// zone of the moment. Nothing else is stored: the chart of the moment is recomputed from these four facts whenever the
// entry is opened, so the history can never drift from the engine (D8). Exported by the encrypted backup (C04).
import { getDb } from './connection';

export interface PrashnaRow {
  id: number;
  question: string;
  /** UTC ISO instant the question was asked. */
  ts: string;
  lat: number;
  lon: number;
  /** Canonical IANA zone of the place (column added by migration v3; older rows fall back to UTC). */
  tz: string;
}

interface Row {
  id: number;
  question: string;
  ts: string;
  lat: number;
  lon: number;
  tz: string | null;
}

function fromRow(r: Row): PrashnaRow {
  return { id: r.id, question: r.question, ts: r.ts, lat: r.lat, lon: r.lon, tz: r.tz ?? 'UTC' };
}

/** Newest first. */
export function listPrashna(): PrashnaRow[] {
  return getDb()
    .getAllSync<Row>('SELECT id, question, ts, lat, lon, tz FROM prashna ORDER BY ts DESC, id DESC')
    .map(fromRow);
}

export function getPrashna(id: number): PrashnaRow | null {
  const row = getDb().getFirstSync<Row>('SELECT id, question, ts, lat, lon, tz FROM prashna WHERE id = ?', [id]);
  return row ? fromRow(row) : null;
}

export function insertPrashna(input: { question: string; ts: string; lat: number; lon: number; tz: string }): number {
  const r = getDb().runSync('INSERT INTO prashna (question, ts, lat, lon, tz) VALUES (?, ?, ?, ?, ?)', [input.question.trim(), input.ts, input.lat, input.lon, input.tz]);
  return r.lastInsertRowId;
}

export function deletePrashna(id: number): void {
  getDb().runSync('DELETE FROM prashna WHERE id = ?', [id]);
}

export function countPrashna(): number {
  return getDb().getFirstSync<{ n: number }>('SELECT COUNT(*) AS n FROM prashna')?.n ?? 0;
}
