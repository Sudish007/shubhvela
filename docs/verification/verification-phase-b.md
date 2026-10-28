# Verification — Phase B ship step `b-ship` (2026-10-28)

Workflow `wf_c5b312722b5ce956` (relaunch of `wf_86107bfa6c58305a`), worktree `c:/Users/sudiskmr/Downloads/DomainClassification/shubhvela`,
version **0.2.0 / versionCode 2**, tag **`v0.2.0-phase-b`**. Procedure: plan.md section 11 (ship checklist) and section 10 (emulator).
Every command was run from the repo root unless stated; every number is copied from the command output.

## 0. Gate

`review-phase-b.json` read first: `"verdict": "APPROVED"` (0 BLOCKING, 4 MEDIUM, 8 NIT; `review-phase-b.md` iteration 1). Shipping allowed.

## 1. Tree, pull, verification set

| Command | Result |
|---|---|
| `git --no-pager status --porcelain` | empty (clean) at HEAD `3aa826e` = origin/main |
| `git --no-pager pull --rebase origin main` | Already up to date |
| `npm test` (115 s) | exit 0 — content 10 files / **93** tests; content-tools 1 file / **16**; engine 32 files / **1056**; app 31 suites / **242** tests / 11 snapshots; web: no test files |
| `npm run typecheck` | exit 0 (content, content-tools, engine, app, web) |
| `npm run lint` | exit 0 (app `eslint .`) |
| `npm run reference:check -w packages/engine` | **exit 0** — charts 60/60 (drikpanchang 60, astrosage 60, jpl-horizons 60) · panchang 150/150 · festivals 600/600 (12 slug-years not published by Drik, `cases.json notOnDrik`) · **matching 20/20** fetched and passed (14 exact totals, 6 one-point Yoni differences documented as `koota-yoni@mXX` in CONVENTIONS §3 — carry-over B-REVIEW-MEDIUM-1) · tz 12/12 (11 births + 20 boundary offsets). "Every suite has its full reference set." |

Side effect of `npm test`: the six `packages/engine/reference/results*.json` files changed only their `generatedAt` line
(diff lines other than `generatedAt`: 0) — reverted with `git checkout -- packages/engine/reference`; tree clean again.

## 2. Disk and daemons

- `(Get-PSDrive C).Free` = **12.77 GB** before the first Gradle run (gate 4 GB) → no warning needed.
- `.\gradlew.bat --stop` from `app/android/` → "No Gradle daemons are running."

## 3. Version check

- `app/app.json`: `expo.version` = 0.2.0, `expo.android.versionCode` = 2.
- `app/android/app/build.gradle`: `applicationId 'com.shubhvela.app'`, `versionCode 2`, `versionName "0.2.0"`. Equal (also asserted by `app/test/app-config.test.ts`).

## 4. Builds (foreground, `scripts/build-apk.ps1`, tool timeout 1,800,000 ms; neither call timed out; no rerun)

| Build | Command | Gradle | Output |
|---|---|---|---|
| Device | `scripts/build-apk.ps1 -Abi arm64-v8a -Version 0.2.0` | 1,067 s, exit 0 | `release/Shubhvela-0.2.0-arm64.apk` **93.7 MB** (98,230,110 bytes) |
| Emulator | `scripts/build-apk.ps1 -Abi x86_64 -Version 0.2.0 -ScreenshotMode` (`EXPO_PUBLIC_SCREENSHOT_MODE=1`) | 729 s, exit 0 | `release/Shubhvela-0.2.0-x86_64.apk` **104.0 MB** (109,078,980 bytes) |

Signing: release keystore, alias `shubhvela`, via `ORG_GRADLE_PROJECT_SHUBHVELA_*` exported by the script for the Gradle child only
(no password printed anywhere). Pagefile: 10,707 MB allocated before and after both builds, in use 1,611 → 1,640 MB, peak 3,963 MB (no growth).
Disk after both builds and the script's cleanup: 12.1 GB.

### 4.1 `aapt dump badging` (build-tools 36.0.0)

Both APKs: `package: name='com.shubhvela.app' versionCode='2' versionName='0.2.0' compileSdkVersion='37'`, `sdkVersion:'24'`, `targetSdkVersion:'36'`.
- arm64: `native-code: 'arm64-v8a'` (only).
- x86_64: `native-code: 'x86_64'` (only).

### 4.2 `apksigner verify --verbose` (build-tools 36.0.0, `cmd /c "… 2>&1" | Select-String "^Verifie"`)

Both APKs: `Verifies` · v1 (JAR) false · **v2 true** · v3 false · v3.1 false · v4 false · SourceStamp false.
(The checklist wording "v2/v3 true" is met by the v2 scheme; v3 is not enabled in `build.gradle`, unchanged since Phase A.)

### 4.3 Copies and cleanup

