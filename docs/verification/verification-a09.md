# Verification â€” A09 App foundation (FEAT-A09)

Date: 2026-10-25. Worktree `c:/Users/sudiskmr/Downloads/DomainClassification/shubhvela`, branch `main`.
Commit: `feat(F1): app foundation, onboarding, profiles, settings, honesty components` = commit `8cbd672`, pushed to origin/main (fast-forward from 5e9aa6f; pull --rebase found nothing new).

## 1. What was built

- **Fonts** (`app/assets/fonts/`, binary, never opened with read_file): `TiroDevanagariHindi-Regular.ttf` (423,224 B, v1.52, google/fonts ofl/tirodevanagarihindi, raw file from main), `NotoSans-Regular.ttf` (825,628 B), `NotoSans-SemiBold.ttf` (830,444 B) from the release zip `notofonts/latin-greek-cyrillic` NotoSans-v2.015 (`NotoSans/full/ttf/`), `NotoSansDevanagari-Regular.ttf` (277,680 B), `NotoSansDevanagari-SemiBold.ttf` (274,424 B) from `notofonts/devanagari` NotoSansDevanagari-v2.007 (`NotoSansDevanagari/full/ttf/`). Downloaded with `Invoke-WebRequest` to `$env:TEMP\shubhvela-fonts` (zips 117 MB + 18 MB), extracted with `System.IO.Compression`, temp folder deleted. Versions recorded in `THIRD-PARTY-NOTICES.md`.
- **Glyph check** `packages/engine/scripts/check-glyphs.ts` (devDependency `opentype.js@1.3.4` + `@types/opentype.js@1.3.8`, exact).
- **Theme**: `app/src/theme/ThemeProvider.tsx` (`useTokens()`, `readInitialThemeSetting()` synchronous from SQLite, default `'light'`, `'system'` via `useColorScheme`), `app/src/theme/typography.ts` (`textStyle(kind, lang, {weight, latin, tabular})`, `fontFamilyFor`), tokens.ts untouched (A05 generated).
- **i18n**: `app/src/i18n/index.ts` (`LangProvider`, `useLang()` â†’ `{lang, t, setLang}`, `makeT`, `translate`, English fallback map), `app/src/i18n/pseudo.ts` (`global.__PSEUDO_LOCALE__` â†’ +30 %). 14 new UI keys added to `packages/content/ui/{en,hi,bho}.json` (784 â†’ 798, identical sets): `onboarding.pickDate/pickTime/useCoordinates/warTimeNote`, `today.notYetTitle/Body`, `charts.notYetTitle/Body`, `family.notYetTitle/Body`, `common.learnNotYetTitle/Body` (Learn tab; `learn.*` is a Phase C namespace and the content completeness test forbids it in Phase A), `reminders.permissionGranted`, `about.rounding`.
- **SQLite**: `app/src/db/{types,connection,open,schema,migrations,settings,appState,profiles,ancestors,eventSeries,deleteEverything,gazetteer}.ts`. Schema v1 = the 13 plan.md tables. `open.ts` is the only module importing `expo-sqlite` for the app DB (WAL + foreign keys), called at module scope of `app/app/_layout.tsx`.
- **Components** (`app/src/components/`): Screen, Row (ruleId REQUIRED), WhyButton/WhySheet, Tag/ApproxTag, Pressable44, Num/Latin/NoBreak, Sheet, Switch (On/Off text), Chip, Segmented, Card, ComputedFooter, EmptyState/InlineNotice, Txt, Primary/Secondary/TextButton, TextField, Checkbox, NavRow/RadioRow/SwitchRow, CapSheet, icons (inline SVG strokes).
- **Navigation**: `app/app/_layout.tsx` (DB init, fonts, providers, Stack), `app/app/index.tsx` (consent gate), `app/app/(tabs)/_layout.tsx` (headless `expo-router/ui` tabs, 72 dp bar, SVG icons, 12 sp labels), tab shells `today/family/charts/learn.tsx`, `onboarding/{consent,birth,intent}.tsx`, `profile/[id].tsx`, `settings/{index,language,theme,chart-style,calculation,tradition,notifications,privacy,disclaimers,about}.tsx`, `dev/state.tsx`.
- **Onboarding/profiles**: `app/src/profiles/{validate,mapping,nativePickers,PlaceField,BirthForm,useProfiles}.ts(x)`, `app/src/location/nominatim.ts`, `app/src/engine-bridge/{profiles,charts}.ts`, `app/src/entitlements.ts`, `app/src/ads/AdPolicy.ts` (Phase A stub: no banner), `app/src/dev/{params,seed}.ts`, `app/src/{format,gate,legal,settingsLabels}.ts`.
- **Dependencies added**: app `@react-native-community/datetimepicker@9.2.1` (Expo SDK 58 pin; autolinked at Gradle time via `autolinkLibrariesFromCommand`, no prebuild needed â€” not yet compiled, see "Not verified"), app `tz-lookup@6.1.25` (runtime; typing in `app/src/types/tz-lookup.d.ts`); engine devDeps `opentype.js`, `@types/opentype.js`; root devDeps `react@19.3.0`, `react-dom@19.3.0` + `overrides` (see Â§4).
- **Tests** (`app/test/`): `setup.ts` (mocks: expo-router, expo-network, datetimepicker, expo-notifications, expo-sqlite throws), `helpers/{nodeDb.ts,render.tsx,assetStub.js}`, `db`, `entitlements`, `theme`, `components`, `row-ruleid` (type test), `screen`, `nominatim`, `i18n`, `pseudo-locale` (+ 2 snapshots), `flows`.

