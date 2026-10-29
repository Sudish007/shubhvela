// Panchang pages (spec F42; design.md 9 page set, 10.10; FEAT-D02): /<lang>/panchang/<city>/ = the current month's
// table with the build day's card (full panchang, the merged good-hours band, the 13 day segments, flags) and
// /<lang>/panchang/<city>/<yyyy-mm>/ = the next month's table. The page always prints the computed date; today-mark.js
// only highlights the row / adds the word "Today" when the visitor's date in the city's zone matches (D8: a stale build
// never claims to be today). Also /<lang>/panchang/ (331 cities by country).
import { href } from '../config.mjs';
import { esc, join } from '../html.mjs';
import { civilDateLong, hm, nakshatraLabel, range, signName, timeOrDayTime, tithiLabel, weekdayName, windowStr } from '../format.mjs';
import { bandA11yText, bandSvg, flagSentences, segmentLabel } from '../band-svg.mjs';
import { cityLine, cityName, countryGroups, siblingCities } from '../data/cities.mjs';
import { monthLabel } from '../data/panchang.mjs';
import { crumbs, kvRows, panchangComputed } from './parts.mjs';
import { page } from './layout.mjs';

function monthTable(ctx, rows, tz, { id, caption }) {
  const { lang, t, engine } = ctx;
  const head = [t('panchang.col.date'), t('panchang.tithi'), t('panchang.nakshatra'), t('panchang.col.sunrise'), t('panchang.col.sunset'), t('panchang.col.moonrise'), t('mini.rahuKaal')];
  const body = rows.map((r) => {
    const d = Number(r.date.slice(8, 10));
    const date = `${engine.locale.weekdayShort[lang][r.vara]} ${d}`;
    if (r.noSun) return `<tr data-date="${r.date}"><th scope="row">${esc(date)}</th><td colspan="6">${esc(t('today.noSun'))}</td></tr>`;
    const cells = [
      t('mini.till', { name: tithiLabel(engine, r.tithi, lang), time: timeOrDayTime(engine, r.tithi.end, tz, lang, r.date) }),
      t('mini.till', { name: nakshatraLabel(engine, r.nakshatra.index, lang), time: timeOrDayTime(engine, r.nakshatra.end, tz, lang, r.date) }),
      hm(engine, r.sunrise, tz),
      hm(engine, r.sunset, tz),
      r.moonrise !== null ? timeOrDayTime(engine, r.moonrise, tz, lang, r.date) : t('mini.none'),
      windowStr(engine, r.rahuKaal, tz, t('mini.none')).replace(' – ', '–'),
    ];
    return `<tr data-date="${r.date}"><th scope="row">${esc(date)}</th>${cells.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`;
  });
  return `<div class="tscroll"><table id="${id}" class="month num" data-today-tz="${esc(tz)}" data-today-label="${esc(t('mini.today'))}">
      <caption>${esc(caption)}</caption>
      <thead><tr>${head.map((h) => `<th scope="col">${esc(h)}</th>`).join('')}</tr></thead>
      <tbody>${body.join('\n')}</tbody>
    </table></div>`;
}

function moonTable(ctx, rows, tz) {
  const { lang, t, engine } = ctx;
  const body = rows.map((r) => {
    const d = Number(r.date.slice(8, 10));
    const date = `${engine.locale.weekdayShort[lang][r.vara]} ${d}`;
    const rise = r.moonrise !== null ? timeOrDayTime(engine, r.moonrise, tz, lang, r.date) : t('mini.none');
    const set = r.moonset !== null ? timeOrDayTime(engine, r.moonset, tz, lang, r.date) : t('mini.none');
    return `<tr><th scope="row">${esc(date)}</th><td>${esc(rise)}</td><td>${esc(set)}</td></tr>`;
  });
  return `<div class="tscroll tscroll-narrow"><table class="moon num">
      <caption>${esc(t('panchang.moonTableCaption'))}</caption>
      <thead><tr><th scope="col">${esc(t('panchang.col.date'))}</th><th scope="col">${esc(t('panchang.col.moonrise'))}</th><th scope="col">${esc(t('panchang.col.moonset'))}</th></tr></thead>
      <tbody>${body.join('\n')}</tbody>
    </table></div>`;
}

