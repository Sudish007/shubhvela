// Shubhvela web layout audit (plan D03; design.md 9, 12; spec 8 web rules, 11 web gates; review M1).
// Usage: node web/audit/shoot-audit.mjs [--out <dir>] [--only <pageId,...>] [--widths 320,390] [--no-png]
// Serves web/dist locally under /shubhvela/, drives the Playwright-installed Chromium (playwright-core, no download)
// over every page type x 320/390/1024/1440/1920/2560 x light/dark and writes <page>-<width>-<theme>.png + audit.json.
// Checks per shot: 0 horizontal overflow; min RENDERED font >= 12 px including SVG text (fontSize x getScreenCTM().a, M1);
// every interactive control >= 44 x 44; content box >= 88 % of the viewport at >= 1920; hreflang set == {en, hi, x-default}
// (no bho) or none + noindex on /m/ and 404; skip link present and focusable; Android-only intent:// buttons hidden for a
// desktop UA; theme toggle aria-pressed = current state, label = target state. Per page: Android UA shows the intent
// buttons; toggle click round trip persists through a reload. 2560 is shot at deviceScaleFactor 0.75 (PNG <= 1920 px).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { DIST, playwrightChromium, serveDist } from './serve.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const args = process.argv.slice(2);
const argValue = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const OUT = path.resolve(argValue('--out') || path.join(REPO, '.agents', 'tasks', 'v1-build', 'shots', 'phase-d', 'web'));
const ONLY = argValue('--only') ? new Set(argValue('--only').split(',')) : null;
const NO_PNG = args.includes('--no-png');
fs.mkdirSync(OUT, { recursive: true });

// Viewports (spec 8: 320-2560). Heights keep every PNG <= 1920 px per side (build-rules binary-file rule): 2560 x 1440 @ 0.75.
const VIEWPORTS = [
  { w: 320, h: 640, dsf: 1 },
  { w: 390, h: 800, dsf: 1 },
  { w: 1024, h: 768, dsf: 1 },
  { w: 1440, h: 900, dsf: 1 },
  { w: 1920, h: 1080, dsf: 1 },
  { w: 2560, h: 1440, dsf: 0.75 },
];
const WIDTHS = argValue('--widths') ? new Set(argValue('--widths').split(',').map(Number)) : null;
const THEMES = ['light', 'dark'];
const SAMPLE_QUERY = 'v=1&d=19980314&t=0642&a=30&lat=26.85&lon=80.95&tz=Asia%2FKolkata&g=f';
const DESKTOP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';

