# Verification — d-fix · Phase D fixer, iteration 1 (no `review-phase-d.json` yet)

Date 2026-10-30 (IST). Worktree `c:/Users/sudiskmr/Downloads/DomainClassification/shubhvela`, branch `main`.
Start HEAD `e1a0494` (D04); the parallel corpus run added `d2db62d` and `61921f1` while this step ran.
Commits of this step, all on `origin/main`: `0d3f94c` fix(F37) · `e0f4c0b` fix(F9) · `9501b8b` fix(F10/F34/F30 + UI strings).
Pages run 40966595314 (`9501b8b`) success; live site re-checked afterwards.

## 1. Full verification set on the Phase D tree (before any edit)

| Command | Result |
|---|---|
| `npm test` (root) | content 179/179 · content-tools 16/16 · engine 1057/1057 · app 339/339 (37 suites, 13 snapshots) · web 64/64 = **1,655 pass, 0 fail** |
| `npm run typecheck` | exit 0 (5 workspaces) |
| `npm run lint` | exit 0 |
| `npm run web:build` | 4,283 pages (panchangCity 993, panchangMonth 993, panchangIndex 3, festival 909, festivalsIndex 12, muhurat 504, muhuratIndex 3, glossaryTerm 792, glossaryIndex 3, vrat 36, vratIndex 3, core 24, root 8), 4,269 sitemap URLs, dist 143.8 MB / 6,307 files, OG 1,989 / 27.4 MB, 174.6 s, build day 2026-10-30 |
| `node web/audit/shoot-audit.mjs` | `pass: true` — 336 shots (28 page ids × 320/390/1024/1440/1920/2560 × light/dark), overflow 0, min font 12.00 (SVG incl.), small controls 0/26,064, intersections 0, clipped 0, content box 0.90/0.918/0.92/0.92/0.92/0.925, body 17→22 px, hreflang/skip/UA/toggle/hydration fails 0; 515 s; `shots/phase-d/web/audit.json` rewritten |
| `node web/audit/lighthouse.mjs` | `/en/` 100/100/100/100 · `/en/kundli/` 100/100/100/100 · `/en/panchang/new-delhi/` 100/100/100/100 · `/hi/` 100/100/100/100 (performance / accessibility / best-practices / SEO; LCP 0.87–1.10 s, TBT 0–58 ms, CLS ≤ 0.001; lighthouse 13.6.0, formFactor mobile, Playwright Chromium 1248) |
| `node web/audit/live-check.mjs` | 28/28 at `https://sudish007.github.io/shubhvela/` (live = `d2db62d` at that moment) |

## 2. Spec §3.10 and §10 re-check (F41, F42, F43, Play kit)

- **F41** static site, same engine + corpus (web build pre-bundles `packages/engine` and `packages/content`; `assets/rules-{en,hi,bho}.json` 55 ids each, 0 fallback flags; 0 hi/bho pages carry the "shown in English" note after the corpus commits), three languages with hreflang en/hi/x-default (bho has no ISO 639-1 code — design 9 M10), light default + persisted toggle (audit toggle round trip 28/28), fluid layout per spec 8 (gutters, no max-width, content box ≥ 0.92 at ≥ 1920, body 17→22 px), Lighthouse mobile 100 on home/kundli/panchang. ✓
- **F42** home; kundli generator (client compute, URL state, hydration 36/36 in the audit); panchang for 331 cities × current + next month; festival pages 99/102/102 slug-years × 3 years with `Event` JSON-LD; muhurat 14 × 12 months; glossary 264 ≥ 150 terms as pages; vrat 12; download CTA (honest "Coming to Google Play" while `site.playUrl` is empty — owner step 3); privacy, terms, data-deletion (200 live); 404 with search. ✓
- **F43** `sitemap.xml` index + per-language sitemaps (1,423 URLs each, `/m/` excluded), `robots.txt` (N10), canonical on every page, OG image per page type (1,989 built), JSON-LD `SoftwareApplication` / `FAQPage` / `Event` (+ `BreadcrumbList`), indexable text static (only kundli result + today label hydrate). ✓
- **Play kit vs spec §10**: `app/playstore-assets/store-listing.md` carries Data safety answers (AdMob identifiers, Play Billing, Nominatim on explicit tap, no account), privacy + data-deletion URLs live, content-rating answers, ads declaration, UMP noted; disclaimers in three languages are in the app (Settings → Disclaimers, PDFs) and the web terms/privacy pages. Category: Play has no "Astrology" category → Lifestyle + tag Astrology (D04 decision, recorded). Icon 512×512 (alpha), feature graphic 1024×500 (no alpha), 8 screenshots × 3 languages at 1080×1920 — 21 of 24 are `pending: true` stand-ins in `screenshots/sources.json`; the re-shoot belongs to d-ship (brand-review carry-over). Grievance address still provisional (owner item 8). ✓ with the two owner items open.

