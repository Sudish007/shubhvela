// Language-less entry points. The root `/` and the paths the app links to without a language (`/privacy/`,
// `/data-deletion/`, `/terms/`, `/download/`, app/src/legal.ts) redirect by <meta http-equiv="refresh"> to the English
// page and list the three languages for anyone whose browser does not follow the refresh. `/kundli/` (the engine's
// language-less share URL for kind 'kundli') additionally keeps the query string with a one-line script.
import { LANGS, absUrl, href } from '../config.mjs';
import { esc } from '../html.mjs';
import { hreflangTags } from '../seo.mjs';
import { tr } from '../i18n.mjs';

export function renderRedirect(site, rest, { keepQuery = false } = {}) {
  const target = href(`/en/${rest}`);
  const t = tr('en');
  const langLinks = LANGS.map((l) => {
    const tl = tr(l);
    return `<li><a href="${href(`/${l}/${rest}`)}" lang="${l}">${esc(tl(`settings.lang.${l}`))}</a></li>`;
  }).join('');
  const script = keepQuery ? `<script>location.replace('${target}'+location.search+location.hash);</script>` : '';
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(t('redirect.title'))}</title>
<meta name="robots" content="noindex">
<link rel="canonical" href="${esc(absUrl(`en/${rest}`))}">
${rest === '' || rest === 'privacy/' || rest === 'terms/' || rest === 'data-deletion/' || rest === 'download/' ? hreflangTags(rest) : ''}
${keepQuery ? `<noscript><meta http-equiv="refresh" content="0;url=${esc(target)}"></noscript>` : `<meta http-equiv="refresh" content="0;url=${esc(target)}">`}
<script>${site.scripts.theme}</script>
<style>${site.css}</style>
${script}
</head>
<body>
<main id="main" class="wrap page">
  <p class="lede">${esc(t('redirect.going'))} <a href="${esc(target)}">${esc(absUrl(`en/${rest}`))}</a></p>
  <p>${esc(t('redirect.text'))}</p>
  <ul class="linklist">${langLinks}</ul>
</main>
</body>
</html>
`;
}
