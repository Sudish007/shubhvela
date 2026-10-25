# @shubhvela/content

JSON content for Shubhvela in English, Hindi and Bhojpuri: UI strings, the rules corpus behind every "Why?" sheet, and (from A06 onwards) the interpretive corpus, festival texts, lessons and glossary. Everything is schema-validated in tests; nothing validates at runtime.

## Layout

- `ui/en.json`, `ui/hi.json`, `ui/bho.json`: flat maps with identical key sets (agent-written, never machine-translated). Namespaces (Phase A): `common tabs onboarding consent today band verdict panchang note upcoming charts dignity dasha sadesati family events vrat calendar reminders settings privacy disclaimer about errors`.
- `ui/design-tokens.json`: the single source of colours, type scale, spacing, radii and sizes (design.md 2). `scripts/gen-tokens.ts` writes `app/src/theme/tokens.ts`, `web/src/tokens.css` and `ui/token-contrast.json`; never edit those by hand. `npx tsx packages/content/scripts/gen-tokens.ts --check` fails when they are stale, and the generator throws on any type size outside `{26,22,20,18,17,15,13,12}` or any contrast pair below its minimum.
- `corpus/<domain>/<lang>.json`: arrays of snippets (`schema/snippet.schema.json`). English is the master; `hi`/`bho` are written by the corpus-translate Action with `review: "draft"`.
- `corpus/planet-sign/en.json` (108), `corpus/planet-house/en.json` (108), `corpus/dignity/en.json` (14): the interpretive snippets behind the planet sheet (design.md 4). Ids use the lowercase English names of the engine locale tables, hyphenated because `snippet.schema.json` forbids dots: `<planet>-<sign>` (`mars-meena`), `<planet>-<house>` (`mars-7`), and for `dignity` the engine `DignityTag` names (`exalted`, `combust`, `retro`, `vargottama`, ...) plus `approx-lagna`, `approx-planet`, `moon-chart-mode`, `house-lord`, `sign-lord`. Every text is 40–90 words, level 1, `review: "draft"`, names its rule in `rule` and carries a `source` (Saravali for planet-in-sign, Phaladeepika for planet-in-house, BPHS / Surya Siddhanta / `convention` for dignity). `test/corpus-interpretive.test.ts` enforces counts, ids, word bounds and that each planet-sign text states the dignity `signDignity()` assigns.
- `corpus/rules/en.json`: one entry per engine rule id (`RULE_IDS` in `packages/engine/src/rules/ruleIds.ts`): `text` is the one-sentence rule, `source` the classical text (or `convention`), `params` the engine inputs the "Why?" sheet lists. Festival entries are regenerated from `packages/engine/data/festival-rules.json` by `scripts/gen-festival-rules.ts`; the other entries are hand-written.
- `schema/`: `snippet`, `ui`, `festival-text`, `lesson`, `glossary` JSON schemas (draft-07 subset; validated in tests by `test/lib/validate.ts`).

## API (`src/index.ts`)

- `loadUi(lang)` → the flat string map.
- `t(ui, key, params?, lang?, fallback?)` → interpolates `{param}`; with `params.count` picks `<key>_one` / `<key>_other` (en: one = 1; hi/bho: one = 0 or 1). Missing keys return the key.
- `loadCorpus(domain, lang)` → `{snippets, lang, fallback}`; `lookup(domain, id, lang)` / `ruleText(ruleId, lang)` → `{text, lang, fallback, snippet}`; English is returned with `fallback: true` when the language file or the id is missing.
- `pseudoLocale(ui, 1.3)` → every string padded to +30 % visible length for the layout snapshot tests (design.md 7).

## String conventions

- Keys: `namespace.camelCase`, nested groups with further dots (`band.seg.rahu-kaal` mirrors engine ids). Params `{name}`. Plurals `_one` / `_other`.
- Constrained-box key convention (enforced by `test/completeness.test.ts` on visible code points, `{param}` counted as 6): `tabs.*` ≤ 12 · `*_band` (inline band label) ≤ 10 · `*_tag` and `dignity.<key>` tags ≤ 14 · `*_chip` ≤ 18 · `*_col` (table header) ≤ 20. Everything else wraps.
- Register (spec 7, design 7): Hindi respectful आप, Khari Boli; Bhojpuri respectful रउआ / राउर, होला / करीं / बानी / नइखे, Devanagari, no Maithili forms, Latin technical terms on first mention. Avoid = `टालें` (hi) / `बचीं` (bho). `test/register.test.ts` checks Devanagari dominance, pronoun register, Maithili forms, forbidden phrases (`packages/content-tools/forbidden.json`) and percentage claims in every language.
- Weekday, month, sign, nakshatra and planet names come from the engine's locale tables, not from these files.

## Tests

`npm test -w packages/content`: schema validity, identical key sets and params, length budgets, dignity vocabulary (design.md 4), honesty markers, register and forbidden content, rules coverage of `RULE_IDS`, token contrast in both themes, generated token outputs current.
