# Shubhvela v1 — final report

Written by the `finalize` step of workflow wf_1509b9828dcecc96 (relaunch of wf_86107bfa6c58305a) on 2026-10-31.
Worktree `c:/Users/sudiskmr/Downloads/DomainClassification/shubhvela`, branch `main`, HEAD at report time `72168e3`
(`docs(release): verification-phase-d section 9`). Every number below is copied from the phase verification docs
(`.agents/tasks/v1-build/verification-phase-{a,b,c,d}.md`), the review verdict files, or a command run by this step.

## 1. Final state checks (this step)

| Check | Result |
|---|---|
| `git --no-pager status --porcelain` | Six `packages/engine/reference/results*.json` files differed from HEAD by their `generatedAt` line only (the reference suites rewrite it on every `npm test`; the same drift was reverted by every ship step). Restored with `git checkout --`; tree clean. |
| `git --no-pager log origin/main..HEAD --oneline` | empty — everything is pushed |
| `git --no-pager ls-remote --tags origin` | `v0.1.0-phase-a` → `bf88bc9`, `v0.2.0-phase-b` → `ae41b99`, `v0.3.0-phase-c` → `92cba89`, `v1.0.0` → `4a9bf82` — all four present on origin |
| Review verdicts | `review-phase-a.json`, `-b`, `-c`, `-d`: all `"verdict": "APPROVED"` |
| FEAT status | 30/30 `completed` (A01–A13, B01–B08, C01–C05, D01–D04); no `blocked_reason` set anywhere |
| `task.json` | status set to `completed` by this step |

## 2. Per phase

### Phase A — engine, corpus, core app · version 0.1.0 / versionCode 1 · tag `v0.1.0-phase-a` (shipped 2026-10-26)

- APKs (built, signed, gitignored): `release/Shubhvela-0.1.0-arm64.apk` 90.3 MB (94,708,652 bytes); `release/Shubhvela-0.1.0-x86_64.apk` 100.6 MB (105,524,757 bytes). **No longer on disk** — removed during d-ship to free space for the AAB build; sizes are from `verification-phase-a.md`.
- Shots: `.agents/tasks/v1-build/shots/phase-a/` — 103 PNG (84 main screens: 14 screens × en/hi/bho × light/dark at 390 dp, plus 19 variants/evidence); `audit.json` 102 shots, 0 failing.
- Tests at ship: content 84 · content-tools 16 · engine 963 (+1 skipped) · app 135 (6 snapshots) · web none = **1,198 pass**; typecheck and lint exit 0.
- Reference suites: charts 60/60 · panchang 150/150 · festivals 600/600 · tz 12/12 · matching 0/20 (fetcher broken; fixed in Phase B).
- Review: APPROVED — 0 BLOCKING, 4 MEDIUM, 4 NIT (`review-phase-a.md`, iteration 2).

### Phase B — timing, matching, documents, money · version 0.2.0 / versionCode 2 · tag `v0.2.0-phase-b` (shipped 2026-10-28)

- APKs: `release/Shubhvela-0.2.0-arm64.apk` 93.7 MB (98,230,110 bytes); `release/Shubhvela-0.2.0-x86_64.apk` 104.0 MB (109,078,980 bytes). **No longer on disk** (same reason); sizes from `verification-phase-b.md`.
- Shots: `shots/phase-b/` — 110 PNG (108 main screens: 18 screens × 3 languages × 2 themes, plus two width variants); `audit.json` 110 shots, 0 failing; `m4-native-ad-gate.json` 16/16; `pdf/` 6 PDFs.
- Tests at ship: content 93 · content-tools 16 · engine 1,056 · app 242 (11 snapshots) · web none = **1,407 pass**; typecheck and lint exit 0.
- Reference suites: charts 60/60 · panchang 150/150 · festivals 600/600 · matching 20/20 fetched (14 exact totals, 6 one-point Yoni differences) · tz 12/12; `reference:check` exit 0.
- Review: APPROVED — 0 BLOCKING, 4 MEDIUM, 8 NIT.

### Phase C — learn, AI, widgets, extras · version 0.3.0 / versionCode 3 (release candidate) · tag `v0.3.0-phase-c` (shipped 2026-10-29)

