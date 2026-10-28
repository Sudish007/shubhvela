// Offline place search over the bundled GeoNames gazetteer (plan.md P3, design.md 10.1 F1).
// The database handle is injected through a minimal interface so that expo-sqlite (app),
// node:sqlite (build scripts, tests) and sql.js (web, if ever needed) all fit.
// Data: packages/engine/data/gazetteer.sqlite, built by scripts/build-gazetteer.ts (copied to app/assets/).

export interface GazetteerDb {
  /** Runs a SELECT with positional `?` parameters and returns every row as a plain object. */
  all(sql: string, params: unknown[]): unknown[];
}

export interface Place {
  /** GeoNames id. */
  id: number;
  name: string;
  nameAscii: string;
  nameHi: string | null;
  /** First-level administrative division (state / province), when GeoNames has one. */
  admin1: string | null;
  /** ISO 3166-1 alpha-2 country code. */
  country: string;
  countryName: string;
  lat: number;
  lon: number;
  /** Metres above sea level (GeoNames DEM), when known. */
  elevation: number | null;
  population: number;
  /** Canonical IANA zone id (a key of data/tz-transitions.json). */
  tz: string;
}

interface PlaceRow {
  id: number;
  name: string;
  name_ascii: string;
  name_hi: string | null;
  admin1: string | null;
  country: string;
  country_name: string | null;
  lat: number;
  lon: number;
  elevation: number | null;
  population: number;
  tz: string;
}

const SELECT =
  'SELECT p.id, p.name, p.name_ascii, p.name_hi, p.admin1, p.country, c.name AS country_name, p.lat, p.lon, p.elevation, p.population, p.tz ' +
  'FROM places p LEFT JOIN countries c ON c.code = p.country';

function toPlace(r: PlaceRow): Place {
  return {
    id: r.id,
    name: r.name,
    nameAscii: r.name_ascii,
    nameHi: r.name_hi ?? null,
    admin1: r.admin1 ?? null,
    country: r.country,
    countryName: r.country_name ?? r.country,
    lat: r.lat,
    lon: r.lon,
    elevation: r.elevation ?? null,
    population: r.population,
    tz: r.tz,
  };
}

const DEVANAGARI = /[\u0900-\u097F]/;

/** Folds diacritics (Łódź -> Lodz) so Latin input matches GeoNames' ASCII names. */
export function foldToAscii(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/g, 'l')
    .replace(/Ł/g, 'L')
    .replace(/ø/g, 'o')
    .replace(/Ø/g, 'O')
    .replace(/ß/g, 'ss')
    .replace(/æ/g, 'ae')
    .replace(/œ/g, 'oe');
}

/**
 * Prefix search over name_ascii (Latin input, diacritics folded) or name_hi (Devanagari input),
 * ordered by population. Returns [] for blank input; never throws for ordinary text.
 * The LIKE pattern has no ESCAPE clause and no leading wildcard so SQLite's LIKE optimisation
 * can use the NOCASE indexes (wildcard characters typed by the user are dropped).
 */
export function searchPlaces(db: GazetteerDb, query: string, limit = 20): Place[] {
  const q = query.trim().replace(/[%_]/g, '').replace(/\s+/g, ' ');
  if (!q) return [];
  const lim = Math.max(1, Math.min(200, Math.floor(limit)));
  const isDevanagari = DEVANAGARI.test(q);
  const column = isDevanagari ? 'p.name_hi' : 'p.name_ascii';
  const needle = isDevanagari ? q : foldToAscii(q);
  const rows = db.all(
    `${SELECT} WHERE ${column} LIKE ? ORDER BY p.population DESC, p.name_ascii ASC LIMIT ?`,
    [`${needle}%`, lim],
  ) as PlaceRow[];
  if (!isDevanagari && needle !== q) {
    // Diacritics typed as in the local spelling (Zürich) when GeoNames' ASCII form transliterates
    // differently (Zuerich): also match the native name column and merge by population.
    const native = db.all(`${SELECT} WHERE p.name LIKE ? ORDER BY p.population DESC, p.name_ascii ASC LIMIT ?`, [`${q}%`, lim]) as PlaceRow[];
    const seen = new Set(rows.map((r) => r.id));
    for (const r of native) if (!seen.has(r.id)) rows.push(r);
    rows.sort((a, b) => b.population - a.population || a.name_ascii.localeCompare(b.name_ascii));
    rows.length = Math.min(rows.length, lim);
  }
  return rows.map(toPlace);
}

export function placeById(db: GazetteerDb, id: number): Place | undefined {
  const rows = db.all(`${SELECT} WHERE p.id = ?`, [id]) as PlaceRow[];
  return rows.length ? toPlace(rows[0]) : undefined;
}

/** Build metadata stored inside the database (source, dump date, tzdb, generated, schema). */
export function gazetteerMeta(db: GazetteerDb): Record<string, string> {
  const rows = db.all('SELECT key, value FROM meta', []) as { key: string; value: string }[];
  const out: Record<string, string> = {};
  for (const r of rows) out[r.key] = r.value;
  return out;
}

// C04 (F37): the 331 web-companion cities by slug for the shubhvela://panchang/<city> deep link.
export { WEB_CITIES, webCity, normaliseCitySlug, type WebCity } from './webCities';