- `release/Shubhvela-0.2.0-arm64.apk` and `release/Shubhvela-0.2.0-x86_64.apk` present; `git check-ignore -v` → `.gitignore:16:release/*.apk` for both, `.gitignore:23:*.log` for `app/android/build-run.log`; `git status --porcelain` empty after the builds.
- `app/android/app/build` and `app/android/app/.cxx`: `Test-Path` → False / False after the script (`cmd /c rmdir /s /q` inside build-apk.ps1).

## 5. Emulator and screenshots (plan.md section 10)

- `scripts/emulator.ps1 -Boot` → AVD `shubhvela_test` (pixel_6, API 34 google_apis x86_64, physical density 420). Booted twice (below).
- `adb install -r release/Shubhvela-0.2.0-x86_64.apk` → Success; `dumpsys package` → `versionCode=2 minSdk=24 targetSdk=36 versionName=0.2.0`.
- `scripts/shots.ps1 -Phase b -Density 443` (390 dp, font 1.0) for all **18 Phase B main screens × en/hi/bho × light/dark = 108 shots**, same dev-route parameters as B08:

| label | route / `-Extra` | variant |
|---|---|---|
| charts | `/(tabs)/charts`, `session=4` (banner) | |
| charts-vargas-sheet | `/(tabs)/charts;hscroll=chip-row;tap=chip-vargas` | |
| charts-unlock-sheet | `/(tabs)/charts;tap=more-row-ashtakavarga` | |
| ashtakavarga / kp / varshaphal | `/charts/<x>?profile={self}`, `pro=1` | |
| muhurat, muhurat-scrolled | `/charts/muhurat`, `session=4` | `-Scrolled` |
| naamkaran | `/family/naamkaran` | |
| family | `/(tabs)/family`, `session=4` | |
| family-tools | `/(tabs)/family`, `session=4` | `-Scrolled -ScrollCount 3` |
| match-result | `/family/match/result`, `session=4&q_a=p{self}&q_b=p{other}` | |
| share-code | `/family/share-code` | |
| pdf-preview | `/charts/pdf/janam_patri?profile={self}`, `pro=1` | |
| share-card-preview | `/(tabs)/charts;tap=style-menu-button,menu-share-card`, `pro=1` | |
| pro, pro-scrolled | `/pro`, `session=4` | `-Scrolled` |
| today-scrolled | `/(tabs)/today`, `session=4` | `-Scrolled -ScrollCount 4` |

  Batches and wall times: charts 284 s; vargas+unlock sheets 905 s; ashtakavarga/kp/varshaphal 367 s; muhurat 377 s + scrolled 381 s;
  naamkaran+share-code 244 s; family 262 s; match-result 238 s; pdf-preview 262 s; share-card-preview 232 s; pro 266 s + scrolled 284 s;
  today-scrolled 185 s. The family-tools batch wrote its first shot (en-light) and then hung: the **emulator had exited by itself**
  (`adb get-state` → no devices; the adb server had restarted at 09:45) — the same unattended exit A13, a-ship and B08 recorded (fourth
  occurrence, no crash log). Rebooted (`emulator.ps1 -Boot`, APK re-installed), and the remaining five family-tools shots were taken in
  three runs (46 s + 78 s + 78 s). Two mistakes with no artefact left: a first attempt passed the tap-list array through
  `powershell -File`, which flattened it (`-Screens` needs the in-process `&` call); the stray `…=…` file it created was deleted.
- Folder `.agents/tasks/v1-build/shots/phase-b/`: **110 PNG** (108 from this step, all timestamps after 06:56 2026-10-28, plus the B08/b-fix
  M6 variants `charts-en-light-360.png` and `charts-en-light-412.png`, not re-shot — no UI code changed since b-fix), 110 `.ui.xml`,
  56 `.bottom.ui.xml`, `audit.json`, `m4-native-ad-gate.json`, `pdf/` (6 PDFs from B08).
- PNG size gate: IHDR of all 110 files read in PowerShell → **0 files over 1920 px** (all 864×1920 after `scripts/shrink-png.mjs`).
- Audit: `audit.json` rebuilt from scratch (`node scripts/audit-ui-dump.mjs <folder> --density 443 --out …/audit.json`, then the two
  single-file overrides `--density 480` for `-360` and `--density 420` for `-412`) → `--summary` =
  **`{"shots":110,"smallControls":0,"intersections":0,"covered":0,"failing":0}`**; 110 entries (108 at 443 dpi, 1 at 480, 1 at 420).
  M6 strip records (dp, strip/banner/extra): 360 → 135.3/103/+32.3; 390 tabs → 144.5/112/+32.5; 390 stack screens → 168.3/112/+56.3
  (32 + the 24.3 dp gesture inset below the strip, as in B08 §4); 411 → 150.5/117.7/+32.8. All = banner + 32 ± 1 dp.
