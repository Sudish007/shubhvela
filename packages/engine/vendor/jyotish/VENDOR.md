# Vendored fork: @prisri/jyotish

| | |
|---|---|
| Upstream | https://github.com/prisriorg/jyotish |
| Commit | `c720d0ee42702cf43631d55f1ae2fe70de14bdba` (branch `main`, pushed 2026-10-05) |
| npm release | `@prisri/jyotish` 1.1.14 (the npm package ships compiled JS only; this fork vendors the TypeScript source) |
| Licence | ISC, Copyright (c) 2026 Priyansh Srivastava (see `LICENSE` in this folder) |
| Runtime dependency | `astronomy-engine ^2.1.19` (MIT) |
| Vendored on | 2026-10-24 by the Shubhvela A01 bootstrap step |

## Why a fork

Shubhvela ships no predictions, remedies or gemstone advice (spec D7/D8: every number
computed, nothing sold, no outcome claims). The upstream `predictions` module is large
prose generation; keeping it out of the source tree guarantees it can never reach the
app bundle, and `packages/engine/test/public-api.test.ts` asserts that no exported
symbol name contains Gemstone / Prediction / Remed / LalKitab / Growth / Career /
Wealth / Marriage / Health / Progeny / Education.

## Removed (relative to upstream `src/`)

- `predictions/index.ts`, `career.ts`, `dasha_timeline.ts`, `education.ts`,
  `gemstones.ts`, `growth.ts`, `health.ts`, `jaimini.ts`, `marriage.ts`,
  `multisystem.ts`, `progeny.ts`, `remedies.ts`, `transits.ts`, `types.ts`,
  `validation.ts`, `wealth.ts`
- `i18n/dictionaries/predictions.ts` (prediction/remedy strings)
- `kundli/horoscope.ts` (`generateHoroscope`: prediction prose; was not exported upstream)
- Root-level test scripts, `full_chart_data.json`, `.github/`, `tests/`, `README.md`,
  `package.json`, `tsconfig.json` (the engine package provides its own)

## Kept and moved

- `predictions/yogas.ts` -> `kundli/yogas.ts`. Yoga detection is rule logic needed for
  F16. Its two type imports from `predictions/types.ts` (`YogasAndDoshasReport`,
  `PredictionOptions`) were inlined into the file; `PredictionOptions` is renamed
  `YogasOptions`. No other change.
- `src/index.ts` rewritten to export only the kept modules (plus `kundli/yogas`).
- `i18n/index.ts`: the `dictionaries/predictions` re-export line removed.

Everything else is byte-identical to upstream. Update this file whenever the fork
diverges further.
