// Page shell shared by every template (design.md 9 header/footer, 10.10; review N23 skip link, M9 Android-only buttons).
// `page(ctx, opts)` returns a complete HTML document. ctx comes from build.mjs (language, translator, site inventory,
// inline assets); opts carry the page's head data and <main> markup.
import { BASE_PATH, LANGS, href, absUrl } from '../config.mjs';
import { esc, join } from '../html.mjs';
import { canonicalTag, hreflangTags, jsonLdTag, ogLocale, ogTags } from '../seo.mjs';

/** Site sections in header order: [key, rest path candidates (first existing wins)]. */
export const NAV_SECTIONS = [
  ['kundli', ['kundli/']],
  ['panchang', ['panchang/']],
  ['festivals', ['festivals/', 'festival/']],
  ['muhurat', ['muhurat/']],
  ['vrat', ['vrat/']],
  ['glossary', ['glossary/']],
  ['download', ['download/']],
];

const MOON_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>';

/** First existing path among candidates (site paths like `/en/kundli/`), or null. */
export function firstExisting(site, lang, candidates) {
  for (const rest of candidates) {
    const p = `/${lang}/${rest}`;
    if (site.has(p)) return p;
  }
  return null;
}

/** `<a class="btn">` or, when the target page is not in this build's inventory, no link at all (never a dead link). */
export function linkOrNull(site, path) {
  return site.has(path) ? href(path) : null;
}

export function header(ctx, { current, rest, keepQuery }) {
  const { lang, t, site } = ctx;
  const nav = NAV_SECTIONS.map(([key, cands]) => {
    const p = firstExisting(site, lang, cands);
    if (!p) return null;
    const isCurrent = current === key;
    return `<a href="${href(p)}"${isCurrent ? ' aria-current="page"' : ''}>${esc(t(`nav.${key}`))}</a>`;
  }).filter(Boolean);
  const langs = LANGS.map((l) => {
    const target = `/${l}/${rest ?? ''}`;
    const p = site.has(target) ? target : `/${l}/`;
    const cur = l === lang;
    // hreflang only for ISO 639-1 codes (M10): the Bhojpuri link carries lang="bho" alone.
    return `<a href="${href(p)}"${cur ? ' aria-current="true"' : ''} lang="${l}"${l === 'bho' ? '' : ` hreflang="${l}"`} title="${esc(t(`settings.lang.${l}`))}"${keepQuery ? ' data-keep-query' : ''}>${esc(t(`lang.${l}`))}</a>`;
  });
  const mark = site.brandMark ? site.brandMark : '';
  return `<header class="site">
  <div class="wrap nav">
    <a class="brand display" href="${href(`/${lang}/`)}">${mark}<span class="dev">${esc(t('site.nameDev'))}</span><span>${esc(t('site.name'))}</span></a>
    ${nav.length ? `<nav class="links" aria-label="${esc(t('site.navLabel'))}">${nav.join('')}</nav>` : ''}
    <div class="tools">
      <nav class="langs" aria-label="${esc(t('site.langLabel'))}">${langs.join('')}</nav>
      <button class="theme" id="theme" type="button" aria-pressed="false" aria-label="${esc(t('theme.toDark'))}" data-dark="${esc(t('theme.dark'))}" data-light="${esc(t('theme.light'))}" data-to-dark="${esc(t('theme.toDark'))}" data-to-light="${esc(t('theme.toLight'))}">${MOON_ICON}<span id="theme-label">${esc(t('theme.dark'))}</span></button>
    </div>
  </div>
</header>`;
}

export function footer(ctx, { rest, keepQuery }) {
  const { lang, t, site } = ctx;
  const link = (path, label) => (site.has(path) ? `<a href="${href(path)}">${esc(label)}</a>` : null);
  const col1 = join(
    [
      `<h4>${esc(t('site.name'))}</h4>`,
      link(`/${lang}/download/`, t('footer.download')),
      link(`/${lang}/privacy/`, t('footer.privacy')),
      link(`/${lang}/terms/`, t('footer.terms')),
      link(`/${lang}/data-deletion/`, t('footer.deletion')),
      `<a href="${esc(site.sourceUrl)}" rel="noopener">${esc(t('footer.source'))}</a>`,
    ],
    '<br>',
  );
  const explore = [
    link(`/${lang}/kundli/`, t('nav.kundli')),
    link(firstExisting(site, lang, ['panchang/']) ?? '/none', t('nav.panchang')),
    link(firstExisting(site, lang, ['festivals/', 'festival/']) ?? '/none', t('nav.festivals')),
    link(firstExisting(site, lang, ['muhurat/']) ?? '/none', t('nav.muhurat')),
    link(firstExisting(site, lang, ['vrat/']) ?? '/none', t('nav.vrat')),
    link(firstExisting(site, lang, ['glossary/']) ?? '/none', t('nav.glossary')),
  ].filter(Boolean);
  const col2 = join([`<h4>${esc(t('footer.explore'))}</h4>`, ...explore], '<br>');
  const langLinks = LANGS.map((l) => {
    const target = `/${l}/${rest ?? ''}`;
    const p = site.has(target) ? target : `/${l}/`;
    return `<a href="${href(p)}" lang="${l}"${keepQuery ? ' data-keep-query' : ''}>${esc(t(`settings.lang.${l}`))}</a>`;
  });
  const col3 = join([`<h4>${esc(t('footer.languages'))}</h4>`, ...langLinks], '<br>');
  const col4 = `<h4>${esc(t('footer.computedH'))}</h4><p>${esc(t('footer.computed'))}</p>`;
  return `<footer class="wrap">
  <div class="cols">
    <div>${col1}</div>
    <div>${col2}</div>
    <div>${col3}</div>
    <div>${col4}</div>
  </div>
  <p class="fine">${esc(t('footer.geonames'))}</p>
</footer>`;
}

