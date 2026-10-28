# Review — Phase B (timing, matching, documents, money) — iteration 1

Reviewer step `b-review` of loop `phase-b-review`, workflow wf_c5b312722b5ce956 (relaunch of wf_86107bfa6c58305a). Date 2026-10-28.
Worktree `c:/Users/sudiskmr/Downloads/DomainClassification/shubhvela`, HEAD `3aa826e` (origin/main, tree clean at start and end).
No earlier `review-phase-b.json` existed; the loop's `b-fix` child ran first (verification-b-fix.md, commits e8be6a5, 6694847, 3aa826e).

**Verdict: APPROVED — 0 BLOCKING, 4 MEDIUM, 8 NIT.** The MEDIUM/NIT items are appended to `carry-over.md` under "Phase B review leftovers (mandatory for Phase C)".

## 1. What was read

spec.md (3.3 F12/F15–F17, 3.5, 3.6, 3.8 F36, 3.9, 8, 9, 10), design.md (4, 5, 10.3, 10.5, 10.6, 10.8, 10.9), plan.md (0–3, 5, 10, 11, 12), carry-over.md, build-rules.md, context.json, design-review.json, FEAT-B01…B08 (all `status: completed`, findings read), verification-b01…b08.md, verification-b-fix.md, review-phase-a.md.

## 2. What was run (all from the worktree, outputs recorded)

| Command | Result |
|---|---|
| `git --no-pager status --porcelain` | clean; HEAD 3aa826e = origin/main |
| `npm test` | exit 0 — content 10 files / 93 tests; content-tools 1 / 16; engine 32 / **1056**; app 31 suites / **242** tests / 11 snapshots; web: no tests. Only side effect: `packages/engine/reference/results*.json` `generatedAt` timestamps (6 files) — diff inspected (timestamps only) and restored with `git checkout` |
| `npm run typecheck` | exit 0 (content, content-tools, engine, app, web) |
| `npm run lint` | exit 0 (app `eslint .`) |
| `npx jest test/adpolicy.test.ts test/ads-root.test.ts test/entitlements.test.ts test/billing.test.ts test/pro-screen.test.tsx --verbose` | 5 suites / 56 tests pass. Required tests present by name: "the allow-list is exactly the twelve M5 routes"; "sessions 1-3 -> none on every route; session 4 -> anchored on allow-listed routes only"; "never in sessions 1-3"; "one per session…"; ">= 45 s since the last ad of ANY kind (banner, native, rewarded all count)"; "the ad is the LAST card for every intent…" + "the mount gate requires onLayout.y >= windowHeight at 360/390/412 x 1.0/1.3 for every intent" (M4 fold test over 4 intents); "banner, native, interstitial and rewarded all answer none/false for a Pro user"; ads-root "Pro: initialize() is never called and no consent form is requested" + "free: UMP consent runs before initialize()"; entitlements "B03: M2 report table and price labels…" (M2 table), "grace keeps Pro on…", "grantUnlock writes a 24 h row for rewarded keys only"; billing "restore: an active subscription -> Pro; Play listing nothing later -> expired", "restore consumes unconsumed report purchases into credits exactly once", "Play unreachable: restore throws and the cache is untouched" (restore path with mocked purchases) |
| `Select-String -Path app/android/app/build.gradle -Pattern applovin` | line 210 `implementation 'com.google.ads.mediation:applovin:13.6.4.2'`; lines 85–112 read `app.json extra.applovinSdkKey` into `manifestPlaceholders.applovinSdkKey`; AndroidManifest.xml line 28 `applovin.sdk.key = ${applovinSdkKey}`, line 26 `com.google.android.gms.ads.DELAY_APP_MEASUREMENT_INIT = true`. `app.json extra.applovinSdkKey = ""`, no mediation group (M10 "wired but disabled") |
| Code-vs-shots timestamp check | newest PNG `pdf-preview-bho-dark-390.png` 2026-10-28 05:52; the two code-touching fix commits (e8be6a5 chart-layout, 6694847 ui strings) are dated 05:07 and b-fix re-shot the affected Charts ×8 and PDF-preview ×6 after them; the only tracked files newer than the newest PNG are `reference/CONVENTIONS.md` (docs, commit 3aa826e) and the test-run `results*.json` I restored. No UI code is newer than its screenshot ⇒ **no rebuild / re-shoot required**; the emulator was not booted by this review |
| `node scripts/audit-ui-dump.mjs --summary shots/phase-b/audit.json` | `{"shots":110,"smallControls":0,"intersections":0,"covered":0,"failing":0}`; 110 records, `coveredChecked` true; M6 strip records: 390 dp strip 144.5 / banner 112 / extra 32.5 (charts ×6, family ×6, family-tools ×6); 360 dp (density 480) 135.3 / 103 / 32.3; 412 dp (density 420) 150.5 / 117.7 / 32.8 — all = banner + 32 ± 1 dp |
| `shots/phase-b/m4-native-ad-gate.json` | 16/16 pass: gate top y 2441.9 dp (390×1.0), 3183.4 (390×1.3), 2608.3 (360), 2309.7 (412) vs window 866.8 / 800 / 914.3 dp, for marriage, career, familyDates, learn. Native card never in the dump (no fill on the Play-less image; slot collapses per design 11) |
| PNG dimension check (System.Drawing header read) | 110 of 110 PNGs 864×1920 (≤ 1920 px); each opened with one `read_file` call |
| `scripts/pdf-info.mjs` on `shots/phase-b/pdf/*.pdf` | six files present (janam_patri/matching/varshaphal × hi/bho); documents.test.tsx heading snapshot confirms every report ends with "How this was computed" + "Disclaimer" in en/hi/bho |
| Share-code spot check (`npx tsx`, engine `decodeShareCode`) | the code printed on `share-code-hi-light-390.png`, `A61M-CJ2V-9B5X-WPXT-R000`, decodes to `{v:1, date:1998-03-14, time:06:42, approx:0, lat:26.85, lon:80.95, tz:Asia/Kolkata, gender:f}` = Priya's seeded data; a one-character change is rejected (`ShareCodeError` code `version`) |
| Secrets scan (`git grep` over tracked files) | no Gemini/GitHub tokens, no store/key passwords, no private keys, no non-test `ca-app-pub-` ids; `release/` tracks only README.md; `app/android/app/debug.keystore` is the standard Expo debug keystore (not a secret). `app.json extra.admob` = Google test ids, `live: false` |
| Placeholder scan | no "coming soon"/"not in this build" strings rendered by Phase B screens; `common.learnNotYetTitle` is the Phase A honest empty Learn shell (C03 fills it); `today/charts/family.notYet*` are dead keys |
| Single-owner check | `react-native-google-mobile-ads` imported only under `app/src/ads/`; `AdsRoot.tsx` lines 61/71 return before `gatherConsent`/`initialize` when `isPro()` |

