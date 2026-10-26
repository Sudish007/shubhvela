# Verification — Phase A fixer `a-fix` (iteration 2 of the phase-a-review loop, 2026-10-26)

`review-phase-a.json` existed with `"verdict": "CHANGES_REQUESTED"` (1 BLOCKING, 5 MEDIUM, 7 NIT; `review-phase-a.md`
iteration 1, HEAD reviewed `63f86d9`). This iteration fixes the BLOCKING finding first, then every MEDIUM/NIT that lives in
Phase A files, re-runs the verification set, rebuilds the x86_64 screenshot APK, re-shoots the affected screens and
rebuilds `shots/phase-a/audit.json`. The iteration-1 record is kept below (section I1) unchanged.

## 1. Verification set (final run on the committed tree, HEAD `25735b4` + this file)

| Command (repo root) | Result |
|---|---|
| `npm test` | exit 0 — content 9 files / **84** tests; content-tools 1 file / **16**; engine 19 files + 1 skipped / **963 passed + 1 skipped** (iteration 1: 958; +5 = new `test/choghadiya.test.ts`); app 21 suites / **135** tests / 6 snapshots (1 snapshot updated: `calendar.test.tsx` now renders the Maha Navami sub-line); web: no test files |
| `npm run typecheck` | exit 0 (content, content-tools, engine, app, web) |
| `npm run lint` | exit 0 (app `eslint .`) |
| `npm run reference:check -w packages/engine` (`node reference/check.mjs`) | charts OK 60/60 · panchang OK 150/150 · **festivals OK 600/600** (required 600 after the 12 documented `notOnDrik` slug-years) · tz OK 12/12 · matching SHORT 0/20 → still exits 1 (Phase B, B01/B02) |
| `node scripts/audit-ui-dump.mjs --summary shots/phase-a/audit.json` (rebuilt from scratch, density 443 for `-390`, 480 for `-360`, 420 otherwise) | `{"shots":102,"smallControls":0,"intersections":0,"covered":0,"failing":0}` |

Side effect of `npm test`: the suites rewrote `packages/engine/reference/results*.json` timestamps only — reverted with
`git checkout` so the committed files carry the reviewed values.

## 2. Findings fixed (commit per finding)

