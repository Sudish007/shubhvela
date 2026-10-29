// Data-deletion page required for the Play listing (spec F42, section 10): in-app "Delete everything" steps; no server data.
import { esc } from '../html.mjs';
import { page } from './layout.mjs';

export function renderDataDeletion(ctx) {
  const { lang, t, site } = ctx;
  const main = `<div class="wrap page">
    <div class="prose">
      <h1 class="display">${esc(t('deletion.h1'))}</h1>
      <p class="lede">${esc(t('deletion.intro'))}</p>
      <h2 id="in-app">${esc(t('deletion.inAppH'))}</h2>
      <ol>
        <li>${esc(t('deletion.step1'))}</li>
        <li>${esc(t('deletion.step2'))}</li>
        <li>${esc(t('deletion.step3'))}</li>
      </ol>
      <h2 id="uninstall">${esc(t('deletion.uninstallH'))}</h2>
      <p>${esc(t('deletion.uninstall'))}</p>
      <h2 id="purchases">${esc(t('deletion.purchasesH'))}</h2>
      <p>${esc(t('deletion.purchases'))}</p>
      <h2 id="website">${esc(t('deletion.websiteH'))}</h2>
      <p>${esc(t('deletion.website'))}</p>
      <h2 id="contact">${esc(t('deletion.contactH'))}</h2>
      <p>${esc(t('deletion.contact', { email: site.grievanceEmail, note: t('site.grievanceProvisional') }))}</p>
    </div>
  </div>`;
  return page(ctx, {
    path: `/${lang}/data-deletion/`,
    rest: 'data-deletion/',
    title: t('deletion.title'),
    description: t('deletion.description'),
    ogImage: `/og/${lang}/site.png`,
    main,
  });
}