/** The 13 day segments (12 daylight rows + Brahma muhurat) with the engine's verdict chip and override/lift notes. */
function segmentsTable(ctx, gh) {
  const { lang, t, engine } = ctx;
  const tz = gh.tz;
  const segs = gh.segments.filter((s) => !s.night || s.name === 'brahma-muhurat').sort((a, b) => a.start - b.start);
  const byId = new Map(gh.segments.map((s) => [s.id, s]));
  const rows = segs.map((s) => {
    const notes = [];
    if (s.overriddenBy?.length) notes.push(t('today.overriddenBy', { name: s.overriddenBy.map((id) => segmentLabel(t, byId.get(id) ?? { name: id })).join(', ') }));
    for (const p of s.parts ?? []) {
      if (p.kind === 'lifted') notes.push(t('today.liftedBy', { from: hm(engine, p.start, tz), to: hm(engine, p.end, tz), name: p.by.map((id) => segmentLabel(t, byId.get(id) ?? { name: id })).join(', ') }));
    }
    for (const id of s.includes ?? []) {
      const inc = byId.get(id);
      if (inc) notes.push(t('today.includes', { name: segmentLabel(t, inc), from: hm(engine, inc.start, tz), to: hm(engine, inc.end, tz) }));
    }
    const when = s.night ? `${timeOrDayTime(engine, s.start, tz, lang, gh.day)}–${hm(engine, s.end, tz)}` : range(engine, s.start, s.end, tz);
    return `<tr><th scope="row">${esc(segmentLabel(t, s))}${notes.length ? `<span class="s">${esc(notes.join(' · '))}</span>` : ''}</th><td class="num">${esc(when)}</td><td><span class="tag tag-${s.verdict}">${esc(t(`verdict.${s.verdict}_tag`))}</span></td></tr>`;
  });
  return `<div class="tscroll"><table class="segments">
      <caption>${esc(t('today.daySegments', { count: segs.length }))}</caption>
      <thead><tr><th scope="col">${esc(t('today.segment'))}</th><th scope="col">${esc(t('today.timeRange'))}</th><th scope="col">${esc(t('panchang.col.verdict'))}</th></tr></thead>
      <tbody>${rows.join('\n')}</tbody>
    </table></div>`;
}

