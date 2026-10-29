// FEAT-D02 inventory: runs the FULL build into a temp dir once (or walks an existing build when WEB_DIST points at a
// dist/ that was just produced by `npm run web:build` — pages.yml uses that to avoid building twice) and checks the page
// set of design.md section 9: 331 × 3 × 2 panchang pages, >= 60 × 3 × 3 festival pages with valid Event JSON-LD, 14 × 12
// × 3 muhurat pages, >= 150 × 3 glossary pages, 12 × 3 vrat pages; canonical + hreflang on every page; every referenced OG
// image exists; sitemaps complete (<= 50,000 URLs per file, no /m/); budgets dist <= 150 MB and og <= 60 MB.
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DIST_BUDGET_BYTES, OG_BUDGET_BYTES, build } from '../build.mjs';
import { LANGS, WEB_DIR } from '../src/config.mjs';
import { SITEMAP_URL_LIMIT } from '../src/seo.mjs';

let out;
let summary;
let ownDir = false;

function read(rel) {
  return readFileSync(join(out, rel), 'utf8');
}
function jsonLd(html) {
  return [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
}
function walk(dir, acc = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else acc.push(p);
  }
  return acc;
}
function dirBytes(dir) {
  return walk(dir).reduce((a, f) => a + statSync(f).size, 0);
}
/** Site path -> file. */
function fileOf(path) {
  return path.endsWith('/') ? join(out, path, 'index.html') : join(out, path);
}

beforeAll(async () => {
  const ready = process.env.WEB_DIST;
  const summaryFile = resolve(WEB_DIR, '.cache', 'build-summary.json');
  if (ready && existsSync(join(ready, 'sitemap.xml')) && existsSync(summaryFile)) {
    out = resolve(ready);
    summary = JSON.parse(readFileSync(summaryFile, 'utf8'));
  } else {
    out = mkdtempSync(join(tmpdir(), 'shubhvela-web-full-'));
    ownDir = true;
    summary = await build({ out, quiet: true });
  }
}, 1_200_000);

afterAll(() => {
  if (ownDir) rmSync(out, { recursive: true, force: true });
});

