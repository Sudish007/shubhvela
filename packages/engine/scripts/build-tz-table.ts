// Generates packages/engine/data/tz-transitions.json from moment-timezone's packed tzdb data.
// Run with: npx tsx packages/engine/scripts/build-tz-table.ts   (part of `npm run build:data`)
//
// Output shape (design.md 10.1 F4, plan.md P10):
//   { header: {...}, zones: { 'Asia/Kolkata': { untils: number[], offsets: number[] } }, links: { alias: canonical } }
//   - untils[i]  : UTC seconds at which the i-th period ENDS; offsets[i] applies while utc < untils[i];
//                  offsets[untils.length] applies after the last until (offsets.length === untils.length + 1).
//   - offsets[i] : minutes EAST of UTC (fractional only for LMT-era offsets such as Madras Mean Time +5:21:10).
//   - range      : periods clipped to [1900-01-01T00:00Z, 2100-12-31T23:59:59Z].
// The runtime (src/tz) never consults Intl or the device offset; the vitest self-test compares the table against
// Node's ICU for random instants.
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const moment = require('moment-timezone') as {
  tz: { unpack(packed: string): { name: string; abbrs: string[]; offsets: number[]; untils: (number | null)[] } };
};

const here = dirname(fileURLToPath(import.meta.url));
const engineRoot = resolve(here, '..');
const dataDir = resolve(engineRoot, 'data');
const outFile = resolve(dataDir, 'tz-transitions.json');

const packedPath = require.resolve('moment-timezone/data/packed/latest.json');
const packed = JSON.parse(readFileSync(packedPath, 'utf8')) as { version: string; zones: string[]; links: string[] };
const momentVersion = (JSON.parse(readFileSync(require.resolve('moment-timezone/package.json'), 'utf8')) as { version: string }).version;

const RANGE_START_S = Date.UTC(1900, 0, 1) / 1000; // -2208988800
const RANGE_END_S = Date.UTC(2100, 11, 31, 23, 59, 59) / 1000;

// IANA renamed these zones after moment-timezone picked its canonical spelling; the table uses the
// current IANA canonical name and keeps the old spelling as a link (N8: canonical ids everywhere).
const PREFERRED_CANONICAL: Record<string, string> = {
  'Europe/Kiev': 'Europe/Kyiv',
  'Pacific/Enderbury': 'Pacific/Kanton',
  'America/Godthab': 'America/Nuuk',
  'Asia/Rangoon': 'Asia/Yangon',
  // tzdb 2022f merged these pairs (identical since 1970); IANA kept the second name as the Zone.
  'Asia/Kuala_Lumpur': 'Asia/Singapore',
  'Asia/Brunei': 'Asia/Kuching',
};

interface ZoneTable {
  untils: number[];
  offsets: number[];
}

function roundOffsetMinutes(minutesWest: number): number {
  // moment stores minutes WEST (UTC - local); the table stores minutes EAST, rounded to the second.
  const seconds = Math.round(-minutesWest * 60);
  return Math.round((seconds / 60) * 10000) / 10000;
}

function clipZone(untilsMs: (number | null)[], offsetsWest: number[]): ZoneTable {
  // Period i: [untils[i-1], untils[i]) with offsets[i]; the last until is null (= +Infinity).
  const untilsS = untilsMs.map((u) => (u === null ? Number.POSITIVE_INFINITY : Math.round(u / 1000)));
  let first = 0;
  while (first < untilsS.length - 1 && untilsS[first] <= RANGE_START_S) first++;
  let last = first;
  while (last < untilsS.length - 1 && untilsS[last] < RANGE_END_S) last++;
  // Keep periods first..last (inclusive); untils between them (last - first) are kept.
  const untils: number[] = [];
  const offsets: number[] = [];
  for (let i = first; i <= last; i++) {
    offsets.push(roundOffsetMinutes(offsetsWest[i]));
    if (i < last) untils.push(untilsS[i]);
  }
  // Collapse consecutive identical offsets (moment keeps abbreviation-only changes such as IST -> IST).
  const cUntils: number[] = [];
  const cOffsets: number[] = [offsets[0]];
  for (let i = 1; i < offsets.length; i++) {
    if (offsets[i] === cOffsets[cOffsets.length - 1]) continue;
    cUntils.push(untils[i - 1]);
    cOffsets.push(offsets[i]);
  }
  return { untils: cUntils, offsets: cOffsets };
}

const zones: Record<string, ZoneTable> = {};
const links: Record<string, string> = {};