/** First subdirectory of dist/<rel> (sorted), e.g. the current muhurat month; null when missing. */
function firstDir(rel) {
  const p = path.join(DIST, rel);
  if (!fs.existsSync(p)) return null;
  const dirs = fs.readdirSync(p, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
  return dirs[0] ?? null;
}
const exists = (rel) => fs.existsSync(path.join(DIST, rel, 'index.html'));

const nextMonth = firstDir('en/panchang/new-delhi');
const muhuratMonth = firstDir('en/muhurat/griha-pravesh');
const glossaryTerm = exists('en/glossary/lagna') ? 'lagna' : firstDir('en/glossary');
const festivalYear = firstDir('en/festival/diwali');

// Every page type (F42) in English, plus hi/bho variants of the Devanagari-heavy types (long headings at 320 px).
const PAGES = [
  { id: 'home-en', path: '/en/', intent: true },
  { id: 'home-hi', path: '/hi/', intent: true },
  { id: 'home-bho', path: '/bho/', intent: true },
  { id: 'kundli-en', path: '/en/kundli/', query: SAMPLE_QUERY, hydrate: true, intent: true },
  { id: 'kundli-hi', path: '/hi/kundli/', query: SAMPLE_QUERY, hydrate: true, intent: true },
  { id: 'kundli-en-empty', path: '/en/kundli/' },
  { id: 'm-en', path: '/en/m/', query: SAMPLE_QUERY, hydrate: true, intent: true, noindex: true, canonical: '/en/kundli/' },
  { id: 'panchang-index-en', path: '/en/panchang/' },
  { id: 'panchang-city-en', path: '/en/panchang/new-delhi/' },
  { id: 'panchang-city-hi', path: '/hi/panchang/new-delhi/' },
  { id: 'panchang-month-en', path: `/en/panchang/new-delhi/${nextMonth}/` },
  { id: 'festivals-index-en', path: '/en/festivals/' },
  { id: 'festival-en', path: `/en/festival/diwali/${festivalYear}/`, intent: true },
  { id: 'festival-hi', path: `/hi/festival/diwali/${festivalYear}/`, intent: true },
  { id: 'muhurat-index-en', path: '/en/muhurat/' },
  { id: 'muhurat-en', path: `/en/muhurat/griha-pravesh/${muhuratMonth}/` },
  { id: 'muhurat-hi', path: `/hi/muhurat/griha-pravesh/${muhuratMonth}/` },
  { id: 'glossary-index-en', path: '/en/glossary/' },
  { id: 'glossary-term-en', path: `/en/glossary/${glossaryTerm}/` },
  { id: 'glossary-term-hi', path: `/hi/glossary/${glossaryTerm}/` },
  { id: 'vrat-index-en', path: '/en/vrat/' },
  { id: 'vrat-en', path: '/en/vrat/ekadashi/' },
  { id: 'vrat-bho', path: '/bho/vrat/ekadashi/' },
  { id: 'download-en', path: '/en/download/', intent: true },
  { id: 'privacy-en', path: '/en/privacy/' },
  { id: 'terms-en', path: '/en/terms/' },
  { id: 'data-deletion-en', path: '/en/data-deletion/' },
  { id: '404', path: '/en/this-page-does-not-exist/', status: 404, noindex: true, canonical: '/en/404/' },
].filter((p) => !p.path.includes('/null/') && (!ONLY || ONLY.has(p.id)));

const FONT_SETS = {
  en: ['"Tiro Devanagari Hindi"', '"Noto Sans"'],
  hi: ['"Tiro Devanagari Hindi"', '"Noto Sans Devanagari"'],
  bho: ['"Tiro Devanagari Hindi"', '"Noto Sans Devanagari"'],
};

/** Runs in the page: every measurable rule in one pass. */
function auditInPage() {
  const de = document.documentElement;
  const vw = window.innerWidth;
  const overflow = Math.max(0, de.scrollWidth - vw, document.body.scrollWidth - vw);
  const visible = (el) => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  // Culprits: visible elements whose right edge passes the viewport and that are not inside a horizontal scroller.
  const overflowEls = [];
  if (overflow > 0) {
    document.body.querySelectorAll('*').forEach((el) => {
      if (overflowEls.length >= 8 || !visible(el)) return;
      const r = el.getBoundingClientRect();
      if (r.right <= vw + 1) return;
      const scroller = el.parentElement && el.parentElement.closest('.tscroll, .links');
      if (scroller && scroller !== el) return;
      overflowEls.push(`${el.tagName.toLowerCase()}${typeof el.className === 'string' && el.className ? '.' + el.className.split(' ')[0] : ''} right=${Math.round(r.right)} w=${Math.round(r.width)}`);
    });
  }
  // Minimum RENDERED font: CSS font-size x the SVG screen transform scale for text inside <svg> (review M1).
  let minFont = 999; let minFontEl = ''; let minSvgFont = null; let minSvgEl = ''; let textNodes = 0;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = walker.nextNode())) {
    if (!n.nodeValue.trim()) continue;
    const el = n.parentElement;
    if (!el || /^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE|TITLE|DESC)$/i.test(el.tagName)) continue;
    if (el.closest('script,style,noscript,template')) continue;
    if (!visible(el)) continue;
    const css = parseFloat(getComputedStyle(el).fontSize);
    let k = 1;
    const svg = el.closest('svg');
    if (svg && typeof el.getScreenCTM === 'function') {
      const m = el.getScreenCTM();
      if (m) k = Math.hypot(m.a, m.b);
    }
    const rendered = css * k;
    textNodes++;
    const tag = el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : '') + ':' + n.nodeValue.trim().slice(0, 24);
    if (rendered < minFont) { minFont = rendered; minFontEl = tag; }
    if (svg && (minSvgFont === null || rendered < minSvgFont)) { minSvgFont = rendered; minSvgEl = tag + ` (css ${css.toFixed(2)} x k ${k.toFixed(4)})`; }
  }
  // Interactive controls >= 44 x 44 (spec 8). Checkbox/radio inputs count through their >= 44 px label.
  const small = [];
  let controls = 0;
  document.querySelectorAll('a[href], button, input, select, textarea, summary, [role=button], [role=switch]').forEach((c) => {
    if (!visible(c)) return;
    if (c.tagName === 'INPUT' && (c.type === 'checkbox' || c.type === 'radio')) {
      const lab = c.closest('label');
      if (lab) { const lr = lab.getBoundingClientRect(); if (lr.height >= 44 && lr.width >= 44) return; }
    }
    if (c.tagName === 'INPUT' && c.type === 'hidden') return;
    controls++;
    const r = c.getBoundingClientRect();
    if (r.width < 43.5 || r.height < 43.5) {
      small.push(`${c.tagName.toLowerCase()}${c.className && typeof c.className === 'string' ? '.' + c.className.split(' ').slice(0, 2).join('.') : ''} ${Math.round(r.width)}x${Math.round(r.height)} '${(c.textContent || c.getAttribute('aria-label') || '').trim().slice(0, 30)}'`);
    }
  });
  // Content box: the first .wrap inside <main> (inner width without gutters) over the viewport.
  const wrap = document.querySelector('main .wrap') || document.querySelector('.wrap');
  let contentRatio = null; let gutter = null;
  if (wrap) {
    const cs = getComputedStyle(wrap);
    gutter = parseFloat(cs.paddingLeft);
    contentRatio = Math.round(((wrap.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)) / vw) * 1000) / 1000;
  }
  const hreflang = Array.from(document.querySelectorAll('link[rel="alternate"][hreflang]')).map((l) => l.getAttribute('hreflang')).sort();
  const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? null;
  const robots = document.querySelector('meta[name="robots"]')?.getAttribute('content') ?? null;
  // Skip link: exists, targets #main, becomes visible when focused.
  const skip = document.querySelector('a.skip[href="#main"]');
  let skipLink = { exists: !!skip, targetExists: !!document.getElementById('main'), focusable: false, visibleOnFocus: false };
  if (skip) {
    skip.focus();
    skipLink.focusable = document.activeElement === skip;
    const r = skip.getBoundingClientRect();
    skipLink.visibleOnFocus = r.left >= 0 && r.top >= 0 && r.width >= 44 && r.height >= 44;
    skip.blur();
  }
  const intents = Array.from(document.querySelectorAll('a[href^="intent://"]'));
  const intent = { total: intents.length, visible: intents.filter(visible).length };
  const b = document.getElementById('theme');
  const toggle = b
    ? {
        pressed: b.getAttribute('aria-pressed'),
        ariaLabel: b.getAttribute('aria-label'),
        label: (document.getElementById('theme-label')?.textContent ?? '').trim(),
        toDark: b.getAttribute('data-to-dark'),
        toLight: b.getAttribute('data-to-light'),
        dark: b.getAttribute('data-dark'),
        light: b.getAttribute('data-light'),
        labelVisible: visible(document.getElementById('theme-label') ?? b.firstChild ?? b) && getComputedStyle(document.getElementById('theme-label') ?? b).display !== 'none',
      }
    : null;
  const charts = Array.from(document.querySelectorAll('svg.chart')).map((s) => ({ layout: s.getAttribute('data-layout') || 'static', width: Math.round(s.getBoundingClientRect().width), k: s.style.getPropertyValue('--chart-k') || null }));
  return {
    lang: de.lang,
    theme: de.getAttribute('data-theme') || 'light',
    dataUa: de.getAttribute('data-ua'),
    title: document.title,
    h1: document.querySelectorAll('h1').length,
    overflow,
    overflowEls,
    scrollWidth: de.scrollWidth,
    innerWidth: vw,
    minFont: Math.round(minFont * 100) / 100,
    minFontEl,
    minSvgFont: minSvgFont === null ? null : Math.round(minSvgFont * 100) / 100,
    minSvgEl,
    textNodes,
    controls,
    smallCount: small.length,
    small: small.slice(0, 15),
    contentRatio,
    gutter,
    bodyFont: parseFloat(getComputedStyle(document.body).fontSize),
    hreflang,
    canonical,
    robots,
    skipLink,
    intent,
    toggle,
    charts,
    docH: de.scrollHeight,
  };
}

