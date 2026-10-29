# Verification — C02 · Lessons corpus, glossary cross-links, Phase C UI strings, Gemini batch C

Step of workflow `wf_c5b312722b5ce956` (build `wf_86107bfa6c58305a`), 2026-10-28. Worktree `c:/Users/sudiskmr/Downloads/DomainClassification/shubhvela`, branch `main`.
Commit: `7e5ed5d feat(content): lessons, Learn/AI/backup strings` (pushed; origin was at `8599367`, no rebase needed).

## 1. What was built

| Artefact | Count | Notes |
|---|---|---|
| `packages/content/corpus/lessons/en.json` | 21 lessons | ids `lesson-01..21`, `n` 1..21, `minutes` 5, bodies 359–401 words in 6 paragraphs (last = "try it" instruction), `terms` (glossary ids), `tryIt {route, label}`, `unlocksLevel` 2 (lessons 1–12) / 3 (13–21), `review: draft`. Topics in the FEAT order: kundli; signs and houses; Moon and nakshatras; Lagna and approximate times; planets and dignities; house lords; panchang; good-hours band and kaals; choghadiya and hora; tithi birthdays and family dates; vrats and festival rules; Vimshottari dasha; Sade Sati honestly; yogas; divisional charts and D9; Ashtakavarga basics; KP in one page; matching beyond the score; muhurat rules; reading Why? and the honesty markers; how this app computes. |
| `schema/lesson.schema.json` | 57 placeholders | New `placeholders` block (name → how the app resolves it from `ChartData` / `dasha()` / `varga('D9')` / `ashtakavarga()` / `yogas()` / `kp()` / `panchang()` / `goodHours()` / `tithiEventDates()`), `tryIt`, `unlocksLevel` (enum 2|3), `terms` minItems 1. Mirrored by `LESSON_PLACEHOLDERS` in `src/lessons.ts` (test asserts equality; every placeholder is used by ≥ 1 lesson; every lesson uses ≥ 1). |
| `src/lessons.ts` | — | `loadLessons(lang)`, `lesson(id, lang)`, `lessonPlaceholders(l)`, `renderLesson(l, values)`, types `LessonPlaceholder`, `LessonValues`; exported from `src/index.ts`; `Lesson` type gained `tryIt`, `unlocksLevel`. |
| `corpus/glossary/en.json` | 217 → 264 (+47) | kendra, trikona, dusthana, lagnesh, udaya-lagna, parivartana, nija-maas, dasha-balance, jataka-yoga, gaja-kesari, mahapurusha, kemadruma, bhanga, kala-sarpa, hora-varga, drekkana, dashamsa, trimshamsa, shashtiamsa, ashtakavarga, bindu, bhinnashtakavarga, sarvashtakavarga, kp, placidus, cusp, sub-lord, star-lord, significator, ruling-planets, ashtakoota, guna, varna, vashya, yoni, graha-maitri, gana, bhakoot, nadi, mangal-dosha, muhurat, griha-pravesh, ephemeris, sidereal, tropical, true-node, prashna. Every lesson `terms` id resolves (test). |
| `corpus/rules/en.json` | 308 → 318 (+10) | `prashna-chart-of-the-moment`, `prashna-lagna-of-the-hour` (source Prashna Marga), `prashna-question-private`; Ask-my-chart system rules `ask-system-explain-from-chart`, `ask-system-cite-rule`, `ask-system-no-outcome-promises`, `ask-system-no-medical-legal-financial`, `ask-system-grounded-corpus`, `ask-system-honest-limits`, and `ask-label` (the fixed line). Engine: `PRASHNA_RULE_IDS`, `ASK_RULE_IDS`, `PHASE_C_RULE_IDS`, `RULE_PARAMS_C`, `ruleParamsC()` in `packages/engine/src/rules/ruleIds.ts`, appended to `RULE_IDS` (rules.test.ts coverage stays exact). C04's `app/src/ai/prompt.ts` must read the system rules with `ruleText(id, lang)` for `ASK_RULE_IDS` (minus `ask-label`, which is the UI banner's rule id). |
| `corpus/daily-third/en.json` | 32 | Third-person variants of every `daily` fragment that says "you/your" (12 chandra-bala, 9 tara-bala, tripushkar, dwipushkar, 3 sade-sati phases, dhaiya-4/8, sade-sati-none, 3 day-strength); same ids, `params = ['name', ...daily params]`, `{name}` in every text, no second person (test). Carry-over B-REVIEW-MEDIUM-2 content half; the Family UI half (render `lookup('daily-third', id, lang) ?? lookup('daily', id, lang)` for non-self profiles) is for C03/C05. |
| `ui/{en,hi,bho}.json` | 1654 → 1878 keys each (+224) | Namespaces `learn` (17), `lesson` (17), `glossary` (10), `journal` (29), `prashna` (23), `ask` (62), `backup` (49), `deeplink` (14), plus `widget.*` (+7: refresh, nextPrefix "next:", exactUpdates, addToHome, smallName, mediumName, exhausted), `tts.*` (+5: noVoice, reading, bhojpuriFallback, listenA11y, stopA11y), `settings.backup`, `settings.askModel`, `settings.askModelBody`. Agent-written in all three languages; Hindi आप, Bhojpuri रउआ/राउर + होला/करीं/बानी/नइखे (register tests green). |
| Tests | +1 file | `test/corpus-phase-c.test.ts` (11 tests); `completeness.test.ts` gains the Phase C namespaces and a binding-copy pin; `register.test.ts` allow-lists `backup.fileName`; `content-tools/src/forbidden.ts` `LATIN_ALLOWLIST` += GB, RAM, E2B, Apache, LiteRT-LM, AES-256-GCM, PBKDF2, svbk. |

