# Owner steps (Sudish) — nothing in the build waits on these

Created in A01 from plan.md section 13; refreshed at the end of every phase; **final form written by D04 (2026-10-30,
release 1.0.0 / versionCode 4)**. Each item says when it is needed, what the build does meanwhile, and its status.
The Play Console walk-through with every form location is `docs/PLAY-RELEASE-CHECKLIST.md`; the texts and answers to
paste are in `app/playstore-assets/store-listing.md`.

## Status at a glance (2026-10-30)

| # | Item | Needed by | Status |
|---|---|---|---|
| 1 | Name + domains (+ N17 alternative) | before the first Play upload | **open** — nothing blocks on it; the user-pages alternative is below |
| 2 | Instagram handle | launch marketing | **open** |
| 3 | Play Console listing + products + licence testers + AAB upload | to publish | **open** — everything to paste is ready |
| 4 | AdMob app + unit ids (+ app-ads.txt) | before the public release; test units until then | **open** |
| 5 | `GEMINI_API_KEY` secret | no longer needed for the corpus | **superseded** — a separate translation run wrote hi/bho for all 18 in-scope domains (1,434 records per language) without the Action; `gh secret list` was still empty on 2026-10-30 |
| 6 | Bhojpuri review (UI strings, corpus, festival names) | before calling the Bhojpuri listing "reviewed" | **open** |
| 7 | Keystore off-machine backup | **now** | **open** — do this today |
| 8 | Grievance e-mail | before publishing (Play requires a working address) | **open** — placeholder `grievance@shubhvela.in` in 5 places |
| 9 | Share-code relay | deferred, optional | **deferred** |
| 10 | Disk headroom | before d-ship's 4-ABI AAB build | check `(Get-PSDrive C).Free` ≥ 4 GB |
| 11 | Post-1.0 fixes | after the Phase D review | list below, appended by the reviewer |

## The items

1. **Name and domains.** Confirm "Shubhvela" (शुभवेला). It must be final before the first Play upload: the Android
   `applicationId com.shubhvela.app` cannot change afterwards. Buy `shubhvela.in` and `shubhvela.com` the same day
   (`.app` optional). Later: custom domain → GitHub Pages CNAME (`web/public/CNAME` + `web/src/config.mjs` BASE_URL /
   BASE_PATH `/`) + `/.well-known/assetlinks.json` for verified App Links.
   **Alternative without a domain (N17):** create the user-pages repo `Sudish007/Sudish007.github.io` (public, with a
   `.nojekyll` file) and put `/.well-known/assetlinks.json` at its root — user pages serve the origin
   `https://sudish007.github.io/`, which is where Android looks for App Links for every `sudish007.github.io/...` URL,
   including `/shubhvela/`. Contents: one entry with `relation ["delegate_permission/common.handle_all_urls"]`,
   `package_name "com.shubhvela.app"` and the SHA-256 of the **app signing** certificate from Play Console → Setup → App
   signing (not the upload key). Then add an `autoVerify="true"` https intent filter for host `sudish007.github.io`
   and `pathPrefix /shubhvela/` to `app/android/app/src/main/AndroidManifest.xml` (one-time app change, next build),
   and verify once on a test phone with `adb shell pm get-app-links com.shubhvela.app`. *Meanwhile:* the site uses
   `intent://` buttons with a Play fallback (M9), which work without verification.