async function waitForFonts(page, lang) {
  const need = FONT_SETS[lang] || FONT_SETS.en;
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.evaluate(() => document.fonts.ready);
    const ok = await page.evaluate((fams) => fams.every((f) => Array.from(document.fonts).some((ff) => `"${ff.family}"` === f && ff.status === 'loaded')), need);
    if (ok) return true;
    await page.waitForTimeout(500);
  }
  return false;
}

async function openPage(ctx, baseUrl, pg, theme, { timeout = 20000 } = {}) {
  const page = await ctx.newPage();
  const q = [pg.query, theme === 'dark' ? 'theme=dark' : null].filter(Boolean).join('&');
  const url = baseUrl.replace(/\/$/, '') + pg.path + (q ? `?${q}` : '');
  const resp = await page.goto(url, { waitUntil: 'networkidle', timeout });
  const status = resp ? resp.status() : 0;
  let hydrated = null;
  if (pg.hydrate) {
    hydrated = await page.waitForSelector('#kundli-form[data-ready], svg.chart[data-layout="client"]', { timeout }).then(() => true).catch(() => false);
    if (hydrated) await page.waitForSelector('svg.chart[data-layout="client"]', { timeout }).catch(() => { hydrated = false; });
    await page.waitForTimeout(200);
  }
  const fontsOk = await waitForFonts(page, pg.path.split('/')[1]);
  await page.waitForTimeout(150);
  return { page, url, status, hydrated, fontsOk };
}

