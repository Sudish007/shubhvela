#!/usr/bin/env node
// Shubhvela web companion — static site generator (spec F41-F43; plan.md D01; design.md 9, 10.10).
// Node 24, no template engine, no tsx: the engine and the content package are pre-bundled with esbuild into web/.cache/
// and imported from there; the kundli client bundle is built for the browser; every number on every page is engine output
// computed here, at build time. Output: web/dist/ (GitHub Pages, base path /shubhvela/).
//
//   node build.mjs [--out <dir>] [--core-only] [--quiet]
//
// --core-only renders the core pages only (home, kundli, /m/, download, privacy, terms, data-deletion, 404 per language);
// D02 adds the data pages (panchang, festival, muhurat, glossary, vrat) behind the flag's default.
import { existsSync } from 'node:fs';
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, join as pjoin, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';
import * as esbuild from 'esbuild';
import {
  APP_PACKAGE, APP_SCHEME, BASE_PATH, BASE_URL, FEATURED_CITY_SLUGS, FONT_FILES, FONT_SRC_DIR, HOME_CITY_SLUG, LANGS, REPO_DIR,
  SOURCE_URL, WEB_DIR, href,
} from './src/config.mjs';
import { tr, webStrings } from './src/i18n.mjs';
import { civilDateLong } from './src/format.mjs';
import { languageSitemaps, sitemapIndexXml } from './src/seo.mjs';
import { renderHome } from './src/templates/home.mjs';
import { renderKundli } from './src/templates/kundli.mjs';
import { renderDownload } from './src/templates/download.mjs';
import { renderPrivacy } from './src/templates/privacy.mjs';
import { renderTerms } from './src/templates/terms.mjs';
import { renderDataDeletion } from './src/templates/data-deletion.mjs';
import { renderNotFound } from './src/templates/notfound.mjs';
import { renderRedirect } from './src/templates/redirect.mjs';
import { renderOg } from './src/og/render.mjs';

/** Date the legal pages were last changed (not the build date, which moves monthly). */
export const LEGAL_UPDATED = '2026-10-30';

/** Rule ids whose text the kundli client can show behind "Why?" (chart honesty markers, yogas, dasha). */
export const CLIENT_RULE_IDS = [
  'lagna', 'moon-chart', 'approx-birth-time', 'approx-sign-boundary', 'dasha-vimshottari', 'dasha-change', 'house-lord', 'vargottama', 'combustion-orbs',
  ...['exalted', 'debilitated', 'own', 'friend', 'enemy', 'neutral', 'combust', 'retro', 'vargottama'].map((t) => `dignity-${t}`),
];

const CACHE_DIR = resolve(WEB_DIR, '.cache');

function parseArgs(argv) {
  const out = { out: resolve(WEB_DIR, 'dist'), coreOnly: false, quiet: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--out') out.out = resolve(argv[++i]);
    else if (argv[i] === '--core-only') out.coreOnly = true;
    else if (argv[i] === '--quiet') out.quiet = true;
  }
  return out;
}

function hash8(content) {
  return createHash('sha256').update(content).digest('hex').slice(0, 8);
}

async function writeOut(outDir, sitePath, content) {
  const file = sitePath.endsWith('/') ? pjoin(outDir, sitePath, 'index.html') : pjoin(outDir, sitePath);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, content);
  return file;
}

async function dirSize(dir) {
  let total = 0;
  let files = 0;
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = pjoin(dir, entry.name);
    if (entry.isDirectory()) {
      const s = await dirSize(p);
      total += s.total;
      files += s.files;
    } else {
      total += (await stat(p)).size;
      files += 1;
    }
  }
  return { total, files };
}

// ---------------------------------------------------------------- step 1: pre-bundles

async function prebundle(log) {
  await mkdir(CACHE_DIR, { recursive: true });
  const common = { bundle: true, platform: 'node', format: 'esm', target: 'node24', logLevel: 'silent', sourcemap: false, legalComments: 'none' };
  await esbuild.build({ ...common, entryPoints: [resolve(REPO_DIR, 'packages', 'engine', 'src', 'index.ts')], outfile: resolve(CACHE_DIR, 'engine.mjs') });
  await esbuild.build({ ...common, entryPoints: [resolve(REPO_DIR, 'packages', 'content', 'src', 'index.ts')], outfile: resolve(CACHE_DIR, 'content.mjs') });
  const bust = `?v=${Date.now()}`;
  const engine = await import(pathToFileURL(resolve(CACHE_DIR, 'engine.mjs')).href + bust);
  const content = await import(pathToFileURL(resolve(CACHE_DIR, 'content.mjs')).href + bust);
  log('pre-bundled engine + content');
  return { engine, content };
}

