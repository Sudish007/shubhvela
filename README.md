# Shubhvela (शुभवेला)
Your family's Vedic almanac for Android: kundli, panchang and good hours, muhurat,
tithi birthdays and shraddha reminders, matching, and short lessons, in English,
Hindi and Bhojpuri. Everything is computed on the phone, offline, with the rule
behind every line. No astrologer marketplace, no remedies for sale.
**Status: in development.** Nothing here is released yet; there is no Play Store
listing and the web companion at https://sudish007.github.io/shubhvela/ is not
live until Phase D of the build.
## Layout
```
packages/engine         TypeScript Jyotish engine (vendored @prisri/jyotish fork + astronomy-engine)
packages/content        JSON corpus and UI strings (en / hi / bho)
packages/content-tools  build-time content generators (never shipped)
app                     Expo (React Native) Android app; android/ is committed and hand-maintained
web                     static web companion (GitHub Pages)
scripts                 local build / emulator / screenshot scripts (PowerShell, Node)
docs                    committed copies of the spec, design, build rules and owner runbooks
```
## Develop
Node >= 24. From the repo root: `npm install`, then `npm test`, `npm run typecheck`,
`npm run lint`. APKs are built locally from the checked-in `android/` with
`scripts/build-apk.ps1` (see `release/README.md`).

### App (dev notes)
- `app/app/` are expo-router routes; everything else lives in `app/src/`. Single-owner
  modules: `src/entitlements.ts` (tier caps), `src/ads/AdPolicy.ts` (ad placement),
  `src/components/{Screen,Row,Tag,ComputedFooter,Pressable44}` (honesty markers, 44 dp,
  fixed-chrome padding). `Row` requires a `ruleId`.
- Database: expo-sqlite `shubhvela.db` (WAL), numbered migrations in `src/db/schema.ts`
  (`PRAGMA user_version`). The bundled GeoNames gazetteer is imported from
  `app/assets/gazetteer.sqlite` on first use. Under Jest the same repositories run on
  `node:sqlite` (`app/test/helpers/nodeDb.ts`); `expo-sqlite` is never loaded in tests.
- Fonts: static TTFs in `app/assets/fonts/` registered as `TiroDevanagariHindi`,
  `NotoSans`, `NotoSans-SemiBold`, `NotoSansDevanagari`, `NotoSansDevanagari-SemiBold`
  (`src/theme/typography.ts`). Glyph coverage report:
  `npx tsx packages/engine/scripts/check-glyphs.ts app/assets/fonts` (exit 1 means
  U+211E is missing from a Noto family and the retrograde mark stays `R` + word).
- Pseudo-locale (+30 % strings) for layout tests: set `global.__PSEUDO_LOCALE__ = true`
  before rendering (Jest only; see `app/test/pseudo-locale.test.tsx`).
- Screenshot build: bundle with `$env:EXPO_PUBLIC_SCREENSHOT_MODE='1'`
  (`scripts/build-apk.ps1 -ScreenshotMode`). Only then does the route
  `shubhvela://dev/state?lang=<en|hi|bho>&theme=<light|dark|system>&screen=<route>&sample=1&font=<1.0|1.3>`
  exist: `sample=1` replaces all user data with the sample household (Priya, self,
  1998-03-14 06:42 Lucknow; Amma, mother, 1970-07-05 04:30 Patna; ancestor Dadaji,
  Ashwin Krishna Dashami) and records consent; `lang`/`theme` are persisted; `screen` is
  the route to open (default `/(tabs)/today`); `font` is echoed only (set the device
  font scale with `adb shell settings put system font_scale 1.3`). Every number on a
  screenshot is engine output. Settings -> About shows a "screenshot build" tag.
- A single copy of `react` (19.3.0, the Expo SDK 58 pin) is enforced from the root
  `package.json` (`devDependencies` + `overrides`); two copies break hooks at runtime
  and in Jest.

Licence: MIT for original code; third-party notices in `THIRD-PARTY-NOTICES.md`.
