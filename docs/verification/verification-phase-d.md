# Verification — Phase D ship (d-ship) · Shubhvela 1.0.0 / versionCode 4

Step `d-ship` of workflow wf_1509b9828dcecc96 (relaunch of wf_86107bfa6c58305a). Worktree `c:/Users/sudiskmr/Downloads/DomainClassification/shubhvela`, branch `main`.
Dates 2026-10-30 04:57 IST → 2026-10-31 (the agent runtime restarted three times; state was re-derived from disk each time).
Gate: `review-phase-d.json` `verdict: "APPROVED"` (0 BLOCKING, 5 MEDIUM, 2 NIT) read first.

Commits by this step (all on origin/main): `a12e8f3` fix(F35) privacy disclosure of the Hugging Face model download · `518a9f3` fix(F16) translated yoga rule
captions + load.ts header + OWNER-TODO 18/18 · `303e3c9` + `53790e1` fix(F11) chart centre lines as native Text (Devanagari shaping) · `fc38fb6` brand: 24 re-shot
store screenshots · `c298533` fix(F11) East Indian chart sign-fixed (D-SHIP-1) · `6f3099a` brand: 02-charts re-shot + store-listing/OWNER-TODO · ship docs commit (below).
Release tree = the commit tagged `v1.0.0` (see §9).

## 1. Gates before building (plan §11 step 2)

| Check | Result |
|---|---|
| Translation-loop gate (carry-over "D-SHIP GATE") | Polled `.agents/tasks/corpus-translate/prd.json` every 10–20 min 05:05–07:07 IST; T99 `done` at 07:00 (`ed75e64`). All 18 in-scope corpus domains complete in hi and bho, 1,434 records per language, 0 gaps (`docs/CONTENT-TRANSLATION.md`); `naamkaran-names` English by decision. |
| `git --no-pager status --porcelain` | Clean apart from `packages/engine/reference/results*.json` timestamp drift (never committed). |
| `npm test` (final, on `6f3099a` + uncommitted docs) | content **199/199** · content-tools **16/16** · engine **1058/1058** (33 files; +1 East-layout case) · app **340/340** (37 suites, 13 snapshots) · web **64/64** = **1,677 pass, 0 fail**. |
| `npm run typecheck` / `npm run lint` | exit 0 / exit 0 (all 5 workspaces). |
| `npm run web:build` | 4,283 pages (panchangCity 993, panchangMonth 993, panchangIndex 3, festival 909, festivalsIndex 12, muhurat 504, muhuratIndex 3, glossaryTerm 792, glossaryIndex 3, vrat 36, vratIndex 3, core 24, root 8); 4,269 sitemap URLs in 3 files; dist 143.8 MB / 6,307 files; OG 1,989 / 27.4 MB; client bundle 811 KB; precision 0.0765° → "within 0.08° (4.6′) over 60 births"; 186.5 s. |
| `node web/audit/live-check.mjs` (before any push) | `{"pass":true,"checks":28,"passed":28}` at https://sudish007.github.io/shubhvela/ |
| Kotlin `BandRendererTest` | not rerun: d-fix recorded 10/10 on `e0f4c0b`; no `android/` change since. |
| Version check | `app/app.json` `"version": "1.0.0"`, `versionCode 4`; `app/android/app/build.gradle` `versionCode 4` / `versionName "1.0.0"` (also asserted by `scripts/build-apk.ps1` and `gen-store-assets --check`). |

## 2. Fixes made by this step (all text/layout, inside spec.md/design.md; each with tests)

