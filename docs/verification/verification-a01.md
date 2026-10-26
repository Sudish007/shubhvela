# Verification — FEAT-A01 Bootstrap

Step `a01-bootstrap`, workflow `wf_86107bfa6c58305a`, 2026-10-24 (IST). Worktree
`c:/Users/sudiskmr/Downloads/DomainClassification/shubhvela`.

## Result summary

- Repo: https://github.com/Sudish007/shubhvela — public, branch `main`, remote `origin`.
- Pages: enabled with `build_type: workflow` immediately after the push (before any Pages workflow exists); `html_url` https://sudish007.github.io/shubhvela/.
- Commit: `743c16c chore(repo): bootstrap workspaces, vendored jyotish fork, Expo SDK 58 app, android/ (single prebuild), release tooling` (162 files; the CI workflow is part of this commit, so there is exactly one commit).
- CI run 40117901298 on GitHub: green (`npm ci` 1398 packages, `npm test`, `npm run typecheck`, `npm run lint`).
- Tests: engine 2 files / 4 tests (vitest), app 1 file / 3 tests (jest-expo), content / content-tools / web 0 tests (`--passWithNoTests`). Total 7 passing.
- Disk free on C: 3.76 GB at start, 1.53 GB at the lowest point (after dev deps), 2.55 GB at the end (after `npm cache clean --force`, which ended with an ENOTEMPTY warning but still reclaimed ~0.9 GB).

## Commands and results

