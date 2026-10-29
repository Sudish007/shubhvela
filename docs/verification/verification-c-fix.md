# Verification — c-fix · Phase C fixer, iteration 1 (no `review-phase-c.json` existed)

Date: 2026-10-29 07:4x → 09:2x IST. Worktree `c:/Users/sudiskmr/Downloads/DomainClassification/shubhvela`, branch `main`, base `b6e741e` (C05).
Commits (pushed to origin/main after `git pull --rebase`, see §7): `6b76091 fix(F18): how-computed footers name the node mode once` · `cd79ac6 fix(F32): drop the dead 'Learn: not in this build yet' strings` · `2c41368 fix(F18): shots.ps1 type= step; dev seed history test`.

## 0. NOT RUN ON HARDWARE (unchanged from verification-c05.md §0, restated so the reviewer need not cross-read)

Gemma inference (no `.litertlm` downloaded, disk rule; bridge mocked in `app/test/c04.test.tsx`); the supported-device gate path (AVD = 2 GB RAM → unsupported path only); multi-day Doze / WorkManager behaviour (jobs forced with `cmd jobscheduler run`, never left for days); a real `SCHEDULE_EXACT_ALARM` grant (`granted=false` on the AVD; boundary alarm is `setWindow`, stretched to 10 min by the OS); any arm64 device; Hindi/Bhojpuri TTS voices (the image has no hi voice data → `tts.failed` notice); Play Billing; AdMob fill beyond Google's test units; cross-instance share-code scan (B-REVIEW-NIT-8 → D01).

## 1. Verification set on the final tree (`2c41368`)

| Command | Result |
|---|---|
| `npm test` (root, run twice: before the edits on `b6e741e` and after on `2c41368`) | content **11 files / 106 tests**; content-tools **1 / 16**; engine **32 / 1057**; app **36 suites / 329 tests / 13 snapshots** (C05: 328; +1 `flows.test.tsx` dev-seed test); web: no tests. exit 0 both times. |
| `npm run typecheck` | exit 0 in all 5 workspaces (after the edits). |
| `npm run lint` | exit 0, 0 warnings (after the edits). |
| `packages/engine/reference/results*.json` | only `generatedAt` changed when the suites ran → `git checkout`, not committed. |
| Disk | 10.13 GB free before build 1 (≥ 4 GB gate), 7.42 after build 1, 8.73 after cleanup; 8.73 before build 2, 7.38 after, 8.73 after cleanup. `app/android/app/build` and `.cxx` absent at the end. |

## 2. Seams found and fixed

### 2.1 The C05 APK's JS bundle predated the `history=1` dev seed → the prashna-history, journal-month and backup-count evidence was empty (F18, F34, backup)

Facts: `app/src/dev/seed.ts` was last written 18:01:42, `params.ts` 18:02:33, `app/app/dev/state.tsx` 18:02:32 (2026-10-28); C05's build 2 started 17:58 and its `createBundleReleaseJsAndAssets` task runs in the first minutes, so the APK built at 18:11 did not contain the `history` flag. verification-c05.md §8.2 blamed "the screens' focus effect read before the transaction commit"; that explanation is wrong — `seedSampleState` is fully synchronous (`execSync` BEGIN … COMMIT on the one connection, before `router.replace`) and the new test `flows.test.tsx › dev route history=1 …` proves the seed writes 1 prashna row, 3 journal days and lesson-01 done (and that a plain seed clears them again).
Fix: rebuilt the x86_64 screenshot APK from the current tree (build 1, 20 m 05 s — full C++ because C05 deleted `node_modules/*/android/.cxx`), re-shot the affected screens (§4). The rebuilt APK shows the content in every one of them, which confirms the cause.

### 2.2 "How this was computed" footers read "mean node node" (F18 Prashna; also F15 KP, F12 vargas, F17 Varshaphal from Phase B)

Seen on the Prashna reading shot ("Lahiri ayanamsa, mean node node, whole-sign houses") and already recorded unnoticed in the KP pseudo-locale snapshot ("mean node (default) xxxxx node"). The `{node}` slot of `prashna/kp/vargas/varshaphal.howComputed` is followed by the word "node" (hi/bho: "राहु") in the string, but the screens passed the whole settings label "Mean node" (hi "मध्यम राहु" → "मध्यम राहु राहु").
Fix (`6b76091`): `nodeWord(label)` in `app/src/settingsLabels.ts` = `shortValue(label).split(' ')[0].toLowerCase()` ("mean" / "मध्यम" / "स्पष्ट"), used by the four footers and by `settings/calculation.tsx` (which had the same expression inline). The chart "Born …" caption, the South/East centre lines, the deep-link extras line and the panchang `ComputedFooter` keep the full label because their sentences do not repeat the word. One snapshot updated (`charts-extras.test.tsx.snap`, KP footer line only). On device after the rebuild: Prashna "Lahiri ayanamsa, mean node, whole-sign houses." (`prashna-reading-en-light-390-scrolled`), KP "… proportions; mean node; times in Asia/Kolkata." (`kp-footer-en-light-390-scrolled`).