async function clientBundle(outDir) {
  const result = await esbuild.build({
    entryPoints: [resolve(WEB_DIR, 'src', 'client', 'kundli.ts')],
    bundle: true,
    platform: 'browser',
    format: 'esm',
    target: ['es2020'],
    minify: true,
    sourcemap: false,
    legalComments: 'none',
    outdir: resolve(outDir, 'assets'),
    entryNames: '[name].[hash]',
    metafile: true,
    logLevel: 'silent',
  });
  const out = Object.keys(result.metafile.outputs).find((f) => f.endsWith('.js'));
  const file = out.split(/[\\/]/).pop();
  const bytes = result.metafile.outputs[out].bytes;
  return { file, bytes };
}

async function inlineAssets() {
  const read = (p) => readFile(resolve(WEB_DIR, 'src', p), 'utf8');
  const minJs = async (p) => (await esbuild.transform(await read(p), { minify: true, target: 'es2017', loader: 'js' })).code.trim();
  const css = (await esbuild.transform((await read('tokens.css')) + '\n' + (await read('site.css')), { minify: true, loader: 'css' })).code.trim();
  const scripts = {
    theme: await minJs('client/theme.js'),
    ua: await minJs('client/ua.js'),
    chartScale: await minJs('client/chart-scale.js'),
    toggle: await minJs('client/toggle.js'),
    todayLabel: await minJs('client/today-label.js'),
    loader: await minJs('client/loader.js'),
    notfoundSearch: await minJs('client/notfound-search.js'),
  };
  return { css, scripts };
}

/** Brand assets delivered by the separate brand run (web/public/brand/, never written here): header mark + favicons. */
async function brandAssets() {
  const dir = resolve(WEB_DIR, 'public', 'brand');
  const out = { brandMark: '', icons: '', present: existsSync(resolve(dir, 'logo.svg')) };
  if (existsSync(resolve(dir, 'logo.svg'))) {
    let svg = await readFile(resolve(dir, 'logo.svg'), 'utf8');
    // Theme-correct inline copy: the mark's ink becomes currentColor, the vermilion fill a class the CSS colours with --accent.
    svg = svg
      .replace(/<svg\b([^>]*)>/, (m, attrs) => {
        const vb = /viewBox="([^"]+)"/.exec(attrs)?.[1] ?? '0 0 46 46';
        return `<svg class="mark" viewBox="${vb}" aria-hidden="true" focusable="false">`;
      })
      .replace(/fill="#B83E18"/gi, 'class="acc"')
      .replace(/#1C1A17/gi, 'currentColor')
      .replace(/id="([^"]+)"/g, 'id="brand-$1"')
      .replace(/url\(#([^)]+)\)/g, 'url(#brand-$1)')
      .replace(/\n/g, '');
    out.brandMark = svg;
  }
  const icons = [];
  if (existsSync(resolve(dir, 'favicon.svg'))) icons.push(`<link rel="icon" href="${BASE_PATH}brand/favicon.svg" type="image/svg+xml">`);
  if (existsSync(resolve(dir, 'favicon-32.png'))) icons.push(`<link rel="icon" href="${BASE_PATH}brand/favicon-32.png" sizes="32x32" type="image/png">`);
  if (existsSync(resolve(dir, 'favicon-180.png'))) icons.push(`<link rel="apple-touch-icon" href="${BASE_PATH}brand/favicon-180.png">`);
  out.icons = icons.join('\n');
  return out;
}

// ---------------------------------------------------------------- step 2: engine data for the home page

function todayLocal(engine, tz) {
  const w = engine.utcToWall(Date.now(), tz);
  return `${w.y}-${String(w.m).padStart(2, '0')}-${String(w.d).padStart(2, '0')}`;
}