describe('page set (design.md 9)', () => {
  it('has 331 × 3 × 2 panchang pages (current month + next month) and the index', () => {
    expect(summary.pageCounts.panchangCity).toBe(331 * 3);
    expect(summary.pageCounts.panchangMonth).toBe(331 * 3);
    for (const lang of LANGS) {
      expect(existsSync(fileOf(`/${lang}/panchang/`))).toBe(true);
      expect(existsSync(fileOf(`/${lang}/panchang/new-delhi/`))).toBe(true);
      expect(existsSync(fileOf(`/${lang}/panchang/new-delhi/${summary.calendar.nextMonth}/`))).toBe(true);
    }
  });

  it('has >= 60 festival pages per year for 3 years in each language, muhurat 14 × 12 × 3, glossary >= 150 × 3, vrat 12 × 3', () => {
    expect(summary.festivalYears.length).toBeGreaterThanOrEqual(3);
    expect(summary.festivalYears).toEqual(expect.arrayContaining([2026, 2027, 2028]));
    expect(summary.pageCounts.festival).toBeGreaterThanOrEqual(60 * 3 * 3);
    for (const lang of LANGS) {
      for (const year of [2026, 2027, 2028]) {
        const dir = join(out, lang, 'festival');
        const n = readdirSync(dir).filter((slug) => existsSync(join(dir, slug, String(year), 'index.html'))).length;
        expect(n, `${lang} ${year}`).toBeGreaterThanOrEqual(60);
      }
    }
    expect(summary.pageCounts.muhurat).toBe(14 * 12 * 3);
    expect(summary.pageCounts.glossaryTerm).toBeGreaterThanOrEqual(150 * 3);
    expect(summary.pageCounts.glossaryTerm % 3).toBe(0);
    expect(summary.pageCounts.vrat).toBe(12 * 3);
    expect(summary.pages).toBeGreaterThan(3_600);
  });

  it('every planned page exists on disk with canonical and (when indexable) hreflang en/hi/x-default only', () => {
    let checked = 0;
    for (const path of summary.paths) {
      const file = fileOf(path);
      expect(existsSync(file), path).toBe(true);
      if (!/^\/(en|hi|bho)\//.test(path) || /\/(m|404)\/$/.test(path)) continue;
      const html = readFileSync(file, 'utf8');
      const rest = path.replace(/^\/(en|hi|bho)\//, '');
      expect(html, path).toContain(`<link rel="canonical" href="https://sudish007.github.io/shubhvela${path}">`);
      expect(html, path).toContain(`<link rel="alternate" hreflang="en" href="https://sudish007.github.io/shubhvela/en/${rest}">`);
      expect(html, path).toContain(`<link rel="alternate" hreflang="x-default" href="https://sudish007.github.io/shubhvela/en/${rest}">`);
      expect(html, path).not.toMatch(/hreflang="bho"/);
      checked++;
    }
    expect(checked).toBeGreaterThan(4_000);
  });

  it('every og:image referenced by a page exists under dist/og and is a PNG', () => {
    const seen = new Set();
    for (const path of summary.paths) {
      if (!/^\/(en|hi|bho)\//.test(path)) continue; // root redirects carry no OG tags
      const html = readFileSync(fileOf(path), 'utf8');
      const m = /<meta property="og:image" content="https:\/\/sudish007\.github\.io\/shubhvela\/(og\/[^"]+)">/.exec(html);
      expect(m, path).not.toBeNull();
      seen.add(m[1]);
    }
    for (const rel of seen) {
      const p = join(out, rel);
      expect(existsSync(p), rel).toBe(true);
      expect(readFileSync(p).subarray(1, 4).toString('latin1')).toBe('PNG');
    }
    // Per-entity images: one per festival-year, city, activity, vrat per language + one glossary image per language.
    for (const lang of LANGS) {
      expect(readdirSync(join(out, 'og', lang, 'panchang')).length).toBe(331);
      expect(readdirSync(join(out, 'og', lang, 'muhurat')).length).toBe(14);
      expect(readdirSync(join(out, 'og', lang, 'vrat')).length).toBe(12);
      expect(readdirSync(join(out, 'og', lang, 'festival')).length).toBe(summary.pageCounts.festival / 3);
      expect(existsSync(join(out, 'og', lang, 'glossary.png'))).toBe(true);
    }
  });
});

describe('page content', () => {
  it('panchang city page: month table with data-date rows, today band + 13 segments, moonrise table, sibling cities, how-computed footer', () => {
    for (const lang of LANGS) {
      const html = read(`${lang}/panchang/new-delhi/index.html`);
      const rows = [...html.matchAll(/<tr data-date="(\d{4}-\d{2}-\d{2})">/g)].map((m) => m[1]);
      expect(rows.length).toBeGreaterThanOrEqual(28);
      expect(rows.every((d) => d.startsWith(summary.calendar.currentMonth))).toBe(true);
      expect(html).toContain('<svg xmlns="http://www.w3.org/2000/svg" width="100%"');
      expect(html).toContain('class="band" role="img" aria-label="');
      expect(html).toContain('<table class="segments">');
      expect((html.match(/<span class="tag tag-(good|neutral|avoid)">/g) ?? []).length).toBe(13);
      expect(html).toContain('<table class="moon num">');
      expect(html).toContain('id="sibh"');
      expect(html).toContain('class="computed"');
      expect(html).toContain('astronomy-engine');
      expect(html).toContain(`data-today-date="${summary.calendar.today}"`);
      expect(html).toContain('data-today-tz="Asia/Kolkata"');
      expect(html).toContain(`href="/shubhvela/${lang}/panchang/new-delhi/${summary.calendar.nextMonth}/"`);
      // No hand-typed clock time can be told apart from a computed one by looking, but every printed HH:mm must sit in a cell/kv.
      const next = read(`${lang}/panchang/new-delhi/${summary.calendar.nextMonth}/index.html`);
      const nrows = [...next.matchAll(/<tr data-date="(\d{4}-\d{2}-\d{2})">/g)].map((m) => m[1]);
      expect(nrows.every((d) => d.startsWith(summary.calendar.nextMonth))).toBe(true);
      expect(next).not.toContain('<table class="segments">');
    }
  });

  it('festival pages carry valid Event JSON-LD (name, startDate, location) plus both systems, a city picker, what-to-do, share image and the Android-only button', () => {
    for (const lang of LANGS) {
      const slugs = readdirSync(join(out, lang, 'festival'));
      let events = 0;
      for (const slug of slugs) {
        for (const year of readdirSync(join(out, lang, 'festival', slug))) {
          const html = readFileSync(join(out, lang, 'festival', slug, year, 'index.html'), 'utf8');
          const ev = jsonLd(html).find((l) => l['@type'] === 'Event');
          expect(ev, `${lang}/${slug}/${year}`).toBeTruthy();
          expect(typeof ev.name).toBe('string');
          expect(ev.name.length).toBeGreaterThan(0);
          expect(ev.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
          expect(ev.startDate.startsWith(year)).toBe(true);
          expect(ev.location['@type']).toBe('Place');
          expect(typeof ev.location.name).toBe('string');
          expect(ev.eventStatus).toBe('https://schema.org/EventScheduled');
          expect(ev.eventAttendanceMode).toBe('https://schema.org/OfflineEventAttendanceMode');
          expect(ev.inLanguage).toBe(lang);
          expect(ev.image).toBe(`https://sudish007.github.io/shubhvela/og/${lang}/festival/${slug}-${year}.png`);
          if (ev.endDate) expect(ev.endDate >= ev.startDate).toBe(true);
          events++;
        }
      }
      expect(events).toBeGreaterThanOrEqual(180);
      const diwali = read(`${lang}/festival/diwali/2026/index.html`);
      expect(diwali).toContain('class="panel tradition"');
      expect(diwali).toContain('id="city-pick"');
      expect(diwali).toContain('id="whath"');
      expect(diwali).toContain(`/shubhvela/og/${lang}/festival/diwali-2026.png`);
      expect(diwali).toContain('intent://festival?slug=diwali&amp;year=2026');
      expect(diwali).toContain('class="btn android-only"');
      expect(diwali).toContain('data-bundle="/shubhvela/assets/data-pages.');
      // Both the Purnimanta and the Amanta block are present (Diwali is kept in both systems).
      expect((diwali.match(/class="panel tradition"/g) ?? []).length).toBe(2);
    }
  });

  it('muhurat pages list the month windows with N/10 rule counts, a city picker, the rule legend and the personal-rules note', () => {
    for (const lang of LANGS) {
      const ym = summary.calendar.months12[0];
      const html = read(`${lang}/muhurat/griha-pravesh/${ym}/index.html`);
      expect(html).toContain('<table id="windows"');
      expect(html).toMatch(/<strong>\d+\/10<\/strong>/);
      expect(html).toContain('id="city-pick"');
      expect(html).toContain('class="legend-list compact"');
      expect((html.match(/<li(?: class="personal")?><strong>/g) ?? []).length).toBe(10);
      expect((html.match(/class="personal"/g) ?? []).length).toBe(2);
      // No birth chart on the web: Chandra bala and Tara bala are never met, so no window can reach 9 or 10.
      expect(html).not.toMatch(/<strong>(9|10)\/10<\/strong>/);
      expect(html).toContain('class="personal"');
      for (const m of summary.calendar.months12) expect(existsSync(fileOf(`/${lang}/muhurat/griha-pravesh/${m}/`)), m).toBe(true);
      const index = read(`${lang}/muhurat/index.html`);
      expect(index).toContain('id="rules"');
    }
  });

  it('glossary and vrat pages exist with their content blocks', () => {
    for (const lang of LANGS) {
      const idx = read(`${lang}/glossary/index.html`);
      expect(idx).toContain('class="letters"');
      const term = read(`${lang}/glossary/jyotish/index.html`);
      expect(term).toContain('<h1 class="display"><span lang="hi">');
      expect(term).toContain('class="lat"');
      const vrat = read(`${lang}/vrat/ekadashi/index.html`);
      expect(vrat).toContain('<table id="occurrences"');
      expect((vrat.match(/<tr data-date="/g) ?? []).length).toBe(12);
      expect(vrat).toContain('id="city-pick"');
      expect(existsSync(fileOf(`/${lang}/vrat/vinayaka-chaturthi/`))).toBe(true);
    }
  });

  it('home and nav now link the data pages (no "pages soon" notes)', () => {
    for (const lang of LANGS) {
      const home = read(`${lang}/index.html`);
      expect(home).toContain(`href="/shubhvela/${lang}/panchang/new-delhi/"`);
      expect(home).toContain(`href="/shubhvela/${lang}/festivals/`);
      expect(home).not.toContain('cityPagesSoon');
      expect(home).toMatch(/<nav class="links"[^>]*>(?:<a [^>]*>[^<]*<\/a>){7}<\/nav>/);
    }
  });
});

describe('sitemaps and budgets', () => {
  it('sitemaps list every indexable page, <= 50,000 URLs per file, no /m/, all files under the index', () => {
    const index = read('sitemap.xml');
    const files = [...index.matchAll(/<loc>https:\/\/sudish007\.github\.io\/shubhvela\/([^<]+)<\/loc>/g)].map((m) => m[1]);
    expect(files.sort()).toEqual([...summary.sitemapFiles].sort());
    const listed = new Set();
    for (const f of files) {
      const xml = read(f);
      const locs = [...xml.matchAll(/<loc>https:\/\/sudish007\.github\.io\/shubhvela(\/[^<]*)<\/loc>/g)].map((m) => m[1]);
      expect(locs.length).toBeLessThanOrEqual(SITEMAP_URL_LIMIT);
      expect(locs.length).toBeGreaterThan(0);
      for (const l of locs) listed.add(l);
      expect(xml).not.toMatch(/\/m\/</);
      expect(xml).not.toMatch(/404/);
    }
    const indexable = summary.paths.filter((p) => /^\/(en|hi|bho)\//.test(p) && !/\/(m|404)\/$/.test(p));
    expect(listed.size).toBe(indexable.length);
    for (const p of indexable) expect(listed.has(p), p).toBe(true);
    expect(summary.sitemapUrls).toBe(indexable.length);
  });

  it('respects the size budgets: dist <= 150 MB, og <= 60 MB', () => {
    const dist = dirBytes(out);
    const og = dirBytes(join(out, 'og'));
    expect(dist).toBeLessThanOrEqual(DIST_BUDGET_BYTES);
    expect(og).toBeLessThanOrEqual(OG_BUDGET_BYTES);
    expect(summary.distBytes).toBe(dist);
    expect(summary.ogBytes).toBeLessThanOrEqual(og);
    expect(summary.ogCount).toBe(walk(join(out, 'og')).length);
  });
});