- APKs: `release/Shubhvela-0.3.0-arm64.apk` 94.6 MB (99,227,606 bytes); `release/Shubhvela-0.3.0-x86_64.apk` 105.0 MB (110,076,476 bytes). **No longer on disk**; sizes from `verification-phase-c.md`. Hotfix `release/Shubhvela-0.3.1-arm64.apk` (95.0 MB, versionCode 4, DEV-1 tab-bar fix from c06) is still on disk.
- Shots: `shots/phase-c/` — 129 top-level PNG (78 main screens: 13 × 3 × 2, 6 home-widget shots, 1 widget-pin dialog, remainder C05/c-fix variants); `raw/` 85 unshrunk 1080×2400 captures; `navbar/` 142 PNG (+131 under `navbar/_build1-touch-regression/`) from the c06 DEV-1 device-fix work; `audit.json` 128 shots, 0 failing.
- Tests at ship: content 106 · content-tools 16 · engine 1,057 · app 329 (13 snapshots) · web none = **1,508 pass**; Kotlin `BandRendererTest` 9/9 (reviewer run); typecheck and lint exit 0.
- Reference suites: unchanged from Phase B (charts 60/60, panchang 150/150, festivals 600/600, matching 20/20 within tolerance / 14 exact, tz 12/12).
- Review: APPROVED — 0 BLOCKING, 6 MEDIUM, 7 NIT.
- Known issue in 0.3.0: DEV-1 (owner-reported on a real phone — tab bar hidden behind the system navigation bar); fixed by c06, shipped in 0.3.1 and 1.0.0.

### Phase D — web companion, SEO, Play kit · version 1.0.0 / versionCode 4 · tag `v1.0.0` (shipped 2026-10-31)

- Artifacts on disk (`release/`, gitignored), sizes measured by this step:
  - **`release/Shubhvela-1.0.0.aab` — 179.0 MB (187,700,775 bytes)**, four ABIs (armeabi-v7a, arm64-v8a, x86, x86_64); `jarsigner -verify` → `jar verified`, signed by `CN=Shubhvela, OU=Apps, O=Sudish Kumar, C=IN`. This is the Play upload.
  - `release/Shubhvela-1.0.0-arm64.apk` — 95.9 MB (100,573,306 bytes); `aapt` badging `com.shubhvela.app` versionCode 4 / versionName 1.0.0, sdk 24 / target 36, `native-code: arm64-v8a`; apksigner v2 true.
  - `release/Shubhvela-1.0.0-x86_64.apk` — 106.3 MB (111,422,176 bytes); emulator/screenshot build only.