| Finding | Commit | What changed | Evidence |
|---|---|---|---|
| **B1 (F5) Choghadiya day table wrong on Sun/Mon/Wed/Fri** | `0a4edff fix(F5)` | `packages/engine/vendor/jyotish/src/core/muhurta/choghadiya.ts`: `DAY_SEQUENCES` rows 0/1/3/5 and `CHOGHADIYA_ORDER` had Shubh and Rog swapped; corrected to the hora-lord cycle Udveg, Chal, Labh, Amrit, Kaal, **Shubh, Rog** (Sun: Udveg Chal Labh Amrit Kaal Shubh Rog Udveg · Mon: Amrit Kaal Shubh Rog Udveg Chal Labh Amrit · Wed: Labh Amrit Kaal Shubh Rog Udveg Chal Labh · Fri: Chal Labh Amrit Kaal Shubh Rog Udveg Chal). Night rows unchanged (already right). Tables exported; patch recorded in `vendor/jyotish/VENDOR.md`. New `packages/engine/test/choghadiya.test.ts` (5 tests): day cycle = `HORA_ORDER` by lord, every day row = rotation of the day cycle from the weekday lord, every night row = rotation of Shubh Amrit Chal Rog Kaal Labh Udveg from the 5th lord, the four published rows verbatim (Prokerala Monday 26 Oct 2026 table fetched 2026-10-26: Amrut Kaal Shubh Rog Udveg Char Labh Amrut / night Char Rog Kaal Labh Udveg Shubh Amrut Char), and Sunday 25 Oct 2026 at Lucknow: `chog-day-6` = `choghadiya-shubh` good 13:14–14:39 with no override, `chog-day-7` = `choghadiya-rog` avoid. | `today-*-390.png` (6): the band now shows Good 13:14–14:39 between the two Avoid hatches; Now line "Now 13:32 · Good · Shubh choghadiya · Sun hora · next: Gulika 14:39 (avoid)" (emulator clock pinned to Sun 25 Oct 2026 13:3x IST); `today-segments-en-light-390-scrolled.png` lists Udveg, Chal, Labh, Amrit, Kaal, Shubh (good), Rog (avoid), Udveg = the published Sunday row |
| **M2 (F23) `reference:check` counted 12 slug-years Drik does not publish** | `7949b01 fix(F23)` | `reference/festivals/cases.json` gained `notOnDrik.entries` (slug, year, cities, reason: Tamil Hanuman Jayanti / Saphala / Pausha Putrada Ekadashi have no occurrence inside calendar 2026 on Drik or in the engine — engine next dates 2027-01-07 / 2027-01-03 / 2027-01-18 computed this step; Snana Purnima 2026–28 absent from the fetched Delhi and Chennai pages, engine 06-29 / 06-18 / 06-07); `reference/check.mjs` removes them from the required count and prints the exclusion. Matching 0/20 is now the only shortfall. | check output above |
| **M4 (F1) Grievance placeholder shown as real** | `dc6b759 fix(F1)` | `app/src/legal.ts`: `GRIEVANCE_EMAIL_CONFIRMED = false` + `grievanceText(t, key)` appends the new UI string `consent.grievanceProvisional` (en "This contact address is provisional and will be confirmed before release." / hi / bho) under the address on the consent notice and Settings → Privacy until the owner flips the flag; `docs/OWNER-TODO.md` item 8 says how, and records that `<webBase>/privacy/` is a 404 until D01 publishes it (link left as is: D01 builds the page before any public build). `app/test/flows.test.tsx` asserts the provisional line on the consent screen. | `onboarding-consent-en-light-390-end.png`, `settings-privacy-en-light-390.png` (new), `onboarding-consent-*-390.bottom.ui.xml` (6, re-taken) |
| **M5 (F7/F6) Upcoming strip and note footer had no PNG** | shots only | New `today-en-light-390-end.png`: footer "Guidance for reflection, computed from your chart and today's sky. Not a prediction." + Upcoming strip (FAMILY TITHI card "Priya's janma tithi · Chaitra Krishna Pratipada · Tue 23 Mar", VRAT card "Satyanarayan vrat · Sun 25 Oct", "All dates" 44 dp) | that file |
| **N1 (F6/F24) Tara names** | `848ffa8 fix(F6)` | One set in English: `ui/en.json` `note.tara.pratyak/sadhana/naidhana` → Pratyari / Sadhaka / Vadha (what the daily fragments, the glossary ids and the hi/bho strings प्रत्यरि/साधक/वध already used); `corpus/rules/en.json` tara-bala-5/6/7 and the summary sentence ("… Vadha (7, also called Naidhana)"); `LINKED_TERMS` in the content test follows. | `family-en-light-390.png` "Priya: Moon in the 7th house, Vadha tara"; `today-en-light-390-scrolled.png` caption |
| **N4 (F23) Maha Navami row without tithi sub-line** | `217c4d2 fix(F23)` | `packages/engine/src/calendar/festivals.ts` `shiftedTithiText`: offset rules shift the source festival's tithi label by the offset (Dussehra Dashami − 1 = Ashwin Shukla Navami; Holika Dahan Purnima + 1 = Chaitra Krishna Pratipada in Purnimanta / Phalguna Krishna Pratipada in Amanta); a shift that would leave the month falls back to the udaya tithi; solar sources (Lohri from Makar Sankranti) stay without a label like Makar Sankranti itself. `calendar.test.ts` asserts the three; app calendar snapshot updated. | `family-calendar-*-390.png` (6): "Maha Navami · Ashwin Shukla Navami" |
| **N5/N6 (F11 docs) planet table contract** | `25735b4 docs(design)` | `docs/design.md` §4 now states 31/30/39 %, the short nakshatra names, the glued pada and the 1.3× wrap fallback (never a mid-word break) as built. | — |

Hard-UI check on every PNG opened this step (today en-light/hi-dark/f13, today-segments en-light + scrolled, today end,
consent en-light + end, family en-light, family-calendar en-light): no gradients, glow, shadows, emoji, fake numbers;
12 sp floor held; no clipping at 1.3×; selected segmented/tab states visible in both themes. Audit 102/102 PASS.

