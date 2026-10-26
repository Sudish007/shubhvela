# Verification — A11 Charts tab (F11, F13 basic, F14 maha/antar + tree, N6 Houses, Sade Sati, F19, F2 Moon-chart mode)

Run 2026-10-25 by the `a11-charts-tab` coder step of workflow `wf_86107bfa6c58305a`, worktree
`c:/Users/sudiskmr/Downloads/DomainClassification/shubhvela`, on top of `188f5ee` (A10). Commit: `feat(F11): Charts tab - three chart styles, planet/houses tables, dasha, interactive sheets`.

## 1. What was built

| Area | Files |
|---|---|
| Charts tab | `app/app/(tabs)/charts.tsx` — header + gear; ONE horizontally scrolling row with the profile picker pill (24 dp initial, name, chevron; the only profile control) and the chips Lagna · Moon · Sun · Chalit · D9; hero Card (title, Lagna row with `approx.` tag + Why? `lagna`, ⋮ StyleMenu button with expanded state, `Chart`, birth caption via RichText/Num + ApproxTag, tap hint); Planets card (`PlanetTable` + Legend button + approx footer); Houses card (N6); Dasha card; Sade Sati card; `ComputedFooter` (ayanamsa + degrees, node method, ephemeris, tz + tzdb, rounding, house system, combustion orbs). One `sheet` state → never two Modals at once. |
| Chart component | `app/src/charts/Chart.tsx` — props `{style, chart, width, fontScale?, centreLines?, styleName, onPressPlanet?, onPressHouse?, onLongPress?, testID?}`; react-native-svg over engine `layout()` (frame 1.5, grid 1, numerals ink3 at labelSize, glyphs Noto Sans SemiBold 13.5 u / Tiro 14.5 u, approx glyphs indigo, `+N` badges, South Lagna diagonal accent); one `Pressable` with `accessibilityRole="image"` and a label summarising planets by house; `resolvePress` / `resolveLongPress` map dp → viewBox units → engine `hitTest` (planet when unambiguous, else house; long-press → planet or sign). |
| Tables and cards | `PlanetTable.tsx` (fixed 31/36/33 % columns, 8 dp right padding, headers wrap, Lagna row first unless Moon-chart, every dignity/mark tag + ApproxTag, each row a 44 dp control → `onPressRow`), `HousesCard.tsx` (12 Rows, ruleId `house-lord`, text column opens the HouseSheet), `DashaCard.tsx` (Full tree link, maha line, antar strip of 9 proportional cells, current cell accentTint + accent border, 2 px ink marker, "You are here · date", labels only in cells ≥ 28 dp, strip a11y text naming every antar, rows Now / Next with Why? `dasha-vimshottari` / `dasha-change`, "Pratyantar … · Pro" row whose Pro tag opens `CapSheet('pro_feature')`, `dasha.howComputed` caption), `SadeSatiCard.tsx` (state Row with Why? rule id from the engine state, phase dates of the running or next episode, next event + date, approx tag only if the engine flags one, `sadesati.howComputed`). |
| Sheets | `app/src/charts/sheets.tsx` — `PlanetSheet` (title "Mars in the 1st house (Meena)" / "Lagna Meena", position line + tags, planet-in-sign + planet-in-house + one block per dignity tag, each with corpus text, `Rule <id>` caption and a 44 dp Why? that expands rule sentence + inputs + source IN PLACE; Moon-chart mode replaces the house block with the moon-chart note), `HouseSheet` ("House 12 · Kumbha", lord line, one 44 dp row per planet → PlanetSheet, "No planet" when empty), `LegendSheet` (10 vocabulary rows + footer), `GlossarySheet` (long-press → glossary one-liner; honest "No glossary entry yet" fallback), `StyleMenu` (radiogroup North/South/East via `RadioRow` role radio + checked, Legend row; NO "Share chart card" until B07), `ProfileSheet` (radio rows per profile with birth date · place caption). |
| Full tree | `app/app/charts/dasha-tree.tsx` (`/charts/dasha-tree?profile=<id>`) — pinned "You are here · date · Maha – Antar" header (new `Screen` prop `pinned`), accordion maha → antar → pratyantar, exact dates tabular via `Num`, current maha/antar expanded and tinted, pratyantar rows: lord + `Pro` tag, no dates, tap → honest CapSheet (dates render only when `canSeeFeature('dasha_pratyantar')` allows — never in Phase A). Registered in `app/app/_layout.tsx`. |
| Model | `app/src/charts/model.ts` — `chipsFor` (Moon-chart drops Lagna/Chalit), `chartForChip` (memoised per base chart: moonChart/sunChart/chalit/varga D9), `heroTitle`, `PLANET_SLUG`/`signSlug`/`planetSignId`/`planetHouseId`/`lagnaId` (= corpus and glossary ids), `tagsFor` (fixed tag order + approx), `approxRuleId`, `chartA11yLabel`, `antarCells` / `antarMarkerX` / `ANTAR_LABEL_MIN_DP = 28`, `nextAntar`, `durationText`, `dateRange` (glued), `fmtBirthDate`, `shortPlace`. |
| Engine bridge | `app/src/engine-bridge/charts.ts` + `recomputeAllCharts()` (F19: clears the cache and recomputes every profile now), `dashaFor(chart)` (WeakMap per chart object), `sadeSatiFor(chart, nowMs)`. |
| F19 | `app/app/settings/calculation.tsx` — ayanamsa/node change → `recomputeAllCharts()` → `ToastAndroid` "Recomputed for Raman ayanamsa" / "Recomputed with the true node" + the same sentence kept on screen (`accessibilityLiveRegion`, testID `recomputed-note`); chart style from Settings or the ⋮ menu persists in `settings.chartStyle` and the tab re-reads it on focus. |
| Components | `Screen` gained `pinned?: ReactNode` (testID `screen-pinned`); `icons.tsx` gained `MoreIcon` (three SVG dots; no emoji). |
| UI strings | 12 new keys × 3 languages (`charts.pickProfile/glossaryNone/rounding/housesLine/orbsLine/positionLine/treeFor`, `dasha.pratyantarLocked/expandA11y/expandAntarA11y`, `sadesati.phaseDates/nextEvent`); 814 → 824 keys per file; hi respectful आप register, bho रउआ/राउर forms (owner review item stands). |