- Shots: `shots/phase-d/app/` 189 PNG (132 gesture-nav: 20 screens × 3 × 2 + East/South re-shoots; 54 three-button-nav; 3 launcher/splash), `audit.json` 186 shots / 186 navChecked / 0 failing; `shots/phase-d/play/` 24 store screenshots + `play/raw/` 24 raw 1080×2400 (`sources.json` 24/24 raw, 0 pending); `shots/phase-d/web/` 345 PNG, `audit.json` pass (336 shots, 0 findings), 4 Lighthouse JSONs, `live-check.json`; `shots/phase-d/web-d01/` 15 PNG.
- Tests at ship: content 199 · content-tools 16 · engine 1,058 · app 340 (37 suites, 13 snapshots) · web 64 = **1,677 pass, 0 fail**; typecheck and lint exit 0 in all 5 workspaces; Kotlin `BandRendererTest` 10/10 (d-fix run, no `android/` change since).
- Web build: 4,283 pages (28 page types × en/hi/bho), 4,269 sitemap URLs, dist 143.8 MB.
- Review: APPROVED — 0 BLOCKING, 5 MEDIUM, 2 NIT. d-ship closed D-MEDIUM-1 (privacy disclosure of the Hugging Face model download, `a12e8f3`) and D-MEDIUM-4 (24/24 store screenshots re-shot, `fc38fb6`/`6f3099a`), and fixed the orchestrator's D-SHIP-1 (East Indian chart now sign-fixed with a Lagna marker, `c298533`).
- Hindi and Bhojpuri corpus: 18/18 in-scope domains, 1,434 records per language, 0 gaps (all records `review: "draft"` pending the owner's Bhojpuri review).

## 3. Reference-suite coverage and the spec §6 "beta" gate

`packages/engine/reference/results.json` (final `npm test` of d-ship): charts 60/60 (max planet error 0.0765°, Lagna 0.2494°, node 0.0051°, dasha balance ≤ 1 day; Drik + AstroSage + JPL Horizons) · panchang 150/150 · festivals 600/600 compared of 612 required (12 slug-years documented as not published by Drik) · matching 20/20 within tolerance, **14/20 exact**, six `koota-yoni@mXX` one-point Yoni differences documented in `packages/engine/reference/CONVENTIONS.md` §3 · tz 12/12.

**Gate status: NOT fully met.** Spec §6 requires exact guna totals before a build is called "beta". Drik's five-level Yoni table was never sourced (typing it from memory was refused as a fake number), so the six Yoni conventions need either the owner's recorded acceptance in `CONVENTIONS.md` or the sourced table. 1.0.0 is therefore **"release candidate; beta gate pending owner acceptance of the Yoni convention"** (OWNER-TODO item 6).

## 4. Live site

- URL: **https://sudish007.github.io/shubhvela/** (GitHub Pages, `pages.yml`; last run for `4a9bf82` succeeded).
- `node web/audit/live-check.mjs` after the final deploy: `{"pass":true,"checks":28,"passed":28}`; live `/en/privacy/` carries the Hugging Face sentence.
- Lighthouse 13.6.0, mobile, local server on identical bytes (D03/d-review; not rerun against the live origin): `/en/` 100/100/100/100 · `/en/kundli/` 100/100/100/100 · `/en/panchang/new-delhi/` 100/100/100/100 · `/hi/` 99–100 performance, 100/100/100 for the rest.
- Legal pages live at `/<lang>/privacy/`, `/terms/`, `/data-deletion/` (HTTP 200 on 2026-10-30).

## 5. Not verified (consolidated, honest)

Hardware / device
- No phase's arm64 APK or the AAB was run by the build on a real device; they were badged and signature-verified only. The owner's confirmation on his phone that 0.3.1/1.0.0 clears the system navigation bar (DEV-1) is still the open acceptance.
- Gemma inference and the model download (F35, "Ask my chart"): the emulator fails the 6 GB RAM gate, so only the unsupported-device path was shot; the bridge is unit-tested with a mock only. No `.litertlm` was ever downloaded.
- Hindi/Bhojpuri TTS voices (the emulator's Google TTS has no hi-IN voice); real exact-alarm grant (`SCHEDULE_EXACT_ALARM`) on a phone.
- Multi-day widget behaviour (Doze, WorkManager batching, the 36-h stale footer under real idle): jobs were forced, never left to run for days. Home-screen widget shots were not re-taken on the 1.0.0 build (Phase C shots + `BandRendererTest` 10/10 stand).
- Cross-instance share-code scan/typed code (F30) between two devices; expo-camera QR recognition on hardware.

Money
- Live Play purchases, restore and grace period: no Play products exist yet (owner item 3). The Pro screen shows Play's inline "couldn't reach Play" / "item not available".
- Real ad units and fill: every build uses Google's test IDs (`extra.admob.live = false`); native ad card pixels never rendered (no fill on the Play-less emulator); interstitial/rewarded caps unit-tested only.

Tooling / audits
- `bundletool` is not installed: the AAB was checked with `jarsigner` and a zip inspection only; Play's upload runs its own validation.
- Lighthouse was not run against the live origin (local server on identical bytes); `intent://` buttons in a real Android browser and Nominatim CORS from a browser not exercised.
- 360/412 dp, font-scale 1.3× variants and the Vargas/Varshaphal footers were not re-shot in d-ship (earlier phase shots on the same code stand).
- TalkBack order, reduced motion, RTL, landscape never tested. The unattended emulator exit (five occurrences since A13) has no captured crash log.

Content / data
- Bhojpuri wording by a native reader (all `bho.json` corpus records are `review: "draft"`).
- Matching: six Yoni koota pairs differ from Drik by one point under a documented convention (§3 above).
- Festival dates documented as intentional differences: Holika Dahan/Holi 2026 (eclipse sutak not modelled), Sheetala Ashtami 2028; footers read "not yet verified".
- Level-2/3 "Why?" explanations exist only for the koota domain (D-MEDIUM-3, 1.0.x).
- Festival web pages print the raw convention id (`pradosh`) in the Convention row (D-NIT-1, 1.0.x).

## 6. Open owner steps (from `docs/OWNER-TODO.md`, status 2026-10-31)

In the order of urgency recorded there:

1. **Item 7 — Keystore backup (today).** Copy `release/shubhvela-release.keystore` and `release/KEYSTORE-INFO.txt` (gitignored) to an off-machine encrypted location. Losing them means a new upload key.
2. **Item 8 — Grievance e-mail (before publish).** Replace the placeholder `grievance@shubhvela.in` in `app/src/legal.ts` (flip `GRIEVANCE_EMAIL_CONFIRMED` to `true`), `web/src/strings/{en,hi,bho}.json` `site.grievanceEmail`, `app/playstore-assets/store-listing.md`, `docs/BREACH-PROCESS.md`, and Play Console → Contact details. Play rejects a non-working address.
3. **Item 3 — Play Console.** Create the app (Lifestyle, tag Astrology; 18+), paste the texts from `store-listing.md`, upload icon/feature graphic/screenshots from `app/playstore-assets/`, answer Data safety / content rating / ads / account-deletion, create subscription `shubhvela_pro` (monthly ₹49, yearly ₹299; $2.99/$19.99), in-app `shubhvela_pro_lifetime` ₹999/$49.99, consumables `report_janam_patri` ₹99, `report_matching` ₹99, `report_varshaphal` ₹149; add licence testers; upload `release/Shubhvela-1.0.0.aab` to the internal testing track; paste the Play URL into `web/src/strings/*.json` `site.playUrl` and `app/app.json` `extra.playUrl`. Walk-through: `docs/PLAY-RELEASE-CHECKLIST.md`.
4. **Item 4 — AdMob.** Create the app, fill the App ID and four unit IDs in `app/app.json` `extra.admob` (`live: true`) and the `APPLICATION_ID` meta-data in `AndroidManifest.xml`; rebuild; publish `app-ads.txt` at `web/public/app-ads.txt`. Do not create an AppLovin mediation group.
5. **Item 1 — Name and domains.** Confirm "Shubhvela" before the first Play upload (`com.shubhvela.app` cannot change); buy `shubhvela.in` / `.com`; later custom domain + `assetlinks.json`, or the N17 alternative (`Sudish007/Sudish007.github.io` user-pages repo serving `/.well-known/assetlinks.json`).
6. **Item 6 — Bhojpuri review + Yoni convention.** Review `packages/content/ui/bho.json`, `corpus/*/bho.json` (draft), `festival-rules.json` `names.bho`, store texts and `release-notes/1.0.0.bho.md`; review `festival-rules.json` and `reference/CONVENTIONS.md` once, and record acceptance of the six `koota-yoni@mXX` conventions or supply Drik's Yoni table (this closes the §6 beta gate).
7. **Item 2 — Instagram handle** (manual).
8. **DEV-1 confirmation.** Install `release/Shubhvela-1.0.0-arm64.apk` on your phone and confirm the tab bar clears the system navigation bar.
9. Deferred: Item 9 share-code relay (optional); Item 10 disk headroom (≥ 4 GB before any future Gradle build). The emulator AVD `shubhvela_test` was deleted to free 7.8 GB; recreate with `scripts/emulator.ps1 -Install`.
10. Post-1.0 fixes (1.0.x), from the Phase D review: level-2 "Why?" snippets for daily/planet/yoga domains; festival-page convention label; Devanagari place names in the app (`name_hi`); muhurat finder location mode; cross-instance share-code check; native ad pixels on a Play device; Sheetala Ashtami 2028 rule; dedicated 96×96 notification-icon source.

## 7. Where things are

- Plan, spec, design, build rules, per-cluster verification docs, review docs and `carry-over.md`: `.agents/tasks/v1-build/` (run artifacts) with committed copies under `docs/` and `docs/verification/`.
- Release notes: `docs/RELEASE-NOTES.md`; Play listing kit: `app/playstore-assets/`; breach process: `docs/BREACH-PROCESS.md`; translation record: `docs/CONTENT-TRANSLATION.md`.
- Tags on origin: `v0.1.0-phase-a`, `v0.2.0-phase-b`, `v0.3.0-phase-c`, `v1.0.0`.