2. **Instagram.** Claim the handle by hand (not scriptable).
3. **Play Console.** Create the app (category **Lifestyle**, tag Astrology — Play has no Astrology category; a personal
   account is fine). Paste title / short / full descriptions (en-IN, hi-IN), upload `app/playstore-assets/icon-512.png`,
   `feature-graphic-1024x500.png` and `screenshots/en|hi/*.png` (only after d-ship has re-shot the 21 stand-in slots —
   `screenshots/sources.json` must show no `pending: true`). Answer Data safety, content rating, target audience (18+),
   ads declaration and the account-deletion declaration from `store-listing.md`. Create subscription `shubhvela_pro`
   (base plans `monthly` ₹49 / `yearly` ₹299; $2.99 / $19.99 elsewhere), in-app product `shubhvela_pro_lifetime` ₹999 /
   $49.99, consumables `report_janam_patri` ₹99, `report_matching` ₹99, `report_varshaphal` ₹149. Add licence-tester
   accounts (Settings → Licence testing), upload `release/Shubhvela-1.0.0.aab` (built by d-ship) to the internal
   testing track, follow the tester script in `store-listing.md` → "Licence testers and the test track". Paste the Play
   Store URL into `web/src/strings/{en,hi,bho}.json` (`site.playUrl`) and `app/app.json` (`extra.playUrl`); the site's
   "Coming to Google Play" buttons and the JSON-LD `installUrl` switch automatically on the next Pages build.
   *Meanwhile:* the app reads prices from Play and shows the spec INR strings offline ("store price may differ"); until
   the products exist, "Continue" on the Pro screen shows Play's "item not available" inline and the entitlement cache
   stays untouched. The product ids the app requests are fixed in `app/src/billing/products.ts`.
4. **AdMob.** Create the app in AdMob, note the App ID and the four unit IDs (banner, native, interstitial, rewarded).
   Edit `app/app.json` `extra.admob` (set `live: true`, fill the ids) and the `com.google.android.gms.ads.APPLICATION_ID`
   meta-data in `app/android/app/src/main/AndroidManifest.xml`; rebuild. Do NOT create an AppLovin mediation group
   (the adapter is wired but disabled); `applovinSdkKey` stays empty. Publish `app-ads.txt` from AdMob's snippet at
   `web/public/app-ads.txt` (served at `https://sudish007.github.io/shubhvela/app-ads.txt`; the Play listing's website
   field must point at `https://sudish007.github.io/shubhvela/` for AdMob to find it). Verify in AdMob → Apps → app-ads.txt.
   *Meanwhile:* every build uses Google's test IDs (`app/src/ads/config.ts` falls back whenever `live` is false or any
   id is missing); Pro never initialises the SDK (`app/test/ads-root.test.tsx`).
5. **Gemini key — superseded.** The corpus-translate Action was never run (`gh secret list --repo Sudish007/shubhvela`
   empty on 2026-10-30). A separate translation run (finished 2026-10-30 07:00 IST, last commit `ed75e64`) committed
   `packages/content/corpus/<domain>/hi.json` and `bho.json` for all 18 in-scope domains: 1,434 records per language,
   0 gaps, enforced by `packages/content/test/translations.test.ts`; `naamkaran-names` stays English by decision
   (details and register rules in `docs/CONTENT-TRANSLATION.md`). Every record is `review: "draft"` until item 6.
   Nothing left for you to do here; the Action remains only as an optional second path.
6. **Bhojpuri review.** `packages/content/ui/bho.json` (UI strings written by the build, including बचीं for "Avoid", the
   possessive राउर and the respectful रउआ / होला / करीं / बानी / नइखे register; tests enforce Devanagari, no Hindi
   आप/है and no Maithili forms, but naturalness needs a native reader), the Bhojpuri festival names in
   `packages/engine/data/festival-rules.json` (`names.bho`), the translated corpus files `corpus/*/bho.json` (all marked
   `review: "draft"`), the Play texts in `app/playstore-assets/store-listing.md` (bho blocks; Play has no Bhojpuri
   listing locale, so they are for the website and later) and `release-notes/1.0.0.bho.md`. Also review the festival
   rules once: `packages/engine/data/festival-rules.json` and `packages/engine/reference/CONVENTIONS.md`, including the
   six `koota-yoni@mXX` matching conventions (C-REVIEW-MEDIUM-6: Drik's five-level Yoni table was not sourced; record
   your acceptance of the convention there or supply the table).
