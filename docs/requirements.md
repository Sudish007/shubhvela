# Shubhvela v1 — requirements (restated from spec.md, no additions)

Status: design-step companion to `design.md` (round 2), 2026-10-24. This file restates, one line per feature, the acceptance test the reviewer must run (spec section 3) and the freemium tier (spec section 9). It adds no requirement and re-opens no owner decision (spec section 0, D1–D12); the round-1 review findings changed the design, not these requirements (where the spec's wording is itself the requirement — e.g. F30 "8-char code", F14 "change notifications" — the tier and mechanism decisions are recorded in `design.md` 10.3 and 10.6). Where section 3 says "Explains", the test is: a tappable "Why?" shows the rule, the inputs used and, where applicable, the classical source name.

## Summary

Android-only (Expo) Vedic almanac app in English, Hindi and Bhojpuri with an SEO web companion on GitHub Pages; freemium (free tier with AdMob ads, Pro removes all ads and unlocks the Pro column), one-time report purchases in both tiers; no human astrologers, no remedy commerce, no account, all computation on-device, no cloud LLM; light theme first paint with a persisted System/Light/Dark toggle. Everything in F1–F43 ships in v1 (phased A–D internally).

## Functional requirements and acceptance tests

### Onboarding and profiles
- **F1** Start without an account: date, time (with "I don't know" / "approximately"), place (offline bundled gazetteer; online Nominatim fallback), optional gender and name. Test: first value (Moon sign, nakshatra, today's note) visible within 10 s of install. Tier: free and Pro.
- **F2** Unknown birth time → Moon-chart mode; approximate time → confidence tags on Lagna and on any planet within 1° of a sign boundary; Prashna mode offered. Test: enter an unknown time and an approximate time and observe the mode switch and the tags. Tier: free and Pro.
- **F3** Profiles: self + family members, each with relationship label, tradition (Purnimanta/Amanta) and PDF language. Test: add members and set each field. Tier: free 2 profiles, Pro unlimited.
- **F4** Historical IANA time zones (India 1942–45 war time, Nepal, Gulf, UK/US DST), never the device offset. Test: births in Delhi 1944, Kathmandu 1990, Dubai 2005, London 1988 match reference calculators. Tier: free and Pro.

### Today (home)
- **F5** Good-hours bar: one horizontal day timeline at the profile's current location (GPS or chosen city) with sunrise/sunset/moonrise, Brahma muhurat, Abhijit, Rahu Kaal, Yamaganda, Gulika, Choghadiya, planetary Hora and a current-time marker; explains each segment. Test: every segment has a working "Why?". Tier: free and Pro.
- **F6** Personal daily note (3–5 sentences) from transit-to-natal rules: Chandra bala incl. Chandrashtama, Tara bala, day's tithi/nakshatra/yoga, Sade Sati/Dhaiya state, current maha/antar lords' day-strength. Test: every sentence has "Why?". Tier: free and Pro.
- **F7** Upcoming strip: next family tithi event, next vrat, next saved muhurat, next dasha change, next major transit (Saturn/Jupiter/Rahu-Ketu sign change). Test: each item present and tappable. Tier: free and Pro.
- **F8** Panchang detail sheet: tithi, nakshatra, yoga, karana with end times, Vikram Samvat, Shaka, Hindu month (both systems), ritu, ayana, sun/moon rashi, moonrise/moonset. Test: all fields shown for the chosen city and date. Tier: free and Pro.
- **F9** Android home-screen widgets: small (good-hours summary) and medium (good-hours bar + next event), updated at least hourly and at segment boundaries. Test: place both widgets, observe updates. Tier: free and Pro.
- **F10** Daily note read-aloud (TTS) in the UI language. Test: tap Listen in each language. Tier: free and Pro.

### Charts
- **F11** Kundli: D1 in North, South and East Indian styles (user setting); planet table with sign, degree, nakshatra-pada, dignity (exalted/debilitated/own/friend/enemy, combust, retrograde, vargottama); house lords; Lagna, Moon and Sun charts; Bhava Chalit. Test: switch styles and verify every table column and chart variant. Tier: D1 + planet table + dignities free and Pro.
- **F12** Divisional charts D2, D3, D4, D7, D9, D10, D12, D16, D20, D24, D27, D30, D40, D45, D60. Test: each renders. Tier: D9 free; others Pro, or 24-h unlock via rewarded ad on free.
- **F13** Interactive chart: tap a planet/house/sign → explanation specific to this chart; long-press → glossary. Test: both gestures on each element type. Tier: free and Pro.
- **F14** Vimshottari dasha: maha/antar/pratyantar tree with exact dates, "you are here" timeline, change notifications. Test: tree dates match reference; notification scheduled at the next change. Tier: maha + antar free; pratyantar + alerts Pro.
- **F15** Sade Sati and Dhaiya tracker with phase dates; Ashtakavarga (BAV/SAV) with house strength; KP (Placidus cusps, sub-lords, significators, ruling planets). Test: each screen renders with dates/values. Tier: Pro, rewarded 24-h unlock on free (Sade Sati card itself is part of the free daily note state).
- **F16** Yogas detected (Pancha Mahapurusha, Gaja Kesari, Budhaditya, Raja/Dhana yogas, Kemadruma, Kala Sarpa …) with plain-language explanations and the rule shown. Test: a chart with known yogas lists them with rules. Tier: free and Pro.
- **F17** Varshaphal (solar return) summary with a notification when the Vedic year begins. Test: summary renders; notification scheduled. Tier: Pro, rewarded 24-h unlock on free.
- **F18** Prashna mode: chart of the moment for a typed question, plain-language interpretation, saved question history. Test: ask, read, find in history. Tier: Pro, rewarded 24-h unlock on free.
- **F19** Settings: ayanamsa (Lahiri default; KP, Raman), node (mean default; true), KP house system Placidus. Test: change each and see recomputed values. Tier: free and Pro.

### Family dates and rituals
- **F20** Tithi birthdays: computed Gregorian date each year per profile; reminders the evening before and the morning of; "today is X's janma tithi" on Today. Test: add a profile, see next date and both reminders; on the day, see the Today row. Tier: reminders count toward free cap of 5, Pro unlimited.
- **F21** Shraddha/barsi per ancestor (name, month, paksha, tithi); yearly reminder; Pitru Paksha dates with the matching tithi day highlighted. Test: add an ancestor, see barsi date, Pitru Paksha day highlighted. Tier: free cap of 5 reminders, Pro unlimited.
- **F22** Vrat assistant: Ekadashi (parana window), Pradosh, Sankashti Chaturthi (moonrise), Masik Shivaratri, Purnima/Amavasya, Karwa Chauth (moonrise at location), Chhath (sunrise/sunset), Teej, Navratri, Satyanarayan; each with "what to do" in 3 languages. Test: each vrat shows its timing and text in all languages. Tier: free cap of 5 reminders, Pro unlimited.
- **F23** Festival calendar: ≥60 most observed festivals per year for 3 years ahead with tradition toggle (Purnimanta/Amanta, North/South); each verified against Drik Panchang before release. Test: dates for 2026–2028 match Drik Panchang for Delhi and Chennai or carry a documented convention difference. Tier: free and Pro.
- **F24** Family Today: one screen with each member's Moon-based day note and the family's events. Test: every profile has a note with "Why?". Tier: free and Pro.
- **F25** Reminders computed and scheduled locally (no server); user controls cadence; quiet by default beyond enabled events. Test: airplane mode still fires reminders; defaults produce no un-asked notifications. Tier: free 5 enabled reminders, Pro unlimited.

### Timing and decisions
- **F26** Muhurat finder for griha pravesh, vehicle purchase, business start, job joining/interview, travel, naamkaran, mundan, engagement/roka, marriage (basic), property registration, new venture/launch, education start, medical procedure (non-emergency), vrat start; inputs date range and profile(s); output ranked windows with the rules that scored them (tithi, nakshatra, vara, Chandra bala, Tara bala, Rahu Kaal avoidance, Bhadra, Panchak, Abhijit bonus); save to Upcoming. Test: each activity returns ranked windows with rule breakdown. Tier: free today + 7 days; Pro any range + .ics export.
- **F27** Daily Disha Shool and travel note; Panchak/Bhadra flags in the good-hours bar. Test: flags visible on a Panchak/Bhadra day; travel note matches weekday. Tier: free and Pro.
- **F28** Naamkaran helper: starting syllables from Moon nakshatra pada for a newborn profile with a short name list per syllable in Devanagari + Latin. Test: newborn profile shows the pada's syllables and names. Tier: free and Pro.

### Matching
- **F29** Ashtakoota 36-guna matching between two profiles or a profile and entered details: per-koota plain explanation, Nadi/Bhakoot dosha exceptions, Mangal dosha with cancellations, "beyond gun milan" (7th house, Venus, Moon-sign relationship, dasha overlap). Test: totals match reference for the matching suite; cancellations listed. Tier: free scores + summary; Pro full explanations + PDF.
- **F30** Share-a-code: a profile publishes an 8-char code (optional Pro backup service) or a QR encoding the minimal birth data for matching; the receiving app computes locally. Test: scan/enter a code on a second device and match without typing birth details. Tier: free and Pro (relay service optional, Pro).
- **F31** Pandit-ready Janam Patri PDF: chart style of choice, panchang at birth, planet table, dasha table, avakahada chakra (varna, vashya, yoni, gana, nadi, nakshatra-charan, rashi, lagna), ghatak chakra, Mangal dosha statement; in the profile's PDF language. Test: PDF opens with every section in each language. Tier: ₹99 one-time on free; included in Pro.

### Learn and reflect
- **F32** Jyotish literacy path: ≥20 lessons (5 min each) using the user's own chart as the worked example; completing a lesson unlocks deeper "Why?" text, never commercial items. Test: count lessons; complete one and see deeper text. Tier: free and Pro.
- **F33** Glossary: ≥150 terms with Devanagari + Latin + one-line meaning, linked from every "Why?". Test: count terms; follow a link from a "Why?" sheet. Tier: free and Pro.
- **F34** Reflection journal: two-tap mood + optional note per day; monthly view overlays Moon house / dasha changes; wording "for reflection", never "proof". Test: log an entry in two taps; see the overlay and the wording. Tier: free and Pro.
- **F35** "Ask my chart": on-device Gemma 4 E2B via expo-litert-lm; device gate Android 12+, ≥6 GB RAM, ≥4 GB free; model (~2.6 GB) downloaded only on Wi-Fi after explicit consent with size shown; prompt = chart JSON + relevant corpus snippets + system rules; every answer labelled "AI explanation from your chart — can be wrong"; offline; unsupported devices see an honest message, no cloud fallback. Test: gate message on an unsupported device; consent → download → labelled answer on a supported one. Tier: Pro only.

### Sharing and growth
- **F36** Share cards (PNG via view-shot, system share sheet): my kundli card, our 36-guna card, today's panchang card for a city, festival card; each carries the app name and web URL; no birth time unless toggled. Test: produce all four and check the toggle. Tier: free and Pro.
- **F37** Deep links from the web companion into the app (profile code, festival, city panchang). Test: each link type opens the right screen. Tier: free and Pro.

### Monetisation
- **F38** AdMob via react-native-google-mobile-ads: native ad card in the Today stack below the fold; one anchored adaptive banner on secondary screens (never on Today above the fold, PDF/share/Learn-lesson screens); interstitial only on natural transitions, max 1 per session, never in the first 3 sessions, never on back navigation, 45 s minimum spacing; rewarded video for 24-h unlocks (user-initiated only); UMP consent for EEA/UK; test unit IDs in all non-release builds; 16 dp between any ad and any tappable control. Test: verify each placement and cap in a debug build. Tier: free only; Pro = zero ad SDK calls.
- **F39** Pro via Google Play Billing: monthly ₹49, yearly ₹299, lifetime ₹999 (India); $2.99 / $19.99 / $49.99 elsewhere; entitlement cached locally and restored via Play; grace period honoured; cancel/manage link visible in Settings; Pro = ads module not initialised. Test: purchase in the test track, restore on reinstall, confirm no ad SDK initialisation. Tier: defines Pro.
- **F40** One-time products: Janam Patri PDF ₹99, Matching report PDF ₹99, Varshaphal report ₹149. Test: each purchasable and delivered; Janam Patri included for Pro. Tier: both tiers (Janam Patri included in Pro).

### Web companion (SEO)
- **F41** Static site, same engine and corpus, three languages with hreflang, light default + persisted theme toggle, fluid wide layout per spec section 8, Lighthouse mobile ≥90 on home/kundli/panchang. Test: Lighthouse and the layout audit at 320/390/1440/1920/2560. Tier: n/a (public).
- **F42** Pages: home; kundli generator (client-side compute, shareable URL state, no server); panchang today for the 300 largest Indian cities + Kathmandu + 30 diaspora cities (pre-rendered monthly pages + client-side today); festival pages per festival per year for 3 years with `Event` structured data; muhurat pages per activity per month; glossary (≥150 terms) as individual pages; vrat pages; "download the app" CTA with Play link; privacy policy, terms, data-deletion page; 404. Test: fetch every page type on the live site. Tier: n/a.
- **F43** SEO plumbing: sitemap.xml per language, robots.txt, canonical URLs, Open Graph images per page type (generated at build), JSON-LD (`Event`, `FAQPage`, `SoftwareApplication`), no client-side rendering for indexable text (compute-only widgets may hydrate). Test: validate sitemaps, robots, canonical/hreflang, OG and JSON-LD on each page type. Tier: n/a.

## Freemium matrix (spec section 9, binding)

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

## Non-functional requirements (restated)

Engine validation suites of spec section 6 are the release gate; UI rules of spec section 8 (type, 44 dp, WCAG AA, 1.3x font scale, no intersecting boxes at 360/390/412, HARD NO list, web layout rules) apply to every screen and page; privacy/compliance of spec section 10 (DPDP consent notice, delete-everything, disclaimers in three languages, Play Data safety, UMP); build gates of spec section 11.

## Out of scope (spec section 4)

iOS; accounts/social features; human astrologers; e-commerce; cloud LLM; tarot/numerology beyond naamkaran syllables; Western tropical mode; server push notifications; analytics SDKs beyond Play Console vitals.
