# Verification — c06 · DEV-1 hotfix: bottom chrome vs the system navigation bar (0.3.1 / versionCode 4)

Date: 2026-10-29 12:1x → 18:5x IST. Worktree `c:/Users/sudiskmr/Downloads/DomainClassification/shubhvela`, branch `main`, base `3cafdd5` (c-ship).
Commits: `a2843b0 fix(F1): bottom chrome clears the system navigation bar in both navigation modes (DEV-1)`, `1508455 chore(release): 0.3.1 / versionCode 4`, `d0dcb0b fix(F1): zero-width inset probe behind the navigator (DEV-1 follow-up)`, plus the docs/audit commit of this file.
Owner report (carry-over DEV-1): "bottom menu buttons getting hidden by phone systems menu bar" on the 0.3.0 arm64 APK.

## 1. Reproduction (0.3.0 x86_64 APK, AVD shubhvela_test, API 34, 390 dp = `wm density 443`)

Navigation switched with `adb shell cmd overlay enable-exclusive --category com.android.internal.systemui.navbar.threebutton` (the prompt's `enable` + `disable` pair left `settings get secure navigation_mode` unchanged on this image; `enable-exclusive --category` is what Settings uses and flips it to 0 = 3-button / 2 = gesture).

| mode | nav-bar frame (`dumpsys window` `type=navigationBars frame`) | tab "Learn" bounds (uiautomator) | result |
|---|---|---|---|
| 3-button | `[0,2267][1080,2400]` = 133 px = **48 dp** | `[810,2201][1080,2400]` | the 72 dp bar's lower 133 px lie under the system bar; labels hidden (`repro-030-today-3button-en-light-390.png`) |
| gesture | `[0,2334][1080,2400]` = 66 px = 23.8 dp | `[810,2201][1080,2400]` | same geometry: the bar still ends at the screen bottom, only the handle overlaps less (`repro-030-today-gesture-en-light-390.png`) |

The tab bar was 199 px = 72 dp high in BOTH modes with no inset added, so the defect was not "inset arrives as 0 or late" (the stack-screen banner strip on the same build sat at `[0,1934][1080,2400]` = 144.5 + 23.8 dp, i.e. it DID receive the inset). The emulator never showed it because the gesture handle is drawn over app content and the labels stayed legible under the 24 dp strip.

## 2. Root cause

`app/app/(tabs)/_layout.tsx` passed the bar's style as an ARRAY: `style={[styles.bar, { height: size.tabBar + insets.bottom, paddingBottom: insets.bottom, ... }]}` to the `<View>` inside `<TabList asChild>`. expo-router's `TabList asChild` clones the child through a Radix `Slot` (`@radix-ui/react-slot` 1.5.0 `mergeProps`: `style: { ...slotPropValue, ...childPropValue }`); expo-router's `ShimSlotForReactNative` flattens only the SLOT's style, not the child's. Spreading an array gives `{ "0": {...}, "1": {...} }`, which React Native ignores, so height, paddingBottom, surface colour and the hairline were all dropped and the bar was laid out by its children alone (72 dp `minHeight` on each tab). In dev mode expo-router throws exactly for this ("You are passing an array of styles to a child of <Slot>"); the `process.env.NODE_ENV !== 'production'` guard is compiled out of release bundles, which is why every A13/B08/C05 release-build shot and every Jest render passed.

## 3. Fix (commit `a2843b0`, follow-up `d0dcb0b`)

| File | Change |
|---|---|
| `app/src/navigation/tabs.tsx` | `tabBarStyle({ insetBottom, surface, hair })` returns ONE flat `ViewStyle` (row, hairline, surface, `height: 72 + insetBottom`, `paddingBottom: insetBottom`). |
| `app/app/(tabs)/_layout.tsx` | uses `tabBarStyle(...)` + `useBottomInset()`; `testID="tab-bar"`; comment records the Slot merge rule. |
| `app/src/components/BottomInset.tsx` (new) | `resolveBottomInset({ reported, probe, edgeToEdge })`: reported inset when > 0; else, only under an edge-to-edge window (RN DeviceInfo `isEdgeToEdge`, true when unknown on Android), the bottom padding RN's own Fabric `SafeAreaView` (`RCTSafeAreaViewNativeComponent`, native `onApplyWindowInsets`, a path independent of safe-area-context's pre-draw polling) applied to an invisible probe; else 0. `BottomInsetProvider` (root layout, around the navigator) + `useBottomInset()` (falls back to `useSafeAreaInsets().bottom` outside a provider). Screenshot builds log `dev/insets {t, top, reported, probe, probeTop, edgeToEdge, effective}` on every change. |
| `app/src/components/Screen.tsx` | design.md 2.3 formula unchanged; its `insetBottom` input is now `useBottomInset()`; the sticky-CTA box (`testID="screen-cta-box"`) and the BannerStrip `insetBottom` prop take the same value — the formula stays the single owner, extended not forked. |
| `app/src/components/Sheet.tsx` | `paddingBottom = useBottomInset() + 16`; `Modal navigationBarTranslucent` (RN forces it under `edgeToEdgeEnabled` anyway; now explicit); `testID="sheet-panel"`. |
| `app/src/types/rn-safe-area-native.d.ts` (new) | declaration for the RN deep import (RN's `exports` map has `types: null` for `./Libraries/*`). |
| `app/app/dev/insets.tsx` (new), `app/app/_layout.tsx`, `app/app/dev/state.tsx` | dev readout route `shubhvela://dev/state?screen=/dev/insets` (screenshot builds only): useSafeAreaInsets, initialWindowMetrics, probe, effective, edge-to-edge flag, window/screen dp, density, fontScale, timeline of the reported bottom inset. |
| `app/test/bottom-inset.test.tsx` (new, 10 tests) | resolver table (reported wins; probe only when 0 + edge-to-edge; 0 otherwise), provider pass-through, fallback 0 → 48 after the probe lays out, no probe when not edge-to-edge, probe is absolute / opacity 0 / **width 0** / behind the children, Screen padding = CTA 120 + 16 + 48 and CTA box padding 48 from the fallback, Sheet padding 48 + 16 with `navigationBarTranslucent`, `tabBarStyle` is a flat object that survives `{ ...slot, ...child }`. |
| `app/test/__snapshots__/{charts-extras,pseudo-locale}.test.tsx.snap` | refreshed: the only diffs are the new `testID`s and the Modal prop. |
| `app/app.json`, `app/android/app/build.gradle`, `app/test/app-config.test.ts`, `release/README.md` | **0.3.1 / versionCode 4** (commit `1508455`); README lists 0.3.0 arm64 as carrying DEV-1. |
| `scripts/shots.ps1` | `-NavMode <gesture|3button>` (enable-exclusive + wait for `navigation_mode`, suffix `-gest`/`-3btn`), `-SubDir`, per-shot `<name>.meta.json` `{navBar:[x1,y1,x2,y2], navMode, density, fontScale}` from `dumpsys window`, full-scroll dump on every screen when `-NavMode` is set. |
| `scripts/audit-ui-dump.mjs` | `navCovered` / `navChecked` / `navMode` / `navBar` / `navBarDp` fields: every clickable node of the fixed chrome on the initial dump and every clickable node on the full-scroll dump must not overlap the nav-bar rectangle by > 2 px; the ad creative's DOM and a full-window clickable (the Sheet scrim) are excluded; `--summary` totals `navCovered` + `navChecked`; density falls back to meta.json. |
| `.agents/tasks/v1-build/design.md` 2.3 | the `insetBottom` definition and the two-mode audit requirement added to the fixed-chrome rule. |

**Follow-up `d0dcb0b`:** the first 0.3.1 audit batch (archived under `shots/phase-c/navbar/_build1-touch-regression/`, 131 PNG + its `audit.json`: 75 "covered" fails, 0 nav fails) showed every tap and scroll swallowed — the `sheet` shots never opened the sheet and Pro/PDF never scrolled. Cause: the probe was a full-window `RCTSafeAreaView`; it is a plain `ViewGroup`, Fabric's hit test ignores `pointerEvents="none"` on it, and it was the last (topmost) child. The probe is now 0 dp wide at the left edge and rendered BEFORE the navigator. Re-verified by tapping `panchang-pill` (sheet opened, `sheet-panel` in the dump) and swiping before the second batch. The x86_64 APK was rebuilt (build 2, 16m 47s).

Not changed: `app/app.json` edge-to-edge settings (none needed; `android/gradle.properties edgeToEdgeEnabled=true` and the transparent nav bar in `styles.xml` are correct — the window is meant to draw behind the bar and the chrome must add the inset, which it now does), `BannerStrip.tsx` itself (its `insetBottom` prop now receives the resolved value from Screen), `app/src/ads/*`.

## 4. Unit / static checks

| Command | Result |
|---|---|
| `npm run typecheck` (app) | exit 0 (after `a2843b0`, again after `d0dcb0b`) |
| `npm run lint` (app) | exit 0, 0 warnings |
| `npx jest` (app, full) | 37 suites / **338 tests** pass after the two snapshot refreshes (run before `d0dcb0b`); `test/bottom-inset.test.tsx` **10/10** after `d0dcb0b`; `screen`, `app-config`, `pseudo-locale`, `charts-extras`, `pro-screen` re-run 49/49. |
| `packages/content` tests | NOT run by this step: the parallel translation run is editing `packages/content/test/*.test.ts` and `corpus/*/{hi,bho}.json` in this worktree (carry-over "PARALLEL RUN NOTICE"); none of those files were staged here. |

## 5. Builds (disk gate ≥ 4 GB before each; `gradlew --stop` after; build dirs deleted before every emulator boot)

| APK | when | Gradle | badging / apksigner |
|---|---|---|---|
| `release/Shubhvela-0.3.1-x86_64.apk` build 1 | 13:11–13:31, 9.72 GB free at start | detached, BUILD SUCCESSFUL 20m 58s (979 tasks / 802 executed) | `versionCode='4' versionName='0.3.1'` `native-code: 'x86_64'`, v2 true — superseded by build 2 (same name) |
| `release/Shubhvela-0.3.1-x86_64.apk` build 2 (probe fix) | 15:34–15:51, 9.8 GB | detached, BUILD SUCCESSFUL 16m 47s (669 executed) | `versionCode='4' versionName='0.3.1'`, x86_64, v2 true; 110,086,108 B; `dumpsys package` versionCode=4 after install |
| `release/Shubhvela-0.3.1-arm64.apk` | 18:42–, 10.56 GB | detached | see §8 |

Build dirs removed each time: `app/android/app/build`, `.cxx`, `app/android/build`, `.kotlin`, 25 × `node_modules/*/android/{build,.cxx}` (free went 8.66 → 9.99 GB).

## 6. Emulator audit — both navigation modes (`shots/phase-c/navbar/`, APK build 2)

Batch script (TEMP) called `scripts/shots.ps1 -Phase c -SubDir navbar -NavMode <mode> -Extra session=4` with the screens `today, charts, family, learn, pro, pdf (/charts/pdf/janam_patri?profile={self}), sheet (today;tap=panchang-pill), insets (/dev/insets)`:

| set | 3-button | gesture |
|---|---|---|
| 390 dp × en/hi/bho × light/dark, 8 screens | 48 | 48 |
| 360 dp en light (7 screens, no family) | 7 | 7 |
| 412 dp en dark (7) | 7 | 7 |
| 390 dp hi light font 1.3× (7) | 7 | 7 |
| **total** | **69** | **69** |

138 PNG (all ≤ 1920 px per side, checked with System.Drawing), 138 `.ui.xml`, 138 `.meta.json`, 138 `.bottom.ui.xml` (full-scroll dumps on every screen under `-NavMode`). The emulator exited by itself three times (14:2x during 3-button 412, 16:4x and 17:5x during the gesture sets); the batch skips shots whose PNG exists, so each reboot only took the missing ones. Plus the 12 reproduction/check shots (`repro-030-*`, `check-031*`) from §1 and §3.

`node scripts/audit-ui-dump.mjs <folder> ; --summary` on the 138 audit dumps → **`{"shots":138,"smallControls":0,"intersections":0,"covered":0,"navCovered":0,"navChecked":138,"failing":0}`** (`shots/phase-c/navbar/audit.json`). navBarDp: 48 on all 69 three-button shots; 23.8 (443 dpi) / 24 (420/480 dpi) on the 69 gesture shots. `coveredChecked` 138/138. M6 strip records: 390 dp 144.5 = 112 + 32.5, 412 dp 150.5 = 117.7 + 32.8, 360 dp 135.3 = 103 + 32.3 in both modes (identical to C05).

Geometry at 390 dp (px; bar top = nav frame y1):

| element | 3-button (bar 2267) | gesture (bar 2334) |
|---|---|---|
| tab "Learn" | `[810,2069][1080,2268]` → 199 px content, bar box = 72 + 48 dp, ends at the nav-bar edge | `[810,2136][1080,2335]` → 72 + 24 dp |
| screen-scroll (tabs) | `[0,128][1080,2068]` | `[0,128][1080,2135]` |
| banner strip (Charts/Learn/Family) | `[0,1668][1080,2068]` above the bar | `[0,1735][1080,2135]` |
| Pro sticky CTA box `screen-cta` | `[0,1913][1080,2267]` — box ends exactly at the bar top (the CTA's `paddingBottom: insetBottom` lies below `screen-cta`, see Screen.tsx) | `[0,1980][1080,2334]` |
| PDF preview CTA (Download / Share) | `[0,1923][1080,2267]` | `[0,1990][1080,2334]` |
| Sheet last row ("Segments", clickable) | y2 = 2223 → 44 px = **15.9 dp** above the bar | y2 = 2290 → 44 px above the bar |
| 360 dp / 412 dp tab "Learn" | `[810,2041][1080,2257]` / `[810,2086][1080,2275]` (bar 2256 / 2274) | — |
| hi 1.3× tab labels | same bounds as 1.0× (`[0,2069][270,2268]` …); two-line labels fit the 72 dp | — |

Dev readout (`insets-*` shots, text read from the dumps):

| shot | useSafeAreaInsets bottom | initialWindowMetrics | probe top/bottom | effective | edge-to-edge | first report |
|---|---|---|---|---|---|---|
| en 390 3-button | 48.0 | 48.0 | 46 / 48 | 48.0 | true | 107 ms |
| en 390 gesture | 23.8 | 23.8 | 46 / 24 | 23.8 | true | 127 ms |
| en 360 3-button / gesture | 48.0 / 24.0 | same | 43 / 48 · 43 / 24 | 48.0 / 24.0 | true | 155 / 539 ms |
| en 412 3-button | 48.0 | 48.0 | 49 / 48 | 48.0 | true | 15 ms |
| hi 390 1.3× 3-button | 48.0 | 48.0 | 46 / 48 | 48.0 | true (fontScale 1.30) | 69 ms |

logcat `dev/insets` at cold start (3-button): `{"t":253,"reported":48.04,"probe":null,...,"effective":48.04}` → `{"t":325,...,"probe":48,...}` — the library delivered the inset before the first paint; the probe agreed within 0.04 dp. On this emulator the fallback path is therefore never selected; it is exercised by the unit tests only (§4) and by its agreement with the reported value here.

Eye check (one read per image, shrunk): `repro-030-today-3button` (labels under the buttons), `check-031-today-3button` (bar above the buttons, surface + hairline back), `today-en-dark-390-3btn`, `sheet-hi-dark-390-3btn` (last sheet row above the bar). Dark theme: tab bar surface `#1E1B17` distinct from the system bar scrim; no gradients/glow/shadow; nothing below 12 sp.

## 7. Carry-over

- DEV-1 fixed in code and verified on the emulator in both modes; the owner's phone re-test is the remaining acceptance (§8 APK). Appended to carry-over.md with the new d-ship audit requirement: every Phase D emulator audit runs `-NavMode 3button` and `-NavMode gesture`, `navCovered` must be 0 and `navChecked` = shots.
- New finding for d-ship: `scripts/audit-ui-dump.mjs` could not have caught DEV-1 before because no shot carried the nav-bar rectangle; the `.meta.json` is now written by every `shots.ps1` run (also without `-NavMode`), so older phase folders without meta report `navChecked: false` rather than passing silently.
- The emulator exits on its own under long batches (3 × today, also A13/B08/C05); the resumable batch pattern (skip existing PNGs) should become part of `shots.ps1` in Phase D.
- Not run on hardware: an arm64 device (owner), Android 15/16 enforced edge-to-edge (API 34 image only), a device where safe-area-context reports 0 (the fallback is unit-tested, not device-tested).

## 8. arm64 device APK — for the owner's phone

`scripts/build-apk.ps1 -Abi arm64-v8a -Version 0.3.1 -Detached` (18:42, 10.56 GB free; no screenshot mode, so no dev routes in the bundle) → BUILD SUCCESSFUL in 27m 24s (979 tasks / 670 executed) → `-Finish` (19:09):

```
release/Shubhvela-0.3.1-arm64.apk   99,586,866 bytes   2026-10-29 19:09
package: name='com.shubhvela.app' versionCode='4' versionName='0.3.1' compileSdkVersion='37'
sdkVersion:'24'  targetSdkVersion:'36'  native-code: 'arm64-v8a'
Verified using v2 scheme (APK Signature Scheme v2): true   (v1/v3/v3.1/v4 false)   — release keystore, alias shubhvela
```

`gradlew --stop` run; `app/android/app/build`, `.cxx`, `app/android/build`, `.kotlin` and 25 `node_modules/*/android/{build,.cxx}` deleted (10.44 GB free at the end). The owner installs this APK over 0.3.0 (same package, versionCode 3 → 4) and checks the four tabs, the Pro CTA, the PDF preview buttons and the Panchang sheet in his phone's navigation mode; a further report becomes DEV-2 in carry-over.md.