## 3. Screenshots opened (one per read, all 864×1920)

pro-en-light-390 · pro-hi-dark-390-scrolled · charts-en-light-390 · charts-en-light-360 · today-en-light-390-scrolled · charts-vargas-sheet-hi-light-390 · charts-unlock-sheet-bho-dark-390 · muhurat-en-light-390 · muhurat-bho-dark-390-scrolled · match-result-en-light-390 · share-code-hi-light-390 · pdf-preview-bho-light-390 · share-card-preview-en-light-390 · naamkaran-en-light-390 · family-tools-hi-light-390-scrolled · ashtakavarga-en-light-390 · kp-bho-light-390 · varshaphal-en-dark-390.

Every Phase B screen type, all three languages and both themes are represented. HARD NO list on every opened screen: no gradients, glow, neon, galaxy backgrounds, particles, orbs/sparkles, stock illustrations, emoji in chrome, heavy shadows, autoplay media, fake numbers, testimonials, live tickers; Pro screen has no testimonials, counts, timers or "most popular". The only illustration on any screen is Google's own test-ad creative inside the banner (not app chrome). Smallest text observed = 12 sp captions/chart numerals; Tiro titles + Noto body in hi/bho without tofu; selected chips/radios/switch show state in dark theme.

## 4. Acceptance per feature (spec §3, Phase B)

