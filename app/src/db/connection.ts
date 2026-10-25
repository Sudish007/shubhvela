// The one process-wide database handle. db/open.ts installs the expo-sqlite connection at app start (before the
// first render, so settings can be read synchronously); tests install a node:sqlite adapter. Nothing in this file
// imports a native module, so every repository and the ThemeProvider stay importable under Jest.
import type { Db } from './types';

let current: Db | null = null;

export function setDb(db: Db | null): void {
  current = db;
}

export function hasDb(): boolean {
  return current !== null;
}

export function getDb(): Db {
  if (!current) {
    throw new Error('Database not initialised: call initAppDb() (app/src/db/open.ts) before using repositories');
  }
  return current;
}