/**
 * Full document.
 * opts: { path, rest, title, description, ogTitle?, ogDescription?, ogImage, jsonLd?: object[], noindex?: boolean,
 *         canonicalPath?, current?, main, bodyClass?, bodyAttrs?: string, scripts?: string[] (inline JS at body end),
 *         chartScale?: boolean, keepQuery?: boolean, inlineCss?: boolean (default true), headExtra?: string }
 */
export function page(ctx, opts) {
  const { lang, t, site } = ctx;
  const title = opts.title;
  const canonicalPath = opts.canonicalPath ?? opts.path;
  const head = join([
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(opts.description)}">`,
    opts.noindex ? '<meta name="robots" content="noindex">' : null,
    canonicalTag(canonicalPath),
    opts.noindex || opts.rest === undefined ? null : hreflangTags(opts.rest),
    ogTags({ title: opts.ogTitle ?? title, description: opts.ogDescription ?? opts.description, path: canonicalPath, image: opts.ogImage, locale: ogLocale(lang) }),
    '<meta name="theme-color" content="#FAF7F2">',
    site.icons,
    `<script>${site.scripts.theme}</script>`,
    `<link rel="preload" as="font" type="font/ttf" crossorigin href="${BASE_PATH}fonts/${site.fonts.display}">`,
    `<link rel="preload" as="font" type="font/ttf" crossorigin href="${BASE_PATH}fonts/${lang === 'en' ? site.fonts.sansRegular : site.fonts.devaRegular}">`,
    opts.inlineCss === false ? `<link rel="stylesheet" href="${site.cssHref}">` : `<style>${site.css}</style>`,
    ...(opts.jsonLd ?? []).map(jsonLdTag),
    opts.headExtra ?? null,
  ]);
  const scripts = [site.scripts.toggle, site.scripts.ua, opts.chartScale ? site.scripts.chartScale : null, ...(opts.scripts ?? [])].filter(Boolean);
  const bodyAttrs = join([opts.bodyClass ? `class="${esc(opts.bodyClass)}"` : null, opts.keepQuery ? 'data-keep-query' : null, opts.bodyAttrs ?? null], ' ');
  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
${head}
</head>
<body${bodyAttrs ? ' ' + bodyAttrs : ''}>
<a class="skip" href="#main">${esc(t('site.skip'))}</a>
${header(ctx, { current: opts.current, rest: opts.rest, keepQuery: opts.keepQuery })}
<main id="main">
${opts.main}
</main>
${footer(ctx, { rest: opts.rest, keepQuery: opts.keepQuery })}
<script>${scripts.join('\n')}</script>
</body>
</html>
`;
}

/** Play button (text, never a stock badge): a link when the listing URL exists, else the honest "Coming to Google Play". */
export function playButton(ctx, { primary = true } = {}) {
  const { t, site } = ctx;
  const cls = `btn${primary ? ' btn-primary' : ''}`;
  if (site.playUrl) return `<a class="${cls}" href="${esc(site.playUrl)}" rel="noopener">${esc(t('app.getOnPlay'))}</a>`;
  return `<span class="${cls}" aria-disabled="true">${esc(t('app.comingToPlay'))}</span>`;
}

/**
 * Android-only deep-link button (design.md 9 / M9): intent://<path>#Intent;scheme=shubhvela;package=...;S.browser_fallback_url=<Play
 * or the download page until the listing exists>;end. Hidden unless html[data-ua="android"].
 */
export function intentButton(ctx, { path, query = '', label, primary = false, id }) {
  const { lang, t, site } = ctx;
  const fallback = site.playUrl || absUrl(`${lang}/download/`);
  const intent = `intent://${path}${query ? `?${query}` : ''}#Intent;scheme=${site.appScheme};package=${site.appPackage};S.browser_fallback_url=${encodeURIComponent(fallback)};end`;
  return `<a class="btn android-only${primary ? ' btn-primary' : ''}" href="${esc(intent)}"${id ? ` id="${id}"` : ''}>${esc(label ?? t('app.openInApp'))}</a>`;
}
