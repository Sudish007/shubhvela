// Builds the offline gazetteer (plan.md P3): packages/engine/data/gazetteer.sqlite + gazetteer.meta.json
// + web-cities.json, from GeoNames dumps (CC BY 4.0, attribution in THIRD-PARTY-NOTICES.md).
// Run with: npx tsx packages/engine/scripts/build-gazetteer.ts   (part of `npm run build:data`)
//
// Downloads are cached in $env:TEMP/shubhvela-geonames (never inside the repo). Rows:
//   cities1000 for IN NP BD LK PK BT + cities15000 for every other country + the 331 web cities forced in.
// Columns: id, name, name_ascii, name_hi, admin1, country, lat, lon, elevation, population, tz
//   where tz is the GeoNames zone normalised to the engine tz table's canonical id (N8).
// Budget: <= 8 MB (asserted by test/gazetteer.test.ts).
import { createWriteStream, existsSync, mkdirSync, readFileSync, statSync, unlinkSync, writeFileSync, copyFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateRawSync } from 'node:zlib';
import { DatabaseSync } from 'node:sqlite';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { canonicalZone, TZDB_VERSION } from '../src/tz/index';

const here = dirname(fileURLToPath(import.meta.url));
const engineRoot = resolve(here, '..');
const repoRoot = resolve(engineRoot, '..', '..');
const dataDir = resolve(engineRoot, 'data');
const cacheDir = resolve(process.env.TEMP || process.env.TMPDIR || '/tmp', 'shubhvela-geonames');
mkdirSync(cacheDir, { recursive: true });
mkdirSync(dataDir, { recursive: true });

const BASE = 'https://download.geonames.org/export/dump/';
const SOURCES = [
  { file: 'cities1000.zip', entry: 'cities1000.txt' },
  { file: 'cities15000.zip', entry: 'cities15000.txt' },
  { file: 'alternatenames/IN.zip', entry: 'IN.txt' },
  { file: 'alternatenames/NP.zip', entry: 'NP.txt' },
  { file: 'admin1CodesASCII.txt', entry: null },
  { file: 'countryInfo.txt', entry: null },
] as const;

const CITIES1000_COUNTRIES = new Set(['IN', 'NP', 'BD', 'LK', 'PK', 'BT']);
const HINDI_NAME_COUNTRIES = new Set(['IN', 'NP']);
// Feature codes excluded from the "largest Indian cities" web list (sections of cities, historical,
// abandoned, destroyed places). They stay searchable in the gazetteer.
const WEB_EXCLUDED_FEATURE_CODES = new Set(['PPLX', 'PPLH', 'PPLQ', 'PPLW', 'PPLCH', 'PPLF', 'PPLR', 'STLMT']);

// plan.md P3 diaspora list (30). Resolved against the dumps by name + country (+ admin1 where the
// country has several towns of that name); the build prints what it resolved.
const DIASPORA: { name: string; country: string; admin1?: string }[] = [
  { name: 'London', country: 'GB', admin1: 'ENG' },
  { name: 'Birmingham', country: 'GB', admin1: 'ENG' },
  { name: 'Leicester', country: 'GB', admin1: 'ENG' },
  { name: 'New York City', country: 'US', admin1: 'NY' },
  { name: 'Edison', country: 'US', admin1: 'NJ' },
  { name: 'Chicago', country: 'US', admin1: 'IL' },
  { name: 'Houston', country: 'US', admin1: 'TX' },
  { name: 'Dallas', country: 'US', admin1: 'TX' },
  { name: 'San Jose', country: 'US', admin1: 'CA' },
  { name: 'Los Angeles', country: 'US', admin1: 'CA' },
  { name: 'Atlanta', country: 'US', admin1: 'GA' },
  { name: 'Washington', country: 'US', admin1: 'DC' },
  { name: 'Toronto', country: 'CA', admin1: '08' },
  { name: 'Vancouver', country: 'CA', admin1: '02' },
  { name: 'Dubai', country: 'AE' },
  { name: 'Abu Dhabi', country: 'AE' },
  { name: 'Sharjah', country: 'AE' },
  { name: 'Doha', country: 'QA' },
  { name: 'Muscat', country: 'OM' },
  { name: 'Riyadh', country: 'SA' },
  { name: 'Kuwait City', country: 'KW' },
  { name: 'Singapore', country: 'SG' },
  { name: 'Kuala Lumpur', country: 'MY' },
  { name: 'Sydney', country: 'AU', admin1: '02' },
  { name: 'Melbourne', country: 'AU', admin1: '07' },
  { name: 'Auckland', country: 'NZ' },
  { name: 'Durban', country: 'ZA' },
  { name: 'Port Louis', country: 'MU' },
  { name: 'Port of Spain', country: 'TT' },
  { name: 'Suva', country: 'FJ' },
];

