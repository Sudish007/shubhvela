# Verification A13 — Integration A + first emulator audit (2026-10-25/26)

Commit: `fix(F5): phase A integration and emulator audit fixes` on top of `f1b4c0a` (`chore(app): cap Gradle/Kotlin memory ...`, committed mid-step while paused on disk, per the orchestrator).

## 1. Integration checks (final, run again on the committed tree at 04:37)

| Command | Result |
|---|---|
| `git pull --rebase origin main` | up to date (39d2619 at start) |
| `npm test` | all green — content 9 files / 84 tests; content-tools 1 file / 16 tests; engine 18 files + 1 skipped / 717 passed + 1 skipped; app 21 suites / 133 tests (jest-expo); web: no test files (passWithNoTests). 86.6 s on an idle machine. |
| `npm run typecheck` | exit 0 (content, content-tools, engine, app, web) |
| `npm run lint` | exit 0 (app `eslint .`) |

No A09–A12 seam failures. The `schedule failed ... OS refused` / `Database not initialised` lines in the app output are existing `console.warn/error` noise inside PASSING tests (fake-deps scheduler, unmounted festival screen), not failures. One flake: `test/today-screen.test.tsx` exceeded its 30 s timeout once while the emulator and a Gradle daemon were running (passes alone in 32 s); not changed.

App test additions: `parseDevParams` now covers `style=` and `test_reminder=` (app/test/flows.test.tsx, +3 assertions inside the existing test; still 133 tests because they are expect() calls, not new `it`s).

## 2. Disk gate, pagefile and timeline

Rule applied: `(Get-PSDrive C).Free` >= 4 GB immediately BEFORE every Gradle run AND before every AVD boot; `Win32_PageFileUsage` logged before/after each build by build-apk.ps1.

