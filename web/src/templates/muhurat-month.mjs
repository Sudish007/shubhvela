// Muhurat pages (spec F26/F42; design.md 10.10; FEAT-D02): /<lang>/muhurat/<activity>/<yyyy-mm>/ lists the month's
// windows at New Delhi from engine.muhurat.score — date, time, "N/10 rules met", choghadiya — matches (>= 4 rules) in
// the table, partials behind a <details>. A city picker recomputes client-side. The rule legend names the ten rules with
// their corpus text; the page says plainly that Chandra bala and Tara bala are scored against a birth chart in the app
// and are never met here. Also /<lang>/muhurat/ (14 activities × 12 months).
import { href } from '../config.mjs';
import { esc, join } from '../html.mjs';
import { nakshatraLabel, weekdayName } from '../format.mjs';
import { cityName } from '../data/cities.mjs';
import { byDate } from '../data/muhurat.mjs';
import { monthLabel } from '../data/panchang.mjs';
import { PERSONAL_RULES, emptyWindowsRow, windowRows } from '../rows.mjs';
import { crumbs, cityPicker, fallbackNote, pickerBodyAttrs } from './parts.mjs';
import { page, playButton } from './layout.mjs';
import { DATA_CLIENT_KEYS } from '../client-keys.mjs';

function windowsTable(ctx, windows, tz, { id, caption }) {
  const { lang, t, engine } = ctx;
  const head = [t('today.timeRange'), t('muhurat.col.rules', { of: windows[0]?.of ?? engine.MUHURAT_RULE_COUNT }), t('muhurat.col.choghadiya')];
  return `<div class="tscroll"><table id="${id}" class="windows">
      <caption>${esc(caption)}</caption>
      <thead><tr>${head.map((h) => `<th scope="col">${esc(h)}</th>`).join('')}</tr></thead>
      <tbody>${windows.length ? windowRows(engine, t, lang, windows, tz).join('\n') : emptyWindowsRow(t)}</tbody>
    </table></div>`;
}

export function renderMuhuratMonth(ctx, data, { activity, ym }) {
  const { lang, t, engine, site } = ctx;
  const md = data.muhurat;
  const m = md.byActivity.get(activity.id).get(ym);
  const tz = md.tz;
  const name = activity.names[lang] ?? activity.names.en;
  const month = monthLabel(engine, ym, lang);
  const copy = data.muhuratCopy[lang].get(activity.id);
  const path = `/${lang}/muhurat/${activity.id}/${ym}/`;
  const bc = crumbs(ctx, [[t('nav.muhurat'), `/${lang}/muhurat/`], [name, null], [month, null]]);
  const matches = byDate(m.matches);
  const partials = byDate(m.partials);
  const days = new Set(matches.map((w) => w.day)).size;
  const cfg = { kind: 'muhurat', lang, activity: activity.id, month: ym, defaultCity: md.city.slug, minRules: md.minRules, nightAllowed: activity.nightAllowed };
  // Names (+ the "needs a birth chart" tag) here; the ten rule texts live once per language on /muhurat/#rules.
  const legend = md.ruleOrder.map((r) => {
    const personal = PERSONAL_RULES.includes(r);
    return `<li${personal ? ' class="personal"' : ''}><strong>${esc(t(`muhurat.rule.${r}`))}</strong>${personal ? ` <span class="tag">${esc(t('muhurat.personalTag'))}</span>` : ''}</li>`;
  });
  const allowed = [
    [t('muhurat.allowedTithis'), activity.allowedTithis.map((n) => engine.locale.tithiNames[lang][n - 1]).join(', ')],
    [t('muhurat.allowedNakshatras'), activity.allowedNakshatras.map((n) => nakshatraLabel(engine, n - 1, lang)).join(', ')],
    [t('muhurat.allowedVaras'), activity.allowedVaras.map((v) => weekdayName(engine, v, lang)).join(', ')],
    [t('muhurat.nightAllowed'), activity.nightAllowed ? t('common.yes') : t('muhurat.dayOnly')],
  ];
  const monthLinks = md.months.map((mm) => (mm === ym ? `<span class="btn" aria-current="page">${esc(monthLabel(engine, mm, lang))}</span>` : `<a class="btn" href="${href(`/${lang}/muhurat/${activity.id}/${mm}/`)}">${esc(monthLabel(engine, mm, lang))}</a>`));
  const activityLinks = md.activities.filter((a) => a.id !== activity.id).map((a) => `<li><a href="${href(`/${lang}/muhurat/${a.id}/${ym}/`)}">${esc(a.names[lang] ?? a.names.en)}</a></li>`);
  const main = join([
    `<div class="wrap page">`,
    bc.html,
    `<h1 class="display">${esc(t('muhurat.pageTitle', { activity: name, month }))}</h1>`,
    `<p class="lede">${esc(t('muhurat.lede', { count: matches.length, days, min: md.minRules, of: md.ruleCount, city: cityName(md.city, lang), month }))}</p>`,
    `<p class="note">${esc(t('muhurat.personalNote'))}</p>`,
    `<section class="panel pick" aria-labelledby="pickh">
      <h2 id="pickh">${esc(t('muhurat.pickH'))}</h2>
      ${cityPicker(ctx, { cities: data.cities, selected: md.city, cfg, i18n: t.pick(DATA_CLIENT_KEYS.muhurat) })}
    </section>`,
    `<section class="section-sub" id="pick-out" data-city="${esc(md.city.slug)}" aria-labelledby="winh">
      <h2 id="winh">${esc(t('muhurat.windowsH', { city: cityName(md.city, lang) }))}</h2>
      ${windowsTable(ctx, matches, tz, { id: 'windows', caption: t('muhurat.windowsCaption', { activity: name, month, city: cityName(md.city, lang) }) })}
      <details class="more"><summary class="btn">${esc(t('muhurat.partialTitle'))} <span class="num">(${partials.length})</span></summary>
        <p class="note">${esc(t('muhurat.partialNote'))}</p>
        ${windowsTable(ctx, partials, tz, { id: 'partials', caption: t('muhurat.partialTitle') })}
      </details>
    </section>`,
    `<section class="twocol" aria-labelledby="ruleh">
      <div class="prose">
        <h2 id="ruleh">${esc(t('muhurat.legendH'))}</h2>
        <ol class="legend-list compact">${legend.join('')}</ol>
        <p class="s"><a href="${href(`/${lang}/muhurat/`)}#rules">${esc(t('muhurat.legendMore'))}</a></p>
        <p class="s">${esc(t('muhurat.howComputed'))}</p>
      </div>
      <aside class="sidecard">
        <h2>${esc(t('muhurat.tableH', { activity: name }))}</h2>
        ${fallbackNote(ctx, copy.activity?.lang)}
        ${copy.activity ? `<p>${esc(copy.activity.text)}</p>` : ''}
        <dl class="allowed">${allowed.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
        <p class="s"><strong>${esc(t('muhurat.sources'))}:</strong> ${esc(activity.sources.join('; '))}</p>
        <div class="actions">${playButton(ctx, { primary: false })}</div>
        <p class="note">${esc(t('muhurat.appNote'))}</p>
      </aside>
    </section>`,
    `<section class="section-sub" aria-labelledby="monthsh"><h2 id="monthsh">${esc(t('muhurat.otherMonths', { activity: name }))}</h2><p class="actions">${monthLinks.join(' ')}</p></section>`,
    `<section class="section-sub" aria-labelledby="acth"><h2 id="acth">${esc(t('muhurat.otherActivities', { month }))}</h2><ul class="linklist">${activityLinks.join('')}</ul></section>`,
    `</div>`,
  ]);
  return page(ctx, {
    path,
    rest: `muhurat/${activity.id}/${ym}/`,
    title: `${t('muhurat.pageTitle', { activity: name, month })} · ${t('site.name')}`,
    description: t('muhurat.description', { activity: name, month, count: matches.length, city: cityName(md.city, lang), min: md.minRules, of: md.ruleCount }),
    ogTitle: t('muhurat.pageTitle', { activity: name, month }),
    ogImage: `/og/${lang}/muhurat/${activity.id}.png`,
    jsonLd: [bc.ld],
    current: 'muhurat',
    main,
    inlineCss: false,
    bodyAttrs: pickerBodyAttrs(ctx),
    scripts: [site.scripts.picker],
  });
}