interface SourceMeta {
  file: string;
  url: string;
  bytes: number;
  lastModified: string | null;
  cached: boolean;
}

async function download(file: string): Promise<SourceMeta> {
  const url = BASE + file;
  const target = join(cacheDir, file.replace('/', '__'));
  const headerFile = target + '.headers.json';
  if (existsSync(target) && existsSync(headerFile)) {
    const h = JSON.parse(readFileSync(headerFile, 'utf8')) as { lastModified: string | null };
    return { file, url, bytes: statSync(target).size, lastModified: h.lastModified, cached: true };
  }
  process.stdout.write(`  downloading ${url} ... `);
  const res = await fetch(url, { headers: { 'User-Agent': 'Shubhvela-build (+https://sudish007.github.io/shubhvela/)' } });
  if (!res.ok || !res.body) throw new Error(`${url}: HTTP ${res.status}`);
  const tmp = target + '.part';
  await pipeline(Readable.fromWeb(res.body as never), createWriteStream(tmp));
  if (existsSync(target)) unlinkSync(target);
  // rename via copy to avoid cross-device issues on some TEMP setups
  copyFileSync(tmp, target);
  unlinkSync(tmp);
  const lastModified = res.headers.get('last-modified');
  writeFileSync(headerFile, JSON.stringify({ lastModified, fetchedAt: new Date().toISOString() }), 'utf8');
  const bytes = statSync(target).size;
  console.log(`${(bytes / 1024).toFixed(0)} KB`);
  return { file, url, bytes, lastModified, cached: false };
}

/** Minimal ZIP reader (central directory + inflateRaw); the GeoNames dumps use deflate and are < 4 GB. */
function readZipEntry(zipPath: string, entryName: string): Buffer {
  const buf = readFileSync(zipPath);
  // End of central directory record: signature 0x06054b50, scan backwards (comment may follow).
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65_535); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error(`${zipPath}: no end-of-central-directory record`);
  const entryCount = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  for (let n = 0; n < entryCount; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error(`${zipPath}: bad central directory entry`);
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOffset = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    p += 46 + nameLen + extraLen + commentLen;
    if (name !== entryName) continue;
    if (buf.readUInt32LE(localOffset) !== 0x04034b50) throw new Error(`${zipPath}: bad local header for ${name}`);
    const lNameLen = buf.readUInt16LE(localOffset + 26);
    const lExtraLen = buf.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + lNameLen + lExtraLen;
    const data = buf.subarray(dataStart, dataStart + compSize);
    if (method === 0) return Buffer.from(data);
    if (method === 8) return inflateRawSync(data);
    throw new Error(`${zipPath}: unsupported compression method ${method} for ${name}`);
  }
  throw new Error(`${zipPath}: entry ${entryName} not found`);
}

function readSource(file: string, entry: string | null): string {
  const target = join(cacheDir, file.replace('/', '__'));
  return entry ? readZipEntry(target, entry).toString('utf8') : readFileSync(target, 'utf8');
}

interface CityRow {
  id: number;
  name: string;
  nameAscii: string;
  lat: number;
  lon: number;
  featureCode: string;
  country: string;
  admin1Code: string;
  population: number;
  elevation: number | null;
  tz: string;
}

function parseCities(text: string): CityRow[] {
  const rows: CityRow[] = [];
  for (const line of text.split('\n')) {
    if (!line) continue;
    const c = line.split('\t');
    if (c.length < 18) continue;
    const dem = parseInt(c[16], 10);
    rows.push({
      id: parseInt(c[0], 10),
      name: c[1],
      nameAscii: c[2],
      lat: parseFloat(c[4]),
      lon: parseFloat(c[5]),
      featureCode: c[7],
      country: c[8],
      admin1Code: c[10],
      population: parseInt(c[14], 10) || 0,
      elevation: Number.isFinite(dem) && dem !== -9999 ? dem : null,
      tz: c[17],
    });
  }
  return rows;
}

