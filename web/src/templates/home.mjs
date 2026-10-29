// Home page (spec F41/F42; design.md 9 hero with facts list + chart + mini panel, 10.10). Every number is engine output
// computed at build time for the build's Asia/Kolkata civil day (data.today); the page prints that date, and
// today-label.js adds "Today" only when the visitor's date matches. Links to section pages exist only when the page
// inventory has them (D02 adds the data pages), so the live site never links to a 404.
import { href } from '../config.mjs';
import { civilDateLong, dateLong, festivalTithiLabel, hm, nakshatraLabel, signName, tithiLabel, windowStr } from '../format.mjs';
import { esc, join } from '../html.mjs';
import { chartSummary, chartSvgFromLayout } from '../chart-svg.mjs';
import { softwareApplicationLd } from '../seo.mjs';
import { intentButton, linkOrNull, page, playButton } from './layout.mjs';

const ICONS = {
  phone: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="2" width="12" height="20" rx="2"/><path d="M10 18h4"/></svg>',
  why: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17h.01"/></svg>',
  list: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h10"/></svg>',
};

function cardOrDiv(hrefOrNull, inner, extraClass = '') {
  if (hrefOrNull) return `<a class="card${extraClass}" href="${hrefOrNull}">${inner}</a>`;
  return `<div class="card${extraClass}">${inner}</div>`;
}

