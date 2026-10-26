// saved_muhurats repository (F26 "Save to Upcoming", plan.md section 2 schema; B05). One row per saved window: the
// activity id, start/end as ISO instants and the engine window's rule breakdown as JSON, so the saved list and the
// .ics export can re-read exactly what was scored. The Today model hands `toUpcomingSaved()` to engine.upcoming().
import type { MuhuratRule, MuhuratWindow, SavedMuhurat } from '@shubhvela/engine';
import { getDb } from './connection';

export interface SavedMuhuratRow {
  id: number;
  activity: string;
  /** UTC ms. */
  start: number;
  end: number;
  /** The scored window as saved (rules, met, day, choghadiya ...). */
  window: MuhuratWindow;
}

interface Row {
  id: number;
  activity: string;
  start: string;
  end: string;
  rules_json: string;
}

function fromRow(r: Row): SavedMuhuratRow {
  return { id: r.id, activity: r.activity, start: Date.parse(r.start), end: Date.parse(r.end), window: JSON.parse(r.rules_json) as MuhuratWindow };
}

export function listSavedMuhurats(): SavedMuhuratRow[] {
  return getDb()
    .getAllSync<Row>('SELECT id, activity, start, end, rules_json FROM saved_muhurats ORDER BY start ASC, id ASC')
    .map(fromRow);
}

export function countSavedMuhurats(): number {
  return getDb().getFirstSync<{ n: number }>('SELECT COUNT(*) AS n FROM saved_muhurats')?.n ?? 0;
}

/** The saved row for a window (same activity, start and end), or null. */
export function findSavedMuhurat(w: Pick<MuhuratWindow, 'activity' | 'start' | 'end'>): SavedMuhuratRow | null {
  const r = getDb().getFirstSync<Row>('SELECT id, activity, start, end, rules_json FROM saved_muhurats WHERE activity = ? AND start = ? AND end = ? LIMIT 1', [
    w.activity,
    new Date(w.start).toISOString(),
    new Date(w.end).toISOString(),
  ]);
  return r ? fromRow(r) : null;
}

/** Saves a scored window; saving the same window twice returns the existing id. */
export function saveMuhurat(w: MuhuratWindow): number {
  const existing = findSavedMuhurat(w);
  if (existing) return existing.id;
  const r = getDb().runSync('INSERT INTO saved_muhurats (activity, start, end, rules_json) VALUES (?, ?, ?, ?)', [
    w.activity,
    new Date(w.start).toISOString(),
    new Date(w.end).toISOString(),
    JSON.stringify(w),
  ]);
  return r.lastInsertRowId;
}

export function deleteSavedMuhurat(id: number): void {
  getDb().runSync('DELETE FROM saved_muhurats WHERE id = ?', [id]);
}

/** Shape engine.upcoming() takes for the "Saved muhurat" card (F7). */
export function toUpcomingSaved(rows: readonly SavedMuhuratRow[]): SavedMuhurat[] {
  return rows.map((r) => ({ id: String(r.id), activity: r.activity, start: r.start, end: r.end }));
}

/** Rules met of a saved window (the row caption "N/10 rules met"). */
export function savedRulesMet(row: SavedMuhuratRow): { met: number; of: number; rules: MuhuratRule[] } {
  return { met: row.window.met, of: row.window.of, rules: row.window.rules };
}
