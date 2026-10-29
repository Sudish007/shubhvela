// Kundli generator page and the /m/ share page (spec F42; design.md 9, 10.10; review M8, N5, N13, N20). The static shell
// carries every indexable sentence (intro, fact rail, form, visible Questions, "How this was computed"); only the result
// hydrates, from the M8 query, through the lazily loaded compute bundle (src/client/kundli.ts).
import { BASE_PATH, href } from '../config.mjs';
import { esc, join, jsonScript } from '../html.mjs';
import { CLIENT_KEYS } from '../client-keys.mjs';
import { faqPageLd } from '../seo.mjs';
import { intentButton, linkOrNull, page } from './layout.mjs';

const RAIL_ICONS = [
  '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>',
  '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18"/><path d="M12 3l9 9-9 9-9-9z"/></svg>',
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 1 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 1 0 5.7 5.7l1-1"/></svg>',
];

export function faqPairs(t) {
  return [
    [t('faq.q1'), t('faq.a1')],
    [t('faq.q2'), t('faq.a2')],
    [t('faq.q3'), t('faq.a3')],
  ];
}

/** Static "How this was computed" with the N13 precision figure injected from packages/engine/reference/results.json. */
export function computedFooter(ctx, precision) {
  const { t } = ctx;
  const text = t('computed.staticText', { ephemeris: precision.ephemeris, cases: precision.cases, deg: precision.deg, arcmin: precision.arcmin });
  return `<p class="computed" id="computed"><strong>${esc(t('computed.h'))}:</strong> <span id="computed-text">${esc(text)}</span> <a href="https://github.com/cosinekitty/astronomy" rel="noopener">${esc(t('computed.library'))}</a>.</p>`;
}

function rail(ctx) {
  const { t } = ctx;
  const rows = [1, 2, 3].map((n, i) => `<div class="f">${RAIL_ICONS[i]}<span><strong>${esc(t(`rail.${n}Strong`))}</strong>${esc(t(`rail.${n}`))}</span></div>`);
  return `<aside class="rail" aria-labelledby="railh"><h2 id="railh">${esc(t('rail.h2'))}</h2>${rows.join('')}</aside>`;
}

function formPanel(ctx) {
  const { t } = ctx;
  const styleRadio = (id, labelKey, checked) => `<label${checked ? ' class="on"' : ''}><input type="radio" name="st" value="${id}"${checked ? ' checked' : ''}> ${esc(t(labelKey))}</label>`;
  return `<form class="panel" id="kundli-form" aria-labelledby="formh" novalidate>
      <h2 id="formh">${esc(t('form.h2'))}</h2>
      <div class="fld"><label for="nm">${esc(t('onboarding.name'))} <span class="hint">${esc(t('form.nameHint'))}</span></label><input class="field" id="nm" name="n" type="text" maxlength="40" autocomplete="off"></div>
      <div class="fld two">
        <div><label for="dob">${esc(t('onboarding.birthDate'))}</label><input class="field num" id="dob" name="d" type="date" min="1900-01-01" required></div>
        <div><label for="tob">${esc(t('onboarding.birthTime'))}</label><input class="field num" id="tob" name="t" type="time"></div>
      </div>
      <div class="fld">
        <label class="check"><input type="checkbox" id="unk" name="unk"> ${esc(t('onboarding.timeUnknown'))}</label>
        <label class="check"><input type="checkbox" id="apx" name="apx"> ${esc(t('form.approxLabel'))}</label>
        <div id="apx-row" hidden><label for="apxw">${esc(t('form.approxWindow'))}</label><select class="field" id="apxw" name="a"><option value="15">${esc(t('onboarding.approx15'))}</option><option value="30" selected>${esc(t('onboarding.approx30'))}</option><option value="60">${esc(t('onboarding.approx60'))}</option></select></div>
      </div>
      <div class="fld">
        <label for="pl">${esc(t('onboarding.place'))} <span class="hint">${esc(t('form.placeHint'))}</span></label>
        <input class="field" id="pl" type="search" autocomplete="off" aria-controls="pl-list" aria-describedby="pl-hint">
        <ul class="places" id="pl-list" aria-label="${esc(t('form.placeResults'))}"></ul>
        <span class="hint num" id="pl-hint" style="margin-top:6px"></span>
        <input type="hidden" id="lat" name="lat"><input type="hidden" id="lon" name="lon"><input type="hidden" id="tz" name="tz">
        <p class="status" id="pl-status"></p>
        <button class="btn btn-text" type="button" id="pl-online" aria-describedby="pl-online-hint">${esc(t('onboarding.searchOnline'))}</button>
        <span class="hint" id="pl-online-hint">${esc(t('form.searchOnlineHint'))}</span>
      </div>
      <div class="fld two">
        <div><label for="ay">${esc(t('settings.ayanamsa'))}</label><select class="field" id="ay" name="ay"><option value="lahiri">${esc(t('settings.ayanamsa.lahiri'))}</option><option value="kp">${esc(t('settings.ayanamsa.kp'))}</option><option value="raman">${esc(t('settings.ayanamsa.raman'))}</option></select></div>
        <div><label for="nd">${esc(t('settings.nodes'))}</label><select class="field" id="nd" name="nd"><option value="mean">${esc(t('settings.nodes.mean'))}</option><option value="true">${esc(t('settings.nodes.true'))}</option></select></div>
      </div>
      <div class="fld"><label for="g">${esc(t('onboarding.gender'))} <span class="hint">${esc(t('common.optional'))}</span></label><select class="field" id="g" name="g"><option value="x">${esc(t('onboarding.genderSkip'))}</option><option value="f">${esc(t('onboarding.genderFemale'))}</option><option value="m">${esc(t('onboarding.genderMale'))}</option></select></div>
      <div class="fld"><span id="stylel" style="display:block;font-weight:600;font-size:.9em;margin-bottom:6px">${esc(t('form.style'))}</span>
        <div class="radios" role="radiogroup" aria-labelledby="stylel">
          ${styleRadio('north', 'charts.styleNorth', true)}
          ${styleRadio('south', 'charts.styleSouth', false)}
          ${styleRadio('east', 'charts.styleEast', false)}
        </div>
      </div>
      <p class="err" id="form-err" role="alert"></p>
      <button class="btn btn-primary" type="submit" style="width:100%">${esc(t('form.compute'))}</button>
      <p class="note">${esc(t('form.note'))}</p>
    </form>`;
}

