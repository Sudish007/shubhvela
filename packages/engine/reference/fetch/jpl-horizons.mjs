// JPL Horizons tie-breaker for the chart suite (plan.md section 8): apparent geocentric ecliptic-of-date
// longitudes (QUANTITIES=31) of Sun, Moon, Mercury, Venus, Mars, Jupiter and Saturn at every chart case's
// birth instant. One request per body with a TLIST of all 50 instants (7 requests in total, >= 1 s apart).
//   node reference/fetch/jpl-horizons.mjs
// The UTC instant of each case is derived with moment-timezone (tzdb data independent of the engine's table),
// unknown birth times use local noon exactly like the engine (kundli/index.ts computeChart).
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { REFERENCE_DIR, nowIso, readJson, sleep, writeJson, FETCHER_VERSION } from './common.mjs';

const require = createRequire(import.meta.url);
const moment = require('moment-timezone');

const cases = readJson(join(REFERENCE_DIR, 'charts', 'cases.json')).cases;
const OUT_DIR = join(REFERENCE_DIR, 'charts', 'jpl-horizons');
const BODIES = { Su: '10', Mo: '301', Me: '199', Ve: '299', Ma: '499', Ju: '599', Sa: '699' };
const API = 'https://ssd.jpl.nasa.gov/api/horizons.api';

function instantOf(c) {
  const wall = `${c.date} ${c.time ?? '12:00'}`;
  const m = moment.tz(wall, 'YYYY-MM-DD HH:mm', c.tz);
  if (!m.isValid()) throw new Error(`moment-timezone cannot resolve ${wall} ${c.tz}`);
  return { utcMs: m.valueOf(), offsetMinutes: m.utcOffset(), utcIso: m.clone().utc().format('YYYY-MM-DD HH:mm:ss') };
}

function jdOf(utcMs) {
  return utcMs / 86400000 + 2440587.5;
}

function buildUrl(command, jds) {
  const q = new URLSearchParams({
    format: 'text',
    COMMAND: `'${command}'`,
    OBJ_DATA: "'NO'",
    MAKE_EPHEM: "'YES'",
    EPHEM_TYPE: "'OBSERVER'",
    CENTER: "'500@399'",
    TLIST_TYPE: "'JD'",
    TLIST: `'${jds.map((j) => j.toFixed(6)).join(' ')}'`,
    QUANTITIES: "'31'",
    ANG_FORMAT: "'DEG'",
    CSV_FORMAT: "'YES'",
    TIME_DIGITS: "'SECONDS'",
    EXTRA_PREC: "'YES'",
  });
  return `${API}?${q.toString()}`;
}

function parseRows(text) {
  const start = text.indexOf('$$SOE');
  const end = text.indexOf('$$EOE');
  if (start < 0 || end < 0) throw new Error(`Horizons response without $$SOE/$$EOE: ${text.slice(0, 500)}`);
  const headerLine = text.slice(0, start).trim().split('\n').filter((l) => /Date__\(UT\)/.test(l)).pop();
  if (!headerLine) throw new Error('Horizons header not found');
  const header = headerLine.split(',').map((s) => s.trim());
  const lonIdx = header.indexOf('ObsEcLon');
  const latIdx = header.indexOf('ObsEcLat');
  if (lonIdx < 0 || latIdx < 0) throw new Error(`Horizons header lacks ObsEcLon/ObsEcLat: ${headerLine}`);
  return text
    .slice(start + 5, end)
    .trim()
    .split('\n')
    .filter((l) => l.trim())
    .map((line) => {
      const cols = line.split(',').map((s) => s.trim());
      const date = cols[0]; // "2026-Oct-22 00:00:00.000"
      return { date, utcMs: parseHorizonsDate(date), lon: Number(cols[lonIdx]), lat: Number(cols[latIdx]) };
    });
}