| Feature | Evidence | Result |
|---|---|---|
| F12 divisional charts | Vargas sheet lists D2…D60 with domain text, D9 free in the chip row, locked rows "लॉक", unlock sheet with two 48 dp buttons + "this device" caption (shots); engine `varga` for 15 ids + tests (B01); charts-extras tests | OK |
| F15 Sade Sati / Ashtakavarga / KP | Sade Sati card phases + next Dhaiya date + "approx." footnote (unlock-sheet bho shot); BAV grid Sun 48 bindus with column totals 2+3+6+4+3+3+4+5+7+4+4+3 = 48, SAV 337 with strength bars/thresholds (ashtakavarga shot); KP Placidus cusps with sign/star/sub lords, cusp 1 Meena 6°50′ vs Lahiri Lagna 6°44′ (KP ayanamsa), opposite cusps consistent (kp shot); both behind unlock keys/Pro (`LockedFeature`) | OK |
| F16 yogas | YogasCard "N found", formed/cancelled tags, Why? — charts-extras tests (card below the fold on the Charts shot; not pixel-checked) | OK (Jest) |
| F17 Varshaphal | Summary screen: return instant 14 Mar 2026 11:04 Lucknow, solar-return chart, Muntha Karka house 3 (Meena + 28 = Karka; annual Lagna Vrishabha ⇒ house 3) lord Moon, year lord Venus with candidate table, Why? on each; "Year begins" notification planned by `planYearBegins()` (unit-tested), default Off | OK; device `dumpsys` check not run (NIT → MEDIUM carry) |
| F26 muhurat finder | 14 activity chips (+ "All 14 activities" sheet, N5, tested), free range read-only "today – +7 days" with "Any range · Pro", 42 windows for Griha Pravesh, 10 rule chips check/cross, "9/10 rules met" + bar, Save to Upcoming, ".ics Pro", Why?; ordering follows N18 (8/10 Sun 1 Nov 11:49 with Abhijit overlap ranks above 8/10 Wed 28 Oct 16:02 without) | OK |
| F27 Disha Shool / Panchak / Bhadra | TravelTodayCard + rule chips "भद्रा ना / पंचक ना" on windows (shot); B05 tests | OK |
| F28 naamkaran | Uttara Phalguni pada 4 → पी·Pi first, then टे टो पा (correct syllable table), names Devanagari + Latin, "no meaning is claimed" | OK |
| F29 matching | "25 of 36 guna" in ink, A/B Moon lines, koota rows "x of y" with meaning + Why?; Tara 1.5/3 checked by hand (Pushya→U.Phalguni count 5 = bad, reverse 24 mod 9 = 6 = good); engine suite 20/20 pairs run (14 exact, 6 documented Yoni one-point differences — MEDIUM below); free level 1 / Pro level 3 + PDF button gated by `isPro()` | OK |
| F30 share-a-code | QR + 20-char grouped code, "contains birth date, time and place but no name", "What the QR and the code carry" list; decode spot check above; CRC/version rejection; mode A only (P5) | OK; cross-device scan not run (NIT) |
| F31 Janam Patri PDF | Preview (hi PDF under bho UI) with header, birth details, panchang at birth…; Download/Share sticky CTA, "Pro में शामिल"; pulled PDFs 9/9/7 pages with Tiro + Noto Devanagari embedded; every report carries "How this was computed" + disclaimer in 3 languages (snapshot); page count read from the file (B08 fix) | OK |
| F36 share cards | Kundli card: wordmark "Shubhvela · शुभवेला" + `sudish007.github.io/shubhvela`, "Show birth time" Off + "Birth time hidden", Share → system sheet; four cards implemented (B07 tests) | OK |
| F38 ads | Test unit ids only (`live:false`); banner strip 16 dp padding on Charts/Family/Muhurat/Matching results (shots), absent on Pro/PDF/share-code/naamkaran/share-card sheet; allow-list exactly M5; sessions 1–3 none; interstitial 3 triggers, ≥ session 4, 1/session, 45 s spacing; rewarded 5 keys 24 h; native card last + fold gate 16/16; UMP before init; Pro ⇒ none + no `initialize()` (tests + logcat runs A/B in B08 §6) | OK |
| F39 Pro / billing | Pro screen per design 5 (three radio cards, yearly preselected, "Save 49%" = round((1−299/588)·100), matrix, one-time rows with M2 captions, Restore, Manage → Play subscription URL, disclaimer, sticky CTA "Continue · ₹299 per year" + "Recurring. Cancel in Play → Subscriptions." + Terms); entitlement cache/restore/grace unit-tested with a mocked gateway; verification-b03.md §Not-verified states plainly "not verifiable without Play products" — accepted per the step prompt | OK |
| F40 one-time products | Rows ₹99 / ₹99 / ₹149 with "included in Pro" (Janam Patri, Matching) and "in Free and Pro" (Varshaphal), "store price may differ" (P19); consumable credit flow unit-tested | OK |

Plan §3 items owned by Phase B: M2 (entitlements table + captions) ✓; M3 (Timing and documents card on Charts — Jest; Family tools card — shot) ✓; M4 ✓ (16/16); M5 ✓ (test + code); M6 ✓ (audit strips at 360/390/412); M9 (WebView preview + sticky CTA, `printToFileAsync` + `expo-sharing`) ✓; M10 ✓; N5 ✓; N18 ✓ (ordering observed + B01 tests).