Not rendered (not built, nothing fake): "14 more vargas" chip and unlock sheet (B04), Yogas card (B04), "More from this chart"/Varshaphal/Prashna/Ask-my-chart rows (B/C), "Share chart card" menu item (B07), "Timing and documents" card (B04), banner ad (B03), notification toggles (Pro, B03).

## 2. Verification commands (all run from the repo root unless stated)

### `npm test -w app`
```
PASS test/db.test.ts
PASS test/i18n.test.ts
PASS test/nominatim.test.ts
PASS test/entitlements.test.ts
PASS test/app-config.test.ts
PASS test/today-band.test.tsx
PASS test/theme.test.tsx
PASS test/components.test.tsx
PASS test/today-segments.test.tsx
PASS test/row-ruleid.test.tsx
PASS test/screen.test.tsx
PASS test/charts-components.test.tsx
PASS test/pseudo-locale.test.tsx
PASS test/flows.test.tsx
PASS test/today-upcoming.test.tsx
PASS test/today-screen.test.tsx
PASS test/charts-screen.test.tsx
Test Suites: 17 passed, 17 total
Tests:       107 passed, 107 total
Snapshots:   4 passed, 4 total
```
A10 → A11: 15 suites / 82 tests / 3 snapshots → 17 suites / 107 tests / 4 snapshots (+25 tests: `charts-components` 12, `charts-screen` 13 incl. the en/hi/bho +30 % pseudo-locale runs and the en snapshot `test/__snapshots__/charts-screen.test.tsx.snap`).

### `npm run typecheck` (root, all workspaces)
```
> @shubhvela/content@0.1.0 typecheck  > tsc --noEmit
> @shubhvela/content-tools@0.1.0 typecheck  > tsc --noEmit
> @shubhvela/engine@0.1.0 typecheck  > tsc --noEmit
> @shubhvela/app@0.1.0 typecheck  > tsc --noEmit
> @shubhvela/web@0.1.0 typecheck  > tsc --noEmit
```
exit 0, no errors.

### `npm run lint` (root)
```
> @shubhvela/app@0.1.0 lint  > eslint .
```
exit 0, 0 errors, 0 warnings (the React-compiler rules `react-hooks/preserve-manual-memoization` and `react-hooks/purity` forced two design changes: module-level memoisation instead of `useMemo` over a mutable-looking chart object, and `Date.now()` only inside a `useState` initialiser).

### Also run (not in the FEAT list): `npm test -w packages/content`
```
Test Files  9 passed (9)
Tests  84 passed (84)
```
(the UI-string completeness/budget tests cover the 12 new keys in all three languages.)

## 3. What the tests prove (FEAT-A11 test list → test)

