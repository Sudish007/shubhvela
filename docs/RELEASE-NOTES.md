# Shubhvela release notes

Internal builds. APKs are local, gitignored outputs of `scripts/build-apk.ps1` (see `release/README.md`); the tags mark the source tree of each build.

## 1.0.0 (versionCode 4) — Phase D release — version set 2026-10-30 by D04; AAB and APKs built by d-ship

Play-facing notes (≤ 500 chars, en/hi/bho): `app/playstore-assets/release-notes/1.0.0.<lang>.md`. Added since 0.3.1:

- Web companion live at https://sudish007.github.io/shubhvela/ (kundli, panchang for 331 cities, festivals, muhurat months, glossary,
  vrats; privacy, terms and data-deletion pages) in English, Hindi and Bhojpuri.
- Hindi and Bhojpuri corpus complete: all 18 in-scope domains, 1,434 records per language (translation run finished 2026-10-30 07:00 IST,
  last commit `ed75e64`; `docs/CONTENT-TRANSLATION.md`). No corpus domain falls back to English any more; `naamkaran-names` (name lists,
  already Devanagari + Latin) stays English by decision. Every translated record is `review: "draft"` until the owner's Bhojpuri review.
- Brand: launcher icon, adaptive layers, splash, Play icon and feature graphic from `app/brand/`.
- Play listing kit, breach process, third-party notices, owner runbook.
- d-ship fixes on the release tree (2026-10-30): privacy page / consent notice / Settings → Privacy disclose the Pro "Ask my chart" model
  download from Hugging Face (`a12e8f3`); the Yogas card and sheet print the translated rule sentence in Hindi/Bhojpuri (`518a9f3`);
  the chart's centre lines use the Devanagari body face so "मध्यम राहु" no longer renders as "म्ध्यम राहु" (`303e3c9`).
- East Indian chart follows the Bengali/Odia convention: fixed signs (Mesha always top-centre, anticlockwise), houses counted
  from the Lagna, Lagna cell marked (accent numeral + underline). Earlier builds drew it house-fixed (orchestrator finding
  D-SHIP-1, fixed by d-ship). North and South styles unchanged. The web kundli page shares the layout and is redeployed.
- Fixed by d-fix before the review: small-widget reason filter, exact-alarm copy (10 minutes on Android 12+), TTS error settings link,
  widget picker labels/previews, journal mood marks, "From a link" label.

**Device support.** `release/Shubhvela-1.0.0.aab` carries all four ABIs (armeabi-v7a, arm64-v8a, x86, x86_64); Play serves the
matching split per device, including x86_64 Chromebooks and emulators. The emulator APK (`Shubhvela-1.0.0-x86_64.apk`) is a
separate screenshot-mode build and is not uploaded.

Known issues carried into 1.0.0: six Yoni koota pairs differ from Drik by one point under the documented convention
(`reference/CONVENTIONS.md` §3, owner item 6); level-2 "Why?" text exists only for the koota domain; grievance address provisional;
festival web pages print the convention id in Latin (post-1.0 web fix).

## 0.3.1 (versionCode 4, superseded by 1.0.0 before any upload) — DEV-1 hotfix — 2026-10-29

Tab bar / bottom chrome cleared of the system navigation bar in both navigation modes (c06, `release/Shubhvela-0.3.1-arm64.apk`).

## 0.3.0 (versionCode 3) — Phase C release candidate — 2026-10-29 — tag `v0.3.0-phase-c`

Added since 0.2.0:

- Home-screen widgets (small 2×1 verdict, medium 4×2 good-hours band with the Now line and the next family date), refreshed by WorkManager and a
  boundary alarm; "Add widget to home screen" and "Exact widget updates" rows in Settings → Notifications.
- Listen (text-to-speech) on the daily note; Bhojpuri reads in the Hindi voice with a one-time notice.
- Prashna (ask a question now) with history; Learn tab with 21 lessons, the glossary (264 terms) and the reflection journal.
- "Ask my chart" (on-device Gemma, Pro) with the honest device gate; no cloud fallback.
- Encrypted backup and restore (AES-256-GCM, PBKDF2 600,000); deep links `shubhvela://festival|kundli|m|panchang`.
- Footers "How this was computed" name the node mode once; third-person daily notes for family members.

Known issues:

- **DEV-1 — tab bar can be covered by the system navigation bar on some devices; fixed in the next build.** Reported by the owner from a real phone
  (3-button navigation suspected); the emulator with gesture navigation does not show it.
- Interpretive text is English under Hindi/Bhojpuri chrome until the Hindi corpus is generated (`GEMINI_API_KEY` not set).
- Matching: six Yoni koota pairs differ from Drik by one point under the documented convention (`reference/CONVENTIONS.md`), Phase D gate.
- Small widget may name a reason that is not yet active; the "Exact widget updates" copy says 2 minutes where Android 12+ gives 10 (Phase D fixes).

Not verified on hardware: Gemma inference and the supported-device gate path, multi-day Doze, the exact-alarm grant, live purchases, real ads.

## 0.2.0 (versionCode 2) — Phase B — 2026-10-28 — tag `v0.2.0-phase-b`

Timing, matching, documents and money: Muhurat finder, Ashtakavarga, KP, Varshaphal, Vargas, Naamkaran, Kundli matching with share codes, Janam Patri /
matching / Varshaphal PDFs, share cards, Pro screen with Play Billing (test), AdMob test units with UMP consent.

## 0.1.0 (versionCode 1) — Phase A — 2026-10-26 — tag `v0.1.0-phase-a`

Engine, corpus and core app: profiles, Today (panchang, good hours, daily note), Family, Charts (D1 in three styles, dashas, yogas), festivals and
tithi reminders, English/Hindi/Bhojpuri UI, light/dark themes.
