// Terms of use (spec F42; D8 honesty: guidance for reflection, no warranty, free + Pro via Play).
import { esc } from '../html.mjs';
import { page } from './layout.mjs';

export function renderTerms(ctx, data) {
  const { lang, t } = ctx;
  const sections = ['service', 'reflection', 'freePro', 'accuracy', 'use', 'liability', 'law'];
  const main = `<div class="wrap page">
    <div class="prose">
      <h1 class="display">${esc(t('terms.h1'))}</h1>
      <p class="meta">${esc(t('terms.updated', { date: data.buildDate[lang] }))}</p>
      ${sections.map((s) => `<h2 id="${s}">${esc(t(`terms.${s}H`))}</h2><p>${esc(t(`terms.${s}`))}</p>`).join('\n')}
    </div>
  </div>`;
  return page(ctx, {
    path: `/${lang}/terms/`,
    rest: 'terms/',
    title: t('terms.title'),
    description: t('terms.description'),
    ogImage: `/og/${lang}/site.png`,
    main,
  });
}
