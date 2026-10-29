// Festival pages (spec F23/F42/F43; design.md 9, 10.10; FEAT-D02): /<lang>/festival/<slug>/<year>/ with the engine's
// date for the Purnimanta system (north, New Delhi) and the Amanta system (south, Chennai), the tithi rule, the puja
// window when the rule has one, sunrise/moonrise at the picked city (static for New Delhi; the data bundle recomputes
// for the ?city= pick), "What to do" from corpus/festivals, the share image (= this page's OG image), the Android-only
// app button, the honest verification footer and Event JSON-LD. Also /<lang>/festivals/ and /<lang>/festivals/<year>/.
import { href, absUrl } from '../config.mjs';
import { esc, join } from '../html.mjs';
import { civilDateLong, festivalTithiLabel, hm, range, timeOrDayTime } from '../format.mjs';
import { cityName } from '../data/cities.mjs';
import { eventLd } from '../seo.mjs';
import { dayTimesRows } from '../rows.mjs';
import { crumbs, cityPicker, fallbackNote, kvRows, pickerBodyAttrs, panchangComputed } from './parts.mjs';
import { intentButton, page, playButton } from './layout.mjs';
import { DATA_CLIENT_KEYS } from '../client-keys.mjs';

/** One tradition's block: date (and span end), repeats in the year, tithi line, puja window, sunrise/moonrise at the place. */
function traditionBlock(ctx, { label, place, occs, times, entry }) {
  const { lang, t, engine } = ctx;
  const regionLabel = `${label} · ${cityName(place.city, lang)}`;
  if (!occs.length) {
    return `<div class="panel tradition"><h2>${esc(regionLabel)}</h2><p class="empty">${esc(t('festival.notInSystem', { year: entry.year }))}</p></div>`;
  }
  const o = occs[0];
  const tz = place.tz;
  const others = occs.slice(1).map((x) => civilDateLong(engine, x.date, lang));
  const tithiText = festivalTithiLabel(engine, o.tithiText, lang);
  const rows = [
    tithiText ? [t('panchang.tithi'), tithiText] : null,
    o.sankranti ? [t('calendar.sankranti'), timeOrDayTime(engine, o.sankranti, tz, lang, o.date)] : null,
    o.span && o.tithiText ? [t('vrat.tithiEnds'), timeOrDayTime(engine, o.span.end, tz, lang, o.date)] : null,
    o.window ? [t('calendar.pujaWindowLabel'), range(engine, o.window.start, o.window.end, tz)] : null,
    o.bhadra?.length ? [t('panchang.vishtiBhadra'), o.bhadra.map((b) => range(engine, b.start, b.end, tz)).join(', ')] : null,
    times && !times.noSun ? [t('panchang.sunriseSunset'), `${hm(engine, times.sunrise, tz)} · ${hm(engine, times.sunset, tz)}`] : null,
    times && !times.noSun ? [t('panchang.col.moonrise'), times.moonrise !== null ? timeOrDayTime(engine, times.moonrise, tz, lang, o.date) : t('mini.none')] : null,
    [t('calendar.convention'), o.convention],
  ];
  return `<div class="panel tradition">
      <h2>${esc(regionLabel)}</h2>
      <p class="big num">${esc(civilDateLong(engine, o.date, lang))}</p>
      ${o.end && o.end !== o.date ? `<p class="through">${esc(t('calendar.spanThrough', { date: civilDateLong(engine, o.end, lang) }))}</p>` : ''}
      ${others.length ? `<p class="s">${esc(t('calendar.alsoOn', { dates: others.join(', ') }))}</p>` : ''}
      ${o.bhadra?.length ? `<span class="tag">${esc(t('calendar.bhadraMoved'))}</span>` : ''}
      <div class="kvs">${kvRows(rows)}</div>
    </div>`;
}

