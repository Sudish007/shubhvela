// M8: one URL schema for /kundli/, /m/ and the deep links — the web pages reuse the engine parser; the /m/ payload never
// carries the name extra. Also the chart renderer over a real engine layout (M1: --fs user units, no font-size attribute
// in web mode) and the OG overlay template.
import { describe, expect, it } from 'vitest';
import { computeChart } from '../../packages/engine/src/kundli/index.ts';
import { layout } from '../../packages/engine/src/chart-layout/index.ts';
import { parseShareUrl, toShareUrl, toDeepLink, shareQuery } from '../../packages/engine/src/share/index.ts';
import { chartSvgFromLayout } from '../src/chart-svg.mjs';
import { escapeMarkup, ogTemplate } from '../src/og/templates.mjs';
import { hreflangTags, languageSitemaps, sitemapXml } from '../src/seo.mjs';

const payload = { date: '1998-03-14', time: '06:42', approx: 30, lat: 26.85, lon: 80.95, tz: 'Asia/Kolkata', gender: 'f' };

describe('M8 share URL schema shared with the engine', () => {
  it('the /m/ URL the app puts in its QR parses on the web and rejects display extras', () => {
    const url = toShareUrl(payload, 'https://sudish007.github.io/shubhvela/', 'm');
    expect(url.startsWith('https://sudish007.github.io/shubhvela/m/?v=1&d=19980314&t=0642&a=30&lat=26.85&lon=80.95&tz=Asia%2FKolkata&g=f')).toBe(true);
    const parsed = parseShareUrl(url);
    expect(parsed.kind).toBe('m');
    expect(parsed.payload).toMatchObject({ v: 1, date: '1998-03-14', time: '06:42', approx: 30, lat: 26.85, lon: 80.95, tz: 'Asia/Kolkata', gender: 'f' });
    expect(() => parseShareUrl(`${url}&n=Priya`)).toThrow(/not allowed/i);
    expect(() => parseShareUrl(`https://sudish007.github.io/shubhvela/en/m/?${shareQuery(payload)}&st=south`)).toThrow();
  });

  it('the language-prefixed /kundli/ URL the web writes with history.replaceState parses with extras', () => {
    const url = `https://sudish007.github.io/shubhvela/hi/kundli/?${shareQuery(payload, { ay: 'raman', nd: 'true', st: 'south', n: 'Priya' })}`;
    const parsed = parseShareUrl(url);
    expect(parsed.kind).toBe('kundli');
    expect(parsed.extras).toEqual({ ay: 'raman', nd: 'true', st: 'south', n: 'Priya' });
  });

  it('the Android intent path mirrors the deep link the app registers', () => {
    expect(toDeepLink(payload, 'm')).toMatch(/^shubhvela:\/\/m\?v=1&d=19980314/);
    expect(toDeepLink(payload, 'kundli', { st: 'east' })).toMatch(/^shubhvela:\/\/kundli\?v=1&.*&st=east$/);
  });

  it('rejects the validation failures of design 11 with typed codes', () => {
    const q = shareQuery(payload);
    expect(() => parseShareUrl(`?${q.replace('v=1', 'v=2')}`)).toThrow(/v must be 1/);
    expect(() => parseShareUrl(`?${q.replace('d=19980314', 'd=18991231')}`)).toThrow(/out of range/);
    expect(() => parseShareUrl(`?${q.replace('t=0642', 't=2560')}`)).toThrow(/HHMM/);
    expect(() => parseShareUrl(`?${q.replace('tz=Asia%2FKolkata', 'tz=Mars%2FOlympus')}`)).toThrow(/time zone/);
  });
});

describe('chart SVG renderer over an engine layout', () => {
  const chart = computeChart({ date: '1998-03-14', time: '06:42', approxMinutes: 30, tz: 'Asia/Kolkata', lat: 26.85, lon: 80.95 });
  it('web mode: classes + --fs user units (M1), no inline colours; standalone mode: inline font-size and fills', () => {
    const lay = layout('north', chart, 1, 320, { lang: 'en' });
    const web = chartSvgFromLayout(lay, { mode: 'web', lang: 'en', ariaLabel: 'test' });
    expect(web).toContain('class="chart"');
    expect(web).toContain('style="--fs:12px"');
    expect(web).toContain('style="--fs:13.5px"');
    expect(web).not.toMatch(/font-size=/);
    expect(web).not.toMatch(/fill="#/);
    expect((web.match(/<text class="sign"/g) ?? []).length).toBe(12);
    expect((web.match(/<text class="pl/g) ?? []).length + (web.match(/<text class="badge"/g) ?? []).length).toBeGreaterThan(0);
    const standalone = chartSvgFromLayout(lay, { mode: 'standalone', lang: 'hi', width: 300 });
    expect(standalone).toMatch(/font-size="12"/);
    expect(standalone).toMatch(/fill="#1C1A17"/);
    expect(standalone).toContain("font-family=\"'Tiro Devanagari Hindi'\"");
  });
  it('South style carries the Lagna mark and sign names', () => {
    const lay = layout('south', chart, 1, 320, { lang: 'en', centreLines: ['Lahiri · mean node'] });
    const web = chartSvgFromLayout(lay, { mode: 'web' });
    expect(web).toContain('class="lagna-mark"');
    expect(web).toContain('class="signname"');
    expect(web).toContain('class="centre"');
  });
});

describe('seo helpers', () => {
  it('hreflang emits en, hi and x-default only', () => {
    const tags = hreflangTags('kundli/');
    expect(tags).toContain('hreflang="en"');
    expect(tags).toContain('hreflang="hi"');
    expect(tags).toContain('hreflang="x-default" href="https://sudish007.github.io/shubhvela/en/kundli/"');
    expect(tags).not.toContain('bho');
  });
  it('sitemaps split at 50,000 URLs', () => {
    const entries = Array.from({ length: 50_001 }, (_, i) => ({ path: `/en/p/${i}/` }));
    const files = languageSitemaps('en', entries);
    expect(files.map((f) => f.file)).toEqual(['sitemap-en.xml', 'sitemap-en-2.xml']);
    expect(() => sitemapXml(entries)).toThrow();
  });
});

describe('OG template', () => {
  it('plans a 1200x630 paper image with the Devanagari body face for hi/bho and escapes Pango markup', () => {
    const hi = ogTemplate({ lang: 'hi', title: 'मुफ़्त कुंडली', subtitle: 'कुछ भी अपलोड नहीं', url: 'sudish007.github.io/shubhvela/hi/' });
    expect([hi.width, hi.height, hi.background]).toEqual([1200, 630, '#FAF7F2']);
    expect(hi.layers.map((l) => l.family)).toEqual(['Tiro Devanagari Hindi', 'Noto Sans Devanagari', 'Noto Sans']);
    const en = ogTemplate({ lang: 'en', title: 'Free kundli', url: 'x' });
    expect(en.layers).toHaveLength(2);
    expect(en.layers[0].singleLine).toBe(true);
    expect(JSON.stringify(hi)).not.toMatch(/gradient|shadow/i);
    expect(escapeMarkup('a & b <c> "d"')).toBe('a &amp; b &lt;c&gt; &quot;d&quot;');
  });
});
