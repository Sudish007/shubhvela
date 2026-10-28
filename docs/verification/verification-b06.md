# Verification — B06 · Matching (F29) + share-a-code (F30, mode A) + Family tools (M3)

Date: 2026-10-27. Worktree `c:/Users/sudiskmr/Downloads/DomainClassification/shubhvela`, branch `main`.
Commit: `feat(F29): 36-guna matching, share-a-code QR and typed code, Family tools` (hash in §6).

## 1. What was built

Routes (registered in `app/app/_layout.tsx`):

| Route | File | Screen |
|---|---|---|
| `/family/match` | `app/app/family/match/index.tsx` | Pick A and B: profile chips + "Enter details" (onboarding BirthForm, relationship hidden) + "Scan a code" + "Type a code"; Swap; "Match" validates and pushes the result with `a=p<id>|c<CODE>`, `b=…`, optional `an/bn` label and `as/bs` source. Entered details are encoded to a 20-char code (lossless to the minute / 0.01°, the gazetteer precision). |
| `/family/match/result` | `app/app/family/match/result.tsx` | `Screen route="MatchingResults"` (banner allow-listed, M5). "N of 36 guna" (ink `Num kind="display"`, 23.5 printed exactly), one line per side with approx tag; 8 `KootaRow`s (name, "x of y", one-line meaning = corpus `koota-<id>-1`, Why? → explanation at level 1 free / level 3 Pro + rule + the two sides as inputs); `DoshaSection` (Nadi / Bhakoot rows with the exception NAMED — lifted / "exception named, not scored" / same nakshatra-pada; Mangal dosha per person: status row with Mars-from-Lagna/Moon/Venus lines, approx tag + note when the Lagna is unknown, every cancellation rule as a `Row` with an applies / not-applied tag and the corpus text on Pro; the mutual "both charts carry the dosha" row); `BeyondSection` (4 rows, tone words only, approx tag, overlap periods with "All N periods"); computed one-paragraph summary (`match.summary`, every value engine output) + `match.summaryFree` caption on free; `Matching report PDF` button rendered ONLY when `MATCH_ROUTE_FLAGS.matchingReportPdf` is true (B07 flips it; label = `match.reportIncluded` for Pro, else `match.reportBtn` with `priceLabel('matching')`); `ComputedFooter` + `match.howComputed`. |
| `/family/share-code?profile=<id>` | `app/app/family/share-code.tsx` | `ShareCodeContent` as a pushed screen (defaults to the self profile). |
| `/family/scan?side=a|b` | `app/app/family/scan.tsx` → `src/share/ScanScreen.tsx` | expo-camera `CameraView` (QR only), `useCameraPermissions` (denied → `share.cameraDenied` + "Allow camera" when askable + "Type a code"); the scanned text is decoded locally (`/m/` URL, deep link, bare query or raw code) → the code is handed back through `src/share/scanResult.ts` and the pick screen consumes it on focus; a non-Shubhvela QR shows the one invalid message for 1.5 s and scanning continues. |

Components: `src/family/FamilyToolsCard.tsx` (rows Match two profiles → `/family/match`, Share for matching → `ShareCodeSheet` for the self profile, Name syllables → `/family/naamkaran`; placed on Family after the event cards and before the city card / Add buttons), `src/match/{model,draft,PickerAB,EnterDetailsForm,GunaHeadline,KootaRow,DoshaSection,BeyondSection}.tsx`, `src/share/{payload,scanResult,ShareCodeSheet,ScanScreen,TypeCodeField}.ts(x)`. Profile editor (`app/app/profile/[id].tsx`): header ⋮ control (`family.moreActions` = "More actions", `accessibilityState.expanded`) → sheet with the menuitem "Share for matching" → `ShareCodeSheet` for that profile; only for existing profiles. The phrase "profile menu" appears nowhere (asserted).