function parseHindiNames(text: string): Map<number, string> {
  const preferred = new Map<number, string>();
  const first = new Map<number, string>();
  for (const line of text.split('\n')) {
    if (!line) continue;
    const c = line.split('\t');
    if (c[2] !== 'hi') continue;
    if (c[7] === '1') continue; // historic
    const id = parseInt(c[1], 10);
    const name = c[3].trim();
    if (!name) continue;
    if (c[4] === '1' && !preferred.has(id)) preferred.set(id, name);
    if (!first.has(id)) first.set(id, name);
  }
  const out = new Map<number, string>(first);
  for (const [id, name] of preferred) out.set(id, name);
  return out;
}

function parseAdmin1(text: string): Map<string, string> {
  const m = new Map<string, string>();
  for (const line of text.split('\n')) {
    if (!line) continue;
    const c = line.split('\t');
    if (c.length < 2) continue;
    m.set(c[0], c[1]);
  }
  return m;
}

function parseCountries(text: string): Map<string, string> {
  const m = new Map<string, string>();
  for (const line of text.split('\n')) {
    if (!line || line.startsWith('#')) continue;
    const c = line.split('\t');
    if (c.length < 5) continue;
    m.set(c[0], c[4]);
  }
  return m;
}

function slugify(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function main(): Promise<void> {
  console.log(`build-gazetteer: cache ${cacheDir}`);
  const sources: SourceMeta[] = [];
  for (const s of SOURCES) sources.push(await download(s.file));

  const cities1000 = parseCities(readSource('cities1000.zip', 'cities1000.txt'));
  const cities15000 = parseCities(readSource('cities15000.zip', 'cities15000.txt'));
  const hindi = new Map<number, string>([
    ...parseHindiNames(readSource('alternatenames/IN.zip', 'IN.txt')),
    ...parseHindiNames(readSource('alternatenames/NP.zip', 'NP.txt')),
  ]);
  const admin1 = parseAdmin1(readSource('admin1CodesASCII.txt', null));
  const countries = parseCountries(readSource('countryInfo.txt', null));
  console.log(`  cities1000 ${cities1000.length} rows, cities15000 ${cities15000.length} rows, hindi names ${hindi.size}, admin1 ${admin1.size}, countries ${countries.size}`);

  // --- Row selection ---
  const byId = new Map<number, CityRow>();
  for (const r of cities1000) if (CITIES1000_COUNTRIES.has(r.country)) byId.set(r.id, r);
  for (const r of cities15000) if (!CITIES1000_COUNTRIES.has(r.country)) byId.set(r.id, r);
  const union = new Map<number, CityRow>();
  for (const r of cities1000) union.set(r.id, r);
  for (const r of cities15000) if (!union.has(r.id)) union.set(r.id, r);

  // --- Web cities: 300 largest Indian cities + Kathmandu + 30 diaspora (plan P3) ---
  const india = cities1000
    .filter((r) => r.country === 'IN' && !WEB_EXCLUDED_FEATURE_CODES.has(r.featureCode) && r.population > 0)
    .sort((a, b) => b.population - a.population || a.id - b.id)
    .slice(0, 300);
  const resolveNamed = (spec: { name: string; country: string; admin1?: string }): CityRow => {
    const want = spec.name.toLowerCase();
    const candidates = [...union.values()].filter(
      (r) =>
        r.country === spec.country &&
        (!spec.admin1 || r.admin1Code === spec.admin1) &&
        (r.name.toLowerCase() === want || r.nameAscii.toLowerCase() === want),
    );
    if (candidates.length === 0) throw new Error(`web city not found in GeoNames dumps: ${spec.name} (${spec.country})`);
    candidates.sort((a, b) => b.population - a.population);
    return candidates[0];
  };
  const kathmandu = resolveNamed({ name: 'Kathmandu', country: 'NP' });
  const diaspora = DIASPORA.map(resolveNamed);
  const webRows: { row: CityRow; group: 'india' | 'nepal' | 'diaspora' }[] = [
    ...india.map((row) => ({ row, group: 'india' as const })),
    { row: kathmandu, group: 'nepal' as const },
    ...diaspora.map((row) => ({ row, group: 'diaspora' as const })),
  ];
  if (webRows.length !== 331) throw new Error(`expected 331 web cities, got ${webRows.length}`);
  const ids = new Set(webRows.map((w) => w.row.id));
  if (ids.size !== 331) throw new Error('duplicate geonameid in the web city set');
  for (const w of webRows) byId.set(w.row.id, w.row); // force in

  // --- Zone normalisation (N8) ---
  const missingZones = new Set<string>();
  const zoneOf = (tz: string): string => {
    const c = canonicalZone(tz);
    if (!c) missingZones.add(tz);
    return c ?? tz;
  };
  const rows = [...byId.values()].sort((a, b) => a.id - b.id);
  for (const r of rows) zoneOf(r.tz);
  if (missingZones.size > 0) {
    throw new Error(
      `GeoNames zones missing from data/tz-transitions.json (add them to scripts/build-tz-table.ts): ${[...missingZones].sort().join(', ')}`,
    );
  }

  // --- Slugs for web cities (unique) ---
  const slugCount = new Map<string, number>();
  for (const w of webRows) slugCount.set(slugify(w.row.nameAscii), (slugCount.get(slugify(w.row.nameAscii)) ?? 0) + 1);
  const usedSlugs = new Set<string>();
  const webCities = webRows.map(({ row, group }) => {
    let slug = slugify(row.nameAscii);
    if ((slugCount.get(slug) ?? 0) > 1 || usedSlugs.has(slug)) {
      const a1 = admin1.get(`${row.country}.${row.admin1Code}`);
      slug = slugify(`${row.nameAscii} ${a1 ?? row.admin1Code}`);
    }
    if (usedSlugs.has(slug)) slug = `${slug}-${row.id}`;
    usedSlugs.add(slug);
    return {
      geonameid: row.id,
      name: row.name,
      nameAscii: row.nameAscii,
      nameHi: hindi.get(row.id) ?? null,
      admin1: admin1.get(`${row.country}.${row.admin1Code}`) ?? null,
      country: row.country,
      countryName: countries.get(row.country) ?? row.country,
      lat: row.lat,
      lon: row.lon,
      tz: zoneOf(row.tz),
      slug,
      population: row.population,
      group,
    };
  });

  // --- SQLite ---
  const dbPath = resolve(dataDir, 'gazetteer.sqlite');
  if (existsSync(dbPath)) unlinkSync(dbPath);
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA page_size = 4096; PRAGMA journal_mode = OFF; PRAGMA synchronous = OFF;');
  db.exec(`
    CREATE TABLE places (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      name_ascii TEXT NOT NULL COLLATE NOCASE,
      name_hi TEXT COLLATE NOCASE,
      admin1 TEXT,
      country TEXT NOT NULL,
      lat REAL NOT NULL,
      lon REAL NOT NULL,
      elevation INTEGER,
      population INTEGER NOT NULL,
      tz TEXT NOT NULL
    );
    CREATE TABLE countries (code TEXT PRIMARY KEY, name TEXT NOT NULL);
    CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  `);
  const insert = db.prepare(
    'INSERT INTO places (id, name, name_ascii, name_hi, admin1, country, lat, lon, elevation, population, tz) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  );
  let withHindi = 0;
  const zones = new Set<string>();
  db.exec('BEGIN');
  for (const r of rows) {
    const nameHi = HINDI_NAME_COUNTRIES.has(r.country) ? (hindi.get(r.id) ?? null) : null;
    if (nameHi) withHindi++;
    const tz = zoneOf(r.tz);
    zones.add(tz);
    insert.run(
      r.id,
      r.name,
      r.nameAscii,
      nameHi,
      admin1.get(`${r.country}.${r.admin1Code}`) ?? null,
      r.country,
      Math.round(r.lat * 1e5) / 1e5,
      Math.round(r.lon * 1e5) / 1e5,
      r.elevation,
      r.population,
      tz,
    );
  }
  const insertCountry = db.prepare('INSERT INTO countries (code, name) VALUES (?, ?)');
  const usedCountries = new Set(rows.map((r) => r.country));
  for (const code of [...usedCountries].sort()) insertCountry.run(code, countries.get(code) ?? code);
  const insertMeta = db.prepare('INSERT INTO meta (key, value) VALUES (?, ?)');
  const dumpDate = sources.map((s) => s.lastModified).filter(Boolean).sort().at(-1) ?? null;
  insertMeta.run('source', 'GeoNames (https://www.geonames.org), CC BY 4.0');
  insertMeta.run('dump_last_modified', dumpDate ?? '');
  insertMeta.run('tzdb', TZDB_VERSION);
  insertMeta.run('generated', new Date().toISOString());
  insertMeta.run('schema', '1');
  db.exec('COMMIT');
  db.exec('CREATE INDEX idx_places_name_ascii ON places (name_ascii COLLATE NOCASE);');
  db.exec('CREATE INDEX idx_places_name_hi ON places (name_hi COLLATE NOCASE);');
  db.exec('VACUUM;');
  const countRow = db.prepare('SELECT COUNT(*) AS n FROM places').get() as { n: number };
  db.close();
  const bytes = statSync(dbPath).size;

  // --- Meta + web cities ---
  const byCountry: Record<string, number> = {};
  for (const r of rows) byCountry[r.country] = (byCountry[r.country] ?? 0) + 1;
  const topCountries = Object.entries(byCountry)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([c, n]) => ({ country: c, rows: n }));
  const meta = {
    generated: new Date().toISOString(),
    source: 'GeoNames gazetteer dumps (https://download.geonames.org/export/dump/), licence CC BY 4.0',
    dumpLastModified: dumpDate,
    tzdb: TZDB_VERSION,
    files: sources.map(({ file, url, bytes: b, lastModified }) => ({ file, url, bytes: b, lastModified })),
    selection: {
      cities1000Countries: [...CITIES1000_COUNTRIES],
      otherCountries: 'cities15000',
      forced: 'data/web-cities.json (331 rows)',
      zoneNormalisation: 'canonicalZone() of packages/engine/src/tz',
    },
    counts: {
      rows: countRow.n,
      india: byCountry.IN ?? 0,
      nepal: byCountry.NP ?? 0,
      withNameHi: withHindi,
      countries: usedCountries.size,
      zones: zones.size,
      webCities: webCities.length,
      topCountries,
    },
    bytes,
    budgetBytes: 8 * 1024 * 1024,
    zones: [...zones].sort(),
  };
  writeFileSync(resolve(dataDir, 'gazetteer.meta.json'), JSON.stringify(meta, null, 2) + '\n', 'utf8');
  writeFileSync(
    resolve(dataDir, 'web-cities.json'),
    JSON.stringify(
      {
        generated: meta.generated,
        source: meta.source,
        dumpLastModified: dumpDate,
        rule: '300 largest Indian cities by GeoNames population (feature codes PPL* except sections/historical) + Kathmandu + 30 diaspora cities (plan.md P3)',
        count: webCities.length,
        cities: webCities,
      },
      null,
      2,
    ) + '\n',
    'utf8',
  );

  // --- Copy into the app assets (bundled via metro assetExts 'sqlite') ---
  const appAsset = resolve(repoRoot, 'app', 'assets', 'gazetteer.sqlite');
  mkdirSync(dirname(appAsset), { recursive: true });
  copyFileSync(dbPath, appAsset);

  console.log(`  rows ${countRow.n} (IN ${meta.counts.india}, NP ${meta.counts.nepal}, name_hi ${withHindi}), zones ${zones.size}, countries ${usedCountries.size}`);
  console.log(`  gazetteer.sqlite ${(bytes / 1024 / 1024).toFixed(2)} MB (budget 8 MB) -> also copied to app/assets/gazetteer.sqlite`);
  console.log('  web cities: 300 IN + Kathmandu + 30 diaspora =', webCities.length);
  console.log('  diaspora resolved:');
  for (const c of webCities.filter((w) => w.group === 'diaspora')) {
    console.log(`    ${c.geonameid} ${c.name}, ${c.admin1 ?? '-'}, ${c.country} pop ${c.population} tz ${c.tz} slug ${c.slug}`);
  }
  console.log(`  Kathmandu: ${kathmandu.id} pop ${kathmandu.population} tz ${zoneOf(kathmandu.tz)}`);
  console.log(`  largest IN: ${india.slice(0, 5).map((r) => `${r.name} ${r.population}`).join('; ')} ... smallest kept: ${india[299].name} ${india[299].population}`);
  if (bytes > meta.budgetBytes) throw new Error(`gazetteer.sqlite is ${bytes} bytes, over the 8 MB budget`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
