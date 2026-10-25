// Shared helpers for the spec section 6 validation suites (plan.md section 8, FEAT-A04).
// Reference facts live under packages/engine/reference/<suite>/<source>/<case>.json; a missing file skips the
// case with a loud warning (the coverage script `npm run reference:check` is what enforces the counts).
// Every suite records its measured deviations in reference/results/<suite>.json and re-merges
// reference/results.json (N13 reads charts.maxPlanetDeg from the merged file).
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { localToUtc, utcToWall } from '../../src/tz/index';

export const REFERENCE_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'reference');

export interface ReferenceFile<T = Record<string, unknown>> {
  case: string;
  source: string;
  source_url: string;
  fetched_at: string;
  fetcher_version?: string;
  values: T;
  notes?: string[];
}

export function readJson<T>(path: string): T {
  // Tolerate a UTF-8 BOM (PowerShell's Set-Content writes one; it truncated the chart suite to 0 tests once).
  return JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, '')) as T;
}

export function loadCases<T>(suite: string): T {
  return readJson<T>(join(REFERENCE_DIR, suite, 'cases.json'));
}

/** Reference values for a case from one source, or null when not fetched yet. */
export function loadReference<T = Record<string, unknown>>(suite: string, source: string, caseId: string): ReferenceFile<T> | null {
  const file = join(REFERENCE_DIR, suite, source, `${caseId}.json`);
  if (!existsSync(file)) return null;
  const ref = readJson<ReferenceFile<T>>(file);
  if (!ref.source_url || !ref.fetched_at) throw new Error(`${file}: reference files must carry source_url and fetched_at`);
  return ref;
}

export function listReferences(suite: string, source: string): string[] {
  const dir = join(REFERENCE_DIR, suite, source);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.slice(0, -5))
    .sort();
}

export function warnMissing(suite: string, source: string, missing: string[], required: number): void {
  if (!missing.length) return;
  const shown = missing.slice(0, 12).join(', ') + (missing.length > 12 ? ` ... (+${missing.length - 12})` : '');
  // eslint-disable-next-line no-console
  console.warn(`[suite:${suite}] ${missing.length} of ${required} cases have no ${source} reference yet and were skipped: ${shown}`);
}

/** "YYYY-MM-DDTHH:MM[:SS]" wall time in a zone -> UTC ms (gaps shift forward like the engine). */
export function localIsoToUtc(iso: string, zone: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(iso);
  if (!m) throw new Error(`Bad local ISO string: ${iso}`);
  return localToUtc(zone, { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]), hh: Number(m[4]), mm: Number(m[5]), ss: m[6] ? Number(m[6]) : 0 }).utcMs;
}

export function utcToLocalIso(utcMs: number, zone: string): string {
  const w = utcToWall(utcMs, zone);
  const p = (n: number) => (n < 10 ? `0${n}` : String(n));
  return `${w.y}-${p(w.m)}-${p(w.d)}T${p(w.hh)}:${p(w.mm)}:${p(w.ss)}`;
}

/**
 * Deviation in whole minutes between an engine instant and a reference wall time printed to the minute.
 * Drik Panchang rounds to the nearest minute (verified: sunset 17:44:40 prints 05:45 PM), so the engine
 * instant is rounded the same way before the comparison.
 */
export function minuteDeviation(engineMs: number, refLocalIso: string, zone: string): number {
  const engineMinutes = Math.round(engineMs / 60_000);
  const refMinutes = Math.round(localIsoToUtc(refLocalIso, zone) / 60_000);
  return Math.abs(engineMinutes - refMinutes);
}

/** Signed difference in degrees wrapped to [-180, 180). */
export function degDiff(a: number, b: number): number {
  return ((((a - b) % 360) + 540) % 360) - 180;
}

