// Opens the app database with expo-sqlite (WAL), runs migrations and installs the handle for the repositories.
// Called once from app/app/_layout.tsx at module load so the ThemeProvider can read the persisted theme
// synchronously before the first paint (D9: light first paint, never a flash of the wrong theme).
import { openDatabaseSync, type SQLiteBindParams, type SQLiteDatabase } from 'expo-sqlite';
import { getDb, hasDb, setDb } from './connection';
import { migrate } from './migrations';
import type { Db } from './types';

export const APP_DB_NAME = 'shubhvela.db';

function wrap(raw: SQLiteDatabase): Db {
  return {
    execSync: (sql) => raw.execSync(sql),
    runSync: (sql, params = []) => {
      const r = raw.runSync(sql, params as SQLiteBindParams);
      return { changes: r.changes, lastInsertRowId: r.lastInsertRowId };
    },
    getFirstSync: <T>(sql: string, params: unknown[] = []) => raw.getFirstSync<T>(sql, params as SQLiteBindParams),
    getAllSync: <T>(sql: string, params: unknown[] = []) => raw.getAllSync<T>(sql, params as SQLiteBindParams),
  };
}

/** Idempotent: opens, enables WAL + foreign keys, migrates, registers. Returns the installed handle. */
export function initAppDb(): Db {
  if (hasDb()) return getDb(); // hot reload, or a test adapter installed earlier
  const raw = openDatabaseSync(APP_DB_NAME);
  raw.execSync('PRAGMA journal_mode = WAL');
  raw.execSync('PRAGMA foreign_keys = ON');
  const db = wrap(raw);
  migrate(db);
  setDb(db);
  return db;
}
