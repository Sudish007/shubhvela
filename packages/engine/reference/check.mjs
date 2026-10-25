// `npm run reference:check -w packages/engine`: prints the reference-data coverage of the spec section 6 suites
// against the required counts (plan.md section 8) and exits non-zero when any suite is short. It also re-merges
// reference/results.json from reference/results/*.json (the suites write those during `npm test`).
//
//   charts    50 births, each with >= 2 references (two web calculators, or one web calculator + JPL Horizons)
//   panchang  30 dates x 5 cities = 150 Drik Panchang day pages
//   festivals every slug in data/festival-rules.json x 2026-2028 x {Delhi purnimanta, Chennai amanta}
//   matching  20 pairs
//   tz        every case in reference/tz/cases.json (offline, always complete)
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REF = dirname(fileURLToPath(import.meta.url));
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const listIds = (dir) => (existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)) : []);

let short = false;
const lines = [];
const report = (suite, required, fetched, passed, detail) => {
  const ok = fetched >= required;
  if (!ok) short = true;
  lines.push(`${ok ? 'OK   ' : 'SHORT'} ${suite.padEnd(9)} required ${String(required).padStart(4)}  fetched ${String(fetched).padStart(4)}  passed ${passed === null ? '   -' : String(passed).padStart(4)}${detail ? `  ${detail}` : ''}`);
};

// ---- merge results.json from the per-suite files written by the test run
const resultsDir = join(REF, 'results');
const merged = {
  description:
    'Measured deviations of @shubhvela/engine against the committed reference data (spec section 6 release gate). Written by the vitest suites under test/suites; `charts.maxPlanetDeg` is injected into the web kundli footer (design-review N13).',
};
const results = {};
if (existsSync(resultsDir)) {
  for (const f of readdirSync(resultsDir).filter((f) => f.endsWith('.json')).sort()) {
    const r = readJson(join(resultsDir, f));
    const { suite, ...rest } = r;
    results[suite] = rest;
    merged[suite] = rest;
  }
  writeFileSync(join(REF, 'results.json'), JSON.stringify(merged, null, 2) + '\n', 'utf8');
}
const passedOf = (suite) => (results[suite] ? results[suite].passed : null);

// ---- charts
{
  const cases = readJson(join(REF, 'charts', 'cases.json')).cases;
  const sources = ['drikpanchang', 'astrosage', 'prokerala', 'jpl-horizons'];
  const have = Object.fromEntries(sources.map((s) => [s, new Set(listIds(join(REF, 'charts', s)))]));
  let covered = 0;
  const missing = [];
  for (const c of cases) {
    const web = ['drikpanchang', 'astrosage', 'prokerala'].filter((s) => have[s].has(c.id));
    const n = web.length + (have['jpl-horizons'].has(c.id) ? 1 : 0);
    if (web.length >= 1 && n >= 2) covered++;
    else missing.push(`${c.id}(${web.join('+') || 'no web'}${have['jpl-horizons'].has(c.id) ? '+jpl' : ''})`);
  }
  const perSource = sources.map((s) => `${s}:${have[s].size}`).join(' ');
  report('charts', cases.length, covered, passedOf('charts'), `[${perSource}]${missing.length ? ` missing: ${missing.slice(0, 15).join(', ')}${missing.length > 15 ? ` ... (+${missing.length - 15})` : ''}` : ''}`);
}

// ---- panchang
{
  const cases = readJson(join(REF, 'panchang', 'cases.json'));
  const required = Object.keys(cases.cities).length * cases.dates.length;
  const have = new Set(listIds(join(REF, 'panchang', 'drikpanchang')));
  const missing = [];
  for (const city of Object.keys(cases.cities)) for (const { date } of cases.dates) if (!have.has(`${city}-${date}`)) missing.push(`${city}-${date}`);
  report('panchang', required, required - missing.length, passedOf('panchang'), missing.length ? `missing: ${missing.slice(0, 10).join(', ')}${missing.length > 10 ? ` ... (+${missing.length - 10})` : ''}` : '');
}

// ---- festivals
{
  const casesFile = join(REF, 'festivals', 'cases.json');
  if (!existsSync(casesFile)) report('festivals', 1, 0, null, 'reference/festivals/cases.json missing');
  else {
    const cases = readJson(casesFile);
    const required = cases.slugs.length * cases.years.length * Object.keys(cases.cities).length;
    let fetched = 0;
    const missing = [];
    for (const cityId of Object.keys(cases.cities)) {
      for (const year of cases.years) {
        const f = join(REF, 'festivals', 'drikpanchang', `${cityId}-${year}.json`);
        if (!existsSync(f)) {
          missing.push(`${cityId}-${year} (page set not fetched)`);
          continue;
        }
        // The page set stores Drik's events; a slug counts as fetched when name-map.json maps at least one event
        // of that year to it (the same rule the festival suite uses to decide what it can compare).
        const events = readJson(f).values.events ?? [];
        const nameMap = readJson(join(REF, 'festivals', 'name-map.json')).map;
        const norm = (s) => String(s ?? '').toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z]/g, '');
        for (const slug of cases.slugs) {
          const spec = nameMap[slug];
          const wanted = (spec?.names ?? []).map(norm);
          const filter = spec?.textFilter ? new RegExp(spec.textFilter, 'i') : null;
          const hit = events.some((e) => wanted.includes(norm(e.name)) && (!filter || filter.test(e.text)));
          if (hit) fetched++;
          else missing.push(`${slug}@${cityId}-${year}`);
        }
      }
    }
    report('festivals', required, fetched, passedOf('festivals'), missing.length ? `missing: ${missing.slice(0, 12).join(', ')}${missing.length > 12 ? ` ... (+${missing.length - 12})` : ''}` : '');
  }
}

// ---- matching
{
  const casesFile = join(REF, 'matching', 'cases.json');
  if (!existsSync(casesFile)) report('matching', 20, 0, null, 'reference/matching/cases.json missing');
  else {
    const cases = readJson(casesFile).pairs;
    const have = new Set([...listIds(join(REF, 'matching', 'drikpanchang')), ...listIds(join(REF, 'matching', 'astrosage'))]);
    const missing = cases.map((p) => p.id).filter((id) => !have.has(id));
    report('matching', cases.length, cases.length - missing.length, passedOf('matching'), missing.length ? `missing: ${missing.join(', ')}` : '');
  }
}

// ---- tz
{
  const cases = readJson(join(REF, 'tz', 'cases.json'));
  const required = cases.births.length + 1;
  report('tz', required, required, passedOf('tz'), `${cases.births.length} births + ${cases.offsetChecks.length} boundary offsets (offline tzdb facts)`);
}

console.log('Reference-data coverage (spec section 6 release gate):');
for (const l of lines) console.log('  ' + l);
if (short) {
  console.log('\nCoverage is SHORT of the spec counts. Shortfalls and the resume plan are recorded in .agents/tasks/v1-build/verification-a04.md.');
  process.exit(1);
}
console.log('\nEvery suite has its full reference set.');
