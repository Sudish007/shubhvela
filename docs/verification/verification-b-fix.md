# Verification b-fix — Phase B fix step, iteration 1 (2026-10-28)

Workflow wf_c5b312722b5ce956 (relaunch of wf_86107bfa6c58305a), loop `phase-b-review`, child `b-fix`.
`review-phase-b.json` did not exist at the start of this step, so this is the first-iteration path of plan.md §12:
full verification set, seam check between B01–B08 and Phase A, re-check of every Phase B acceptance test
against the app and `shots/phase-b/`, rebuild + re-shoot where UI changed. Worktree
`c:/Users/sudiskmr/Downloads/DomainClassification/shubhvela`, start HEAD `6b31256`.

## 1. Verification set (before any edit, HEAD 6b31256)

| Command | Result |
|---|---|
| `npm test` | content 10 files / 93 tests; content-tools 1 / 16; engine 32 / 1055; app 31 suites / 242 tests / 11 snapshots; exit 0 |
| `npm run typecheck` | exit 0 (5 workspaces) |
| `npm run lint` | exit 0 |

`packages/engine/reference/results*.json` changed only `generatedAt` when the suites ran; reverted with `git checkout`, not committed (same as B08).
Jest console noise (`schedule failed … OS refused`, `pdf failed Error: low storage`, `share card failed`, `matching failed ShareCodeError`) is the
error-path tests printing their expected warnings; every test passes.

## 2. Seam check (clusters B01–B08 and Phase A)

- Route flags: `ROUTE_FLAGS.{muhuratFinder, janamPatriPdf, shareChartCard}` and `MATCH_ROUTE_FLAGS.matchingReportPdf` are all `true`; the Timing and
  documents card (M3) and the matching report button render.
- Banner allow-list (M5): `route=` is passed by Ashtakavarga, KP, FullDashaTree, MuhuratFinder, MatchingResults; Pro passes `route="Pro"`, the PDF
  preview `route="PdfPreview"` (never on the list). Banner strip observed on charts/family/muhurat/match-result shots, absent on pro/pdf/naamkaran/share-code.
- i18n: 1629 keys per language, completeness test green; no `coming soon`/placeholder strings reachable (the `today.notYet*` keys from A09 are dead
  strings, unused by any screen).
- Entitlements: the Pro screen, PDF preview ("included in Pro" caption for Pro), unlock sheets and dasha alerts all read `entitlements.ts`; no screen
  compares SKUs.
- No seam failure found; nothing to fix in the integration itself.

## 3. Acceptance re-check (spec §3, Phase B) against the shots

Opened one image per read (all 110 PNG are 864×1920): pro en-light, pro hi-dark-scrolled, charts en-light-390/360, charts-vargas-sheet hi-light,
charts-unlock-sheet bho-dark, ashtakavarga en-light, kp bho-light, varshaphal en-dark, muhurat en-light, muhurat bho-dark-scrolled,
match-result en-light, share-code hi-light, pdf-preview bho-light, share-card-preview en-light, naamkaran en-light, today en-light-scrolled,
family-tools hi-light-scrolled.

| Feature | What was checked | Result |
|---|---|---|
| F12 | Vargas sheet lists D2…D60 with domain text; D9 free; locked chips with "Unlock"; unlock sheet two 48 dp buttons + "this device" caption | OK |
| F15 | Ashtakavarga BAV grid (Sun 48 bindus; column totals = by-sign; caption by-house consistent with Lagna Meena), SAV 337 with strength bars; KP cusps with sign/star/sub lords; Sade Sati card phases | OK |
| F16 | Yogas card on Charts (B04 tests; "formed/cancelled" tags, Why?) | OK (Jest; card below the fold in the Charts shot) |
| F17 | Varshaphal 2026: return instant, East chart with annual Lagna Vrishabha → year lord Venus "annual Lagna lord", Muntha Karka house 3 lord Moon | OK |
| F26 | Griha Pravesh today+7 Lucknow: 42 windows, "9/10 rules met", rule chips check/cross, Save to Upcoming, ".ics Pro", Why?; free range read-only + "Any range · Pro" | OK |
| F27 | Travel card (B05 tests; Disha Shool + Panchak/Bhadra) | OK (Jest) |
| F28 | Name syllables: Uttara Phalguni pada 4 → पी·Pi first, टे टो पा; names Devanagari + Latin; "no meaning claimed" | OK |
| F29 | 25 of 36 guna Priya × Amma, kootas with points, side labels, rule text, Why?; Tara 5/6 arithmetic checked by hand | OK |
| F30 | QR + 20-char grouped code, "What the QR and the code carry" list, "no name" | OK |
| F31 | Janam Patri preview (UI bho, PDF language हिन्दी), Tiro + Noto, Download/Share sticky CTA, "Pro में शामिल" | OK after fix 2 |
| F36 | Kundli card: wordmark + URL footer, "Show birth time" Off + "Birth time hidden" | OK |
| F38 | Banner strip 16 dp padding, test creatives; native ad gate below the fold (B08 M4 16/16 stands); no ad on Pro/PDF/share | OK |
| F39 | Pro screen: three radio cards, "Save 49%" arithmetic, Play's inline "Couldn't reach Play", matrix, Restore/Manage, disclaimer, sticky CTA with "Recurring. Cancel in Play → Subscriptions." + Terms | OK |
| F40 | One-time rows ₹99/₹99/₹149 with M2 captions ("included in Pro", "in Free and Pro"), "store price may differ" | OK |
| HARD NO | No gradients, glow, shadows, emoji in chrome, testimonials, timers, fake numbers on any opened screen; 12 sp floor held; state visible in dark theme | OK |

## 4. Fixes made (two commits + one docs edit)

