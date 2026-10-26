# Verification A08 — English master corpus 3 (festivals, vrats, glossary) + Gemini batch A

Worktree `c:/Users/sudiskmr/Downloads/DomainClassification/shubhvela`, branch `main`. 2026-10-25.

## 0. Owner decision that changed this step (binding, received mid-step)

"leave bhojpuri translation" (2026-10-25): the interpretive corpus is NOT machine-translated into Bhojpuri in v1, now or later. Bhojpuri = the hand-written `ui/bho.json` (784 keys) + the `names.bho` in `packages/engine/data/festival-rules.json`. Corpus snippets shown in the Bhojpuri UI resolve bho → hi → en (no badge, no empty strings). `GEMINI_API_KEY` is still absent and the owner has not set it; the step must not wait. Consequences implemented below: Action default `lang=hi`, OWNER-TODO instructions, fallback chain in `packages/content`, records in FEAT-A08 / carry-over. **No Gemini batch was dispatched in this step** and no later step pauses for the key.

## 1. English master (commit 146bd08, pushed before the decision)

| File | Count | Shape | Notes |
| --- | --- | --- | --- |
| `packages/content/corpus/festivals/en.json` | 102 | `festival-text.schema.json` (`id festival-<slug>`, `slug`, `name`, `what`, `rule`, `conventionNote`, `review: draft`) | one per slug of `packages/engine/data/festival-rules.json` (FEAT: "for every slug"; acceptance ≥ 60). `name` = engine `names.en`; `rule` = the identical sentence from `corpus/rules/en.json` `festival-<slug>`; `what` 80–107 words; `conventionNote` names the Purnimanta/Amanta, timing (udaya/aparahna/madhyahna/pradosh/nishita/moonrise/purvahna/tri-muhurta/Bhadra), solar/nakshatra or North/South convention. |
| `packages/content/corpus/vrats/en.json` | 12 | `snippet.schema.json`, id = engine ruleId `vrat-<VratFamily>` (`vrat-ekadashi` … `vrat-vinayakaChaturthi` … `vrat-satyanarayan`) | `rule` = the `corpus/rules` timing sentence; `text` 80–150 words of what to do + timing explanation (parana, moonrise, pradosh, nishita, madhyahna, arghya, Ghatasthapana); `source` Dharmasindhu / convention. |
| `packages/content/corpus/glossary/en.json` | 217 | `glossary.schema.json` (plain slug ids, `term_dev`, `term_lat`, `meaning` ≤ 160 chars, `related`) | 12 signs, 9 planets, 27 nakshatras, 16 tithi names, 12 lunar months, 6 ritus, 7 choghadiyas, 9 taras, 7 special yogas, panchang timings, dignities, dasha/transit terms, vrat/festival terms, sources; every Sanskrit term found in `ui/en.json` and `corpus/rules/en.json` (`LINKED_TERMS` in the test, 117 entries, each asserted to occur in the UI/rules text AND to resolve). |

Code: `src/registry.ts` (CORPUS `vrats`; `FESTIVALS`, `GLOSSARY`), `src/load.ts` (`loadFestivals`, `festivalText`, `loadGlossary`, `glossaryTerm`), `src/index.ts`, `test/corpus-ritual.test.ts` (10 tests), `test/corpus-interpretive.test.ts` (`vrats` in MIN_COUNTS/WORD_BOUNDS), README.

Forbidden-word fixes during authoring: "curse" (Jaya Ekadashi story → "spell"), "Cancer" (Karka → "Karkata, the crab"), two gendered phrasings rewritten neutrally (Gangaur, Durga Ashtami). Festival texts name those who keep a vow as "those keeping the vow", never by gender; Karwa Chauth/Vat Savitri say "spouse".

## 2. Fallback chain + Action defaults (second commit, after the decision)

- `packages/content/src/load.ts`: `FALLBACK_CHAIN = { en: [en], hi: [hi, en], bho: [bho, hi, en] }`; generic `resolve()` (per id) and `resolveAll()` (per file) walk the chain and return `{item|text, lang, fallback}` where `lang` is the language actually used, so the UI keeps its chrome language. `lookup`, `ruleText`, `loadCorpus`, `loadFestivals`, `festivalText`, `loadGlossary`, `glossaryTerm` all use it. Exported `FALLBACK_CHAIN`, `Resolved<T>`.
- `test/fallback.test.ts` (6 tests): chain shape; for EVERY registered domain and EVERY English id, `hi` and `bho` lookups return non-empty text with `lang` = the first chain language that has the id; whole-domain loads never empty; festivals/glossary same; unknown ids/domains null in every language; real `resolve()` on a simulated en/hi/bho table proves bho → hi (not en) when hi has the id.
- `.github/workflows/corpus-translate.yml`: input `lang` default `both` → `hi` (option list kept; header documents the owner command and the Bhojpuri exclusion). The input name is `lang` (the decision text said `langs`; the real input is `lang`, documented accordingly). `packages/content-tools/src/cli.ts` default `--lang` → `hi`.
- `docs/OWNER-TODO.md` item 5: set the secret, then `gh workflow run corpus-translate.yml --repo Sudish007/shubhvela -f lang=hi`; Bhojpuri intentionally excluded; meanwhile hi → en. Item 6: no bho review queues will exist; review `ui/bho.json` and `names.bho` instead.
- `packages/content/README.md` updated (no bho corpus; resolvers and chain).

## 3. Commands and results

```
npm test -w packages/content        -> before fallback: 8 files / 78 tests passed; after: 9 files / 84 tests passed (was 7 / 66 after A07)
npm test -w packages/content-tools  -> 1 file / 16 tests passed
npm run typecheck                   -> content, content-tools, engine, app, web: clean
gh secret list --repo Sudish007/shubhvela  -> "no secrets found" (checked 3x; name GEMINI_API_KEY absent; nothing printed)
gh run list --repo Sudish007/shubhvela --workflow corpus-translate.yml --limit 3  -> no runs found (nothing dispatched)
Test-Path env:GEMINI_API_KEY        -> False (no local fallback)
git pull --rebase origin main; git push origin main  -> 71e102f..146bd08 (English master); second push recorded in FEAT findings
```

Secret protocol: WARNING sent once when the name was absent; the owner answered with the decision above instead of setting the key. The key value was never asked for, printed or stored.

## 4. Coverage per language / domain (Phase A corpus, 12 domains)

| Domain | en | hi | bho |
| --- | --- | --- | --- |
| planet-sign 108 · planet-house 108 · dignity 14 · lagna 12 · nakshatra-pada 108 · dasha-pairs 90 · transit 39 · daily 105 · rules 190 · festivals 102 · vrats 12 · glossary 217 | all present (1105 items) | none yet — resolves to en via hi → en until the owner dispatches the Action | none, by decision — resolves bho → hi → en |

UI strings: en/hi/bho 784 keys each (A05, hand-written).

## 5. Not verified

- No Action run, no diagnostic artifact, no `review-queue/bho-A.md` (none will exist). The Hindi corpus is English until the owner dispatches `-f lang=hi`; `fallback.test.ts` will keep passing afterwards because it asserts chain order, not file presence.
- Human review of the English wording (all `review: "draft"`).
- The app UI (A10/A11) must read `lang`/`fallback` from the resolvers and keep the chrome language; not built yet.
- carry-over A-MEDIUM-1 (Drik reference-data shortfall, "owner cluster A08 (after its Gemini batch) or the Phase A fixer") is NOT addressed here: outside FEAT-A08's steps and still blocked by the Drik reCAPTCHA; left to the Phase A fixer.
