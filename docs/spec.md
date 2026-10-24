# Shubhvela — v1 product and build specification

Status: OWNER DECISIONS RECORDED 2026-10-24. Codename **Shubhvela** (शुभवेला, "auspicious time"); .com/.in/.app were unregistered on 2026-10-24 and no company/app/brand of that name was found on the web. The name is a working codename until Sudish confirms it; it must be final before the first Play Console upload because the Android `applicationId` cannot change afterwards.

Companion document: `research.md` in this folder (market research, sources, monetisation numbers). This spec is the binding scope.

## 0. Owner decisions (binding)

| # | Decision | Value |
|---|---|---|
| D1 | Scope | **Everything from research §4 ships in v1** (phased internally, see §12, but all in the v1 line) |
| D2 | Platforms | **Android only** (Play Store). No iOS work. |
| D3 | Languages | **English, Hindi, Bhojpuri** — full UI, content corpus, notifications, PDFs, web companion |
| D4 | SEO web companion | **Yes**, built alongside: static site, same engine, same languages |
| D5 | Business model | Freemium. Free tier shows ads; **Pro removes all ads** and unlocks the Pro column of §9. One-time report purchases exist in both tiers. |
| D6 | No human astrologers | No consultations, chat marketplace, wallet, per-minute billing — ever in v1 |
| D7 | No commerce of remedies | No gemstones, pujas, yantras, e-commerce, affiliate links |
| D8 | Honesty | Every number computed; no accuracy %, no testimonials, no fake live tickers, no "verified prediction" badges; AI output labelled as AI; approximate inputs labelled approximate |
| D9 | Theme | Light theme is the first paint for everyone; dark only via a persisted toggle (System/Light/Dark) |
| D10 | Compute | On-device, offline; no account required to use the app; no server for core features |
| D11 | LLM | No paid LLM API. Interpretation text generated once at build time (Gemini Flash-Lite, free tier) and shipped as static content. "Ask my chart" runs on-device (Gemma 4 E2B via LiteRT-LM), Pro-only. No cloud chatbot. |
| D12 | Hosting | GitHub repo `Sudish007/shubhvela` (public), web companion on GitHub Pages via Actions, custom domain later |

## 1. Positioning (one sentence per audience)

- To the user: *Your family's Vedic almanac — today's good hours, your chart and dashas, every tithi that matters to your family, matching and muhurat — on your phone, offline, in your language, with the reason behind every line and nobody selling you anything.*
- To Play Store reviewers / press: computation-first Jyotish utility; no fortune-telling marketplace.
- Tagline candidates (Hindi-first): "शुभ समय, आपके हाथ में" / Bhojpuri: "शुभ बेला, रउआ हाथ में" / English: "The right time, in your pocket". Final copy decided in design.

## 2. Users and intents

Primary persona (from research §2): woman 22–32, North/West India, Hindi-first, deciding about relationship/marriage and career; mid-range Android (4–8 GB RAM), often patchy data. Secondary: 20–26 job seeker; 40+ family "keeper of rituals" (vrat, tithi birthdays, shraddha); diaspora Hindus (US/UK/Gulf; English UI; valuable for ads and Pro).

Onboarding intents (pick one, optional): Marriage & relationships · Career & money · Family dates & rituals · Learn my chart. The intent only reorders the Today card stack; nothing is hidden behind it.

## 3. Feature scope (v1, all required)

Each item lists the acceptance test the reviewer must run. "Explains" means a tappable "Why?" that shows the rule, the inputs used and, where applicable, the classical source name.

### 3.1 Onboarding and profiles
- F1 Start without an account: date, time (with "I don't know" / "approximately"), place (offline search over a bundled gazetteer; online Nominatim fallback), gender optional, name optional. First value shown within 10 s of install: Moon sign, nakshatra, today's note.
- F2 Unknown birth time → Moon-chart mode; approximate time → confidence tags on Lagna and any planet within 1° of a sign boundary; Prashna mode offered.
- F3 Profiles: self + family members; free tier 2 profiles, Pro unlimited; each profile has relationship label, tradition (Purnimanta/Amanta), language for PDFs.
- F4 Historical time zones (IANA, including India 1942–45 war time, Nepal, Gulf, UK/US DST) — never device offset. Test: births in Delhi 1944, Kathmandu 1990, Dubai 2005, London 1988 match reference calculators.

