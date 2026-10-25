# @shubhvela/content-tools

Build-time tools for the content corpus. Nothing here ships in the app.

## translate (Gemini, build time only)

```
npx tsx packages/content-tools/src/cli.ts --lang hi|bho|both --domains all|rules,festivals --max-requests 450 [--batch A]
```

Normally run by `.github/workflows/corpus-translate.yml` (`workflow_dispatch`; the key is the repository secret `GEMINI_API_KEY`, referenced by name only). Locally it runs only when the environment variable `GEMINI_API_KEY` exists; the key is read once and never printed or written.

What it does (plan.md section 9, build-rules "Gemini" facts):

- English master `packages/content/corpus/<domain>/en.json` → `<domain>/<lang>.json`, every item `review: "draft"`; fields translated per domain (`text`; festivals `name/what/rule/conventionNote`; lessons `title/body`; glossary `meaning`), everything else copied from English.
- Batches of 12 items (lessons 1) to `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`, model `gemini-3.5-flash-lite`, `response_format json_object` (retried once without it on HTTP 400), `max_tokens 8000`, `reasoning_effort low`, system prompt `single JSON object, no markdown fences, no prose`; the user prompt carries the register rules, the forbidden-content rules, the length midpoint ±40 % and the batch as JSON.
- Response hygiene: fences stripped, first balanced `{…}` extracted; `finish_reason: "length"` or empty content → the batch is halved and each half retried once; 429/5xx → exponential backoff ×3.
- Request cap (default and maximum 450 per run) with `cursor-<lang>.json` so the next run resumes where this one stopped.
- Post-checks per item: id equality, Devanagari ratio (≥90 % hi, ≥85 % bho after allow-listed technical terms), `forbidden.json` phrases, percentage claims, Maithili forms (bho), placeholder set, length within ±40 %. Rejected items are listed in the diagnostic and left untranslated for the next run.
- `diagnostic.json` (gitignored, uploaded as an Action artifact) is key-scrubbed (`AIza[0-9A-Za-z_-]{30,}` → `AIza[redacted]`, bearer tokens too) and never contains request headers.
- `review-queue/bho-<batch>.md`: 50 random Bhojpuri snippets per run for the owner's review (spec section 7).

`forbidden.json` lists the claim phrases per language (guarantees, fear words, medical claims, gemstone/puja sales, accuracy claims, gendered assumptions). It is shared with `packages/content/test/register.test.ts`, which applies the same checks to every UI string and corpus file.

Tests (`npm test -w packages/content-tools`) run against a mocked `fetch`: fence stripping, balanced extraction, cap stop with cursor, length-error halving, 400/429 handling, redaction, post-checks, review queue.
