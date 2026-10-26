# Verification — A07 English master corpus 2: lagna, nakshatra × pada, dasha pairs, transits, daily fragments
Run: 2026-10-25 (workflow wf_86107bfa6c58305a, step a07-corpus-en-2). Worktree c:/Users/sudiskmr/Downloads/DomainClassification/shubhvela, branch main, base commit `c4605ad`.

## Files
| File | Change |
|---|---|
| `packages/content/corpus/lagna/en.json` | new, 12 snippets |
| `packages/content/corpus/nakshatra-pada/en.json` | new, 108 snippets |
| `packages/content/corpus/dasha-pairs/en.json` | new, 90 snippets (9 maha + 81 maha × antar) |
| `packages/content/corpus/transit/en.json` | new, 39 snippets (36 + 3 Sade Sati phases) |
| `packages/content/corpus/daily/en.json` | new, 105 fragments (one per engine `DAILY_FRAGMENT_KEYS` entry; spec minimum 95) |
| `packages/engine/src/rules/daily.ts` | adds the exports the FEAT's acceptance test needs: `RULE_PARAMS` (param names per ruleId), `DAILY_FRAGMENT_KEYS` (105), `DASHA_PAIR_KEYS` (81), `DAY_FLAG_KEYS`, `SADE_SATI_KEYS`, `DAY_STRENGTH_KEYS`, `ruleIdOfKey(key)`, type `DailyRuleId`. No behaviour change to `dailyNote()` / `familyToday()`. |
| `packages/engine/src/panchang/panchang.ts` | adds `SPECIAL_YOGA_FRAGMENT_KEYS` (the 7 keys `specialYogas()` can emit). No behaviour change. |
| `packages/content/src/registry.ts` | registers the five domains |
| `packages/content/test/corpus-interpretive.test.ts` | +7 tests (A07 ids, word bounds, relation words, navamsa, params contract, daily wording); `WORD_BOUNDS` / `MIN_COUNTS` extended |
| `packages/content/README.md` | layout entry for the five domains and the params contract |
| `.agents/tasks/v1-build/features/FEAT-A07.json` | status completed, findings |

## Id conventions (schema forbids dots; same approach as A06)
- `lagna-<sign>` with the lowercase engine sign name (`lagna-mesha`).
- `nakshatra-<1..27>-<pada 1..4>` (`nakshatra-24-2`); 1-based like `PanchangDay.nakshatra.index + 1`.
- `dasha-maha-<PlanetId>` (`dasha-maha-Ra`) and **`dasha-<Maha>-<Antar>` with the engine planet ids** (`dasha-Ra-Ke`) — deliberately identical to the `keys[0]` the engine's dasha-lords row emits, so the Today card does `lookup('dasha-pairs', key, lang)` with no mapping. The test asserts the 81 ids equal `DASHA_PAIR_KEYS`.
- `transit-<saturn|jupiter|rahu>-<1..12>` (house from the natal Moon) + `sade-sati-phase-<1..3>` (the same ids also exist in `daily` as the short Today-row fragments; different domains, no clash).
- `daily`: the engine fragment keys verbatim (`chandra-bala-8`, `tara-bala-3`, `tithi-11`, `nakshatra-24`, `vara-4`, `amrit-siddhi`, `sarvartha-siddhi`, `ravi-pushya`, `guru-pushya`, `tripushkar`, `dwipushkar`, `ravi-yoga`, `bhadra-earth|heaven|patal`, `panchak`, `sade-sati-phase-1..3`, `dhaiya-4|8`, `sade-sati-none`, `day-strength-strong|mixed|weak`).

## Commands and results
| # | Command | Result |
|---|---|---|
| 1 | `npm test -w packages/content` | **7 files, 66 tests passed** (A06 state 50 + 7 new A07 tests + 9 added by the extended `MIN_COUNTS`/`WORD_BOUNDS` loops). First run failed on a typo in the new test (`s.snippet.id` on a raw snippet); fixed, re-run green. |
| 2 | `npm run typecheck` | **clean** in all five workspaces (`tsc --noEmit` exit 0: content, content-tools, engine, app, web) |
| 3 | `npx vitest run test/rules.test.ts test/panchang.test.ts` (packages/engine; not in the FEAT list, run because two engine files were touched) | 2 files, 17 tests passed |