1. **D-REVIEW-MEDIUM-1 (F35)** — `web/src/strings/{en,hi,bho}.json` `privacy.leaves`, `packages/content/ui/*.json` `consent.leaves` + `privacy.networkList` now name the Hugging Face model download (Pro, after consent, Wi-Fi only, no personal data); `store-listing.md` Data-safety note corrected (`a12e8f3`). Live `/en/privacy/` carries the sentence after the Pages run for `a12e8f3`.
2. **Orchestrator T99 items** — `YogasCard`/`YogaSheet` print the translated rules-corpus sentence in hi/bho instead of the English `rule` line (`yogaRule()`, test in `charts-extras.test.tsx`); `packages/content/src/load.ts` header updated to the 2026-10-29 decision; OWNER-TODO item 5 = 18/18 domains (`518a9f3`).
3. **Devanagari in the chart centre** — the hi/bho store shot showed "म्ध्यम राहु": react-native-svg `<Text>` on Android cannot shape Devanagari conjuncts in any face (tried the body face first, `303e3c9`, no change), so the South/East centre lines are now native `Text` overlays at the layout's position/size (`53790e1`; `charts-components.test.tsx`).
4. **D-SHIP-1 (orchestrator, BLOCKING) — East Indian chart convention.** `eastRegions()` is now SIGN-FIXED (Mesha always top-centre, signs anticlockwise, houses counted from the Lagna cell), Lagna cell marked by its numeral in accent + a 2 px accent underline (`lagnaMark`); app `Chart.tsx`, web `chart-svg.mjs` + `site.css` honour `label.accent`; Legend sheet gained `charts.legendLagnaMark` (en/hi/bho); design.md §M20 (both copies) and RELEASE-NOTES corrected; `chart-layout.test.ts` rewritten with a non-Mesha-Lagna case (SAMPLE, Lagna Meena) (`c298533`). Live web kundli page checked with Playwright after deploy: `/en/kundli/?…&st=east` renders "1" at top-centre and "12" with class `sign lagna` in the top-right inner triangle.
5. **Store screenshots** — all 24 slots re-shot raw (1080×2400, pro seed, light, gesture nav, status bar in demo mode: 10:00, full Wi-Fi/signal/battery, no notification icons) from the 1.0.0 x86_64 build; `scripts/gen-brand-assets.mjs` reads `shots/phase-d/play/raw` first; `sources.json` 24/24 `kind: raw`, **0 `pending: true`**; `--check` exit 0; 02-charts re-shot again after the East fix (`fc38fb6`, `6f3099a`). Opened and hand-checked: en/01-today, hi/02-charts (before and after both chart fixes), bho/03-family (shows tithi birthdays + Dadaji shraddha as captioned), bho/06-learn (translated lesson titles), en/05-matching, hi/03-family framed output.

No user-visible behaviour beyond spec/design was changed; every fix is a copy, rendering or convention correction.

## 3. Builds (plan §11 steps 3–7)

Disk: the step started at 8.19 GB free. The first arm64 attempt died with ENOSPC (pagefile grew to 11.3 GB during Gradle); after a `send_message` warning the orchestrator/owner freed other projects' node_modules, old APKs and caches (6.4 → 15 → 22 GB). Before every Gradle run `(Get-PSDrive C).Free` was re-measured; after every run `gradlew --stop` and `node_modules/*/android/{build,.cxx}` + `app/android/app/{build,.cxx}` were deleted (they grow 3–9 GB per build). The AVD `shubhvela_test` (7.81 GB) was deleted after the emulator audit (owner-approved); recreate with `scripts/emulator.ps1 -Install` (= `avdmanager create avd -n shubhvela_test -k "system-images;android-34;google_apis;x86_64" -d pixel_6 --force`; the system image is kept).

| Artifact | Command | Result |
|---|---|---|
| `release/Shubhvela-1.0.0-arm64.apk` | `scripts/build-apk.ps1 -Abi arm64-v8a -Version 1.0.0` (final run 00:56–01:25, 1,662 s, 24.3 GB free; built from `6f3099a`, includes every fix above) | **95.9 MB**; `aapt dump badging`: `package: name='com.shubhvela.app' versionCode='4' versionName='1.0.0'`, `sdkVersion:'24'`, `targetSdkVersion:'36'`, `native-code: 'arm64-v8a'`; apksigner `Verifies`, **v2 true**, v1/v3/v3.1/v4 false (v3 not enabled in build.gradle, unchanged since Phase A). |
| `release/Shubhvela-1.0.0-x86_64.apk` | `scripts/build-apk.ps1 -Abi x86_64 -Version 1.0.0 -ScreenshotMode` (final run 23:03–23:14, 636 s; from `c298533`, East fix included) | **106.3 MB**; badging as above with `native-code: 'x86_64'`; v2 true. Emulator/screenshot build only, not for upload. |
| `release/Shubhvela-1.0.0.aab` | `gradlew.bat bundleRelease -PreactNativeArchitectures=armeabi-v7a,arm64-v8a,x86,x86_64 --max-workers=2 --console=plain > build-aab.log 2>&1` from `app/android/`, detached (hidden cmd.exe; a tool timeout had sent Ctrl+C into a foreground attempt), same `ORG_GRADLE_PROJECT_SHUBHVELA_*` env as the APK script, started at 24.25 GB free, polled every 15 s with an abort below 1.5 GB (never triggered; min 14.9 GB) | `BUILD SUCCESSFUL in 6h 46m 32s` (wall clock incl. host sleep; 966 tasks); **179.0 MB**; `jarsigner -verify -verbose:summary -certs` → `jar verified.`, `Signed by "CN=Shubhvela, OU=Apps, O=Sudish Kumar, C=IN"`, cert expires 2054-03-11 (no timestamp warning, expected); `base/lib/` = **arm64-v8a, armeabi-v7a, x86, x86_64**; `base/manifest/AndroidManifest.xml` contains `com.shubhvela.app`, `1.0.0` and `versionCode … 4`; `META-INF/SHUBHVEL.SF/.RSA` present. **bundletool is not installed on this PC, so only jarsigner + a zip inspection were run.** An interim arm64-only AAB (owner decision later reversed) was built and deleted. |

