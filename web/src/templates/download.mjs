// Download page (spec F42 "download the app" CTA; design.md 10.10). Honest: until the Play listing exists the button
// reads "Coming to Google Play"; the APK is never offered from the site (build-rules HARD rules).
import { href } from '../config.mjs';
import { esc, join } from '../html.mjs';
import { softwareApplicationLd } from '../seo.mjs';
import { intentButton, linkOrNull, page, playButton } from './layout.mjs';

export function renderDownload(ctx) {
  const { lang, t, site } = ctx;
  const kundliHref = href(`/${lang}/kundli/`);
  const panchangHref = linkOrNull(site, `/${lang}/panchang/`);
  const sections = [
    ['download.freeH', 'download.free'],
    ['download.privacyH', 'download.privacy'],
    ['download.requiresH', 'download.requires'],
  ].map(([h, p]) => `<h2>${esc(t(h))}</h2><p>${esc(t(p))}</p>`);
  const main = `<div class="wrap page twocol">
    <div class="prose">
      <h1 class="display">${esc(t('download.h1'))}</h1>
      <p class="lede">${esc(t('download.lede'))}</p>
      <div class="actions">${playButton(ctx)}${intentButton(ctx, { path: 'open' })}</div>
      ${site.playUrl ? '' : `<p class="meta">${esc(t('app.comingNote'))}</p>`}
      ${sections.join('\n')}
      <h2>${esc(t('download.webH'))}</h2>
      <p>${esc(t('download.web'))}</p>
      <ul class="linklist"><li><a href="${kundliHref}">${esc(t('nav.kundli'))}</a></li>${panchangHref ? `<li><a href="${panchangHref}">${esc(t('nav.panchang'))}</a></li>` : ''}</ul>
    </div>
    <aside class="sidecard" aria-label="${esc(t('home.appH2'))}">
      <h2>${esc(t('home.appH2'))}</h2>
      <p>${esc(t('home.appP'))}</p>
      <ul>
        <li>${esc(t('home.appLi1'))}</li>
        <li>${esc(t('home.appLi2'))}</li>
        <li>${esc(t('home.appLi3'))}</li>
      </ul>
    </aside>
  </div>`;
  return page(ctx, {
    path: `/${lang}/download/`,
    rest: 'download/',
    title: t('download.title'),
    description: t('download.description'),
    ogImage: `/og/${lang}/site.png`,
    jsonLd: [softwareApplicationLd({ path: `/${lang}/download/`, description: t('download.description'), playUrl: site.playUrl })],
    current: 'download',
    main: join([main]),
  });
}
