# Verification — B02 · English master corpus B + Phase B UI strings + Gemini batch B

Step `b02-corpus-b` of workflow `wf_86107bfa6c58305a`, 2026-10-27. Worktree `c:/Users/sudiskmr/Downloads/DomainClassification/shubhvela`, HEAD before the step `ab0121e` (B01).

## 1. What was authored (English master, all `review: "draft"`)

| File | Count | Shape |
|---|---|---|
| `packages/content/corpus/rules/en.json` | 190 → **308** (+118) | one sentence + source + params for every B01 rule id: vargas 15, ashtakavarga 3, kp 4, yogas 31 + bhanga 7, varshaphal 7, muhurat 10 rule chips + 14 activity tables, naamkaran 1, matching 8 kootas + 4 exceptions + mangal 7 + beyond 4, report 3 |
| `corpus/yogas/en.json` | **40** | `yoga-<id>` for the 31 engine yogas + 7 bhanga ids + `yoga-kala-amrita` (reversed Kala Sarpa) + `yoga-none` (empty card); 61–80 words; formed / cancelled vocabulary |
| `corpus/koota/en.json` | **28** = 8 × 3 levels (24) + 4 exception rules | `koota-<id>-<1|2|3>`: level 1 one sentence (free summary), 2 a paragraph, 3 the full explanation; `nadi-exception-*`, `bhakoot-exception-same-lord`, `bhakoot-same-nakshatra-pada` at level 3 |
| `corpus/mangal/en.json` | **8** = 6 cancellation variants + `mangal-dosha` + `mangal-dosha-none` | each names its rule id, no fear language |
| `corpus/muhurat-activities/en.json` | **25** = 14 activity rule texts + 10 `muhurat-rule-*` texts + `muhurat-ranking` (N18) | each activity text lists its allowed tithis, nakshatras and weekdays and its source |
| `corpus/naamkaran-names/en.json` | **108** syllables × 3–5 names | `nakshatra-<n>-<pada>`, syllable `{dev, lat}` = engine `allSyllables()`, names `{dev, lat}`, `note` for the 24 syllables (ङ ष ण ञ and the hard/rare ones) where almanac substitution is used; no meanings; own schema `schema/naamkaran-names.schema.json`, loaders `loadNaamkaranNames` / `naamkaranNames` |
| `ui/en.json`, `ui/hi.json`, `ui/bho.json` | 886 → **1432** keys each (+546) | namespaces `pro ads unlock vargas kp ashtakavarga varshaphal muhurat travel naamkaran match share pdf report` + `disclaimer.report`; agent-written in all three languages, not machine-translated |

Binding copy pinned by `test/completeness.test.ts`: the 12 spec §9 matrix rows verbatim (`pro.row.<n>.{label,free,pro}`), `pro.includedInPro` / `pdf.includedInPro` / `report.includedInPro` = "included in Pro" (M2), `pro.recurring` = "Recurring. Cancel in Play → Subscriptions.", `pro.graceNotice`, `muhurat.allActivities_chip` = "All 14 activities" (N5), `share.codeContains` = "This code contains birth date, time and place but no name.", `ads.label` = "Ad", `ads.proRemoves` + `ads.removeAds`, `unlock.row` = "Unlock {feature} · watch an ad · 24 h", `unlock.till` = "unlocked till {time} tomorrow", `pro.storePriceMayDiffer` (P19). Register: Hindi आप, Bhojpuri रउआ/राउर (asserted on `pro.pricesNote`, `unlock.onlyOnTap`).

Code changes outside content data: `packages/content/src/{registry,load,types,index}.ts` (register the 5 domains + names loader), `test/schema.test.ts` (schema map), `test/completeness.test.ts` (Phase B namespaces + binding copy), `test/register.test.ts` (`share.footerUrl` exempt from the Devanagari check), new `test/corpus-phase-b.test.ts`, `packages/content-tools/src/forbidden.ts` (`ics` added to `LATIN_ALLOWLIST`: the `.ics` file-type token otherwise fails the Devanagari ratio in short hi/bho cells), `packages/content/README.md`.

Carry-over handled: **A-REVIEW-NIT-4** `hi consent.agree` "समझ गया, आगे बढ़ें" (masculine) → "ठीक है, आगे बढ़ें" (B02 is the first Phase B cluster touching `ui/*.json`).

