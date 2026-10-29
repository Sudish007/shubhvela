# Verification — D03 · Web audits, fixes, deploy, live verification

Date: 2026-10-29 (IST evening). Worktree `c:/Users/sudiskmr/Downloads/DomainClassification/shubhvela`, branch `main`.
Commits: `81dce24` fix(web): audit fixes; verified live deployment · `74f22f8` fix(web): header links no longer shrink; city list links stay in their cell; audit checks intersections. Both on `origin/main`; Pages runs 40934891125 and 40942898236 succeeded; live site = `74f22f8`.
Evidence folder: `.agents/tasks/v1-build/shots/phase-d/web/` — 345 PNGs (all ≤ 1920 px per side; 2560 shot at DSF 0.75 → 1920×1080), `audit.json`, `lighthouse-<page>.json` ×4, `lighthouse-summary.json`, `live-check.json`.

## 1. What was built

- `web/audit/serve.mjs` — static server for `web/dist` on 127.0.0.1 under `/shubhvela/` (directory → index.html, unknown → `404.html` with status 404, gzip, Pages-like 10-min cache header); `playwrightChromium()` finds the installed `%LOCALAPPDATA%\ms-playwright\chromium-1248\chrome-win64\chrome.exe` (nothing downloaded).
- `web/audit/shoot-audit.mjs` — playwright-core 1.64.0. 28 page ids (every F42 page type in English plus hi/bho variants of the Devanagari-heavy ones; kundli and /m/ with the sample M8 query, hydrated) × 320/390/1024/1440/1920/2560 × light/dark = 336 shots. Per shot: status; `scrollWidth − innerWidth` with culprit elements; min rendered font over all text nodes = `parseFloat(fontSize) × hypot(getScreenCTM().a, .b)` for SVG text (M1); every visible `a/button/input/select/textarea/summary` ≥ 44 × 44 (checkbox/radio through a ≥ 44 px label); intersecting visible controls; nowrap text wider than its box; content box (`main .wrap` inner / innerWidth); `link[hreflang]` set; canonical; noindex where expected (/m/, 404); skip link exists, focusable, ≥ 44 px when focused; desktop UA gets no `data-ua` and zero visible `intent://` anchors; toggle `aria-pressed` = current theme, text + aria-label = target. Per page (390, Android UA): `data-ua=android` and every `intent://` button visible; toggle click → dark + `localStorage` → reload keeps dark → click back → light. Closed `<details>` content is excluded via `Element.checkVisibility()` (Chromium keeps its boxes under `content-visibility:hidden`).
- `web/audit/lighthouse.mjs` — lighthouse 13.6.0 CLI (new devDependency, 101 packages) with `CHROME_PATH` = the Playwright Chromium, `--form-factor=mobile --screenEmulation.mobile` (the default mobile config; `--preset` only offers perf/desktop), four categories, asserts `configSettings.formFactor === 'mobile'`, fails below 90, writes the JSON report per page + a summary with metrics and the sub-100 audits.
- `web/audit/live-check.mjs` — 28 fetches against `https://sudish007.github.io/shubhvela/` asserting status, content-type, canonical (production origin), hreflang set, noindex, html lang, og:image, skip link, toggle, JSON-LD types, robots directives, sitemap index + language sitemap, PNG magic bytes. `--base` lets it run against the local server.
- `web/package.json`: `audit`, `audit:lighthouse`, `audit:live` scripts replace the D01 placeholder.

## 2. Findings and fixes (all CSS/markup; no copy or behaviour change beyond spec/design)

