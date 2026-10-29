# Shubhvela release notes

Internal builds. APKs are local, gitignored outputs of `scripts/build-apk.ps1` (see `release/README.md`); the tags mark the source tree of each build.

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