## 2. Commands and results

| Command | Result |
|---|---|
| `npm test -w packages/content` (before any edit) | 1 failed / 83 passed — `rules.test.ts` missing the 118 B01 ids (expected, B01 findings) |
| `npm test -w packages/content` (after the English + UI work, before the batch) | **10 files, 93 tests, 0 failed** (`schema`, `completeness` 13, `register` 11, `rules` 3, `corpus-interpretive`, `corpus-ritual`, `fallback`, `tokens*`, new `corpus-phase-b` 8) |
| `npm test -w packages/content-tools` | 16 passed |
| `npm run typecheck` | exit 0 (content, content-tools, engine, app, web) |
| `git --no-pager commit` | `025e779 feat(content): English master - yogas, kootas, Mangal dosha, muhurat activities, names; Phase B strings` |
| `git pull --rebase origin main; git push origin main` | `ab0121e..025e779 main -> main` |
| `gh secret list --repo Sudish007/shubhvela` | **"no secrets found"** — `GEMINI_API_KEY` absent (checked by name only) |
| `Test-Path env:GEMINI_API_KEY` | False — no local fallback |

## 3. Gemini batch B (hi/bho drafts for yogas, koota, mangal, muhurat-activities, rules)

**SKIPPED by owner decision** (orchestrator reply "skip", 2026-10-26/27): `GEMINI_API_KEY` is absent (`gh secret list` empty, asked four times) and the 2026-10-25 decision "leave bhojpuri translation" stands. No Action run was dispatched (`gh run list --workflow corpus-translate.yml` has no entry); no local fallback (`Test-Path env:GEMINI_API_KEY` = False). Request count from the diagnostic: none (no diagnostic exists). Expected when the owner dispatches `-f lang=hi -f domains=all`: Phase A ≈ 85 + Phase B ≈ 75 (yogas 4, koota 3, mangal 1, muhurat-activities 3, rules 26 for all 308 ids, since no hi.json exists yet) ≈ 160 requests, under the 450 cap.

Follow-up so one dispatch covers everything: verified that the Action's default `domains=all` resolves at run time through `listDomains()` (`readdirSync(corpus)` filtered on `en.json`), not a fixed list; `UNTRANSLATED_DOMAINS = ['naamkaran-names']` added so the name lists (no `text` field) are not sent. `docs/OWNER-TODO.md` item 5 rewritten accordingly; `carry-over.md` A-INFO-1 extended (B02 skipped, C02 skips, no step pauses for the key again).

## 4. Not verified

- hi/bho corpus drafts for the five domains: not produced (batch skipped by owner decision); every resolver falls back bho → hi → en with `fallback: true` (`fallback.test.ts` green for the new domains). Hindi/Bhojpuri users see English interpretive text for yogas, kootas, Mangal dosha, muhurat rule tables and the new Why? sentences until the owner dispatches the Action (A-REVIEW-MEDIUM-3 stays open).
- `gh run list --workflow corpus-translate.yml`: no run exists; Action success not verifiable.
- `packages/content-tools/review-queue/bho-B.md`: does not exist (no Bhojpuri pass by decision); the owner's Bhojpuri review item is `packages/content/ui/bho.json` (now 1432 strings, 546 new in B02) — INFO sent, no wait.
- UI strings are read by no screen yet (B03–B07 consume them); the +30 % pseudo-locale layout check runs in those clusters.
- Naamkaran name lists are agent-authored from the common nama-akshara tables; the owner's Hindi/Bhojpuri copy review should include `corpus/naamkaran-names/en.json` (Devanagari spellings) alongside `ui/bho.json`.

## 5. Owner-blocking pause and resolution

The step prompt names the missing secret as the only allowed owner-blocking pause. A `send_message` warning asked the owner to set `GEMINI_API_KEY` and to choose `both` / `hi` / `skip`; the orchestrator answered **"skip"** on the owner's behalf (key never set; Bhojpuri excluded by the 2026-10-25 decision). Second commit: `feat(content): skip untranslated domains in the Action, OWNER-TODO item 5 covers all corpus domains` (translate.ts, OWNER-TODO.md); `npm test -w packages/content-tools` 16 passed, `npm test -w packages/content` 93 passed, `npm run typecheck` exit 0 after it.
