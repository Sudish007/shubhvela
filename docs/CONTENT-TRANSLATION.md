# Corpus translations: Hindi and Bhojpuri

How `packages/content/corpus/<domain>/hi.json` and `bho.json` were produced, the register they follow, how to review or edit a record, and how the owner's review packs map to the files.

## 1. Decision and scope

- 2026-10-25 ("leave bhojpuri translation"): no machine translation into Bhojpuri; every resolver walks `FALLBACK_CHAIN` (bho → hi → en, hi → en, en) per id and reports `{lang, fallback}` so the UI never shows an empty string. This chain is unchanged and still protects any future English-only record.
- 2026-10-29 (owner, "both" / "chose 1st option"): the corpus is translated into Hindi **and** Bhojpuri by the same agents that wrote the English master and the 1,878 hand-written UI strings in `packages/content/ui/hi.json` / `bho.json`. No translation API, no Gemini, no key; the `corpus-translate.yml` Action was never run and is superseded.
- Scope: every corpus domain except `naamkaran-names` (108 name lists that are already Devanagari + Latin in every language; `loadNaamkaranNames('hi' | 'bho')` keeps returning English with `fallback: true`).

## 2. What exists (completeness, 2026-10-30)

All 18 in-scope domains carry the full English id set in both languages: **1,434 records per language**, 0 missing, 0 extra, 0 gate errors. `packages/content/test/translations.test.ts` (it `T99`) enforces this against `en.json`, so a new English-only domain registered in `CORPUS` / `FESTIVALS` / `GLOSSARY` / `LESSONS` fails the content tests until its `hi.json` + `bho.json` land.

| domain | records (en = hi = bho) | kind | translated fields |
| --- | ---: | --- | --- |
| rules | 318 | snippet | `text` |
| glossary | 264 | whole-file | `meaning` |
| daily | 105 | snippet | `text` |
| nakshatra-pada | 108 | snippet | `text` |
| planet-sign | 108 | snippet | `text` |
| planet-house | 108 | snippet | `text` |
| festivals | 102 | per slug | `name`, `what`, `rule`, `conventionNote` |
| dasha-pairs | 90 | snippet | `text` |
| yogas | 40 | snippet | `text` |
| transit | 39 | snippet | `text` |
| daily-third | 32 | snippet | `text` |
| koota | 28 | snippet | `text` |
| muhurat-activities | 25 | snippet | `text` |
| lessons | 21 | whole-file | `title`, `body[]` (same paragraph count) |
| dignity | 14 | snippet | `text` |
| lagna | 12 | snippet | `text` |
| vrats | 12 | snippet | `text` |
| mangal | 8 | snippet | `text` |
| naamkaran-names | 108 | — | none (English-only by decision) |

Every other field is byte-identical to the English record: `id`, `rule`, `source`, `level`, `params`, `review` for snippets; `id`, `slug`, `review` for festivals; `id`, `term_dev`, `term_lat`, `related` for the glossary; `id`, `n`, `minutes`, `terms`, `tryIt`, `unlocksLevel`, `review` for lessons. `source` stays English because the app compares it with the literal `'convention'` and shows it as a proper noun; inside translated prose the classical text is named in Devanagari (सारावली, फलदीपिका, बृहत् जातक, बृहत् पाराशर होरा शास्त्र, जैमिनी सूत्र, मुहूर्त चिंतामणि). `rule` in a snippet domain is an engine id or the English rule sentence and is copied; one visible consequence, pre-existing and not a translation choice: `YogasCard` prefers `snippet.rule` for its one-line caption, so that caption is English in a Hindi / Bhojpuri yoga card. Every translated record keeps `review: "draft"`.

## 3. How the files were produced

Twenty PRD items (T01–T20), one or two domains or one slice of a large domain per item, each committed as `content(hi+bho): <slice> (<n> records)`:

1. The English slice was written out (sorted by id, or in file order for `dasha-pairs` and `lessons`).
2. The agent authored only the translated text, in both languages, as `{ "<id>": { "hi": …, "bho": … } }` part files (one string per record for single-field domains, `{ field: value }` for festivals and lessons).
3. A build step copied every non-text field from the English record, so metadata parity holds by construction.
4. Gates ran on the staged files and again on the integrated files: valid JSON, UTF-8 without BOM, LF; the domain's schema (`packages/content/schema/*.json`); id set a subset of `en.json` with no duplicates; same key set and byte-identical non-text fields; the same `{placeholder}` multiset and `\n` count per text (per paragraph for lessons; all 57 `LESSON_PLACEHOLDERS` survive); Latin digits only; no Latin-script token outside the allow-list (product and technical names: Shubhvela, PDF, QR, Wi-Fi, KP, D1…D60, BAV, SAV, AI, Pro, UTC, GMT, the KP grades A–D); Devanagari dominance; length 0.6–2.0× the English code points; no forbidden phrase (`packages/content-tools/forbidden.json` plus a Hindi / Bhojpuri list of outcome promises, health claims, fear words, commercial remedies and accuracy percentages); no Maithili form; no Hindi आप / है / हैं / करें in Bhojpuri; no तू / तुम in Hindi. A separate scan listed every Hindi-only function word found in a Bhojpuri text and every Bhojpuri word in a Hindi text for manual review.
5. Snippet domains and festivals were integrated slice by slice (the resolvers fall back per id, so a partial file is functional). The glossary and the lessons are rendered as whole lists (`loadGlossary`, `loadLessons` return one file), so their files were integrated only once complete; `translations.test.ts` keeps that rule.
6. Registration: two static JSON imports and `hi:` / `bho:` keys per table in `packages/content/src/registry.ts`; `load.ts` and `lessons.ts` were not changed (the header comment of `load.ts` still describes the 2026-10-25 decision; the chain it documents is unchanged).
7. `npm test -w packages/content` and `npm run typecheck` green, then the item's review packs were written and the item committed.

The authoring tools, the staged files, the termbank (≈280 settled terms and sentence frames, the engine name tables, the 264 glossary headwords, the classical-source spellings, the Latin allow-list), the Hindi / Bhojpuri forbidden list and the per-item decision log (D1–D29) live in `.agents/tasks/corpus-translate/` on the owner's machine. That folder is gitignored (run artefacts), so nothing in the repository depends on it; the tests above are the durable contract.

## 4. Register rules

Hindi (respectful आप, standard Khari Boli): है / हैं / करें / देखें; planets take the respectful plural (शनि … हैं); Jyotish terms in Devanagari (ग्रह, लग्न, नक्षत्र, दशा, राशि, भाव, योग, चौघड़िया, राहु काल) with a one-line gloss in brackets the first time a rare Sanskrit term appears in a passage; nukta as the UI writes loanwords (ज़रूरत, तारीख़); full stop ।; the Why? button is “क्यों?”.

Bhojpuri (respectful standard Bhojpuri of Bihar / eastern UP, Devanagari): रउआ for "you", राउर for "your", आपन for "own"; verbs बा / होला / करीं / बानी / नइखे / बाड़न (planets and people in the respectful third plural), habitual -ला (करेला, जाला, देखाला), participles कइल / भइल / दिहल; आ / भा / बाकिर for and / or / but; के replaces का / की / के, खातिर for "for"; UI spellings (no nukta in loanwords, जनम, चरन, परिनाम, घर for the bhava, बरत as a common noun). Not Hindi with a few words swapped, no rustic slang, no Maithili forms (अछि / छै / अहाँ). Third-person passages (`daily-third`, matching) use ऊ … बाड़ें / उनकर.

Both languages: Latin digits; the English honesty markers mirrored (के लिए पढ़ा जाता है / खातिर पढ़ल जाला, चिंतन का प्रश्न / सोच-विचार के सवाल, शास्त्रों में / शास्त्र में, प्रायः / अक्सर, “लगभग”); nothing added, softened or embellished; no outcome promise (अवश्य, निश्चित रूप से, गारंटी, पक्का), no health or medical claim, no fear language (भय, अनिष्ट, विपत्ति), no gendered assumption, no remedy or commerce.

Terminology: the UI spelling wins whenever the reader sees the word on the same screen (dignity tags, koota names, muhurat rule chips, vrat and festival names from the engine tables, KP column names, yoga names of the Yogas card); weekday, month, sign, nakshatra and planet names are the engine locale tables verbatim; glossary headwords are untouched and only `meaning` is translated. Fixed frames were used so one correction fixes a whole family: the first sentence of a nakshatra is identical across its four padas, the dasha antardasha sentence is one template over the engine's `naturalRelation`, the planet-in-sign paragraph names the dignity tag `signDignity()` assigns, the transit records use the daily Chandra bala ordinals, the 24 Ekadashi festival texts share one set of sentence frames.

## 5. How to review or edit a record

