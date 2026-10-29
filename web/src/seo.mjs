// SEO plumbing (spec F43; design.md 9; review M8, M10, N5, N10): canonical, hreflang (en/hi/x-default ONLY — never bho),
// Open Graph incl. og:description, JSON-LD builders and sitemap writers (per language, <= 50,000 URLs each, one index;
// /m/ and noindex pages excluded).
import { BASE_URL, HREFLANG_LANGS, DEFAULT_LANG, absUrl } from './config.mjs';
import { esc, jsonScript } from './html.mjs';

export const SITEMAP_URL_LIMIT = 50_000;

/** `<link rel="canonical">` for a site path. */
export function canonicalTag(path) {
  return `<link rel="canonical" href="${esc(absUrl(path))}">`;
}

/**
 * hreflang links for a page that exists under /<lang>/<rest>: en, hi and x-default (-> English). Bhojpuri has no
 * ISO 639-1 code, so its page is never announced as an alternate (design.md 9, M10); it is linked from the switcher.
 * `rest` is the path after the language segment, e.g. '' for home or 'kundli/'.
 */
export function hreflangTags(rest) {
  const tags = HREFLANG_LANGS.map((l) => `<link rel="alternate" hreflang="${l}" href="${esc(absUrl(`${l}/${rest}`))}">`);
  tags.push(`<link rel="alternate" hreflang="x-default" href="${esc(absUrl(`${DEFAULT_LANG}/${rest}`))}">`);
  return tags.join('\n');
}

/** Open Graph + Twitter card tags. `image` is a site path (/og/en/site.png). */
export function ogTags({ title, description, path, image, type = 'website', locale }) {
  const tags = [
    `<meta property="og:type" content="${esc(type)}">`,
    `<meta property="og:site_name" content="Shubhvela">`,
    `<meta property="og:title" content="${esc(title)}">`,
    `<meta property="og:description" content="${esc(description)}">`,
    `<meta property="og:url" content="${esc(absUrl(path))}">`,
    `<meta property="og:image" content="${esc(absUrl(image))}">`,
    `<meta property="og:image:width" content="1200">`,
    `<meta property="og:image:height" content="630">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${esc(title)}">`,
    `<meta name="twitter:description" content="${esc(description)}">`,
    `<meta name="twitter:image" content="${esc(absUrl(image))}">`,
  ];
  if (locale) tags.splice(1, 0, `<meta property="og:locale" content="${esc(locale)}">`);
  return tags.join('\n');
}

export function ogLocale(lang) {
  return lang === 'hi' ? 'hi_IN' : lang === 'bho' ? 'bho_IN' : 'en_IN';
}

export function jsonLdTag(obj) {
  return `<script type="application/ld+json">${jsonScript(obj)}</script>`;
}

/** schema.org SoftwareApplication for the home page (free Android app; inLanguage lists bho too — that is not hreflang). */
export function softwareApplicationLd({ path, description, playUrl }) {
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Shubhvela',
    operatingSystem: 'Android',
    applicationCategory: 'LifestyleApplication',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'INR' },
    inLanguage: ['en', 'hi', 'bho'],
    url: absUrl(path),
    description,
  };
  if (playUrl) ld.installUrl = playUrl;
  return ld;
}

/** schema.org FAQPage from visible Q&As (N20: the same text is rendered on the page). */
export function faqPageLd(lang, qas) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    inLanguage: lang,
    mainEntity: qas.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
  };
}

/** schema.org Event (D02 festival pages). */
export function eventLd({ name, startDate, endDate, description, url, locationName, lang }) {
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name,
    startDate,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: { '@type': 'Place', name: locationName, address: { '@type': 'PostalAddress', addressCountry: 'IN' } },
    url,
    inLanguage: lang,
  };
  if (endDate) ld.endDate = endDate;
  if (description) ld.description = description;
  return ld;
}

export function breadcrumbLd(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map(([name, path], i) => ({ '@type': 'ListItem', position: i + 1, name, item: absUrl(path) })),
  };
}

/** Sitemap XML for a list of {path, lastmod?} (<= SITEMAP_URL_LIMIT entries). */
export function sitemapXml(entries) {
  if (entries.length > SITEMAP_URL_LIMIT) throw new Error(`sitemap has ${entries.length} URLs (> ${SITEMAP_URL_LIMIT})`);
  const rows = entries.map((e) => `  <url><loc>${esc(absUrl(e.path))}</loc>${e.lastmod ? `<lastmod>${e.lastmod}</lastmod>` : ''}</url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows.join('\n')}\n</urlset>\n`;
}

/** Sitemap index for a list of sitemap file names (relative to the site root). */
export function sitemapIndexXml(files, lastmod) {
  const rows = files.map((f) => `  <sitemap><loc>${esc(absUrl(f))}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}</sitemap>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows.join('\n')}\n</sitemapindex>\n`;
}

/**
 * Splits one language's URLs into sitemap-<lang>.xml, sitemap-<lang>-2.xml ... (each <= limit) and returns
 * [{file, xml}]; the index lists every file.
 */
export function languageSitemaps(lang, entries, limit = SITEMAP_URL_LIMIT) {
  const out = [];
  for (let i = 0; i < Math.max(1, Math.ceil(entries.length / limit)); i++) {
    const chunk = entries.slice(i * limit, (i + 1) * limit);
    out.push({ file: i === 0 ? `sitemap-${lang}.xml` : `sitemap-${lang}-${i + 1}.xml`, xml: sitemapXml(chunk) });
  }
  return out;
}

export { BASE_URL };