| Time (IST) | Free C: | Pagefile alloc | Event |
|---|---|---|---|
| 16:5x | 0.97 -> 1.10 GB | — | start; `npm cache clean --force` + 773 TEMP files > 1 day (247 MB); WARNING sent, waited |
| 17:3x | 17.96 | — | owner freed space; `emulator.ps1 -Install` ok (304 s): emulator pkg + `system-images;android-34;google_apis;x86_64` + AVD `shubhvela_test` (pixel_6); SDK 3.52 -> 8.87 GB |
| 17:40 | 12.77 | — | build 1: BUILD FAILED after 10 min configuration — "SDK location not found" (no ANDROID_HOME, local.properties gitignored); build-run.log empty (PowerShell 5.1 `*>` + `$ErrorActionPreference='Stop'` abort on gradlew's first stderr line) |
| 18:1x | 4.59 -> 0.00 | 26,278 MB (peak use 7,535 MB) | build 2 (fixed script): 268 tasks, Gradle cache re-downloaded, died at `:app:mergeReleaseNativeLibs` with the disk at 0 bytes — the system-managed pagefile had grown by ~11 GB (Gradle -Xmx4096m + Kotlin daemon + Node); WARNING sent, waited |
| 02:3x | 17.97 | 15,260 MB | owner freed space + daemons exited; memory caps committed (f1b4c0a) |
| 02:40 | 17.98 -> 15.73 | 15,260 | build 3: `checkReleaseAarMetadata` FAILED — 22 Expo SDK 58 AARs require compileSdk 37; `platforms;android-37.0` installed (0.15 GB), compileSdk 37 set in gradle.properties + app.json |
| 03:0x | 15.58 | 15,260 | build 4 (354 s): `minifyReleaseWithR8` FAILED — missing protobuf annotation classes from com.google.mediapipe tasks-genai (expo-litert-lm); 4 `-dontwarn` rules from missing_rules.txt added |
| 03:1x | 15.46 | 15,260 (use 2.1 -> 2.0 GB) | build 5 (497 s) OK; boot 134 s; first launch CRASHED: `Failed to create an instance of class androidx.work.impl.WorkDatabase.canonicalName` (R8 full mode dropped the no-arg ctor Room needs); `-keep class * extends androidx.room.RoomDatabase { <init>(); }` added |
| 03:4x | 13.23 -> 11.87 | 15,260 (use 1.9 -> 3.5 GB) | build 6 (1,732 s, cold daemon) OK; boot 73 s; app runs; dev route works |
| 21:5x–23:3x | 11.7 | 15,260 | build 7 (857 s; dev-route `style=` + `{self}`); 84 shots at 390 dp; build 8 (667 s; `test_reminder=1`); build 9 (834 s; reminder delayed after the launch re-plan) |
| 04:2x | 13.59 | 13,432 (use 1.6 GB) | end: android/app/build + .cxx + 23 node_modules/*/android/{build,.cxx} deleted, `gradlew --stop`, `adb emu kill` |

Pagefile allocation never grew again after the caps (15,260 -> 13,432 MB over the night). Peak in-use during a capped build: 3.8 GB.

## 3. Build (final APK)

`scripts/build-apk.ps1 -Abi x86_64 -Version 0.1.0 -ScreenshotMode` (build 9, 834 s Gradle):

```
APK: c:\Users\sudiskmr\Downloads\DomainClassification\shubhvela\release\Shubhvela-0.1.0-x86_64.apk (100.6 MB)
package: name='com.shubhvela.app' versionCode='1' versionName='0.1.0' platformBuildVersionName='17' platformBuildVersionCode='37' compileSdkVersion='37'
sdkVersion:'24'   targetSdkVersion:'36'   native-code: 'x86_64'
Verifies
Verified using v2 scheme (APK Signature Scheme v2): true   (v1/v3/v3.1/v4: false)
```
Signing: release keystore (alias shubhvela) via ORG_GRADLE_PROJECT_* env for the Gradle child; passwords never printed.

Build-affecting fixes (all in android/ or scripts/, no app behaviour change):
- `app/android/gradle.properties`: `-Xmx3072m -XX:MaxMetaspaceSize=512m`, `kotlin.daemon.jvmargs=-Xmx2048m`, `workers.max=2`, `parallel=false`, `configureondemand=false`; `android.compileSdkVersion=37` (+ `app/app.json` expo-build-properties `compileSdkVersion: 37`; targetSdk stays 36, minSdk 24).
- `app/android/app/proguard-rules.pro`: `-dontwarn com.google.protobuf.{Internal$ProtoNonnullApi,ProtoField,ProtoPresenceBits,ProtoPresenceCheckedField}`; `-keep class * extends androidx.room.RoomDatabase { <init>(); }`.
- `scripts/build-apk.ps1`: exports ANDROID_HOME when unset; gradlew via `cmd /c ... > log 2>&1`; pagefile logging; `gradlew --stop` after every build.
- `scripts/emulator.ps1`: uiautomator dump through cmd with retries (adb's "null root node" stderr line aborted the script under Stop).

## 4. Emulator, shots, audit

- AVD `shubhvela_test` (pixel_6, API 34 google_apis x86_64, 1080x2400 @ 420 dpi): boots in 73–134 s with `-no-snapshot -no-boot-anim -no-audio -gpu swiftshader_indirect`; the "System UI isn't responding" dialog appeared on 2 of 5 boots and was dismissed by the script (Wait tapped at 540,1363). The emulator exited by itself once overnight (after the 84-shot batch, cause not logged) and was rebooted.
- `adb install -r` 19–25 s. Carry-over A-INFO-2 confirmed: no "Invalid hook call" or any ReactNativeJS error in logcat at first launch or on any of the 10 probed routes.
- Shots: `scripts/shots.ps1 -Phase a` (rewritten: `label=route[;style=..][;tap=testID]` specs, `{self}` profile id, cold start per shot with `am start -S --activity-clear-task`, wait for the `*-skeleton` node to disappear, taps by resource-id, full-scroll `.bottom.ui.xml` dump when a sticky CTA exists). Folder `.agents/tasks/v1-build/shots/phase-a/`: **94 PNG** (84 = 14 screens x en/hi/bho x light/dark at 390 dp (`wm density 443`) + 3 x 360 dp (`density 480`) + 3 x 412 dp (default) + 3 x font_scale 1.3 at 390 dp, + `f25-airplane-notification.png`), 93 `.ui.xml`, 12 `.bottom.ui.xml`, `audit.json`; 200 files total (>= 90 required). All PNGs shrunk to 864x1920 before any read.
- Screens: onboarding-consent, onboarding-birth, today, today-segments (tap `segments-toggle`), today-panchang-sheet (tap `panchang-pill`), charts-north/south/east (`&style=`), charts-planet-sheet (tap `planet-row-Mo`), dasha-tree (`/charts/dasha-tree?profile={self}`), family, family-calendar, festival-detail (`/family/festival/diwali?year=2026`), settings.
- Audit `node scripts/audit-ui-dump.mjs --summary shots/phase-a/audit.json`: `{"shots":93,"smallControls":0,"intersections":0,"covered":0,"failing":0}`; `coveredChecked` true on 93/93 (12 via bottom dumps, 81 have no fixed chrome over the scroll view).
- Audit script fixes (scripts/audit-ui-dump.mjs), each from a real false positive on the dumps: (a) uiautomator FLATTENS RN's view tree, so "sibling" intersections were parent-vs-child — now any pair that overlaps without containment (2 px tolerance), with pairs across the sticky-CTA boundary excluded (membership by document order); (b) scroll children are CLIPPED to the ScrollView bounds (a 56 dp row half under the tab bar reads as 28 dp) — clickable nodes touching a viewport edge are skipped; (c) `covered` is measured on the full-scroll dump against `screen-cta` with the 16 dp clearance rule (+1 px rounding: 16 dp = 44.3 px at 443 dpi, RN lays out 44 px = 15.9 dp); tab screens' ScrollView ends at the tab bar so nothing can be under it; (d) `--summary` mode.
- Eye check (one read per image, 18 shots opened: consent en-light/hi-dark, birth en-light, today en-light/bho-dark/segments/panchang-sheet, charts hi-dark north, south hi-light, east en-dark, planet sheet bho-light, dasha-tree en-light, family hi-light, calendar bho-dark, festival en-light, settings hi-light, today/charts 1.3x, family 360): no gradients/glow/shadows/emoji; 12 sp floor held (smallest visible text = 12 sp captions/chart numerals); Tiro titles + Noto body render in hi/bho without tofu; dark theme shows selected chip/tab/segment state (fill + underline); at 1.3x the band drops the inline "Good" label (<60 dp rule N3) and nothing clips; tab labels fit at 1.3x and 360 dp. **No hard-UI violation found; no UI code changed.**
- Observed, not violations: hi/bho screens show English corpus sentences (carry-over A-INFO-1, by owner decision); dasha-tree's "You are here" pinned strip sits above the title row by design (Screen `pinned`); Diwali 2026 shows Sunrise 06:20 · Moonrise 06:20 (Amavasya; engine output).

## 5. F25 airplane-mode smoke and F1 timing

- Helper added (screenshot build only): `shubhvela://dev/state?...&test_reminder=1` -> `app/src/dev/testReminder.ts` requests permission, ensures the `events` channel and schedules ONE notification 2 min ahead through `expoScheduleDeps` (the real bridge), 6 s after launch. Finding: the first two attempts were silently CANCELLED — `replanAll()` runs 1.5 s after mount and calls `cancelAllScheduledNotificationsAsync()` before scheduling the (empty) plan; `dumpsys alarm` showed `Reason=alarm_cancelled`. Design-conforming behaviour, but C01's background re-plan must keep this order in mind.
- Run (device clock IST): app started 04:00:48, alarm registered for 04:02:54 (`*walarm*:expo.modules.notifications.NOTIFICATION_EVENT`, `setAndAllowWhileIdle` because SCHEDULE_EXACT_ALARM is not held), airplane mode ON at 04:01:03 (`settings get global airplane_mode_on` = 1), app sent to HOME; notification posted by 04:04:38 with airplane mode still 1: `dumpsys notification --noredact` -> `pkg=com.shubhvela.app ... android.title=String (Shubhvela test reminder)`; shade screenshot `shots/phase-a/f25-airplane-notification.png` (airplane icon in the status bar). Delivery was ~1.5–2 min after the target because inexact alarms are batched on API 34 — on a real reminder (19:00 / 07:00) this jitter is irrelevant; exact alarms arrive with the C01 "Exact widget updates" opt-in.
- F1 cold start (x86_64 emulator, swiftshader, seeded Priya): `am start -W` LaunchState COLD TotalTime 1,492 ms (3,469 ms right after install); first value (`today-moon-line`) in the UI dump at 7.9 s; full Good-hours card at 12.4 s (uiautomator dump granularity ~0.7–1.5 s). Spec test "<= 10 s from install to the first value" holds on the emulator; a real arm64 phone is expected to be faster (SwiftShader + x86_64 translation here).

## 6. Not verified
- Anything on a physical arm64 device (performance, fonts, pickers, GPS); only the x86_64 emulator was used (arm64 APK is a-ship).
- `npm run typecheck` / `npm run lint` of the final 04:37 run returned no error lines but the exit code line was lost in the log encoding; the identical tree passed both with exit 0 in-process at 03:2x.
- The reminder path with a REAL series (tithi birthday / barsi / vrat) on device — only the bridge + channel + alarm + airplane delivery were exercised, with a dev-scheduled notification.
- Exact-alarm delivery (SCHEDULE_EXACT_ALARM not granted on the emulator).
- Scrolled variants of every screen (only the 12 CTA screens have full-scroll dumps; others had no fixed bottom chrome over content).
- TalkBack order, reduced-motion, RTL, landscape.
- Today-screen jest flake under heavy host load (timeout 30 s) — passes alone.
- The emulator's unattended exit after the first 84-shot batch (no crash log captured).
