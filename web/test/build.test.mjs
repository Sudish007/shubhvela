// Builds the core site into a temp dir once and checks the inventory, the SEO plumbing of every page, robots, sitemaps,
// OG files, fonts and the HARD-NO CSS rules (spec F41-F43; design.md 9; review M1, M8, N5, N10, N13, N16, N20).
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { build } from '../build.mjs';
import { LANGS } from '../src/config.mjs';

const WEB = resolve(__dirname, '..');
let out;
let summary;

function read(rel) {
  return readFileSync(join(out, rel), 'utf8');
}
function page(lang, rest = '') {
  return read(`${lang}/${rest}index.html`);
}
function jsonLd(html) {
  return [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
}

beforeAll(async () => {
  out = mkdtempSync(join(tmpdir(), 'shubhvela-web-'));
  summary = await build({ out, coreOnly: true, quiet: true });
}, 120_000);

afterAll(() => {
  rmSync(out, { recursive: true, force: true });
});

describe('inventory', () => {
  it('writes the core pages in every language plus the root entry points', () => {
    for (const lang of LANGS) {
      for (const rest of ['', 'kundli/', 'm/', 'download/', 'privacy/', 'terms/', 'data-deletion/', '404/']) {
        expect(existsSync(join(out, lang, rest, 'index.html')), `${lang}/${rest}`).toBe(true);
      }
    }
    for (const rest of ['', 'kundli/', 'm/', 'privacy/', 'terms/', 'data-deletion/', 'download/']) {
      expect(existsSync(join(out, rest, 'index.html')), `root ${rest}`).toBe(true);
    }
    expect(existsSync(join(out, '404.html'))).toBe(true);
    expect(summary.pages).toBe(3 * 8 + 8);
    expect(summary.sitemapUrls).toBe(3 * 6);
  });

  it('copies robots.txt (N10), .nojekyll and the five self-hosted fonts', () => {
    const robots = read('robots.txt').split(/\r?\n/).filter(Boolean);
    expect(robots).toEqual(['User-agent: *', 'Allow: /', 'Disallow: /*/m/', 'Sitemap: https://sudish007.github.io/shubhvela/sitemap.xml']);
    expect(existsSync(join(out, '.nojekyll'))).toBe(true);
    const fonts = readdirSync(join(out, 'fonts')).sort();
    expect(fonts).toEqual(['NotoSans-Regular.ttf', 'NotoSans-SemiBold.ttf', 'NotoSansDevanagari-Regular.ttf', 'NotoSansDevanagari-SemiBold.ttf', 'TiroDevanagariHindi-Regular.ttf']);
  });

  it('writes og/<lang>/site.png and kundli.png as PNGs under 150 KB each', () => {
    for (const lang of LANGS) {
      for (const name of ['site.png', 'kundli.png']) {
        const p = join(out, 'og', lang, name);
        expect(existsSync(p), p).toBe(true);
        const buf = readFileSync(p);
        expect(buf.subarray(1, 4).toString('latin1')).toBe('PNG');
        expect(statSync(p).size).toBeLessThan(150 * 1024);
      }
    }
  });

  it('writes one sitemap per language under an index and never lists /m/, 404 or redirects', () => {
    const index = read('sitemap.xml');
    for (const lang of LANGS) expect(index).toContain(`https://sudish007.github.io/shubhvela/sitemap-${lang}.xml`);
    for (const lang of LANGS) {
      const sm = read(`sitemap-${lang}.xml`);
      expect(sm).toContain(`<loc>https://sudish007.github.io/shubhvela/${lang}/</loc>`);
      expect(sm).toContain(`<loc>https://sudish007.github.io/shubhvela/${lang}/kundli/</loc>`);
      expect(sm).not.toMatch(/\/m\/</);
      expect(sm).not.toMatch(/404/);
      expect(sm).not.toContain('<loc>https://sudish007.github.io/shubhvela/</loc>');
    }
  });
});

describe('every page head', () => {
  const indexable = ['', 'kundli/', 'download/', 'privacy/', 'terms/', 'data-deletion/'];
  for (const lang of LANGS) {
    for (const rest of indexable) {
      it(`${lang}/${rest} has canonical, hreflang en/hi/x-default only, OG incl. og:description, skip link, light first paint`, () => {
        const html = page(lang, rest);
        expect(html).toContain(`<html lang="${lang}">`);
        expect(html).toContain(`<link rel="canonical" href="https://sudish007.github.io/shubhvela/${lang}/${rest}">`);
        expect(html).toContain(`<link rel="alternate" hreflang="en" href="https://sudish007.github.io/shubhvela/en/${rest}">`);
        expect(html).toContain(`<link rel="alternate" hreflang="hi" href="https://sudish007.github.io/shubhvela/hi/${rest}">`);
        expect(html).toContain(`<link rel="alternate" hreflang="x-default" href="https://sudish007.github.io/shubhvela/en/${rest}">`);
        expect(html).not.toMatch(/hreflang="bho"/);
        expect(html).not.toContain('<meta name="robots" content="noindex">');
        expect(html).toMatch(/<meta property="og:description" content="[^"]+">/);
        expect(html).toMatch(/<meta property="og:image" content="https:\/\/sudish007\.github\.io\/shubhvela\/og\/(en|hi|bho)\/(site|kundli)\.png">/);
        expect(html).toContain('<a class="skip" href="#main">');
        // Theme script runs before the stylesheet; the toggle starts light with label = target state.
        expect(html.indexOf('shubhvela-theme')).toBeLessThan(html.indexOf('<style>'));
        expect(html).not.toContain('prefers-color-scheme');
        expect(html).toContain('aria-pressed="false"');
        // Language switcher links all three languages (Bhojpuri is reachable without hreflang).
        expect(html).toContain(`href="/shubhvela/bho/${rest}" lang="bho"`);
        for (const ld of jsonLd(html)) expect(ld['@context']).toBe('https://schema.org');
      });
    }
  }

  it('home carries SoftwareApplication JSON-LD and the 331-city count; the kundli page a visible Questions section matching its FAQPage JSON-LD (N20)', () => {
    for (const lang of LANGS) {
      const home = page(lang);
      expect(jsonLd(home).map((l) => l['@type'])).toContain('SoftwareApplication');
      expect(home).toContain('331');
      expect(home).toContain('data-today-date="');
      expect(home).toContain('class="chart"');
      const kundli = page(lang, 'kundli/');
      const faq = jsonLd(kundli).find((l) => l['@type'] === 'FAQPage');
      expect(faq.inLanguage).toBe(lang);
      expect(faq.mainEntity).toHaveLength(3);
      for (const q of faq.mainEntity) {
        expect(kundli).toContain(`<h3>${q.name.replace(/&/g, '&amp;').replace(/'/g, '&#39;').replace(/"/g, '&quot;')}</h3>`);
      }
      expect(kundli).toContain('id="faqh"');
    }
  });

  it('kundli pages inject the precision figure from reference/results.json (N13) and load the compute bundle lazily', () => {
    for (const lang of LANGS) {
      const kundli = page(lang, 'kundli/');
      expect(kundli).toContain(`${summary.precision.deg}°`);
      expect(kundli).toContain(`${summary.precision.arcmin}′`);
      expect(kundli).toContain('astronomy-engine 2.1.19');
      expect(kundli).toContain('https://github.com/cosinekitty/astronomy');
      const bundle = /data-bundle="\/shubhvela\/assets\/([^"]+)"/.exec(kundli)[1];
      expect(existsSync(join(out, 'assets', bundle))).toBe(true);
      expect(kundli).not.toMatch(/<script[^>]+src=/);
      expect(kundli).toContain('id="kundli-form"');
      expect(kundli).toContain('intent://kundli');
      expect(kundli).toContain('S.browser_fallback_url=');
      expect(kundli).toContain('class="btn android-only btn-primary"');
    }
  });

  it('/m/ pages are noindex, canonical to /kundli/, carry no form and no name, and keep the query across languages (M8)', () => {
    for (const lang of LANGS) {
      const m = page(lang, 'm/');
      expect(m).toContain('<meta name="robots" content="noindex">');
      expect(m).toContain(`<link rel="canonical" href="https://sudish007.github.io/shubhvela/${lang}/kundli/">`);
      expect(m).not.toMatch(/<link rel="alternate" hreflang/);
      expect(m).not.toContain('id="kundli-form"');
      expect(m).toContain('data-keep-query');
      expect(m).toContain('intent://m');
    }
    const root = read('m/index.html');
    expect(root).toContain('<meta name="robots" content="noindex">');
    expect(root).toContain('<link rel="canonical" href="https://sudish007.github.io/shubhvela/en/kundli/">');
  });

  it('root redirects point at the English pages; /kundli/ keeps the query string', () => {
    expect(read('index.html')).toContain('<meta http-equiv="refresh" content="0;url=/shubhvela/en/">');
    expect(read('privacy/index.html')).toContain('content="0;url=/shubhvela/en/privacy/"');
    expect(read('data-deletion/index.html')).toContain('content="0;url=/shubhvela/en/data-deletion/"');
    const k = read('kundli/index.html');
    expect(k).toContain("location.replace('/shubhvela/en/kundli/'+location.search+location.hash)");
    expect(k).toContain('<noscript><meta http-equiv="refresh"');
  });

  it('the download page never offers a file and says "Coming to Google Play" while the listing URL is empty', () => {
    for (const lang of LANGS) {
      const d = page(lang, 'download/');
      expect(d).not.toMatch(/\.apk/i);
      expect(d).toContain('aria-disabled="true"');
    }
  });

  it('privacy pages name Nominatim, the DPDP Act, deletion and the provisional grievance address', () => {
    for (const lang of LANGS) {
      const p = page(lang, 'privacy/');
      expect(p).toContain('Nominatim');
      expect(p).toContain('grievance@shubhvela.in');
      expect(p).toMatch(/DPDP|2023/);
      expect(p).toContain('id="deleteH"');
    }
  });
});

describe('CSS rules (spec 8 web rules, HARD NO)', () => {
  const css = readFileSync(resolve(WEB, 'src', 'site.css'), 'utf8');
  it('has no gradients, shadows or filters and keeps the binding layout values', () => {
    expect(css).not.toMatch(/gradient\(/);
    expect(css).not.toMatch(/box-shadow|text-shadow|filter:/);
    expect(css).toContain('--gutter:clamp(16px,4vw,96px)');
    expect(css).toContain('font-size:clamp(17px,0.95rem + 0.3vw,22px)');
    expect(css).not.toMatch(/\.wrap\{[^}]*max-width/);
    expect(css).toContain('@media (min-width:1024px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}}');
    expect(css).toContain('@media (min-width:1900px){.grid{grid-template-columns:repeat(3,minmax(0,1fr))}}');
    expect(css).toContain('@media (min-width:2500px){.grid{grid-template-columns:repeat(4,minmax(0,1fr))}}');
    expect(css).toContain('.chart text{font-size:calc(var(--fs,12px) * var(--chart-k,1))}');
    expect(css).toContain('font-display:swap');
  });
});