export function homeData(engine) {
  const cities = engine.WEB_CITIES;
  const city = engine.webCity(HOME_CITY_SLUG);
  if (!city) throw new Error(`Home city ${HOME_CITY_SLUG} missing from web-cities.json`);
  const date = todayLocal(engine, city.tz);
  const geo = { lat: city.lat, lon: city.lon };
  const panchang = engine.panchang(date, geo, city.tz);
  if (panchang.noSun || panchang.sunrise === null) throw new Error('No sunrise for the home city');
  const chart = engine.computeChartAt(panchang.sunrise, geo, city.tz);
  const chartLayouts = Object.fromEntries(LANGS.map((l) => [l, engine.layout('north', chart, 1, 320, { lang: l })]));
  const featured = FEATURED_CITY_SLUGS.map((slug) => {
    const c = engine.webCity(slug);
    if (!c) throw new Error(`Featured city ${slug} missing`);
    return { city: c, panchang: engine.panchang(todayLocal(engine, c.tz), { lat: c.lat, lon: c.lon }, c.tz) };
  });
  const year = Number(date.slice(0, 4));
  const occurrences = [...engine.festivals(year, 'purnimanta', 'north', geo, city.tz), ...engine.festivals(year + 1, 'purnimanta', 'north', geo, city.tz)];
  const festivals = occurrences
    .filter((o) => o.date >= date && (!o.day || o.day === 1))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    .slice(0, 6);
  return { today: { date, year, city, panchang, chart }, chartLayouts, featured, cities, festivals };
}

/** Counts quoted in the copy (D8: never typed by hand): glossary terms, lessons, festival rules, cities, muhurat activities. */
export function contentCounts(engine, content) {
  return {
    glossary: content.loadGlossary('en').items.length,
    lessons: content.loadLessons('en').items.length,
    festivals: engine.FESTIVAL_RULES.length,
    cities: engine.WEB_CITIES.length,
    muhurat: engine.MUHURAT_ACTIVITIES.length,
    vargas: engine.DIVISIONAL_CHART_IDS.length,
  };
}

/** N13: the chart suite's measured maximum planet deviation, rounded UP (an honest bound), from reference/results.json. */
export async function precisionFigure(engine) {
  const results = JSON.parse(await readFile(resolve(REPO_DIR, 'packages', 'engine', 'reference', 'results.json'), 'utf8'));
  const maxDeg = Number(results.charts.maxPlanetDeg);
  if (!Number.isFinite(maxDeg) || maxDeg <= 0) throw new Error('results.json has no charts.maxPlanetDeg');
  const deg = (Math.ceil(maxDeg * 100) / 100).toFixed(2);
  const arcmin = (Math.ceil(maxDeg * 60 * 10) / 10).toFixed(1);
  return { ephemeris: engine.EPHEMERIS, cases: results.charts.compared, deg, arcmin, raw: maxDeg };
}

/** assets/rules-<lang>.json: the rule texts the kundli client shows behind "Why?" (fallback chain bho -> hi -> en). */
export function rulesSubset(content, lang) {
  const out = {};
  const ids = [...CLIENT_RULE_IDS, ...(content.loadCorpus('rules', 'en').snippets.map((s) => s.id).filter((id) => id.startsWith('yoga-') || id.endsWith('-bhanga') || /bhanga/.test(id)))];
  for (const id of new Set(ids)) {
    const r = content.lookup('rules', id, lang);
    if (!r) continue;
    out[id] = { text: r.text, source: r.snippet.source, params: r.snippet.params, lang: r.lang, fallback: r.fallback };
  }
  return out;
}

// ---------------------------------------------------------------- main