| # | Finding (first run) | Fix | Where |
|---|---|---|---|
| 1 | `.citylist a` short names (Pune 36×44, Agra, Loni…) under 44 px wide: 37 at 320 → 4 at 2560 per home/panchang-index shot; hi/bho up to 108 | `min-width:44px` | site.css |
| 2 | Nav links `पर्व`/`व्रत` 42×44 (hi/bho), `.linklist`, `.crumbs`, `.terms`, `.card .months` links narrower than 44 | `min-width:44px` (+ `justify-content:center` on `.links a`) | site.css |
| 3 | `table.segments` 51 px horizontal overflow at 320 (panchang city, en; 14 px in hi) — only table not inside `.tscroll` | wrapped in `<div class="tscroll">` like the other tables (design 9) | panchang-city.mjs |
| 4 | Festival index: 303 date links per shot inside `table.festivals td` 22–28 px tall; muhurat index: 13–14 activity-title links 20–25 px | 44 px inline-flex link boxes in those cells / `.card h3 a` | site.css |
| 5 | Lighthouse a11y `heading-order`: footer `<h4>` after `<h1>` (home 98, panchang 98, hi 98) | footer headings → `<h2 class="fh">` with the same styling | layout.mjs, site.css |
| 6 | Lighthouse a11y `aria-prohibited-attr`: `aria-label` on role-less `<div id="share-url">` (kundli 96) | `role="group"` | kundli.mjs |
| 7 | Eye check of `home-hi-320-dark`: nav links overlapped ("शब्दावली" over "Android ऐप") — the scrollable `.links` row let items shrink under their nowrap text. Not caught by the numbers → audit gained the intersection and clipped-text checks | `.links a{flex-shrink:0}` | site.css, shoot-audit.mjs |
| 8 | New intersection check at 2560 on the panchang index: "Thiruvananthapuram" link 9 px into the next cell | `.citylist a{display:flex;max-width:100%;overflow-wrap:anywhere}` | site.css |

False positive removed from the audit: closed-`<details>` city links were being measured (Chromium `content-visibility:hidden` keeps rects) → `checkVisibility()`.

## 3. Commands and results

### `node web/audit/shoot-audit.mjs` (final run 19:37 UTC, 512.9 s, dist of `74f22f8`)
`SUMMARY {"pass":true,"shots":336,"maxOverflow":0,"minFont":12,"minSvgFont":12,"smallControls":0,"controlsMeasured":26064,"intersectingControls":0,"clippedTexts":0,"textNodesMeasured":82556,"minContentRatioAt1920Plus":0.92,"hreflangFails":0,"skipLinkFails":0,"uaGatingFails":0,"toggleFails":0,"hydrationFails":0,"fontsNotReady":0,"failingShots":0,"failingPageExtras":0}`

Per check:
- Horizontal overflow: max 0 px on all 336 shots (320–2560).
- Min rendered font: 12.00 px (floor met, never below). SVG text included: chart house numbers at 320 render at css 14.66 × k 0.8187 = 12.00 (home), 15.12 × 0.7937 = 12.00 (kundli/m, client layout); band tick times 12.00 × 1.0 (panchang city). M1 verified.
- Controls ≥ 44×44: 0 of 26,064 visible controls under 44 px.
- Intersecting visible controls: 0. Nowrap text wider than its box: 0.
- Content box / viewport: 0.900 at 320, 0.918 at 390, 0.920 at 1024/1440/1920, 0.925 at 2560 (≥ 0.88 at ≥ 1920 ✓; matches design 9).
- Body font: 17 px at 320/390, 18.27 at 1024, 19.52 at 1440, 20.96 at 1920, 22 at 2560.
- hreflang: `[en, hi, x-default]` on every indexable shot, none on /m/ and 404 (noindex + canonical `/en/kundli/` and `/en/404/` asserted); `bho` never emitted. 0 fails.
- Skip link: present, focusable, ≥ 44 px on focus: 336/336.
- UA gating: desktop UA → 0 visible `intent://` anchors on 336 shots; Android UA → `data-ua=android` and all intent buttons visible on the 10 page ids that carry one (home ×3, kundli ×3, m, festival ×2, download); 0 fails.
- Theme toggle: `aria-pressed` false/true, label "Dark"/"Light" (target) in light/dark on all shots; click → persist → reload → click-back round trip 28/28 pages.
- Hydration: kundli-en, kundli-hi, m-en client charts rendered (`data-layout="client"`) on all 36 of their shots. Fonts loaded on all 336.
- Status: 200 everywhere, 404 for the missing URL (served `404.html`).

### `node web/audit/lighthouse.mjs` (final, lighthouse 13.6.0, formFactor mobile)
| Page | Performance | Accessibility | Best practices | SEO | LCP | TBT | CLS | Bytes |
|---|---|---|---|---|---|---|---|---|
| /en/ | 100 | 100 | 100 | 100 | 1031 ms | 38 ms | 0 | 2.10 MB |
| /en/kundli/ | 100 | 100 | 100 | 100 | 1073 ms | 0 ms | 0.001 | 2.10 MB |
| /en/panchang/new-delhi/ | 100 | 100 | 100 | 100 | 862 ms | 0 ms | 0.001 | 2.10 MB |
| /hi/ | 100 | 100 | 100 | 100 | 1153 ms | 67 ms | 0 | 2.65 MB |

