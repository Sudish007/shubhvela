// Live verification of the deployed site (plan D03; F42 every page type live, F43 plumbing validated live).
// Fetches one URL of every page type at https://sudish007.github.io/shubhvela/ and asserts status + key tags;
// writes shots/phase-d/web/live-check.json. Usage: node web/audit/live-check.mjs [--base <url>] [--out <dir>]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const args = process.argv.slice(2);
const argValue = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const BASE = (argValue('--base') || 'https://sudish007.github.io/shubhvela/').replace(/\/?$/, '/');
// Canonicals, hreflang and sitemap entries are absolute to the production origin (config.mjs BASE_URL) whatever origin serves them.
const CANON = 'https://sudish007.github.io/shubhvela/';
const OUT = path.resolve(argValue('--out') || path.join(REPO, '.agents', 'tasks', 'v1-build', 'shots', 'phase-d', 'web'));
fs.mkdirSync(OUT, { recursive: true });

// Current/next month and festival year come from the local build summary when present (the deployed build is the same
// commit after `gh run watch`); otherwise from today's IST date.
let month = null; let nextMonth = null; let year = null;
try {
  const s = JSON.parse(fs.readFileSync(path.join(REPO, 'web', '.cache', 'build-summary.json'), 'utf8'));
  month = s.calendar?.currentMonth ?? null; nextMonth = s.calendar?.nextMonth ?? null; year = s.calendar?.year ?? null;
} catch { /* no local build */ }
if (!month) {
  const ist = new Date(Date.now() + 5.5 * 3600 * 1000);
  year = ist.getUTCFullYear();
  month = `${year}-${String(ist.getUTCMonth() + 1).padStart(2, '0')}`;
  const n = new Date(Date.UTC(year, ist.getUTCMonth() + 1, 1));
  nextMonth = `${n.getUTCFullYear()}-${String(n.getUTCMonth() + 1).padStart(2, '0')}`;
}
const SAMPLE_QUERY = 'v=1&d=19980314&t=0642&a=30&lat=26.85&lon=80.95&tz=Asia%2FKolkata&g=f';

const tag = (html, re) => { const m = html.match(re); return m ? m[1] : null; };
const has = (html, re) => re.test(html);
const hreflangs = (html) => Array.from(html.matchAll(/<link rel="alternate" hreflang="([^"]+)"/g)).map((m) => m[1]).sort();
const jsonLdTypes = (html) => Array.from(html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)).map((m) => { try { const o = JSON.parse(m[1]); return o['@type'] ?? null; } catch { return 'invalid'; } });

/** Expectations for an indexable language page: canonical = self, hreflang {en,hi,x-default}, OG, html lang, no noindex. */
function pageChecks(lang, rest, { ld = [], extra = () => [] } = {}) {
  return (html, url) => {
    const fails = [];
    const canonical = tag(html, /<link rel="canonical" href="([^"]+)"/);
    if (canonical !== `${CANON}${lang}/${rest}`) fails.push(`canonical ${canonical}`);
    const hl = hreflangs(html);
    if (JSON.stringify(hl) !== JSON.stringify(['en', 'hi', 'x-default'])) fails.push(`hreflang [${hl}]`);
    if (has(html, /<meta name="robots" content="noindex">/)) fails.push('unexpected noindex');
    if (tag(html, /<html lang="([^"]+)"/) !== lang) fails.push('html lang');
    if (!has(html, /<meta property="og:image" content="[^"]+\/og\/[^"]+\.png">/)) fails.push('og:image');
    if (!has(html, /<a class="skip" href="#main">/)) fails.push('skip link');
    if (!has(html, /<button class="theme" id="theme" type="button" aria-pressed="false"/)) fails.push('theme toggle');
    const types = jsonLdTypes(html);
    for (const t of ld) if (!types.includes(t)) fails.push(`JSON-LD ${t} missing (have ${types.join(',') || 'none'})`);
    fails.push(...extra(html, url));
    return fails;
  };
}

