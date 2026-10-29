# Verification — Phase C ship step `c-ship` (2026-10-29)

Workflow `wf_1509b9828dcecc96` (relaunch of `wf_86107bfa6c58305a`), worktree `c:/Users/sudiskmr/Downloads/DomainClassification/shubhvela`,
version **0.3.0 / versionCode 3** (release candidate), tag **`v0.3.0-phase-c`**. Procedure: plan.md section 11 (ship checklist) and section 10 (emulator).
Every command was run from the repo root unless stated; every number is copied from the command output.

## 0. Gate

`review-phase-c.json` read first: `"verdict": "APPROVED"` (0 BLOCKING, 6 MEDIUM, 7 NIT; `review-phase-c.md`). Shipping allowed.

## 1. Tree, pull, verification set

| Command | Result |
|---|---|
| `git --no-pager status --porcelain` | empty (clean) at HEAD `2c41368` = origin/main |
| `git --no-pager pull --rebase origin main` | Already up to date |
| `npm test` (97 s) | exit 0 — content 11 files / **106** tests; content-tools 1 file / **16**; engine 32 files / **1057**; app 36 suites / **329** tests / 13 snapshots; web: no test files |
| `npm run typecheck` (24 s) | exit 0 (content, content-tools, engine, app, web) |
| `npm run lint` | exit 0 (app `eslint .`), 0 warnings |
| Kotlin | `:app:testDebugUnitTest` not re-run here; the reviewer ran it on this same tree (`BandRendererTest` tests=9 failures=0, review-phase-c.md §1). `:app:testReleaseUnitTest` does not exist in this AGP (C-N5). |

Reference-suite coverage (unchanged since b-ship; `packages/engine/reference`, read from the committed `results*.json`): charts 60/60, panchang 150/150,
festivals 600/600 (12 slug-years not published by Drik), matching 20/20 fetched (14 exact totals, 6 one-point Yoni differences under `koota-yoni@mXX`
in CONVENTIONS §3 — C-M6 / B-REVIEW-MEDIUM-1, Phase D gate), tz 12/12.

Side effect of `npm test`: the six `packages/engine/reference/results*.json` files changed only their `generatedAt` line (diff lines other than
`generatedAt`: 0) — reverted with `git checkout -- packages/engine/reference`; tree clean again.

## 2. Disk and daemons

- `(Get-PSDrive C).Free` = **8.60 GB** before the first Gradle run (gate 4 GB) → no warning needed.
- `.\gradlew.bat --stop` from `app/android/` → "No Gradle daemons are running."

## 3. Version check

- `app/app.json`: `expo.version` = 0.3.0, `expo.android.versionCode` = 3.
- `app/android/app/build.gradle`: `versionCode 3`, `versionName "0.3.0"`. Equal (also asserted by `app/test/app-config.test.ts`).

## 4. Builds (foreground, `scripts/build-apk.ps1`, tool timeout 1,800,000 ms; neither call timed out; no rerun)

| Build | Command | Gradle | Output |
|---|---|---|---|
| Device | `scripts/build-apk.ps1 -Abi arm64-v8a -Version 0.3.0` | 1,097 s (BUILD SUCCESSFUL in 18m 15s; 979 tasks, 126 executed), exit 0 | `release/Shubhvela-0.3.0-arm64.apk` **94.6 MB** (99,227,606 bytes) |
| Emulator | `scripts/build-apk.ps1 -Abi x86_64 -Version 0.3.0 -ScreenshotMode` (`EXPO_PUBLIC_SCREENSHOT_MODE=1`) | 855 s (BUILD SUCCESSFUL in 14m 13s; 979 tasks, 126 executed), exit 0 | `release/Shubhvela-0.3.0-x86_64.apk` **105.0 MB** (110,076,476 bytes — byte-identical in size to the c-fix build of the same tree) |

Signing: release keystore, alias `shubhvela`, via `ORG_GRADLE_PROJECT_SHUBHVELA_*` exported by the script for the Gradle child only
(no password printed anywhere). Pagefile: 11,098 MB allocated before and after both builds, in use 1,816 → 2,207 MB, peak 3,146 MB (no growth).
Disk after both builds and the script's cleanup: 8.17 GB.

### 4.1 `aapt dump badging` (build-tools 36.0.0)

Both APKs: `package: name='com.shubhvela.app' versionCode='3' versionName='0.3.0' compileSdkVersion='37'`, `sdkVersion:'24'`, `targetSdkVersion:'36'`.
- arm64: `native-code: 'arm64-v8a'` (only).
- x86_64: `native-code: 'x86_64'` (only).

