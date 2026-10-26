# Owner steps (Sudish) — nothing in the build waits on these

Created in A01 from plan.md section 13; refreshed at the end of every phase. Each item says
when it is needed and what the build does meanwhile.

**Phase A shipped (2026-10-26, tag `v0.1.0-phase-a`):** `release/Shubhvela-0.1.0-arm64.apk` (device) and
`release/Shubhvela-0.1.0-x86_64.apk` (emulator, screenshot mode) are on this PC only (gitignored). Open
owner items at this point: 1 (name/domains), 2 (Instagram), 3 (Play Console), 5 (`GEMINI_API_KEY` still
not set — `gh secret list` is empty, so the Hindi corpus is still English), 6 (Bhojpuri review), 7
(keystore backup), 8 (grievance e-mail). Item 4 (AdMob) waits for the Phase B review. Details in
`docs/verification/verification-phase-a.md`.

1. **Name and domains.** Confirm "Shubhvela" (शुभवेला). It must be final before the first Play
   upload: the Android `applicationId com.shubhvela.app` cannot change afterwards. Buy
   `shubhvela.in` and `shubhvela.com` the same day (`.app` optional). Later: custom domain ->
   GitHub Pages CNAME + `/.well-known/assetlinks.json` for verified App Links. Alternative (N17):
   create the user-pages repo `Sudish007/Sudish007.github.io` (with `.nojekyll`) serving
   `/.well-known/assetlinks.json` at the origin root, verify once with a test APK.
   *Meanwhile:* the web companion lives at https://sudish007.github.io/shubhvela/.
2. **Instagram.** Claim the handle by hand (not scriptable).
3. **Play Console.** Create the app listing (category Astrology; a personal account is fine).
   Create subscription `shubhvela_pro` with base plans `monthly` (INR 49) and `yearly` (INR 299);
   USD 2.99 / 19.99 elsewhere. In-app product `shubhvela_pro_lifetime` INR 999 / USD 49.99.
   Consumables `report_janam_patri` INR 99, `report_matching` INR 99, `report_varshaphal` INR 149.
   Add licence-tester accounts. Upload the Phase D AAB to the internal testing track. Paste the
   Play Store URL into `web/src/strings/*.json` (`playUrl`) and `app/app.json` (`extra.playUrl`).
   Answer the Data safety form and content rating from `app/playstore-assets/store-listing.md`
   (Phase D). *Meanwhile:* the app reads prices from Play and shows the spec INR strings offline.
4. **AdMob (only after the Phase B review).** Create the app in AdMob, note the App ID and the
   four unit IDs (banner, native, interstitial, rewarded). Then edit `app/app.json`
   `extra.admob` (set `live: true`) and the `com.google.android.gms.ads.APPLICATION_ID`
   meta-data in `app/android/app/src/main/AndroidManifest.xml`. Do NOT create an AppLovin
   mediation group (the adapter is wired but disabled); `applovinSdkKey` stays empty.
   *Meanwhile:* every build uses Google's test IDs.
5. **Gemini key and the Hindi corpus (no step waits on this any more).** Set the secret, then
   dispatch the Action: `gh secret set GEMINI_API_KEY --repo Sudish007/shubhvela` (free-tier key,
   pasted into the hidden prompt), then
   `gh workflow run corpus-translate.yml --repo Sudish007/shubhvela -f lang=hi`
   **One dispatch translates every English corpus domain present at that time** (the Action's
   default `domains=all` reads every `packages/content/corpus/*/en.json` from disk; verified in B02:
   `listDomains()` in `packages/content-tools/src/translate.ts`; `naamkaran-names` is skipped because
   names are already Devanagari + Latin). After Phase B that is about 85 (Phase A) + 75 (Phase B:
   yogas, koota, mangal, muhurat-activities and the 118 new rules) ≈ 160 requests, under the 450 cap;
   Phase C adds lessons and glossary (≈ 45). If a run stops at the cap it saves a cursor and the next
   dispatch resumes. The Action commits `packages/content/corpus/<domain>/hi.json` to main; pull
   before the next build. **Bhojpuri is intentionally excluded** (your decision 2026-10-25): the
   corpus is never machine-translated into Bhojpuri; the app resolves bho -> hi -> en. B02 (2026-10-27)
   and C02 skip their Gemini batches by this decision and no build step pauses for the key.
   *Meanwhile:* the Hindi corpus falls back to English (hi -> en) with the chrome in Hindi.
6. **Bhojpuri review.** Review `packages/content/ui/bho.json` (784 UI strings written in A05,
   including बचीं for "Avoid", the possessive राउर and the respectful रउआ / होला / करीं / बानी / नइखे
   register; `npm test -w packages/content` enforces Devanagari, no Hindi आप/है and no Maithili
   forms, but naturalness needs a native reader) and the Bhojpuri festival names in
   `packages/engine/data/festival-rules.json` (`names.bho`). No Bhojpuri corpus review queues are
   produced (see item 5). Nothing in the build waits on this.
   Review the festival rules once: `packages/engine/data/festival-rules.json` and
   `packages/engine/reference/CONVENTIONS.md`.
7. **Keystore backup.** Copy `release/shubhvela-release.keystore` and `release/KEYSTORE-INFO.txt`
   (both gitignored, created 2026-10-24) to an off-machine encrypted location. Losing them means
   a new app listing.
8. **Grievance contact.** Provide the e-mail for the privacy page, consent notice and breach
   process. Placeholder until then: `grievance@shubhvela.in`; the consent notice and Settings →
   Privacy label it "provisional … confirmed before release". When the address is final, set it in
   `app/src/legal.ts` (`GRIEVANCE_EMAIL_PLACEHOLDER`) and flip `GRIEVANCE_EMAIL_CONFIRMED` to `true`
   so the note disappears. The "Read the privacy policy" link targets `<webBase>/privacy/`, which
   Phase D (D01) publishes; it is a 404 until then.
9. **Share-code relay (deferred).** v1 ships QR + a 20-character typed code, fully offline.
   Decide later whether a Pro 8-character relay service is wanted.
10. **Disk.** Keep at least 8 GB free on C: before build steps (Gradle + emulator). Candidates:
    `~/.gradle/caches` (~4 GB, rebuilds itself) and `%LOCALAPPDATA%\ms-playwright` (~1.4 GB,
    needed again in Phase D). At A01 the machine had 3.8 GB free; A13 will pause and ask if it
    is still below 4 GB.
11. **Post-1.0 fixes** carried from the Phase D review (appended by the reviewer).

## Status after Phase A (shipped 2026-10-26, tag `v0.1.0-phase-a`)

- Built and signed (local, gitignored): `release/Shubhvela-0.1.0-arm64.apk` (device, 90.3 MB) and
  `release/Shubhvela-0.1.0-x86_64.apk` (emulator, screenshot mode, 100.6 MB). Not yet run on a real phone.
- Still open for you: items 1 (name/domains), 2 (Instagram), 3 (Play Console; needed from Phase D),
  4 (AdMob ids; wait for the Phase B review), 5 (`GEMINI_API_KEY` — `gh secret list` was still empty on
  2026-10-26, so Hindi/Bhojpuri screens show English interpretive sentences), 6 (Bhojpuri review of
  `packages/content/ui/bho.json`; no `bho-A.md` review queue exists because the corpus is not translated
  into Bhojpuri by your decision), 7 (keystore backup — do this now), 8 (grievance e-mail).
- Phase B must also pick up the review leftovers in `docs/verification/carry-over.md`.