1. **`e8be6a5 fix(F11)`** — hard-UI violation found on `charts-en-light-360.png` (Phase A chart component, East Indian style): the centre label
   "Lahiri · Mean node" (12 sp floor at scale 0.925 → 13 units) was ~113 units wide inside the 106-unit centre cell and was cut by both grid lines;
   at 390/412 dp it cleared the lines by ~1 dp (estimate 103/96 units vs the 93-unit inner box). `packages/engine/src/chart-layout/index.ts`
   gains `wrapCentreLines()`: a centre line wider than the centre box (East: one cell; South: the 2×2 block) is split at its " · " separators and
   re-packed; at most three lines are drawn. New test in `test/chart-layout.test.ts` asserts every centre label stays ≥1.5 units inside the
   cell at 296/326/348 px and that South keeps the lines unsplit. Shared by the app `Chart`, the PDF `chartSvg` and (Phase D) the web SVG.
2. **`6694847 fix(F31)`** — `pdf.timezone` in `ui/{en,hi,bho}.json` read "Time zone {tz} ({offset})" but is rendered as the value of a row whose
   label is `pdf.timezoneLabel` ("Time zone"), so the preview printed "समय क्षेत्र · समय क्षेत्र Asia/Kolkata (+05:30)". The value is now
   "{tz} ({offset})" in all three files (the key has no other caller).
3. **CONVENTIONS.md §3** (this commit) — Yoni table status updated (section 6 below).

## 5. Verification set after the fixes

| Command | Result |
|---|---|
| `npm test` | content 93; content-tools 16; engine 32 files / **1056** tests (+1); app 31 suites / 242 tests / 11 snapshots; exit 0 |
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0 |

## 6. Build, emulator, re-shoot, audit

- Disk gate: 14.3 GB free before Gradle, 12.97 GB after the build dirs were deleted, 12.8 GB at the end (no emulator and Gradle together).
- `scripts/build-apk.ps1 -Abi x86_64 -Version 0.2.0 -ScreenshotMode`: Gradle 1,328 s, exit 0 → `release/Shubhvela-0.2.0-x86_64.apk` 104.0 MB,
  `versionCode='2' versionName='0.2.0' native-code: 'x86_64'`, apksigner `Verifies`, v2 true. `gradlew --stop`; `app/android/app/build` and
  `app/android/app/.cxx` deleted.
- `scripts/emulator.ps1 -Boot` (shubhvela_test, 420 dpi), `adb install -r` Success. One "System UI isn't responding" dialog appeared during the
  first Charts batch; tapped Wait via the uiautomator bounds and re-shot; no dump contains the dialog.
- Re-shot (UI changed): `charts-{en,hi,bho}-{light,dark}-390` (session=4), `charts-en-light-360` (density 480), `charts-en-light-412` (default
  density; renamed from the script's suffix-less output to the B08 names), `pdf-preview-{en,hi,bho}-{light,dark}-390` (pro=1). 14 PNG + 14 ui.xml
  (+ bottom dumps for the banner screens). Not re-shot: share-card-preview (KundliCard passes one short centre line), varshaphal (lines
  "Priya"/"2026", both narrower than the cell) — unaffected by the wrap rule; every other screen untouched by the two fixes.
- Eye check of the new shots: charts hi-light-390 centre reads "Priya / लाहिरी / मध्यम राहु" inside the cell; charts en-light-360 "Priya / Lahiri /
  Mean node" inside the cell; pdf-preview hi-dark row "समय क्षेत्र | Asia/Kolkata (+05:30)".
- Audit: `node scripts/audit-ui-dump.mjs shots/phase-b --density 443` + 480 for `-360` + 420 for `-412`, then `--summary` →
  **`{"shots":110,"smallControls":0,"intersections":0,"covered":0,"failing":0}`**; M6 strip − banner still 32.3 / 32.5 / 32.8 dp at 360/390/411.
- `adb emu kill` at the end; folder still 110 PNG.

## 7. Open items re-checked (B01 §7, carry-over.md)

- **Drik five-level Yoni table** (B01 open item): still not sourced. Four web searches, Drik's own site and an MIT-licensed open Jyotish
  reference repo (`astrologerrps-source/vedic-astrology-reference`, guna_milan.json has only the koota maxima) give the seven enemy pairs and
  the grade words, never the 14 × 14 grid; the two pages that do list "friendly" pairs contradict each other and Drik's observed cells. The 15
  cells Drik printed in the 20 reference pairs are recorded in CONVENTIONS §3; typing a table from memory would be a fake number (build-rules),
  so `calculateYoni` and the six `koota-yoni@mXX` keys stay. Carried to the next phase's carry-over.
- **Guna total exact (23.5)**: done in B02/B06 (`fmtGuna`, `match.gunaHeadline`), and the PDF uses the same model.
- A-REVIEW-MEDIUM-3 (hi corpus, owner key), A-REVIEW-MEDIUM-4 (grievance address, D01/D04), A-REVIEW-NIT-1 (third-person Family Today —
  content authoring, B02 did not do it), A-REVIEW-NIT-2 (`name_hi` with the profile place), A-REVIEW-NIT-3 (Sheetala Ashtami 2028): unchanged,
  still open for the reviewer to carry.

## 8. Not verified
- Live Play purchases/restore/grace; real ad fill; native ad pixels (no fill on the Play-less image); interstitial/rewarded on device.
- Cross-device scan/typed code; expo-camera QR recognition.
- The B08 M10 logcat runs were made before `DELAY_APP_MEASUREMENT_INIT`; not re-measured here (no code touched that path).
- 1.3× font scale and the South Indian style were not re-shot after the centre-line change (unit test covers South; East at 1.3× falls under the
  same rule with a larger size → more splitting, at most three lines).
- Physical arm64 device; TalkBack; landscape.
