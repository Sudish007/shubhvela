// Test database: node:sqlite (Node >= 22.5, built in) behind the app's Db interface, so repositories, migrations,
// entitlements and the ThemeProvider run against a real SQLite engine in Jest without expo-sqlite's native module.
import { DatabaseSync } from 'node:sqlite';
import { setDb } from '../../src/db/connection';
import { migrate } from '../../src/db/migrations';
import type { Db } from '../../src/db/types';

type Param = null | number | bigint | string | Uint8Array;

function bind(params: unknown[]): Param[] {
  return params.map((p) => (p === undefined ? null : typeof p === 'boolean' ? (p ? 1 : 0) : (p as Param)));
}

export function wrapNodeDb(raw: DatabaseSync): Db {
  return {
    execSync: (sql) => raw.exec(sql),
    runSync: (sql, params = []) => {
      const r = raw.prepare(sql).run(...bind(params));
      return { changes: Number(r.changes), lastInsertRowId: Number(r.lastInsertRowid) };
    },
    getFirstSync: <T>(sql: string, params: unknown[] = []) => (raw.prepare(sql).get(...bind(params)) as T | undefined) ?? null,
    getAllSync: <T>(sql: string, params: unknown[] = []) => raw.prepare(sql).all(...bind(params)) as T[],
  };
}

/** Fresh in-memory app database, migrated and installed as THE connection. Returns a disposer. */
export function installTestDb(): { db: Db; close: () => void } {
  const raw = new DatabaseSync(':memory:');
  const db = wrapNodeDb(raw);
  migrate(db);
  setDb(db);
  return {
    db,
    close: () => {
      setDb(null);
      raw.close();
    },
  };
}