1. Find the record: `packages/content/corpus/<domain>/<lang>.json`, one record per line, same `id` as `en.json` (`rahu-kaal`, `festival-diwali`, `nakshatra-4-1`, `dasha-Ra-Ke`, `lesson-13` …). The review packs name records as `## <domain> / <id>`.
2. Edit only the translated field(s) listed in section 2. Keep every `{placeholder}` exactly as in the English record (same spelling, same count), keep the paragraph count of a lesson body, keep Latin digits, keep the Devanagari full stop ।. Do not touch `id`, `rule`, `source`, `params`, `slug`, `term_dev`, `term_lat`, `related`, `n`, `tryIt`, `terms`, `unlocksLevel`.
3. Run `npm test -w packages/content`. `translations.test.ts` reports the exact id and field of any placeholder, paragraph, Latin-word, metadata or register problem, and its per-item its (T01–T20) pin wording the UI depends on (engine festival names in rule sentences, the Ask-my-chart label, the dignity tag words, the sentence frames of section 4, the UI screen names quoted in lessons); `register.test.ts` runs the forbidden-phrase and script checks on every language file; `fallback.test.ts` and `rules.test.ts` check the chain.
4. To withdraw a line rather than fix it: in a snippet domain or in festivals you may delete the record from `hi.json` / `bho.json` and the app shows the next language on the chain for that id (`fallback: true`); in the glossary and the lessons the file must stay complete, so edit instead. The `T99` completeness it fails on a deleted record — that is the intended reminder to restore or re-translate it.
5. If a correction settles a term that recurs (a festival name, a koota word, an honorific), search the other `<lang>.json` files for the old spelling so the corpus stays consistent; the UI files `packages/content/ui/*.json` are the reference spelling.

## 6. Review packs

Written for the owner after each item, under `.agents/tasks/corpus-translate/review/` (local, gitignored): `T<nn>-bho.md` with up to 50 randomly sampled English / Bhojpuri pairs and `T<nn>-hi.md` with up to 20 English / Hindi pairs. Each pack opens with three lines (the register choices of the item, the Bhojpuri word choices, the terms the author was unsure about) and a `Files:` line naming the corpus file(s) it samples; each pair is headed `## <domain> / <id>` so the record is found by id in `packages/content/corpus/<domain>/<lang>.json`. `T99-completeness.md` is the completeness table of section 2.

| pack | domains (records) |
| --- | --- |
| T01 | daily (105), daily-third (32) |
| T02, T03 | rules (159 + 159) |
| T04, T05 | festivals (51 + 51) |
| T06 | vrats (12), muhurat-activities (25), koota (28), mangal (8) |
| T07 | glossary (264) |
| T08, T09, T10 | lessons 1–7, 8–14, 15–21 (full lessons, 7 pairs each) |
| T11 | yogas (40), dignity (14), lagna (12) |
| T12 | transit (39, whole domain) |
| T13, T14 | nakshatra-pada (54 + 54) |
| T15, T16 | planet-sign (54 + 54) |
| T17, T18 | planet-house (54 + 54) |
| T19, T20 | dasha-pairs (45 + 45, whole slices) |

Questions the packs raise more than once, left for the owner rather than decided: संकष्टी चतुर्थी / विनायक चतुर्थी in Bhojpuri prose while the vrat screen says चउथ; the transliterated Western sign names in the 12 glossary sign lines (एरीज़ … पिसीज़); the Hindi planet-house opening declines the UI house ordinal (पहले भाव में) while the sheet heading keeps the nominative पहला भाव; the three Sade Sati phase records in `transit` say जन्म-चंद्र with no pronoun because their English says "the natal Moon" while the same ids in `daily` / `rules` say "your birth Moon"; and four inconsistencies inside the English source that were translated as written, not fixed (lesson 8 "Abhijit is set aside on Wednesdays" vs the `abhijit` rule; lesson 14 "the card says the yoga cannot be checked" vs `yogas.fromMoon`; lesson 16 "not shown when the birth time is unknown" vs `ashtakavarga.lagnaAssumed`; lesson 14 "two exchanges"). Each is explained in the header of the pack that first met it.

## 7. Follow-ups outside this task

- `docs/OWNER-TODO.md` item 5 still counts 14 of 19 domains / 1,020 snippets; the figure is now 18 of 18 in-scope domains / 1,434 records per language.
- `YogasCard` caption (`snippet.rule`, English) — see section 2.
- `packages/content/src/load.ts` header comment predates the 2026-10-29 decision.
