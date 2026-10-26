# Phase A code review — iteration 2 (2026-10-26)

Reviewer step `a-review` of workflow `wf_86107bfa6c58305a`. Worktree `c:/Users/sudiskmr/Downloads/DomainClassification/shubhvela`, HEAD `25735b4` (a-fix iteration-2 commits `0a4edff`, `217c4d2`, `7949b01`, `848ffa8`, `dc6b759`, `25735b4` on top of the iteration-1 HEAD `63f86d9`). Working tree clean before and after the review. Previous review: iteration 1 (below, §6) — CHANGES_REQUESTED with 1 BLOCKING (B1 choghadiya table), 5 MEDIUM, 7 NIT.

Verdict: **APPROVED** — 0 BLOCKING, 4 MEDIUM, 4 NIT remaining. Verdict file: `review-phase-a.json` (same folder). The remaining MEDIUM/NIT items were appended to `carry-over.md` under "Phase A review leftovers (mandatory for Phase B)".

## 1. What was run (recorded outputs)

| Command (repo root) | Result |
|---|---|
| `npm test` | exit 0 — content 9 files / **84** tests; content-tools 1 / **16**; engine 19 files + 1 skipped / **963 passed + 1 skipped** (iteration 1: 958; +5 = `test/choghadiya.test.ts`); app 21 suites / **135** tests / 6 snapshots; web: no test files. Matches verification-a-fix.md §1. Side effect: the suites rewrote `generatedAt` in `packages/engine/reference/results*.json` (timestamps only, checked with `git diff`) — reverted with `git checkout -- packages/engine/reference`. |
| `npm run typecheck` | exit 0 (content, content-tools, engine, app, web) |
| `npm run lint` | exit 0 (app `eslint .`) |
| `npm run reference:check -w packages/engine` | **exit 1** — charts OK 60/60 (drik 60, astrosage 60, jpl 60) · panchang OK 150/150 · **festivals OK 600/600** ("12 slug-years not published by Drik (cases.json notOnDrik)") · tz OK 12/12 · **matching SHORT 0/20** (Phase B, B01/B02). The only shortfall left is matching. |
| `git --no-pager grep -I "password :"` | only `docs/build-rules.md` (the rule text). Token/private-key regex grep empty. `git ls-files release` = `release/README.md` only; keystore + KEYSTORE-INFO.txt ignored (`git check-ignore -v`). |
| `node scripts/audit-ui-dump.mjs --summary shots/phase-a/audit.json` | `{"shots":102,"smallControls":0,"intersections":0,"covered":0,"failing":0}`; parsed the JSON: 102 entries, 102 `pass: true`, densities 443/390 ×96, 480/360 ×3, 420/411 ×3 — no density/width mismatch (the fixer's stale-dump problem is gone). |
| Rebuild decision | `git log -1 --format=%cI -- app packages` = 2026-10-26T08:23:04; newest source file under app/src, app/app, packages/engine, packages/content = 08:10:59 (`app/app/settings/privacy.tsx`); `release/Shubhvela-0.1.0-x86_64.apk` built 08:46:26 (100.6 MB); newest PNG 09:38:43. The APK is newer than every UI source and the shots are newer than the APK → no rebuild (disk 10.07 GB free). `android/app/build` and `android/app/.cxx` absent. |
| PNG size gate | All 103 PNG read from the IHDR header: 864×1920, none over 1920 px. |
| Spot-check of the B1 fix | Read `vendor/jyotish/src/core/muhurta/choghadiya.ts`: all seven day rows are rotations of Udveg, Chal, Labh, Amrit, Kaal, Shubh, Rog from the weekday lord (Sun Udveg · Mon Amrit · Tue Rog · Wed Labh · Thu Shubh · Fri Chal · Sat Kaal) and all seven night rows rotations of Shubh, Amrit, Chal, Rog, Kaal, Labh, Udveg — checked row by row against the Drik Panchang tables. `test/choghadiya.test.ts` (5 tests, inside `npm test`) asserts the rotation law, the four published rows and the Sunday 25 Oct 2026 Lucknow segments (chog-day-6 Shubh good 13:14–14:39, no override; chog-day-7 Rog avoid). VENDOR.md records the patch. |
| Spot-check of the N4 fix | `festivals.ts` `shiftedTithiText`: Maha Navami = Dussehra Dashami − 1 → Navami; Holi = Purnima + 1 → Krishna Pratipada renamed per tradition; solar sources stay null; a shift leaving the month falls back to the udaya tithi. `reference/festivals/drikpanchang/delhi-2026.json` confirms Durga Ashtami and Maha Navami both on 2026-10-19 and Dussehra 10-20, as the calendar shot shows. |
| Spot-check of M2 | `check.mjs` subtracts only the six `notOnDrik.entries` (each with slug, year, cities, reason) = 12 slug-years from the required 612 → 600; the exclusion is printed in the report, so the gate still measures real shortfalls. |
| Spot-check of M4 | `legal.ts` `GRIEVANCE_EMAIL_CONFIRMED = false` + `grievanceText()` appends `consent.grievanceProvisional` (en/hi/bho present in `ui/*.json`); consent.tsx and privacy.tsx both use it; `flows.test.tsx` asserts it. |
| Honesty grep | `coming soon|placeholder|TODO` under app/src, app/app, ui/*.json hits only code comments, `placeholderTextColor` and the honest Pro strings ("Pro is not in this build yet", "The free plan keeps two profiles… Pro is not in this build yet"). |

## 2. Screenshots opened this iteration (one per read, all 864×1920)

today-en-light-390 (band: Avoid · Neutral · Good 09:00–11:50 · Avoid 11:50–13:14 · **Good 13:14–14:39** with the 13:32 marker · Avoid 14:39–17:28 · night; Now line "Good · Shubh choghadiya · Sun hora · next: Gulika 14:39 (avoid)") · today-segments-en-light-390-scrolled (rows Udveg, Chal, Labh, Amrit, Abhijit "11:50–12:12 overridden by Yamaganda, Kaal choghadiya", Yamaganda, Kaal, **Shubh good**, Gulika, **Rog avoid**, Rahu Kaal 16:04–17:28 = the published Sunday row; one verdict chip per row) · today-hi-dark-390 · today-bho-dark-390 · today-en-light-390-f13 (band labels hidden at 1.3×, nothing clipped) · today-en-light-390-end (footer "Guidance for reflection, computed from your chart and today's sky. Not a prediction."; Upcoming strip with FAMILY TITHI and VRAT cards, "All dates") · onboarding-consent-en-light-390-end and onboarding-consent-hi-dark-390 (grievance address + "This contact address is provisional and will be confirmed before release." / Hindi equivalent) · settings-privacy-en-light-390 · family-en-light-390 and family-en-light-390-f13 ("Priya: Moon in the 7th house, Vadha tara" — one tara name set) · family-calendar-en-light-390 and family-calendar-bho-dark-390 ("Maha Navami · Ashwin Shukla Navami"; Barsi row highlighted; segmented controls show fill + underline in both themes) · charts-north-en-light-390-scrolled (planet table 31/30/39 %, "U. Bhadrapada 2", dignities, approx tag on Sun 29°24′ Kumbha) · dasha-tree-en-light-390 ("You are here · 25 Oct 2026", Rahu–Ketu current, pratyantar rows "Pro") · festival-detail-hi-dark-390 (Diwali 2026 Sun 8 Nov, "चंद्रोदय सोम 9 नव 06:20", puja window).

The charts/dasha/festival-detail/panchang-sheet/onboarding-birth/settings shots are iteration 1's (no code change renders there: the fix commits touch choghadiya, festival tithi labels, tara strings, grievance text). Iteration 1 opened 33 shots including those screens in all three languages and both themes; this iteration opened 17.

HARD NO list on every opened shot: no gradients, glow, neon, nebula, particles, orbs, stock illustrations, emoji in chrome, shadows (hairlines only), autoplay, fake numbers, testimonials or tickers. Type: Tiro titles, Noto body (Devanagari screens), tabular times; 12 sp floor held (audit smallControls 0, no clipped text at 1.3×); 44 dp controls (audit); selected chip/tab/segmented states visible in light and dark; approx tag indigo; light first paint unchanged (`ThemeProvider.tsx` default light, verified in iteration 1).

## 3. Findings

### BLOCKING — none

B1 (F5, choghadiya Shubh/Rog swap) is fixed: table, test, VENDOR.md, shots and audit all verified above.

### MEDIUM (appended to carry-over.md)

- **M1 (F23) Holi 2026 eclipse sutak** — engine Holika Dahan 2026-03-02 / Holi 03-03; Drik 03-03 / 03-04 (lunar eclipse 2026-03-03). Documented in `reference/CONVENTIONS.md`, excluded from `verified-dates.json` (footer "not yet verified" — honest). Needs `SearchLunarEclipse` on Purnima-night festivals before the Phase D release gate — owner cluster B01 (= carry-over A-MEDIUM-2).
- **M2 (F23 gate) `reference:check` exits 1 on matching 0/20** — `drik-matching.mjs` fails after Submit; suite `it.skip`. Festivals is now 600/600 after the documented exclusions. Owner cluster B01/B02 (= remainder of A-MEDIUM-1).
- **M3 (D3) Hindi UI shows English interpretive text** — daily note, Family Today, festival "what to do" bodies are English on hi/bho because no `corpus/<domain>/hi.json` exists (GEMINI_API_KEY not set; `gh secret list` empty per the fixer). Owner item 5 (dispatch `corpus-translate.yml -f lang=hi`); the bho → hi → en fallback stays until then (= A-INFO-1).
- **M4 (F1, spec §10) grievance address and privacy URL still provisional** — the UI now says so (fixed for Phase A), but the address must be replaced and `GRIEVANCE_EMAIL_CONFIRMED` flipped before any public build, and "Read the privacy policy" opens `<webBase>/privacy/`, a 404 until D01 publishes it — owner clusters D01 (page) / D04 (release gate).

### NIT (appended to carry-over.md)

- **N2 (F24) Family Today speaks to another member in the second person** ("Today's Moon is in the 7th sign from your birth Moon" under Amma) — fragments are authored for the self profile; render a third-person variant or prefix the name — content cluster B02/C02 (= iteration-1 N2).
- **N3 (F5/F8) place name stays Latin in hi/bho** ("Lucknow, Uttar Pradesh, India" in the pill, the panchang sheet and the festival detail); gazetteer `name_hi` (758 of 37,937 rows) unused — profile editor/schema owner B06 or later (= iteration-1 N3).
- **N7 (F23) Sheetala Ashtami 2028** Drik 03-17 vs engine 03-18, rule unresolved, footer honest (= A-NIT-1).
- **N8 (copy, hi) consent button "समझ गया, आगे बढ़ें" is masculine** (spec §7 "no gendered assumptions"); Bhojpuri "समझ गइल" does not inflect. Use e.g. "समझ लिया, आगे बढ़ें" or "ठीक है, आगे बढ़ें" — `ui/hi.json` `consent.agree`, owner Bhojpuri/Hindi copy review or the first Phase B cluster touching `ui/*.json` (B03).

Closed since iteration 1: B1 (fixed), M5 (today-en-light-390-end.png shows the footer and the Upcoming strip), N1 (one tara set: Pratyari/Sadhaka/Vadha in ui, rules corpus and summary sentence), N4 (Maha Navami sub-line), N5/N6 (docs/design.md §4 matches the built 31/30/39 % table and the 1.3× wrap fallback).

## 4. Acceptance checks (spec §3, Phase A) — status

| Feature | Status | Evidence |
|---|---|---|
| F1 | pass | consent → birth → intent; "Your Moon: Kanya · Uttara Phalguni 4" on Today (en/hi/bho); A13 timing 7.9 s; grievance line honest |
| F2 | pass | Sun 29°24′ Kumbha drawn indigo + "approx." in the table; Moon-chart mode by `charts-screen` tests |
| F3 | pass | avatar row, "2 of 2 profiles · 0 of 5 reminders (free)", Add → CapSheet "Pro is not in this build yet" |
| F4 | pass | tz suite 12/12 inside `npm test`; reference:check tz OK |
| F5 | **pass** (B1 fixed) | band, segment list, Now line and legend consistent with the corrected table; Sunday row = Drik's; `choghadiya.test.ts` covers all 7 days |
| F6 | pass | five note rows each with Why?; English bodies on hi/bho (M3) |
| F7 | pass | Upcoming strip visible in `today-en-light-390-end.png` + `today-upcoming` tests |
| F8 | pass | panchang sheet (iteration 1 shots): tithi/nakshatra/yoga/karana with end times, Vikram/Shaka, month both systems, ritu, ayana, rashis, moonrise/moonset |
| F11 | pass | North/South/East shots; planet table with dignities; Houses card by tests |
| F13 | pass | planet sheet shots (iteration 1) with planet-in-sign/house, rule ids, Why? |
| F14 | pass | dasha tree: Sun balance to 6 Oct 1998 from Moon 8°44′ Kanya (U. Phalguni 4), Rahu–Rahu 6 Oct 2015–19 Jun 2018 (2.7 y) recomputed by hand; "You are here · 25 Oct 2026"; pratyantar "Pro" |
| F19 | pass (tests) | calculation settings + recompute toast (`charts-screen`); caption "Lahiri · Mean node" |
| F20 | pass | Priya Chaitra Krishna Pratipada → Tue 23 Mar 2027 (Upcoming card), Amma Ashadha Shukla Dwitiya (iteration 1) |
| F21 | pass | Barsi · Dadaji on Ashwin Krishna Dashami highlighted in the calendar |
| F22 | pass (tests + VRAT card) | Satyanarayan vrat Sun 25 Oct on the Upcoming strip; VratScreen tests |
| F23 | pass with M1/M2/N7 | 2026–2028, tradition/region toggles, 274 dates at Lucknow; Drik 600/600; Durga Ashtami/Maha Navami 19 Oct and Dussehra 20 Oct 2026 = Drik; Diwali 8 Nov 2026 |
| F24 | pass | Family Today rows with Why? (N2) |
| F25 | pass | `f25-airplane-notification.png` (A13); defaults Off; cap 300 by planner tests |

Plan §3 items owned by Phase A (M7, N1, N2, N3, N4, N6, N7, N8, N11, N12 launch part, N15, N19, R1-M5): verified in iteration 1 and unchanged by the fix commits; N1 legend "(pattern = verdict)" and N4 glued ranges/pada re-seen on this iteration's shots. carry-over.md: A-MEDIUM-1 → M2 remainder; A-MEDIUM-2 → M1; A-NIT-1 → N7; A-INFO-1 → M3; A-NIT-2 closed; A-INFO-2 — the fixer booted the rebuilt APK on the emulator and every screen rendered, so no "Invalid hook call" at launch.

## 5. Verified / not verified

Verified by running: `npm test`, `npm run typecheck`, `npm run lint`, `reference:check`, secret grep, audit summary + JSON parse, PNG header sizes, APK/source/PNG timestamp comparison. Verified by reading the fix diff (`git diff 63f86d9..HEAD`, 19 files, +226/−29) and by opening 17 screenshots.
Not verified: the Why?/Legend/Houses sheets, vrat screens, Settings sub-screens other than Privacy and the profile editor on screen (tests only); anything on a physical arm64 device; TalkBack; the hi/bho wording of the new `consent.grievanceProvisional` string (owner review); Drik's own choghadiya pages (the fixer used Prokerala's Monday table + the rotation law; the Drik panchang reference has no choghadiya field); the arm64 APK (a-ship builds it).

---

## 6. Iteration 1 record (2026-10-26, kept for the trail)

Verdict then: CHANGES_REQUESTED — B1 (F5) Choghadiya day table wrong on Sun/Mon/Wed/Fri (Shubh/Rog swapped in the vendored `DAY_SEQUENCES` rows 0/1/3/5 and `CHOGHADIYA_ORDER`; `goodHours('2026-10-25', Lucknow)` returned chog-day-6 = Rog avoid / chog-day-7 = Shubh, so the Today band painted one Avoid span 11:50–17:28). M1 Holi 2026 eclipse · M2 reference:check exit 1 (matching 0/20 + 12 unfetchable slug-years) · M3 Hindi corpus English · M4 grievance placeholder shown as real · M5 no PNG of the Upcoming strip/footer. N1 Vadha/Naidhana inconsistency · N2 second person · N3 Latin place name · N4 Maha Navami without tithi sub-line · N5 1.3× pada wrap undocumented · N6 planet-table column docs 31/36/33 vs built 31/30/39 · N7 Sheetala Ashtami 2028. Commands then: `npm test` 84/16/958+1/135, typecheck 0, lint 0, reference:check exit 1 (festivals 600/612), audit 98 shots 0 failing; 33 screenshots opened.