export function renderHome(ctx, data) {
  const { lang, t, site, engine } = ctx;
  const { today, featured, cities, festivals, chartLayouts, counts } = data;
  const tz = today.city.tz;
  const p = today.panchang;
  const cityName = lang === 'en' || !today.city.nameHi ? today.city.name : today.city.nameHi;
  const dateStr = dateLong(engine, p.sunrise, tz, lang);
  const lay = chartLayouts[lang];
  const names = { signs: engine.locale.signNames[lang], planets: engine.locale.planetNames[lang] };
  const summary = chartSummary(lay, names, { house: t('home.chartHouse'), empty: t('home.chartHouseEmpty') });
  const lagna = today.chart.lagna ? signName(engine, today.chart.lagna.sign, lang) : '';
  const style = t('charts.styleNorth');
  const chartSvg = chartSvgFromLayout(lay, {
    mode: 'web',
    lang,
    ariaLabel: t('home.chartA11y', { style, city: cityName, date: dateStr, lagna, summary }),
  });

  const kundliHref = href(`/${lang}/kundli/`);
  const homeCityHref = linkOrNull(site, `/${lang}/panchang/${today.city.slug}/`);
  const panchangIndexHref = linkOrNull(site, `/${lang}/panchang/`);
  const festivalsIndexHref = linkOrNull(site, `/${lang}/festivals/${today.year}/`) ?? linkOrNull(site, `/${lang}/festivals/`);
  const downloadHref = linkOrNull(site, `/${lang}/download/`);

  const miniRows = [
    [t('mini.sunriseSunset'), `${hm(engine, p.sunrise, tz)} · ${hm(engine, p.sunset, tz)}`],
    [t('mini.moonriseMoonset'), `${p.moonrise ? hm(engine, p.moonrise, tz) : t('mini.none')} · ${p.moonset ? hm(engine, p.moonset, tz) : t('mini.none')}`],
    [t('mini.tithi'), t('mini.till', { name: tithiLabel(engine, p.tithi, lang), time: hm(engine, p.tithi.end, tz) })],
    [t('mini.nakshatra'), t('mini.till', { name: nakshatraLabel(engine, p.nakshatra.index, lang), time: hm(engine, p.nakshatra.end, tz) })],
    [t('mini.rahuKaal'), windowStr(engine, p.rahuKaal, tz, t('mini.none'))],
    [t('mini.abhijit'), windowStr(engine, p.abhijit, tz, t('mini.none'))],
    [t('mini.brahma'), windowStr(engine, p.brahmaMorning, tz, t('mini.none'))],
  ];
  const monthLabel = `${engine.locale.lunarMonthNames[lang][p.monthPurnimanta.index]} ${tithiLabel(engine, p.tithi, lang)}`;

  const hero = `<section class="wrap hero">
    <div class="text">
      <h1 class="display">${esc(t('home.h1'))}</h1>
      <p class="lede">${esc(t('home.lede'))}</p>
      <div class="actions">
        <a class="btn btn-primary" href="${kundliHref}">${esc(t('home.ctaKundli'))}</a>
        ${homeCityHref ? `<a class="btn" href="${homeCityHref}">${esc(t('home.ctaPanchang'))}</a>` : ''}
        <a class="btn btn-text" href="#app">${esc(t('home.ctaApp'))}</a>
      </div>
      <ul class="facts" aria-label="${esc(t('home.factsLabel'))}">
        <li>${ICONS.phone}<span><strong>${esc(t('home.fact1Strong'))}</strong> ${esc(t('home.fact1'))}</span></li>
        <li>${ICONS.why}<span><strong>${esc(t('home.fact2Strong'))}</strong> ${esc(t('home.fact2'))}</span></li>
        <li>${ICONS.list}<span><strong>${esc(t('home.fact3Strong'))}</strong> ${esc(t('home.fact3'))}</span></li>
      </ul>
    </div>
    <figure class="hero-chart">
      ${chartSvg}
      <figcaption class="num">${esc(t('home.chartCaption', { city: cityName, date: dateStr, lagna, style }))}</figcaption>
    </figure>
    <aside class="aside" aria-label="${esc(t('mini.ariaLabel', { city: cityName }))}">
      <div class="mini" data-today-date="${esc(p.date)}" data-today-label="${esc(t('mini.today'))}">
        <h3 class="display" data-today-slot>${esc(cityName)}</h3>
        <p class="date num">${esc(dateStr)} · ${esc(monthLabel)}</p>
        ${miniRows.map(([k, v]) => `<div class="kv"><span>${esc(k)}</span><span class="num">${esc(v)}</span></div>`).join('\n        ')}
        ${homeCityHref ? `<a class="btn" href="${homeCityHref}">${esc(t('mini.fullPanchang'))}</a>` : ''}
      </div>
    </aside>
  </section>`;

  const cityCards = featured.map(({ city, panchang: cp }) => {
    const name = lang === 'en' || !city.nameHi ? city.name : city.nameHi;
    const ctz = city.tz;
    const inner = `<h3 class="display">${esc(name)}</h3><span class="t">${esc(t('home.cityTithi', { tithi: tithiLabel(engine, cp.tithi, lang), till: hm(engine, cp.tithi.end, ctz), nakshatra: nakshatraLabel(engine, cp.nakshatra.index, lang) }))}</span><span class="s num">${esc(t('home.cityLine', { sunrise: hm(engine, cp.sunrise, ctz), sunset: hm(engine, cp.sunset, ctz), rahu: windowStr(engine, cp.rahuKaal, ctz, t('mini.none')).replace(' – ', '–') }))}</span>`;
    return cardOrDiv(linkOrNull(site, `/${lang}/panchang/${city.slug}/`), inner);
  });
  const cityList = cities.map((c) => {
    const name = lang === 'en' || !c.nameHi ? c.name : c.nameHi;
    const h = linkOrNull(site, `/${lang}/panchang/${c.slug}/`);
    return `<li>${h ? `<a href="${h}">${esc(name)}</a>` : `<span>${esc(name)}</span>`}</li>`;
  });
  const panchangSection = `<section class="wrap section" aria-labelledby="pan" data-today-date="${esc(p.date)}" data-today-label="${esc(t('mini.today'))}">
    <div class="section-head">
      <h2 id="pan" class="display" data-today-slot>${esc(t('home.panchangH2'))}</h2>
      <p>${esc(t('home.panchangIntro'))} <span class="num">(${esc(dateStr)})</span></p>
    </div>
    <div class="grid">
      ${cityCards.join('\n      ')}
    </div>
    <details class="more">
      <summary class="btn section-foot">${esc(t('home.allCities'))}</summary>
      ${panchangIndexHref ? '' : `<p class="note">${esc(t('home.cityPagesSoon'))}</p>`}
      <ul class="citylist">${cityList.join('')}</ul>
    </details>
  </section>`;

  const features = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => `<div class="card feature"><span class="f">${esc(t(`home.feature${n}Label`))}</span><h3>${esc(t(`home.feature${n}H`))}</h3><p>${esc(t(`home.feature${n}P`, counts))}</p></div>`);
  const featuresSection = `<section class="wrap section" aria-labelledby="inside">
    <div class="section-head">
      <h2 id="inside" class="display">${esc(t('home.featuresH2'))}</h2>
      <p>${esc(t('home.featuresIntro'))}</p>
    </div>
    <div class="grid">
      ${features.join('\n      ')}
    </div>
  </section>`;

  const festCards = festivals.map((occ) => {
    const year = occ.date.slice(0, 4);
    const tithiText = festivalTithiLabel(engine, occ.tithiText, lang);
    const line = tithiText ? t('home.festivalLine', { tithi: tithiText, region: t('home.festivalRegionNorth') }) : t('home.festivalSolar', { region: t('home.festivalRegionNorth') });
    const inner = `<span class="s num">${esc(civilDateLong(engine, occ.date, lang))}</span><h3 class="display">${esc(occ.names[lang])}</h3><span class="t">${esc(line)}</span>`;
    return cardOrDiv(linkOrNull(site, `/${lang}/festival/${occ.slug}/${year}/`), inner);
  });
  const festivalsSection = `<section class="wrap section" aria-labelledby="fest">
    <div class="section-head">
      <h2 id="fest" class="display">${esc(t('home.festivalsH2'))}</h2>
      <p>${esc(t('home.festivalsIntro', { years: `${today.year}, ${today.year + 1}, ${today.year + 2}` }))}</p>
    </div>
    <div class="grid">
      ${festCards.join('\n      ')}
    </div>
    ${festivalsIndexHref ? `<p class="section-foot"><a class="btn" href="${festivalsIndexHref}">${esc(t('home.allFestivals', { year: today.year }))}</a></p>` : `<p class="note">${esc(t('home.festivalPagesSoon'))}</p>`}
  </section>`;

  const appSection = `<section class="wrap section" id="app" aria-labelledby="dl">
    <div class="band">
      <div>
        <h2 id="dl" class="display">${esc(t('home.appH2'))}</h2>
        <p>${esc(t('home.appP'))}</p>
        <ul>
          <li>${esc(t('home.appLi1'))}</li>
          <li>${esc(t('home.appLi2'))}</li>
          <li>${esc(t('home.appLi3'))}</li>
        </ul>
        ${site.playUrl ? '' : `<p class="note">${esc(t('app.comingNote'))}</p>`}
      </div>
      <div class="actions">
        ${playButton(ctx)}
        ${intentButton(ctx, { path: 'open' })}
        ${downloadHref ? `<a class="btn btn-text" href="${downloadHref}">${esc(t('nav.download'))}</a>` : ''}
      </div>
    </div>
  </section>`;

  const main = join([hero, panchangSection, featuresSection, festivalsSection, appSection]);
  return page(ctx, {
    path: `/${lang}/`,
    rest: '',
    title: t('home.title'),
    description: t('home.description', counts),
    ogTitle: t('home.ogTitle'),
    ogDescription: t('home.ogDescription'),
    ogImage: `/og/${lang}/site.png`,
    jsonLd: [softwareApplicationLd({ path: `/${lang}/`, description: t('home.ogDescription'), playUrl: site.playUrl })],
    main,
    chartScale: true,
    scripts: [site.scripts.todayLabel],
  });
}