export async function build(options = {}) {
  const t0 = performance.now();
  const outDir = options.out ?? resolve(WEB_DIR, 'dist');
  const coreOnly = Boolean(options.coreOnly);
  const log = options.quiet ? () => {} : (m) => console.log(`[web] ${m}`);
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  const { engine, content } = await prebundle(log);
  const bundle = await clientBundle(outDir);
  log(`client bundle assets/${bundle.file} (${(bundle.bytes / 1024).toFixed(0)} KB)`);
  const { css, scripts } = await inlineAssets();
  const cssFile = `site.${hash8(css)}.css`;
  await mkdir(resolve(outDir, 'assets'), { recursive: true });
  await writeFile(resolve(outDir, 'assets', cssFile), css);
  const brand = await brandAssets();
  const en = webStrings('en');

  // Engine data (every number on the site is computed here).
  const data = homeData(engine);
  const counts = contentCounts(engine, content);
  // The copy spells these out (331 cities, fifteen divisional charts, fourteen activities): fail loudly if the engine tables drift.
  if (counts.cities !== 331) throw new Error(`web-cities.json has ${counts.cities} cities, the copy says 331`);
  if (counts.vargas !== 15) throw new Error(`DIVISIONAL_CHART_IDS has ${counts.vargas} entries, the copy says fifteen`);
  if (counts.muhurat !== 14) throw new Error(`MUHURAT_ACTIVITIES has ${counts.muhurat} entries, the copy says fourteen`);
  const precision = await precisionFigure(engine);
  const buildDate = Object.fromEntries(LANGS.map((l) => [l, civilDateLong(engine, LEGAL_UPDATED, l)]));
  log(`today ${data.today.date} at ${data.today.city.name}; precision ${precision.raw}° -> within ${precision.deg}° (${precision.arcmin}′) over ${precision.cases} births`);

  // Per-language JSON assets for the client (rules behind "Why?") and the 404 search.
  const rulesAsset = {};
  for (const l of LANGS) {
    const json = JSON.stringify(rulesSubset(content, l));
    rulesAsset[l] = `rules-${l}.${hash8(json)}.json`;
    await writeFile(resolve(outDir, 'assets', rulesAsset[l]), json);
  }

  // Page plan: path -> renderer. The inventory is complete before any page renders, so templates can ask site.has(path)
  // and render plain text instead of a link to a page that does not exist in this build.
  const plan = [];
  const add = (p) => plan.push(p);
  for (const l of LANGS) {
    const t = tr(l);
    add({ path: `/${l}/`, lang: l, sitemap: true, search: { t: t('home.h1'), k: t('site.name') }, render: (ctx) => renderHome(ctx, { ...data, counts }) });
    add({ path: `/${l}/kundli/`, lang: l, sitemap: true, search: { t: t('kundli.h1'), k: `kundli ${t('nav.kundli')}` }, render: (ctx) => renderKundli(ctx, pageData, { kind: 'kundli' }) });
    add({ path: `/${l}/m/`, lang: l, sitemap: false, render: (ctx) => renderKundli(ctx, pageData, { kind: 'm' }) });
    add({ path: `/${l}/download/`, lang: l, sitemap: true, search: { t: t('download.h1'), k: 'android app play' }, render: (ctx) => renderDownload(ctx) });
    add({ path: `/${l}/privacy/`, lang: l, sitemap: true, search: { t: t('privacy.h1'), k: 'privacy dpdp grievance' }, render: (ctx) => renderPrivacy(ctx, pageData) });
    add({ path: `/${l}/terms/`, lang: l, sitemap: true, search: { t: t('terms.h1'), k: 'terms' }, render: (ctx) => renderTerms(ctx, pageData) });
    add({ path: `/${l}/data-deletion/`, lang: l, sitemap: true, search: { t: t('deletion.h1'), k: 'delete data deletion' }, render: (ctx) => renderDataDeletion(ctx) });
    add({ path: `/${l}/404/`, lang: l, sitemap: false, render: (ctx) => renderNotFound(ctx, pageData) });
  }
  // Root entry points: English copies for the language-less share URLs, redirects for the paths the app links to.
  add({ path: '/m/', lang: 'en', sitemap: false, render: (ctx) => renderKundli(ctx, pageData, { kind: 'm', path: '/m/' }) });
  add({ path: '/kundli/', lang: 'en', sitemap: false, raw: (site) => renderRedirect(site, 'kundli/', { keepQuery: true }) });
  for (const rest of ['', 'privacy/', 'terms/', 'data-deletion/', 'download/']) {
    add({ path: `/${rest}`, lang: 'en', sitemap: false, raw: (site) => renderRedirect(site, rest) });
  }
  add({ path: '/404.html', lang: 'en', sitemap: false, render: (ctx) => renderNotFound(ctx, pageData, { root: true }) });
  if (!coreOnly) {
    // D02: data pages (panchang city + month, festival, muhurat, glossary, vrat) are added to `plan` here.
  }

  const paths = new Set(plan.map((p) => p.path));
  const searchAsset = {};
  for (const l of LANGS) {
    const items = plan.filter((p) => p.lang === l && p.search).map((p) => ({ t: p.search.t, p: href(p.path), k: p.search.k ?? '' }));
    const json = JSON.stringify(items);
    searchAsset[l] = `search-${l}.${hash8(json)}.json`;
    await writeFile(resolve(outDir, 'assets', searchAsset[l]), json);
  }
  const site = {
    has: (p) => paths.has(p),
    paths,
    brandMark: brand.brandMark,
    icons: brand.icons,
    css,
    cssHref: `${BASE_PATH}assets/${cssFile}`,
    scripts,
    fonts: FONT_FILES,
    playUrl: (en['site.playUrl'] ?? '').trim(),
    grievanceEmail: en['site.grievanceEmail'],
    sourceUrl: SOURCE_URL,
    appPackage: APP_PACKAGE,
    appScheme: APP_SCHEME,
    baseUrl: BASE_URL,
  };
  const pageData = { ...data, precision, buildDate, bundleFile: bundle.file, rulesAsset, searchAsset };

  // Render + write.
  const written = [];
  for (const p of plan) {
    const html = p.raw ? p.raw(site) : p.render({ lang: p.lang, t: tr(p.lang), site, engine, content });
    await writeOut(outDir, p.path, html);
    written.push(p.path);
  }
  log(`rendered ${written.length} pages`);

  // Static files: web/public (robots.txt, .nojekyll, brand/ when present) and the fonts copied from the app bundle.
  await cp(resolve(WEB_DIR, 'public'), outDir, { recursive: true });
  await mkdir(resolve(outDir, 'fonts'), { recursive: true });
  for (const f of Object.values(FONT_FILES)) await cp(resolve(FONT_SRC_DIR, f), resolve(outDir, 'fonts', f));

  // OG images (P6): site + kundli per language.
  const og = [];
  for (const l of LANGS) {
    const t = tr(l);
    const siteUrl = `sudish007.github.io/shubhvela/${l}/`;
    og.push(await renderOg({ lang: l, title: t('home.ogTitle'), subtitle: t('home.ogDescription'), url: siteUrl, out: resolve(outDir, 'og', l, 'site.png') }));
    og.push(await renderOg({ lang: l, title: t('kundli.ogTitle'), subtitle: t('kundli.ogDescription'), url: `${siteUrl}kundli/`, out: resolve(outDir, 'og', l, 'kundli.png') }));
  }
  const ogBytes = og.reduce((a, b) => a + b.bytes, 0);
  log(`og images ${og.length} (${(ogBytes / 1024).toFixed(0)} KB, brand mark ${og[0].mark ? 'embedded' : 'absent'})`);

  // Sitemaps: one per language under an index; /m/, 404 and redirects excluded.
  const lastmod = new Date().toISOString().slice(0, 10);
  const files = [];
  for (const l of LANGS) {
    const entries = plan.filter((p) => p.lang === l && p.sitemap).map((p) => ({ path: p.path, lastmod }));
    for (const sm of languageSitemaps(l, entries)) {
      await writeFile(resolve(outDir, sm.file), sm.xml);
      files.push(sm.file);
    }
  }
  await writeFile(resolve(outDir, 'sitemap.xml'), sitemapIndexXml(files, lastmod));

  const size = await dirSize(outDir);
  const elapsed = (performance.now() - t0) / 1000;
  const summary = {
    pages: written.length,
    paths: written,
    sitemapUrls: plan.filter((p) => p.sitemap).length,
    distBytes: size.total,
    files: size.files,
    ogBytes,
    bundle,
    elapsedSeconds: Number(elapsed.toFixed(1)),
    today: data.today.date,
    precision,
    counts,
    brand: brand.present,
  };
  log(`${summary.pages} pages, ${summary.sitemapUrls} sitemap URLs, dist ${(size.total / 1024 / 1024).toFixed(1)} MB in ${size.files} files, ${elapsed.toFixed(1)} s`);
  return summary;
}

const isMain = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
  const args = parseArgs(process.argv.slice(2));
  build({ out: args.out, coreOnly: args.coreOnly, quiet: args.quiet }).catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