Carry-over from Phase A: A-REVIEW-MEDIUM-1 closed (B01, eclipse rule, Holika Dahan 03-03); A-REVIEW-MEDIUM-2 closed (matching fetcher, 20 pairs, `reference:check` exit 0); A-REVIEW-NIT-4 closed (B02 `consent.agree`); A-REVIEW-MEDIUM-3 (hi corpus, owner key) and A-REVIEW-MEDIUM-4 (grievance address, D01/D04) remain owner/Phase D items; A-REVIEW-NIT-1 (third-person Family Today, owner B02) and A-REVIEW-NIT-2 (`name_hi`, owner B06) were **not** implemented in Phase B — carried forward below.

## 5. Findings (none blocking)

MEDIUM
1. **B-M1 (F29, spec §6 release gate)** Matching suite is 14/20 exact; six pairs differ from Drik by one Yoni point because Drik's five-level Yoni table is not sourced (`koota-yoni@mXX` keys, CONVENTIONS §3). Spec §6 requires guna totals exact before any APK is called "beta"; the Phase D release gate must either source the table or record the owner's acceptance of the convention. Typing a table from memory is correctly refused.
2. **B-M2 (F24, A-REVIEW-NIT-1 not done)** Family Today still addresses other members in the second person; B02 (the assigned owner) did not add a third-person/name-prefixed variant. Promoted to MEDIUM because a mandatory Phase B carry-over was skipped — owner C02 (content) + Family UI.
3. **B-M3 (F17)** The plan's B04/B08 acceptance "scheduled notification … asserted by a unit test of the planner and by an emulator `dumpsys notification`/`alarm` check" was only half done: `planYearBegins()` is unit-tested; no `dumpsys` evidence exists in any verification doc. C05 must toggle "Notify when the year begins" on the emulator and record `adb shell dumpsys alarm`/notification output.
4. **B-M4 (F38/M10)** The M10 logcat runs (B08 §6) predate `DELAY_APP_MEASUREMENT_INIT`; the flag's effect on the GMS-side "Initialized AdMob" line was never re-measured (B08 §10, b-fix §8). C05 must repeat the Pro cold-start logcat on the current APK and record zero GMA/AppLovin init lines.

NIT
5. **B-N1 (F5/F8/F23, A-REVIEW-NIT-2 not done)** Place names stay Latin in hi/bho (seen on family-tools-hi and pdf-preview-bho); `name_hi` is not stored with the profile place. Owner: the Phase C cluster that touches the profile editor/DB (C04 backup) or D01.
6. **B-N2 (F39 copy)** The Pro lede promises "on-device 'Ask my chart'" while F35 ships in Phase C; the matrix row is spec-pinned, but the lede must match shipped features when APK C is reviewed (reword or confirm F35 landed).
7. **B-N3 (F29 copy)** Tara koota side labels read "tara 5 · tara 6" (raw index) whereas the muhurat chip names the tara ("Tara bala (Kshema)"); show the tara name on the matching row.
8. **B-N4 (F38)** The native ad card's pixels (dashed border, "Ad" tag, SDK AdChoices, 16 dp footer separation) were never rendered — no fill on the Play-less emulator; Jest-only. Verify once on a device with Play before the Phase D ship.
9. **B-N5 (docs)** verification-b08.md §3/§5 cite a `shots/phase-b/m4/` folder with 16 dumps; only `shots/phase-b/m4-native-ad-gate.json` exists (the JSON is sufficient evidence). Correct the doc or restore the dumps.
10. **B-N6 (F38/F32)** The Learn tab is an honest empty shell yet passes `route="LearnRoot"` (allow-listed), so sessions ≥ 4 show a banner under an empty state until C03 fills it; either fill it (C03) or suppress the route name while empty.
11. **B-N7 (F26)** The finder scores at the self profile's place, not Today's GPS mode (B05 note); acceptable per F26 inputs but inconsistent with Today when GPS mode is on — decide in C/D.
12. **B-N8 (F30)** Cross-instance acceptance (code produced on one emulator, scanned/typed on another, or decoded by the web `/m/` page) has not been run; D01's `/m/` page or C05 with two emulator instances must do it.

## 6. Verified / not verified by this review

Verified: test/typecheck/lint counts above; required AdPolicy/entitlements/billing tests by name; AppLovin wiring; audit summary and M4/M6 numbers from the JSON; 18 screenshots; share-code decode; absence of secrets and placeholders; version 0.2.0/versionCode 2 in app.json and build.gradle (asserted by `app-config.test.ts`, part of the suite).

Not verified (unchanged from B08/b-fix, acceptable for Phase B): live Play purchase/restore/grace; real ad fill and interstitial/rewarded on a device; native ad pixels; cross-device scan; 1.3× font scale beyond Today; physical arm64 device; TalkBack. I did not rebuild the APK or boot the emulator because no UI code is newer than its screenshot.
