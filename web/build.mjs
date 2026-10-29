#!/usr/bin/env node
// Shubhvela web companion — static site generator (spec F41-F43; plan.md D01/D02; design.md 9, 10.10).
// Node 24, no template engine, no tsx: the engine and the content package are pre-bundled with esbuild into web/.cache/
// and imported from there; the kundli and data-pages client bundles are built for the browser; every number on every
// page is engine output computed here, at build time. Output: web/dist/ (GitHub Pages, base path /shubhvela/).
//
//   node build.mjs [--out <dir>] [--core-only] [--quiet]
//
// --core-only renders the core pages only (home, kundli, /m/, download, privacy, terms, data-deletion, 404 per language).
// The default adds the data pages (D02): panchang for 331 cities (current + next month, rolled forward from the build
// date in Asia/Kolkata), festivals 2026-2028 (+ buildYear + 2) with Event JSON-LD, muhurat 14 activities × 12 rolling
// months, glossary, vrats; per-entity OG images; per-language sitemaps split at 50,000 URLs; budgets dist <= 150 MB and
// og <= 60 MB asserted.
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
import { civilDateLong, tithiLabel } from './src/format.mjs';
import { languageSitemaps, sitemapIndexXml } from './src/seo.mjs';
import { renderHome } from './src/templates/home.mjs';
import { renderKundli } from './src/templates/kundli.mjs';
import { renderDownload } from './src/templates/download.mjs';
import { renderPrivacy } from './src/templates/privacy.mjs';
import { renderTerms } from './src/templates/terms.mjs';
import { renderDataDeletion } from './src/templates/data-deletion.mjs';
import { renderNotFound } from './src/templates/notfound.mjs';
import { renderRedirect } from './src/templates/redirect.mjs';
import { renderPanchangCity, renderPanchangIndex } from './src/templates/panchang-city.mjs';
import { renderPanchangMonth } from './src/templates/panchang-month.mjs';
import { renderFestival, renderFestivalsIndex, renderFestivalsYear } from './src/templates/festival.mjs';
import { renderMuhuratIndex, renderMuhuratMonth } from './src/templates/muhurat-month.mjs';
import { renderGlossaryIndex, renderGlossaryTerm } from './src/templates/glossary.mjs';
import { renderVrat, renderVratIndex } from './src/templates/vrat.mjs';
import { renderOg } from './src/og/render.mjs';
import { OG_BAND } from './src/og/templates.mjs';
import { bandSvg, bandTickTexts } from './src/band-svg.mjs';
import { cityList, cityName, cityPickerJson } from './src/data/cities.mjs';
import { buildCalendar, monthLabel, panchangData } from './src/data/panchang.mjs';
import { dayTimes, festivalCopy, festivalData } from './src/data/festivals.mjs';
import { muhuratCopy, muhuratData } from './src/data/muhurat.mjs';
import { glossaryData } from './src/data/glossary.mjs';
import { vratCopy, vratData } from './src/data/vrats.mjs';

/** Date the legal pages were last changed (not the build date, which moves monthly). */
export const LEGAL_UPDATED = '2026-10-30';

/** Size budgets (design.md 9 M11; plan P6), asserted by the build. */
export const DIST_BUDGET_BYTES = 150 * 1024 * 1024;
export const OG_BUDGET_BYTES = 60 * 1024 * 1024;

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

/** Drops template indentation (leading whitespace after a newline) — the inline scripts are already minified to one line. */
export function compactHtml(html) {
  return html.replace(/\n[ \t]+/g, '\n').replace(/\n{2,}/g, '\n');
}

async function writeOut(outDir, sitePath, content) {
  const file = sitePath.endsWith('/') ? pjoin(outDir, sitePath, 'index.html') : pjoin(outDir, sitePath);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, sitePath.endsWith('/') || sitePath.endsWith('.html') ? compactHtml(content) : content);
  return file;
}

async function dirSize(dir) {
  let total = 0;
  let files = 0;
  if (!existsSync(dir)) return { total, files };
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

const mb = (bytes) => (bytes / 1024 / 1024).toFixed(1);

/** Runs async tasks with bounded concurrency (OG rendering: sharp/libvips is thread-pooled already). */
async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const idx = i++;
      if (idx >= items.length) return;
      out[idx] = await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
  return out;
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
  return { engine, content, enginePath: resolve(CACHE_DIR, 'engine.mjs') };
}