Pinned copy (spec F35 / design 10.7 / 6): `ask.label` = "AI explanation from your chart — can be wrong"; `ask.rowUnsupported` = "Not available on this phone — needs Android 12, 6 GB RAM and 4 GB free"; `ask.consentSize` = "Model size: 2.6 GB"; `ask.downloadPaused` = "Download paused — reconnect to Wi-Fi"; `ask.thinking` = "Thinking…"; `ask.inferenceFailed` = "Couldn't run the model on this phone right now"; `ask.deleteModel` / `ask.retry`; mood words Calm · Low · Busy · Bright · Tense (hi शांत · उदास · व्यस्त · उजला · तनाव; bho शांत · उदास · व्यस्त · उजियार · तनाव) as words (regex `^[\p{L}\p{M}]+$`); `journal.legendFooter` = "for reflection, not proof"; `journal.title` contains "for reflection"; `lesson.tryIt` = "Try it on your chart"; `lesson.markDone` = "Mark done"; `lesson.unlocked` = "Deeper explanations unlocked"; `prashna.fieldHint` ≤ 120 visible chars; `backup.wrongPassphrase` = "Couldn't open this backup — check the passphrase"; `backup.newerApp` = "This backup needs a newer app"; widget/TTS strings verbatim.

`tryIt` routes used: `/(tabs)/charts` (+ `?card=planets|houses|sadesati|yogas`), `/(tabs)/today` (+ `?sheet=panchang`), `/family/calendar`, `/charts/dasha-tree`, `/charts/vargas?varga=D9`, `/charts/ashtakavarga`, `/charts/kp`, `/family/match`, `/charts/muhurat`, `/settings/calculation`. The `?card=` / `?sheet=` / `?varga=` query params are a contract for C03 (scroll-to-card / open-sheet on arrival); routes without them already exist.

## 2. Verification commands (run after the edits)