const CHECKS = [
  { id: 'root', url: '', status: 200, check: (h) => (has(h, /http-equiv="refresh" content="0;\s*url=\/shubhvela\/en\/"/i) || has(h, /url=\/shubhvela\/en\//) ? [] : ['root does not redirect to /en/']) },
  { id: 'home-en', url: 'en/', status: 200, check: pageChecks('en', '', { ld: ['SoftwareApplication'] }) },
  { id: 'home-hi', url: 'hi/', status: 200, check: pageChecks('hi', '', { ld: ['SoftwareApplication'] }) },
  { id: 'home-bho', url: 'bho/', status: 200, check: pageChecks('bho', '', { ld: ['SoftwareApplication'], extra: (h) => (has(h, /hreflang="bho"/) ? ['hreflang=bho emitted'] : []) }) },
  { id: 'kundli-en', url: 'en/kundli/', status: 200, check: pageChecks('en', 'kundli/', { ld: ['FAQPage'], extra: (h) => (has(h, /id="kundli-form"/) ? [] : ['kundli form missing']) }) },
  { id: 'm-en', url: `en/m/?${SAMPLE_QUERY}`, status: 200, check: (h) => { const f = []; if (!has(h, /<meta name="robots" content="noindex">/)) f.push('noindex missing'); if (tag(h, /<link rel="canonical" href="([^"]+)"/) !== `${CANON}en/kundli/`) f.push('canonical not /en/kundli/'); if (hreflangs(h).length) f.push('hreflang on /m/'); return f; } },
  { id: 'panchang-index', url: 'en/panchang/', status: 200, check: pageChecks('en', 'panchang/', { ld: ['BreadcrumbList'] }) },
  { id: 'panchang-city', url: 'en/panchang/new-delhi/', status: 200, check: pageChecks('en', 'panchang/new-delhi/', { ld: ['BreadcrumbList'], extra: (h) => (has(h, /table[^>]*class="month num"/) ? [] : ['month table missing']) }) },
  { id: 'panchang-month', url: `hi/panchang/new-delhi/${nextMonth}/`, status: 200, check: pageChecks('hi', `panchang/new-delhi/${nextMonth}/`) },
  { id: 'festivals-index', url: 'en/festivals/', status: 200, check: pageChecks('en', 'festivals/') },
  { id: 'festival', url: `en/festival/diwali/${year}/`, status: 200, check: pageChecks('en', `festival/diwali/${year}/`, { ld: ['Event', 'BreadcrumbList'] }) },
  { id: 'muhurat-index', url: 'en/muhurat/', status: 200, check: pageChecks('en', 'muhurat/') },
  { id: 'muhurat', url: `en/muhurat/griha-pravesh/${month}/`, status: 200, check: pageChecks('en', `muhurat/griha-pravesh/${month}/`, { ld: ['BreadcrumbList'] }) },
  { id: 'glossary-index', url: 'en/glossary/', status: 200, check: pageChecks('en', 'glossary/') },
  { id: 'glossary-term', url: 'hi/glossary/lagna/', status: 200, check: pageChecks('hi', 'glossary/lagna/', { ld: ['BreadcrumbList'] }) },
  { id: 'vrat-index', url: 'en/vrat/', status: 200, check: pageChecks('en', 'vrat/') },
  { id: 'vrat', url: 'bho/vrat/ekadashi/', status: 200, check: pageChecks('bho', 'vrat/ekadashi/', { ld: ['BreadcrumbList'] }) },
  { id: 'download', url: 'en/download/', status: 200, check: pageChecks('en', 'download/', { extra: (h) => (has(h, /intent:\/\//) ? [] : ['no intent:// button']) }) },
  { id: 'privacy', url: 'en/privacy/', status: 200, check: pageChecks('en', 'privacy/') },
  { id: 'terms', url: 'en/terms/', status: 200, check: pageChecks('en', 'terms/') },
  { id: 'data-deletion', url: 'en/data-deletion/', status: 200, check: pageChecks('en', 'data-deletion/') },
  { id: 'privacy-root-redirect', url: 'privacy/', status: 200, check: (h) => (has(h, /url=\/shubhvela\/en\/privacy\//) ? [] : ['no redirect to /en/privacy/']) },
  { id: '404', url: 'en/this-page-does-not-exist/', status: 404, check: (h) => { const f = []; if (!has(h, /<meta name="robots" content="noindex">/)) f.push('noindex missing'); if (!has(h, /id="nf-search"|class="nf|Page not found|404/)) f.push('404 body not the site 404 page'); return f; } },
  { id: 'robots', url: 'robots.txt', status: 200, type: /text\/plain/, check: (h) => { const f = []; if (!/User-agent: \*/.test(h)) f.push('User-agent'); if (!/Disallow: \/\*\/m\//.test(h)) f.push('Disallow /*/m/'); if (!h.includes(`Sitemap: ${CANON}sitemap.xml`)) f.push('Sitemap line'); return f; } },
  { id: 'sitemap-index', url: 'sitemap.xml', status: 200, type: /xml/, check: (h) => { const f = []; if (!/<sitemapindex/.test(h)) f.push('not a sitemapindex'); for (const l of ['en', 'hi', 'bho']) if (!h.includes(`${CANON}sitemap-${l}.xml`)) f.push(`sitemap-${l} missing`); return f; } },
  { id: 'sitemap-hi', url: 'sitemap-hi.xml', status: 200, type: /xml/, check: (h) => { const f = []; const n = (h.match(/<url>/g) || []).length; if (n < 1000) f.push(`only ${n} urls`); if (/\/m\//.test(h)) f.push('/m/ in sitemap'); if (!h.includes(`${CANON}hi/kundli/`)) f.push('hi/kundli missing'); return f; }, count: (h) => (h.match(/<url>/g) || []).length },
  { id: 'og-image', url: 'og/en/site.png', status: 200, type: /image\/png/, binary: true, check: (buf) => (buf.length > 1000 && buf[0] === 0x89 && buf[1] === 0x50 ? [] : ['not a PNG']) },
  { id: 'og-festival', url: `og/hi/festival/diwali-${year}.png`, status: 200, type: /image\/png/, binary: true, check: (buf) => (buf.length > 1000 && buf[0] === 0x89 ? [] : ['not a PNG']) },
];

(async () => {
  const results = [];
  for (const c of CHECKS) {
    const url = BASE + c.url;
    const t0 = Date.now();
    let status = 0; let type = ''; let fails = []; let bytes = 0; let extra = {};
    try {
      const res = await fetch(url, { redirect: 'manual', headers: { 'user-agent': 'shubhvela-live-check/1.0', 'cache-control': 'no-cache' } });
      status = res.status;
      type = res.headers.get('content-type') || '';
      const body = c.binary ? Buffer.from(await res.arrayBuffer()) : await res.text();
      bytes = body.length;
      if (status !== c.status) fails.push(`status ${status} != ${c.status}`);
      if (c.type && !c.type.test(type)) fails.push(`content-type ${type}`);
      if (status === c.status) fails.push(...c.check(body, url));
      if (c.count) extra.urls = c.count(body);
    } catch (e) {
      fails.push(`fetch error ${e.message}`);
    }
    const row = { id: c.id, url, status, contentType: type, bytes, ms: Date.now() - t0, pass: fails.length === 0, fails, ...extra };
    results.push(row);
    console.log(`${row.pass ? 'ok  ' : 'FAIL'} ${c.id.padEnd(22)} ${status} ${type.split(';')[0].padEnd(24)} ${String(bytes).padStart(8)} B ${row.ms} ms${fails.length ? '  ' + fails.join('; ') : ''}${extra.urls ? `  urls=${extra.urls}` : ''}`);
  }
  const summary = { run: new Date().toISOString(), base: BASE, month, nextMonth, year, checks: results.length, passed: results.filter((r) => r.pass).length, pass: results.every((r) => r.pass), results };
  fs.writeFileSync(path.join(OUT, 'live-check.json'), JSON.stringify(summary, null, 2));
  console.log('SUMMARY', JSON.stringify({ pass: summary.pass, checks: summary.checks, passed: summary.passed, base: BASE }));
  if (!summary.pass) process.exit(1);
})().catch((e) => { console.error(e); process.exit(1); });
