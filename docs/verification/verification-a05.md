# Verification — A05 Content infrastructure, tokens, UI strings en/hi/bho, rules corpus, translation tool + Action

Run: 2026-10-25 (workflow wf_86107bfa6c58305a, step a05-content-infra). Worktree c:/Users/sudiskmr/Downloads/DomainClassification/shubhvela.

## Context that shaped this step

- **Concurrent A04.** `a04-validation-suites` was running (then died at disk-full) in the same worktree with uncommitted engine changes (`package-lock.json`, `packages/engine/package.json`, `src/panchang/*`, `test/*.test.ts`, `vendor/jyotish/*`, new `reference/`, `test/suites/`). Consequences: (1) **no npm dependency was added** (every `npm install` would have rewritten the lock file on top of A04's half-done edit and desynchronised it from the committed `engine/package.json`); the planned `ajv` devDependency is replaced by a 90-line draft-07 subset validator in `packages/content/test/lib/validate.ts` (type, required, properties, additionalProperties, propertyNames.pattern, items, enum, pattern, minLength, minimum/maximum, minItems, minProperties — everything the five schemas use; its own negative tests are in `schema.test.ts`); (2) only A05 files were staged by name; A04's files were left untouched; (3) `npm run typecheck` ran over the dirty tree (engine still compiles with A04's edits).
- **Disk full.** C: hit 0 bytes while this step was writing (`packages/engine/src/rules/ruleIds.ts` was truncated to 0 bytes and rewritten; every other file written in that window was re-checked: size > 0, JSON parses, `gen-tokens --check` green). Cause: Outlook OST cache (+11.8 GB in 30 h), not the build. Orchestrator freed ~5 GB (`~/.gradle/caches`); 4.9 GB free at the end of this step.
- `mocks/design-tokens.json` was **copied** (not deleted) into `packages/content/ui/design-tokens.json`: the mocks' `_tokens.js` still reads it and the mocks are the frozen design record under `.agents/` (not in git).

## Commands and results

| # | Command | Result |
|---|---|---|
| 1 | `npm test -w packages/content -w packages/content-tools` | content: 6 files, **39 passed**; content-tools: 1 file, **16 passed** (0.6–1.0 s each) |
| 2 | `npm run typecheck` (all five workspaces) | **clean** (content, content-tools, engine incl. new `ruleIds.ts` + A04's dirty files, app incl. generated `app/src/theme/tokens.ts`, web) |
| 3 | `npx tsx packages/content/scripts/gen-tokens.ts --check` | `22 contrast pairs ok in both themes; tokens.ts, tokens.css and token-contrast.json are current.` exit 0 |
| 4 | `npm run lint -w app` | clean (generated tokens.ts passes eslint-config-expo) |
| 5 | `gh workflow list --repo Sudish007/shubhvela` | see "After push" below |

Test inventory (packages/content): `schema.test.ts` 4 (ui schema ×3 langs, every corpus file, id sets identical across languages, validator negatives) · `completeness.test.ts` 12 (identical key sets 784/784/784, Phase A namespaces exactly, no empty strings, params identical, plural pairs, length budgets, dignity table verbatim, honesty markers, t() ×3, pseudoLocale) · `register.test.ts` 11 (Devanagari dominance hi ≥90 % / bho ≥85 %, bho has no Hindi आप/है/करें and no Maithili forms, hi has no तू/तुम, forbidden phrases + `%` claims in UI and corpus for all three languages, checker self-test) · `rules.test.ts` 3 (every `RULE_IDS` id has a rule; no orphan rule; one sentence + source + inputs; English fallback flagged) · `tokens.test.ts` 6 (22 pairs both themes, design.md 2.1 ratios reproduced, scale, N7/M6 fixes present, generator throws on off-scale / <12 / bannerStrip / failing pair) · `tokens-generated.test.ts` 3 (committed outputs byte-equal, API shape, CSS blocks).
packages/content-tools `translate.test.ts` 16 with a mocked `fetch`: fence stripping, balanced `{…}` extraction (braces inside strings, truncated input), redaction (AIza…, Bearer), request shape (model, max_tokens 8000, reasoning_effort low, json_object, system prompt, key only in the Authorization header), HTTP 400 → retry without response_format, 429 → backoff 2 s/4 s/8 s then redacted error, finish_reason length / null content → LengthError, cap stop before sending, halve-and-retry, single-item give-up, post-checks (id, Devanagari, forbidden, %, length, Maithili, missing field), end-to-end run writing `hi.json` with `review: draft` + redacted diagnostic, cap → cursor → resume, rejections + Bhojpuri review queue, HTTP 403 recorded without abort.

## String counts

| File | Keys | Chars (JSON) |
|---|---|---|
| ui/en.json | 784 | 37,025 |
| ui/hi.json | 784 | 35,791 |
| ui/bho.json | 784 | 35,280 |
| corpus/rules/en.json | 190 entries (88 hand-written + 102 `festival-*` generated from `festival-rules.json`) | — |

Namespaces (24, Phase A; computed from key prefixes, total 784): common 68 · tabs 4 · onboarding 44 · consent 17 · today 53 · band 33 · verdict 8 · panchang 63 · note 28 · upcoming 19 · charts 70 · dignity 20 · dasha 26 · sadesati 19 · family 52 · events 25 · vrat 85 · calendar 32 · reminders 31 · settings 30 · privacy 17 · disclaimer 5 · about 12 · errors 23.

Constrained-box budgets enforced: `tabs.*` ≤12, `*_band` ≤10, `*_tag` and `dignity.<key>` ≤14, `*_chip` ≤18, `*_col` ≤20 (visible code points, `{param}` = 6). Tightest: `onboarding.familyDates_chip` hi 17/18, `dignity.friend` en 13/14, `dignity.retro` en 12/14, `charts.nakshatra_col` en 16/20.

## Contrast table (ui/token-contrast.json, light / dark, minimum)

| fg / bg | min | light | dark |
|---|---|---|---|
| ink / surface | 4.5 | 17.36 | 14.83 |
| ink / paper | 4.5 | 16.25 | 16.04 |
| ink-2 / surface | 4.5 | 7.37 | 9.00 |
| ink-2 / paper | 4.5 | 6.90 | 9.74 |
| ink-3 / surface | 4.5 | 5.43 | 5.63 |
| ink-3 / paper | 4.5 | 5.08 | 6.09 |
| accent / surface | 4.5 | 5.61 | 6.39 |
| accent / paper | 4.5 | 5.25 | 6.91 |
| accent-ink / accent | 4.5 | 5.61 | 6.91 |
| accent / accent-tint | 4.5 | 4.83 | 5.39 |
| indigo / surface | 4.5 | 12.56 | 7.34 |
| indigo / paper | 4.5 | 11.75 | 7.93 |
| good / neutral | 3 | 3.11 | 4.85 |
| night / neutral | 3 | 10.67 | 3.22 |
| good-ink / good | 4.5 | 4.74 | 5.76 |
| night-ink / night | 4.5 | 12.56 | 4.85 |
| avoid-hatch / avoid | 3 | 3.99 | 3.75 |
| good / night | 1 | 3.43 | 1.51 |
| avoid / neutral | 1 | 1.16 | 1.11 |
| ink / neutral | 4.5 | 14.76 | 13.51 |
| ink / avoid | 4.5 | 12.74 | 12.19 |
| accent / neutral | 3 | 4.77 | 5.82 |

0 failures; the numbers equal design.md 2.1 (same formula as the mocks' `_tokens.js`).

## Token file fixes (review items)

- N7: `type.scale.micro.note` no longer lists inline band labels; `caption.note` says "inline band labels (600)"; `type.sizes` = [26,22,20,18,17,15,13,12] is explicit and the generator throws on any `scale[*].size` outside it or below 12.
- M6: `size.bannerStrip` removed; `size.bannerPadding: 16` kept; `bottomPaddingAboveBanner` is the formula text `tabBar + (measuredBannerHeight + 2 * bannerPadding, when AdPolicy shows a banner) + 16 + safeAreaBottom`; `tokens.ts` exports `bottomPaddingAboveBanner(measuredBannerHeight | null, safeAreaBottom)` and `bottomPaddingAboveStickyCta(ctaHeight, safeAreaBottom)` for the `Screen` component; the generator throws if `bannerStrip` reappears.
- P17/N15: retrograde tag is `R retrograde` / `R वक्री` / `R वक्री` (no `scripts/check-glyphs.ts` exists yet to prove U+211E coverage; `charts.retroMark` = "R" is the single place to flip).

## Engine addition (recorded, outside the content package)

`packages/engine/src/rules/ruleIds.ts` (+ one export line in `rules/index.ts`): `RULE_IDS` = GOOD_HOURS (16) + DAILY (33) + CHART (18) + CALENDAR (8) + `vrat-*` (12 from `VRAT_FAMILIES`) + `festival-*` (102 from `FESTIVAL_RULES`) = 189 ids (+ `chandrashtama` as the named alias of `chandra-bala-8`, total 190). The plan's context.json expected this constant from A03; it did not exist, so A05 added it (plan.md 0: "a coder who finds one unassigned implements it in its own cluster and records it"). Ids use the engine's hyphenated form (`choghadiya-amrit`, `sade-sati-phase-1`, `vrat-ekadashi`), not the FEAT text's dotted shorthand.

## After push

Commit `9f4d8e0 feat(content): schema, tokens generator, UI strings en/hi/bho, rules corpus, Gemini translation Action` (44 files, staged by name; A04's dirty files excluded). `git fetch` showed origin/main 0 behind, so `git pull --rebase` was not needed (and would have refused on A04's unstaged changes); `git push origin main` succeeded. `gh workflow list --repo Sudish007/shubhvela` → `CI active 395303237`, `corpus-translate active 395537379`; `gh workflow view corpus-translate.yml` → `Total runs 0`. It is NOT dispatched in this step — A08 does that after the English corpus exists and after `gh secret list` shows `GEMINI_API_KEY`.

## Not verified

- The Gemini endpoint was never called (no dispatch in A05; the key is referenced by name only in the workflow). The CLI is covered by mocked-fetch tests only; the real response shape of `gemini-3.5-flash-lite` (e.g. whether `reasoning_effort` is accepted) is exercised first in A08.
- The workflow file's steps (`actions/upload-artifact@v4`, the bot commit/push) have not run; `gh workflow list` only proves the YAML parsed.
- Hindi/Bhojpuri wording is agent-written and passes the mechanical register tests; naturalness needs the owner's review (docs/OWNER-TODO.md item 6). `bho.json` in particular is an owner-review item by design (design.md 7).
- Layout fit of the strings (+30 % pseudo-locale snapshots, 1.3× font scale) is tested in A09–A13 with the real components; here only the code-point budgets are enforced.
- `ajv` was not installed (lock-file freeze, see above); the mini validator covers the keywords used by the five schemas and nothing more.
- No emulator, Gradle or Metro run in this step.