function judge(pg, vp, theme, a, status, hydrated) {
  const fails = [];
  if (status !== (pg.status ?? 200)) fails.push(`status ${status} != ${pg.status ?? 200}`);
  if (a.overflow > 0) fails.push(`overflow ${a.overflow}px (${a.overflowEls.slice(0, 4).join(' | ')})`);
  if (a.minFont < 11.99) fails.push(`minFont ${a.minFont} (${a.minFontEl})`);
  if (a.smallCount) fails.push(`${a.smallCount} controls under 44px: ${a.small.slice(0, 4).join(' | ')}`);
  if (vp.w >= 1920 && (a.contentRatio === null || a.contentRatio < 0.88)) fails.push(`contentRatio ${a.contentRatio}`);
  const expectedHref = pg.noindex ? [] : ['en', 'hi', 'x-default'];
  if (JSON.stringify(a.hreflang) !== JSON.stringify(expectedHref)) fails.push(`hreflang [${a.hreflang}] != [${expectedHref}]`);
  if (pg.noindex) {
    if (!/noindex/.test(a.robots || '')) fails.push('noindex meta missing');
    if (pg.canonical && !(a.canonical || '').endsWith(pg.canonical)) fails.push(`canonical ${a.canonical}`);
  } else if (a.robots && /noindex/.test(a.robots)) fails.push('unexpected noindex');
  if (!a.canonical) fails.push('canonical missing');
  if (!(a.skipLink.exists && a.skipLink.targetExists && a.skipLink.focusable && a.skipLink.visibleOnFocus)) fails.push(`skip link ${JSON.stringify(a.skipLink)}`);
  if (a.dataUa) fails.push(`desktop UA got data-ua=${a.dataUa}`);
  if (a.intent.visible > 0) fails.push(`${a.intent.visible} intent:// buttons visible for a desktop UA`);
  if (pg.intent && a.intent.total === 0) fails.push('no intent:// button rendered on a page that should carry one');
  if (!a.toggle) fails.push('theme toggle missing');
  else {
    const dark = theme === 'dark';
    if (a.theme !== theme) fails.push(`html data-theme ${a.theme} != ${theme}`);
    if (a.toggle.pressed !== String(dark)) fails.push(`aria-pressed ${a.toggle.pressed} in ${theme}`);
    if (a.toggle.ariaLabel !== (dark ? a.toggle.toLight : a.toggle.toDark)) fails.push(`toggle aria-label '${a.toggle.ariaLabel}' does not name the target`);
    if (a.toggle.label !== (dark ? a.toggle.light : a.toggle.dark)) fails.push(`toggle text '${a.toggle.label}' does not name the target`);
  }
  if (a.h1 !== 1) fails.push(`${a.h1} h1 elements`);
  if (pg.hydrate && hydrated !== true) fails.push('client chart did not hydrate');
  return fails;
}