export function renderFestival(ctx, data, { entry }) {
  const { lang, t, engine, site } = ctx;
  const fd = data.festivals;
  const year = entry.year;
  const name = entry.names[lang] ?? entry.names.en;
  const primary = entry.primary;
  const primaryPlace = entry.north.length ? fd.north : fd.south;
  const times = data.festivalTimes.get(`${primaryPlace.city.slug}|${primary.date}`);
  const copy = data.festivalCopy[lang].get(entry.slug);
  const path = `/${lang}/festival/${entry.slug}/${year}/`;
  const ogImage = `/og/${lang}/festival/${entry.slug}-${year}.png`;
  const bc = crumbs(ctx, [[t('nav.festivals'), `/${lang}/festivals/`], [String(year), `/${lang}/festivals/${year}/`], [name, null]]);
  const dateLine = [
    entry.north.length ? t('festival.dateLine', { system: t('panchang.purnimanta'), date: civilDateLong(engine, entry.north[0].date, lang) }) : null,
    entry.south.length ? t('festival.dateLine', { system: t('panchang.amanta'), date: civilDateLong(engine, entry.south[0].date, lang) }) : null,
  ].filter(Boolean);
  const description = t('festival.description', { name, year, dates: dateLine.join('; '), city: cityName(primaryPlace.city, lang) });
  const what = copy?.what ?? t('calendar.noText');
  const verification = engine.festivalVerification(entry.slug, year, entry.north.length ? 'purnimanta' : 'amanta', primary.date);
  const verifiedText = verification ? t('calendar.verifiedAgainst', { date: civilDateLong(engine, verification.fetchedAt, lang) }) : t('calendar.notVerified');
  const otherYears = fd.years.filter((y) => y !== year && fd.byYear.get(y)?.has(entry.slug)).map((y) => [String(y), href(`/${lang}/festival/${entry.slug}/${y}/`)]);
  const cfg = { kind: 'festival', lang, date: primary.date, slug: entry.slug, year, defaultCity: primaryPlace.city.slug };
  const ld = eventLd({
    name: `${name} ${year}`,
    startDate: primary.date,
    endDate: primary.end && primary.end !== primary.date ? primary.end : undefined,
    description: what.length > 300 ? `${what.slice(0, 297).trimEnd()}…` : what,
    url: absUrl(path),
    locationName: `${primaryPlace.city.name}, ${primaryPlace.city.countryName}`,
    lang,
  });
  ld.image = absUrl(ogImage);
  const main = join([
    `<div class="wrap page">`,
    bc.html,
    `<h1 class="display">${esc(name)} <span class="num">${year}</span></h1>`,
    `<p class="lede">${esc(dateLine.join(' · '))}</p>`,
    `<div class="twocol-eq">
      ${traditionBlock(ctx, { label: `${t('panchang.purnimanta')} · ${t('calendar.regionNorth')}`, place: fd.north, occs: entry.north, times: entry.north.length ? data.festivalTimes.get(`${fd.north.city.slug}|${entry.north[0].date}`) : null, entry })}
      ${traditionBlock(ctx, { label: `${t('panchang.amanta')} · ${t('calendar.regionSouth')}`, place: fd.south, occs: entry.south, times: entry.south.length ? data.festivalTimes.get(`${fd.south.city.slug}|${entry.south[0].date}`) : null, entry })}
    </div>`,
    `<section class="panel pick" aria-labelledby="pickh">
      <h2 id="pickh">${esc(t('festival.pickH'))}</h2>
      <p class="s">${esc(t('festival.pickIntro', { date: civilDateLong(engine, primary.date, lang) }))}</p>
      ${cityPicker(ctx, { cities: data.cities, selected: primaryPlace.city, cfg, i18n: t.pick(DATA_CLIENT_KEYS.festival) })}
      <div class="kvs" id="pick-out" data-date="${esc(primary.date)}">${dayTimesRows(engine, t, lang, { cityLabel: cityName(primaryPlace.city, lang), date: primary.date, p: times, tz: primaryPlace.tz })}</div>
    </section>`,
    `<section class="prose" aria-labelledby="whath">
      <h2 id="whath">${esc(t('vrat.whatToDo'))}</h2>
      ${fallbackNote(ctx, copy?.lang)}
      <p>${esc(what)}</p>
      ${copy?.rule ? `<p class="s"><strong>${esc(t('calendar.ruleLabel'))}:</strong> ${esc(copy.rule)}</p>` : ''}
      ${copy?.conventionNote ? `<p class="s">${esc(copy.conventionNote)}</p>` : ''}
    </section>`,
    `<section class="panel share-img" aria-labelledby="shareh">
      <h2 id="shareh">${esc(t('festival.shareH'))}</h2>
      <img src="${href(ogImage)}" width="1200" height="630" alt="${esc(t('festival.shareAlt', { name, year }))}" loading="lazy">
      <div class="actions">
        <a class="btn" href="${href(ogImage)}" download="${esc(`shubhvela-${entry.slug}-${year}-${lang}.png`)}">${esc(t('festival.shareDownload'))}</a>
        ${intentButton(ctx, { path: 'festival', query: `slug=${encodeURIComponent(entry.slug)}&year=${year}`, label: t('festival.openInApp') })}
        ${playButton(ctx, { primary: false })}
      </div>
      <p class="note">${esc(t('festival.appNote'))}</p>
    </section>`,
    `<p class="verified ${verification ? 'ok' : ''}">${esc(verifiedText)}</p>`,
    otherYears.length ? `<p class="years">${esc(t('festival.otherYears'))} ${otherYears.map(([y, h]) => `<a class="btn" href="${h}">${esc(name)} ${y}</a>`).join(' ')}</p>` : '',
    panchangComputed(ctx, { tz: primaryPlace.tz }),
    `</div>`,
  ]);
  return page(ctx, {
    path,
    rest: `festival/${entry.slug}/${year}/`,
    title: `${name} ${year} · ${t('festival.titleSuffix')}`,
    description,
    ogTitle: `${name} ${year}`,
    ogDescription: dateLine.join(' · '),
    ogImage,
    jsonLd: [ld, bc.ld],
    current: 'festivals',
    main,
    inlineCss: false,
    bodyAttrs: pickerBodyAttrs(ctx),
    scripts: [site.scripts.picker],
  });
}

