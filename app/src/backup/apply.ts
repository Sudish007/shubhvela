// Applies a parsed backup to the database in ONE transaction (design.md 11: "nothing imported" on any failure):
//   Replace - every backup table (and the scheduled notifications, which the planner rebuilds) is emptied first, then
//             the file's rows are inserted with their own ids;
//   Merge   - what is on the phone stays; file rows that match an existing item (same birth facts / same ancestor /
//             same day / same key / same window / same question+instant) update it, others are inserted with new ids,
//             and the reminder series that point at profiles/ancestors are remapped to the new ids. The phone keeps
//             its self profile: a second "self" from the file becomes an ordinary family member.
// Entitlements, purchases, unlocks and app_state are never touched. Pure SQL over the Db interface (unit-tested on
// node:sqlite); the caller clears the chart cache and re-plans reminders afterwards.
import { getDb } from '../db/connection';
import type { Db } from '../db/types';
import { BACKUP_TABLES, type BackupDocument, type Row } from './document';

export type ImportMode = 'merge' | 'replace';

export interface ApplyResult {
  mode: ImportMode;
  inserted: number;
  updated: number;
}

/** Columns of each table in the live schema (so a file with extra/unknown columns never breaks the INSERT). */
function columnsOf(db: Db, table: string): string[] {
  return db.getAllSync<{ name: string }>(`PRAGMA table_info(${table})`).map((r) => r.name);
}

function pick(row: Row, cols: string[], drop: string[] = []): { cols: string[]; values: (string | number | null)[] } {
  const keep = cols.filter((c) => c in row && !drop.includes(c));
  return { cols: keep, values: keep.map((c) => row[c] ?? null) };
}

function insert(db: Db, table: string, row: Row, cols: string[], drop: string[] = []): number {
  const p = pick(row, cols, drop);
  if (!p.cols.length) throw new Error(`backup row for ${table} has no known column`);
  const r = db.runSync(`INSERT INTO ${table} (${p.cols.join(', ')}) VALUES (${p.cols.map(() => '?').join(', ')})`, p.values);
  return r.lastInsertRowId;
}

function update(db: Db, table: string, row: Row, cols: string[], where: string, whereArgs: (string | number | null)[], drop: string[]): void {
  const p = pick(row, cols, drop);
  if (!p.cols.length) return;
  db.runSync(`UPDATE ${table} SET ${p.cols.map((c) => `${c} = ?`).join(', ')} WHERE ${where}`, [...p.values, ...whereArgs]);
}

function same(a: string | number | null | undefined, b: string | number | null | undefined): boolean {
  return (a ?? null) === (b ?? null) || (typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) < 1e-9);
}

