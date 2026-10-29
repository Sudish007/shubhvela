// 404 page with a client-side search over the site inventory (spec F42 "404"; design.md 10.10 "404 with search").
// Written per language under /<lang>/404/ (noindex) and, in English, as dist/404.html, which GitHub Pages serves for
// every missing path; a tiny script there sends /hi/... and /bho/... paths to their own language's page.
import { BASE_PATH, LANGS, href } from '../config.mjs';
import { esc } from '../html.mjs';
import { firstExisting, page } from './layout.mjs';

export function renderNotFound(ctx, data, { root = false } = {}) {
  const { lang, t, site } = ctx;
  const links = [
    [`/${lang}/`, t('notfound.home')],
    [`/${lang}/kundli/`, t('nav.kundli')],
    [firstExisting(site, lang, ['panchang/']), t('nav.panchang')],
    [firstExisting(site, lang, ['festivals/', 'festival/']), t('nav.festivals')],
    [firstExisting(site, lang, ['glossary/']), t('nav.glossary')],
    [`/${lang}/download/`, t('nav.download')],
  ].filter(([p]) => p && site.has(p));
  const main = `<div class="wrap page">
    <div class="prose">
      <h1 class="display">${esc(t('notfound.h1'))}</h1>
      <p class="lede">${esc(t('notfound.p'))}</p>
      <form class="search" role="search" onsubmit="return false">
        <label for="q">${esc(t('notfound.searchLabel'))}</label>
        <input class="field" id="q" type="search" placeholder="${esc(t('notfound.placeholder'))}" autocomplete="off" data-index="${esc(`${BASE_PATH}assets/${data.searchAsset[lang]}`)}">
      </form>
      <ul class="results" id="results" aria-label="${esc(t('notfound.results'))}"></ul>
      <p class="status" id="no-results" hidden>${esc(t('notfound.noResults'))}</p>
      <ul class="linklist">${links.map(([p, label]) => `<li><a href="${href(p)}">${esc(label)}</a></li>`).join('')}</ul>
    </div>
  </div>`;
  const rootRedirect = root
    ? `(function(){var m=/^${BASE_PATH.replace(/\//g, '\\/')}(${LANGS.filter((l) => l !== lang).join('|')})\\//.exec(location.pathname);if(m){location.replace('${BASE_PATH}'+m[1]+'/404/');}})();`
    : null;
  return page(ctx, {
    path: root ? '/404.html' : `/${lang}/404/`,
    rest: undefined,
    canonicalPath: `/${lang}/404/`,
    noindex: true,
    title: t('notfound.title'),
    description: t('notfound.p'),
    ogImage: `/og/${lang}/site.png`,
    main,
    scripts: [rootRedirect, site.scripts.notfoundSearch].filter(Boolean),
  });
}