### 2.3 Dead placeholder strings (F32)

`common.learnNotYetTitle/Body` ("Learn: not in this build yet" / "Lessons, the glossary and the journal arrive in a later build.") were the A/B empty-Learn copy; C03 filled the tab and nothing references them (grep over `app/`). Removed from `ui/en|hi|bho.json` (`cd79ac6`; 1882 keys each, identical sets, content tests 106/106). No screen changed.

### 2.4 Tooling (`2c41368`)

`scripts/shots.ps1` spec part `type=<resource-id>:<ascii text>` (focus the field, `adb shell input text` with `%s` for spaces, `KEYCODE_BACK` to hide the keyboard, then the `tap=` targets) — needed to shoot the F18 reading state, which C05 never reached (its `tap=prashna-cast` ran on an empty field and shot the validation message). ASCII only; parser check 0 errors. Lesson for later batches: pass multi-spec arrays by calling the script in-process (`& scripts/shots.ps1 -Screens @(...)`); `powershell -File` flattens the array into one literal string.

## 3. Spec section 3 acceptance tests re-checked (gate path + mocked bridge for F35)

| Feature | How checked in this step | Result |
|---|---|---|
| F9 widgets | C05 shots re-opened: `home-widgets-en-light` (both widgets, merged band with dots/hatch/indigo night, ticks 06:13·11:49·17:26·06:13, Now line, next family tithi; small widget verdict + swatch + next), stale/exhausted footers, boundary alarm and job evidence in verification-c05.md §4. No widget code changed → not re-pinned. | pass (emulator); Doze over days not run |
| F10 TTS | C05 `tts-*` shots + logcat (GoogleTtsService driven for en; hi/bho honest failure notice). No TTS code changed. | pass on en; hi/bho voices absent on the image |
| F18 Prashna | **New:** `prashna-reading-en-{light,dark}-390` (typed question → "Chart this moment" → reading card with the chart of 08:29/09:12 at Lucknow, Lagna of the hour Vrishchika, Moon Vrishabha·Rohini 4, hora), `prashna-reading-en-light-390-scrolled` (seven interpretive rows each with "Why?", footer "Lahiri ayanamsa, mean node, whole-sign houses", "Earlier questions" row); `prashna-history-{en,hi,bho}-{light,dark}-390` re-shot with the history seed: the question, "29 Oct 2026 · 06:22 · 26.85, 80.95", Delete control. Gated by `prashna` key / Pro (`charts-more-*`: "Unlock · watch an ad · 24 h"). | pass |
| F32 lessons | 21 lessons listed (`learn-*`); **new on device:** `learn-progress-en-light-390` ("1 of 21 done", lesson 1 "Done", "Continue with lesson 2"); `match-why-varna-level1` vs `match-why-varna-level2-en-light-390`: with no lesson done the Varna "Why?" sheet shows "One-line meaning"; with lesson 1 done it shows the level-2 "Explanation" paragraph — deeper "Why?" text unlocked by a lesson, nothing commercial. `lesson-tryit-yogas-en-light-390`: "Try it on your chart" from lesson 14 lands on Charts scrolled to the Yogas card; `lesson-tryit-revisit-en-light-390`: after scrolling Charts to the top and switching Today → Charts the tab stays at the top ("Charts · Priya · Lagna · Moon · Sun · Chalit · D1 Rashi chart"), so the `?card=` param was cleared by `router.setParams` on expo-router 58 (the C03 open item). | pass |
| F33 glossary | C05 `glossary-*`, `glossary-term-*` (264 terms; Devanagari + Latin + one line; Why? → term route unit-tested). Unchanged. | pass |
| F34 journal | `journal-*` (two-tap entry; five mood words); **re-shot** `journal-month-{en,hi,bho}-{light,dark}-390` with the seed: mood dots on 23/26/28 Oct, Moon-house number under every day, today outlined, legend ending "for reflection, not proof", footer about the encrypted backup. Observation for the reviewer (not changed — it would alter what the user sees beyond design.md 10.7): the dot carries the mood word's initial, and Bright and Busy share "B" (23 Oct Bright, 26 Oct Busy both read "B"); the full word is in the dot's accessibility label. | pass; NIT noted |
| F35 Ask my chart | Gate path on the AVD (`ask-gate-*`: Android 14 meets · Memory 2 GB (6 needed) below · Free storage 4.5 GB meets · the exact unsupported sentence; `charts-more-*` row text), no cloud fallback; label text pinned by `completeness.test.ts`; consent → download → chat and the bridge by `c04.test.tsx` (mocked `expo-litert-lm`). Unchanged. | pass (gate on emulator; inference not run) |
| F37 deep links | C05 `deeplink-{festival,kundli,m,panchang,invalid}-en-light-390` via `am start -a VIEW`. Unchanged. | pass |
| Backup round trip | **Re-run** with the history seed on the rebuilt APK: `dev/state backup-roundtrip {"bytes":1715,…,"counts":{"profiles":2,"ancestors":1,"reminders":0,"journal":3,"prashna":1,"muhurats":0,"lessons":1},"merged":{"inserted":4,"updated":9},"wrongPassphraseRejected":true,"ms":671}` — export → AES-256-GCM/PBKDF2-600k via react-native-quick-crypto → wrong passphrase rejected → Merge; the 4 "inserted" are the journal/lesson upserts counted by `changes` (`apply.ts`), the prashna row was de-duplicated; nothing duplicated. The user-facing line shows the file's item count, so the inserted/updated split is dev-log only. | pass |

