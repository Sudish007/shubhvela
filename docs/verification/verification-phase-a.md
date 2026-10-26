# Verification — Phase A ship step `a-ship` (2026-10-26)

Workflow `wf_86107bfa6c58305a`, worktree `c:/Users/sudiskmr/Downloads/DomainClassification/shubhvela`, version **0.1.0 / versionCode 1**,
tag **`v0.1.0-phase-a`**. Procedure: plan.md section 11 (ship checklist) and section 10 (emulator). Every command below was run
from the repo root unless stated; every number is copied from the command output.

## 0. Gate

`review-phase-a.json` read first: `"verdict": "APPROVED"` (0 BLOCKING, 4 MEDIUM, 4 NIT; `review-phase-a.md` iteration 2). Shipping allowed.

## 1. Tree, pull, verification set

| Command | Result |
|---|---|
| `git --no-pager status --porcelain` | empty (clean) at HEAD `25735b4` |
| `git --no-pager pull --rebase origin main` | Already up to date |
| `npm test` | exit 0 — content 9 files / **84** tests; content-tools 1 file / **16**; engine 19 files + 1 skipped / **963 passed + 1 skipped**; app 21 suites / **135** tests / 6 snapshots; web: no test files (`--passWithNoTests`) |
| `npm run typecheck` | exit 0 (content, content-tools, engine, app, web) |
| `npm run lint` | exit 0 (app `eslint .`) |
| `npm run reference:check -w packages/engine` | **exit 1** — charts OK 60/60 (drikpanchang 60, astrosage 60, jpl-horizons 60) · panchang OK 150/150 · festivals OK 600/600 (12 slug-years not published by Drik, `cases.json notOnDrik`) · tz OK 12/12 (11 births + 20 boundary offsets) · **matching SHORT 0/20** (m01–m20 missing; Phase B carry-over A-REVIEW-MEDIUM-2) |

Side effect of `npm test`: the engine suites rewrote `generatedAt` in `packages/engine/reference/results.json` and
`results/{charts,festivals,panchang,tz}.json` — reverted with `git checkout -- packages/engine/reference`; tree clean again.

The `schedule failed … OS refused` / `festival failed` lines in the app jest output are `console.warn` noise inside passing
tests (fake scheduler deps), as recorded in verification-a13.md.

## 2. Disk and daemons

- `(Get-PSDrive C).Free` = **10.28 GB** before the first Gradle run (gate 4 GB) → no warning needed.
- `.\gradlew.bat --stop` from `app/android/` → "No Gradle daemons are running."

## 3. Version check

- `app/app.json`: `expo.version` = 0.1.0, `expo.android.versionCode` = 1.
- `app/android/app/build.gradle`: `applicationId 'com.shubhvela.app'`, `versionCode 1`, `versionName "0.1.0"`. Equal.

## 4. Builds (foreground, `scripts/build-apk.ps1`, timeout 1,800,000 ms, no tool timeout, no rerun)

| Build | Command | Gradle | Output |
|---|---|---|---|
| Device | `scripts/build-apk.ps1 -Abi arm64-v8a -Version 0.1.0` | 1,395 s, exit 0 | `release/Shubhvela-0.1.0-arm64.apk` **90.3 MB** (94,708,652 bytes) |
| Emulator | `scripts/build-apk.ps1 -Abi x86_64 -Version 0.1.0 -ScreenshotMode` (`EXPO_PUBLIC_SCREENSHOT_MODE=1`) | 1,096 s, exit 0 | `release/Shubhvela-0.1.0-x86_64.apk` **100.6 MB** (105,524,757 bytes) |

Signing: release keystore, alias `shubhvela`, via `ORG_GRADLE_PROJECT_SHUBHVELA_*` exported by the script for the Gradle child
only (no password printed anywhere). Pagefile before/after: 16,048 MB allocated, in use 2,120 → 3,830 MB (arm64) and
3,379 → 3,733 MB (x86_64), peak 4,520 MB — no growth. Disk after both builds and the script's cleanup: 7.92 GB.

### 4.1 `aapt dump badging` (build-tools 36.0.0)

Both APKs: `package: name='com.shubhvela.app' versionCode='1' versionName='0.1.0' compileSdkVersion='37'`,
`sdkVersion:'24'`, `targetSdkVersion:'36'`.
- arm64: `native-code: 'arm64-v8a'` (only).
- x86_64: `native-code: 'x86_64'` (only).

