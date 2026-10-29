# Verification — D04 · Play listing kit, docs, release notes, version 1.0.0

Date 2026-10-30. Worktree `c:/Users/sudiskmr/Downloads/DomainClassification/shubhvela`, branch main. Commit:
`docs(release): Play listing kit, breach process, owner runbook, 1.0.0` (hash in FEAT-D04 findings).

## 1. What was produced

| Deliverable | Path | Note |
|---|---|---|
| Play kit gate script | `scripts/gen-store-assets.mjs` | `--check` validates Play upload rules (icon 512² PNG+alpha ≤1 MB; feature graphic 1024×500 no alpha ≤15 MB; 2–8 phone screenshots per `<lang>/`, 320–3840 px, long side ≤ 2× short, no alpha, ≤8 MB; `sources.json` skipped), store-listing text limits (title 30 / short 80 / full 4000 per en/hi/bho via fenced `text <field> <lang>` blocks), release notes ≤500, versionName/versionCode parity with app.json. Delegates graphics to `node scripts/gen-brand-assets.mjs --check` when `app/brand/` exists (carry-over "BRAND + PLAY GRAPHICS ARE OWNED BY A SEPARATE RUN"): **no icon, feature graphic, launcher asset or screenshot was generated or touched by this step.** |
| Store listing | `app/playstore-assets/store-listing.md` | Title (28/25/24 chars), short (79/77/73), full (3271/2933/2803) en/hi/bho; category Lifestyle + tag Astrology (Play has no Astrology category — web check); contact (provisional grievance mailbox), privacy/terms/data-deletion URLs; store settings; target audience 18+; ads yes; advertising-ID declaration; Data safety (overview + every data type + security practices, based on the AdMob disclosure page developers.google.com/admob/android/privacy/play-data-disclosure read 2026-10-30, the source's four endpoints: AdMob, Play Billing, Nominatim on explicit tap, Hugging Face model download); IARC content rating answers; products with SKUs/prices (F39/F40, P19 consumables); licence-tester script; pre-launch-report expectations; "what is NOT in this kit". |
| Release notes | `app/playstore-assets/release-notes/1.0.0.{en,hi,bho}.md` | 457 / 411 / 395 chars; honest about the English fallback in hi/bho. |
| Breach process (N14) | `docs/BREACH-PROCESS.md` | Scope (no server, no relay), what counts as a breach for an offline app (B1–B7), roles, 72-hour procedure per DPDP Rules 2025 (users without delay via in-app/web/Play/repo notice; Board ≤72 h), preventive controls, log template. |
| Owner runbook final | `docs/OWNER-TODO.md` | plan.md §13 items with status table, N17 user-pages `assetlinks.json` alternative spelled out, item 5 marked superseded (translation run, 14/19 domains), item 11 post-1.0 list seeded with the open carry-over items (reviewer appends). |
| Release notes doc | `docs/RELEASE-NOTES.md` | 1.0.0 and 0.3.1 sections added. |
| Docs copies | `docs/spec.md`, `docs/design.md` (already carries the M1 `getScreenCTM` / N16 three-rows wording; copied verbatim), `docs/build-rules.md`, `docs/requirements.md`, `docs/verification/{plan.md, carry-over.md, verification-*.md (incl. c06, d01–d03), review-phase-*.md/.json}` | `plan.md` copy: 2 × `:app:testReleaseUnitTest` → `:app:testDebugUnitTest` (C-REVIEW-NIT-5; the run-artifact plan.md itself is untouched). |
| Third-party notices | `THIRD-PARTY-NOTICES.md` | Component table (fonts, gazetteer, tz, ads SDK + AppLovin adapter, Play Billing, LiteRT-LM, Gemma terms, crypto, WorkManager, Nominatim, reference data) + appendix of all 775 packages from `npm ls --prod --json --all --long`, grouped by licence (MIT 680, ISC 40, BSD-3 16, BSD-2 10, Apache-2.0 9, BlueOak 9, others listed). |
| README | `README.md` | Live site link, freemium table, known limits, privacy paragraph, dev notes. |
| Version | `app/app.json` 1.0.0 / versionCode 4; `app/android/app/build.gradle` versionName "1.0.0" / versionCode 4 | `app/test/app-config.test.ts` pinned 0.3.1 and was updated to 1.0.0 (same assertion, new value). |

## 2. Verification commands and results

| Command | Result |
|---|---|
| `node scripts/gen-store-assets.mjs --check` | exit 0 — brand check passed (delegated), icon 512×512 PNG alpha 5,604 B, feature graphic 1024×500 no alpha 29,126 B, 8 screenshots × 3 languages all 1080×1920 (see §4), all text limits ok, versions paired. Log `%TEMP%\shubhvela-d04-check.log`. |
| `npm test` (root, all workspaces) | content 174/174, content-tools 16/16, engine 1057/1057, web 64/64; **app 338/339 on the first run** — the one failure was `app-config.test.ts` pinning version 0.3.1 (expected: this step bumps to 1.0.0). Test updated; `npx jest test/app-config.test.ts` 3/3; `npm test -w app` re-run after the fix: see §2a. |
| `npm run typecheck` | exit 0 (5 workspaces). |
| `npm run lint` | exit 0; `npm run lint -w app` after the test edit exit 0. |
| `Select-String -Path app/app.json -Pattern '"version": "1.0.0"'` | `app\app.json:6: "version": "1.0.0"` |
| `Select-String -Path app/android/app/build.gradle -Pattern 'versionName "1.0.0"'` | `build.gradle:107: versionName "1.0.0"` (the FEAT listed `android/app/build.gradle`; the Android project lives at `app/android/`, B03 finding). versionCode 4 at line 106; app.json versionCode 4 at line 13. |
| URL checks (`Invoke-WebRequest`) | 200 for `/en/privacy/`, `/en/terms/`, `/en/data-deletion/`, `/hi/privacy/`, `/bho/privacy/`, `/privacy/`, `/data-deletion/` on sudish007.github.io/shubhvela. |

### 2a. `npm test -w app` re-run after the test fix

`npm test -w app` → Test Suites 37 passed / 37, Tests 339 passed / 339, Snapshots 13 passed. Combined with the first root run: content 174, content-tools 16, engine 1057, app 339, web 64 = 1,650 tests, 0 failing.

## 3. bundleRelease / AAB config check (step 6)

- `app/android/app/build.gradle`: `release` build type uses `signingConfigs.release`, which reads `SHUBHVELA_STORE_FILE/_STORE_PASSWORD/_KEY_ALIAS/_KEY_PASSWORD` project properties (exported by `scripts/build-apk.ps1` from the gitignored `release/KEYSTORE-INFO.txt`) and falls back to the debug keystore when absent → `bundleRelease` signs with the same release config as `assembleRelease`; no separate bundle signing block.
- ABIs: `gradle.properties` `reactNativeArchitectures=arm64-v8a` is the default; d-ship must pass `-PreactNativeArchitectures=armeabi-v7a,arm64-v8a,x86,x86_64` on the command line (as plan §7 Ship D says). No `splits {}` block, so one AAB contains all four ABIs and Play serves per-device splits. `newArchEnabled=true`, `hermesEnabled=true`.
- No Gradle build was run in this step (d-ship builds the AAB).

## 4. Screenshots

`app/playstore-assets/screenshots/<lang>/01..08-*.png` exist (8 per language, 1080×1920, from the brand run). The FEAT asked for 1080×2400; the brand generator produces framed 1080×1920 marketing shots (Play accepts both; 16:9 ≤ 2:1 rule). 21 of 24 slots are upscaled 864×1920 stand-ins marked `pending: true` in `screenshots/sources.json` (3 raw: `*/06-learn`). **Re-shoot is d-ship's job** (carry-over "BRAND REVIEW LEFTOVERS": `scripts/shots.ps1 -KeepRaw`, pro=1, light, then `node scripts/gen-brand-assets.mjs`). The screenshot files were not opened with read_file (binary rule); dimensions via sharp metadata only.

## 5. Not verified / not done in this step

- No AAB or APK built; no emulator run; no Gradle task.
- Play Console form fields were not entered (owner step 3); category/tag availability and the IARC questions were checked against Play help pages, not the live Console UI.
- Bhojpuri listing texts not reviewed by a native reader (owner item 6); Play has no bho listing locale.
- USD prices for the three report consumables ($1.99/$1.99/$2.99) are proposals (spec only fixed INR); the owner sets them in Console.
- Data safety answers are the developer's reading of the AdMob disclosure page; AdMob's page is versioned and should be re-read when the SDK is upgraded.
- The app's own `--check` validates what the brand run committed; it cannot detect a stand-in screenshot except through `sources.json`.
- Worktree carries untracked/modified files from the parallel runs (engine `reference/results*.json` rewrites, corpus translations); not staged by this step.
- A-REVIEW-MEDIUM-4 (grievance address): still provisional in `app/src/legal.ts`; D04 records it in store-listing.md and OWNER-TODO item 8 — not flipped (owner decision).
- C-REVIEW-MEDIUM-2 (`settings.exactAlarmsBody` wording) not changed — this step touched no `ui/*.json`; listed in OWNER-TODO item 11 for the Phase D fixer.