Audit false alarms met and resolved (not app defects): (a) stale uiautomator dumps — when `uiautomator dump` fails the
previous `/sdcard/ui.xml` is read back, so six consent `.bottom.ui.xml` files held another language's un-scrolled tree
and the two `family-calendar-bho` dumps were taken at 420 dpi; re-taken with a per-dump marker check and verified by the
tab-bar bounds (`[614,2306][736,2351]` at 443 dpi), both re-audited clean; (b) my first `today-en-light-390-end` dump was
at 420 dpi (density override had not applied) and read "All dates" as 41.5 dp — re-shot at 443 dpi: 122 px = 44 dp.

## 3. Findings NOT fixed here (owner / Phase B items, unchanged from the review)

- **M1 (F23) Holi 2026 eclipse sutak** — needs an eclipse model and a sutak convention that moves a festival date; carry-over A-MEDIUM-2, owner cluster B01, before the Phase D release gate. Footer still reads "not yet verified" (honest).
- **M2 remainder** — matching 0/20: `drik-matching.mjs` still fails after Submit; B01/B02.
- **M3 (D3) Hindi corpus** — `gh secret list --repo Sudish007/shubhvela` returned no secrets (checked by name, 2026-10-26), so `GEMINI_API_KEY` is still absent; owner item 5; the bho → hi → en fallback stays. Owner steps never block.
- **N2 (F24) second person for other members** — needs third-person fragments (content authoring) → carry-over, as the reviewer recorded.
- **N3 (F8) Latin place name in hi/bho** — would need `name_hi` stored per profile (schema + editor change) and only 758 of 37,937 gazetteer rows carry a Hindi name; left as carry-over, not changed (behaviour beyond design.md 7, which only fixes numerals).
- **N7 (F23) Sheetala Ashtami 2028** — unresolved rule, footer honest (A-NIT-1).

## 4. Build, emulator, shots

- Disk before Gradle: 12.28 GB free (gate 4 GB). `scripts/build-apk.ps1 -Abi x86_64 -Version 0.1.0 -ScreenshotMode`: Gradle 1,369 s, exit 0; `release/Shubhvela-0.1.0-x86_64.apk` 100.6 MB, `package: name='com.shubhvela.app' versionCode='1' versionName='0.1.0'`, `native-code: 'x86_64'`, APK Signature Scheme v2 true; `android/app/build` and `.cxx` removed by the script.
- `scripts/emulator.ps1 -Boot` (AVD `shubhvela_test`), `adb install -r`, `adb root` + `date 102513302026.00` + `auto_time 0` so the clock read **Sun 25 Oct 2026 13:30–13:59 IST** (same Vedic day as every other Phase A shot; the Now marker sits inside the corrected Shubh segment).
- Re-shot (42 PNG, all shrunk to 864×1920, one per `read_file`): today ×6, today-segments ×6, today 360/412/1.3×, today scrolled, today-segments scrolled (new), today end (new), onboarding-consent ×6 + end (new), family ×6 + 360/412/1.3×/scrolled, family-calendar ×6, settings-privacy en-light (new). `shots/phase-a/` now holds **103 PNG** (99 + 4 new) and `audit.json` 102 entries (`f25-airplane-notification.png` has no dump).
- Emulator killed; the 27 `node_modules/*/android/{build,.cxx}` folders deleted; 10.08 GB free at the end.

## 5. Acceptance re-check (spec section 3, Phase A) — delta to iteration 1

F5 now passes against the published tables (Sunday row verified on the shots; Monday row verified against Prokerala's
table; all seven rows by the rotation test). F1 consent notice is honest about the grievance address. F7 has visual
evidence. F23 calendar rows all carry a tithi sub-line (except solar festivals). Everything else as iteration 1 / the
review table.

## 6. Not verified
- Matching references (0/20); the eclipse/sutak rule (M1); Sheetala Ashtami (N7); Hindi corpus (M3) — owner/Phase B.
- Drik's own choghadiya pages were not fetched (the Drik panchang reference JSON has no choghadiya field); the row tables were checked against Prokerala's live table and the rotation law.
- Charts, dasha-tree, festival-detail, onboarding-birth, panchang-sheet and settings shots are iteration 1's — no code change touched them (the tara/grievance/calendar/choghadiya changes do not render there).
- Nothing on a physical arm64 device; hi/bho wording of the new `consent.grievanceProvisional` string is unreviewed by the owner.

---

# I1. Iteration 1 record (2026-10-26, unchanged)


