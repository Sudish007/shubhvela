// Privacy policy (spec section 10 DPDP notice; design.md 10.10): what is stored, where, the one case data leaves the phone
// (Nominatim), ads on the free tier, Play Billing, this website, how to delete, grievance contact (placeholder flagged
// provisional until the owner confirms it, docs/OWNER-TODO.md item 8), incidents, open source.
import { SOURCE_URL } from '../config.mjs';
import { esc } from '../html.mjs';
import { page } from './layout.mjs';

export function renderPrivacy(ctx, data) {
  const { lang, t, site } = ctx;
  const grievance = t('privacy.grievance', { email: site.grievanceEmail, note: t('site.grievanceProvisional') });
  const sections = [
    ['privacy.storedH', t('privacy.stored')],
    ['privacy.leavesH', t('privacy.leaves')],
    ['privacy.adsH', t('privacy.ads')],
    ['privacy.billingH', t('privacy.billing')],
    ['privacy.websiteH', t('privacy.website')],
    ['privacy.deleteH', t('privacy.delete')],
    ['privacy.grievanceH', grievance],
    ['privacy.incidentH', t('privacy.incident')],
  ];
  const main = `<div class="wrap page">
    <div class="prose">
      <h1 class="display">${esc(t('privacy.h1'))}</h1>
      <p class="meta">${esc(t('privacy.updated', { date: data.buildDate[lang] }))}</p>
      <p class="lede">${esc(t('privacy.intro'))}</p>
      ${sections.map(([h, p]) => `<h2 id="${h.split('.')[1]}">${esc(t(h))}</h2><p>${esc(p)}</p>`).join('\n')}
      <h2>${esc(t('privacy.sourceH'))}</h2>
      <p>${esc(t('privacy.source', { url: '\u0000URL\u0000' })).replace('\u0000URL\u0000', `<a href="${esc(SOURCE_URL)}" rel="noopener">${esc(SOURCE_URL.replace(/^https:\/\//, ''))}</a>`)}</p>
    </div>
  </div>`;
  return page(ctx, {
    path: `/${lang}/privacy/`,
    rest: 'privacy/',
    title: t('privacy.title'),
    description: t('privacy.description'),
    ogImage: `/og/${lang}/site.png`,
    main,
  });
}