async function clientBundle(outDir, entry) {
  const result = await esbuild.build({
    entryPoints: [resolve(WEB_DIR, 'src', 'client', entry)],
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
    todayMark: await minJs('client/today-mark.js'),
    picker: await minJs('client/picker.js'),
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

// ---------------------------------------------------------------- step 3: data pages (D02)

/** Everything the data templates need, computed once (engine calls) and shared by the three languages. */
export async function dataPagesData(engine, content, { enginePath, log }) {
  const calendar = buildCalendar(engine);
  const cities = cityList(engine);
  const t0 = performance.now();
  const panchang = await panchangData(engine, cities, calendar, { enginePath, log });
  const tPanchang = (performance.now() - t0) / 1000;
  const festivals = festivalData(engine, calendar.year);
  // Sunrise/moonrise at the default city for every festival date (static part of the city picker), cached by city|date.
  const festivalTimes = new Map();
  for (const year of festivals.years) {
    for (const e of festivals.byYear.get(year).values()) {
      for (const [side, pl] of [['north', festivals.north], ['south', festivals.south]]) {
        const o = e[side][0];
        if (!o) continue;
        const key = `${pl.city.slug}|${o.date}`;
        if (!festivalTimes.has(key)) festivalTimes.set(key, dayTimes(engine, o.date, pl));
      }
    }
  }
  const muhurat = muhuratData(engine, calendar, { log });
  const vrats = vratData(engine, calendar, { log });
  const glossary = {};
  const festivalCopyByLang = {};
  const muhuratCopyByLang = {};
  const vratCopyByLang = {};
  for (const l of LANGS) {
    glossary[l] = glossaryData(content, l);
    festivalCopyByLang[l] = new Map();
    for (const year of festivals.years) for (const slug of festivals.byYear.get(year).keys()) if (!festivalCopyByLang[l].has(slug)) festivalCopyByLang[l].set(slug, festivalCopy(content, slug, l));
    muhuratCopyByLang[l] = new Map(muhurat.activities.map((a) => [a.id, muhuratCopy(content, a.id, muhurat.ruleOrder, l)]));
    vratCopyByLang[l] = new Map(vrats.families.map((f) => [f, vratCopy(content, f, l)]));
  }
  log(`festivals ${festivals.years.join('/')}: ${festivals.years.map((y) => festivals.byYear.get(y).size).join('/')} slug-years; glossary ${glossary.en.count} terms`);
  return { calendar, cities, panchang, festivals, festivalTimes, muhurat, vrats, glossary, festivalCopy: festivalCopyByLang, muhuratCopy: muhuratCopyByLang, vratCopy: vratCopyByLang, timing: { panchangSeconds: Number(tPanchang.toFixed(1)) } };
}

/** Appends the data pages to the plan (counts per type returned for the summary). */
function planDataPages(add, data) {
  const counts = { panchangCity: 0, panchangMonth: 0, panchangIndex: 0, festival: 0, festivalsIndex: 0, muhurat: 0, muhuratIndex: 0, glossaryTerm: 0, glossaryIndex: 0, vrat: 0, vratIndex: 0 };
  for (const l of LANGS) {
    const t = tr(l);
    add({ path: `/${l}/panchang/`, lang: l, sitemap: true, type: 'panchangIndex', search: { t: t('panchang.indexH1'), k: 'panchang cities' }, render: (ctx) => renderPanchangIndex(ctx, data) });
    counts.panchangIndex++;
    for (const city of data.cities) {
      add({ path: `/${l}/panchang/${city.slug}/`, lang: l, sitemap: true, type: 'panchangCity', search: { t: `${cityName(city, l)} · ${t('nav.panchang')}`, k: `${city.nameAscii} ${city.name} panchang` }, render: (ctx) => renderPanchangCity(ctx, data, { city, ym: data.calendar.currentMonth, isCurrent: true }) });
      add({ path: `/${l}/panchang/${city.slug}/${data.calendar.nextMonth}/`, lang: l, sitemap: true, type: 'panchangMonth', render: (ctx) => renderPanchangMonth(ctx, data, { city, ym: data.calendar.nextMonth }) });
      counts.panchangCity++;
      counts.panchangMonth++;
    }
    add({ path: `/${l}/festivals/`, lang: l, sitemap: true, type: 'festivalsIndex', search: { t: t('festival.indexH1'), k: 'festivals' }, render: (ctx) => renderFestivalsIndex(ctx, data) });
    counts.festivalsIndex++;
    for (const year of data.festivals.years) {
      add({ path: `/${l}/festivals/${year}/`, lang: l, sitemap: true, type: 'festivalsIndex', search: { t: t('festival.yearH1', { year }), k: `festivals ${year}` }, render: (ctx) => renderFestivalsYear(ctx, data, { year }) });
      counts.festivalsIndex++;
      for (const entry of data.festivals.byYear.get(year).values()) {
        add({ path: `/${l}/festival/${entry.slug}/${year}/`, lang: l, sitemap: true, type: 'festival', search: { t: `${entry.names[l] ?? entry.names.en} ${year}`, k: `${entry.slug} ${entry.names.en} festival` }, render: (ctx) => renderFestival(ctx, data, { entry }) });
        counts.festival++;
      }
    }
    add({ path: `/${l}/muhurat/`, lang: l, sitemap: true, type: 'muhuratIndex', search: { t: t('muhurat.indexH1'), k: 'muhurat' }, render: (ctx) => renderMuhuratIndex(ctx, data) });
    counts.muhuratIndex++;
    for (const activity of data.muhurat.activities) {
      for (const ym of data.muhurat.months) {
        add({ path: `/${l}/muhurat/${activity.id}/${ym}/`, lang: l, sitemap: true, type: 'muhurat', search: ym === data.muhurat.months[0] ? { t: `${activity.names[l] ?? activity.names.en} · ${t('nav.muhurat')}`, k: `${activity.id} muhurat` } : undefined, render: (ctx) => renderMuhuratMonth(ctx, data, { activity, ym }) });
        counts.muhurat++;
      }
    }
    add({ path: `/${l}/glossary/`, lang: l, sitemap: true, type: 'glossaryIndex', search: { t: t('glossary.indexH1'), k: 'glossary' }, render: (ctx) => renderGlossaryIndex(ctx, data) });
    counts.glossaryIndex++;
    for (const e of data.glossary[l].items) {
      add({ path: `/${l}/glossary/${e.id}/`, lang: l, sitemap: true, type: 'glossaryTerm', search: { t: `${e.term_dev} · ${e.term_lat}`, k: `${e.id} glossary` }, render: (ctx) => renderGlossaryTerm(ctx, data, { id: e.id }) });
      counts.glossaryTerm++;
    }
    add({ path: `/${l}/vrat/`, lang: l, sitemap: true, type: 'vratIndex', search: { t: t('vrat.indexH1'), k: 'vrat' }, render: (ctx) => renderVratIndex(ctx, data) });
    counts.vratIndex++;
    for (const family of data.vrats.families) {
      const f = data.vrats.byFamily.get(family);
      add({ path: `/${l}/vrat/${f.slug}/`, lang: l, sitemap: true, type: 'vrat', search: { t: t(`vrat.family.${family}`), k: `${f.slug} vrat` }, render: (ctx) => renderVrat(ctx, data, { family }) });
      counts.vrat++;
    }
  }
  return counts;
}

/** OG jobs for the data pages (P6): per festival-year, per city (with the build day's band), per activity, per vrat, one glossary image per language. */
function ogJobs(engine, data, outDir) {
  const jobs = [];
  const base = 'sudish007.github.io/shubhvela';
  for (const l of LANGS) {
    const t = tr(l);
    for (const year of data.festivals.years) {
      for (const e of data.festivals.byYear.get(year).values()) {
        const name = e.names[l] ?? e.names.en;
        const parts = [
          e.north[0] ? t('festival.dateLine', { system: t('panchang.purnimanta'), date: civilDateLong(engine, e.north[0].date, l) }) : null,
          e.south[0] ? t('festival.dateLine', { system: t('panchang.amanta'), date: civilDateLong(engine, e.south[0].date, l) }) : null,
        ].filter(Boolean);
        jobs.push({ lang: l, title: `${name} ${year}`, subtitle: parts.join(' · '), url: `${base}/${l}/festival/${e.slug}/${year}/`, out: resolve(outDir, 'og', l, 'festival', `${e.slug}-${year}.png`), type: 'festival' });
      }
    }
    for (const city of data.cities) {
      const cd = data.panchang.get(city.slug);
      const p = cd.today.panchang;
      const gh = cd.today.gh;
      const date = civilDateLong(engine, cd.today.date, l);
      const sub = p.noSun || !p.tithi ? date : `${date} · ${tithiLabel(engine, p.tithi, l)} · ${engine.locale.nakshatraNames[l][p.nakshatra.index]}`;
      const band = gh.ticks
        ? { svg: bandSvg(engine, gh, { mode: 'standalone', width: OG_BAND.width, stripHeight: OG_BAND.height, ticksRow: false, id: 'og' }), ticks: bandTickTexts(engine, gh) }
        : null;
      jobs.push({ lang: l, title: t('panchang.ogTitle', { city: cityName(city, l) }), subtitle: sub, url: `${base}/${l}/panchang/${city.slug}/`, out: resolve(outDir, 'og', l, 'panchang', `${city.slug}.png`), band, type: 'city' });
    }
    const from = monthLabel(engine, data.muhurat.months[0], l);
    const to = monthLabel(engine, data.muhurat.months[data.muhurat.months.length - 1], l);
    for (const a of data.muhurat.activities) {
      jobs.push({ lang: l, title: t('muhurat.ogTitle', { activity: a.names[l] ?? a.names.en }), subtitle: t('muhurat.ogSubtitle', { from, to, city: cityName(data.muhurat.city, l) }), url: `${base}/${l}/muhurat/${a.id}/${data.muhurat.months[0]}/`, out: resolve(outDir, 'og', l, 'muhurat', `${a.id}.png`), type: 'activity' });
    }
    for (const family of data.vrats.families) {
      const f = data.vrats.byFamily.get(family);
      const o = f.occurrences[0];
      const sub = o ? t('vrat.ogSubtitle', { name: t(`vrat.name.${o.name}`), date: civilDateLong(engine, o.date, l), city: cityName(data.vrats.city, l) }) : '';
      jobs.push({ lang: l, title: t('vrat.pageTitle', { family: t(`vrat.family.${family}`) }), subtitle: sub, url: `${base}/${l}/vrat/${f.slug}/`, out: resolve(outDir, 'og', l, 'vrat', `${f.slug}.png`), type: 'vrat' });
    }
    jobs.push({ lang: l, title: t('glossary.indexH1'), subtitle: t('glossary.ogSubtitle', { count: data.glossary[l].count }), url: `${base}/${l}/glossary/`, out: resolve(outDir, 'og', l, 'glossary.png'), type: 'glossary' });
  }
  return jobs;
}

// ---------------------------------------------------------------- main

export async function build(options = {}) {
  const t0 = performance.now();
  const outDir = options.out ?? resolve(WEB_DIR, 'dist');
  const coreOnly = Boolean(options.coreOnly);
  const log = options.quiet ? () => {} : (m) => console.log(`[web] ${m}`);
  const timing = {};
  const lap = (key, since) => {
    timing[key] = Number(((performance.now() - since) / 1000).toFixed(1));
    return performance.now();
  };
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  let mark = performance.now();
  const { engine, content, enginePath } = await prebundle(log);
  const bundle = await clientBundle(outDir, 'kundli.ts');
  log(`client bundle assets/${bundle.file} (${(bundle.bytes / 1024).toFixed(0)} KB)`);
  const dataBundle = coreOnly ? null : await clientBundle(outDir, 'data-pages.ts');
  if (dataBundle) log(`data bundle assets/${dataBundle.file} (${(dataBundle.bytes / 1024).toFixed(0)} KB)`);
  const { css, scripts } = await inlineAssets();
  const cssFile = `site.${hash8(css)}.css`;
  await mkdir(resolve(outDir, 'assets'), { recursive: true });
  await writeFile(resolve(outDir, 'assets', cssFile), css);
  const brand = await brandAssets();
  const en = webStrings('en');
  mark = lap('bundles', mark);

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
  const dataPages = coreOnly ? null : await dataPagesData(engine, content, { enginePath, log });
  mark = lap('engineData', mark);

  // Per-language JSON assets for the client (rules behind "Why?") and the 404 search; the city list for the pickers.
  const rulesAsset = {};
  for (const l of LANGS) {
    const json = JSON.stringify(rulesSubset(content, l));
    rulesAsset[l] = `rules-${l}.${hash8(json)}.json`;
    await writeFile(resolve(outDir, 'assets', rulesAsset[l]), json);
  }
  let citiesAsset = null;
  if (dataPages) {
    const json = cityPickerJson(dataPages.cities);
    citiesAsset = `cities.${hash8(json)}.json`;
    await writeFile(resolve(outDir, 'assets', citiesAsset), json);
  }

  // Page plan: path -> renderer. The inventory is complete before any page renders, so templates can ask site.has(path)
  // and render plain text instead of a link to a page that does not exist in this build.
  const plan = [];
  const add = (p) => plan.push(p);
  for (const l of LANGS) {
    const t = tr(l);
    add({ path: `/${l}/`, lang: l, sitemap: true, type: 'core', search: { t: t('home.h1'), k: t('site.name') }, render: (ctx) => renderHome(ctx, { ...data, counts }) });
    add({ path: `/${l}/kundli/`, lang: l, sitemap: true, type: 'core', search: { t: t('kundli.h1'), k: `kundli ${t('nav.kundli')}` }, render: (ctx) => renderKundli(ctx, pageData, { kind: 'kundli' }) });
    add({ path: `/${l}/m/`, lang: l, sitemap: false, type: 'core', render: (ctx) => renderKundli(ctx, pageData, { kind: 'm' }) });
    add({ path: `/${l}/download/`, lang: l, sitemap: true, type: 'core', search: { t: t('download.h1'), k: 'android app play' }, render: (ctx) => renderDownload(ctx) });
    add({ path: `/${l}/privacy/`, lang: l, sitemap: true, type: 'core', search: { t: t('privacy.h1'), k: 'privacy dpdp grievance' }, render: (ctx) => renderPrivacy(ctx, pageData) });
    add({ path: `/${l}/terms/`, lang: l, sitemap: true, type: 'core', search: { t: t('terms.h1'), k: 'terms' }, render: (ctx) => renderTerms(ctx, pageData) });
    add({ path: `/${l}/data-deletion/`, lang: l, sitemap: true, type: 'core', search: { t: t('deletion.h1'), k: 'delete data deletion' }, render: (ctx) => renderDataDeletion(ctx) });
    add({ path: `/${l}/404/`, lang: l, sitemap: false, type: 'core', render: (ctx) => renderNotFound(ctx, pageData) });
  }
  // Root entry points: English copies for the language-less share URLs, redirects for the paths the app links to.
  add({ path: '/m/', lang: 'en', sitemap: false, type: 'root', render: (ctx) => renderKundli(ctx, pageData, { kind: 'm', path: '/m/' }) });
  add({ path: '/kundli/', lang: 'en', sitemap: false, type: 'root', raw: (site) => renderRedirect(site, 'kundli/', { keepQuery: true }) });
  for (const rest of ['', 'privacy/', 'terms/', 'data-deletion/', 'download/']) {
    add({ path: `/${rest}`, lang: 'en', sitemap: false, type: 'root', raw: (site) => renderRedirect(site, rest) });
  }
  add({ path: '/404.html', lang: 'en', sitemap: false, type: 'root', render: (ctx) => renderNotFound(ctx, pageData, { root: true }) });
  const pageCounts = dataPages ? planDataPages(add, dataPages) : {};
  pageCounts.core = plan.filter((p) => p.type === 'core').length;
  pageCounts.root = plan.filter((p) => p.type === 'root').length;

  const paths = new Set(plan.map((p) => p.path));
  if (paths.size !== plan.length) throw new Error('duplicate paths in the page plan');
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
    citiesAsset,
    dataBundleFile: dataBundle?.file ?? null,
  };
  const pageData = { ...data, precision, buildDate, bundleFile: bundle.file, rulesAsset, searchAsset };

  // Render + write.
  const written = [];
  const ctxCache = Object.fromEntries(LANGS.map((l) => [l, { lang: l, t: tr(l), site, engine, content }]));
  for (const p of plan) {
    const html = p.raw ? p.raw(site) : p.render(ctxCache[p.lang]);
    await writeOut(outDir, p.path, html);
    written.push(p.path);
  }
  mark = lap('render', mark);
  log(`rendered ${written.length} pages in ${timing.render} s`);

  // Static files: web/public (robots.txt, .nojekyll, brand/ when present) and the fonts copied from the app bundle.
  await cp(resolve(WEB_DIR, 'public'), outDir, { recursive: true });
  await mkdir(resolve(outDir, 'fonts'), { recursive: true });
  for (const f of Object.values(FONT_FILES)) await cp(resolve(FONT_SRC_DIR, f), resolve(outDir, 'fonts', f));

  // OG images (P6): site + kundli per language, then per entity (festival-year, city with today's band, activity, vrat, glossary).
  const ogPlan = [];
  for (const l of LANGS) {
    const t = tr(l);
    const siteUrl = `sudish007.github.io/shubhvela/${l}/`;
    ogPlan.push({ lang: l, title: t('home.ogTitle'), subtitle: t('home.ogDescription'), url: siteUrl, out: resolve(outDir, 'og', l, 'site.png'), type: 'site' });
    ogPlan.push({ lang: l, title: t('kundli.ogTitle'), subtitle: t('kundli.ogDescription'), url: `${siteUrl}kundli/`, out: resolve(outDir, 'og', l, 'kundli.png'), type: 'site' });
  }
  if (dataPages) ogPlan.push(...ogJobs(engine, dataPages, outDir));
  const ogResults = await mapLimit(ogPlan, 4, (job) => renderOg(job));
  const ogBytes = ogResults.reduce((a, b) => a + b.bytes, 0);
  const ogCounts = {};
  for (const j of ogPlan) ogCounts[j.type] = (ogCounts[j.type] ?? 0) + 1;
  mark = lap('og', mark);
  log(`og images ${ogPlan.length} (${mb(ogBytes)} MB, brand mark ${ogResults[0].mark ? 'embedded' : 'absent'}) in ${timing.og} s`);
  if (ogBytes > OG_BUDGET_BYTES) throw new Error(`og/ is ${mb(ogBytes)} MB, over the ${mb(OG_BUDGET_BYTES)} MB budget`);

  // Sitemaps: one per language under an index (<= 50,000 URLs per file); /m/, 404 and redirects excluded.
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
  if (size.total > DIST_BUDGET_BYTES) throw new Error(`dist/ is ${mb(size.total)} MB, over the ${mb(DIST_BUDGET_BYTES)} MB budget`);
  const elapsed = (performance.now() - t0) / 1000;
  const summary = {
    pages: written.length,
    paths: written,
    pageCounts,
    sitemapUrls: plan.filter((p) => p.sitemap).length,
    sitemapFiles: files,
    distBytes: size.total,
    files: size.files,
    ogBytes,
    ogCount: ogPlan.length,
    ogCounts,
    bundle,
    dataBundle,
    elapsedSeconds: Number(elapsed.toFixed(1)),
    timing: { ...timing, panchangSeconds: dataPages?.timing.panchangSeconds ?? 0 },
    today: data.today.date,
    calendar: dataPages?.calendar ?? null,
    festivalYears: dataPages?.festivals.years ?? [],
    precision,
    counts,
    brand: brand.present,
    budgets: { distBytes: DIST_BUDGET_BYTES, ogBytes: OG_BUDGET_BYTES },
  };
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(resolve(CACHE_DIR, 'build-summary.json'), JSON.stringify(summary, null, 2));
  log(`${summary.pages} pages (${Object.entries(pageCounts).map(([k, v]) => `${k} ${v}`).join(', ')}), ${summary.sitemapUrls} sitemap URLs in ${files.length} files, dist ${mb(size.total)} MB in ${size.files} files, og ${ogPlan.length} / ${mb(ogBytes)} MB, ${elapsed.toFixed(1)} s`);
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