## 4. Shots added / replaced in `shots/phase-c/` (all ≤ 1920 px per side, one `.ui.xml` each)

Replaced (now with content): `prashna-history-{en,hi,bho}-{light,dark}-390`, `journal-month-{en,hi,bho}-{light,dark}-390`, `backup-roundtrip-en-light-390`.
New: `prashna-reading-en-{light,dark}-390`, `prashna-reading-en-light-390-scrolled`, `learn-progress-en-light-390`, `lesson-tryit-yogas-en-light-390`, `lesson-tryit-revisit-en-light-390`, `match-why-varna-{level1,level2}-en-light-390`, `kp-footer-en-light-390-scrolled`.
Folder now 128 PNG. `audit.json` re-run for the 22 new/replaced dumps at `--density 443` → **`{"shots":117,"smallControls":0,"intersections":0,"covered":0,"failing":0}`** (C05: 108).

Eye check (one read per image): `home-widgets-en-light`, `prashna-en-light-390`, `charts-more-en-light-390`, `journal-month-hi-light-390` (before), `journal-month-en-light-390` (after), `lesson-en-light-390`, `ask-gate-bho-dark-390`, `prashna-reading-en-light-390`, `prashna-reading-en-light-390-scrolled`, `prashna-history-hi-dark-390`. HARD NO list: no gradients, glow, shadows, emoji, stock art, fake numbers or testimonials on any screen opened; 12 sp floor and 44 dp controls hold (audit); Tiro titles + Noto body; Latin tabular digits; "Why?" on every interpretive row; "Draft text, not yet reviewed" tag on lessons; "for reflection, not proof" on the journal. **No hard-UI violation found on any screen, in scope or not.**

## 5. Build and emulator

Build 1 (`-Detached`, PID 14532, 07:50 → 08:10): BUILD SUCCESSFUL in 20 m 05 s (979 tasks, 834 executed — full C++ rebuild). Build 2 after the footer fix (PID 6856, 08:52 → 09:02): BUILD SUCCESSFUL in 9 m 58 s (80 executed). `-Finish` each time: `release/Shubhvela-0.3.0-x86_64.apk` = **110,076,476 bytes** (final), `package: name='com.shubhvela.app' versionCode='3' versionName='0.3.0'`, `sdkVersion:'24'`, `targetSdkVersion:'36'`, `native-code: 'x86_64'`, `Verified using v2 scheme (APK Signature Scheme v2): true`; release keystore via `ORG_GRADLE_PROJECT_*` for the child only. Emulator `shubhvela_test` booted twice (`scripts/emulator.ps1 -Boot`, swiftshader), `adb install -r` Success, `wm density 443` for every shot, killed at the end. **No arm64 APK built** (c-ship).

## 6. Carry-over status (unchanged items re-owned, nothing new BLOCKING)

Still open: B-REVIEW-MEDIUM-1 (Yoni table — engine/D gate, content sourcing), B-REVIEW-NIT-1 (name_hi — D01), B-REVIEW-NIT-4 (native ad pixels — device), B-REVIEW-NIT-5 (docs — ship), B-REVIEW-NIT-7 (muhurat location mode — D polish), B-REVIEW-NIT-8 (cross-instance code — D01), A-REVIEW-MEDIUM-3 (hi corpus — owner key), A-REVIEW-MEDIUM-4 (grievance address — D01/D04), A-REVIEW-NIT-3 (Sheetala Ashtami 2028 — D01). B-REVIEW-NIT-2 (Pro lede) stays true: F35 ships behind Pro.
New NIT for the reviewer: journal month dot initials collide for Bright/Busy (§3 F34) — design decision, not changed here.
Correction to verification-c05.md §3/§8.2: the empty prashna-history/journal/backup-count evidence was an APK-predates-code artefact (§2.1), not a transaction-timing effect.

## 7. Git

`git pull --rebase origin main` (origin was 0 behind) → `git push origin main`: `b6e741e..2c41368`. Working tree clean afterwards (`.agents/` is gitignored).