7. **Keystore backup.** Copy `release/shubhvela-release.keystore` and `release/KEYSTORE-INFO.txt` (both gitignored,
   created 2026-10-24) to an off-machine encrypted location. Losing them means a new upload key (recoverable through
   Play App Signing's upload-key reset, but only once the app is enrolled — upload the first AAB soon after the backup).
   The breach process (`docs/BREACH-PROCESS.md` §4.1 B1) depends on this copy.
8. **Grievance contact.** Provide the e-mail for the privacy page, consent notice, Play listing and breach process.
   Placeholder until then: `grievance@shubhvela.in`; the consent notice and Settings → Privacy label it "provisional".
   When the address is final, on the same day: `app/src/legal.ts` (`GRIEVANCE_EMAIL_PLACEHOLDER`, flip
   `GRIEVANCE_EMAIL_CONFIRMED` to `true`), `web/src/strings/{en,hi,bho}.json` (`site.grievanceEmail`; the provisional
   note disappears when the string changes — check `site.grievanceProvisional` usage), `app/playstore-assets/store-listing.md`,
   `docs/BREACH-PROCESS.md`, Play Console → Store listing → Contact details. Play rejects listings with a non-working
   address, so this must precede item 3's publish step. The privacy, terms and data-deletion pages are live at
   `https://sudish007.github.io/shubhvela/<lang>/privacy/`, `/terms/`, `/data-deletion/` (HTTP 200 on 2026-10-30).
9. **Share-code relay (deferred).** v1 ships QR + a 20-character typed code, fully offline. Decide later whether a Pro
   8-character relay service is wanted; if yes, `docs/BREACH-PROCESS.md` must be rewritten first (it assumes no server).
10. **Disk.** Keep at least 4 GB free on C: before d-ship's 4-ABI `bundleRelease` (8 GB is comfortable). Candidates:
    `~/.gradle/caches` (~4 GB, rebuilds itself) and `%LOCALAPPDATA%\ms-playwright` (~1.4 GB, needed by the web audits).
11. **Post-1.0 fixes** carried from the Phase D review (appended by the reviewer below). Already known before the review:
    - Re-shoot the 21 stand-in Play screenshots raw (d-ship; `scripts/shots.ps1 -KeepRaw`, pro=1 seed, light, en/hi/bho).
    - ~~Translate the four remaining corpus domains~~ — done 2026-10-30 (item 5: 18/18 domains).
    - C-REVIEW items closed by d-fix (2026-10-30, commits `0d3f94c`, `e0f4c0b`, `9501b8b`): C-M1 small-widget reason
      filter, C-M2 `settings.exactAlarmsBody` "10 minutes" wording, C-M3 TTS error "Open TTS settings" link, C-N1 widget
      picker labels + previews, C-N2 journal mood marks, C-N3 widget hora word, C-N4 "From a link" label. Still open:
      C-M4 level-2 "Why?" snippets (content authoring); B-N1 Devanagari place names (`name_hi`); B-N7 muhurat finder
      location mode; A-N3 Sheetala Ashtami 2028 rule. Full list: `docs/verification/carry-over.md`.
    - Notification icon source in `app/app.json` points at the adaptive monochrome layer; harmless while `android/` is
      committed, but add a dedicated 96×96 source under `app/assets/` before anyone runs a prebuild (brand review note).

## Status after Phase A (shipped 2026-10-26, tag `v0.1.0-phase-a`)

- Built and signed (local, gitignored): `release/Shubhvela-0.1.0-arm64.apk` (device, 90.3 MB) and
  `release/Shubhvela-0.1.0-x86_64.apk` (emulator, screenshot mode, 100.6 MB). Not run on a real phone.
- Details in `docs/verification/verification-phase-a.md`; Phase B picked up `carry-over.md`.

## Status after Phase B (shipped 2026-10-28, tag `v0.2.0-phase-b`)

- Built and signed (local, gitignored): `release/Shubhvela-0.2.0-arm64.apk` (93.7 MB) and `release/Shubhvela-0.2.0-x86_64.apk`
  (104.0 MB). Review verdict APPROVED (0 blocking); details in `docs/verification/verification-phase-b.md` and `review-phase-b.md`.
- Not verified in Phase B (needs you or a device): live purchases/restore, real ad fill and the native ad card on a phone with Play,
  cross-device share-code scan.

## Status after Phase C (shipped 2026-10-29, tag `v0.3.0-phase-c`, release candidate)

- Built and signed (local, gitignored): `release/Shubhvela-0.3.0-arm64.apk` (94.6 MB) and `release/Shubhvela-0.3.0-x86_64.apk`
  (105.0 MB). Review verdict APPROVED (0 blocking, 6 medium, 7 nit); details in `docs/verification/verification-phase-c.md`,
  `review-phase-c.md`, `docs/RELEASE-NOTES.md`.
- **DEV-1 (your report from a real phone: tab bar hidden behind the system navigation bar)** was fixed by c06 (commits `a2843b0`,
  `d0dcb0b`): hotfix build `release/Shubhvela-0.3.1-arm64.apk` (versionCode 4) is on this PC for you to re-test; your confirmation
  is the remaining acceptance. Report any further device findings the same way (appended as DEV-2, DEV-3 … in `carry-over.md`).
- Not verified in Phase C (emulator only): Gemma inference and the supported-device "Ask my chart" path, multi-day Doze/WorkManager
  behaviour of the widgets, a real exact-alarm grant, Hindi/Bhojpuri TTS voices, live purchases, real ads.

## Status at D04 (2026-10-30, version 1.0.0 / versionCode 4 set; AAB not yet built)

- Web companion live at https://sudish007.github.io/shubhvela/ (D01–D03: 28 page types × 3 languages, Lighthouse 100/100/100/100
  on four pages, live check 28/28). Privacy / terms / data-deletion pages are the URLs in the Play listing.