- Eye check (one image per `read_file`, six shots covering every language × theme): `charts-en-light-390` (East Indian D1, centre
  "Priya / Lahiri / Mean node" inside the cell after the b-fix wrap, Lagna Meena 6°44′, Why?, 468×60 test banner inside the 16 dp paper margins),
  `pro-hi-dark-390` (three radio cards with the yearly one selected, "49% बचत" = round((1−299/588)·100), "Play से संपर्क नहीं हो सका" inline,
  USD note + "स्टोर मूल्य अलग हो सकता है", matrix, sticky CTA "आगे बढ़ें · ₹299 प्रति वर्ष" + "आवर्ती। Play → सदस्यताएँ में रद्द करें।" + शर्तें),
  `match-result-bho-light-390` ("36 में से 25 गुण", A Priya कन्या/उत्तरा फाल्गुनी 4, B Amma कर्क/पुष्य 1, Varna 0/1, Vashya 0.5/2, Tara 1.5/3 with काहे?,
  320×50 test banner), `muhurat-en-dark-390` (Griha Pravesh chip selected, "today – +7 days" 28 Oct – 4 Nov 2026, "Any range · Pro", 42 windows,
  "Fri 30 Oct · 11:49–13:13 · 9/10 rules met" with check/cross chips incl. "Tara bala (Kshema)"), `varshaphal-hi-light-390` (वर्षफल 2026 · आयु 28,
  return 14 मार्च 2026 · 11:04 Lucknow, solar-return chart with Devanagari glyphs, मुंथा कर्क भाव 3 · स्वामी चंद्र, वर्षेश शुक्र · वर्ष लग्नेश, क्यों? on each),
  `family-tools-bho-dark-390-scrolled` (Family tools rows "मिलान खातिर साझा करीं" / "नाम अक्षर", place card सूर्योदय 06:13 · सूर्यास्त 17:26, add buttons,
  reminder note in the रउआ register, 320×100 test banner, परिवार tab selected).
  HARD NO list on all six: no gradients, glow, neon, nebula, particles, orbs, illustrations in app chrome (the only illustration is Google's
  test creative inside the ad view), emoji in chrome, heavy shadows, fake numbers, testimonials, tickers, timers. 12 sp floor held; selected
  states visible in both themes. **No hard-UI violation → no fix commit, no rebuild, no re-shoot.**
  Known, not violations (all in `carry-over.md`): English koota rule bodies on hi/bho (hi corpus absent, A-REVIEW-MEDIUM-3); Latin place
  names (B-REVIEW-NIT-1); "तारा 5 · तारा 6" raw index (B-REVIEW-NIT-3); Pro lede names "Ask my chart" before F35 (B-REVIEW-NIT-2).
- `adb emu kill` via `scripts/emulator.ps1 -Kill` → "OK: killing emulator, bye bye"; `Get-Process qemu-system*,emulator` → 0 processes. Disk 11.06 GB.

## 6. Docs refresh, commit, tag, push

- B-REVIEW-NIT-5 (owner b-ship): `verification-b08.md` §3 and §5 no longer cite a `shots/phase-b/m4/` folder; they now say the 16 dumps stayed
  in TEMP and only `m4-native-ad-gate.json` (16 records) plus one surviving dump file `m4` are kept.
- `docs/verification/` refreshed: `carry-over.md`, `review-phase-b.md/.json`, `verification-b01…b08.md`, `verification-b-fix.md`,
  `verification-phase-b.md` (this file) copied from `.agents/tasks/v1-build/`; `docs/OWNER-TODO.md` gained the "Status after Phase B" block
  (`gh secret list --repo Sudish007/shubhvela` → still empty on 2026-10-28).
- Commit `docs(phase-b): verification and release notes`; `git tag v0.2.0-phase-b`; `git push origin main --tags` — results in section 8.

## 7. Not verified

- Live Play purchases, restore and grace period: no Play products exist (owner step 3); the Pro screen shows Play's inline "Couldn't reach Play".
- Real ad units and real fill: Google test units only (`extra.admob.live = false`); the native ad card's pixels (no fill on the Play-less
  emulator); interstitial and rewarded ads on a device (caps unit-tested only).
- Cross-device / cross-instance scan or typed code (F30) and expo-camera QR recognition.
- Nothing on a physical arm64 device: the arm64 APK was built, badged and signature-verified only; it was not installed anywhere.
- M10 Pro cold-start logcat after `DELAY_APP_MEASUREMENT_INIT` (B-REVIEW-MEDIUM-4) and the F17 "Year begins" `dumpsys alarm` check
  (B-REVIEW-MEDIUM-3): assigned to C05, not run here.
- 360/412 dp and font-scale 1.3 variants were not re-shot (B08/b-fix shots stand; no UI code changed since).
- Hindi corpus: `corpus/<domain>/hi.json` does not exist (`GEMINI_API_KEY` absent), so hi/bho show English interpretive sentences.
- Yoni koota: six reference pairs differ from Drik by one point under the documented convention (B-REVIEW-MEDIUM-1, Phase D "beta" gate).
- TalkBack, RTL, landscape; the unattended emulator exit (fourth occurrence) has no captured crash log.

## 8. Push result

(filled in after the push — see the end of this file)