Before fixes 5/6: a11y 98/96/98/98 (perf/bp/seo already 100). Remaining sub-100 audits are informational insights (`cache-insight` — 10-min cache on the local server, Pages serves the same; `network-dependency-tree`, `render-blocking` on the data pages' linked CSS, `max-potential-fid` 100–370 ms from the inline scripts) and do not lower any category.

### `npm test -w web`
64/64 in 5 files (final run 180 s). One earlier run of the same tests, started right after the 500 s Playwright run, hit the 5 s vitest timeout in `pages.test.mjs › every planned page exists on disk` (walks 4,283 files); the immediate re-run passed, and the same test passed on the Pages runner for both commits.

### `node web/audit/live-check.mjs` (19:50 UTC, after run 40942898236 deployed `74f22f8`)
`SUMMARY {"pass":true,"checks":28,"passed":28,"base":"https://sudish007.github.io/shubhvela/"}` — root meta-refresh → /en/; home en/hi/bho (SoftwareApplication LD, no `hreflang=bho`); /en/kundli/ (FAQPage, form); /en/m/?v=1… (noindex, canonical /en/kundli/, no hreflang); /en/panchang/, /en/panchang/new-delhi/ (month table), /hi/panchang/new-delhi/2026-11/; /en/festivals/, /en/festival/diwali/2026/ (Event + BreadcrumbList LD); /en/muhurat/, /en/muhurat/griha-pravesh/2026-10/; /en/glossary/, /hi/glossary/lagna/; /en/vrat/, /bho/vrat/ekadashi/; download (intent button), privacy, terms, data-deletion; /privacy/ root redirect; missing URL → 404 + noindex 404 body; robots.txt (`User-agent: *`, `Disallow: /*/m/`, Sitemap line); sitemap.xml index with en/hi/bho; sitemap-hi.xml 1,423 URLs, no /m/; og/en/site.png and og/hi/festival/diwali-2026.png as image/png. Deployed HTML spot-checked for this step's markup (`<div class="tscroll"><table class="segments">`, `class="fh"`, `flex-shrink:0`).

### Deploy
`git push origin main` → pages.yml run 40934891125 (81dce24, success) and 40942898236 (74f22f8, success), watched with `gh run watch --exit-status`.

## 4. Eye check (one PNG per read, all ≤ 1920 px)
`home-en-2560-light` (3-area hero text/chart/mini, 4-column city grid, flat paper, no gradients/shadows/emoji), `home-hi-320-dark` before and after fix 7 (brand / tools / links rows per N16; links now scroll instead of overlapping), `kundli-en-1440-light` (hydrated from URL state, approx. ±30 min marker, fact rail), `panchang-city-hi-390-light` (Devanagari display + body, tabular times, breadcrumbs), `404-1920-dark` (toggle "Light" with accent pressed fill, 3-column footer). HARD NO list: nothing found (no gradients, glow, galaxy, particles, orbs, stock art, emoji in chrome, shadows, media, fake numbers — every value is engine output for the build day 2026-10-29/30).

## 5. Carry-over touched
None of the open carry-over items were in scope; A-REVIEW-NIT-3, B-REVIEW-NIT-8 (emulator leg), C-REVIEW-NIT-4 untouched.

## 6. Not verified
- Shots are viewport-only (no full-page captures): below-the-fold layout is covered by the DOM measurements, not by eye.
- Lighthouse was run against the local server, not the live origin (Pages' CDN headers/TTFB differ; the HTML/CSS/JS bytes are identical).
- `intent://` buttons on a real Android device/browser and Nominatim live CORS (unchanged from D01).
- City picker → lazy `data-pages.<hash>.js` → `recompute()` interaction in a browser (D02's not-verified item): the audit loads the pages but does not change the select.
- Chromium only (the installed Playwright build); no Firefox/WebKit.
- 320–2560 at font-scale 1.0 only; the web has no 1.3× check (the spec's 1.3× rule is for the app).
- `packages/engine/reference/*.json` modified in the worktree before this step (engine suites rewrite them) and the corpus-translate workflow's in-progress files (`packages/content/corpus/{dignity,lagna,yogas}/{hi,bho}.json`, `registry.ts`, `translations.test.ts`) were left untouched and uncommitted.