### 4.2 `apksigner verify --verbose` (build-tools 36.0.0, `cmd /c "… 2>&1" | Select-String "^Verifie"`)

Both APKs: `Verifies` · v1 (JAR) false · **v2 true** · v3 false · v3.1 false · v4 false · SourceStamp false.
(The checklist wording "v2/v3 true" is met by the v2 scheme; v3 is not enabled in `build.gradle`, unchanged since Phase A.)

### 4.3 Copies and cleanup

- `release/Shubhvela-0.3.0-arm64.apk` and `release/Shubhvela-0.3.0-x86_64.apk` present; both match `.gitignore:16:release/*.apk`; `git status --porcelain` showed no release file at any point.
- `app/android/app/build` and `app/android/app/.cxx`: deleted by the script after each build (`cmd /c rmdir /s /q`); `Test-Path` → False / False at the end.

## 5. Emulator and screenshots (plan.md section 10)

- `scripts/emulator.ps1 -Boot` → AVD `shubhvela_test` (pixel_6, API 34 google_apis x86_64, physical density 420). Booted twice (below).
- `adb install -r release/Shubhvela-0.3.0-x86_64.apk` → Success (19 s); `dumpsys package` → `versionCode=3 minSdk=24 targetSdk=36 versionName=0.3.0 primaryCpuAbi=x86_64`.
- `scripts/shots.ps1 -Phase c -Density 443 -KeepRaw` (390 dp, font 1.0) for all **13 Phase C main screens × en/hi/bho × light/dark = 78 shots**, dev-route parameters as in C05/c-fix:

| label | route / `-Extra` | batch wall time |
|---|---|---|
| learn, lesson, glossary | `/(tabs)/learn`, `/learn/lesson/lesson-01`, `/learn/glossary` | 736 s |
| glossary-term, journal, journal-month | `/learn/glossary/lagna`, `/learn/journal`, `/learn/journal;scrollto=journal-month-card`, `history=1` | 437 s |
| prashna, prashna-history, ask-gate | `/charts/prashna?profile={self}`, `/charts/prashna/history`, `/charts/ask/gate`, `pro=1&history=1` | 387 s |
| backup, settings-notifications, today (en) | `/settings/backup`, `/settings/notifications`, `/(tabs)/today` | batch interrupted (below) |
| today, charts-more | `/(tabs)/today;scrollto=note-title`, `/(tabs)/charts;scrollto=more-row-prashna`, `intent=learn&history=1` | 885 s |

  The fourth batch stopped after `today-en-dark`: the agent runtime restarted (orchestrator notice) and the **emulator was gone when the step resumed**
  (`adb get-state` → no devices; the fifth unattended exit since A13, no crash log). The one file it had half-written (`raw/today-hi-light-390.png`,
  a copy of the old shrunk PNG because the pull had failed) was deleted; the emulator was rebooted (`emulator.ps1 -Boot`, APK re-installed), and all
  six `today-*` shots were re-taken together with `charts-more-*`.
- **Widgets (F9)**: `$env:TEMP\sv-widgets.ps1` (scratch script, not committed): dev route to `/settings/notifications`, scroll to `add-widget-medium`,
  tap → launcher pin dialog (shot `widget-pin-dialog-medium-en-light`) → tap "Add to home screen"; `dumpsys appwidget` afterwards lists the app's
  `SmallWidgetProvider` once and `MediumWidgetProvider` twice (the C05 instances survived on the AVD, so the small widget needed no second pin and the
  home screen shows one duplicate medium widget). Then for every lang × theme: dev route in that language (rewrites `files/widget_state.json`),
  `adb shell cmd uimode night yes|no`, `KEYCODE_HOME`, screencap → `home-widgets-{en,hi,bho}-{light,dark}.png` (6 shots). Both widgets show live
  engine output at shot time: en light 12:04 "Now 12:04 · Good · Labh choghadiya · Saturn · next: Rahu Kaal 13:13", small "Good · Abhijit · Labh
  choghadiya · next: Rahu Kaal 13:13" (Abhijit is active at 12:04, so C-M1 — a not-yet-active reason being named — does not show on this shot;
  the finding stays open in carry-over, no widget code changed); hi dark 12:06 "अभी 12:06 · शुभ · लाभ चौघड़िया · शनि · आगे:
  राहु काल 13:13", small "शुभ"; ticks 06:13 / 11:49 / 17:25 / 06:14; night tokens in dark. C-N3 (bare hora planet) is unchanged and stays in carry-over.