export function applyBackup(doc: BackupDocument, mode: ImportMode, db: Db = getDb()): ApplyResult {
  const cols = Object.fromEntries(BACKUP_TABLES.map((t) => [t, columnsOf(db, t)])) as Record<(typeof BACKUP_TABLES)[number], string[]>;
  let inserted = 0;
  let updated = 0;
  db.execSync('BEGIN');
  try {
    if (mode === 'replace') {
      for (const t of BACKUP_TABLES) db.execSync(`DELETE FROM ${t}`);
      db.execSync('DELETE FROM scheduled');
      for (const t of BACKUP_TABLES) {
        for (const row of doc.tables[t]) {
          insert(db, t, row, cols[t]);
          inserted++;
        }
      }
    } else {
      // Profiles: match on the birth facts + name; the phone's self stays self.
      const existingProfiles = db.getAllSync<Row>('SELECT * FROM profiles');
      const hasSelf = existingProfiles.some((p) => Number(p.is_self) === 1);
      const profileIds = new Map<string, number>();
      for (const row of doc.tables.profiles) {
        const hit = existingProfiles.find((e) => same(e.birth_date, row.birth_date) && same(e.birth_time, row.birth_time) && same(e.lat, row.lat) && same(e.lon, row.lon) && same(e.tz, row.tz) && same(e.name, row.name));
        if (hit) {
          update(db, 'profiles', row, cols.profiles, 'id = ?', [hit.id], ['id', 'is_self', 'created_at']);
          profileIds.set(String(row.id), Number(hit.id));
          updated++;
        } else {
          const r = { ...row };
          if (hasSelf && Number(r.is_self) === 1) r.is_self = 0;
          const id = insert(db, 'profiles', r, cols.profiles, ['id']);
          profileIds.set(String(row.id), id);
          inserted++;
        }
      }
      // Ancestors: match on the record itself (name, relation, month, paksha, tithi).
      const existingAncestors = db.getAllSync<Row>('SELECT * FROM ancestors');
      const ancestorIds = new Map<string, number>();
      for (const row of doc.tables.ancestors) {
        const hit = existingAncestors.find((e) => same(e.name, row.name) && same(e.relation, row.relation) && same(e.death_month, row.death_month) && same(e.paksha, row.paksha) && same(e.tithi, row.tithi));
        if (hit) {
          update(db, 'ancestors', row, cols.ancestors, 'id = ?', [hit.id], ['id']);
          ancestorIds.set(String(row.id), Number(hit.id));
          updated++;
        } else {
          const id = insert(db, 'ancestors', row, cols.ancestors, ['id']);
          ancestorIds.set(String(row.id), id);
          inserted++;
        }
      }
      // Reminder series: remap the profile / ancestor references, upsert on (kind, ref_id).
      for (const row of doc.tables.event_series) {
        const kind = String(row.kind);
        let ref = String(row.ref_id);
        if (kind === 'tithi_birthday') {
          const m = profileIds.get(ref);
          if (m === undefined) continue;
          ref = String(m);
        } else if (kind === 'barsi') {
          const m = ancestorIds.get(ref);
          if (m === undefined) continue;
          ref = String(m);
        }
        const r = db.runSync('INSERT INTO event_series (kind, ref_id, enabled) VALUES (?, ?, ?) ON CONFLICT(kind, ref_id) DO UPDATE SET enabled = excluded.enabled', [kind, ref, Number(row.enabled) ? 1 : 0]);
        if (r.changes) inserted++;
      }
      for (const row of doc.tables.journal) {
        const r = db.runSync('INSERT INTO journal (day, mood, note) VALUES (?, ?, ?) ON CONFLICT(day) DO UPDATE SET mood = excluded.mood, note = excluded.note', [row.day, row.mood ?? null, row.note ?? null]);
        if (r.changes) inserted++;
      }
      for (const row of doc.tables.settings) {
        const r = db.runSync('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [row.key, row.value]);
        if (r.changes) updated++;
      }
      const existingMuhurats = db.getAllSync<Row>('SELECT * FROM saved_muhurats');
      for (const row of doc.tables.saved_muhurats) {
        const hit = existingMuhurats.find((e) => same(e.activity, row.activity) && same(e.start, row.start) && same(e.end, row.end));
        if (hit) {
          update(db, 'saved_muhurats', row, cols.saved_muhurats, 'id = ?', [hit.id], ['id']);
          updated++;
        } else {
          insert(db, 'saved_muhurats', row, cols.saved_muhurats, ['id']);
          inserted++;
        }
      }
      for (const row of doc.tables.lessons_done) {
        const r = db.runSync('INSERT INTO lessons_done (lesson_id, done_at) VALUES (?, ?) ON CONFLICT(lesson_id) DO UPDATE SET done_at = excluded.done_at', [row.lesson_id, row.done_at]);
        if (r.changes) inserted++;
      }
      const existingPrashna = db.getAllSync<Row>('SELECT * FROM prashna');
      for (const row of doc.tables.prashna) {
        if (existingPrashna.some((e) => same(e.question, row.question) && same(e.ts, row.ts))) continue;
        insert(db, 'prashna', row, cols.prashna, ['id']);
        inserted++;
      }
    }
    db.execSync('COMMIT');
  } catch (e) {
    db.execSync('ROLLBACK');
    throw e;
  }
  return { mode, inserted, updated };
}