for (const packedZone of packed.zones) {
  const z = moment.tz.unpack(packedZone);
  const canonical = PREFERRED_CANONICAL[z.name] ?? z.name;
  zones[canonical] = clipZone(z.untils, z.offsets);
  if (canonical !== z.name) links[z.name] = canonical;
}
for (const link of packed.links) {
  const [target, alias] = link.split('|');
  const canonical = PREFERRED_CANONICAL[target] ?? target;
  if (alias === canonical) continue;
  if (!zones[canonical]) throw new Error(`link ${alias} -> ${target}: target zone missing`);
  links[alias] = canonical;
}

// Zone selection. Default: every tzdb zone (344 zones, ~565 KB), so that tz-lookup results for manual
// coordinates (any zone, including Etc/* over oceans) always resolve and the design.md 11 "zone id missing"
// error path cannot be hit by a gazetteer/table mismatch. Opt-in restriction to the zones the gazetteer and
// web cities use (plan P10 wording): SHUBHVELA_TZ_RESTRICT=1 reads the zone list recorded by the gazetteer
// build in data/gazetteer.meta.json (first run: file absent -> all zones). Etc/* and UTC are always kept.
const metaPath = resolve(dataDir, 'gazetteer.meta.json');
let restrictedTo: string[] | null = null;
if (process.env.SHUBHVELA_TZ_RESTRICT === '1' && existsSync(metaPath)) {
  const meta = JSON.parse(readFileSync(metaPath, 'utf8')) as { zones?: string[] };
  if (Array.isArray(meta.zones) && meta.zones.length > 0) restrictedTo = meta.zones;
}

const sortedZoneNames = Object.keys(zones).sort();
const keep = new Set<string>();
if (restrictedTo) {
  for (const name of sortedZoneNames) {
    if (name.startsWith('Etc/') || name === 'UTC') keep.add(name);
  }
  for (const z of restrictedTo) {
    const canonical = zones[z] ? z : links[z];
    if (!canonical || !zones[canonical]) throw new Error(`gazetteer zone ${z} is not a tzdb zone`);
    keep.add(canonical);
  }
} else {
  for (const name of sortedZoneNames) keep.add(name);
}

const outZones: Record<string, ZoneTable> = {};
for (const name of sortedZoneNames) if (keep.has(name)) outZones[name] = zones[name];
const outLinks: Record<string, string> = {};
for (const alias of Object.keys(links).sort()) if (keep.has(links[alias])) outLinks[alias] = links[alias];

const transitionCount = Object.values(outZones).reduce((n, z) => n + z.untils.length, 0);

const table = {
  header: {
    tzdb: packed.version,
    source: `moment-timezone ${momentVersion} data/packed/latest.json, unpacked with moment.tz.unpack (tzdb ${packed.version})`,
    generated: new Date().toISOString(),
    range: [1900, 2100],
    untils: 'UTC seconds at which period i ends; offsets[i] applies while utc < untils[i]; offsets[untils.length] applies afterwards',
    offsets: 'minutes east of UTC (fractional only for LMT-era offsets, rounded to the second)',
    future:
      'moment-timezone 0.6 ships rule-generated transitions through 2499, so no extrapolation is applied; periods are clipped at 2100-12-31T23:59:59Z',
    selection: restrictedTo ? 'zones used by the gazetteer and web cities, plus Etc/* and UTC' : 'all tzdb zones',
    zoneCount: Object.keys(outZones).length,
    linkCount: Object.keys(outLinks).length,
    transitionCount,
    renamed: PREFERRED_CANONICAL,
  },
  zones: outZones,
  links: outLinks,
};

mkdirSync(dataDir, { recursive: true });
// Compact layout: one zone per line keeps diffs readable without wasting bytes on per-number indentation.
const zoneLines = Object.entries(table.zones).map(
  ([name, z]) => `    ${JSON.stringify(name)}: {"untils": ${JSON.stringify(z.untils)}, "offsets": ${JSON.stringify(z.offsets)}}`,
);
const linkLines = Object.entries(table.links).map(([a, c]) => `    ${JSON.stringify(a)}: ${JSON.stringify(c)}`);
const json =
  `{\n  "header": ${JSON.stringify(table.header, null, 2).replace(/\n/g, '\n  ')},\n` +
  `  "zones": {\n${zoneLines.join(',\n')}\n  },\n` +
  `  "links": {\n${linkLines.join(',\n')}\n  }\n}\n`;
writeFileSync(outFile, json, 'utf8');

const sizeKb = (Buffer.byteLength(json, 'utf8') / 1024).toFixed(1);
console.log(
  `tz-transitions.json: tzdb ${packed.version}, ${table.header.zoneCount} zones, ${table.header.linkCount} links, ` +
    `${transitionCount} transitions, ${sizeKb} KB (${table.header.selection})`,
);