Eye check (one PNG per read, all ≤ 1920 px): `home-en-390-light`, `panchang-city-hi-390-light`, `kundli-en-1920-dark`, `muhurat-en-1440-light`, `feature-graphic-1024x500.png`, `screenshots/en/01-today.png`. Flat paper/ink/accent, hairlines, no gradients/glow/shadows/emoji/stock art/fake numbers; Devanagari display + body; approx. tags in indigo on the kundli page. The muhurat "7/10 · not met: Abhijit bonus" line deliberately omits the two chart-dependent rules — `rows.mjs unmetRulesLine` documents it and the page note above the table explains the 8/10 ceiling. **No hard-UI-rule violation found** on the web pages or the store assets.

## 3. Seams found and fixed

### 3.1 Web → app deep links (F37; commit `0d3f94c`)
- Festival pages emitted `intent://festival?slug=<slug>&year=<year>…` while the app (`app/src/deeplinks.ts`, route `festival/[slug]/[year].tsx`, design.md 3) expects `shubhvela://festival/<slug>/<year>`. With the app installed the old link landed on expo-router's "Unmatched Route". Fixed in `web/src/templates/festival.mjs`; `web/test/pages.test.mjs` asserts the path form. Live: `https://sudish007.github.io/shubhvela/en/festival/diwali/2026/` now carries `intent://festival/diwali/2026#Intent;scheme=shubhvela;package=com.shubhvela.app;S.browser_fallback_url=…/en/download/;end`.
- Home, download and kundli-result "Open in the app" buttons send `intent://open`; the app had no `open` route. Added `app/app/open.tsx` (redirect through the consent gate like `index.tsx`) and registered it in the root Stack.
- Not changed: the fallback URL is the download page until the Play URL exists (M9, honest).

### 3.2 Carry-over items owned by Phase D (commits `e0f4c0b`, `9501b8b`)
| Item | Fix | Test |
|---|---|---|
| C-REVIEW-MEDIUM-1 (F9) | `WidgetUpdater.currentSegmentName()` keeps only reasons with `start ≤ now < end`, else the choghadiya covering now | `BandRendererTest` 10/10: new 03:32 night-span case (Shubh only; 04:48 Shubh · Brahma; 05:00 Brahma · Amrit; fallback), the 14:00 case corrected to "Rahu Kaal" (Kaal choghadiya begins 14:55 — the old expectation encoded the bug), 15:00 "Kaal choghadiya" |
| C-REVIEW-MEDIUM-2 (F9 copy) | `settings.exactAlarmsBody` en/hi/bho: "up to 10 minutes late on Android 12 and newer (2 minutes on older phones)" | content 184/184 (key sets identical, 1,888 keys each) |
| C-REVIEW-MEDIUM-3 (F10) | `DailyNoteCard` error branch gets the "Open text-to-speech settings" button | `listen.test.tsx` presses `note-tts-error-settings`, `speech.opened === 1` |
| C-REVIEW-NIT-1 (F9) | `widget_small_label` / `widget_medium_label` (en/hi/bho) as receiver `android:label`; `previewLayout` → text-only `widget_small_preview.xml` / `widget_medium_preview.xml` (label + description, no sample verdict/time — D8) | Gradle resource compile in the unit-test run |
| C-REVIEW-NIT-2 (F34) | `journal.moodShort.*` (Ca Lo Bu Br Te; hi शां उदा व्य उज तना; bho … उजि …) replaces `word.slice(0,1)`; dot → 20 dp pill | `learn.test.tsx` ("Br", "Lo"), snapshot refreshed (diff = dot style only) |
| C-REVIEW-NIT-3 (F9 copy) | `state.ts` writes hora names via `band.hora` ("Mercury hora"); Kotlin fixture renamed (168 entries) | `widgets.test.ts`, Kotlin Now-line assertion |
| C-REVIEW-NIT-4 (F37 copy) | `scanResult.via = 'link'` from `app/m.tsx`; `PickerAB` shows `match.useLink` ("From a link" / "लिंक से") | existing match/deeplink suites pass |
| C-REVIEW-MEDIUM-5 | already closed by D01 (learn.test race) — marked in carry-over.md | app 339/339 twice today |

