// Minimal synchronous database interface. expo-sqlite's SQLiteDatabase satisfies it on the device (db/open.ts);
// tests wrap node:sqlite (test/helpers/nodeDb.ts). Repositories only ever see this shape.
export interface RunResult {
  changes: number;
  lastInsertRowId: number;
}

export interface Db {
  execSync(sql: string): void;
  runSync(sql: string, params?: unknown[]): RunResult;
  getFirstSync<T>(sql: string, params?: unknown[]): T | null;
  getAllSync<T>(sql: string, params?: unknown[]): T[];
}