### 4.2 `apksigner verify --verbose` (build-tools 36.0.0, `cmd /c "… 2>&1" | Select-String "^Verifie"`)

Both APKs: `Verifies` · v1 (JAR) false · **v2 true** · v3 false · v3.1 false · v4 false · SourceStamp false.
(The checklist wording "v2/v3 true" is met by the v2 scheme; v3 is not enabled in `build.gradle`, same as every Phase A build.)

### 4.3 Copies and cleanup

- `release/Shubhvela-0.1.0-arm64.apk` and `release/Shubhvela-0.1.0-x86_64.apk` present; `git check-ignore -v` → `.gitignore:16:release/*.apk` for both; `git status --porcelain` empty after the builds.
- `android/app/build` and `android/app/.cxx`: `Test-Path` → False / False after the script (`cmd /c rmdir /s /q` inside build-apk.ps1).

## 5. Emulator and screenshots (plan.md section 10)

- `scripts/emulator.ps1 -Boot` → AVD `shubhvela_test` booted (pixel_6, API 34 google_apis x86_64, physical density 420). Booted twice (see below).
- `adb install -r release/Shubhvela-0.1.0-x86_64.apk` → Success (streamed install).
- Clock pinned as in a-fix so every shot is the same Vedic day as the earlier Phase A shots: `adb root`, `settings put global auto_time 0`, `date 102513302026.00` → `Sun Oct 25 13:30:00 IST 2026`, tz `Asia/Calcutta`.
- `scripts/shots.ps1 -Phase a -Density 443` (390 dp) with the 14 Phase A main screens × en/hi/bho × light/dark:
  `onboarding-consent=/onboarding/consent`, `onboarding-birth=/onboarding/birth`, `today=/(tabs)/today`,
  `today-segments=/(tabs)/today;tap=segments-toggle`, `today-panchang-sheet=/(tabs)/today;tap=panchang-pill`,
  `charts-north|south|east=/(tabs)/charts;style=…`, `charts-planet-sheet=/(tabs)/charts;tap=planet-row-Mo`,
  `dasha-tree=/charts/dasha-tree?profile={self}`, `family=/(tabs)/family`, `family-calendar=/family/calendar`,
  `festival-detail=/family/festival/diwali?year=2026`, `settings=/settings`.
  Run 1 (7 specs): 42 shots in 1,140 s, exit 0. Run 2 (next 7 specs) wrote charts-east ×6, charts-planet-sheet ×6 and
  dasha-tree ×3, then the **emulator exited by itself** (same unattended exit A13 recorded; `adb get-state` → no devices).
  Rebooted (`emulator.ps1 -Boot`, package still installed, clock re-pinned) and re-ran the 5 remaining specs
  (dasha-tree, family, family-calendar, festival-detail, settings): 30 shots in 648 s, exit 0. Every file was overwritten
  this session: **84 `*-390.png` + 84 `.ui.xml` + 12 `.bottom.ui.xml`** (consent + birth), all timestamps from this run.
- Folder `.agents/tasks/v1-build/shots/phase-a/`: **103 PNG** total (84 new 390 dp main shots + 19 variant/evidence files from A13/a-fix:
  3 × 360 dp, 3 × 412 dp, 3 × font-scale 1.3, scrolled/end/privacy evidence, `f25-airplane-notification.png`).
- PNG size gate: IHDR of all 103 files read in PowerShell → **0 files over 1920 px** (all 864×1920 after `scripts/shrink-png.mjs`).
- Audit: `audit.json` rebuilt from scratch per density (`node scripts/audit-ui-dump.mjs <dumps> --density 443|480|420 --out …/audit.json`):
  `{"shots":102,"smallControls":0,"intersections":0,"covered":0,"failing":0}`; 102 entries = 96 at 443 dpi/390 dp + 3 at 480/360 + 3 at 420/411
  (`f25-airplane-notification.png` has no dump); `coveredChecked` true on 102/102; 0 failing.