| FEAT test | Where | Result |
|---|---|---|
| Chart renders all three styles with no glyph outside its house polygon (layout output) | `charts-components` "north/south/east: every glyph centre lies inside its house polygon" (also asserts 9 planets drawn or badged, 12 sign labels, South Lagna mark) | pass |
| labelSize ≥ 12 at width 296 | same test: `labelSize × scale ≥ 12` and every glyph `size × scale ≥ 12` | pass |
| hitTest: tap on glyph centre → planet; empty space → house; ambiguous → house | `charts-components` "hitTest: …" (Rahu centre → `{planet Ra, house 6}`, empty house centroid → house, midpoint of the two nearest house-1 glyph centres (≤ 12 dp each) → house 1); `charts-screen` "tapping the chart resolves…" drives the real screen (Rahu sheet, House 2 empty sheet, long-press → Mesha glossary) | pass |
| PlanetTable widths sum to 100 % and tags render for combust + friend + vargottama | `charts-components` PlanetTable (`[31, 36, 33]`, cell `width` props `31%/36%/33%`, synthetic Mars with friend + combust + vargottama + approx → 4 tags, approx label "approx. ±30 min") | pass |
| DashaCard hides labels in cells < 28 dp | `charts-components` "antar cells…" (Sun antar of the Rahu maha = 16.3 dp at 326 → no label; Rahu antar labelled; rendered labels = cells ≥ 28 dp) | pass |
| dasha-tree pratyantar rows carry the Pro tag | `charts-screen` "the full tree…" (9 `pratyantar-Ke-*` rows, 9 "Pro" tags, tap → "Pro is not in this build yet"; maha/antar dates equal `engine.dasha()` output) | pass |
| Moon-chart mode hides Lagna rows | `charts-screen` "Moon-chart mode…" (title "Moon chart · birth time unknown", no `lagna-row`, no Houses card, no Lagna/Chalit chips, Moon chip selected, 9 table rows, dasha kept, Sun approx tag) + `charts-components` PlanetTable Moon-chart | pass |
| pseudo-locale +30 % snapshot: table headers wrap, nakshatra+pada never split | `charts-screen` en/hi/bho at 296 dp: no `numberOfLines` anywhere, no "<Nakshatra> <pada>" Text with a plain space (NoBreak), en snapshot | pass |
| F11 styles from Settings and ⋮ menu; F19 persistence | `charts-screen` "the ⋮ menu…" (radios with `checked`, Legend item, no Share item, South → `settings.chartStyle = 'south'` + a11y label + Lagna mark; East from Settings picked up on focus) | pass |
| F13 planet row → sheet with rule ids + expanding Why? | `charts-screen` "a planet row opens…" (`Rule mars-meena`, `Rule mars-1`, `Rule combust`, Why? expands rule/source; Lagna row → `Rule lagna-meena`) | pass |
| F19 recompute + toast | `charts-screen` "Settings -> Calculation…" (Raman → new chart object with `meta.ayanamsa = 'raman'` and a different Sun longitude; note "Recomputed for Raman ayanamsa"; true node → "Recomputed with the true node") | pass |
| Sample truths (A02 findings) | Priya: Lagna Meena, House 1 Mars/Mercury/Saturn, Rahu maha 2015–2033, Ketu antar, next Venus, Sade Sati none (Saturn Meena 7th), Moon chart → Kanya in house 1 | pass |

## 4. NOT verified (A13 / reviewer)

- Anything on a device or emulator: react-native-svg `fontFamily` resolution for the expo-font faces (`NotoSans-SemiBold`, `TiroDevanagariHindi`) inside `<Text>`, actual glyph legibility at 360/390/412 dp and 1.3×, both themes on screen, the `ToastAndroid` toast itself (Jest only checks the on-screen sentence), `ToastAndroid` under the New Architecture, `Pressable` long-press timing on the chart, TalkBack reading order and the strip's accessible label, the pinned header on a real stack screen, horizontal chip-row scrolling.
- No two boxes intersecting inside the cards at 360/390/412 dp (the hero geometry is proven by the engine's chart-layout sweep; the RN layout of tables/rows is for `scripts/audit-ui-dump.mjs` in A13).
- Hindi/Bhojpuri wording of the 12 new UI keys (owner review item in OWNER-TODO stands); the corpus snippets shown in the planet sheet are English for hi/bho (carry-over A-INFO-1; chrome stays in the UI language).
- Pro-tier rendering of pratyantar dates (code path exists, `isPro()` is false in Phase A).
- `varga(chart, 'D9')` and `chalit(chart)` values themselves (A02/A04 engine suites own them); here they are only drawn.