Share-a-code = MODE A ONLY (P5): QR of `engine.toShareUrl(payload)` = `https://sudish007.github.io/shubhvela/m/?v=1&d=YYYYMMDD&t=HHMM|u&a=0|15|30|60&lat&lon&tz&g` (no `n=`, lat/lon rounded by the engine) via `react-native-qrcode-svg` 6.3.27 (already a dependency; `enableLinearGradient` off → the modules are one stroked path in ink; the library's unused `<LinearGradient>` definition sits in `<Defs>` and is not referenced); the QR is pinned to the LIGHT palette ink/surface in both themes so scanners read it; the 20-char code in four groups (`formatShareCode`), Copy (`expo-clipboard` ~58.0.4, installed with `npx expo install`), the privacy copy `share.codeContains` ("This code contains birth date, time and place but no name."), and a "What the QR and the code carry" list (date, time/unknown/approx, place to 0.01°, zone, gender; "Not included: name, relationship, anything else"). No 8-character code anywhere (asserted: no 8-char token text on the sheet).

Shared components touched: `Row` gained optional `explanation` / `explanationTitle` forwarded to `WhyButton`; `WhySheet` renders that block (testID `why-explanation`) above the rule. `src/charts/routeFlags.ts` gained `MATCH_ROUTE_FLAGS.matchingReportPdf` (false) and `TIMING_ROUTES.matchingReportPdf = '/charts/pdf/matching'`.

UI strings: +41 keys per language (1531 → 1572; en/hi/bho agent-written): `common.explanation`, `family.tools/toolsMatchDesc/toolsShareDesc/toolsNaamkaranDesc/moreActions`, `match.resultTitle/fromCode/enteredDetails/sideNeeded/sameProfile/useScanned/summary/kootaMeaning/fullExplanation/exception.<4 engine ids>/cancel.<6 engine ids>/allOverlaps/fewerOverlaps/sideLine/beyondNote`, `share.forProfile/cameraAsk/scanTitle/scanned/codeDate/whatIsShared/fieldDate/fieldTime/fieldPlace/fieldZone/fieldGender/notShared`.

Jest: `test/setup.ts` mocks `expo-clipboard` (spy) and `expo-camera` (granted permission; `CameraView` → View exposing `onBarcodeScanned`).

## 2. Commands and results (FEAT verification list)

| Command | Result |
|---|---|
| `npm test -w app` | exit 0 — **30 suites / 231 tests / 10 snapshots** (B05: 28 / 218 / 9; +`match.test.tsx` 9 tests incl. the +30 % pseudo-locale snapshot of the result screen, +`share-code.test.tsx` 4 tests; `family-screen.test.tsx` updated for the Family tools card and its snapshot re-recorded) |
| `npm run typecheck` | exit 0 (content, content-tools, engine, app, web) |
| `npm run lint` | exit 0 (0 errors, 0 warnings) |
| `npm test -w packages/content` (extra) | 10 files / 93 tests pass with the +41 keys per language |

Pre-existing noise, unchanged by this step: `family-screen.test.tsx` "switching a series" prints `Uncaught error: Database not initialised` from a late re-render after the test DB closes — reproduced on `main` with this step's changes stashed (test passes there too).

## 3. What the tests assert (match.test.tsx / share-code.test.tsx)

- F29 totals: `guna-total` = `${fmtGuna(engine.ashtakoota(chartFor(Priya), chartFor(Amma)).total)} of 36 guna`; each `koota-<id>-points` = engine `points of max`; each meaning = corpus `koota-<id>-1`; Nadi/Bhakoot row words follow the engine result; Mangal status per person follows `mangalDosha()` (present · effective / cancelled / not present) and, when present, exactly five `mangal-<side>-mangal-cancel-*` rows with applies / not applied; four beyond rows containing the engine tone; overlap lines; summary paragraph begins "Priya and Amma score N of 36 guna; K of 8 kootas at full points."; no fear copy (`Manglik girl|boy|danger|death` absent).
- Free vs Pro: Why? on Varna shows `koota-varna-1` and not `koota-varna-3` on free; after `setEntitlement('shubhvela_pro_lifetime','active')` the Nadi Why? shows `koota-nadi-3` and the free caption disappears; `match-report-pdf` absent in both (flag false until B07).
- Code sides: Amma's code as side B gives the same total as her profile and is labelled "From a code" with no "Amma" on screen; an invalid code in the route shows the one message and no result.
- Pick screen: self preselected as A; "Choose both sides to match"; "Pick two different profiles"; profiles route as `{a:'p<id>', b:'p<id>'}`; Swap; typed `ABCD` + blur → the one message, Match refused with `errors.invalidInput`; the real code (lower case) → "Birth details read; no name was included · Birth date 5 Jul 1970" and routes `b: 'c<CODE>', bs: 'typed'`; "Scan a code" pushes `/family/scan?side=b`.
- Scan: `setScanResult('b', code)` is consumed on focus and routes `bs: 'scanned'`; `codeFromScan` accepts the `/m/` URL, the `shubhvela://m?` deep link and the raw code, rejects other URLs; the mocked `CameraView.onBarcodeScanned` with a foreign QR shows the invalid message and does not decode, with the real URL calls `onDecoded(code)`.
- Decode errors (design 11): wrong length, wrong alphabet (`U`), flipped CRC character, other version bits, `v=2` URL, `/m/` URL with `n=` → all one invalid state / null; typed field maps I/L/O and ignores hyphens and case.
- Share: `payloadFromProfile(Priya)` has no name; URL equals `…/m/?v=1&d=19980314&t=0642&a=0&lat=26.85&lon=80.95&tz=Asia%2FKolkata&g=f`; URL and code decode to the same payload and `parseShareUrl` agrees; unknown time → `t=u`; approx → `a=30`; the share screen shows "Code for Amma", the QR (one `RNSVGSvgView`, one stroked `RNSVGPath`, no `url(` paint), the grouped code, Copy → `Clipboard.setStringAsync(grouped)` → "Code copied", the privacy copy, the carried/not-carried list, no "Patna", no 8-char token.
- M3: Family tools card rows navigate (`/family/match`, `/family/naamkaran`) and open the share sheet with the privacy copy and a grouped code; the editor ⋮ ("More actions", role menuitem "Share for matching") opens the sheet; a new profile has no ⋮; `/profile menu/i` absent.
- Pseudo-locale +30 %: result screen renders every string whole, no `numberOfLines`, snapshot pinned.

## 4. Rules checked

- No colour grading of the guna score (ink `Num`; tone words only in "Beyond"); cancellations listed as rows; no "Manglik" fear copy (status words only: present / effective / cancelled / not present; `match.mangalBalanced` is B02's neutral wording).
- Privacy copy on the share sheet, the share screen, the scan screen and the pick screen.
- HARD NO: no gradients painted (see §1 note on the library's unused Defs), no emoji, no shadows; nothing fake — the PDF button is not rendered before B07, no "coming soon".
- 44 dp controls (Chip, NavRow, Pressable44, buttons, TextField); 12 sp floor via type tokens only; both themes via tokens (QR pinned to the light palette by design).
- Every number computed: totals, points, houses, overlap dates, summary values are engine output.
- N5: the event display-name rule (profile name; relationship in the kind label) is implemented in `EventCard` (A12) and unchanged; B06 adds no new event naming. Side labels on the result use the profile name, else the relationship word (`profileLabel`).

## 5. Not verified

- Cross-device F30 acceptance (a code produced on one emulator instance scanned/typed on a second, or decoded by the web `/m/` page) — happens in B08 / Phase D; here the round trip is unit-tested in one process (URL → camera callback → code → chart).
- Real camera permission prompt, `CameraView` rendering and QR recognition on a device/emulator; `expo-clipboard` on device; Gradle autolinking of `expo-clipboard` (B08 build).
- On-screen rendering in hi/bho (strings written and completeness-tested; corpus explanations remain English per A-INFO-1), 1.3× font scale, both themes on the emulator (B08 screenshot audit).
- Banner strip on `MatchingResults` on device (session ≥ 4).
- Carry-over A-REVIEW-NIT-2 (store `name_hi` with the profile place, show it in hi/bho) — "owner cluster B06 or later": NOT done here (needs a profiles schema change + gazetteer column in the editor); left open for a later cluster.

## 6. Commit

`feat(F29): 36-guna matching, share-a-code QR and typed code, Family tools` — hash recorded in FEAT-B06.json findings after the push.
