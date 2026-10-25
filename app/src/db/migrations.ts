// Applies the numbered migrations of schema.ts; idempotent and synchronous (runs before the first render).
import { MIGRATIONS, SCHEMA_VERSION } from './schema';
import type { Db } from './types';

export function currentVersion(db: Db): number {
  const row = db.getFirstSync<{ user_version: number }>('PRAGMA user_version');
  return row?.user_version ?? 0;
}

/** Runs every migration above the stored user_version and returns the version now in force. */
export function migrate(db: Db): number {
  let v = currentVersion(db);
  while (v < MIGRATIONS.length) {
    db.execSync('BEGIN');
    try {
      db.execSync(MIGRATIONS[v]);
      v += 1;
      db.execSync(`PRAGMA user_version = ${v}`);
      db.execSync('COMMIT');
    } catch (e) {
      db.execSync('ROLLBACK');
      throw e;
    }
  }
  if (v !== SCHEMA_VERSION) {
    throw new Error(`schema.ts declares SCHEMA_VERSION ${SCHEMA_VERSION} but ${MIGRATIONS.length} migrations exist`);
  }
  return v;
}