All three files are gitignored (`release/*.apk`, `release/*.aab`); `git status` never listed them.

## 4. Emulator audit (plan §10/§11 step 8, DEV-1 two-navigation-mode requirement)

AVD `shubhvela_test` (pixel_6, API 34 google_apis x86_64), `scripts/emulator.ps1 -Boot`, `adb install -r release/Shubhvela-1.0.0-x86_64.apk` (`dumpsys package`: versionCode=4 versionName=1.0.0 primaryCpuAbi=x86_64), 390 dp (`wm density 443`), font 1.0, status bar in SystemUI demo mode. Emulator exited by itself once mid-batch (known since A13); the wrapper rebooted it and continued. Shot via `scripts/shots.ps1` through a skip-existing wrapper (`%TEMP%\sv-dship\`, not committed), one shot per cold start.

Folder `.agents/tasks/v1-build/shots/phase-d/app/` — **189 PNG**, all ≤ 1920 px per side (0 over 1920):
- **Gesture navigation (132)**: the 20 required screens × en/hi/bho × light/dark = 120 (`onboarding-consent, today, today-segments, charts, charts-vargas-sheet, dasha-tree, family, family-calendar, muhurat, match-result, share-code, pdf-preview (pro), pro, learn, lesson, glossary, journal, prashna (pro), ask-gate (pro), settings`) + `charts-east` × 6 and `charts-south` × 6 (C-REVIEW-NIT-6 / D-SHIP-1 re-shoot).
- **3-button navigation (54)**: `today, charts, family, learn, pro, pdf-preview, today-panchang-sheet (a Sheet), muhurat, settings` × en/hi/bho × light/dark.
- `launcher-home-light-390`, `launcher-home-dark-390` (app icon on the Pixel launcher; dark wallpaper shows the launcher's themed-icon tint of the monochrome layer, the app's own background is paper #FAF7F2), `splash-light-390` (mark centred and undistorted on paper — the brand-review stretch concern does not show on API 34).
- Every shot has `.ui.xml`, `.bottom.ui.xml` and `.meta.json` (nav-bar rectangle).
- **`audit.json`** (`node scripts/audit-ui-dump.mjs <folder> --density 443`): **`{"shots":186,"smallControls":0,"intersections":0,"covered":0,"navCovered":0,"navChecked":186,"failing":0}`** (the 3 launcher/splash PNGs have no dump).

Eye check, one PNG per `read_file`: `today-segments-en-light` (band 13 segments, legend, "Now 10:42 · Avoid · Kaal choghadiya"), `charts-hi-light` ×3 iterations (the "म्ध्यम" defect, then correct "मध्यम राहु", then the sign-fixed East chart: top-centre 1, Meena "12" in accent + underline holding मं बु श, Kumbha 11 holding सू गु के), `charts-east-bho-dark` (Lagna marker legible in dark, 320×100 test banner strip), `family-bho-light` (Priya/Amma janam-tithi, Dadaji shraddha), `learn-bho-light` (translated lesson titles), `match-result-en-light` (25 of 36 guna, koota rows with Why?), `dasha-tree-bho-dark` ("you are here" strip, test banner), `pro-hi-light` (yearly selected, "49% बचत", sticky CTA), `ask-gate-en-dark` (honest unsupported-device message), `pdf-preview-hi-dark-3btn` (Download/Share row clears the 3-button bar). HARD NO list: nothing found (no gradients, glow, galaxy, particles, orbs, stock art, emoji in chrome, heavy shadows, fake numbers, testimonials, tickers; the only illustration is Google's test ad creative inside the ad view). Hard-UI violations found and fixed: the Devanagari shaping defect (§2.3) and the East convention (§2.4); after the fixes both APKs and the AAB were rebuilt and the affected screens re-shot — one loop, as the checklist allows.

Store captures: `shots/phase-d/play/` 24 shrunk + `play/raw/` 24 raw 1080×2400.
Web: `shots/phase-d/web/` 345 PNG + `audit.json` (`pass: true`, 336 shots, 0 findings) + `lighthouse-*.json` ×4 + `live-check.json`, unchanged from D03/d-fix/d-review (this step changed only `chart-svg.mjs` label classes and one CSS rule; the audit's DOM measurements are unaffected).

Home-screen widget shots: not re-taken — the fresh AVD page carried no pinned widgets and the dev-route re-seed from the ad-hoc script failed on shell quoting; the Phase C shots (`shots/phase-c/home-widgets-*`, 6) stand, and the widget code since then is covered by `BandRendererTest` 10/10 (d-fix). Recorded as not re-verified.

## 5. Web / live

- Pages runs for `a12e8f3`, `518a9f3`, `303e3c9`, `53790e1`, `fc38fb6`, `c298533`, `6f3099a`: all `success` (`gh run list --workflow pages.yml`).
- `node web/audit/live-check.mjs` after the final push: see §9.
- Lighthouse (D03/d-review, local server on identical bytes, lighthouse 13.6.0 mobile): `/en/` 100/100/100/100 · `/en/kundli/` 100/100/100/100 · `/en/panchang/new-delhi/` 100/100/100/100 · `/hi/` 99–100/100/100/100. Not rerun here (no CSS/JS change beyond one class rule).

## 6. Engine reference suites (spec §6) and the "beta" gate

`packages/engine/reference/results.json` (written by the final `npm test`): charts 60/60 (max planet 0.0765°, Lagna 0.2494°, node 0.0051°, dasha balance ≤ 1 day; Drik + AstroSage + JPL) · panchang 150/150 · festivals 600/600 compared (612 required; 12 slug-years documented as not on Drik) · matching 20/20 within tolerance, **14 exact**, six `koota-yoni@mXX` one-point Yoni differences documented in `CONVENTIONS.md` §3 · tz 12/12. **Spec §6 asks for exact guna totals: the gate is met except for the six Yoni conventions, which need the owner's acceptance or Drik's five-level Yoni table (OWNER-TODO item 6). 1.0.0 is therefore "release candidate, beta gate pending owner acceptance of the Yoni convention", not fully "beta".**

## 7. Docs refresh

`docs/verification/` copies: `plan.md`, `carry-over.md`, `review-phase-d.md/.json`, `verification-d01…d04.md`, `verification-d-fix.md`, this file; `docs/RELEASE-NOTES.md` 1.0.0 (translations 18/18, d-ship fixes, East convention, 4 ABIs); `docs/OWNER-TODO.md` (item 5 done, screenshots done, privacy disclosure done, status block "Status after Phase D"); `app/playstore-assets/store-listing.md` (device-support row, Data-safety note). Final `node scripts/gen-store-assets.mjs --check` and `gen-brand-assets.mjs --check`: exit 0.

## 8. Not verified (honest list)

- Any **real device**: the arm64 APK/AAB were badged and signature-verified only; the owner's DEV-1 confirmation on his phone is still pending (0.3.1 → 1.0.0).
- **Gemma inference / model download on hardware** (F35): the emulator fails the RAM gate; bridge is unit-tested only.
- **Live purchases / restore** (no Play products yet), **real ad fill** and the native ad card pixels on a Play device (test units only).
- **Multi-day widget behaviour** (Doze/WorkManager/exact alarms) and the home-screen widget shots on this build (Phase C shots + Kotlin test stand).
- **bundletool validate** (not installed): the AAB was verified with jarsigner and a zip inspection only; Play's upload will run its own validation.
- Lighthouse against the live origin; `intent://` buttons in a real Android browser; Nominatim CORS from a browser; Bhojpuri wording by a native reader; 360/412 dp and font-scale 1.3× not re-shot in this step (c06 covered them on the same tab/CTA code).

## 9. Tag, push, live check

- Ship commit `4a9bf82` `docs(release): 1.0.0 verification` (includes the OWNER-TODO 'Status after Phase D' block); `git tag v1.0.0`; `git push origin main --tags` → `6f3099a..4a9bf82 main -> main`, `[new tag] v1.0.0`.
- Pages run 41162199003 for `4a9bf82`: success (`gh run watch --exit-status`).
- `node web/audit/live-check.mjs` after the deploy: `{"pass":true,"checks":28,"passed":28,"base":"https://sudish007.github.io/shubhvela/"}`; live `/en/privacy/` contains the Hugging Face sentence.
- `git --no-pager status --porcelain`: clean apart from the untracked-by-policy `reference/results*.json` timestamp drift.