/** /<lang>/muhurat/ — 14 activities, each with its 12 month links and this month's match count. */
export function renderMuhuratIndex(ctx, data) {
  const { lang, t, engine } = ctx;
  const md = data.muhurat;
  const bc = crumbs(ctx, [[t('nav.muhurat'), null]]);
  const cards = md.activities.map((a) => {
    const first = md.months[0];
    const m = md.byActivity.get(a.id).get(first);
    const links = md.months.map((mm) => `<a href="${href(`/${lang}/muhurat/${a.id}/${mm}/`)}">${esc(engine.locale.monthShort[lang][Number(mm.slice(5, 7)) - 1])} ${mm.slice(2, 4)}</a>`);
    return `<div class="card"><h3 class="display"><a href="${href(`/${lang}/muhurat/${a.id}/${first}/`)}">${esc(a.names[lang] ?? a.names.en)}</a></h3><span class="t">${esc(t('muhurat.cardLine', { count: m.matches.length, month: monthLabel(engine, first, lang) }))}</span><div class="months">${links.join('')}</div></div>`;
  });
  const copy = data.muhuratCopy[lang].get(md.activities[0].id);
  const legend = md.ruleOrder.map((r) => {
    const text = copy.rules.find((x) => x.id === r)?.text;
    const personal = PERSONAL_RULES.includes(r);
    return `<li id="rule-${r}"${personal ? ' class="personal"' : ''}><strong>${esc(t(`muhurat.rule.${r}`))}</strong>${personal ? ` <span class="tag">${esc(t('muhurat.personalTag'))}</span>` : ''}${text ? `<span class="s">${esc(text)}</span>` : ''}</li>`;
  });
  const main = `<div class="wrap page">
    ${bc.html}
    <h1 class="display">${esc(t('muhurat.indexH1'))}</h1>
    <p class="lede">${esc(t('muhurat.indexLede', { city: cityName(md.city, lang), from: monthLabel(engine, md.months[0], lang), to: monthLabel(engine, md.months[md.months.length - 1], lang), min: md.minRules, of: md.ruleCount }))}</p>
    <p class="note">${esc(t('muhurat.personalNote'))}</p>
    <div class="grid">${cards.join('\n')}</div>
    <section class="section-sub prose" id="rules" aria-labelledby="ruleh">
      <h2 id="ruleh">${esc(t('muhurat.legendH'))}</h2>
      ${fallbackNote(ctx, copy.rules.find((x) => x.text)?.lang)}
      <ol class="legend-list">${legend.join('')}</ol>
      <p class="s">${esc(t('muhurat.howComputed'))}</p>
    </section>
  </div>`;
  return page(ctx, {
    path: `/${lang}/muhurat/`,
    rest: 'muhurat/',
    title: `${t('muhurat.indexH1')} · ${t('site.name')}`,
    description: t('muhurat.indexDescription', { city: cityName(md.city, lang) }),
    ogImage: `/og/${lang}/site.png`,
    jsonLd: [bc.ld],
    current: 'muhurat',
    main,
    inlineCss: false,
  });
}
