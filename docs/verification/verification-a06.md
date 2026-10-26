# Verification — A06 English master corpus 1: planet × sign, planet × house, dignities

Run: 2026-10-25 (workflow wf_86107bfa6c58305a, step a06-corpus-en-1). Worktree c:/Users/sudiskmr/Downloads/DomainClassification/shubhvela, branch main, base commit `077f928`.

## Files

| File | Change |
|---|---|
| `packages/content/corpus/planet-sign/en.json` | new, 108 snippets |
| `packages/content/corpus/planet-house/en.json` | new, 108 snippets |
| `packages/content/corpus/dignity/en.json` | new, 14 snippets |
| `packages/content/src/registry.ts` | registers the three domains (`CORPUS['planet-sign' / 'planet-house' / 'dignity'].en`) |
| `packages/content/test/corpus-interpretive.test.ts` | new, 11 tests: per-domain minimum counts, 40–90 word bounds, exact id sets derived from the engine tables, dignity ids cover every `DignityTag`, each planet-sign text states the dignity `signDignity()` assigns, nodes carry none, "is read for" in every house text, no outcome-promise phrasing |
| `packages/content/README.md` | layout entry documenting the id convention and the test |
| `.agents/tasks/v1-build/features/FEAT-A06.json` | status completed, findings |

## Id convention (deviation from the FEAT's shorthand, recorded)

`snippet.schema.json` (A05) restricts ids to `^[a-z0-9][a-zA-Z0-9-]*$` (no dots), and the loader API is `lookup(domain, id, lang)`, so the FEAT's `planet-sign.mars.meena` is realised as domain `planet-sign`, id `mars-meena`. Fragments are the lowercase English names of `packages/engine/src/locale` (`planetNames.en[id].toLowerCase()`, `signNames.en[sign-1].toLowerCase()`); houses are the number (`mars-7`). Dignity ids are the engine `DignityTag` strings (`exalted`, `debilitated`, `own`, `friend`, `enemy`, `neutral`, `combust`, `retro`, `vargottama`) plus `approx-lagna`, `approx-planet`, `moon-chart-mode`, `house-lord`, `sign-lord`. The schema was not changed.

## Commands and results

| # | Command | Result |
|---|---|---|
| 1 | `npm test -w packages/content` | **7 files, 50 tests passed** (previous 6 files / 39 tests + the new 11). First run failed on `dignity/combust` 91 words and `dignity/house-lord` 97 words; both trimmed, re-run green. |
| 2 | `npm run typecheck` | **clean** in all five workspaces (content, content-tools, engine, app, web); `tsc --noEmit` exit 0 |
| 3 | `npx vitest run --reporter=verbose test/corpus-interpretive.test.ts` | 11/11 ✓ (names listed below) |

New tests (all ✓): planet-sign ≥108 level-1 draft with rule + source · planet-house ≥108 · dignity ≥12 · planet-sign 40–90 words · planet-house 40–90 words · dignity 40–90 words · planet-sign ids = 9 planets × 12 signs exactly, rule and text contain the planet and sign names · planet-house ids = 9 × 12 exactly, rule and text contain the ordinal house and "is read for" · dignity ids cover every `DignityTag` + the five extra ids; combust text lists 12°/17°/14°/11°/10°/15°; vargottama text mentions D1 and D9/Navamsa · every planet-sign text states the dignity `signDignity(planet, sign)` returns (exaltation/debilitat/own sign/friend's sign/enemy sign/neutral) and Rahu/Ketu rules say "no dignity tag" · no "you will", "will bring/give/cause/lead to/result in", "is certain", "destined".

Existing tests re-exercised over the new files: `schema.test.ts` (every corpus file valid against `snippet.schema.json`, ids unique, `en.json` master present), `register.test.ts` (no phrase from `packages/content-tools/forbidden.json` en list, no `\d%` / "percent" claim in `text` or `rule`).

## Counts and word statistics

| Domain | Snippets | Words min / max / mean | Total words | Sources |
|---|---|---|---|---|
| planet-sign | 108 | 50 / 68 / 58.6 | 6,333 | Saravali 84 (seven planets), convention 24 (Rahu, Ketu: the app assigns no sign dignity to the nodes) |
| planet-house | 108 | 56 / 68 / 61.0 | 6,591 | Phaladeepika 108 |
| dignity | 14 | 82 / 90 / 86.4 | 1,210 | Brihat Parashara Hora Shastra 9, Surya Siddhanta 1 (combust), convention 4 (retro, approx-lagna, approx-planet, moon-chart-mode) |

All 230 snippets: `level: 1`, `review: "draft"`, non-empty `rule`, `source` present. `params` is `[]` for planet-sign and planet-house and lists the engine inputs for dignity.

Dignity statements inside the planet-sign texts follow the engine tables in `packages/engine/src/kundli/index.ts` (EXALTATION, DEBILITATION, OWN, FRIENDSHIP): e.g. Mercury in Kanya is tagged exalted (own sign noted in the text as secondary), Jupiter in Vrishabha / Mithuna / Kanya / Tula is enemy sign, Moon is neutral everywhere except Simha / Mithuna / Kanya (friend), Vrishabha (exalted), Karka (own), Vrishchika (debilitated). The test asserts this for all 84 non-node placements.

## Content rules applied (spec 7, build-rules corpus rules, design 6)

- Reflective register: "tends to show up as", "is read for"; every text names the placement; no predictions of events.
- Supplementary scan beyond `forbidden.json` (health, medical, body, doctor, death, fear, destiny, fate, karma, cosmic, divine, spiritual, magic, aura, he/she/his/her, husband, wife, mother, father, "will be/have/get", remedy, gemstone, puja, accurate): one hit (`ketu-7` "spiritual") reworded to "reflective"; final scan 0 hits. House vocabulary chosen to avoid health and gendered readings: 4th = home, parents, property, inner peace; 6th = service, routines, work, obstacles, competition; 8th = transformation, hidden matters, shared resources, research; 9th = beliefs, teachers, elders, higher learning, long journeys.
- Not discussed (out of this FEAT): Mangal dosha (B02), neecha bhanga cancellation (stated as not applied in `dignity/debilitated`), temporary friendships (stated as not used in `dignity/friend`).

## After push

Commit `c4605ad feat(content): English master - planet in sign, planet in house, dignities` (6 files, 398 insertions, staged by name). `git pull --rebase origin main` → "Current branch main is up to date"; `git push origin main` → `077f928..c4605ad main -> main`. Working tree clean (`.agents/` is gitignored).

## Not verified

- Hindi and Bhojpuri files for these domains do not exist yet; `loadCorpus('planet-sign', 'hi')` returns English with `fallback: true`. They are produced by the corpus-translate Action in A08.
- The texts are agent-written drafts (`review: "draft"`); classical attribution is at the level of "which text treats this topic" (Saravali for planets in signs, Phaladeepika for planets in houses, BPHS for dignity), not verse citations, and no human has reviewed the wording.
- The UI lookup path (A11 `PlanetSheet`) does not exist yet; the id convention is proven only by the content test that derives ids from the engine locale tables.
- No app, Metro, Gradle or emulator run; `npm run lint` was not part of this FEAT's verification list and was not run.