/** /<lang>/festivals/<year>/ — every festival of the year in date order with both systems' dates. */
export function renderFestivalsYear(ctx, data, { year }) {
  const { lang, t, engine } = ctx;
  const fd = data.festivals;
  const entries = [...fd.byYear.get(year).values()];
  const bc = crumbs(ctx, [[t('nav.festivals'), `/${lang}/festivals/`], [String(year), null]]);
  const rows = entries.map((e) => {
    const n = e.north[0] ? civilDateLong(engine, e.north[0].date, lang) : t('mini.none');
    const s = e.south[0] ? civilDateLong(engine, e.south[0].date, lang) : t('mini.none');
    return `<tr><th scope="row"><a href="${href(`/${lang}/festival/${e.slug}/${year}/`)}">${esc(e.names[lang] ?? e.names.en)}</a></th><td class="num">${esc(n)}</td><td class="num">${esc(s)}</td></tr>`;
  });
  const others = fd.years.filter((y) => y !== year).map((y) => `<a class="btn" href="${href(`/${lang}/festivals/${y}/`)}">${y}</a>`);
  const main = `<div class="wrap page">
    ${bc.html}
    <h1 class="display">${esc(t('festival.yearH1', { year }))}</h1>
    <p class="lede">${esc(t('festival.yearLede', { count: entries.length, year, north: cityName(fd.north.city, lang), south: cityName(fd.south.city, lang) }))}</p>
    <p class="actions">${others.join(' ')}</p>
    <div class="tscroll"><table class="festivals">
      <thead><tr><th scope="col">${esc(t('calendar.festival'))}</th><th scope="col">${esc(`${t('panchang.purnimanta')} · ${t('calendar.regionNorth')}`)}</th><th scope="col">${esc(`${t('panchang.amanta')} · ${t('calendar.regionSouth')}`)}</th></tr></thead>
      <tbody>${rows.join('\n')}</tbody>
    </table></div>
    <p class="note">${esc(t('festival.yearNote'))}</p>
  </div>`;
  return page(ctx, {
    path: `/${lang}/festivals/${year}/`,
    rest: `festivals/${year}/`,
    title: `${t('festival.yearH1', { year })} · ${t('site.name')}`,
    description: t('festival.yearDescription', { year, count: entries.length }),
    ogImage: `/og/${lang}/site.png`,
    jsonLd: [bc.ld],
    current: 'festivals',
    main,
    inlineCss: false,
  });
}

/** /<lang>/festivals/ — the years side by side (one row per festival). */
export function renderFestivalsIndex(ctx, data) {
  const { lang, t, engine } = ctx;
  const fd = data.festivals;
  const bc = crumbs(ctx, [[t('nav.festivals'), null]]);
  const slugs = new Map();
  for (const y of fd.years) for (const e of fd.byYear.get(y).values()) if (!slugs.has(e.slug)) slugs.set(e.slug, e);
  const list = [...slugs.values()].sort((a, b) => a.sortDate.slice(5).localeCompare(b.sortDate.slice(5)));
  const rows = list.map((e) => {
    const cells = fd.years.map((y) => {
      const ey = fd.byYear.get(y).get(e.slug);
      if (!ey) return `<td class="num">${esc(t('mini.none'))}</td>`;
      return `<td class="num"><a href="${href(`/${lang}/festival/${e.slug}/${y}/`)}">${esc(civilDateLong(engine, ey.primary.date, lang))}</a></td>`;
    });
    return `<tr><th scope="row">${esc(e.names[lang] ?? e.names.en)}</th>${cells.join('')}</tr>`;
  });
  const main = `<div class="wrap page">
    ${bc.html}
    <h1 class="display">${esc(t('festival.indexH1'))}</h1>
    <p class="lede">${esc(t('festival.indexLede', { years: fd.years.join(', '), count: list.length }))}</p>
    <p class="actions">${fd.years.map((y) => `<a class="btn" href="${href(`/${lang}/festivals/${y}/`)}">${esc(t('festival.yearH1', { year: y }))}</a>`).join(' ')}</p>
    <div class="tscroll"><table class="festivals">
      <thead><tr><th scope="col">${esc(t('calendar.festival'))}</th>${fd.years.map((y) => `<th scope="col" class="num">${y}</th>`).join('')}</tr></thead>
      <tbody>${rows.join('\n')}</tbody>
    </table></div>
    <p class="note">${esc(t('festival.indexNote', { north: cityName(fd.north.city, lang), south: cityName(fd.south.city, lang) }))}</p>
  </div>`;
  return page(ctx, {
    path: `/${lang}/festivals/`,
    rest: 'festivals/',
    title: `${t('festival.indexH1')} · ${t('site.name')}`,
    description: t('festival.indexDescription', { years: fd.years.join(', ') }),
    ogImage: `/og/${lang}/site.png`,
    jsonLd: [bc.ld],
    current: 'festivals',
    main,
    inlineCss: false,
  });
}
