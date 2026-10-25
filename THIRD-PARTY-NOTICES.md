# Third-party notices
Shubhvela's own code is MIT (see `LICENSE`). It bundles or builds on the following
third-party work. Full licence texts are kept next to the vendored code or in the
dependency's npm package.
| Component | Where | Licence | Notes |
|---|---|---|---|
| `@prisri/jyotish` (Vedic astrology library) | `packages/engine/vendor/jyotish/` | ISC (Prisri Org) | Vendored fork of the TypeScript source at GitHub `prisriorg/jyotish` commit `c720d0ee42702cf43631d55f1ae2fe70de14bdba` (published to npm as 1.1.14, 2026-10-05). The `predictions` and gemstone/remedy modules were removed; `yogas.ts` was kept. See `packages/engine/vendor/jyotish/VENDOR.md`. |
| `astronomy-engine` | npm dependency of `packages/engine` | MIT (Don Cross) | Ephemeris: Sun, Moon, planets, rise/set, nodes. |
| Tiro Devanagari Hindi | `app/assets/fonts/TiroDevanagariHindi-Regular.ttf` (A09), `web/fonts/` (Phase D) | SIL Open Font License 1.1 (Copyright 2020 The Indigo Project Authors, Tiro Typeworks) | Display face. Static TTF, font version 1.52, fetched 2026-10-25 from `google/fonts` `ofl/tirodevanagarihindi` (main). |
| Noto Sans | `app/assets/fonts/NotoSans-Regular.ttf`, `NotoSans-SemiBold.ttf` (A09), `web/fonts/` (Phase D) | SIL Open Font License 1.1 (The Noto Project Authors) | Body face for English and for Latin/digit runs inside Devanagari text. Static TTFs from release `notofonts/latin-greek-cyrillic` **NotoSans-v2.015** (2024-11-20), `NotoSans/full/ttf/`. |
| Noto Sans Devanagari | `app/assets/fonts/NotoSansDevanagari-Regular.ttf`, `NotoSansDevanagari-SemiBold.ttf` (A09), `web/fonts/` (Phase D) | SIL Open Font License 1.1 (The Noto Project Authors) | Body face for Hindi and Bhojpuri. Static TTFs from release `notofonts/devanagari` **NotoSansDevanagari-v2.007** (2026-09-09), `NotoSansDevanagari/full/ttf/`. |
| GeoNames gazetteer | `packages/engine/data/gazetteer.sqlite` (built in A02), bundled as `app/assets/gazetteer.sqlite` | CC BY 4.0 (GeoNames) | Place names, coordinates, populations and time-zone ids. Attribution is shown in Settings -> About and in the web footer. |
| `tz-lookup` | npm dependency of `app` (manual coordinates in the birth form and Nominatim results), devDependency of `packages/engine` | CC0-1.0 (Darkskyapp) | Latitude/longitude to IANA zone id; normalised to the engine's canonical zone ids. |
| `moment-timezone` data (IANA tz database) | build-time input of `packages/engine/data/tz-transitions.json` | moment-timezone code MIT; tz database public domain | Only the generated transition table ships. |
| `@react-native-community/datetimepicker` | npm dependency of `app` | MIT (React Native Community) | Native Android date and time pickers on the birth form. |
| OpenStreetMap Nominatim | network service, used only on an explicit "Search online" tap | ODbL data; Nominatim usage policy | The app sends the typed place name with the identifying User-Agent `Shubhvela-Android/<version> (+https://sudish007.github.io/shubhvela/)`, at most one request per second. |
| `opentype.js` | devDependency of `packages/engine` (`scripts/check-glyphs.ts`) | MIT | Build-time glyph coverage report only; not shipped. |
Google Mobile Ads SDK, Google Play Billing, Expo and React Native modules are consumed
as npm/Gradle dependencies under their respective licences (Apache-2.0 / MIT) and are
not redistributed in source form here.