(async () => {
  const server = await serveDist();
  const executablePath = playwrightChromium();
  const browser = await chromium.launch({ executablePath, headless: true });
  console.log(`serving ${DIST} at ${server.baseUrl}; chromium ${executablePath}; ${PAGES.length} pages x ${VIEWPORTS.filter((v) => !WIDTHS || WIDTHS.has(v.w)).length} widths x ${THEMES.length} themes -> ${OUT}`);
  const results = [];
  const pageExtras = [];
  const t0 = Date.now();
  try {
    for (const pg of PAGES) {
      for (const vp of VIEWPORTS) {
        if (WIDTHS && !WIDTHS.has(vp.w)) continue;
        for (const theme of THEMES) {
          const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: vp.dsf, userAgent: DESKTOP_UA });
          const { page, url, status, hydrated, fontsOk } = await openPage(ctx, server.baseUrl, pg, theme);
          const a = await page.evaluate(auditInPage);
          const name = `${pg.id}-${vp.w}-${theme}.png`;
          if (!NO_PNG) await page.screenshot({ path: path.join(OUT, name), fullPage: false });
          const fails = judge(pg, vp, theme, a, status, hydrated);
          results.push({ page: pg.id, path: pg.path, url, width: vp.w, height: vp.h, dsf: vp.dsf, theme, png: NO_PNG ? null : name, status, hydrated, fontsOk, pass: fails.length === 0, fails, ...a });
          console.log(`${fails.length ? 'FAIL' : 'ok  '} ${name.padEnd(40)} ov=${a.overflow} minFont=${a.minFont} svg=${a.minSvgFont ?? '-'} small=${a.smallCount} ratio=${a.contentRatio} body=${a.bodyFont} href=[${a.hreflang}]${fails.length ? '\n     ' + fails.join('\n     ') : ''}`);
          await ctx.close();
        }
      }
      // Per-page extras at 390/light: Android UA shows the intent buttons; the toggle click persists through a reload.
      const vp = VIEWPORTS[1];
      const actx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, userAgent: ANDROID_UA, isMobile: true, hasTouch: true });
      const { page: apage, hydrated: ahyd } = await openPage(actx, server.baseUrl, pg, 'light');
      const aa = await apage.evaluate(auditInPage);
      const androidName = `${pg.id}-390-light-android.png`;
      if (!NO_PNG && pg.intent) await apage.screenshot({ path: path.join(OUT, androidName), fullPage: false });
      const androidOk = aa.dataUa === 'android' && aa.intent.visible === aa.intent.total && (!pg.intent || aa.intent.total > 0) && aa.overflow === 0;
      // Toggle round trip on the same (Android) context: click -> dark, reload without ?theme -> still dark, click -> light.
      let toggleRoundtrip = null;
      if (aa.toggle) {
        await apage.click('#theme');
        const afterClick = await apage.evaluate(() => ({ theme: document.documentElement.getAttribute('data-theme'), pressed: document.getElementById('theme').getAttribute('aria-pressed'), label: document.getElementById('theme-label').textContent.trim(), aria: document.getElementById('theme').getAttribute('aria-label'), stored: localStorage.getItem('shubhvela-theme') }));
        await apage.reload({ waitUntil: 'networkidle' });
        const afterReload = await apage.evaluate(() => ({ theme: document.documentElement.getAttribute('data-theme'), pressed: document.getElementById('theme').getAttribute('aria-pressed') }));
        await apage.click('#theme');
        const back = await apage.evaluate(() => ({ theme: document.documentElement.getAttribute('data-theme'), pressed: document.getElementById('theme').getAttribute('aria-pressed'), stored: localStorage.getItem('shubhvela-theme') }));
        toggleRoundtrip = {
          afterClick, afterReload, back,
          pass: afterClick.theme === 'dark' && afterClick.pressed === 'true' && afterClick.label === aa.toggle.light && afterClick.aria === aa.toggle.toLight && afterClick.stored === 'dark'
            && afterReload.theme === 'dark' && afterReload.pressed === 'true' && back.theme === null && back.pressed === 'false' && back.stored === 'light',
        };
      }
      const extra = { page: pg.id, path: pg.path, android: { dataUa: aa.dataUa, intentTotal: aa.intent.total, intentVisible: aa.intent.visible, hydrated: ahyd, overflow: aa.overflow, png: pg.intent && !NO_PNG ? androidName : null, pass: androidOk }, toggleRoundtrip, pass: androidOk && (toggleRoundtrip ? toggleRoundtrip.pass : false) };
      pageExtras.push(extra);
      console.log(`${extra.pass ? 'ok  ' : 'FAIL'} ${pg.id} android: ua=${aa.dataUa} intent ${aa.intent.visible}/${aa.intent.total}; toggle round trip ${toggleRoundtrip ? (toggleRoundtrip.pass ? 'ok' : JSON.stringify(toggleRoundtrip)) : 'n/a'}`);
      await actx.close();
    }
  } finally {
    await browser.close();
    await server.close();
  }
  const perCheck = {
    shots: results.length,
    maxOverflow: Math.max(...results.map((r) => r.overflow)),
    minFont: Math.min(...results.map((r) => r.minFont)),
    minSvgFont: Math.min(...results.filter((r) => r.minSvgFont !== null).map((r) => r.minSvgFont)),
    smallControls: results.reduce((s, r) => s + r.smallCount, 0),
    controlsMeasured: results.reduce((s, r) => s + r.controls, 0),
    textNodesMeasured: results.reduce((s, r) => s + r.textNodes, 0),
    minContentRatioAt1920Plus: Math.min(...results.filter((r) => r.width >= 1920).map((r) => r.contentRatio ?? 0)),
    contentRatioByWidth: Object.fromEntries(VIEWPORTS.map((v) => [v.w, (() => { const rs = results.filter((r) => r.width === v.w && r.contentRatio !== null).map((r) => r.contentRatio); return rs.length ? { min: Math.min(...rs), max: Math.max(...rs) } : null; })()])),
    bodyFontByWidth: Object.fromEntries(VIEWPORTS.map((v) => [v.w, (() => { const rs = results.filter((r) => r.width === v.w).map((r) => r.bodyFont); return rs.length ? { min: Math.min(...rs), max: Math.max(...rs) } : null; })()])),
    hreflangFails: results.filter((r) => r.fails.some((f) => f.startsWith('hreflang'))).length,
    skipLinkFails: results.filter((r) => r.fails.some((f) => f.startsWith('skip link'))).length,
    uaGatingFails: results.filter((r) => r.fails.some((f) => /intent|data-ua/.test(f))).length + pageExtras.filter((e) => !e.android.pass).length,
    toggleFails: results.filter((r) => r.fails.some((f) => /toggle|aria-pressed|data-theme/.test(f))).length + pageExtras.filter((e) => e.toggleRoundtrip && !e.toggleRoundtrip.pass).length,
    hydrationFails: results.filter((r) => r.fails.includes('client chart did not hydrate')).length,
    fontsNotReady: results.filter((r) => !r.fontsOk).length,
    failingShots: results.filter((r) => !r.pass).length,
    failingPageExtras: pageExtras.filter((e) => !e.pass).length,
  };
  const summary = {
    run: new Date().toISOString(),
    dist: DIST,
    chromium: executablePath,
    pages: PAGES.map((p) => p.id),
    widths: VIEWPORTS.filter((v) => !WIDTHS || WIDTHS.has(v.w)).map((v) => `${v.w}x${v.h}@${v.dsf}`),
    themes: THEMES,
    elapsedSeconds: Math.round((Date.now() - t0) / 10) / 100,
    pass: perCheck.failingShots === 0 && perCheck.failingPageExtras === 0,
    perCheck,
    pageExtras,
    results,
  };
  fs.writeFileSync(path.join(OUT, 'audit.json'), JSON.stringify(summary, null, 2));
  console.log('SUMMARY', JSON.stringify({ pass: summary.pass, ...perCheck, elapsedSeconds: summary.elapsedSeconds }));
  if (!summary.pass) {
    console.log('FAILING:');
    for (const r of results.filter((r) => !r.pass)) console.log(` ${r.png ?? r.page + '-' + r.width + '-' + r.theme}: ${r.fails.join('; ')}`);
    for (const e of pageExtras.filter((e) => !e.pass)) console.log(` ${e.page} extras: android ${JSON.stringify(e.android)} toggle ${JSON.stringify(e.toggleRoundtrip?.pass)}`);
    process.exit(1);
  }
})().catch((e) => { console.error(e); process.exit(1); });