/**
 * kind 'kundli': /<lang>/kundli/ (indexable, FAQ, form). kind 'm': /<lang>/m/ (noindex, canonical -> kundli, no form, no
 * name extra; M8). opts.path overrides the output path (the root /m/ and /kundli/ copies).
 */
export function renderKundli(ctx, data, opts) {
  const { lang, t, site } = ctx;
  const kind = opts.kind;
  const isM = kind === 'm';
  const path = opts.path ?? `/${lang}/${kind}/`;
  const canonicalPath = `/${lang}/kundli/`;
  const i18n = t.pick(CLIENT_KEYS);
  const cfg = {
    lang,
    kind,
    basePath: BASE_PATH,
    baseUrl: site.baseUrl,
    playUrl: site.playUrl || null,
    downloadUrl: `${site.baseUrl}${lang}/download/`,
    appPackage: site.appPackage,
    appScheme: site.appScheme,
    rulesUrl: `${BASE_PATH}assets/${data.rulesAsset[lang]}`,
    precision: data.precision,
  };
  const downloadHref = linkOrNull(site, `/${lang}/download/`);
  const appCta = site.playUrl
    ? `<a class="btn" href="${esc(site.playUrl)}" rel="noopener">${esc(t('kundli.appCta'))}</a>`
    : downloadHref
      ? `<a class="btn" href="${downloadHref}">${esc(t('kundli.appCta'))}</a>`
      : '';
  const homeCityHref = linkOrNull(site, `/${lang}/panchang/new-delhi/`);

  const head = isM
    ? `<div class="wrap head">
    <div>
      <h1 class="display">${esc(t('m.h1'))}</h1>
      <p>${esc(t('m.intro'))}</p>
      <p class="note" style="max-width:70ch">${esc(t('m.noName'))}</p>
      <div class="actions"><a class="btn" href="${href(`/${lang}/kundli/`)}">${esc(t('m.makeOwn'))}</a>${appCta}</div>
    </div>
    ${rail(ctx)}
  </div>`
    : `<div class="wrap head">
    <div>
      <h1 class="display">${esc(t('kundli.h1'))}</h1>
      <p>${esc(t('kundli.intro'))}</p>
      <div class="actions">${appCta}${homeCityHref ? `<a class="btn btn-text" href="${homeCityHref}">${esc(t('home.ctaPanchang'))}</a>` : ''}</div>
      <p class="note" style="max-width:70ch">${esc(t('kundli.youGet'))}</p>
    </div>
    ${rail(ctx)}
  </div>`;

  const resultPanel = `<section class="panel result" id="result" aria-labelledby="resh" aria-live="polite">
      <div class="rhead" id="rhead">
        <div><h2 id="resh" class="display">${esc(t('result.h2'))}</h2><p class="num" id="born"></p></div>
        <span class="tag" id="style-tag" hidden></span>
      </div>
      <p class="empty" id="result-empty">${esc(isM ? t('m.invalid') : t('result.empty'))}</p>
      <p class="status" id="result-status" data-loading="${esc(t('result.loading'))}" data-failed="${esc(t('result.loadFailed'))}"></p>
      <div id="chart-wrap"></div>
      <div class="rows" id="rows"></div>
      <div class="share" id="share" hidden>
        <div class="url num" id="share-url" aria-label="${esc(t('result.shareLabel'))}"></div>
        <button class="btn" type="button" id="copy">${esc(t('result.copy'))}</button>
      </div>
      <div class="actions" id="result-actions" hidden>
        ${intentButton(ctx, { path: kind, label: isM ? t('m.openInApp') : t('app.openInApp'), primary: true, id: 'intent-link' })}
        ${isM ? '' : site.playUrl ? `<a class="btn" href="${esc(site.playUrl)}" rel="noopener">${esc(t('result.pdfInApp'))}</a>` : downloadHref ? `<a class="btn" href="${downloadHref}">${esc(t('result.pdfInApp'))}</a>` : ''}
      </div>
      ${isM ? `<p class="note">${esc(t('m.openInAppHint'))}</p>` : ''}
    </section>`;

  const detailPanel = `<section class="panel detail" id="detail" aria-labelledby="pth" hidden>
      <h2 id="pth">${esc(t('detail.planets'))}</h2>
      <div class="tscroll"><table id="planets"><thead><tr><th scope="col">${esc(t('charts.planet_col'))}</th><th scope="col">${esc(t('charts.sign_col'))}</th><th scope="col">${esc(t('charts.nakshatra_col'))}</th></tr></thead><tbody></tbody></table></div>
      <h2 style="margin-top:var(--gap)">${esc(t('detail.dasha'))}</h2>
      <div class="rows" id="dasha"></div>
      ${computedFooter(ctx, data.precision)}
    </section>`;

  const grid = `<div class="wrap kundli${isM ? ' noform' : ''}">
    ${isM ? '' : formPanel(ctx)}
    <div class="results">
    ${resultPanel}
    ${detailPanel}
    </div>
  </div>`;

  const qas = faqPairs(t);
  const faq = isM
    ? ''
    : `<section class="wrap faq" aria-labelledby="faqh">
    <h2 id="faqh" class="display">${esc(t('faq.h2'))}</h2>
    <div class="grid">${qas.map(([q, a]) => `<div><h3>${esc(q)}</h3><p>${esc(a)}</p></div>`).join('')}</div>
  </section>`;

  const dataBlocks = `<script type="application/json" id="i18n">${jsonScript(i18n)}</script>
<script type="application/json" id="cfg">${jsonScript(cfg)}</script>`;

  return page(ctx, {
    path,
    rest: isM ? undefined : 'kundli/',
    canonicalPath,
    noindex: isM || opts.noindex === true,
    title: t(isM ? 'm.title' : 'kundli.title'),
    description: t(isM ? 'm.description' : 'kundli.description'),
    ogTitle: t(isM ? 'm.title' : 'kundli.ogTitle'),
    ogDescription: t(isM ? 'm.description' : 'kundli.ogDescription'),
    ogImage: `/og/${lang}/kundli.png`,
    jsonLd: isM ? [] : [faqPageLd(lang, qas)],
    current: 'kundli',
    main: join([head, grid, faq, dataBlocks]),
    bodyAttrs: `data-bundle="${esc(`${BASE_PATH}assets/${data.bundleFile}`)}" data-kind="${kind}"`,
    keepQuery: true,
    chartScale: true,
    scripts: [site.scripts.loader],
  });
}