- Folder `.agents/tasks/v1-build/shots/phase-c/`: **129 PNG** (78 main screens + 6 home-widgets + 1 widget-pin-dialog from this step, all timestamps
  2026-10-29 10:52–12:10; the rest are the C05/c-fix extras — variants, deep links, TTS, stale/exhausted widgets, prashna-reading, learn-progress,
  match-why — not re-shot: no UI code changed since), 153 `.ui.xml`/`.bottom.ui.xml`, `audit.json`.
  **`raw/`: 85 unshrunk 1080×2400 PNG** (78 + 6 + 1) kept for the Play listing (D04), written by the new `-KeepRaw` switch of `scripts/shots.ps1`.
- PNG size gate: IHDR of all 129 top-level files read in PowerShell → **0 files over 1920 px** (all 864×1920 after `scripts/shrink-png.mjs`); `raw/learn-en-light-390.png` = 1080×2400.
- Audit: `audit.json` rebuilt from scratch (`node scripts/audit-ui-dump.mjs <folder> --density 443 --out …/audit.json`, then per-file overrides
  `--density 480` for the five `-360` dumps and `--density 420` for the two `-412` dumps) → `--summary` =
  **`{"shots":128,"smallControls":0,"intersections":0,"covered":0,"failing":0}`**; 128 entries (121 at 443 dpi, 5 at 480, 2 at 420; the 11
  launcher-window dumps home-widgets-*/widget-pin-dialog are included this time and pass trivially), 27 `strip` records (M6).
