# Owner steps (Sudish) — nothing in the build waits on these

Created in A01 from plan.md section 13; refreshed at the end of every phase. Each item says
when it is needed and what the build does meanwhile.

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
5. **Gemini key.** `gh secret set GEMINI_API_KEY --repo Sudish007/shubhvela` (free-tier key,
   pasted into the hidden prompt). This is the only item that can pause a step (the corpus
   translation batches in A08, B02, C02).
6. **Bhojpuri review.** Review `packages/content/ui/bho.json` (including बचीं for "Avoid" and the
   possessive राउर) and the 50-snippet queues `packages/content-tools/review-queue/bho-A.md`,
   `bho-B.md`, `bho-C.md` as they appear; flip `review` to `reviewed` or send corrections.
   Review the festival rules once: `packages/engine/data/festival-rules.json` and
   `packages/engine/reference/CONVENTIONS.md`.
7. **Keystore backup.** Copy `release/shubhvela-release.keystore` and `release/KEYSTORE-INFO.txt`
   (both gitignored, created 2026-10-24) to an off-machine encrypted location. Losing them means
   a new app listing.
8. **Grievance contact.** Provide the e-mail for the privacy page, consent notice and breach
   process. Placeholder until then: `grievance@shubhvela.in`.
9. **Share-code relay (deferred).** v1 ships QR + a 20-character typed code, fully offline.
   Decide later whether a Pro 8-character relay service is wanted.
10. **Disk.** Keep at least 8 GB free on C: before build steps (Gradle + emulator). Candidates:
    `~/.gradle/caches` (~4 GB, rebuilds itself) and `%LOCALAPPDATA%\ms-playwright` (~1.4 GB,
    needed again in Phase D). At A01 the machine had 3.8 GB free; A13 will pause and ask if it
    is still below 4 GB.
11. **Post-1.0 fixes** carried from the Phase D review (appended by the reviewer).
