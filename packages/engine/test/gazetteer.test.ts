import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { gazetteerMeta, placeById, searchPlaces, WEB_CITIES, webCity, type GazetteerDb } from '../src/gazetteer/index';
import { canonicalZone, hasZone } from '../src/tz/index';

const dataDir = resolve(__dirname, '..', 'data');
const dbPath = resolve(dataDir, 'gazetteer.sqlite');
const BUDGET = 8 * 1024 * 1024;

interface WebCity {
  geonameid: number;
  name: string;
  country: string;
  tz: string;
  slug: string;
  group: 'india' | 'nepal' | 'diaspora';
}

let raw: DatabaseSync;
let db: GazetteerDb;

beforeAll(() => {
  raw = new DatabaseSync(dbPath, { readOnly: true });
  db = { all: (sql, params) => raw.prepare(sql).all(...(params as (string | number)[])) as unknown[] };
});
afterAll(() => raw.close());

describe('gazetteer.sqlite (plan P3)', () => {
  it('exists, is <= 8 MB and matches the committed meta', () => {
    expect(existsSync(dbPath)).toBe(true);
    const bytes = statSync(dbPath).size;
    expect(bytes).toBeLessThanOrEqual(BUDGET);
    const meta = JSON.parse(readFileSync(resolve(dataDir, 'gazetteer.meta.json'), 'utf8')) as { bytes: number; counts: { rows: number } };
    expect(meta.bytes).toBe(bytes);
    const n = (raw.prepare('SELECT COUNT(*) AS n FROM places').get() as { n: number }).n;
    expect(n).toBe(meta.counts.rows);
    expect(n).toBeGreaterThan(30000);
  });

  it('the copy bundled with the app is byte-identical', () => {
    const appCopy = resolve(__dirname, '..', '..', '..', 'app', 'assets', 'gazetteer.sqlite');
    expect(existsSync(appCopy)).toBe(true);
    expect(readFileSync(appCopy).equals(readFileSync(dbPath))).toBe(true);
  });

  it('contains all 331 web cities (300 IN + Kathmandu + 30 diaspora)', () => {
    const web = JSON.parse(readFileSync(resolve(dataDir, 'web-cities.json'), 'utf8')) as { count: number; cities: WebCity[] };
    expect(web.count).toBe(331);
    expect(web.cities).toHaveLength(331);
    expect(web.cities.filter((c) => c.group === 'india')).toHaveLength(300);
    expect(web.cities.filter((c) => c.group === 'nepal')).toHaveLength(1);
    expect(web.cities.filter((c) => c.group === 'diaspora')).toHaveLength(30);
    expect(new Set(web.cities.map((c) => c.slug)).size).toBe(331);
    for (const c of web.cities) {
      const row = placeById(db, c.geonameid);
      expect(row, `${c.name} (${c.geonameid}) missing`).toBeDefined();
      expect(row!.tz).toBe(c.tz);
      expect(canonicalZone(c.tz)).toBe(c.tz);
    }
    const names = new Set(web.cities.map((c) => c.name));
    for (const must of ['Mumbai', 'Delhi', 'Kathmandu', 'London', 'Dubai', 'Port of Spain', 'Suva', 'Edison', 'Leicester', 'Port Louis']) {
      expect(names.has(must), must).toBe(true);
    }
  });

  it('webCity() resolves every published slug and rejects unknown ones (F37 panchang deep link)', () => {
    expect(WEB_CITIES).toHaveLength(331);
    for (const c of WEB_CITIES) expect(webCity(c.slug)?.geonameid).toBe(c.geonameid);
    expect(webCity('Delhi')?.slug).toBe('delhi');
    expect(webCity(' new_delhi ')?.slug).toBe('new-delhi');
    expect(webCity('kathmandu')?.tz).toBe('Asia/Kathmandu');
    expect(webCity('atlantis')).toBeNull();
    expect(webCity('')).toBeNull();
  });

  it("every row's tz is a canonical id of the tz table (N8)", () => {
    const zones = raw.prepare('SELECT DISTINCT tz FROM places').all() as { tz: string }[];
    expect(zones.length).toBeGreaterThan(200);
    for (const { tz } of zones) {
      expect(hasZone(tz), tz).toBe(true);
      expect(canonicalZone(tz), tz).toBe(tz);
    }
  });

  it("searchPlaces('patn') returns Patna (Bihar) first, ordered by population", () => {
    const rows = searchPlaces(db, 'patn', 10);
    expect(rows.length).toBeGreaterThan(1);
    expect(rows[0].name).toBe('Patna');
    expect(rows[0].admin1).toBe('Bihar');
    expect(rows[0].country).toBe('IN');
    expect(rows[0].tz).toBe('Asia/Kolkata');
    for (let i = 1; i < rows.length; i++) expect(rows[i].population).toBeLessThanOrEqual(rows[i - 1].population);
  });

  it('Devanagari input searches name_hi', () => {
    const rows = searchPlaces(db, 'पटना', 5);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].name).toBe('Patna');
    expect(rows[0].nameHi).toBe('पटना');
    const lko = searchPlaces(db, 'लख', 5);
    expect(lko.some((r) => r.name === 'Lucknow')).toBe(true);
  });

  it('is case-insensitive, folds diacritics and ignores wildcards', () => {
    expect(searchPlaces(db, 'LUCKNOW', 3)[0].name).toBe('Lucknow');
    expect(searchPlaces(db, 'São Paulo', 3)[0].name).toBe('São Paulo'); // GeoNames ascii "Sao Paulo"
    expect(searchPlaces(db, 'Zürich', 3)[0].name).toBe('Zürich'); // GeoNames ascii "Zuerich": matched on the native name
    expect(searchPlaces(db, '%', 3)).toEqual([]);
    expect(searchPlaces(db, '   ', 3)).toEqual([]);
    expect(searchPlaces(db, 'a_%', 3).every((r) => /^a/i.test(r.nameAscii))).toBe(true);
  });

  it('placeById returns the full row with country name and elevation', () => {
    const delhi = placeById(db, 1273294);
    expect(delhi).toBeDefined();
    expect(delhi!.name).toBe('Delhi');
    expect(delhi!.countryName).toBe('India');
    expect(delhi!.lat).toBeCloseTo(28.65, 1);
    expect(delhi!.lon).toBeCloseTo(77.22, 1);
    expect(typeof delhi!.elevation === 'number' || delhi!.elevation === null).toBe(true);
    expect(placeById(db, 1)).toBeUndefined();
  });

  it('records its provenance in the meta table', () => {
    const meta = gazetteerMeta(db);
    expect(meta.source).toMatch(/GeoNames/);
    expect(meta.tzdb).toMatch(/^20\d\d[a-z]$/);
    expect(meta.dump_last_modified).toMatch(/GMT$/);
  });
});
