// Shared pieces of the data pages (FEAT-D02): breadcrumbs, the city picker (select -> ?city= query param; the data
// bundle recomputes client-side from the engine), key/value rows, the static honesty footers. Every value passed in is
// engine output formatted by format.mjs; nothing here computes a date.
import { BASE_PATH, href } from '../config.mjs';
import { esc, join, jsonScript } from '../html.mjs';
import { breadcrumbLd } from '../seo.mjs';
import { cityName } from '../data/cities.mjs';
import { FEATURED_CITY_SLUGS } from '../config.mjs';

/** Breadcrumb nav + its JSON-LD. items: [[label, sitePath|null], ...] (the last item is the current page). */
export function crumbs(ctx, items) {
  const { t } = ctx;
  const links = items.map(([label, path], i) => {
    const last = i === items.length - 1;
    if (last || !path) return `<li><span${last ? ' aria-current="page"' : ''}>${esc(label)}</span></li>`;
    return `<li><a href="${href(path)}">${esc(label)}</a></li>`;
  });
  return {
    html: `<nav class="crumbs" aria-label="${esc(t('data.breadcrumb'))}"><ol>${links.join('')}</ol></nav>`,
    ld: breadcrumbLd(items.filter(([, p]) => p).map(([label, p]) => [label, p])),
  };
}

export function kvRows(rows) {
  return rows
    .filter((r) => r && r[1] !== null && r[1] !== undefined && r[1] !== '')
    .map(([k, v, cls]) => `<div class="kv"><span>${esc(k)}</span><span class="num${cls ? ' ' + cls : ''}">${esc(v)}</span></div>`)
    .join('\n');
}

/**
 * City picker: a labelled <select> with the featured cities + the selected one; the inline picker script fills the full
 * 331 list from assets/cities-<hash>.json on focus, writes ?city=<slug> and loads the data bundle, which recomputes the
 * block identified by `cfg.kind`. `cfg` is embedded as JSON (#cfg) for the bundle; i18n as #i18n.
 */
export function cityPicker(ctx, { cities, selected, cfg, i18n, note }) {
  const { lang, t } = ctx;
  const featured = FEATURED_CITY_SLUGS.map((s) => cities.find((c) => c.slug === s)).filter(Boolean);
  const list = featured.some((c) => c.slug === selected.slug) ? featured : [selected, ...featured];
  const options = list.map((c) => `<option value="${esc(c.slug)}"${c.slug === selected.slug ? ' selected' : ''}>${esc(cityName(c, lang))}</option>`);
  return `<div class="picker">
      <label for="city-pick">${esc(t('data.pickCity'))}</label>
      <select class="field" id="city-pick" data-cities="${esc(`${BASE_PATH}assets/${ctx.site.citiesAsset}`)}" data-all="${esc(t('data.pickAll'))}">${options.join('')}</select>
      <p class="status" id="pick-status" data-loading="${esc(t('data.pickLoading'))}" data-failed="${esc(t('data.pickFailed'))}"></p>
      ${note ? `<p class="note">${esc(note)}</p>` : ''}
    </div>
<script type="application/json" id="cfg">${jsonScript(cfg)}</script>
<script type="application/json" id="i18n">${jsonScript(i18n)}</script>`;
}

/** Body attributes a picker page needs (the inline picker.js reads data-bundle). */
export function pickerBodyAttrs(ctx) {
  return `data-bundle="${esc(`${BASE_PATH}assets/${ctx.site.dataBundleFile}`)}"`;
}

/** "How this was computed" footer for panchang-derived pages (panchang.howComputed with the engine's actual settings). */
export function panchangComputed(ctx, { tz, ayanamsa = 'lahiri', node = 'mean' }) {
  const { t, engine } = ctx;
  const text = t('panchang.howComputed', {
    ayanamsa: t(`panchang.ayanamsa.${ayanamsa}`),
    node: t(`panchang.node.${node}`),
    ephemeris: engine.EPHEMERIS,
    tz,
  });
  return `<p class="computed">${esc(text)} <a href="https://github.com/cosinekitty/astronomy" rel="noopener">${esc(t('computed.library'))}</a>.</p>`;
}

/** Fallback-language note when the corpus text is not yet in the page language (A-INFO-1: never an empty string, never hidden). */
export function fallbackNote(ctx, resolvedLang) {
  const { lang, t } = ctx;
  if (!resolvedLang || resolvedLang === lang) return '';
  return `<p class="note">${esc(t('data.textIn', { lang: t(`settings.lang.${resolvedLang}`) }))}</p>`;
}

export function linkRow(items) {
  return `<ul class="linklist">${items.map(([label, h]) => `<li><a href="${h}">${esc(label)}</a></li>`).join('')}</ul>`;
}

export { join };
