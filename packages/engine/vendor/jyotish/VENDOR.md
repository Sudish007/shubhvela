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

## Modified (A04 validation suites, 2026-10-25)

- `core/ayanamsa.ts` rewritten: Lahiri = 23°15'00.658" at 1956-03-21 0h ET (Lahiri's definition,
  Swiss Ephemeris `SE_SIDM_LAHIRI`), KP = 22.363889° at J1900, Raman = 21.013889° at J1900, each
  carried with the IAU 2006 accumulated general precession in longitude (no nutation). Upstream
  used a J1900-anchored Lahiri (23°51'25.5" at J2000) that sits ~24" below Drik Panchang's printed
  ayanamsa; the new definition is within 8" (see `packages/engine/reference/CONVENTIONS.md`).

## Modified (Phase A review fix, 2026-10-26)

- `core/muhurta/choghadiya.ts`: upstream had Shubh and Rog swapped in `CHOGHADIYA_ORDER` and in the
  Sunday, Monday, Wednesday and Friday `DAY_SEQUENCES` rows (`… Kaal, Rog, Shubh …`), while the Tuesday,
  Thursday and Saturday rows and every published table (Drik Panchang, Prokerala, AstroSage) follow
  the single hora-lord cycle Sun > Venus > Mercury > Moon > Saturn > Jupiter > Mars =
  Udveg, Chal, Labh, Amrit, Kaal, **Shubh, Rog**. The four rows and the constant were corrected; the
  night rows were already right. `CHOGHADIYA_ORDER`, `NIGHT_CHOGHADIYA_ORDER`, `DAY_SEQUENCES` and
  `NIGHT_SEQUENCES` are now exported so `packages/engine/test/choghadiya.test.ts` can assert that every
  day row is a rotation of the day cycle starting at the weekday lord and every night row a rotation of
  the night cycle. `gowri.ts` (Gowri panchang, unused by Shubhvela) was not touched.

## Modified (B01 engine B, 2026-10-27)
- `kundli/kp.ts`: `calculateTropicalPlacidusCusps()` is now exported (one `export` keyword, no logic
  change) so `packages/engine/src/kp` can build the KP chart from ChartData-consistent inputs (true
  node option, the engine's tz table for the day lord, nine planets only) instead of calling
  `getKpChart()`, whose `birthDetails` strings go through `Intl` with a hard-coded Asia/Kolkata zone.

Everything else is byte-identical to upstream. Update this file whenever the fork
diverges further.
