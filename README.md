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

Licence: MIT for original code; third-party notices in `THIRD-PARTY-NOTICES.md`.
