// The plaintext inside a backup (spec section 10, design.md 10.1, plan C04 step 3): raw rows of the user tables
// {version, profiles, ancestors, event_series, journal, settings, saved_muhurats, lessons_done, prashna}. Rows are
// copied column-for-column so nothing is reinterpreted on export; the importer validates the shape and remaps ids on
// Merge. Entitlements, purchases, unlocks and app_state (consent, session counters) are NOT in the file: Pro comes back
// from Play (backup.proNotIncluded) and the model is re-downloaded (backup.modelNotIncluded).
import type { Db } from '../db/types';

export const BACKUP_VERSION = 1;

export const BACKUP_TABLES = ['profiles', 'ancestors', 'event_series', 'journal', 'settings', 'saved_muhurats', 'lessons_done', 'prashna'] as const;
export type BackupTable = (typeof BACKUP_TABLES)[number];

export type Row = Record<string, string | number | null>;

export interface BackupDocument {
  version: number;
  app: string;
  appVersion: string;
  createdAt: string;
  schemaVersion: number;
  tables: Record<BackupTable, Row[]>;
}

export interface BackupCounts {
  profiles: number;
  ancestors: number;
  /** Enabled reminder series in the file. */
  reminders: number;
  journal: number;
  prashna: number;
  muhurats: number;
  lessons: number;
}

export function countsOf(doc: BackupDocument): BackupCounts {
  const t = doc.tables;
  return {
    profiles: t.profiles.length,
    ancestors: t.ancestors.length,
    reminders: t.event_series.filter((r) => Number(r.enabled) === 1).length,
    journal: t.journal.length,
    prashna: t.prashna.length,
    muhurats: t.saved_muhurats.length,
    lessons: t.lessons_done.length,
  };
}

export function totalItems(c: BackupCounts): number {
  return c.profiles + c.ancestors + c.reminders + c.journal + c.prashna + c.muhurats + c.lessons;
}

/** Reads every backup table as raw rows (column names as in schema.ts). */
export function collectBackup(db: Db, meta: { appVersion: string; schemaVersion: number; now?: Date }): BackupDocument {
  const tables = {} as Record<BackupTable, Row[]>;
  for (const t of BACKUP_TABLES) tables[t] = db.getAllSync<Row>(`SELECT * FROM ${t}`);
  return { version: BACKUP_VERSION, app: 'shubhvela', appVersion: meta.appVersion, createdAt: (meta.now ?? new Date()).toISOString(), schemaVersion: meta.schemaVersion, tables };
}

export type ParseProblem = 'format' | 'newer';

/** Validates the decrypted JSON; 'newer' when the file's version is above this app's (design.md 11). */
export function parseBackupDocument(json: string): { ok: true; doc: BackupDocument } | { ok: false; problem: ParseProblem } {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { ok: false, problem: 'format' };
  }
  if (!raw || typeof raw !== 'object') return { ok: false, problem: 'format' };
  const d = raw as Partial<BackupDocument>;
  if (d.app !== 'shubhvela' || typeof d.version !== 'number') return { ok: false, problem: 'format' };
  if (d.version > BACKUP_VERSION) return { ok: false, problem: 'newer' };
  if (!d.tables || typeof d.tables !== 'object') return { ok: false, problem: 'format' };
  const tables = {} as Record<BackupTable, Row[]>;
  for (const t of BACKUP_TABLES) {
    const rows = (d.tables as Record<string, unknown>)[t];
    if (rows === undefined) {
      tables[t] = [];
      continue;
    }
    if (!Array.isArray(rows) || rows.some((r) => !r || typeof r !== 'object' || Array.isArray(r))) return { ok: false, problem: 'format' };
    tables[t] = rows as Row[];
  }
  return {
    ok: true,
    doc: { version: d.version, app: 'shubhvela', appVersion: typeof d.appVersion === 'string' ? d.appVersion : '?', createdAt: typeof d.createdAt === 'string' ? d.createdAt : '', schemaVersion: typeof d.schemaVersion === 'number' ? d.schemaVersion : 0, tables },
  };
}