## Counts, word statistics, sources
| Domain | Snippets | Words min / max / mean | Total words | Sources |
|---|---|---|---|---|
| lagna | 12 | 83 / 89 / 86.7 | 1,040 | Brihat Jataka 12 |
| nakshatra-pada | 108 | 47 / 61 / 52.6 | 5,679 | Brihat Parashara Hora Shastra 108 |
| dasha-pairs | 90 (maha 71–80, antar 37–53) | 37 / 80 / 46.3 | 4,165 | Brihat Parashara Hora Shastra 90 |
| transit | 39 | 41 / 61 / 49.6 | 1,934 | Phaladeepika 24 (Saturn, Jupiter), convention 12 (Rahu: Phaladeepika gives no Rahu gochara, read with Saturn's favourable houses 3/6/11 by convention), BPHS 3 (Sade Sati phases) |
| daily | 105 | 16 / 41 / 27.5 | 2,887 | Muhurta Chintamani 96, BPHS 9 |
All 354 snippets: `level: 1`, `review: "draft"`, non-empty `rule`, `source` present, schema-valid, unique ids.

Daily breakdown vs spec section 7 "95": Chandra bala 12 + Tara bala 9 + tithi 30 + nakshatra 27 + vara 7 = 85; special yogas/flags 11 (the 7 keys `specialYogas()` emits + Bhadra earth/heaven/patal + Panchak) = 96 ≥ 95; plus 6 Sade Sati state fragments and 3 day-strength fragments that the engine's rows 4 and 5 also emit = 105. The FEAT's list named Ganda Mula and Vinchhudo as special keys: the engine emits neither, so no fragment was written for them (fragments must match the engine exactly); `ravi-yoga` and the three Bhadra residences, which the engine does emit, were written instead.

## Param-set check (acceptance criterion 2)
`test/corpus-interpretive.test.ts › daily: every fragment's params set equals the engine RULE_PARAMS of its ruleId` — **passes**: for every daily fragment `ruleIdOfKey(id)` is non-null, `snippet.params` deep-equals `RULE_PARAMS[ruleId]`, and every `{placeholder}` in the text is in that list (`paramsOf` from `src/t.ts`). Placeholders actually used: `{bhadraStart} {bhadraEnd}` (bhadra-*), `{panchakStart} {panchakEnd}` (panchak), `{since} {until}` (Sade Sati phases, Dhaiyas), `{saturnHouseFromMoon} {nextKind} {nextAt}` (sade-sati-none). The 81 `dasha-pairs` antar texts and all other fragments use no placeholders (the sentence names the input in words, e.g. "8th sign from your birth Moon"; the UI's Why? sheet shows the numbers). The same check runs over `DASHA_PAIR_KEYS` against `RULE_PARAMS['dasha-lords']`.

Contract for A10 (Today card): raw engine values must be formatted before `interpolate()` — UTC ms via `formatInZone`, `nextKind` via the `sadesati.event.<kind>` UI string, numbers as Latin digits.

## Content rules applied
- Reflective, advisory register; every text names its rule (sign/lord, nakshatra/lord/navamsa, maha/antar/relation, planet/house-from-Moon, tithi/nakshatra/vara/yoga). Fear language absent: "avoid starting new work", "keep today simple", "routine tasks today, new starts tomorrow" (Chandrashtama, design wording). Supplementary scan beyond `forbidden.json` (health, body, medic*, heal*, disease, danger, death, husband/wife/mother/father, he/she, destiny, fate, karma, cosmic, divine, magic, remedy, gemstone, puja, accuracy, "will be/have/get/bring…"): 8 hits in the first draft (body ×4, health ×3, medicine, healing) reworded; final scan 0 hits. Existing `register.test.ts` (forbidden phrases, percentage claims) and the "no outcome promise" test pass over the new files.
- Classical basis stated in each transit text ("classically favourable" for Saturn 3/6/11, Jupiter 2/5/7/9/11, Rahu 3/6/11 by convention); Sade Sati phases as Saturn in 12th/1st/2nd from the Moon.
- Antar relation words follow `naturalRelation(antar, maha)` (Rahu read as Saturn, Ketu as Mars) and are test-asserted for all 81 pairs; the maha/antar duration in months is `round(mahaYears × antarYears × 12 / 120)`.
- Tara names: FEAT wording (Janma, Sampat, Vipat, Kshema, Pratyari, Sadhaka, Vadha, Mitra, Param Mitra); the engine's `taraKey` strings (pratyak, sadhana, naidhana) remain the lookup keys for `note.tara.*`.

## After push
Commit `71e102f feat(content): English master - lagna, nakshatra-pada, dasha pairs, transits, daily fragments` (10 files, 606 insertions, 6 deletions, staged by name). `git pull --rebase origin main` → "Current branch main is up to date"; `git push origin main` → `c4605ad..71e102f main -> main`. Working tree clean (`.agents/` is gitignored). Scratch generator lived in `$env:TEMP\a07-gen` and was deleted afterwards.

## Not verified
- Hindi and Bhojpuri files for the five domains do not exist yet (`loadCorpus(domain, 'hi')` falls back to English, flagged); the corpus-translate Action in A08 produces them.
- Texts are agent-written drafts (`review: "draft"`); classical attribution is "which text treats this topic" (Brihat Jataka for Lagna, BPHS for nakshatra/pada and dasha, Phaladeepika for gochara, Muhurta Chintamani for panchang-day rules), not verse citations; no human has reviewed the wording.
- The UI lookup path (A10 Today card, A11 dasha/Sade Sati screens) does not exist yet; the id/params contract is proven only by the content tests that derive keys from the engine exports.
- The navamsa sign stated in each pada text is derived from the standard pada→navamsa mapping (108 padas in zodiacal order from Mesha); not compared with the engine's `varga(chart, 'D9')` output for a sample chart.
- Full `npm test -w packages/engine` was not re-run (only `rules` and `panchang` suites, 17 tests); the engine edits are additive exports only. No app, Metro, Gradle, emulator or lint run.