- Eye check (one image per `read_file`, 6 shots covering every language × theme): `today-en-light-390` (band Avoid · Neutral · Good · Avoid · Good 13:14–14:39 with the 13:36 marker · Avoid · night; Now line "Good · Shubh choghadiya · Sun hora · next: Gulika 14:39 (avoid)"; flags; legend; "All 13 segments"), `charts-north-hi-dark-390` (Tiro title, selected chip fill + underline, D1 chart, Sun glyph indigo = approx, "जन्म 14 मार्च 1998 · 06:42 · Lucknow · उत्तर भारतीय · लाहिरी · मध्यम राहु"), `family-bho-light-390` (avatars, "2 / 2 प्रोफाइल · 0 / 5 रिमाइंडर (मुफ्त)", Family Today rows with काहे?, switch shows बंद), `festival-detail-hi-light-390` (रवि 8 नव 2026, कार्तिक कृष्ण अमावस्या, "चंद्रोदय सोम 9 नव 06:20", पूजा का समय 17:19–19:55), `settings-bho-dark-390` (all rows with values; chart style reads पूरब भारतीय because the charts-east shot persisted `style=east`, i.e. the real stored setting), `onboarding-consent-en-dark-390` (sticky CTA "I understand, continue", "Read the privacy policy").
  HARD NO list on all six: no gradients, glow, neon, nebula, particles, orbs, illustrations, emoji in chrome, heavy shadows, fake numbers, testimonials, tickers. 12 sp floor held; selected states visible in dark and light. **No hard-UI violation → no fix commit, no rebuild, no re-shoot.**
  Known, not violations (carry-over): English interpretive bodies on hi/bho (A-REVIEW-MEDIUM-3), Latin place name (A-REVIEW-NIT-2), second person under Amma (A-REVIEW-NIT-1).
- `adb emu kill` via `scripts/emulator.ps1 -Kill`: the emulator had already exited after the last batch ("no emulator detected"); `Get-Process qemu-system*,emulator` → no process.

## 6. Docs refresh, commit, tag, push

- `docs/verification/` created with copies of `plan.md`, `review-phase-a.md`, `carry-over.md` and every `verification-*.md` (a01–a13, a-fix, phase-a); `docs/OWNER-TODO.md` gained a "Phase A shipped" status block (APK names, what is still open, `GEMINI_API_KEY` still absent per `gh secret list` → empty on 2026-10-26).
- Commit `docs(phase-a): verification and release notes`; `git tag v0.1.0-phase-a`; `git push origin main --tags` — results in section 8.

## 7. Not verified

- Nothing on a physical arm64 device: the arm64 APK was built, badged and signature-verified only; it was not installed anywhere (the emulator is x86_64).
- Play purchases / billing, AdMob, hardware TTS, widgets, Gemma: not part of Phase A, not in this build.
- Matching reference suite 0/20 (skipped); Holika Dahan 2026 eclipse sutak; Sheetala Ashtami 2028 — documented differences, footer reads "not yet verified".
- Hindi corpus: `corpus/<domain>/hi.json` does not exist (`GEMINI_API_KEY` absent), so hi/bho show English interpretive text.
- 360 dp, 412 dp and font-scale 1.3 variants, scrolled variants and the Why?/Legend/Houses sheets were not re-shot this step (A13 / a-fix shots, no code change since HEAD `25735b4`).
- TalkBack order, reduced motion, RTL, landscape, exact-alarm delivery.
- apksigner v3 scheme is false (only v2 is configured); Play accepts v2 — not changed here.
- The unattended emulator exit after ~55 shots (second occurrence) has no captured crash log.

## 8. Push result

- `2c6260d docs(phase-a): verification and release notes` — 22 files (docs/OWNER-TODO.md, docs/verification/* incl. this file, plan.md, review-phase-a.md/.json, carry-over.md). Pushed `25735b4..2c6260d main -> main`, tag `v0.1.0-phase-a` created.
- Correction in the same step: that commit had overwritten `docs/design.md` with the older `.agents` copy (dropping the a-fix "as built 31/30/39 %" paragraph from `25735b4`) and added a duplicate `docs/plan.md`. `bf88bc9 docs(phase-a): keep as-built planet-table note in design.md; plan.md lives under docs/verification` restores the paragraph (`git checkout HEAD~1 -- docs/design.md`, `.agents` copy re-synced from it) and removes `docs/plan.md`. Pushed `2c6260d..bf88bc9 main -> main`; the tag — created by this step minutes earlier and not yet consumed by anything — was moved to `bf88bc9` (`git tag -f`, `git push origin --force v0.1.0-phase-a`); `git ls-remote --tags origin v0.1.0-phase-a` → `bf88bc9…`.
- A final `docs(phase-a): sync verification-phase-a.md` commit copies this completed file to `docs/verification/`; the tag stays on `bf88bc9` (docs copy only).
- `git status --porcelain` empty after each push; `git ls-files release` = `release/README.md` only; no APK, keystore or KEYSTORE-INFO.txt staged at any point.
