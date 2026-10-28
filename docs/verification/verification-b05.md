# Verification — FEAT-B05 Muhurat finder (F26), travel note (F27), naamkaran helper (F28), saved muhurats

Date: 2026-10-27. Worktree `c:/Users/sudiskmr/Downloads/DomainClassification/shubhvela`, branch `main`, base commit `ced0abf` (B04).
Commit of this step: `6207739` `feat(F26): muhurat finder, travel note, naamkaran helper`, pushed to `origin/main` (pull --rebase was a no-op: up to date).

## 1. What was built (files)

New
- `app/app/charts/muhurat/index.tsx` — Muhurat finder route `/charts/muhurat` (`Screen route="MuhuratFinder"`, banner allow-listed M5; header saved-list control 44 dp via the new `Screen.headerRight` on stack chrome). ActivityChips → RangeField → ForField → caption (free note + window rule + "Windows computed for <place>") → result count → WindowCards (first = primary Save) → PartialMatches → TravelTodayCard → ComputedFooter. Search = `engine.muhurat.score` at the self profile's place, memoised on activity/range/profiles; interstitial `show('muhuratSearchCompleted')` once per search key (never on back/re-render).
- `app/app/charts/muhurat/saved.tsx` — saved list `/charts/muhurat/saved`: activity name, when-line, sub-line, "N/10 rules met" from the saved engine breakdown, `.ics`/`.ics Pro`, Remove; empty state "No saved muhurat yet".
- `app/app/family/naamkaran.tsx` — `/family/naamkaran?profile=<id>`: profile chips (newborn caption), card with the pada's syllable first + the nakshatra's other three, names Devanagari + Latin from `corpus/naamkaran-names`, "no meaning claimed" note, Why? (rule `naamkaran-syllable`, inputs).
- `app/src/muhurat/{model.ts, ActivityChips.tsx, RangeField.tsx, ForField.tsx, WindowCard.tsx, RuleChip.tsx, PartialMatches.tsx, TravelTodayCard.tsx, ics.ts}`.
- `app/src/db/savedMuhurats.ts` — `saved_muhurats` repository (list/count/find/save idempotent/delete, `toUpcomingSaved()` for `engine.upcoming`).
- `app/src/family/naamkaranModel.ts` — `isNewborn`, `preselect`, `syllableOrder`.
- `app/test/muhurat.test.tsx` (13 tests, 1 snapshot), `app/test/naamkaran.test.tsx` (5 tests).