`docs/OWNER-TODO.md` item 11 updated (closed vs still open). `carry-over.md` items ticked with commit hashes.

## 4. Verification after the fixes

| Command | Result |
|---|---|
| `npm test -w app` | 339/339 (one snapshot updated with `-u` on `learn.test.tsx`; diff limited to the dot style) |
| `npm test -w packages/content` | 184/184 |
| `npm test -w web` | 64/64 (pages.test rebuilds into a temp dir and asserts the new festival intent string) |
| `npm run typecheck` / `npm run lint` | exit 0 / exit 0 |
| `.\gradlew.bat :app:testDebugUnitTest --tests com.shubhvela.app.widgets.BandRendererTest` (ANDROID_HOME set as `scripts/build-apk.ps1` does; disk 9.27 GB free ≥ 4 GB) | first run 9/10 (the old 14:00 expectation), corrected → **10/10**, BUILD SUCCESSFUL; `gradlew --stop`; `app/android/app/build`, `.cxx`, `app/android/build` deleted afterwards |
| `npm run web:build` | 4,283 pages, 143.8 MB, 174.7 s |
| `node web/audit/shoot-audit.mjs --only festival-en,festival-hi --no-png --out $env:TEMP\…` | 24 shots pass (overflow 0, min font 12.24, controls 0/816 under 44, intersections 0). The full-matrix `audit.json` from §1 stands: the change is a link `href` with no layout effect |
| `git pull --rebase origin main; git push origin main` | `61921f1..9501b8b`; pages.yml run 40966595314 success (build + deploy) |
| `node web/audit/live-check.mjs` (after deploy) | **28/28**; live festival page carries the path-form intent link |

## 5. Not done / handed on

- **C-REVIEW-MEDIUM-4** (level-2/3 "Why?" snippets for daily, planet-sign/house and yoga domains): content authoring of dozens of English snippets plus their hi/bho translation; beyond a fixer's remit and not a spec-section-3 acceptance failure (F32 unlocks exist for the koota domain). Left open in `carry-over.md` / OWNER-TODO 11 for the reviewer's decision.
- **C-REVIEW-MEDIUM-6** (six `koota-yoni@mXX` conventions, spec §6 "beta" gate): owner acceptance or a sourced Yoni table — owner item 6 / d-ship gate. Not a code change this step can make honestly.
- **B-REVIEW-NIT-1** (`name_hi` place names in the app), **B-REVIEW-NIT-7** (muhurat location mode), **A-REVIEW-NIT-3** (Sheetala Ashtami 2028): unchanged; web side of B-N1 already uses `nameHi` (D02).
- **C-REVIEW-NIT-5/6**, brand re-shoot of 21 stand-in screenshots, launcher/splash shots: d-ship (docs refresh, emulator run).
- **No APK was rebuilt** in this step: the app-side changes (TTS link, journal marks, "From a link", widget Kotlin/strings, `open` route) are covered by Jest + the Kotlin JVM test; d-ship builds 1.0.0 (versionCode 4, already bumped by D04) and runs the emulator audit (both navigation modes per the DEV-1 requirement), where the widget picker labels/previews, the journal pill and the TTS link can be photographed.
- Lighthouse was run against the local server (identical bytes), not the live origin; shots are viewport-only; Chromium only; intent:// not exercised on a device.
- `packages/engine/reference/results*.json` are rewritten by every engine test run (timestamps only) and were left unstaged, as in D01–D04.
