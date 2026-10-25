// Bundled GeoNames gazetteer (plan.md P3): copied from the APK asset into the SQLite directory once, re-copied only
// when the bundled build differs from the installed one (meta.generated), opened read-only and adapted to the
// engine's GazetteerDb interface. Offline search = engine.searchPlaces (name_ascii / name_hi prefix, population order).
import { gazetteerMeta, searchPlaces, type GazetteerDb, type Place } from '@shubhvela/engine';
import { importDatabaseFromAssetAsync, openDatabaseSync, type SQLiteBindParams } from 'expo-sqlite';
import bundledMeta from '../../../packages/engine/data/gazetteer.meta.json';

export const GAZETTEER_DB_NAME = 'gazetteer.sqlite';
// eslint-disable-next-line @typescript-eslint/no-require-imports -- Metro asset id (metro.config.js adds sqlite to assetExts)
const GAZETTEER_ASSET: number = require('../../assets/gazetteer.sqlite');

let handle: GazetteerDb | null = null;
let opening: Promise<GazetteerDb> | null = null;

function adapt(name: string): GazetteerDb {
  const raw = openDatabaseSync(name);
  return { all: (sql, params) => raw.getAllSync(sql, params as SQLiteBindParams) };
}

async function open(): Promise<GazetteerDb> {
  await importDatabaseFromAssetAsync(GAZETTEER_DB_NAME, { assetId: GAZETTEER_ASSET, forceOverwrite: false });
  let db = adapt(GAZETTEER_DB_NAME);
  let installed = '';
  try {
    installed = gazetteerMeta(db).generated ?? '';
  } catch {
    installed = '';
  }
  if (installed !== bundledMeta.generated) {
    // A newer (or corrupt) copy: replace it with the bundled file.
    await importDatabaseFromAssetAsync(GAZETTEER_DB_NAME, { assetId: GAZETTEER_ASSET, forceOverwrite: true });
    db = adapt(GAZETTEER_DB_NAME);
  }
  return db;
}

/** Resolves the shared read-only handle (imports the asset on first use). */
export function ensureGazetteer(): Promise<GazetteerDb> {
  if (handle) return Promise.resolve(handle);
  if (!opening) {
    opening = open().then((db) => {
      handle = db;
      return db;
    });
    opening.catch(() => {
      opening = null;
    });
  }
  return opening;
}

/** Offline place search; empty input -> []. Never throws for ordinary text (the engine strips wildcards). */
export async function searchGazetteer(query: string, limit = 20): Promise<Place[]> {
  const db = await ensureGazetteer();
  return searchPlaces(db, query, limit);
}

/** Test seam: install a prepared handle (node:sqlite over the committed file) instead of the asset import. */
export function setGazetteerForTests(db: GazetteerDb | null): void {
  handle = db;
  opening = null;
}