| Command | Result |
|---|---|
| `npm test -w packages/content` (before the edits) | 10 files / 93 tests pass (baseline, B02 state + C01 widget/tts keys) |
| `npm test -w packages/content` (after) | **11 files / 106 tests pass** (schema, completeness incl. Phase C pins, register/forbidden en/hi/bho over UI + all corpus files incl. lessons bodies, rules coverage of `RULE_IDS` (318), corpus-ritual glossary ≥ 150 + related ids resolve + LINKED_TERMS, corpus-phase-c) |
| `npm test -w packages/content-tools` | 16/16 pass |
| `npm test -w packages/engine` | 32 files / 1056 tests pass (`ruleIds-b` still exact: Phase C ids are a separate list) |
| `npm run typecheck` | exit 0 for content, content-tools, engine, app, web (one fix during the step: `loadLessons` walks `FALLBACK_CHAIN` directly instead of the per-item `resolve`) |
| `gh secret list --repo Sudish007/shubhvela` | `no secrets found` (checked by name only, 2026-10-28) |
| `Test-Path env:GEMINI_API_KEY` | `False` — no local fallback |
| `gh run list --repo Sudish007/shubhvela --workflow corpus-translate.yml --limit 2` | `no runs found` (before dispatch) |

Ad-hoc checks (scratch scripts in `$env:TEMP`, not committed): word count per lesson 359–401; all `{placeholders}` in the schema set; all lesson terms in the glossary; `ui/*.json` are canonical `JSON.stringify(_, null, 2)` output before and after the merge; en/hi/bho key sets identical (1878).

## 3. Gemini batch C — SKIPPED by owner decision

- `gh secret list --repo Sudish007/shubhvela` → `no secrets found`; `Test-Path env:GEMINI_API_KEY` → `False`. Paused once with a `warning` (the only allowed owner-blocking pause); the orchestrator answered **"skip"** (2026-10-28), same as A08 and B02: no Bhojpuri machine translation in v1, no step waits for the key.
- Not dispatched: no Action run (`gh run list ... corpus-translate.yml` → `no runs found`), no `diagnostic.json`, no `review-queue/bho-C.md` — so no Bhojpuri-review INFO was sent (nothing to review).
- Confirmed without a code change (`npx tsx` against `packages/content-tools/src/translate.ts`): `listDomains('packages/content')` → 18 domains `daily daily-third dasha-pairs dignity festivals glossary koota lagna lessons mangal muhurat-activities nakshatra-pada planet-house planet-sign rules transit vrats yogas`; `fieldsFor('lessons')` = `title, body` at `LESSON_BATCH_SIZE` 1; `daily-third` translates `text`. `corpus-translate.yml` keeps `lang` default `hi`, `domains` default `all`, so the owner's single dispatch (OWNER-TODO item 5) covers Phase A + B + C masters.
- Fallback recorded by every loader (checked for hi and bho): `loadLessons` → 21 items, `lang: 'en', fallback: true`; `loadGlossary` → 264, `en`, `true`; `lesson('lesson-01')`, `glossaryTerm('kendra')`, `ruleText('ask-label')` → `lang: 'en'`. The Learn tab (C03) keeps its chrome language and renders the resolved text, no badge, never empty (same discipline as A10/A11/B).
- carry-over.md A-INFO-1 extended with "C02 batch skipped by owner decision"; C05 and later steps must not pause for this key.

## 4. Not verified

- hi/bho lesson, glossary and rules drafts: none exist (batch skipped); Hindi/Bhojpuri users see English lesson bodies and glossary meanings until the owner dispatches the Action (A-REVIEW-MEDIUM-3 stays open).
- The UI strings are not yet rendered by any screen (C03/C04 build the screens; the +30 % pseudo-locale layout test runs there).
- The placeholder resolver (`LessonValues` from `ChartData` etc.) is a contract in `lesson.schema.json` + `LESSON_PLACEHOLDERS`; the app side is C03's work and not written here.
- English lesson wording is unreviewed (`review: draft`); classical-source attributions (Prashna Marga, Muhurta Chintamani, BPHS) are named per the existing corpus convention, not re-verified against the texts in this step.
- `packages/engine/reference/results*.json` `generatedAt` timestamps changed when the engine suites ran; left uncommitted (generated files, no value changes).