- Play listing kit complete except graphics re-shoot: `app/playstore-assets/store-listing.md` (texts en/hi/bho, Data safety,
  content rating, products, tester script), `release-notes/1.0.0.{en,hi,bho}.md`, icon + feature graphic + 24 screenshots from the
  brand run (21 slots pending the raw re-shoot by d-ship). `node scripts/gen-store-assets.mjs --check` exits 0.
- `docs/BREACH-PROCESS.md` written (N14). `THIRD-PARTY-NOTICES.md` regenerated from `npm ls --prod` (775 packages).
- d-ship still has to: pull the newest translations, build `release/Shubhvela-1.0.0.aab` (4 ABIs) + arm64/x86_64 APKs, re-shoot
  the Play screenshots, run the emulator audit in both navigation modes, tag `v1.0.0`.
- Open for you, in order of urgency: 7 (keystore backup), 8 (grievance e-mail), 3 (Play Console), 4 (AdMob), 1 (name/domains or
  the N17 user-pages repo), 6 (Bhojpuri review), 2 (Instagram).

## Status after Phase D (shipped 2026-10-31, tag `v1.0.0`, release 1.0.0 / versionCode 4)

- Built and signed (local, gitignored): **`release/Shubhvela-1.0.0.aab` (179.0 MB, four ABIs armeabi-v7a/arm64-v8a/x86/x86_64 — upload
  this to the internal testing track)**, `release/Shubhvela-1.0.0-arm64.apk` (95.9 MB, install this on your phone to confirm DEV-1),
  `release/Shubhvela-1.0.0-x86_64.apk` (106.3 MB, emulator/screenshot build). jarsigner `jar verified` on the AAB; apksigner v2 on the APKs.
- Play kit ready: 24 store screenshots re-shot from the 1.0.0 build (0 pending), icon + feature graphic, `store-listing.md`, release
  notes en/hi/bho; `node scripts/gen-store-assets.mjs --check` exit 0. Hindi + Bhojpuri corpus complete (18/18 domains).
- Tests: content 199 · content-tools 16 · engine 1058 · app 340 · web 64 = 1,677 pass. Emulator audit 186 shots (gesture + 3-button),
  0 findings. Details `docs/verification/verification-phase-d.md`.
