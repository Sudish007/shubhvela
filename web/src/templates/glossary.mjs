// Glossary pages (spec F42 ">= 150 terms as individual pages"; FEAT-D02): /<lang>/glossary/ (every term by Latin
// letter with its Devanagari form and meaning) and /<lang>/glossary/<id>/ (term in Devanagari + Latin, meaning,
// related terms, the lessons that use it — lessons live in the app's Learn tab, so they are listed, not linked).
import { href } from '../config.mjs';
import { esc, join } from '../html.mjs';
import { letterGroups } from '../data/glossary.mjs';
import { crumbs, fallbackNote } from './parts.mjs';
import { page, playButton } from './layout.mjs';

export function renderGlossaryIndex(ctx, data) {
  const { lang, t } = ctx;
  const g = data.glossary[lang];
  const groups = letterGroups(g.items);
  const bc = crumbs(ctx, [[t('nav.glossary'), null]]);
  const letters = groups.map(([l]) => `<a href="#g-${esc(l)}">${esc(l)}</a>`).join('');
  const sections = groups.map(
    ([l, items]) => `<section aria-labelledby="g-${esc(l)}"><h2 id="g-${esc(l)}">${esc(l)}</h2><ul class="terms">${items
      .map((e) => `<li><a href="${href(`/${lang}/glossary/${e.id}/`)}"><span class="display" lang="hi">${esc(e.term_dev)}</span> <span class="lat">${esc(e.term_lat)}</span></a><span class="s">${esc(e.meaning)}</span></li>`)
      .join('')}</ul></section>`,
  );
  const main = `<div class="wrap page">
    ${bc.html}
    <h1 class="display">${esc(t('glossary.indexH1'))}</h1>
    <p class="lede">${esc(t('glossary.indexLede', { count: g.count }))}</p>
    ${fallbackNote(ctx, g.lang)}
    <nav class="letters" aria-label="${esc(t('glossary.lettersLabel'))}">${letters}</nav>
    ${sections.join('\n')}
  </div>`;
  return page(ctx, {
    path: `/${lang}/glossary/`,
    rest: 'glossary/',
    title: `${t('glossary.indexH1')} · ${t('site.name')}`,
    description: t('glossary.indexDescription', { count: g.count }),
    ogImage: `/og/${lang}/glossary.png`,
    jsonLd: [bc.ld],
    current: 'glossary',
    main,
    inlineCss: false,
  });
}

export function renderGlossaryTerm(ctx, data, { id }) {
  const { lang, t, site } = ctx;
  const g = data.glossary[lang];
  const e = g.byId.get(id);
  const bc = crumbs(ctx, [[t('nav.glossary'), `/${lang}/glossary/`], [e.term_lat, null]]);
  const related = e.related.map((r) => g.byId.get(r)).filter(Boolean);
  const title = `${e.term_dev} · ${e.term_lat}`;
  const main = join([
    `<div class="wrap page">`,
    bc.html,
    `<h1 class="display"><span lang="hi">${esc(e.term_dev)}</span> <span class="lat">${esc(e.term_lat)}</span></h1>`,
    fallbackNote(ctx, g.lang),
    `<div class="twocol">
      <div class="prose">
        <h2>${esc(t('glossary.meaning'))}</h2>
        <p class="lede">${esc(e.meaning)}</p>
        ${related.length ? `<h2>${esc(t('glossary.related'))}</h2><ul class="linklist">${related.map((r) => `<li><a href="${href(`/${lang}/glossary/${r.id}/`)}"><span lang="hi">${esc(r.term_dev)}</span> · ${esc(r.term_lat)}</a></li>`).join('')}</ul>` : ''}
        ${e.lessons.length ? `<h2>${esc(t('glossary.relatedLessons'))}</h2><ol class="lessons">${e.lessons.map((l) => `<li><span class="num">${l.n}.</span> ${esc(l.title)}</li>`).join('')}</ol><p class="s">${esc(t('glossary.lessonsInApp'))}</p>` : ''}
      </div>
      <aside class="sidecard">
        <h2>${esc(t('glossary.asideH'))}</h2>
        <p>${esc(t('glossary.asideP'))}</p>
        <div class="actions">${site.has(`/${lang}/kundli/`) ? `<a class="btn" href="${href(`/${lang}/kundli/`)}">${esc(t('nav.kundli'))}</a>` : ''}${playButton(ctx, { primary: false })}</div>
      </aside>
    </div>`,
    `</div>`,
  ]);
  return page(ctx, {
    path: `/${lang}/glossary/${id}/`,
    rest: `glossary/${id}/`,
    title: `${title} · ${t('glossary.titleSuffix')}`,
    description: e.meaning.length > 160 ? `${e.meaning.slice(0, 157).trimEnd()}…` : e.meaning,
    ogTitle: title,
    ogDescription: e.meaning,
    ogImage: `/og/${lang}/glossary.png`,
    jsonLd: [bc.ld],
    current: 'glossary',
    main,
    inlineCss: false,
  });
}