function todayCard(ctx, city, today) {
  const { lang, t, engine } = ctx;
  const p = today.panchang;
  const gh = today.gh;
  const tz = city.tz;
  const dateStr = civilDateLong(engine, today.date, lang);
  if (p.noSun || p.sunrise === null) {
    return `<section class="panel today" data-today-date="${esc(today.date)}" data-today-tz="${esc(tz)}" data-today-label="${esc(t('mini.today'))}" aria-labelledby="todayh">
      <h2 id="todayh" class="display" data-today-slot>${esc(dateStr)}</h2><p>${esc(t('today.noSun'))}</p></section>`;
  }
  const monthLine = p.monthPurnimanta.index === p.monthAmanta.index
    ? t('panchang.monthBoth', { month: engine.locale.lunarMonthNames[lang][p.monthPurnimanta.index] })
    : t('panchang.monthSplit', { purnimanta: engine.locale.lunarMonthNames[lang][p.monthPurnimanta.index], amanta: engine.locale.lunarMonthNames[lang][p.monthAmanta.index] });
  const yogaName = engine.locale.yogaNames[lang][p.yoga.index];
  const karanaName = engine.locale.karanaNames[lang][p.karana.index];
  const rows = [
    [t('panchang.sunriseSunset'), `${hm(engine, p.sunrise, tz)} · ${hm(engine, p.sunset, tz)}`],
    [t('panchang.moonriseMoonset'), `${p.moonrise !== null ? timeOrDayTime(engine, p.moonrise, tz, lang, today.date) : t('mini.none')} · ${p.moonset !== null ? timeOrDayTime(engine, p.moonset, tz, lang, today.date) : t('mini.none')}`],
    [t('panchang.tithi'), t('mini.till', { name: tithiLabel(engine, p.tithi, lang), time: timeOrDayTime(engine, p.tithi.end, tz, lang, today.date) })],
    [t('panchang.nakshatra'), t('mini.till', { name: `${nakshatraLabel(engine, p.nakshatra.index, lang)} ${p.nakshatra.pada}`, time: timeOrDayTime(engine, p.nakshatra.end, tz, lang, today.date) })],
    [t('panchang.yoga'), t('mini.till', { name: yogaName, time: timeOrDayTime(engine, p.yoga.end, tz, lang, today.date) })],
    [t('panchang.karana'), t('mini.till', { name: p.karana.bhadra ? t('panchang.vishtiBhadra') : karanaName, time: timeOrDayTime(engine, p.karana.end, tz, lang, today.date) })],
    [t('panchang.sunMoon'), `${signName(engine, p.sunSign + 1, lang)} · ${signName(engine, p.moonSign + 1, lang)}`],
    [t('mini.rahuKaal'), windowStr(engine, p.rahuKaal, tz, t('mini.none'))],
    [t('panchang.col.yamaganda'), windowStr(engine, p.yamaganda, tz, t('mini.none'))],
    [t('panchang.col.gulika'), windowStr(engine, p.gulika, tz, t('mini.none'))],
    [t('mini.abhijit'), windowStr(engine, p.abhijit, tz, t('mini.none'))],
    [t('mini.brahma'), windowStr(engine, p.brahmaMorning, tz, t('mini.none'))],
    [t('panchang.samvat'), `${t('panchang.vikram', { year: p.vikramSamvat })} · ${t('panchang.shaka', { year: p.shakaSamvat })}`],
    [t('panchang.month'), monthLine],
    [t('panchang.dishaShool'), t('panchang.dishaShoolValue', { direction: t(`panchang.direction.${p.dishaShool.avoid}`) })],
  ];
  const flags = flagSentences(engine, gh, t, lang);
  const flagsLine = flags.length ? `${t('today.flags')} · ${flags.join(' · ')}` : t('today.noFlags');
  const band = gh.ticks
    ? bandSvg(engine, gh, { mode: 'web', t, lang, id: 'tb', ariaLabel: bandA11yText(engine, gh, t, flags.length ? flags.join(' · ') : null) })
    : '';
  const legend = ['good', 'neutral', 'avoid']
    .map((v) => `<span class="lg"><i class="sw sw-${v}"></i>${esc(t(`verdict.${v}`))}</span>`)
    .concat(`<span class="lg"><i class="sw sw-night"></i>${esc(t('band.nightLegend'))}</span>`)
    .join('');
  return `<section class="panel today" data-today-date="${esc(today.date)}" data-today-tz="${esc(tz)}" data-today-label="${esc(t('mini.today'))}" aria-labelledby="todayh">
      <div class="rhead"><div><h2 id="todayh" class="display" data-today-slot>${esc(dateStr)}</h2><p class="num">${esc(t('panchang.header', { date: engine.locale.weekdayNames[lang][p.vara], place: cityName(city, lang), sunrise: hm(engine, p.sunrise, tz) }))}</p></div></div>
      <div class="today-grid">
        <div class="kvs">${kvRows(rows)}</div>
        <div class="bandcol">
          <h3>${esc(t('panchang.bandH'))}</h3>
          <figure class="band-fig">${band}<figcaption class="legend">${legend}</figcaption></figure>
          <p class="flags">${esc(flagsLine)}</p>
          ${segmentsTable(ctx, gh)}
          <p class="note">${esc(t('panchang.segmentsNote'))}</p>
        </div>
      </div>
    </section>`;
}

function siblingsBlock(ctx, city, cities) {
  const { lang, t } = ctx;
  const sibs = siblingCities(city, cities, 8).filter((c) => ctx.site.has(`/${lang}/panchang/${c.slug}/`));
  if (!sibs.length) return '';
  return `<section class="section-sub" aria-labelledby="sibh">
      <h2 id="sibh">${esc(t('panchang.nearby'))}</h2>
      <ul class="linklist">${sibs.map((c) => `<li><a href="${href(`/${lang}/panchang/${c.slug}/`)}">${esc(cityName(c, lang))}</a></li>`).join('')}</ul>
    </section>`;
}

