# Verification — D02 · Web data pages + OG images + sitemaps

Date 2026-10-29 (build day 2026-10-29 IST). Commits on `origin/main`: `4a4aa05` feat(web): panchang, festival, muhurat, glossary, vrat pages; OG images; sitemaps · `c20f327` fix(test): learn.test derives the other-language glossary expectation from the corpus (needed for the Pages deploy, see §5).

## 1. Commands (FEAT-D02 verification list + typecheck)

| Command | Result |
|---|---|
| `npm run web:build` (local, Windows, 4 worker threads) | exit 0 — 4,283 pages, 4,269 sitemap URLs in 3 files, dist 143.2 MB / 6,307 files, og 1,989 images / 27.3 MB, **157.6 s** (bundles 6 s, engine data ~55 s of which panchang 331 × 61 days ≈ 48 s on 4 workers, render 24.7 s, OG 55.4 s) |
| `npm test -w web` | exit 0 — 5 files, **64/64** (build.test 46 core, strings 8, m8 9, data 7 (band renderer + roll-forward), pages 11 (full build into a temp dir, 175 s)) |
| `npm run typecheck` | exit 0 in all 5 workspaces |
| `gh run list --repo Sudish007/shubhvela --workflow pages.yml --limit 1` | run `40916462156` on `c20f327`: **success**, created 16:56:25Z, completed 16:59:54Z (3 m 29 s wall incl. deploy); `npm run web:build` on the ubuntu runner **96.3 s** (render 2.5 s, OG 42.5 s), `npm test` incl. the inventory walk over the fresh dist (`WEB_DIST`) 2.2 s for the web suite |
| `npx jest test/learn.test.tsx` (app) | 22/22 after the expectation fix |

## 2. Page counts (per language × 3 = total; every number from `web/.cache/build-summary.json`)

| Type | Per language | Total | Path pattern |
|---|---|---|---|
| panchang city (current month + today card) | 331 | 993 | `/<lang>/panchang/<city>/` |
| panchang next month | 331 | 993 | `/<lang>/panchang/<city>/2026-11/` |
| panchang index | 1 | 3 | `/<lang>/panchang/` |
| festival-year (Event JSON-LD) | 99 (2026) + 102 (2027) + 102 (2028) = 303 | 909 | `/<lang>/festival/<slug>/<year>/` |
| festivals index + per year | 1 + 3 | 12 | `/<lang>/festivals/`, `/<lang>/festivals/<year>/` |
| muhurat activity-month | 14 × 12 = 168 | 504 | `/<lang>/muhurat/<activity>/<yyyy-mm>/` (2026-10 … 2027-09) |
| muhurat index | 1 | 3 | `/<lang>/muhurat/` |
| glossary term | 264 (≥ 150 asserted) | 792 | `/<lang>/glossary/<id>/` |
| glossary index | 1 | 3 | `/<lang>/glossary/` |
| vrat | 12 | 36 | `/<lang>/vrat/<family-slug>/` |
| vrat index | 1 | 3 | `/<lang>/vrat/` |
| core (D01) | 8 | 24 | home, kundli, m, download, privacy, terms, data-deletion, 404 |
| root entry points | — | 8 | `/`, `/kundli/`, `/m/`, redirects, `404.html` |
| **Total** | | **4,283** | design.md 9 estimate ≈ 3,600 (glossary has 264 terms, not 150; festivals 99–102 slugs, not 60) |

Sitemaps: `sitemap.xml` index → `sitemap-en.xml`, `sitemap-hi.xml`, `sitemap-bho.xml` (1,423 URLs each, limit 50,000, split logic covered by `languageSitemaps`); `/m/`, 404 and redirects excluded (asserted).

## 3. OG images and sizes

