// Vrat pages (spec F22/F42; design.md 10.4; FEAT-D02): /<lang>/vrat/<family>/ with the family's text (corpus/vrats), the
// next 12 occurrences at New Delhi with the computed key time (parana, moonrise, pradosh kala, nishita ...) and the
// tithi end, a city picker that recomputes client-side, and the honest footer. Also /<lang>/vrat/ (12 families).
import { href } from '../config.mjs';
import { esc, join } from '../html.mjs';
import { civilDateLong, vratKeyTimeText } from '../format.mjs';
import { cityName } from '../data/cities.mjs';
import { occurrenceRows } from '../rows.mjs';
import { crumbs, cityPicker, fallbackNote, pickerBodyAttrs, panchangComputed } from './parts.mjs';
import { page, playButton } from './layout.mjs';
import { DATA_CLIENT_KEYS } from '../client-keys.mjs';

export function renderVrat(ctx, data, { family }) {
  const { lang, t, site, engine } = ctx;
  const vd = data.vrats;
  const f = vd.byFamily.get(family);
  const copy = data.vratCopy[lang].get(family);
  const name = t(`vrat.family.${family}`);
  const path = `/${lang}/vrat/${f.slug}/`;
  const bc = crumbs(ctx, [[t('nav.vrat'), `/${lang}/vrat/`], [name, null]]);
  const cfg = { kind: 'vrat', lang, family, from: data.calendar.today, defaultCity: vd.city.slug, next: f.occurrences.length };
  const others = vd.families.filter((x) => x !== family).map((x) => `<li><a href="${href(`/${lang}/vrat/${vd.byFamily.get(x).slug}/`)}">${esc(t(`vrat.family.${x}`))}</a></li>`);
  const convention = f.occurrences[0]?.convention ?? '';
  const main = join([
    `<div class="wrap page">`,
    bc.html,
    `<h1 class="display">${esc(name)}</h1>`,
    `<p class="lede">${esc(t('vrat.lede', { family: name, count: f.occurrences.length, city: cityName(vd.city, lang) }))}</p>`,
    `<section class="prose" aria-labelledby="whath">
      <h2 id="whath">${esc(t('vrat.whatToDo'))}</h2>
      ${fallbackNote(ctx, copy?.lang)}
      <p>${esc(copy?.text ?? t('calendar.noText'))}</p>
      ${copy?.rule ? `<p class="s"><strong>${esc(t('calendar.ruleLabel'))}:</strong> ${esc(copy.rule)}${copy.source ? ` (${esc(copy.source)})` : ''}</p>` : ''}
    </section>`,
    `<section class="panel pick" aria-labelledby="pickh">
      <h2 id="pickh">${esc(t('vrat.pickH'))}</h2>
      ${cityPicker(ctx, { cities: data.cities, selected: vd.city, cfg, i18n: t.pick(DATA_CLIENT_KEYS.vrat) })}
    </section>`,
    `<section class="section-sub" id="pick-out" data-city="${esc(vd.city.slug)}" aria-labelledby="nexth">
      <h2 id="nexth">${esc(t('vrat.nextH', { count: f.occurrences.length, city: cityName(vd.city, lang) }))}</h2>
      <div class="tscroll"><table id="occurrences" class="occurrences">
        <caption>${esc(t('vrat.tableCaption', { family: name, city: cityName(vd.city, lang) }))}</caption>
        <thead><tr><th scope="col">${esc(t('panchang.col.date'))}</th><th scope="col">${esc(t('upcoming.vrat'))}</th><th scope="col">${esc(t('vrat.keyTime'))}</th><th scope="col">${esc(t('panchang.tithi'))}</th></tr></thead>
        <tbody>${occurrenceRows(engine, t, lang, f.occurrences, vd.tz).join('\n')}</tbody>
      </table></div>
      <p class="note" id="vrat-computed">${esc(t('vrat.howComputed', { convention, tz: vd.tz }))}</p>
    </section>`,
    `<section class="twocol" aria-labelledby="apph">
      <div class="prose"><h2 id="apph">${esc(t('vrat.remindH'))}</h2><p>${esc(t('vrat.remindP'))}</p><div class="actions">${playButton(ctx, { primary: false })}${site.has(`/${lang}/download/`) ? `<a class="btn btn-text" href="${href(`/${lang}/download/`)}">${esc(t('nav.download'))}</a>` : ''}</div></div>
      <aside class="sidecard"><h2>${esc(t('vrat.othersH'))}</h2><ul class="linklist">${others.join('')}</ul></aside>
    </section>`,
    panchangComputed(ctx, { tz: vd.tz }),
    `</div>`,
  ]);
  return page(ctx, {
    path,
    rest: `vrat/${f.slug}/`,
    title: `${t('vrat.pageTitle', { family: name })} · ${t('site.name')}`,
    description: t('vrat.description', { family: name, count: f.occurrences.length, city: cityName(vd.city, lang) }),
    ogTitle: t('vrat.pageTitle', { family: name }),
    ogImage: `/og/${lang}/vrat/${f.slug}.png`,
    jsonLd: [bc.ld],
    current: 'vrat',
    main,
    inlineCss: false,
    bodyAttrs: pickerBodyAttrs(ctx),
    scripts: [site.scripts.picker],
  });
}

export function renderVratIndex(ctx, data) {
  const { lang, t, engine } = ctx;
  const vd = data.vrats;
  const bc = crumbs(ctx, [[t('nav.vrat'), null]]);
  const cards = vd.families.map((family) => {
    const f = vd.byFamily.get(family);
    const o = f.occurrences[0];
    const line = o ? t('vrat.cardLine', { name: t(`vrat.name.${o.name}`), date: civilDateLong(engine, o.date, lang), time: vratKeyTimeText(engine, t, o.keyTime, vd.tz) }) : t('mini.none');
    return `<a class="card" href="${href(`/${lang}/vrat/${f.slug}/`)}"><h3 class="display">${esc(t(`vrat.family.${family}`))}</h3><span class="t">${esc(line)}</span></a>`;
  });
  const main = `<div class="wrap page">
    ${bc.html}
    <h1 class="display">${esc(t('vrat.indexH1'))}</h1>
    <p class="lede">${esc(t('vrat.indexLede', { city: cityName(vd.city, lang) }))}</p>
    <div class="grid">${cards.join('\n')}</div>
  </div>`;
  return page(ctx, {
    path: `/${lang}/vrat/`,
    rest: 'vrat/',
    title: `${t('vrat.indexH1')} · ${t('site.name')}`,
    description: t('vrat.indexDescription', { city: cityName(vd.city, lang) }),
    ogImage: `/og/${lang}/site.png`,
    jsonLd: [bc.ld],
    current: 'vrat',
    main,
    inlineCss: false,
  });
}