`review-phase-a.json` did not exist at the start of this step, so this is the FIRST iteration: full verification set,
seam check between the Phase A clusters, every spec section 3 acceptance test of the phase re-read against the app code
and the screenshots in `shots/phase-a/`, hard-UI-rule fixes on any screen, rebuild + re-shoot of the screens whose UI
changed, and the carry-over A-MEDIUM-1 reference-data resume.

## 1. Verification set (final run on the committed tree)

| Command (repo root) | Result |
|---|---|
| `npm test` | exit 0 — content 9 files / **84** tests; content-tools 1 file / **16**; engine 18 files + 1 skipped / **958 passed + 1 skipped** (A13: 717 — the festival suite now compares 600 slug-years instead of 359, see §3); app 21 suites / **135** tests / 6 snapshots (A13: 133; +2 PlanetTable tests); web: no test files |
| `npm run typecheck` | exit 0 (content, content-tools, engine, app, web) |
| `npm run lint` | exit 0 (app `eslint .`) |
| `npm run reference:check -w packages/engine` | charts OK 60/60 (drikpanchang **60**, astrosage 60, jpl 60) · panchang OK 150/150 · tz OK 12/12 · festivals **600 fetched / 600 passed** of the naive 612 (12 slug-years are absent from Drik's pages, §3) · matching SHORT 0/20 → still exits 1 |
| `node scripts/audit-ui-dump.mjs --summary shots/phase-a/audit.json` | `{"shots":98,"smallControls":0,"intersections":0,"covered":0,"failing":0}` (A13: 93 shots) |

Seams between A09–A12: no failing seam. Re-pointed routes from A10 → A12 are in place (`UpcomingStrip`: vrat card → `/family/vrat/<family>`, "All dates" → `/family/calendar`; family-tithi card → the profile editor; dasha/transit cards → Charts per A11). Observed but NOT changed (design choices, recorded for the reviewer): Family Today's note for another member is written in the second person ("…from your birth Moon") because the daily fragments are authored for the self profile; the panchang sheet's place name stays Latin in hi/bho (the gazetteer `name_hi` is not used for the profile's stored place name).

## 2. Hard-UI fixes found on the screenshots (code changed → APK rebuilt 4×, screens re-shot)

1. **Planet table broke words in two (F11, spec 8 / design 7)** — `charts-north-en-light-390-scrolled.png` (new scrolled shot) showed "Uttara Bhadr / apada 2" and "Uttara Phalgu / ni 4": `padaText()` glued the whole "nakshatra pada" run with U+00A0 (N4) and the 33 % column could not hold it, so Android split the word. Fix in three parts, each verified on the emulator: (a) `app/src/charts/model.ts` `padaText` now uses the design's SHORT nakshatra names ("U. Bhadrapada 2", exactly as `mocks/charts.html` prints "P. Bhadrapada 4") and glues only the pada to the last word; (b) `app/src/charts/PlanetTable.tsx` columns 31 / **30** / **39** % (design 4 said 31/36/33 — "Bhadrapada 2" at 15 sp needs ≈ 100 dp, the 33 % cell offered 99; "Vrishchika 29°24′" still fits 30 %); (c) large text (font scale > 1.15): the tags move to a full-width line under the three cells and the pada may wrap onto its own line, because at 1.3× "debilitated"/"vargottama" (31 %) and "Bhadrapada 2" (39 %) cannot fit any column — before this the 1.3× table (never shot in A13) read "debilitate / d", "vargotta / ma", "Bhadrapa / da 2". Shots after the fix: `charts-north-en-light-390-scrolled.png`, `charts-north-hi-light-390-scrolled.png`, `charts-north-en-light-390-f13-scrolled.png` — no mid-word break, 12 sp floor held, audit PASS.
2. **Garbled Devanagari short nakshatra names (engine locale)** — `locale.nakshatraShort.hi/bho` produced "पू. ाषाढ़ा" / "उ. ाषाढ़ा" (a bare vowel sign: the generic `^पूर्व` replacement cut the sandhi form पूर्वाषाढ़ा). Fixed in `packages/engine/src/locale/index.ts` (`shortDevanagari`: "पू. आषाढ़ा", "उ. आषाढ़ा"); the table above is the first consumer, so no earlier screen showed it.
3. **Moonrise after midnight shown as a bare time (F8/F23 honesty)** — Diwali 2026 at Lucknow read "Sunrise 06:20 · Moonrise 06:20" (A13 noted it as engine output). The engine's moonrise belongs to the Vedic day and here falls at 06:20 on **9 Nov**, one minute before the next sunrise. `FestivalDetail` and the Today card caption now use `fmtTimeOrDayTime` (weekday + date when the instant is on another civil date), as the Panchang sheet already did: "Moonrise Mon 9 Nov 06:20" / "चंद्रोदय सोम 9 नव 06:20" (`festival-detail-*-390.png`, 6 re-shots). Values unchanged; only the label is unambiguous.
4. `settings-en-dark-390.png` was still 1080×2400 (A13 missed one shrink) — shrunk to 864×1920 before reading.

Added evidence: `today-en-light-390-scrolled.png` (daily note rows with Why?, footer), `family-en-light-390-scrolled.png` (event cards with series switches + Why?), `charts-north-*-scrolled.png` (planet table). Every new PNG was shrunk to 864×1920 and read one per call; 99 PNG now in `shots/phase-a/` (A13: 94), `audit.json` 98 entries, all PASS.

## 3. Carry-over A-MEDIUM-1 — reference data resumed (the Drik block had lifted)

| Fetch | Loads | Result |
|---|---|---|
| `drik-festivals.mjs --city chennai --max 60` | 27 | `chennai-2026.json` completed (months 10–12), `chennai-2027.json` (728 events), `chennai-2028.json` (733) |
| `drik-kundali.mjs --max 8` | 6 | `u09.json`, `u10.json` → Drik 60/60 charts |
| `drik-matching.mjs` | 1 + 2 | FAILED twice: first the autocomplete wait (fixed: wait for a VISIBLE `.ui-autocomplete li`, the hidden second list kept stale items), then `waitForNavigation` timed out after Submit → Confirm (the matching page's flow differs from the kundali page's). Not pursued further (≤ 60 loads/run rule, Phase B owns matching); matching stays 0/20, suite `it.skip` |

Festival suite with the new Chennai data: 3 new disagreements, resolved as follows (all in `reference/CONVENTIONS.md`):
- **Bhishma Ashtami 2028**: Drik Delhi 02-03 but Chennai 02-04; the Ashtami runs 02-03 12:21 → 02-04 12:47 and both madhyahna instants fall inside it. Rule adopted: `prefer: 'vyapti'` = the day on which the tithi covers MORE of the madhyahna kala (sunrise + 0.4..0.6 × daylight), ties → first (Dharmasindhu adhika-vyapti): Delhi 78.8 vs 78.0 min → 02-03, Chennai 71 vs 95 min → 02-04. Applied to all five madhyahna festivals (Bhishma Ashtami, Rama Navami, Ganga Saptami, Ganesh Chaturthi, Rishi Panchami): 5 × 3 years × 2 cities all agree with Drik. Code: `observance.ts` `Prefer = 'first' | 'last' | 'vyapti'`.
- **Karthigai Deepam 2027**: Drik Chennai 12-11, Delhi 12-12; Krittika 12-11 17:38 → 12-12 16:42, Chennai sunset 17:43 is inside it, Delhi's 17:24 is not. Rule adopted: `at: 'sunset'` on the nakshatra rule (the lamps are lit at dusk); no sunset inside → the existing daylight-coverage rule. 2026 and 2028 unchanged.
- **Sheetala Ashtami 2028 Chennai**: same as the Delhi difference (A-NIT-1); keyed as intentional with the new evidence (Drik's Saptami 2027/2028 are not udaya days either; "tithi at sunrise + 0.84–0.88 × daylight" fits all six dates but has no classical source) — still unresolved, not adopted.
- Suite fix: Shravan Somvar (weekday-in-month, `day` = nth Monday, no `end`) now compares every Monday with Drik's "First..Fifth Shravan Somwar Vrat" (6 slug-years), and `name-map.json` gained "Hala Shashthi" and the First..Fifth Shravan Somwar names.
- Chart suite: u10's Drik dasha balance is an explained outlier (Drik's Moon 31.4" from JPL predicts the 4.03-day shift); with Drik explained, AstroSage's day-only balance stands alone again, so u10 is recorded as `dashaUnverified` (not passed by fudge, not failed).

Downstream regenerated: `data/verified-dates.json` (594 verified of 600 compared; the festival detail footer reads it), `corpus/rules/en.json` via `gen-festival-rules.ts` (generator extended for `vyapti`, `at: sunset`, `minMuhurtas`, `ekadashiVrata`, `purvahna`) and `corpus/festivals/en.json` rule sentences synced — this also closed a **seam left by A04 → A05**: 32 rule sentences in the corpus still described the pre-A04 conventions (Ekadashi vriddhi/kshaya, Sharad Purnima and Kalabhairav nishita, Vat Purnima pradosh, Maha Navami offset, Vasant Panchami purvahna, "later day" rules), so the Why? sheet showed a rule the engine no longer applied. 38 festival sentences updated; content tests 84/84 green.

Carry-over A-MEDIUM-2 (eclipse/sutak rule for Holika Dahan 2026) was NOT implemented: it needs an eclipse model and a sutak convention that would move a festival date; left to B01 as recorded.

## 4. Acceptance re-check (spec section 3, Phase A features) against code + shots

F1 first value: Today header "Your Moon: Kanya · Uttara Phalguni 4" (shots; A13 timing 7.9 s). F2: approx tags on Sun (within 1° of a boundary) in hero (indigo glyph) and table; Moon-chart mode covered by tests. F3: avatar row, 2/2 quota, Add → CapSheet (family shots + tests). F4: tz suite 12/12. F5: band, Now line + Why?, flags, legend, 13 segments (today shots). F6: five note rows each with Why? (`today-en-light-390-scrolled.png`). F7: Upcoming strip (tests; cards route to vrat/calendar/charts/profile). F8: panchang sheet all fields (`today-panchang-sheet-*`). F11: three styles (north/south/east shots), planet table with dignities + approx (scrolled shots), Houses card (tests). F13: planet sheet (`charts-planet-sheet-*`). F14: dasha card + full tree with "You are here" (`dasha-tree-*`). F19: calculation settings + recompute toast (tests). F20–F22: event cards with series switches, Why?, vrat cards (family scrolled shot, tests). F23: calendar 3 years with tradition/region toggles (`family-calendar-*`), festival detail with "Verified against Drik Panchang on …" (`festival-detail-*`), festival suite 600/600. F24: Family Today rows with Why? (family shots). F25: airplane-mode delivery (A13), quiet defaults (0 of 5 enabled in shots). HARD-NO list: no gradients, glow, shadows, emoji, fake numbers on any of the 23 shots opened in this step.

## 5. Builds and emulator

Disk check before each Gradle run: 13.42 / 11.89 / 11.83 / 11.03 GB free (gate 4 GB). Four x86_64 screenshot builds (`scripts/build-apk.ps1 -Abi x86_64 -Version 0.1.0 -ScreenshotMode`): 1,210 s, 949 s, 836 s, 830 s; each verified `package: name='com.shubhvela.app' versionCode='1' versionName='0.1.0'`, `native-code: 'x86_64'`, APK Signature Scheme v2 true; `release/Shubhvela-0.1.0-x86_64.apk` (100.6 MB) is the final build. Emulator `shubhvela_test` booted 4× (68–75 s), killed before every Gradle run; `android/app/build`, `android/app/.cxx` and 27 `node_modules/*/android/{build,.cxx}` folders deleted at the end (12.27 GB free).

## 6. Not verified
- Matching references (0/20): the Drik matching form flow (`drik-matching.mjs`) is still broken after Submit; the matching suite remains skipped.
- The eclipse/sutak rule for Holika Dahan 2026 (A-MEDIUM-2) — not implemented.
- The Sheetala Ashtami rule (A-NIT-1) — still a documented difference.
- Only the Charts table and the festival detail were re-shot after the code changes; the other 390 dp shots are A13's and were not affected by any change (the Today caption change only shows when the Vedic day's moonrise is after midnight, which 25 Oct 2026 at Lucknow is not).
- The large-text (1.3×) layout was checked for the Charts table only; other screens at 1.3× remain A13's three shots.
- Nothing on a physical arm64 device; the Hindi/Bhojpuri wording of the changed corpus sentences is English (owner decision A-INFO-1) and the Devanagari short names are unreviewed by the owner.