| Set | Count | Naming |
|---|---|---|
| festival-year × lang | 909 | `og/<lang>/festival/<slug>-<year>.png` |
| city × lang (build day's band + tick times) | 993 | `og/<lang>/panchang/<slug>.png` |
| activity × lang | 42 | `og/<lang>/muhurat/<activity>.png` |
| vrat × lang | 36 | `og/<lang>/vrat/<family-slug>.png` |
| glossary (generic) × lang | 3 | `og/<lang>/glossary.png` |
| site + kundli (D01) | 6 | `og/<lang>/{site,kundli}.png` |
| **Total** | **1,989** | **27.3 MB** (avg 14.1 KB, palette PNG), budget 60 MB ✔ |

dist: **143.2 MB** / 6,307 files, budget 150 MB ✔ (asserted by the build; the inventory test re-measures). Breakdown: panchang 53.2 MB, muhurat 33.1 MB, og 27.3 MB, festival 16.2 MB, glossary 7.2 MB, fonts 2.5 MB, assets 2.0 MB (kundli bundle 811 KB + data-pages bundle 737 KB + CSS + per-language JSON), rest 1.7 MB. First build was 253 MB; brought under budget by: template indentation stripped at write time (`compactHtml`), muhurat rule chips → one "not met: …" line + the ten rule texts once per language on `/muhurat/#rules`, muhurat windows grouped by day, per-kind client i18n blocks, tabular-numeral classes moved to CSS.

## 4. Live checks (https://sudish007.github.io/shubhvela/, HEAD requests after the deploy)

200: `en/panchang/`, `hi/panchang/new-delhi/`, `bho/panchang/patna/2026-11/`, `en/festival/diwali/2026/`, `hi/festivals/2027/`, `en/muhurat/griha-pravesh/2026-10/`, `bho/muhurat/`, `en/glossary/`, `hi/glossary/lagna/`, `en/vrat/ekadashi/`, `bho/vrat/`, `sitemap.xml`, `sitemap-hi.xml`, `og/en/panchang/mumbai.png`, `og/hi/festival/diwali-2026.png`.

## 5. Notes for later steps

- **Pages run on `4a4aa05` failed** (and the content run's `5997b11` before it) in `app/test/learn.test.tsx:373`: the test asserted "no hi/bho glossary yet → `otherLanguageMeanings('lagna','en')` is `[]`"; the corpus-translate run committed `corpus/glossary/{hi,bho}.json` in `5997b11`. Fixed in `c20f327` by deriving the expectation from `glossaryTerm()` fallback flags (behaviour unchanged). The web build itself was green on that run (4,283 pages, 169 s).
- `pages.yml` now runs `npm run web:build` BEFORE `npm test` and passes `WEB_DIST=$GITHUB_WORKSPACE/web/dist` so `pages.test.mjs` walks the dist that will be deployed instead of building a second copy (runner total build job ≈ 3 min; the per-day engine cache in `web/.cache` was NOT needed: web:build 96 s on the runner, target < 10 min).
- Monthly roll-forward: `buildCalendar(engine, Date.now())` in `web/src/data/panchang.mjs` takes the civil date in Asia/Kolkata via the engine's zone table; current month = that month, next month = +1, muhurat = 12 rolling months, festival years = 2026..max(2028, buildYear + 2). Unit-tested with the cron instant (03:23 UTC on the 1st) and an IST-midnight edge.
- Muhurat pages are scored with NO profile (web has no chart), so Chandra bala and Tara bala are never met: max 8/10, stated on every muhurat page (`muhurat.personalNote`) and asserted by the inventory test (no `9/10` or `10/10`).
- Corpus fallback: hi/bho festival + glossary texts exist (content run); vrats, muhurat-activities rule texts and the glossary lessons list fall back to English with the visible `data.textIn` note ("shown in English until its translation is reviewed") — never an empty string.
- `engine.festivalVerification()` footer: "verified against Drik Panchang on <date>" only for the exact (slug, year, tradition, date) in `data/verified-dates.json`, else "not yet verified" (as the app).
- A-REVIEW-NIT-3 (Sheetala Ashtami 2028) untouched: the page prints the engine's date and the honest footer; no convention change.
- Convention values (`udaya`, `pradosh`, …) are printed raw in the festival/vrat key-value rows, exactly as the app's Why? sheet does.

## 6. Not verified

- Playwright layout audit of the new page types (320–2560, light/dark, min font 12 px incl. SVG band text, 44 px controls, overflow 0) and Lighthouse ≥ 90 on a panchang page — D03. Risk to check there: the month table at 320 px scrolls horizontally inside `.tscroll` (intended); the band SVG's inline labels use `calc()` x-positions (percent − px), which Chromium supports in SVG geometry but older engines may not — labels are decorative duplicates of the a11y text.
- City picker end-to-end in a browser (picker.js → lazy `data-pages.<hash>.js` → `recompute(slug)`): bundled and typechecked, exercised only by the static markup assertions; live interaction is D03's audit.
- `?city=` on a page that the Android `intent://festival?slug=…&year=…` button opens: the app side of that deep link (`shubhvela://festival`) is not registered in the app yet — the button falls back to Play/download as designed (M9); recorded for D-phase app polish.
- Bhojpuri wording of the 123 new web strings (register test passes: रउआ/राउर, no है/हैं, no Maithili forms) — owner review item, never blocking.
- `results.json` and `reference/results/*.json` in the worktree were already modified before this step (engine suite rewrites them on `npm test`); left unstaged, not part of this commit.