## 2. Commands and results

| Command | Result |
|---|---|
| `npm test -w app` (`jest --ci --passWithNoTests`) | **11 suites, 51 tests passed, 2 snapshots passed**, 0 console warnings/errors. Suites: app-config (3), i18n (6), db (5), entitlements (5), row-ruleid (1), nominatim (5), theme (4), flows (5), screen (4), components (9), pseudo-locale (4). First cold run 84 s (engine + corpus load), warm 14 s; `testTimeout` raised to 30 s. |
| `npm run typecheck` (all 5 workspaces) | exit 0 |
| `npm run lint` (app = only workspace with lint) | exit 0, 0 problems |
| `npx tsx packages/engine/scripts/check-glyphs.ts app/assets/fonts` | exit 1 (by design): U+211E â„ž present in NotoSans-Regular/SemiBold, **absent** in NotoSansDevanagari-Regular/SemiBold and Tiro â†’ decision below |
| `npm test` (root, all workspaces) | content 84, content-tools 16, engine 715 passed + 1 skipped, app 51, web 0 files â€” exit 0 |
| `npm test -w packages/content` after adding the 14 keys | 84 passed (key sets, params, register, budgets) |

Running the engine suites rewrote `packages/engine/reference/results*.json` timestamps; those files were restored with `git checkout` and are not part of this commit.

## 3. Glyph decision (P17, N15)

`check-glyphs.ts` output: NotoSans v2.015 covers U+211E; NotoSansDevanagari v2.007 (1,117 glyphs) and Tiro v1.52 do not. **Decision: the retrograde tag stays "R" + the word** (`charts.retroMark = "R"`, `dignity.retro = "R retrograde"` as A05 set them); nothing changes. Also recorded: U+2032 (prime, used in `charts.degree`) is missing from Noto Sans Devanagari â€” degree strings must be rendered through `Num` (Noto Sans), which is the N19 rule anyway; U+2192 (â†’, used in `consent.delete`) is missing from all three faces and falls back to the system font on Android (renders, different face).

## 4. Findings worth knowing

- **Two React copies** existed since A01: root `react@19.3.1` (hoisted for `peer react@*`) and `app/node_modules/react@19.3.0` (SDK pin). Jest failed with "Invalid hook call"; the same would hit Metro on device (react-native resolves root react, app code resolves its own). Fixed by pinning `react`/`react-dom` 19.3.0 as root devDependencies (+ `overrides`); `npm ls react` shows one deduped 19.3.0, `app/node_modules` is empty. Added to carry-over as A-INFO-2 for A13 to confirm on the emulator.
- `@testing-library/react-native@14` renders asynchronously (`await render`, `await fireEvent`) with its own host-only `test-renderer`; `UNSAFE_*` queries are gone â€” tests use `screen.root.queryAll`.
- `expo-router@58` bundles its own fork of react-navigation; the tab bar uses the headless `expo-router/ui` (`Tabs`, `TabList asChild`, `TabTrigger asChild`) so the bar is ours (72 dp, SVG icons, 3 px indicator). In React 19 the trigger passes `ref` as a plain prop.
- `expo-sqlite@58`: `openDatabaseSync`, `getFirstSync/getAllSync/runSync/execSync`, `importDatabaseFromAssetAsync(name, {assetId, forceOverwrite})` (exported from `hooks`). The gazetteer import compares `meta.generated` with the bundled `gazetteer.meta.json` and re-imports on mismatch.
- eslint-config-expo allows `require('*.ttf')`; `require('*.sqlite')` needs a disable comment (kept in `db/gazetteer.ts`).

## 5. Not verified (honest list)

- Nothing was run on an emulator or device: no Gradle build, no Metro launch (A13). Therefore unverified on hardware: font registration and the first-paint timing, the native date/time pickers, the real `expo-sqlite` open/WAL/asset import, Nominatim over the network, `expo-network` reachability, notification permission dialogs, the headless tab bar's gestures, TalkBack order, edge-to-edge insets, 1.3Ã— font scale on real layouts.
- `@react-native-community/datetimepicker@9.2.1` has not been compiled by Gradle yet (autolinking is dynamic; no prebuild was run).
- The dev route `shubhvela://dev/state` was tested only through `parseDevParams` and `seedSampleState` (engine Moon line for Priya = Kanya Â· Uttara Phalguni 4 matches A02's recorded truth); the deep-link navigation itself needs the screenshot APK.
- Pseudo-locale snapshots prove no `numberOfLines` and whole strings in the tree, not pixel fit; the emulator audit (A13) measures clipping at 360/390/412 dp and 1.3Ã—.
- No `expo prebuild` was run; `android/` untouched.