Changed
- `app/src/charts/routeFlags.ts` — `muhuratFinder: true` (B04's Timing and documents card now renders the Muhurat finder row).
- `app/app/_layout.tsx` — Stack screens `charts/muhurat/index`, `charts/muhurat/saved`, `family/naamkaran`.
- `app/src/today/model.ts` — `computeToday` hands `saved_muhurats` rows to `engine.upcoming()` (option `savedMuhurats`, default from the DB).
- `app/src/today/UpcomingStrip.tsx` — saved-muhurat card titles the activity in the UI language and opens `/charts/muhurat/saved`.
- `app/src/today/GoodHoursCard.tsx` — expanded segment list ends with `TravelTodayCard embedded` (F27 "on Today's segment list").
- `app/app/profile/[id].tsx` — editor of a profile < 1 year shows the "Name syllables" row → naamkaran helper.
- `app/src/components/Screen.tsx` — `headerRight` also rendered on stack chrome; `icons.tsx` + Check/Cross/Bookmark/Calendar icons.
- `packages/content/ui/{en,hi,bho}.json` — +6 keys each (1531 per language): `muhurat.rangeFrom`, `muhurat.rangeTo`, `muhurat.place`, `muhurat.pickProfile`, `travel.avoidDirection`, `travel.otherDirections`.
- Tests: `charts-screen.test.tsx` (Timing card now expected with the Muhurat row; snapshot updated — diff is exactly the 208-line card), `today-screen.test.tsx` (travel card in the expanded list).

## 2. Verification commands (FEAT list) — all run from the repo root

| Command | Result |
|---|---|
| `npm test -w app` | exit 0 — **28 suites, 218 tests, 9 snapshots passed** (B04: 26 / 200 / 8; +muhurat 13, +naamkaran 5; snapshots +1 new, 1 updated) in 103 s |
| `npm run typecheck` | exit 0 — content, content-tools, engine, app, web all `tsc --noEmit` clean |
| `npm run lint` | exit 0 — 0 errors, 0 warnings (one `no-require-imports` warning in the new test mock was silenced like `test/setup.ts`) |
| `npm test -w packages/content` (extra, strings changed) | exit 0 — 10 files, 93 tests (key-set identity en/hi/bho, namespaces) |

First runs found and fixed: `react-hooks/purity` error (`Date.now()` in the editor render → `useMountClock`), an unnecessary `useMemo` dependency (saved count is now state), `muhurat.pickProfile` missing from `en.json` (added to all three), a stale `charts-screen` expectation that the Timing card is absent (it now has the Muhurat row), RNTL `rerender` not awaited (poisoned the following renders).

## 3. Acceptance criteria

- **F26** — `muhurat.test.tsx` "every one of the 14 activities …": for each of the 14 ids, `searchMuhurat` over today..+7 (Thu 22 Oct 2026, Lucknow, Priya) returns > 0 windows, each with the 10 rules in `MUHURAT_RULE_ORDER`, `met` = count of met rules, `of` = 10, `partial` ⇔ met < 4, list in non-increasing `met` (N18 order from the engine). Screen test: free range field read-only "today – +7 days" with the computed dates and the "Any range · Pro" link (→ `/pro`); no picker fields; one chip per rule with testID `rule-<id>-met|notmet` and a11y "<label>, met/not met"; "N of 10 rules met" a11y, no "%" anywhere; first result's Save is the primary button; ".ics Pro" label on free. Save → `saved_muhurats` has 1 row (idempotent re-save), the header reads "Saved muhurats (1)", `computeToday().upcoming` contains `savedMuhurat` at the saved start and the strip card reads "Griha Pravesh" → `/charts/muhurat/saved`; the saved list renders the row, Remove deletes it. `.ics`: free → `/pro`; Pro → `writeFile("muhurat-griha-pravesh-<yyyymmdd>-<hhmm>.ics", <VCALENDAR>)` and `share(uri)` called once; text equals `engine.toIcs` with UI rule labels (contains `SUMMARY:Griha Pravesh`, "8/10 rules met", "Rahu Kaal avoided"). Pro range: picker fields present, `DateTimePickerAndroid.open` called with `mode: 'date'`, choosing 15 Nov 2026 changes the result count to the engine's count for 22 Oct–15 Nov. Partials: every partial window listed under "Best partial matches" in order; zero-results copy verbatim with exactly 3 partial cards. "All 14 activities" sheet: 14 radio rows; choosing marriage selects the chip and shows two For fields (second preselects Amma). Interstitial: `show('muhuratSearchCompleted')` once on mount, not again on re-render, again after changing the activity.
- **F27** — Thu 22 Oct 2026 Lucknow: `vara` 4, `dishaShool(4).avoid = 'south'`, sentence "Disha Shool is south on Thursdays: avoid beginning a journey towards the south today; returning is fine."; over the next 60 days every day's sentence names `dishaShool(vara).avoid` and at least one Panchak day prints "Panchak is active till …" (Bhadra on earth prints "Bhadra on earth <from>–<to>: …"); the card has a Why? and no fear words. Today screen: the expanded segment list contains `travel-today` / `travel-row` in en/hi/bho at +30 %.
- **F28** — sample newborn Aarav (2026-08-01 06:10 Lucknow) is preselected over Priya (self); four syllable chips with the pada's first and selected; its names from `naamkaranNames(nakshatra, pada, 'en')` rendered Devanagari + Latin (regex-checked), "Names are listed by sound only; no meaning is claimed beyond the syllable rule."; Why? opens the `naamkaran-syllable` rule text with the syllable input; another chip lists that pada's names; switching to Priya recomputes (Moon Uttara Phalguni per engine — the mock's "Anuradha" was sample data); `?profile=<id>` wins over the newborn; the newborn's editor shows the "Name syllables" row (→ `/family/naamkaran?profile=<id>`), Priya's does not.
- **Tests/typecheck/lint pass** — §2.

## 4. Hard-rule checks (self-audit)

- Scores are counts: "N/10 rules met" text + a bar whose width is the met/of ratio (geometry only; labelled by the a11y string "N of 10 rules met"); no percentage or stars anywhere (`queryByText(/%/)` null).
- Flags as text: Panchak/Bhadra sentences, rule chips with tick/cross icons + solid/dashed border (state never colour-only). Advisory copy from `ui/travel.*` and `corpus/rules`; no fear language.
- Every number is engine output (`muhurat.score`, `panchang`, `travelNoteFor`, `syllablesForChart`, `upcoming`); nothing fake; unbuilt rows (Janam Patri, Share card) still not rendered.
- 44 dp: chips, fields (48), buttons, Why?, header control via `Pressable44`; 12 sp floor via tokens; both themes via tokens (no hand-typed colours); +30 % snapshot of a WindowCard with no `numberOfLines`, time range glued (U+2060) and `flexWrap: 'wrap'` chips.
- PowerShell `;`, absolute paths, `git --no-pager`, `GIT_TERMINAL_PROMPT=0`, no identity set, no prebuild, no Gradle/emulator.

## 5. NOT verified

- On a device/emulator: the real share sheet for `.ics` (expo-file-system `File`/`Paths.cache` + `expo-sharing`), the native date-range picker, the anchored banner on `MuhuratFinder` (session ≥ 4) and a real interstitial after a search — B08 audit; Jest mocks all four.
- Hindi/Bhojpuri copy on screen (strings exist and pass the key-set test; corpus `rules`/`muhurat-activities` texts still English per A-INFO-1).
- Muhurat correctness beyond the engine suite (B01 verified the scorer); here only shape/order/count invariants.
- Screenshot build: `dev/state` has no newborn in the sample household, so `screen=/family/naamkaran` shoots Priya's syllables (route param `?profile=` works); no `pro=` param yet (B04 note), so the Pro range picker cannot be shot until B08 adds one.

## 6. Commit / push

`6207739` on `main`; `git pull --rebase origin main` ("Current branch main is up to date"); `git push origin main` → `ced0abf..6207739 main -> main`.