| # | Command | Result |
|---|---|---|
| 1 | `git --no-pager init -b main` (identity from global includeIf: Sudish Kumar) | ok |
| 2 | `.gitignore`, `LICENSE` (MIT 2026 Sudish Kumar), `THIRD-PARTY-NOTICES.md`, `README.md`, root `package.json` (workspaces `packages/*`, `app`, `web`; engines node >=24) | written |
| 3 | `cmd /c "gh api repos/prisriorg/jyotish/tarball/c720d0ee42702cf43631d55f1ae2fe70de14bdba > %TEMP%\jyotish-vendor\jyotish.tgz"` then `tar -xzf` | 324,246 bytes; extracted `prisriorg-jyotish-c720d0e/` (package.json version 1.1.14, ISC). First attempt with PowerShell `>` corrupted the binary (UTF-16); redone through `cmd /c`. Scratch deleted afterwards. |
| 4 | Copy `src/` + `LICENSE` to `packages/engine/vendor/jyotish/`; delete `src/predictions/*` except `yogas.ts` (moved to `src/kundli/yogas.ts`, imports fixed, `YogasAndDoshasReport` + `PredictionOptions`->`YogasOptions` inlined), delete `src/i18n/dictionaries/predictions.ts` and `src/kundli/horoscope.ts` (prediction prose, was unexported upstream); rewrite `src/index.ts`; write `VENDOR.md` | 51 files vendored |
| 5 | `packages/engine` package.json / tsconfig / src/index.ts / test/public-api.test.ts / test/smoke.test.ts; minimal `packages/content`, `packages/content-tools`, `web` | written |
| 6 | `npx --yes create-expo-app@latest app --template blank-typescript --no-install` | create-expo-app 5.0.0; template expo ~58.0.19, RN 0.88.0, react 19.3.0, typescript ~6.0.3. Removed the template's duplicate Expo `LICENSE`, `App.tsx`, `index.ts`; `main` -> `expo-router/entry`; name -> `@shubhvela/app`; template `.gitignore` rewritten without `/android`. |
| 7 | root `npm install --no-audit --no-fund` | added 500 packages in 2m |
| 8 | `npx expo install expo-router expo-sqlite expo-notifications expo-print expo-sharing expo-speech expo-file-system expo-background-task expo-task-manager expo-document-picker expo-camera expo-location expo-constants expo-linking expo-status-bar expo-font expo-asset expo-build-properties expo-device expo-network expo-iap expo-litert-lm react-native-google-mobile-ads react-native-svg react-native-safe-area-context react-native-screens react-native-webview react-native-view-shot react-native-qrcode-svg react-native-quick-crypto react-native-nitro-modules react-native-quick-base64 react-native-reanimated react-native-gesture-handler react-native-worklets` | 28 SDK-58 modules + 7 others, added 162 packages. `npm view expo-router@58.0.26 peerDependencies` lists `react-native-reanimated`, `react-native-gesture-handler`, `react-native-worklets` (all three marked optional in `peerDependenciesMeta`); installed anyway because android/ is generated once. |
| 9 | `npx expo install --dev jest jest-expo @testing-library/react-native @types/jest eslint eslint-config-expo` | ok |
| 10 | `npx expo install expo-system-ui` (after prebuild, see note) | 58.0.6 |
| 11 | `app/app.json`, `metro.config.js` (assetExts += sqlite, monorepo watchFolders/nodeModulesPaths), `jest.config.js` (preset jest-expo), `eslint.config.js` (eslint-config-expo/flat), `tsconfig.json`, `app/app/_layout.tsx`, `app/app/index.tsx`, `app/test/app-config.test.ts` | written |
| 12 | `npx expo prebuild --platform android --no-install --clean` (from `app/`) | First invocation aborted at config parsing because `app/package.json` carried a UTF-8 BOM (from a PowerShell `Set-Content`); nothing was generated. BOM stripped, second invocation generated `android/` — this is the single generation; `expo prebuild` must never run again. Warnings: `edgeToEdgeEnabled` is no longer a setting (Android 16 makes it mandatory; key removed from app.json), `userInterfaceStyle` needs expo-system-ui (see 10 and the hand edit below). |
| 13 | Hand edits in `app/android/`: `app/build.gradle` release `signingConfigs` from `SHUBHVELA_STORE_FILE/_STORE_PASSWORD/_KEY_ALIAS/_KEY_PASSWORD` project properties with debug fallback, `versionCode 1`, `versionName "0.1.0"` (prebuild already set these); `gradle.properties` `org.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=1536m`, `reactNativeArchitectures=arm64-v8a`; `res/values/strings.xml` `expo_system_ui_user_interface_style=automatic` (what the expo-system-ui plugin writes) | done |
| 14 | Manifest check | `<data android:scheme="shubhvela"/>` intent filter present; `com.google.android.gms.ads.APPLICATION_ID` = `ca-app-pub-3940256099942544~3347511713` (test id); `uiMode` in MainActivity configChanges; `Theme.AppCompat.DayNight.NoActionBar` |
| 15 | `keytool -genkeypair -v -keystore release/shubhvela-release.keystore -alias shubhvela -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Shubhvela, OU=Apps, O=Sudish Kumar, C=IN" -storepass $sp -keypass $kp` (passwords: two random 24-char values in PowerShell variables, never printed) | 2,686-byte PKCS12 keystore; `keytool -list` shows `shubhvela, PrivateKeyEntry`. keytool warned that PKCS12 ignores a separate `-keypass`, so `KEYSTORE-INFO.txt` records key password = store password (8 lines incl. a note). |
| 16 | `release/README.md`, `scripts/build-apk.ps1`, `scripts/emulator.ps1`, `scripts/shots.ps1`, `scripts/audit-ui-dump.mjs`, `scripts/shrink-png.mjs`; `sharp@0.35.5` root devDependency | written; all three `.ps1` files have 0 non-ASCII bytes |
| 17 | `docs/OWNER-TODO.md` (11 items), `docs/{spec,design,requirements,build-rules}.md` copies, `.github/workflows/ci.yml` | written |
| 18 | `npm test` | content: no tests (0); content-tools: no tests (0); engine: 2 files, 4 tests passed; app: 1 suite, 3 tests passed; web: no tests (0). Exit 0. |
| 19 | `npm run typecheck` | all five workspaces `tsc --noEmit` clean (incl. the vendored fork under strict). Exit 0. |
| 20 | `npm run lint` | app `eslint .` clean. Exit 0. |
| 21 | `git add <explicit paths>; git commit -m "chore(repo): ..."` | `743c16c`, 162 files; `release/` contributes only `README.md`; `app/android/app/debug.keystore` (public Android debug key) is committed as RN expects |
| 22 | `gh repo create Sudish007/shubhvela --public --source . --remote origin --push --description "..." --homepage https://sudish007.github.io/shubhvela/` | created, remote added, main pushed |
| 23 | `gh api -X POST repos/Sudish007/shubhvela/pages -f build_type=workflow` | 201; response `build_type: workflow`, `html_url: https://sudish007.github.io/shubhvela/` |
| 24 | `gh api repos/Sudish007/shubhvela --jq .visibility` | `public` |
| 25 | `gh api repos/Sudish007/shubhvela/pages --jq .build_type` | `workflow` |
| 26 | `gh run list --repo Sudish007/shubhvela --limit 1` / `gh run watch 40117901298 --exit-status` | CI `✓` (test, typecheck, lint in 36 s); log shows 1398 packages installed, 4 + 3 tests passed, five `tsc --noEmit`, `eslint .` |
| 27 | `git --no-pager status --porcelain` | empty |
| 28 | `git --no-pager log --oneline -1` | `743c16c (HEAD -> main, origin/main) chore(repo): ...` |
| 29 | `Test-Path release/shubhvela-release.keystore` | `True` |
| 30 | `git --no-pager check-ignore release/KEYSTORE-INFO.txt` | `release/KEYSTORE-INFO.txt` (ignored); `git check-ignore -v` also confirms `.agents/`, `node_modules/`, `app/android/app/build/`, `app/android/.gradle/` |
| 31 | `git --no-pager grep -I "password :"` | ONE match: `docs/build-rules.md:21` — the verbatim copy of the binding build-rules document, which quotes the literal `'password :' / 'alias :' lines` as a description of the INFO file format. Not a secret. `git grep -I -E "^(password\|key password) : [A-Za-z0-9]{24}$"` returns nothing (exit 1). `release/README.md` was reworded so it does not match. |

