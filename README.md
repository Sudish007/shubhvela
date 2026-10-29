# Shubhvela (शुभवेला)

Your family's Vedic almanac for Android: kundli, panchang and good hours, muhurat, tithi
birthdays and shraddha reminders, kundli matching, short lessons and a reflection journal,
in English, Hindi and Bhojpuri. Everything is computed on the phone, offline, and every
interpretive line shows the rule behind it ("Why?"). No astrologer marketplace, no wallet,
no remedies for sale, no account.

**Web companion (live):** https://sudish007.github.io/shubhvela/ — kundli calculator, panchang
for 331 cities, festival dates, muhurat months, glossary and vrat pages in three languages,
rebuilt monthly by GitHub Actions. Privacy policy, terms and the data-deletion page live there too.

**Status (1.0.0, 2026-10-30):** release candidate. Not yet on Google Play: the listing, products
and AdMob ids are owner steps (`docs/OWNER-TODO.md`); until the listing exists the site says
"Coming to Google Play" and no APK is offered for download. Signed test builds are made locally
with `scripts/build-apk.ps1` and are not committed.

## What is in 1.0.0

| Area | Free (with ads) | Pro |
|---|---|---|
| Kundli: D1 + D9 in North / South / East Indian styles, planet table with dignities, yogas, maha + antar dasha | ✓ | ✓ |
| Today: good-hours band, daily note, panchang sheet, home-screen widgets, text-to-speech | ✓ | ✓ |
| Profiles / tithi reminders (birthdays, shraddha, vrats) | 2 / 5 | unlimited |
| Muhurat finder | today + 7 days | any range + `.ics` |
| Dasha | maha + antar | + pratyantar and change alerts |
| Matching (36 guna), share by QR or 20-character code | scores + summary | full explanations + PDF |
| D2–D60, KP, Ashtakavarga, Prashna, Varshaphal | 24-h unlock after a rewarded video | ✓ |
| 21 lessons, 264-term glossary, journal | ✓ | ✓ |
| Ask my chart (on-device Gemma 4 E2B; needs Android 12+, 6 GB RAM, Wi-Fi download) | — | ✓ |
| Janam Patri PDF / Matching PDF / Varshaphal PDF | ₹99 / ₹99 / ₹149 | included / included / ₹149 |
| Encrypted backup and restore, delete everything | ✓ | ✓ |

Honesty rules that shape the UI: every number is engine output; "approx." tags when the birth time
is unknown or a planet is within 1° of a sign boundary; "How this was computed" on every report;
no outcome promises, no health claims, no testimonials, no fake counters.

Known limits at 1.0.0 (details in `docs/RELEASE-NOTES.md` and `docs/OWNER-TODO.md`):

- Interpretive text falls back to English where a Hindi or Bhojpuri corpus file does not exist yet
  (14 of 19 corpus domains had Hindi and Bhojpuri files on 2026-10-30, 1,020 of 1,542 snippets;
  `naamkaran-names` needs none; `dasha-pairs`, `nakshatra-pada`, `planet-house` and `planet-sign`
  follow in a content update; the release notes of each build state the current count).
- Six matching pairs differ from Drik Panchang by one Yoni point under a documented convention
  (`packages/engine/reference/CONVENTIONS.md`).
- "Ask my chart" inference has been exercised on the emulator only through its device gate and unit
  tests; the emulator cannot run the model.
- Live purchases and real ad fill were not testable before the Play products and AdMob ids exist.

## Layout

```
packages/engine         TypeScript Jyotish engine (vendored @prisri/jyotish fork + astronomy-engine), reference suites
packages/content        JSON corpus (en, with hi/bho translations as they land) and UI strings (en / hi / bho)
packages/content-tools  build-time content generators and the Gemini translation Action's code (never shipped)
app                     Expo SDK 58 (React Native 0.88) Android app; app/android/ is committed and hand-maintained
app/brand               brand sources; app/playstore-assets  Play listing kit (store-listing.md, graphics, screenshots)
web                     static web companion (Node generator -> dist/, GitHub Pages)
scripts                 local build / emulator / screenshot / asset scripts (PowerShell, Node)
docs                    spec, design, plan, verification and review records, owner runbooks, breach process
```

## Develop

Node >= 24. From the repo root: `npm install`, then `npm test`, `npm run typecheck`, `npm run lint`.
APKs are built locally from the checked-in `android/` with `scripts/build-apk.ps1` (see `release/README.md`);
`expo prebuild` is never run again. Web: `npm run web:build` writes `web/dist`; `npm run audit -w web`
runs the Playwright layout audit. Play listing kit checks: `node scripts/gen-store-assets.mjs --check`
(graphics via `node scripts/gen-brand-assets.mjs --check`).

### App (dev notes)

- `app/app/` are expo-router routes; everything else lives in `app/src/`. Single-owner
  modules: `src/entitlements.ts` (tier caps), `src/ads/AdPolicy.ts` (ad placement),
  `src/components/{Screen,Row,Tag,ComputedFooter,Pressable44,BottomInset}` (honesty markers, 44 dp,
  fixed-chrome padding and the navigation-bar inset). `Row` requires a `ruleId`.
- Database: expo-sqlite `shubhvela.db` (WAL), numbered migrations in `src/db/schema.ts`
  (`PRAGMA user_version`). The bundled GeoNames gazetteer is imported from
  `app/assets/gazetteer.sqlite` on first use. Under Jest the same repositories run on
  `node:sqlite` (`app/test/helpers/nodeDb.ts`); `expo-sqlite` is never loaded in tests.
- Fonts: static TTFs in `app/assets/fonts/` registered as `TiroDevanagariHindi`,
  `NotoSans`, `NotoSans-SemiBold`, `NotoSansDevanagari`, `NotoSansDevanagari-SemiBold`
  (`src/theme/typography.ts`). Glyph coverage report:
  `npx tsx packages/engine/scripts/check-glyphs.ts app/assets/fonts`.
- Pseudo-locale (+30 % strings) for layout tests: set `global.__PSEUDO_LOCALE__ = true`
  before rendering (Jest only; see `app/test/pseudo-locale.test.tsx`).
- Screenshot build: bundle with `$env:EXPO_PUBLIC_SCREENSHOT_MODE='1'`
  (`scripts/build-apk.ps1 -ScreenshotMode`). Only then does the route
  `shubhvela://dev/state?lang=<en|hi|bho>&theme=<light|dark|system>&screen=<route>&sample=1&pro=<0|1>&font=<1.0|1.3>`
  exist: `sample=1` replaces all user data with the sample household and records consent;
  `screen=/dev/insets` prints the bottom inset the app receives. Every number on a
  screenshot is engine output. Settings -> About shows a "screenshot build" tag.
- A single copy of `react` (19.3.0, the Expo SDK 58 pin) is enforced from the root
  `package.json` (`devDependencies` + `overrides`).

## Privacy in one paragraph

No account, no server of ours, no analytics. Birth details stay in the on-device database. The free
tier loads Google AdMob, which receives device identifiers; Pro never initialises the ads SDK. The only
other network calls are Google Play Billing, one OpenStreetMap Nominatim search when the user taps
"Search online", and the one-time Gemma model download a Pro user consents to. Backups are
AES-256-GCM files the user creates. Breach handling: `docs/BREACH-PROCESS.md`.

Licence: MIT for original code; third-party notices in `THIRD-PARTY-NOTICES.md`.
