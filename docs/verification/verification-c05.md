# Verification — C05 · Integration C + emulator audit (F9, F10, F18, F32–F35, F37, backup)

Dates: 2026-10-28 17:0x → 2026-10-29 07:4x IST. Worktree `c:/Users/sudiskmr/Downloads/DomainClassification/shubhvela`, branch `main`, base `17420ac` (C04).
Commit `b6e741e fix(F9): phase C integration and audit fixes` (pushed to origin/main 2026-10-29 02:25; `git pull --rebase` was a no-op).
The step was interrupted twice (a Gradle run hit the harness's 30-min ceiling and left cmd.exe at "Terminate batch job (Y/N)?", 2026-10-28 17:49–17:57; the agent runtime restarted at ~03:35 after the first shots batch). All work survived on disk; nothing was redone from scratch.

## 0. NOT RUN ON HARDWARE (binding statement, build-rules Phase C)

- **Gemma inference** (F35): no `.litertlm` was downloaded (disk rule, 2.6 GB), `loadLiteRtModel` / `generateLiteRtResponse` never executed. The bridge is unit-tested with a mock (`app/test/c04.test.tsx`, C04); the Kotlin module compiled into this APK (`:expo-litert-lm:assembleRelease` in build-run.log).
- **Supported-device gate path** (F35): the x86_64 AVD has 2 GB RAM and fails the gate on RAM, so only the UNSUPPORTED path was shot (§3). The consent → download → chat screens were not reached on the emulator (Jest-only, C04).
- **Multi-day Doze / WorkManager behaviour** (F9, plan P4): the 15-min widget job and the 12-h background task were forced with `cmd jobscheduler run`, never left to run for days; alarm batching, Doze deferral and the 36-h stale footer under real idle are unverified. The stale and exhausted footers are evidenced by the dev route (`widget_state=stale|exhausted`, real engine output with a moved clock — §4) and by the C01 JVM test (`BandRendererTest` 9/9).
- **Real exact-alarm grant** (`SCHEDULE_EXACT_ALARM`): the API 34 emulator shows the row "Exact widget updates · Not allowed" (shots `settings-notifications-*`); the system settings page and `setExactAndAllowWhileIdle` on a real phone were not exercised. `dumpsys package`: `SCHEDULE_EXACT_ALARM: granted=false`; the boundary alarm in §4 is `setWindow` (window=+10m, the OS stretched the 2-min request as documented).
- Also not run: any arm64 device; Hindi/Bhojpuri TTS voices (the emulator's Google TTS has no hi-IN voice — §5 records what the app shows instead); Play Billing; AdMob fill beyond Google's test units; cross-instance share-code scan (B-REVIEW-NIT-8, re-owned D01).

## 1. Integration checks (`npm test ; npm run typecheck ; npm run lint`)

| Command | Result (tree of `b6e741e`) |
|---|---|
| `npm test` (root) | content **11 files / 106 tests**; content-tools **1 / 16**; engine **32 / 1057**; app **36 suites / 328 tests / 13 snapshots**; web: no tests. exit 0 (17:0x, before edits). After the edits the touched suites were re-run: `app-config.test.ts` + `family-screen.test.tsx` (7 → 8 passed with the new third-person assertions; 1 snapshot updated — the Amma Family Today line only), `flows.test.tsx` 5/5. |
| `npm run typecheck` | exit 0 in all 5 workspaces. |
| `npm run lint` | exit 0 (app `eslint .`), 0 warnings. |

Seams checked by the suites + the emulator: route flags (every Phase C route registered in `_layout.tsx` and reachable via the dev route), Why? → glossary (`WhySheet` rows push `/learn/glossary/<id>`, unit), Today "Today's lesson" row (`intent=learn`, shots `today-lesson-*`), Listen button (shots `today-*`, `tts-*`), More-from-chart Prashna + Ask rows (shots `charts-more-*`). No cross-cluster seam failure was found.

`packages/engine/reference/results*.json` only changed `generatedAt` when the suites ran; restored with `git checkout`, not committed.

### 1.1 Code changes in this step (commit `b6e741e`)

| File | Change |
|---|---|
| `app/app.json`, `app/android/app/build.gradle`, `app/test/app-config.test.ts` | **0.3.0 / versionCode 3** (P13) in both files, guard test updated. |
| `app/src/family/FamilyTodayCard.tsx`, `app/app/(tabs)/family.tsx`, `app/test/family-screen.test.tsx` (+snapshot) | **Carry-over B-REVIEW-MEDIUM-2 closed**: `familyTodayNote(row, lang, isSelf)` uses `lookup('daily-third', id, lang)` (C02 corpus, `{name}`) for members other than the self profile and falls back to the second-person `daily` text; the self row keeps "your birth Moon". Test: Priya row matches `/your birth Moon/`, Amma row matches `/Amma's birth Moon/` and contains no "your". |
| `app/src/dev/{seed,params}.ts`, `app/app/dev/state.tsx`, `app/test/flows.test.tsx` | Dev route (screenshot build only) `history=1`: seeds one Prashna question (per-language user text, asked 2 h ago at Lucknow), three journal days (calm/busy/bright), lesson 1 done — so history/journal shots can show content. |
| `scripts/build-apk.ps1` | `-Detached` (hidden cmd.exe via `Start-Process`, prints the PID) and `-Finish` (copy + aapt + apksigner + clean without building). Reason: a harness timeout sends Ctrl+C into the foreground batch job and hangs cmd at "Terminate batch job (Y/N)?" (happened 17:49). |
| `scripts/shots.ps1` | `scrollto=<resource-id>` spec part: scroll until the node is on screen without tapping it (frames "More from this chart", the journal month grid, the Listen title row). |

## 2. Disk gate, build, APK

| Time | Free C: | Event |
|---|---|---|
| 17:0x | 8.52 GB | start; `npm test` |
| 17:1x | 1.0 → 1.2 | pagefile commit from the Jest run; `npm cache clean --force` + 154 TEMP entries > 1 day; waited 100 s → pagefile shrank, **8.12 GB** |
| 17:19–17:49 | 8.12 | build 1 (foreground, `scripts/build-apk.ps1 -Abi x86_64 -Version 0.3.0 -ScreenshotMode`): hit the 30-min tool ceiling at `:react-native-community_datetimepicker:mergeReleaseResources` (one task before `:app:packageRelease`); harness Ctrl+C → cmd prompt hung; orchestrator killed PID 5512 |
| 17:58–18:11 | 5.57 | build 2 (`-Detached`, PID 34972): incremental, **BUILD SUCCESSFUL in 13m 22s**, 979 tasks / 74 executed; `-Finish` copied + verified; build dirs deleted → 6.64 GB |
| 18:1x | 8.02 | 27 `node_modules/*/android/{build,.cxx}` + `app/android/build` + widget-pin build + `.kotlin` deleted; AVD boot |
| 03:2x–04:0x | 5.4 → 2.6 | emulator batches (AVD + pagefile growth); the emulator exited by itself twice (after the TTS/widget work at ~04:08 and again before the variants) — rebooted each time, only the missing shots re-taken |
| 07:4x | 10.28 | end: `adb emu kill`, `app/android/app/build` + `.cxx` absent |

APK **`release/Shubhvela-0.3.0-x86_64.apk` = 110,080,264 bytes** (2026-10-28 18:11):
```
package: name='com.shubhvela.app' versionCode='3' versionName='0.3.0' compileSdkVersion='37'
sdkVersion:'24'  targetSdkVersion:'36'  native-code: 'x86_64'
Verifies / Verified using v2 scheme (APK Signature Scheme v2): true   (v1/v3/v3.1/v4 false)
```
Signing: release keystore (alias shubhvela) via `ORG_GRADLE_PROJECT_*` env for the Gradle child; passwords never printed. `adb install -r` 29 s; `dumpsys package`: `versionCode=3 versionName=0.3.0 primaryCpuAbi=x86_64`, both widget providers, `BoundaryAlarmReceiver`, `WidgetBootReceiver` and the WorkManager `SystemJobService` registered. **No arm64 APK was built in this step** (c-ship builds it after the review).

## 3. Shots and audit (`shots/phase-c/`)

**119 PNG** (all ≤ 1920 px per side after `shrink-png.mjs`; max side measured 1920), 119 `.ui.xml`, 23 `.bottom.ui.xml`, `audit.json` (108 app dumps; the 11 launcher-window dumps — home-widgets-*, widget-pin-dialog — are not app screens and are excluded from the audit).

`node scripts/audit-ui-dump.mjs shots/phase-c --density 443` + per-file overrides (`--density 480` for `-360`, `--density 420` for `-412`), then `--summary` →
**`{"shots":108,"smallControls":0,"intersections":0,"covered":0,"failing":0}`**; `coveredChecked` 105/108; 24 `strip` records (M6): 390 dp strip 144.5 = banner 112 + **32.5**; 360 dp 135.3 = 103 + **32.3**; 412 dp 150.5 = 117.7 + **32.8**; stack screens (glossary list, festival detail) 168.3 = 112 + 32 + 24.3 gesture inset. All within ±1 dp of banner + 32.

The 13 listed screens × en/hi/bho × light/dark at 390 dp (`wm density 443`) = 78, plus extras:

| label | route / dev params | note |
|---|---|---|
| learn | `/(tabs)/learn` | + `-360`, `-412` (hi), `-390-f13`, `-390-banner` (session=4, banner strip) |
| lesson | `/learn/lesson/lesson-01` | + hi `-360`, `-390-f13` |
| glossary, glossary-term | `/learn/glossary`, `/learn/glossary/lagna` | banner on the list only |
| journal, journal-month | `/learn/journal` (+`scrollto=journal-month-card`) | month grid + en `-360`/`-390-f13`, hi `-360`/`-390-f13`/`-412` |
| prashna | `/charts/prashna?profile={self}` + `pro=1&history=1`, tap `prashna-cast` on an empty field | validation state "Type a question first" (the `tap=` ran before text entry; the reading state is covered by `c04.test.tsx`) |
| prashna-history | `/charts/prashna/history` + `pro=1&history=1` | shows the empty state: the dev route's `seedSampleState` runs `DELETE FROM prashna` and the history seed was written inside the same transaction — the screen's `useFocusEffect` re-read happened before the commit on this run. Content state verified by Jest (C04). Not a defect; see §8. |
| ask-gate | `/charts/ask/gate` | unsupported path: "Android version: 14 (meets)", "Memory: 2 GB (6 needed) below", "Free storage: 4.5 GB meets", the exact sentence; + hi `-390-f13` |
| backup | `/settings/backup` | + `backup-roundtrip-en-light-390` (after the round trip) |
| settings-notifications | `/settings/notifications` | widgets card with Small/Medium buttons, "Exact widget updates · Not allowed"; + `-yearbegins` (switch On) |
| today | `/(tabs)/today;scrollto=note-title` | daily note title row with **Listen** |
| today-lesson | `/(tabs)/today;scrollto=today-lesson` + `intent=learn&history=1` | "Today's lesson · Lesson 2 · Signs and houses" |
| charts-more | `/(tabs)/charts;scrollto=more-row-prashna` + `intent=learn` | Prashna row (first after Varshaphal for the timed profile) + "Ask my chart" row with the unsupported sentence |
| deeplink-* (5), tts-* (4), home-widgets-* (10), widget-pin-dialog | §4–§6 | |

Eye check (one read per image, shrunk): charts-more en-light + hi-dark, today en-light, journal-month bho-dark + hi 1.3×, ask-gate hi-light, prashna en-light, tts-listen hi-light, home-widgets en-light + hi-dark + after-refresh. No gradients/glow/shadows/emoji; 12 sp floor held; Tiro titles + Noto body in hi/bho without tofu; dark theme shows control state; "Why?/क्यों?/काहे?" on every interpretive row; Latin digits with tabular figures; the 7-column grid holds at 360/390/412 and 1.3×. **No hard-UI violation found; no UI code changed for the audit.** Observed, not violations: hi/bho corpus sentences in English (A-INFO-1, owner key); place names Latin in hi/bho (B-REVIEW-NIT-1, D01).

## 4. Widgets (F9) — home-screen evidence

1. **Pin**: Settings → Notifications → "Add widget to home screen" → **Medium** → launcher dialog ("Shubhvela · 4 × 2 · Good-hours band for today with the Now line and the next family date · Cancel / Add to home screen", shot `widget-pin-dialog-medium-en-light`) → tapped "Add to home screen" via uiautomator bounds + `input tap`; same for **Small** (2 × 1); `KEYCODE_HOME` → `home-widgets-en-light.png`: both widgets on the home screen. Medium: band (dots = good, hatch = avoid, indigo night keeping the pattern, 2 px now-marker), ticks 06:13 / 11:49 / 17:26 / 06:13, Now line "Now 03:32 · Good · Labh · Mercury · next: Udveg 04:37", "Family tithi · Priya's janma tithi · Chaitra Krishna Pratipada · Tu…". Small: swatch + "Good", "Labh · Brahma muhurat · next: Udveg 04:37". Every value is `engine.goodHours` output from `files/widget_state.json` (`adb root` + `cat`: `{"version":1,"writtenAt":1793224876795,"tz":"Asia/Kolkata","location":{"name":"Lucknow…"},"lang":"en",…}`).
2. **Languages × themes**: `home-widgets-{en,hi,bho}-{light,dark}` via the dev route (lang) + `adb shell cmd uimode night yes|no` (theme). hi dark: "अभी 03:56 · शुभ · लाभ · बुध · आगे: उद्वेग 04:37", "परिवार की तिथि · Priya की जन्म-तिथि · चैत्र कृष्ण प्रतिपदा · मंगल 23 मार्च", small "शुभ"; night tokens from `values-night/widget_tokens.xml`.
3. **WorkManager job**: `adb shell dumpsys jobscheduler` lists the app's WorkManager jobs under the `androidx.work.systemjobscheduler` namespace (API 34); `am broadcast -a androidx.work.diagnostics.REQUEST_DIAGNOSTICS -p com.shubhvela.app` → `WM-DiagnosticsWrkr`: `com.shubhvela.app.widgets.WidgetRefreshWorker` ENQUEUED unique name **shubhvela-widget-refresh** (Job Id 1), `expo.modules.backgroundtask.BackgroundTaskWork` ENQUEUED **EXPO_BACKGROUND_WORKER** (Job Id 0). Forced with `adb shell cmd jobscheduler run -f -n androidx.work.systemjobscheduler -u 0 com.shubhvela.app <id>` (the plan's form without `-n` targets the default namespace and finds nothing): `WM-SystemJobService: onStartJob … WidgetRefreshWorker` → `WM-WorkerWrapper: Delaying execution for com.shubhvela.app.widgets.WidgetRefreshWorker because it is being executed before schedule` → rescheduled (Job Id 3, then 6). That is WorkManager's periodic-work guard: a forced run inside the 15-min period is refused by the library itself, so the worker body cannot be forced from adb before its period elapses. **Redraw was verified through the other two paths**: the providers' `APPWIDGET_UPDATE` broadcast (`am broadcast -n …/.widgets.{Medium,Small}WidgetProvider -a android.appwidget.action.APPWIDGET_UPDATE`) and the boundary receiver (`adb root` then `am broadcast -n com.shubhvela.app/.widgets.BoundaryAlarmReceiver -a com.shubhvela.app.widgets.BOUNDARY`; the receiver is `exported=false`, so the shell user's broadcast is dropped without root) — the Now line advanced 03:32 → 03:47 → 03:52 (`home-widgets-after-refresh-en-light`).
4. **Boundary alarm**: `adb shell dumpsys alarm | Select-String shubhvela` → `RTC_WAKEUP #12: Alarm{… origWhen 1793228873012 … com.shubhvela.app} tag=*walarm*:com.shubhvela.app.widgets.BOUNDARY … origWhen=2026-10-29 04:37:53.012 window=+10m0s0ms` = the end of the Labh span shown in the widget ("next: Udveg 04:37") + 1 s, as designed; the OS stretched the 2-min window to 10 min (Android 12+ behaviour the "Exact widget updates" opt-in exists for).
5. **Stale / exhausted** (dev route `widget_state=stale|exhausted`, logcat `dev/state widget-state stale {"written":true,"widgets":2,"days":7}`): stale → medium and small both add "Open Shubhvela to refresh" (`home-widgets-stale-en-light`); exhausted → "Last known day · Sun 25 Oct 2026" + "Open Shubhvela to refresh", no verdict claimed (`home-widgets-exhausted-en-light`). The same two states are asserted by the C01 Kotlin unit test (`BandRendererTest`, 9/9; see verification-c01.md) — these screenshots are the real Canvas rendering the JVM test cannot execute.
6. **Background re-plan (N12)**: forcing Job 0 ran expo's worker: `BackgroundTaskConsumer: Executing task 'extend-widget-state'` → `TaskService: Finished task 'extend-widget-state'` → `Enqueuing worker with identifier EXPO_BACKGROUND_WORKER and '720' minutes delay` → `Worker result SUCCESS`. The JS body ran `runExtendWidgetState()` (rewrite check + `replanAll()`); the notification count in Settings was unchanged (nothing enabled on the seeded Free household except the Year-begins switch in §7).

## 5. TTS (F10)

- **en**: Today → Listen tapped (`note-listen`, bounds 830,1876–989,1997 = 44 dp) → button becomes **Stop** (`content-desc="Stop"`, shot `tts-listen-speaking-en-light-390`); `dumpsys activity services com.google.android.tts` shows `GoogleTtsService` created at the tap (`createTime=-45s` on the first check, re-created on the hi/bho runs), bound by the system on the app's behalf (`intent={act=android.intent.action.TTS_SERVICE pkg=com.google.android.tts}`). The emulator has no audio device (`-no-audio`), so no sound was heard; the engine was driven.
- **hi**: first tap → `note-tts-error` "नोट सुनाया नहीं जा सका" (`tts.failed`; shot `tts-listen-hi-light-390`): the Google TTS engine on this image accepted the hi-IN language, then failed at synthesis (no Hindi voice data installed). Second run (dark) → no notice, button stayed "सुनें" after 5 s: engine returned without speaking. **Neither run showed the `errors.tts` "no voice installed" notice**, because `Speech.getAvailableVoicesAsync()` on this image reports hi-IN voices (network voices listed by Google TTS) so `pickVoice` finds one; the honest fallback the app shows is the generic failure notice. Recorded for c-review: on a real phone with Google TTS and Hindi voice data this path speaks; on a phone without hi voices the `noVoice` notice + "Open TTS settings" is unit-tested (C01 `listen.test.tsx`).
- **bho**: tapped → no notice, no error; same engine behaviour as hi (bho → hi-IN voice). The one-time "Reading in the Hindi voice" toast is an Android `ToastAndroid` and is not captured by uiautomator dumps; it is asserted by `listen.test.tsx`.

## 6. Deep links (F37)

`adb shell am start -W -a android.intent.action.VIEW -d '<url>' com.shubhvela.app` (app running; `Status: ok`, delivered via onNewIntent) — one screenshot each (`deeplink-*-en-light-390`):

| URL | Result |
|---|---|
| `shubhvela://festival/diwali/2026` | Festival detail: "Diwali (Lakshmi Puja) · 2026 · Purnimanta · North · Lucknow · Sun 8 Nov 2026 · Kartik Krishna Amavasya · Sunrise 06:20 · Puja window 17:19–19:55" |
| `shubhvela://kundli?v=1&d=19980314&t=0642&a=0&lat=26.85&lon=80.95&tz=Asia%2FKolkata&g=f&n=Priya` | "Chart from a link · Birth details arrived from the web companion. Save them as a profile?" with the form pre-filled (14 Mar 1998, 06:42, 26.85, 80.95 · Asia/Kolkata · +05:30) |
| `shubhvela://m?v=1&d=19700705&t=0430&a=0&lat=25.59&lon=85.14&tz=Asia%2FKolkata&g=f` | Matching with side B = "Scanned code · 9J9G-8E2T-9V7J-8PXD-8000" (the payload re-encoded as the 20-char code) |
| `shubhvela://panchang/kathmandu` | Today with the place pill "Kathmandu, Bagmati Province, Nepal", sunrise 06:11 · sunset 17:23 · moonrise 18:59 (engine at Kathmandu) |
| `shubhvela://festival/nope/2026` | "This link is not valid · No festival named nope in this app · Discard · Open on the web instead" |

## 7. Backup round trip (spec §10, N9) and carry-over checks

- `shubhvela://dev/state?…&pro=1&history=1&backup_roundtrip=1&screen=/settings/backup` → logcat `dev/state backup-roundtrip {"bytes":1325,"uri":"file:///data/user/0/com.shubhvela.app/cache/dev-roundtrip.svb","counts":{"profiles":2,"ancestors":1,"reminders":0,"journal":0,"prashna":0,"muhurats":0,"lessons":0},"merged":{"inserted":0,"updated":8},"wrongPassphraseRejected":true,"ms":336}` — export → AES-256-GCM/PBKDF2 (600,000) through **react-native-quick-crypto on the device** → write → read → **wrong passphrase rejected** → decrypt → Merge (8 rows updated, nothing duplicated) in 336 ms. The counts show 0 journal/prashna/lessons for the same transaction-timing reason as the prashna-history shot (§3, §8). Shot `backup-roundtrip-en-light-390` = the Backup screen afterwards.
- **B-REVIEW-MEDIUM-3** (F17 Year begins): toggled the switch in Settings → Notifications (`year-begins-switch` checked=true, shot `settings-notifications-yearbegins-en-light-390`); `dumpsys alarm` then lists `*walarm*:expo.modules.notifications.NOTIFICATION_EVENT` entries for com.shubhvela.app (two) beside the widget BOUNDARY alarms (17 lines for the app in total). Closed.
- **B-REVIEW-MEDIUM-4** (F38/M10 Pro cold start on the build with `DELAY_APP_MEASUREMENT_INIT`): `am force-stop`, `logcat -c`, dev route `pro=1`, 45 s: **AppLovin lines 0, "Initialized AdMob" 0, "SDK version: afma" 0, UMP/IABTCF 0, Ads-tag lines 0**; the only MobileAds matches are the four `ViewManagerPropertyUpdater` warnings (Fabric view-manager registration at JS load, no SDK call). Closed.
- **B-REVIEW-MEDIUM-2** closed in code (§1.1).

## 8. Findings and decisions

1. `cmd jobscheduler run` needs `-n androidx.work.systemjobscheduler` on API 34 for WorkManager jobs; WorkManager refuses a forced run before the period ("executed before schedule"), so the periodic worker body cannot be forced from adb — redraw proven via the provider broadcast and the boundary receiver (root). Plan P4 wording should say so for c-ship/d-ship.
2. The dev route's `history=1` seed writes inside the seed transaction; on the runs here the history and backup counts read 0 because the screens' focus effect read before the commit. The shots of prashna-history (empty state) and backup counts are honest renderings of that state; the content states are Jest-verified. A later step may move the seed after the commit (dev code only).
3. Hindi TTS on the emulator image fails at synthesis with a voice "available" → the app shows `tts.failed`, not the no-voice notice; both notices exist and are unit-tested. Not a code change for this step; recorded for c-review.
4. The emulator exited by itself twice during batches (as in A13/B08); the shots script's `adb get-state` guard failed fast and only the missing shots were re-taken.
5. Learn root shows the banner strip only once the session counter reaches 4 (AdPolicy); the first Learn shots (session < 4) have none, `learn-en-light-390-banner` and the 360/412 shots (session=4) carry it with the M6 numbers above.

## 9. Carry-over status

Closed here: B-REVIEW-MEDIUM-2 (code), B-REVIEW-MEDIUM-3 (dumpsys), B-REVIEW-MEDIUM-4 (logcat). Still open and re-owned: B-REVIEW-MEDIUM-1 (Yoni table — engine/D gate; not touched: sourcing a table is content work the step may not invent), B-REVIEW-NIT-1 (name_hi — D01), B-REVIEW-NIT-4 (native ad pixels — device), B-REVIEW-NIT-5 (docs — ship), B-REVIEW-NIT-7 (muhurat location mode — D polish), B-REVIEW-NIT-8 (cross-instance code — D01), A-REVIEW-MEDIUM-3/-4, A-REVIEW-NIT-3 unchanged.