### 3.2 Today (home)
- F5 Good-hours bar: one horizontal day timeline at the profile's current location (GPS or chosen city): sunrise/sunset/moonrise, Brahma muhurat, Abhijit, Rahu Kaal, Yamaganda, Gulika, Choghadiya segments, planetary Hora, current-time marker. Explains each segment.
- F6 Personal daily note (3–5 sentences) from transit-to-natal rules: Chandra bala (Moon house from natal Moon, incl. Chandrashtama), Tara bala, tithi/nakshatra/yoga of the day, Sade Sati/Dhaiya state, current maha/antar dasha lords' day-strength. Every sentence has "Why?".
- F7 Upcoming strip: next family tithi event, next vrat, next muhurat the user saved, next dasha change, next major transit (Saturn/Jupiter/Rahu-Ketu sign change).
- F8 Panchang detail sheet: tithi, nakshatra, yoga, karana with end times, Vikram Samvat, Shaka, Hindu month (both systems), ritu, ayana, sun/moon rashi, moonrise/moonset.
- F9 Home-screen widgets (Android): small (today's good-hours summary) and medium (good-hours bar + next event). Updated at least hourly and at segment boundaries.
- F10 Daily note read-aloud (TTS) in the UI language.

### 3.3 Charts
- F11 Kundli: D1 Rashi chart in North Indian, South Indian and East Indian styles (user setting); planet table with sign, degree, nakshatra-pada, dignity (exalted/debilitated/own/friend/enemy, combust, retrograde, vargottama); house lords; Lagna, Moon, Sun charts; Bhava Chalit.
- F12 Divisional charts: D2, D3, D4, D7, D9, D10, D12, D16, D20, D24, D27, D30, D40, D45, D60 (Pro for all except D9; free can unlock 24 h via rewarded ad).
- F13 Interactive chart: tap a planet/house/sign → explanation specific to this chart; long-press → glossary.
- F14 Vimshottari dasha: maha/antar/pratyantar tree with exact dates, "you are here" timeline, change notifications (Pro for pratyantar + alerts).
- F15 Sade Sati and Dhaiya tracker with phase dates; Ashtakavarga (BAV/SAV) with house strength; KP (Placidus cusps, sub-lords, significators, ruling planets) — Pro, rewarded-unlock for free.
- F16 Yogas detected (Pancha Mahapurusha, Gaja Kesari, Budhaditya, Raja/Dhana yogas, Kemadruma, Kala Sarpa …) with plain-language explanations and the rule shown.
- F17 Varshaphal (solar return) summary with a notification when the Vedic year begins.
- F18 Prashna mode: chart of the moment for a typed question, interpretation in plain language, saved as a question history.
- F19 Ayanamsa setting (Lahiri default; KP, Raman), node setting (mean default; true), house system for KP (Placidus).

### 3.4 Family dates and rituals
- F20 Tithi birthdays: computed Gregorian date each year for every profile; reminder evening before and morning of; "today is X's janma tithi" on Today.
- F21 Shraddha/barsi: death tithi per ancestor (name, month, paksha, tithi); yearly reminder; Pitru Paksha dates with the matching tithi day highlighted.
- F22 Vrat assistant: Ekadashi (with parana window), Pradosh, Sankashti Chaturthi (with moonrise), Masik Shivaratri, Purnima/Amavasya, Karwa Chauth (moonrise at location), Chhath (sunrise/sunset times), Teej, Navratri, Satyanarayan. Each with "what to do" text in 3 languages.
- F23 Festival calendar: at least the 60 most observed festivals per year for 3 years ahead, with tradition toggle (Purnimanta/Amanta, North/South variants), each verified against Drik Panchang before release.
- F24 Family Today: one screen with each member's Moon-based day note and the family's events.
- F25 Reminders: all computed and scheduled locally (no server); user controls cadence; quiet by default beyond the events the user enabled.

### 3.5 Timing and decisions
- F26 Muhurat finder: activities = griha pravesh, vehicle purchase, business start, job joining/interview, travel, naamkaran, mundan, engagement/roka, marriage (basic), property registration, new venture/launch, education start, medical procedure (non-emergency), vrat start. Inputs: date range, profile(s). Output: ranked windows with the rules that scored them (tithi, nakshatra, vara, Chandra bala, Tara bala, Rahu Kaal avoidance, Bhadra, Panchak, Abhijit bonus). Free: today + 7 days; Pro: any range; export .ics; save to Upcoming.
- F27 Daily Disha Shool and travel note; Panchak/Bhadra flags in the good-hours bar.
- F28 Naamkaran helper: suggested starting syllables from Moon nakshatra pada for a newborn profile, with a short name list per syllable in Devanagari + Latin.

### 3.6 Matching
- F29 Ashtakoota 36-guna matching between any two profiles or a profile and entered details: per-koota plain explanation, Nadi/Bhakoot dosha exceptions, Mangal dosha with cancellations shown, "beyond gun milan" section (7th house, Venus, Moon-sign relationship, dasha overlap). Free: scores + summary; Pro: full explanations + PDF.
- F30 Share-a-code: a profile can publish a 8-char code (Pro backup service optional) or a QR that encodes the minimal birth data needed for matching, so no birth details are typed by the other side; the receiving app computes locally.
- F31 Pandit-ready PDF (Janam Patri): traditional document with chart style of choice, panchang at birth, planet table, dasha table, avakahada chakra (varna, vashya, yoni, gana, nadi, nakshatra-charan, rashi, lagna), ghatak chakra, Mangal dosha statement; in the profile's PDF language; ₹99 one-time or included in Pro.

### 3.7 Learn and reflect
- F32 Jyotish literacy path: ≥20 lessons (5 min each) that use the user's own chart as the worked example; completing a lesson unlocks deeper "Why?" text, never commercial items.
- F33 Glossary: ≥150 terms, Devanagari + Latin + one-line meaning, linked from every "Why?".
- F34 Reflection journal: two-tap mood + optional note per day; monthly view overlays Moon house / dasha changes; wording "for reflection", never "proof".
- F35 "Ask my chart" (Pro): on-device Gemma 4 E2B via `expo-litert-lm` (MIT). Device gate: Android 12+, ≥6 GB RAM, ≥4 GB free storage; model (~2.6 GB) downloaded only on Wi-Fi after explicit consent with size shown; prompt = computed chart JSON + the corpus snippets relevant to the question + system rules (explain from the chart, cite the rule, never promise outcomes, never medical/legal/financial advice); every answer carries the label "AI explanation from your chart — can be wrong"; offline; unsupported devices see an honest message, not a cloud fallback.

### 3.8 Sharing and growth
- F36 Share cards (PNG via view-shot, shared with the system share sheet / WhatsApp): my kundli card, our 36-guna card, today's panchang card for a city, festival card. Each carries the app name and the web companion URL; no birth time on cards unless the user toggles it.
- F37 Deep links from the web companion into the app (profile code, festival, city panchang).

### 3.9 Monetisation (see §9 matrix)
- F38 AdMob via `react-native-google-mobile-ads`: native ad card in the Today stack below the fold; one anchored adaptive banner on secondary screens (never on Today above the fold, never on PDF/share/Learn-lesson screens); interstitial only on natural transitions, max 1 per session, never in the first 3 sessions, never on back navigation, 45 s minimum spacing; rewarded video for 24-h unlocks (user-initiated only); UMP consent flow for EEA/UK; test unit IDs in all non-release builds; 16 dp padding between any ad and any tappable control.
- F39 Pro via Google Play Billing: monthly ₹49, yearly ₹299, lifetime ₹999 (India); $2.99 / $19.99 / $49.99 elsewhere. Entitlement cached locally, restored via Play; grace period honoured; cancel/manage link visible in Settings. Pro = zero ad SDK calls (ads module not initialised).
- F40 One-time products: Janam Patri PDF ₹99, Matching report PDF ₹99, Varshaphal report ₹149.

### 3.10 Web companion (SEO)
- F41 Static site, same engine and corpus, three languages with `hreflang`, light default + persisted theme toggle, fluid wide layout (§8), Lighthouse mobile ≥90 on home/kundli/panchang.
- F42 Pages: home; kundli generator (client-side compute, shareable URL state, no server); panchang today for the 300 largest Indian cities + Kathmandu + 30 diaspora cities (pre-rendered monthly pages + client-side today); festival pages per festival per year for 3 years with `Event` structured data; muhurat pages per activity per month; glossary (≥150 terms) as individual pages; vrat pages; "download the app" CTA with Play link; privacy policy, terms, data-deletion page (needed for Play listing); 404.
- F43 SEO plumbing: sitemap.xml per language, robots.txt, canonical URLs, Open Graph images per page type (generated at build), JSON-LD (`Event`, `FAQPage`, `SoftwareApplication`), no client-side rendering for indexable text (compute-only widgets may hydrate).

## 4. Non-goals (v1)
iOS; accounts/social features; human astrologers; e-commerce; cloud LLM; tarot/numerology beyond naamkaran syllables; Western tropical mode (sidereal only; Western houses only inside KP); push notifications from a server; analytics SDKs beyond Play Console vitals.

## 5. Architecture

```
shubhvela/                 (one git repo, npm workspaces)
  packages/engine/         TypeScript: wraps a vendored fork of @prisri/jyotish (ISC) + astronomy-engine (MIT);
                           adds: festival rules table, muhurat scorer, transit-to-natal daily rules, tithi-event
                           recurrence, naamkaran syllables, gazetteer + tz lookup, PDF data model. No React.
  packages/content/        JSON corpus in en/hi/bho: snippets keyed by rule id, glossary, lessons, festivals,
                           vrats, muhurat activity rules, UI strings. Schema-validated; completeness test per language.
  packages/content-tools/  Build-time generators (Gemini Flash-Lite via OpenAI-compatible endpoint), review flags,
                           diff reports. Never shipped in the app.
  app/                     Expo (SDK ≥55, current stable at build time), TypeScript, expo-router, SQLite (expo-sqlite),
                           expo-notifications (local only), expo-print (PDF), react-native-view-shot + expo-sharing,
                           react-native-google-mobile-ads, expo-iap (or react-native-iap), expo-litert-lm,
                           expo-speech (TTS), native Android widgets (Kotlin, AppWidgetProvider; no expo prebuild
                           after first generation).
  web/                     Static site generator (Node build script → dist/, pattern from ai-batkahi), Playwright audits,
                           GitHub Pages via Actions.
  docs/                    Committed copies of spec/design/verification; owner runbooks.
```

Rules: engine and content are the single source of truth for both app and web (no duplicated rule tables); the engine exposes pure functions with explicit `Observer`, `Date`, ayanamsa and node options; all dates computed in UTC internally and rendered in the profile's zone.

Reference libraries (verified 2026-10-24): `@prisri/jyotish` 1.1.14 (ISC, dependency only `astronomy-engine ^2.1.19`) — vendor as a fork under `packages/engine/vendor/`, pin, and exclude its `predictions`/`gemstone` modules from the bundle. `expo-litert-lm` (MIT; Android 12+, Expo SDK 55+). Gemma 4 E2B `.litertlm` from the `litert-community` Hugging Face org (~2.6 GB; ~0.8 GB weights resident).

## 6. Engine validation (release gate, must pass before any APK is called "beta")

- Chart suite: 50 births (varied years 1940–2025, latitudes 8°–60°, both hemispheres of the IST line, 10 with unknown time) compared against two independent references (drikpanchang.com kundali and one of AstroSage/Prokerala): Lagna sign and degree within 0.25°, each planet within 0.1° (nodes within 0.5°), Moon nakshatra-pada exact, dasha balance within 1 day.
- Panchang suite: 30 dates (incl. tithi-skip and adhik-maas months) × 5 cities (Delhi, Patna, Mumbai, Chennai, London) vs Drik Panchang: sunrise/sunset within 1 min, tithi/nakshatra/yoga end times within 2 min, Rahu Kaal within 1 min, moonrise within 2 min.
- Festival suite: every festival in F23 for 2026, 2027, 2028 matches Drik Panchang's date for Delhi (Purnimanta) and Chennai (Amanta) or carries a documented, intentional convention difference.
- Matching suite: 20 pairs vs Drik Panchang/AstroSage guna totals exact; Mangal dosha and its cancellations match the stated rule set.
- Time-zone suite (F4).
- Suites run in CI (`npm test`) and their reference data is committed with source URLs and fetch dates.

## 7. Content corpus

Volumes (minimum, per language): planet×sign 108; planet×house 108; Lagna 12; Moon nakshatra×pada 108; yogas 40; dasha lord pairs 81 + 9 maha; transit-from-Moon for Saturn/Jupiter/Rahu 36 + Sade Sati phases 3; daily-note fragments (Tara bala 9, Chandra bala 12, tithi 30, nakshatra 27, vara 7, special yogas 10); koota explanations 8 × 3 levels; Mangal dosha 6 variants; muhurat activities 14 with rule text; festivals 60; vrats 12; lessons 20; glossary 150; UI strings (all).

Generation pipeline (build time only): Gemini `gemini-3.5-flash-lite` via the OpenAI-compatible endpoint, `response_format json_object`, `reasoning_effort low`, `max_tokens 8000`, fences stripped, first balanced `{…}` extracted, finish_reason `length` treated as an error; ≤450 requests/day (free quota ~500), 10–15 snippets per request; English first, then Hindi, then Bhojpuri; every snippet carries `review: "draft"` until a human flips it. Prompts forbid outcome guarantees, health/medical claims, fear language, gendered assumptions and commercial remedies; each snippet must name the rule it explains. Length guidance uses a midpoint with min/max and accepts ±40%.

Register rules: Hindi — respectful आप, standard Khari Boli, Sanskrit terms in Devanagari with a one-line gloss on first use. Bhojpuri — respectful standard register (रउआ; होला/करीं/बानी/नइखे), Devanagari, not Hindi-ised, not rustic slang, no Maithili forms; technical terms Latin on first mention. English — plain, no mysticism. Sudish reviews a sample of 50 Bhojpuri snippets per batch before the batch is marked reviewed.

## 8. UI specification

- Navigation: bottom tabs Today · Family · Charts · Learn; Settings behind the profile avatar; Pro screen reachable from the ad card's "remove ads" and from Settings.
- Visual language: calm almanac. Paper-white light theme, ink text, one saffron/vermilion accent, one deep indigo for night segments. The chart is the hero graphic. HARD NO: gradients, glow, neon, galaxy/nebula backgrounds, particles, AI orbs/sparkles, stock illustrations, emoji in chrome, heavy shadows, autoplay media, fake numbers.
- Type: Tiro Devanagari Hindi (display) + Noto Sans Devanagari (body) for hi/bho; a humanist sans for en; body 17–18 sp, floor 12 sp, chart labels ≥12 sp, tabular numerals for times; Hindi/Bhojpuri strings tested at +30% length.
- Controls 44 dp min; WCAG AA; large-text mode respected (no clipped layouts at 1.3× font scale); every stateful control shows its state in both themes; no two boxes intersect inside a card at 360/390/412 dp widths.
- Honesty markers: "approx." tag for unknown time / cusp cases; "how this was computed" footer on reports; "AI explanation — can be wrong" on F35 output; "for reflection" on F34.
- Web layout rules (binding, from Sudish's standing preferences): gutters `clamp(16px, 4vw, 96px)`; no container max-width below 2400 px; content box ≥88% of viewport at ≥1920; fluid type body ≈17–18 px on phones → ≈22 px at 2560; reading columns ≤75–80ch with side rails, grids 1/2/3/4 columns at 390/1024/1920/2560; no horizontal overflow 320–2560; light default + persisted toggle.
- Design step deliverable: static HTML mocks of Today, Charts, Family, Muhurat, Pro and the web home/kundli pages, screenshotted at 390 (app) and 390/1440/1920/2560 (web), sent to the orchestrator before design.md is written.

## 9. Freemium matrix (binding)

| Capability | Free (ads) | Pro |
|---|---|---|
| Kundli D1 + D9, planet table, dignities, yogas, current + next dasha | ✓ | ✓ |
| Today bar, daily note, panchang sheet, widgets, TTS | ✓ | ✓ |
| Profiles | 2 | unlimited |
| Tithi birthday / shraddha / vrat reminders | 5 | unlimited |
| Muhurat finder | today + 7 days | any range + .ics |
| Dasha | maha + antar | pratyantar + alerts |
| Matching | scores + summary | full explanations + PDF |
| D2–D60 (except D9), KP, Ashtakavarga, Prashna, Varshaphal | 24-h rewarded unlock | ✓ |
| Lessons, glossary, journal | ✓ | ✓ |
| Ask my chart (on-device) | — | ✓ |
| Janam Patri PDF | ₹99 | included |
| Ads | native + banner + capped interstitial + rewarded | none |

## 10. Privacy, policy and legal

- No account; all personal data in on-device SQLite; optional encrypted export/import file. DPDP Act 2023 + Rules 2025: consent notice at first launch (what is stored, where, how to delete), in-app delete-everything, grievance email, 72-h breach process documented (no server → scope is the app and the optional share-code service).
- Disclaimers (in 3 languages, in Settings and on every PDF): guidance for reflection; not medical, legal or financial advice; no outcome is guaranteed. Never link remedies to health (Drugs and Magic Remedies Act 1954).
- Play requirements: Data safety form (ads SDK data disclosed), privacy policy + data deletion URL on the web companion, target API per current Play policy, UMP consent, content rating questionnaire, "Astrology" category.
- AdMob hygiene: test IDs in dev, no ads near tap targets, caps as F38, second mediation network (AppLovin MAX) wired but disabled as a fallback.

## 11. Build, release and verification

- Expo app built locally with Gradle from the checked-in `android/` (generate once with `expo prebuild`, then never again; hand-written widgets live under `android/app/src/main/java`). Release keystore created for this app, `KEYSTORE-INFO.txt` gitignored, off-machine backup is an owner step. Versions bumped in `app.json` (expo.version + android.versionCode) and `android/app/build.gradle` together.
- Gates before any APK: `npm test` (engine suites §6, content completeness per language, UI unit tests), `tsc --noEmit`, lint, emulator screenshot audit (AVD `telusa_test`, x86_64 build) for every main screen in all 3 languages × 2 themes, APK badging and signature checks.
- Web gates: build, Playwright audit over every page type at 320/390/1440/1920/2560 × 2 themes (overflow, font floor, control sizes, content-box ratio, hreflang present), Lighthouse mobile ≥90.
- Secrets: Gemini key only as a local env var / GitHub secret for the corpus tool (`gh secret set`), never in the app. AdMob app ID and unit IDs in `app.json` extra (public by nature).
- Commit identity is handled by the global includeIf config; conventional prefixes `feat(F12): …`.

## 12. Internal phases (all inside v1; each ends with an installable APK and screenshots shown to the owner)

- **Phase A — Engine + corpus + core app**: F1–F8, F11, F13 (basic), F14 (maha/antar), F19, F20–F25, EN+HI+BHO UI, light/dark, validation suites. Output: APK A.
- **Phase B — Timing, matching, documents, money**: F12, F15–F17, F26–F31, F36, F38–F40, Pro screen. Output: APK B.
- **Phase C — Learn, AI, widgets, extras**: F9, F10, F18, F32–F35, F37. Output: APK C (release candidate).
- **Phase D — Web companion + SEO + Play kit**: F41–F43, store listing assets (icon, feature graphic, screenshots per language, Data safety answers), privacy/terms/deletion pages, release notes. Output: live site + Play-ready AAB.

Pacing rule: no silent document-polishing rounds; design review capped at 2 rounds and closed by orchestrator decision if it does not converge; code review loop per phase capped at 2, pause never abort; every ship step checks the verdict file first.

## 13. Owner steps (Sudish)

1. Confirm the name (Shubhvela or another from the checked list) → buy `.in` and `.com` the same day; `.app` optional.
2. Claim the Instagram handle by hand (cannot be checked programmatically).
3. Play Console: create the app listing (personal account is fine for Astrology; the org conversion in progress does not block it), create the subscription + one-time products with the prices in F39/F40, download the Play Billing public key.
4. AdMob: create the app, note the App ID and unit IDs (banner, native, interstitial, rewarded) — only after the APK B review, so no live units exist during development.
5. Gemini key as a GitHub Actions secret / local env var for the corpus generator (`gh secret set GEMINI_API_KEY --repo Sudish007/shubhvela`).
6. Review 50 Bhojpuri snippets per corpus batch; review festival dates list once.
7. Back up the release keystore off-machine.

## 14. Open items for the planner (decide and record in plan.md)

- Exact Expo SDK and React Native versions at build time; whether `expo-iap` or `react-native-iap` is current.
- Gazetteer size/compression (target ≤8 MB in the APK); diaspora city list.
- Widget refresh strategy vs Doze; WorkManager vs AlarmManager for segment-boundary updates.
- Whether share-codes need the optional Supabase service in v1 or can be fully offline via QR (prefer offline-first; Supabase free tier auto-pauses when idle).
- OG-image generation approach for the web (build-time rendering with Playwright vs SVG templates).