/** /<lang>/panchang/<city>/ (current month + today) and /<lang>/panchang/<city>/<yyyy-mm>/ (next month). */
export function renderPanchangCity(ctx, data, { city, ym, isCurrent }) {
  const { lang, t, engine, site } = ctx;
  const cd = data.panchang.get(city.slug);
  const rows = cd.months[ym];
  const tz = city.tz;
  const name = cityName(city, lang);
  const month = monthLabel(engine, ym, lang);
  const title = t('panchang.pageTitle', { city: name, month });
  const path = isCurrent ? `/${lang}/panchang/${city.slug}/` : `/${lang}/panchang/${city.slug}/${ym}/`;
  const rest = isCurrent ? `panchang/${city.slug}/` : `panchang/${city.slug}/${ym}/`;
  const otherPath = isCurrent ? `/${lang}/panchang/${city.slug}/${data.calendar.nextMonth}/` : `/${lang}/panchang/${city.slug}/`;
  const otherLabel = isCurrent ? t('panchang.nextMonth', { month: monthLabel(engine, data.calendar.nextMonth, lang) }) : t('panchang.currentMonth', { month: monthLabel(engine, data.calendar.currentMonth, lang) });
  const bc = crumbs(ctx, [[t('nav.panchang'), `/${lang}/panchang/`], ...(isCurrent ? [[name, null]] : [[name, `/${lang}/panchang/${city.slug}/`], [month, null]])]);
  const first = rows[0];
  const last = rows[rows.length - 1];
  const sun = first && !first.noSun ? t('panchang.monthIntro', { from: hm(engine, first.sunrise, tz), to: hm(engine, last.sunrise, tz), tz }) : '';
  const description = isCurrent
    ? t('panchang.descriptionCurrent', { city: name, month, country: cityLine(city, lang, t) })
    : t('panchang.descriptionMonth', { city: name, month });
  const main = join([
    `<div class="wrap page">`,
    bc.html,
    `<h1 class="display">${esc(title)}</h1>`,
    `<p class="lede">${esc(cityLine(city, lang, t))} · <span class="num">${esc(`${city.lat.toFixed(2)}°, ${city.lon.toFixed(2)}°`)}</span> · ${esc(tz)}</p>`,
    `<p class="note">${esc(t('panchang.intro'))}</p>`,
    isCurrent ? todayCard(ctx, city, cd.today) : '',
    `<section class="section-sub" aria-labelledby="monthh">
      <div class="section-head"><h2 id="monthh">${esc(t('panchang.monthH', { month }))}</h2>${sun ? `<p class="num">${esc(sun)}</p>` : ''}</div>
      ${monthTable(ctx, rows, tz, { id: 'month', caption: t('panchang.monthCaption', { city: name, month }) })}
      <p class="section-foot">${site.has(otherPath) ? `<a class="btn" href="${href(otherPath)}">${esc(otherLabel)}</a>` : ''}</p>
    </section>`,
    `<section class="section-sub" aria-labelledby="moonh">
      <h2 id="moonh">${esc(t('panchang.moonH', { month }))}</h2>
      <p class="note">${esc(t('panchang.moonNote'))}</p>
      ${moonTable(ctx, rows, tz)}
    </section>`,
    siblingsBlock(ctx, city, data.cities),
    panchangComputed(ctx, { tz }),
    `</div>`,
  ]);
  return page(ctx, {
    path,
    rest,
    title: `${title} · ${t('site.name')}`,
    description,
    ogImage: `/og/${lang}/panchang/${city.slug}.png`,
    jsonLd: [bc.ld],
    current: 'panchang',
    main,
    inlineCss: false,
    scripts: [site.scripts.todayMark],
  });
}

/** /<lang>/panchang/ — the 331 cities by country. */
export function renderPanchangIndex(ctx, data) {
  const { lang, t, engine } = ctx;
  const groups = countryGroups(data.cities, lang, t);
  const month = monthLabel(engine, data.calendar.currentMonth, lang);
  const bc = crumbs(ctx, [[t('nav.panchang'), null]]);
  const sections = groups.map((g, i) => `<section aria-labelledby="g${i}"><h2 id="g${i}">${esc(g.name)} <span class="count num">${g.cities.length}</span></h2>
      <ul class="citylist">${g.cities.map((c) => `<li><a href="${href(`/${lang}/panchang/${c.slug}/`)}">${esc(cityName(c, lang))}</a></li>`).join('')}</ul></section>`);
  const main = `<div class="wrap page">
    ${bc.html}
    <h1 class="display">${esc(t('panchang.indexH1'))}</h1>
    <p class="lede">${esc(t('panchang.indexLede', { month, next: monthLabel(engine, data.calendar.nextMonth, lang) }))}</p>
    ${sections.join('\n')}
  </div>`;
  return page(ctx, {
    path: `/${lang}/panchang/`,
    rest: 'panchang/',
    title: `${t('panchang.indexTitle')} · ${t('site.name')}`,
    description: t('panchang.indexDescription', { month }),
    ogImage: `/og/${lang}/site.png`,
    jsonLd: [bc.ld],
    current: 'panchang',
    main,
    inlineCss: false,
  });
}