const NAME_ALIASES: Record<string, string> = {
  mrigashirsha: 'mrigashira',
  mrigasira: 'mrigashira',
  dhanishtha: 'dhanishta',
  garaja: 'gara',
  ashwina: 'ashwin',
  asvina: 'ashwin',
  kartika: 'kartik',
  karthika: 'kartik',
  margasirsha: 'margashirsha',
  agrahayana: 'margashirsha',
  sravana: 'shravana',
  shravan: 'shravana',
  bhadra: 'bhadrapada',
  bhadrapad: 'bhadrapada',
  jyeshta: 'jyeshtha',
  jyestha: 'jyeshtha',
  vaisakha: 'vaishakha',
  baisakha: 'vaishakha',
  asadha: 'ashadha',
  ashada: 'ashadha',
  pausa: 'pausha',
  paush: 'pausha',
  magh: 'magha',
  phalgun: 'phalguna',
  falguna: 'phalguna',
  chaitr: 'chaitra',
  purnimasi: 'purnima',
  poornima: 'purnima',
  amavasai: 'amavasya',
  amavas: 'amavasya',
  prathama: 'pratipada',
  pratipad: 'pratipada',
  dvitiya: 'dwitiya',
  dwitiyaa: 'dwitiya',
  sashti: 'shashthi',
  shashti: 'shashthi',
  sasthi: 'shashthi',
  dvadashi: 'dwadashi',
  dwadasi: 'dwadashi',
  ekadasi: 'ekadashi',
  trayodasi: 'trayodashi',
  chaturdasi: 'chaturdashi',
  aslesha: 'ashlesha',
  ayilyam: 'ashlesha',
  moola: 'mula',
  shatabhishak: 'shatabhisha',
  satabhisha: 'shatabhisha',
  swathi: 'swati',
  svati: 'swati',
  vishakh: 'vishakha',
  visakha: 'vishakha',
  krithika: 'krittika',
  kritika: 'krittika',
  aswini: 'ashwini',
  asvini: 'ashwini',
  vriddhi: 'vriddhi',
  vridhi: 'vriddhi',
  ayushmana: 'ayushman',
  ayushmaan: 'ayushman',
  vasant: 'vasanta',
  grishm: 'grishma',
  varsh: 'varsha',
  sharat: 'sharad',
  hemant: 'hemanta',
  shishir: 'shishira',
  sisira: 'shishira',
  sukarman: 'sukarma',
  variyana: 'variyan',
  vyatipat: 'vyatipata',
  vyaghat: 'vyaghata',
  harshan: 'harshana',
  shobhan: 'shobhana',
  atigand: 'atiganda',
  vishkumbha: 'vishkambha',
  vishkumbh: 'vishkambha',
  vaidhrit: 'vaidhriti',
  vaidhriti: 'vaidhriti',
  dhruv: 'dhruva',
  kaulav: 'kaulava',
  balav: 'balava',
  bav: 'bava',
  taitil: 'taitila',
  vanij: 'vanija',
  vishti: 'vishti',
  bhadrakarana: 'vishti',
  chatuspada: 'chatushpada',
  chatushpad: 'chatushpada',
  kinstughna: 'kimstughna',
  kimstughn: 'kimstughna',
  nagava: 'naga',
  nag: 'naga',
  kumbh: 'kumbha',
  vrishabh: 'vrishabha',
  vrischika: 'vrishchika',
  vrishchik: 'vrishchika',
  dhanus: 'dhanu',
  dhanur: 'dhanu',
  makar: 'makara',
  mithun: 'mithuna',
  karkata: 'karka',
  kataka: 'karka',
  kark: 'karka',
  simh: 'simha',
  meen: 'meena',
  mesh: 'mesha',
  shukl: 'shukla',
  krishn: 'krishna',
  guruwara: 'thursday',
  guruvara: 'thursday',
  raviwara: 'sunday',
  ravivara: 'sunday',
  somawara: 'monday',
  somavara: 'monday',
  mangalawara: 'tuesday',
  mangalavara: 'tuesday',
  budhawara: 'wednesday',
  budhavara: 'wednesday',
  shukrawara: 'friday',
  shukravara: 'friday',
  shaniwara: 'saturday',
  shanivara: 'saturday',
};

/** Lowercase letters only, with the common transliteration variants folded to the engine's English names. */
export function normName(s: string | null | undefined): string {
  if (!s) return '';
  const base = s
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/[^a-z]/g, '');
  return NAME_ALIASES[base] ?? base;
}

export function sameName(a: string | null | undefined, b: string | null | undefined): boolean {
  return normName(a) === normName(b);
}

// ---------------------------------------------------------------- results

export interface SuiteResult {
  suite: string;
  /** Required by spec section 6 / plan.md section 8. */
  required: number;
  /** Cases with at least one reference file. */
  compared: number;
  passed: number;
  failed: number;
  skipped: number;
  /** Max deviations per measured quantity (units named in the key). */
  maxDeviation: Record<string, number>;
  sources: Record<string, number>;
  failures: string[];
  generatedAt: string;
  [extra: string]: unknown;
}

const RESULTS_DIR = join(REFERENCE_DIR, 'results');
export const RESULTS_FILE = join(REFERENCE_DIR, 'results.json');

function writeAtomic(file: string, data: unknown): void {
  mkdirSync(dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n', 'utf8');
  try {
    renameSync(tmp, file);
  } catch {
    writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
  }
}

/** Writes reference/results/<suite>.json and re-merges reference/results.json from every suite file present. */
export function writeSuiteResult(result: SuiteResult): void {
  writeAtomic(join(RESULTS_DIR, `${result.suite}.json`), result);
  mergeResults();
}

export function mergeResults(): Record<string, unknown> {
  const merged: Record<string, unknown> = {
    description:
      'Measured deviations of @shubhvela/engine against the committed reference data (spec section 6 release gate). Written by the vitest suites under test/suites; `charts.maxPlanetDeg` is injected into the web kundli footer (design-review N13).',
    generatedAt: new Date().toISOString(),
  };
  if (existsSync(RESULTS_DIR)) {
    for (const f of readdirSync(RESULTS_DIR).filter((f) => f.endsWith('.json')).sort()) {
      const r = readJson<SuiteResult>(join(RESULTS_DIR, f));
      const { suite, generatedAt, ...rest } = r;
      merged[suite] = { ...rest, generatedAt };
    }
  }
  writeAtomic(RESULTS_FILE, merged);
  return merged;
}

export function round(x: number, digits = 4): number {
  const k = 10 ** digits;
  return Math.round(x * k) / k;
}