- Eye check (one image per `read_file`, eight shots covering every language × theme): `home-widgets-en-light` and `home-widgets-hi-dark` (above),
  `charts-more-en-light-390` (Prashna row "Unlock · watch an ad · 24 h", "Ask my chart · Not available on this phone — needs Android 12, 6 GB RAM and
  4 GB free", Timing and documents rows, "How this was computed" footer, 468×60 test banner, Charts tab selected),
  `lesson-hi-dark-390` (Tiro title "What a kundli is", "पाठ 1 · लगभग 5 मिनट", "मसौदा पाठ, अभी समीक्षा नहीं हुई" tag, English body with Devanagari sign
  names कन्या/मीन — the hi corpus fallback), `journal-bho-light-390` (five mood chips शांत/उदास/व्यस्त/उजियार/तनाव, disabled सहेजीं, October grid
  with mood dots उ/व/श on 23/26/28 and today 29 outlined, Moon-house number under every day),
  `prashna-en-dark-390` (120-char field, "Chart this moment", "Your question stays on this phone.", "Earlier questions"),
  `ask-gate-hi-light-390` ("Android संस्करण: 14 (12 चाहिए) शर्त पूरी करता है", "मेमोरी: 2 GB (6 चाहिए) शर्त से कम" in accent, "खाली जगह: 4.4 GB (4 चाहिए)",
  the exact unsupported sentence), `today-bho-dark-390` (daily-note rows each with "काहे?", input lines "चंद्र राउर जनम-चंद्र से 9 घर में · 22:07 ले",
  "संपत तारा · 11:12 ले", tab bar आज/परिवार/कुंडली/सीखीं with आज selected).
  HARD NO list on all eight: no gradients, glow, neon, nebula, particles, orbs, illustrations in app chrome (only Google's test creative inside the
  ad view), emoji in chrome, heavy shadows, fake numbers, testimonials, tickers, timers. 12 sp floor held; selected states visible in both themes.
  **No hard-UI violation → no fix commit, no rebuild, no re-shoot.**
  Known, not violations (all in `carry-over.md`): English interpretive text under hi/bho chrome (hi corpus absent — owner `GEMINI_API_KEY`;
  bho → hi → en by decision); Latin place/profile names (B-REVIEW-NIT-1); journal dot initials (C-N2 — the bho shot happens to show three distinct letters उ/व/श; en collides on "B").
- `adb emu kill` via `scripts/emulator.ps1 -Kill` → "OK: killing emulator, bye bye"; `Get-Process qemu-system*,emulator` → 0 processes. Disk 7.8 GB.

## 6. KNOWN ISSUE in 0.3.0 — DEV-1 (owner-reported, real phone)

The owner installed a release arm64 APK on his phone and reported that the bottom tab bar is hidden behind the phone's system navigation bar
(`carry-over.md` "OWNER-REPORTED DEVICE DEFECTS", DEV-1, BLOCKING for Phase D). The emulator (gesture navigation) never showed it. **The 0.3.0 APKs
built here carry this defect**; by the orchestrator's instruction this ship step changed no app code (the Phase C review is approved) and the fix is
owned by the next step (`c06-device-fixes`). Release notes: "tab bar can be covered by the system navigation bar on some devices; fixed in the next build".

## 7. Docs refresh, commit, tag, push

- `docs/verification/` refreshed: `carry-over.md`, `review-phase-c.md/.json`, `verification-c01…c05.md`, `verification-c-fix.md`,
  `verification-phase-c.md` (this file) copied from `.agents/tasks/v1-build/`; `docs/OWNER-TODO.md` gained the "Status after Phase C" block
  (`gh secret list --repo Sudish007/shubhvela` → still empty on 2026-10-29, so the corpus is English under hi/bho chrome by fallback);
  `docs/RELEASE-NOTES.md` created with the 0.3.0 entry and the DEV-1 known issue.
- `scripts/shots.ps1`: `-KeepRaw` switch (copies the unshrunk screencap to `<folder>/raw/` before shrinking) — committed `chore(scripts): …`.
- C-N5: `.agents/…/plan.md` is not a tracked file; the ship checklist note about `:app:testDebugUnitTest` is recorded here (§1) for d-ship.
- Commit `docs(phase-c): verification and release notes`; `git tag v0.3.0-phase-c`; `git push origin main --tags` — results in section 9.

## 8. Not verified (copied verbatim from verification-c05.md §0 "NOT RUN ON HARDWARE")

- **Gemma inference** (F35): no `.litertlm` was downloaded (disk rule, 2.6 GB), `loadLiteRtModel` / `generateLiteRtResponse` never executed. The bridge is unit-tested with a mock (`app/test/c04.test.tsx`, C04); the Kotlin module compiled into this APK (`:expo-litert-lm:assembleRelease` in build-run.log).
- **Supported-device gate path** (F35): the x86_64 AVD has 2 GB RAM and fails the gate on RAM, so only the UNSUPPORTED path was shot (§3). The consent → download → chat screens were not reached on the emulator (Jest-only, C04).
- **Multi-day Doze / WorkManager behaviour** (F9, plan P4): the 15-min widget job and the 12-h background task were forced with `cmd jobscheduler run`, never left to run for days; alarm batching, Doze deferral and the 36-h stale footer under real idle are unverified. The stale and exhausted footers are evidenced by the dev route (`widget_state=stale|exhausted`, real engine output with a moved clock — §4) and by the C01 JVM test (`BandRendererTest` 9/9).
- **Real exact-alarm grant** (`SCHEDULE_EXACT_ALARM`): the API 34 emulator shows the row "Exact widget updates · Not allowed" (shots `settings-notifications-*`); the system settings page and `setExactAndAllowWhileIdle` on a real phone were not exercised. `dumpsys package`: `SCHEDULE_EXACT_ALARM: granted=false`; the boundary alarm in §4 is `setWindow` (window=+10m, the OS stretched the 2-min request as documented).
- Also not run: any arm64 device; Hindi/Bhojpuri TTS voices (the emulator's Google TTS has no hi-IN voice — §5 records what the app shows instead); Play Billing; AdMob fill beyond Google's test units; cross-instance share-code scan (B-REVIEW-NIT-8, re-owned D01).

Added by this step: live purchases and real ads (no Play products, `extra.admob.live = false`); the arm64 APK was built, badged and signature-verified
but not installed by this step (the owner's phone test that found DEV-1 used an earlier arm64 build); 360/412 dp and font-scale 1.3 variants not re-shot
(C05 shots stand; no UI code changed); the Vargas/Varshaphal footers (C-N6, Phase D audit).

## 9. Push result

- `1f39f17 chore(scripts): shots.ps1 -KeepRaw …` and `92cba89 docs(phase-c): verification and release notes` (docs/OWNER-TODO.md, docs/RELEASE-NOTES.md,
  docs/verification/carry-over.md, review-phase-c.md/.json, verification-c01…c05.md, verification-c-fix.md, verification-phase-c.md).
  `git pull --rebase` → up to date; pushed `2c41368..92cba89 main -> main`, tag `v0.3.0-phase-c` → `92cba89` (`git ls-remote --tags origin` confirms).
- A final `docs(phase-c): sync verification-phase-c.md` commit copies this completed file to `docs/verification/`; the tag stays on `92cba89`.
- `git status --porcelain` empty after each push; no APK, keystore or KEYSTORE-INFO.txt staged at any point; `app/android/app/build` and `.cxx` absent;
  no Gradle daemon or emulator process running. Tree left clean for `c06-device-fixes`.