const MON = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
function parseHorizonsDate(s) {
  const m = /^(\d{4})-([A-Z][a-z]{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?$/.exec(s.trim());
  if (!m) throw new Error(`Unparsable Horizons date: ${s}`);
  const frac = m[7] ? Number(`0.${m[7]}`) : 0;
  return Date.UTC(Number(m[1]), MON[m[2]], Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6])) + Math.round(frac * 1000);
}

const instants = cases.map((c) => ({ c, ...instantOf(c) }));
const jds = instants.map((i) => jdOf(i.utcMs));
const perCase = new Map(instants.map((i) => [i.c.id, { utc: i.utcIso, utcMs: i.utcMs, jd: jdOf(i.utcMs), offsetMinutes: i.offsetMinutes, bodies: {}, source_urls: {} }]));

for (const [id, command] of Object.entries(BODIES)) {
  const url = buildUrl(command, jds);
  const res = await fetch(url);
  const text = await res.text();
  if (res.status !== 200) throw new Error(`Horizons HTTP ${res.status} for ${id}: ${text.slice(0, 300)}`);
  const rows = parseRows(text);
  if (rows.length !== instants.length) throw new Error(`Horizons returned ${rows.length} rows for ${id}, expected ${instants.length}`);
  for (const inst of instants) {
    // Rows come back in time order; match each case to the row nearest its instant (all instants are distinct minutes).
    let best = rows[0];
    for (const r of rows) if (Math.abs(r.utcMs - inst.utcMs) < Math.abs(best.utcMs - inst.utcMs)) best = r;
    if (Math.abs(best.utcMs - inst.utcMs) > 1500) throw new Error(`No Horizons row within 1.5 s of ${inst.c.id} (${inst.utcIso}) for ${id}`);
    const entry = perCase.get(inst.c.id);
    entry.bodies[id] = { tropicalLon: best.lon, lat: best.lat, horizonsTime: best.date };
    entry.source_urls[id] = url.length > 1800 ? `${API}?COMMAND='${command}'&EPHEM_TYPE='OBSERVER'&CENTER='500@399'&QUANTITIES='31'&TLIST_TYPE='JD'&TLIST=<${jds.length} JDs>` : url;
  }
  console.log(`[jpl-horizons] ${id} (${command}): ${rows.length} rows`);
  await sleep(1200);
}

const fetchedAt = nowIso();
for (const c of cases) {
  const e = perCase.get(c.id);
  writeJson(join(OUT_DIR, `${c.id}.json`), {
    case: c.id,
    source: 'jpl-horizons',
    source_url: `${API}?format=text&COMMAND='<body>'&OBJ_DATA='NO'&MAKE_EPHEM='YES'&EPHEM_TYPE='OBSERVER'&CENTER='500@399'&TLIST_TYPE='JD'&TLIST='${e.jd.toFixed(6)}'&QUANTITIES='31'&ANG_FORMAT='DEG'&CSV_FORMAT='YES'`,
    fetched_at: fetchedAt,
    fetcher_version: FETCHER_VERSION,
    values: {
      input: { date: c.date, time: c.time ?? null, noonForUnknownTime: c.time === null, tz: c.tz, offsetMinutes: e.offsetMinutes, utc: e.utc, jd: e.jd },
      bodies: e.bodies,
    },
    notes: [
      'QUANTITIES=31 ObsEcLon/ObsEcLat: observer-centred (geocentric, CENTER=500@399) apparent ecliptic-of-date longitude and latitude with light-time, gravitational deflection and stellar aberration (Horizons API 1.2, DE441).',
      'Tropical longitudes; sidereal = tropical - ayanamsa. The suite compares the engine tropical longitude (sidereal + meta.ayanamsaDegrees) to these within the planet tolerance.',
      'UTC instant from moment-timezone (tzdb) for the case wall time; unknown time = local noon.',
    ],
  });
}
console.log(`[jpl-horizons] wrote ${cases.length} files to ${OUT_DIR}`);