## Resolved versions (node_modules after install)

expo 58.0.19 · react-native 0.88.0 · react 19.3.1 · typescript 6.0.3 · expo-router 58.0.26 · expo-sqlite 58.0.14 · expo-notifications 58.1.6 · expo-print 58.0.7 · expo-sharing 58.0.20 · expo-speech 58.0.3 · expo-file-system 58.0.11 · expo-background-task 58.0.11 · expo-task-manager 58.0.12 · expo-document-picker 58.0.4 · expo-camera 58.0.12 · expo-location 58.0.19 · expo-constants 58.0.13 · expo-linking 58.0.14 · expo-status-bar 58.0.4 · expo-font 58.0.10 · expo-asset 58.0.18 · expo-build-properties 58.0.11 · expo-device 58.0.5 · expo-network 58.0.4 · expo-iap 6.2.0 · expo-litert-lm 0.1.2 · expo-system-ui 58.0.6 · react-native-google-mobile-ads 17.4.0 · react-native-svg 15.16.0 · react-native-safe-area-context 5.10.1 · react-native-screens 4.30.0 · react-native-webview 14.0.1 · react-native-view-shot 6.1.1 · react-native-qrcode-svg 6.3.27 · react-native-quick-crypto 1.1.8 · react-native-nitro-modules 0.37.1 · react-native-quick-base64 3.0.1 · react-native-reanimated 4.7.1 · react-native-gesture-handler 3.3.0 · react-native-worklets 0.13.0 · jest 30.5.2 · jest-expo 58.0.12 · @testing-library/react-native 14.1.0 · @types/jest 30.0.0 · eslint 9.39.5 · eslint-config-expo 58.0.4 · astronomy-engine 2.1.19 · vitest 5.0.5 · tsx 4.23.15 · @types/node 24.19.2 · moment-timezone 0.6.5 · tz-lookup 6.1.25 · sharp 0.35.5.

Android: Gradle wrapper 9.4.1; compileSdk/targetSdk 36, minSdk 24, NDK 27.1.12297006 (via expo-build-properties into `gradle.properties`); AGP/Kotlin per Expo SDK 58 template (`android.builtInKotlin=false`, `android.newDsl=false`); `newArchEnabled=true`, `hermesEnabled=true`, `android.enableMinifyInReleaseBuilds=true`.

## Not verified in this step

- No Gradle build was run (disk 1.5–2.6 GB free during the step, below the 4 GB threshold; builds happen in A13 after a disk check). Therefore unverified: that the 35 native modules compile together on RN 0.88 / SDK 58, that `expo-litert-lm@0.1.2` and `expo-iap@6.2.0` compile (plan P2/P18 fallbacks apply), that the release `signingConfig` picks up the `SHUBHVELA_*` properties, that `scripts/build-apk.ps1` runs end to end.
- No emulator exists yet; `scripts/emulator.ps1`, `scripts/shots.ps1` and `scripts/audit-ui-dump.mjs` are untested against a device (`audit-ui-dump.mjs` parses uiautomator XML; its logic has only been desk-checked).
- `scripts/shrink-png.mjs` was not exercised on a real PNG.
- The app has never been launched (Metro/`expo start` not run); only jest, tsc and eslint ran over it.
- The placeholder `app/app/index.tsx` is honest text ("Development build. The app screens are not built yet.") and is replaced in A09.
- Owner steps (docs/OWNER-TODO.md) are all open: name/domains, Instagram, Play Console, AdMob ids, GEMINI_API_KEY secret, Bhojpuri review, keystore backup, grievance e-mail, disk headroom.
