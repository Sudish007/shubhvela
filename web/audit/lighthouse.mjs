// Lighthouse mobile audit (plan D03; spec F41: >= 90 on home/kundli/panchang). Serves web/dist locally under /shubhvela/
// and runs the lighthouse CLI (devDependency) with CHROME_PATH = the Playwright Chromium, mobile preset, the four
// categories. JSON reports -> shots/phase-d/web/lighthouse-<page>.json plus lighthouse-summary.json; exits 1 when any
// category of any page scores below 90.
// Usage: node web/audit/lighthouse.mjs [--out <dir>] [--only home-en,kundli-en]
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { DIST, playwrightChromium, serveDist } from './serve.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const args = process.argv.slice(2);
const argValue = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const OUT = path.resolve(argValue('--out') || path.join(REPO, '.agents', 'tasks', 'v1-build', 'shots', 'phase-d', 'web'));
const ONLY = argValue('--only') ? new Set(argValue('--only').split(',')) : null;
fs.mkdirSync(OUT, { recursive: true });

const PAGES = [
  { id: 'home-en', path: '/en/' },
  { id: 'kundli-en', path: '/en/kundli/' },
  { id: 'panchang-new-delhi-en', path: '/en/panchang/new-delhi/' },
  { id: 'home-hi', path: '/hi/' },
].filter((p) => !ONLY || ONLY.has(p.id));
const CATEGORIES = ['performance', 'accessibility', 'best-practices', 'seo'];
const THRESHOLD = 90;
const CLI = path.join(REPO, 'node_modules', 'lighthouse', 'cli', 'index.js');
if (!fs.existsSync(CLI)) throw new Error(`lighthouse CLI not installed at ${CLI} (npm i -D lighthouse -w web)`);

function runCli(cliArgs, env) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, cliArgs, { env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = ''; let stderr = '';
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    const timer = setTimeout(() => { child.kill(); resolve({ status: null, stdout, stderr: stderr + '\n[timeout after 300 s]' }); }, 300000);
    child.on('close', (status) => { clearTimeout(timer); resolve({ status, stdout, stderr }); });
  });
}

(async () => {
  const server = await serveDist();
  const chrome = playwrightChromium();
  console.log(`serving ${DIST} at ${server.baseUrl}; CHROME_PATH=${chrome}; ${PAGES.length} pages, mobile preset`);
  const rows = [];
  try {
    for (const pg of PAGES) {
      const url = server.baseUrl.replace(/\/$/, '') + pg.path;
      const report = path.join(OUT, `lighthouse-${pg.id}.json`);
      const t0 = Date.now();
      // Lighthouse's default run IS the mobile preset (Moto G Power emulation, slow-4G throttling); --preset only
      // offers perf/desktop/experimental. The report's configSettings.formFactor is asserted below.
      // Asynchronous: the static server lives in this process, so a blocking spawnSync would starve it.
      const r = await runCli([
        CLI, url,
        '--form-factor=mobile',
        '--screenEmulation.mobile',
        `--only-categories=${CATEGORIES.join(',')}`,
        '--output=json',
        `--output-path=${report}`,
        '--quiet',
        '--chrome-flags=--headless=new --no-sandbox --disable-gpu',
      ], { CHROME_PATH: chrome });
      if (r.status !== 0 || !fs.existsSync(report)) {
        console.error(r.stderr?.slice(-2000) || r.stdout?.slice(-2000));
        throw new Error(`lighthouse failed for ${url} (exit ${r.status})`);
      }
      const lhr = JSON.parse(fs.readFileSync(report, 'utf8'));
      if (lhr.configSettings?.formFactor !== 'mobile') throw new Error(`report for ${url} is not a mobile run (${lhr.configSettings?.formFactor})`);
      const scores = Object.fromEntries(CATEGORIES.map((c) => [c, Math.round((lhr.categories[c]?.score ?? 0) * 100)]));
      const a = lhr.audits;
      const metrics = {
        fcpMs: Math.round(a['first-contentful-paint']?.numericValue ?? 0),
        lcpMs: Math.round(a['largest-contentful-paint']?.numericValue ?? 0),
        tbtMs: Math.round(a['total-blocking-time']?.numericValue ?? 0),
        cls: Math.round((a['cumulative-layout-shift']?.numericValue ?? 0) * 1000) / 1000,
        speedIndexMs: Math.round(a['speed-index']?.numericValue ?? 0),
        totalBytes: Math.round(a['total-byte-weight']?.numericValue ?? 0),
      };
      // Failing or non-perfect audits per category, so the verification file can name what cost points.
      const findings = {};
      for (const c of CATEGORIES) {
        findings[c] = (lhr.categories[c]?.auditRefs ?? [])
          .map((ref) => a[ref.id])
          .filter((au) => au && au.score !== null && au.score < 1 && au.scoreDisplayMode !== 'informative' && au.scoreDisplayMode !== 'notApplicable' && au.scoreDisplayMode !== 'manual')
          .map((au) => `${au.id} (${Math.round((au.score ?? 0) * 100)}${au.displayValue ? `, ${au.displayValue}` : ''})`);
      }
      const below = CATEGORIES.filter((c) => scores[c] < THRESHOLD);
      rows.push({ page: pg.id, path: pg.path, url, report: path.basename(report), lighthouseVersion: lhr.lighthouseVersion, formFactor: lhr.configSettings?.formFactor, scores, metrics, findings, pass: below.length === 0, below, elapsedSeconds: Math.round((Date.now() - t0) / 100) / 10 });
      console.log(`${below.length ? 'FAIL' : 'ok  '} ${pg.id.padEnd(24)} ${CATEGORIES.map((c) => `${c}=${scores[c]}`).join(' ')}  LCP=${metrics.lcpMs}ms TBT=${metrics.tbtMs}ms CLS=${metrics.cls} bytes=${metrics.totalBytes}`);
      for (const c of CATEGORIES) if (findings[c].length) console.log(`     ${c}: ${findings[c].join(' | ')}`);
    }
  } finally {
    await server.close();
  }
  const summary = { run: new Date().toISOString(), threshold: THRESHOLD, preset: 'mobile', chrome, pass: rows.every((r) => r.pass), pages: rows };
  fs.writeFileSync(path.join(OUT, 'lighthouse-summary.json'), JSON.stringify(summary, null, 2));
  console.log('SUMMARY', JSON.stringify({ pass: summary.pass, pages: rows.map((r) => ({ page: r.page, ...r.scores })) }));
  if (!summary.pass) process.exit(1);
})().catch((e) => { console.error(e); process.exit(1); });
