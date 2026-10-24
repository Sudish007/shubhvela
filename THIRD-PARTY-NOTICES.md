# Third-party notices

Shubhvela's own code is MIT (see `LICENSE`). It bundles or builds on the following
third-party work. Full licence texts are kept next to the vendored code or in the
dependency's npm package.

| Component | Where | Licence | Notes |
|---|---|---|---|
| `@prisri/jyotish` (Vedic astrology library) | `packages/engine/vendor/jyotish/` | ISC (Prisri Org) | Vendored fork of the TypeScript source at GitHub `prisriorg/jyotish` commit `c720d0ee42702cf43631d55f1ae2fe70de14bdba` (published to npm as 1.1.14, 2026-10-05). The `predictions` and gemstone/remedy modules were removed; `yogas.ts` was kept. See `packages/engine/vendor/jyotish/VENDOR.md`. |
| `astronomy-engine` | npm dependency of `packages/engine` | MIT (Don Cross) | Ephemeris: Sun, Moon, planets, rise/set, nodes. |
| Tiro Devanagari Hindi | `app/assets/fonts/`, `web/fonts/` (added in Phase A/D) | SIL Open Font License 1.1 (Tiro Typeworks) | Display face. |
| Noto Sans, Noto Sans Devanagari | `app/assets/fonts/`, `web/fonts/` (added in Phase A/D) | SIL Open Font License 1.1 (The Noto Project Authors) | Body faces. |
| GeoNames gazetteer | `packages/engine/data/gazetteer.sqlite` (built in A02) | CC BY 4.0 (GeoNames) | Place names, coordinates, populations and time-zone ids. Attribution is shown in Settings -> About and in the web footer. |
| `tz-lookup` | npm devDependency of `packages/engine` | CC0-1.0 (Darkskyapp) | Latitude/longitude to IANA zone id for manually entered coordinates. |
| `moment-timezone` data (IANA tz database) | build-time input of `packages/engine/data/tz-transitions.json` | moment-timezone code MIT; tz database public domain | Only the generated transition table ships. |

Google Mobile Ads SDK, Google Play Billing, Expo and React Native modules are consumed
as npm/Gradle dependencies under their respective licences (Apache-2.0 / MIT) and are
not redistributed in source form here.