- The emulator AVD `shubhvela_test` was deleted to free 7.8 GB (recreate with `scripts/emulator.ps1 -Install`).
- Open for you, in order: 7 (keystore backup — today), 8 (grievance e-mail), 3 (Play Console listing + products + AAB upload), 4 (AdMob),
  1 (name/domains or the N17 user-pages repo), 6 (Bhojpuri review + Yoni convention acceptance), 2 (Instagram). Your DEV-1 confirmation
  on a phone with the 1.0.0 arm64 APK is still the open acceptance.

## Post-1.0 fixes (from the Phase D review)

Appended by the Phase D reviewer (2026-10-30, verdict APPROVED — 0 blocking, 5 medium, 2 nit; full record in
`docs/verification/review-phase-d.md` once d-ship refreshes the copies, source `.agents/tasks/v1-build/review-phase-d.md`).
Items marked **before upload** must be done before the AAB goes to Play; the rest ship in 1.0.x.

MEDIUM
- **Before upload — privacy disclosure of the model download.** *Done by d-ship 2026-10-30 (`a12e8f3`).* The privacy page (`web/src/strings/{en,hi,bho}.json`
  privacy section → `/<lang>/privacy/`), the first-launch notice (`packages/content/ui/*.json` `consent.leaves`) and
  Settings → Privacy (`privacy.networkList`) say nothing else is ever sent, but Pro's "Ask my chart" downloads the Gemma
  model from huggingface.co after your consent (`app/src/ai/model.ts`). Add one sentence in all three places (en/hi/bho):
  "Pro users who accept the Ask-my-chart download fetch the model file from Hugging Face over Wi-Fi; the request carries
  no personal data." Correct the note in `app/playstore-assets/store-listing.md` (Data safety) that claims the page already
  says so. The Data-safety data types themselves need no change.
- **Before upload — six `koota-yoni@mXX` matching conventions** (item 6 above): accept the convention in
  `packages/engine/reference/CONVENTIONS.md` or supply Drik's five-level Yoni table; the matching suite is 14/20 exact
  against Drik until then (spec §6 asked for exact totals).
- **Before upload — re-shoot the 21 stand-in Play screenshots** *— done by d-ship 2026-10-30/31 (`fc38fb6`, `6f3099a`; 24/24 raw, 0 pending).* (d-ship: `scripts/shots.ps1 -KeepRaw`, pro seed, light,
  status bar in demo mode; the Family slot scrolled to tithi birthdays/shraddha), then `node scripts/gen-brand-assets.mjs`
  and `--check`; no `pending: true` may remain in `app/playstore-assets/screenshots/sources.json`. The current stand-ins
  show emulator status icons, an old "म्ध्यम" spelling and English lesson titles.
- **Before publish — grievance address** (item 8 above): `app/src/legal.ts`, web strings, store-listing, BREACH-PROCESS,
  Play Console contact.
- Level-2 "Why?" explanations exist only for the eight kootas; author level-2 English snippets for the daily,
  planet-sign/house and yoga domains so lessons 2–21 unlock text on the screens they teach, then translate (1.0.x).

NIT
- Festival pages print the raw convention id ("pradosh", "udaya", …) in the Convention row in every language
  (`web/src/templates/festival.mjs` line 35); use the existing `calendar.timing.<id>` labels (1.0.x; the monthly
  Pages rebuild publishes it).
- Carried from earlier phases: Devanagari place names in the app (`name_hi`), muhurat finder following Today's
  location mode, cross-instance share-code check (two phones), native ad card pixels on a phone with Play, Sheetala
  Ashtami 2028 rule, Vargas/Varshaphal footer re-shoot in the d-ship emulator audit, the run-artifact `plan.md` still
  naming `:app:testReleaseUnitTest`, a dedicated 96×96 notification-icon source.
- Your confirmation that the 0.3.1/1.0.0 build clears the system navigation bar on your phone (DEV-1) is still the open
  acceptance for that fix.
