# Shubhvela — Google Play listing kit (1.0.0, versionCode 4)

Everything the owner pastes into Play Console. Written by the D04 step (2026-10-30) from spec sections 9–11 and
design.md 5–6; honesty rule D8 applies to every sentence here: no accuracy claims, no testimonials, no outcome
promises, nothing that is not in the 1.0.0 build. Field limits are checked by `node scripts/gen-store-assets.mjs --check`
(the fenced blocks tagged `text <field> <lang>` are what it measures). Graphics (icon, feature graphic, framed
screenshots) come from the brand run (`scripts/gen-brand-assets.mjs`, `docs/BRAND.md`); the Play Console walk-through
with every form location is `docs/PLAY-RELEASE-CHECKLIST.md`.

Package `com.shubhvela.app` · version 1.0.0 (versionCode 4) · min Android 7.0 (API 24) · target API 36 · Android only.

Listing languages: English (en-IN as the default listing language; en-US copy identical), Hindi (hi-IN). Play has no
Bhojpuri listing locale; the Bhojpuri texts below are kept for the website and for the day Play adds the locale, and
the Hindi listing says the app itself runs in Bhojpuri.

## Title

```text title en
Shubhvela: Kundli & Panchang
```

```text title hi
शुभवेला: कुंडली और पंचांग
```

```text title bho
शुभवेला: कुंडली आ पंचांग
```

## Short description

```text short en
Kundli, panchang, good hours, muhurat, family tithi dates. Offline, no account.
```

```text short hi
कुंडली, पंचांग, शुभ समय, मुहूर्त और परिवार की तिथियाँ। ऑफ़लाइन, बिना खाते के।
```

```text short bho
कुंडली, पंचांग, शुभ समय, मुहूर्त आ परिवार के तिथि। ऑफ़लाइन, बिना खाता के।
```

## Full description

```text full en
Shubhvela is a Vedic almanac for your household. It computes your kundli, today's panchang and good hours, muhurat windows, tithi birthdays and shraddha dates, kundli matching and short lessons, all on your phone. There are no astrologers to call, no wallet, no remedies for sale and no account to create.

Every line is explained. Each interpretive sentence has a "Why?" button that shows the rule and the inputs behind it, and every report ends with "How this was computed". Where the birth time is unknown or a planet sits within a degree of a sign boundary, the app says "approx." instead of pretending.

WHAT YOU GET FREE
• Kundli: D1 and D9 charts in North, South and East Indian styles, planet table with dignities, yogas, current and next dasha
• Today: good hours band, daily note, full panchang sheet for your place, home-screen widgets, listen (text-to-speech)
• Two profiles and five tithi reminders (tithi birthdays, shraddha, vrats)
• Muhurat finder for today and the next 7 days, with the rules shown
• Kundli matching: 36-guna scores and summary; share your chart by QR or a short code
• 24-hour unlocks (after a rewarded video) for the other divisional charts, KP, Ashtakavarga, Prashna and Varshaphal
• 21 lessons, a 264-term glossary and a reflection journal
• Janam Patri PDF as a one-time purchase

WHAT PRO ADDS
• No ads at all; the ad SDK is never started
• Unlimited profiles and reminders
• Muhurat finder for any date range, with calendar (.ics) export
• Pratyantar dasha and dasha-change alerts
• All divisional charts D2–D60, KP, Ashtakavarga, Prashna and Varshaphal without unlocks
• Full matching explanations and the matching PDF; Janam Patri PDF included
• "Ask my chart": an on-device language model (Gemma) answers questions about your own chart; it needs a recent phone with enough memory and a one-time Wi-Fi download, and its answers are labelled as AI text that can be wrong

LANGUAGES
English, Hindi and Bhojpuri, including the widgets, reminders and PDFs. Hindi and Bhojpuri display text uses Tiro Devanagari and Noto Sans Devanagari.

YOUR DATA
Birth details and notes stay in a database on your phone. No account, no sync, no analytics of our own. Place search works offline from a bundled list of 37,000 places; "Search online" sends only the place name you typed to OpenStreetMap, and only when you tap it. Backup is an encrypted file you create yourself. "Delete everything" in Settings removes all data at once. The free tier shows ads through Google AdMob, which receives device identifiers; Pro removes the ads and the SDK is not initialised.

HOW IT IS COMPUTED
Planet positions come from the astronomy-engine ephemeris with the Lahiri (Chitrapaksha) ayanamsa by default (Raman and KP available). Tithi, nakshatra, yoga, karana and the festival calendar are checked against published panchang references; the measured differences are listed on each report's footer and on the website.

PLEASE READ
Shubhvela offers guidance for reflection. It is not medical, legal or financial advice, and it does not promise any outcome. It sells no gemstones, rituals or remedies and never links a remedy to health.

Web companion: https://sudish007.github.io/shubhvela/
Privacy policy: https://sudish007.github.io/shubhvela/en/privacy/
```

```text full hi
शुभवेला आपके परिवार का वैदिक पंचांग है। यह आपकी कुंडली, आज का पंचांग और शुभ समय, मुहूर्त, तिथि जन्मदिन और श्राद्ध की तारीख़ें, कुंडली मिलान और छोटे पाठ, सब आपके फ़ोन पर ही गिनता है। इसमें कोई ज्योतिषी नहीं, कोई वॉलेट नहीं, कोई उपाय बिकाऊ नहीं और कोई खाता नहीं बनाना पड़ता।

हर पंक्ति की वजह दिखती है। हर व्याख्या-वाक्य के साथ "क्यों?" बटन है जो नियम और उसके आधार दिखाता है, और हर रिपोर्ट के अंत में "यह कैसे गिना गया" लिखा है। जन्म-समय अज्ञात हो या कोई ग्रह राशि-सीमा से एक अंश के भीतर हो, तो ऐप "लगभग" लिखता है, झूठा दावा नहीं करता।

मुफ़्त में क्या मिलता है
• कुंडली: D1 और D9, उत्तर, दक्षिण और पूर्वी भारतीय शैली में; ग्रह तालिका, योग, वर्तमान और अगली दशा
• आज: शुभ समय की पट्टी, दिन का नोट, आपके स्थान का पूरा पंचांग, होम-स्क्रीन विजेट, सुनने की सुविधा
• दो प्रोफ़ाइल और पाँच तिथि-अनुस्मारक (तिथि जन्मदिन, श्राद्ध, व्रत)
• आज और अगले 7 दिनों के लिए मुहूर्त खोज, नियमों के साथ
• कुंडली मिलान: 36 गुण के अंक और सार; QR या छोटे कोड से कुंडली साझा करें
• अन्य वर्ग कुंडली, KP, अष्टकवर्ग, प्रश्न और वर्षफल के लिए 24 घंटे का अनलॉक (एक रिवॉर्ड वीडियो के बाद)
• 21 पाठ, 264 शब्दों की शब्दावली और एक चिंतन-डायरी
• जन्म पत्री PDF एक बार के भुगतान पर

प्रो में क्या जुड़ता है
• कोई विज्ञापन नहीं; विज्ञापन SDK शुरू ही नहीं होता
• असीमित प्रोफ़ाइल और अनुस्मारक
• किसी भी तारीख़-सीमा के लिए मुहूर्त खोज, कैलेंडर (.ics) निर्यात के साथ
• प्रत्यंतर दशा और दशा-परिवर्तन की सूचना
• D2 से D60 तक सभी वर्ग कुंडली, KP, अष्टकवर्ग, प्रश्न और वर्षफल बिना अनलॉक
• मिलान की पूरी व्याख्या और मिलान PDF; जन्म पत्री PDF शामिल
• "मेरी कुंडली से पूछें": फ़ोन पर ही चलने वाला भाषा मॉडल (Gemma) आपकी अपनी कुंडली के बारे में सवालों के उत्तर देता है; इसके लिए पर्याप्त मेमोरी वाला नया फ़ोन और एक बार Wi‑Fi डाउनलोड चाहिए, और इसके उत्तर "AI पाठ, गलत हो सकता है" के रूप में चिह्नित हैं

भाषाएँ
अंग्रेज़ी, हिंदी और भोजपुरी, विजेट, अनुस्मारक और PDF सहित।

आपका डेटा
जन्म विवरण और नोट आपके फ़ोन के डेटाबेस में रहते हैं। कोई खाता नहीं, कोई सिंक नहीं, हमारा कोई एनालिटिक्स नहीं। स्थान खोज 37,000 स्थानों की सूची से ऑफ़लाइन होती है; "ऑनलाइन खोजें" केवल आपके लिखे स्थान का नाम OpenStreetMap को भेजता है, और वह भी आपके टैप करने पर ही। बैकअप एक एन्क्रिप्टेड फ़ाइल है जो आप स्वयं बनाते हैं। सेटिंग्स में "सब कुछ हटाएँ" सारा डेटा एक साथ मिटा देता है। मुफ़्त संस्करण में Google AdMob के विज्ञापन दिखते हैं, जिसे डिवाइस पहचानकर्ता मिलते हैं; प्रो में विज्ञापन नहीं होते और SDK शुरू नहीं होता।

गणना कैसे होती है
ग्रह स्थितियाँ astronomy-engine से, डिफ़ॉल्ट लाहिड़ी (चित्रपक्ष) अयनांश के साथ (रमन और KP भी उपलब्ध)। तिथि, नक्षत्र, योग, करण और पर्व-सूची प्रकाशित पंचांग संदर्भों से जाँची गई है; मापे गए अंतर हर रिपोर्ट के फ़ुटर और वेबसाइट पर दिए हैं।

कृपया पढ़ें
शुभवेला चिंतन के लिए मार्गदर्शन देता है। यह चिकित्सा, क़ानूनी या वित्तीय सलाह नहीं है और किसी परिणाम का वादा नहीं करता। यह रत्न, अनुष्ठान या उपाय नहीं बेचता और किसी उपाय को स्वास्थ्य से नहीं जोड़ता।

वेब संस्करण: https://sudish007.github.io/shubhvela/hi/
गोपनीयता नीति: https://sudish007.github.io/shubhvela/hi/privacy/
```

```text full bho
शुभवेला राउर परिवार के वैदिक पंचांग बा। ई राउर कुंडली, आज के पंचांग आ शुभ समय, मुहूर्त, तिथि जन्मदिन आ श्राद्ध के तारीख़, कुंडली मिलान आ छोट-छोट पाठ, सब राउर फ़ोन पर ही गिनेला। एह में कोनो ज्योतिषी नइखे, कोनो वॉलेट नइखे, कोनो उपाय बिकाऊ नइखे आ कोनो खाता बनावे के जरूरत नइखे।

हर पाँति के कारन देखाला। हर व्याख्या-वाक्य के साथे "काहे?" बटन बा जे नियम आ ओकर आधार देखावेला, आ हर रिपोर्ट के अंत में "ई कइसे गिनल गइल" लिखल बा। जन्म-समय ना मालूम होखे भा कोनो ग्रह राशि-सीमा से एक अंश के भीतर होखे, त ऐप "लगभग" लिखेला, झूठ दावा ना करेला।

मुफ़्त में का मिलेला
• कुंडली: D1 आ D9, उत्तर, दक्खिन आ पूरबी भारतीय शैली में; ग्रह तालिका, योग, वर्तमान आ अगिला दशा
• आज: शुभ समय के पट्टी, दिन के नोट, राउर जगह के पूरा पंचांग, होम-स्क्रीन विजेट, सुने के सुविधा
• दू प्रोफ़ाइल आ पाँच तिथि-याद (तिथि जन्मदिन, श्राद्ध, व्रत)
• आज आ अगिला 7 दिन खातिर मुहूर्त खोज, नियम के साथे
• कुंडली मिलान: 36 गुण के अंक आ सार; QR भा छोट कोड से कुंडली साझा करीं
• बाकी वर्ग कुंडली, KP, अष्टकवर्ग, प्रश्न आ वर्षफल खातिर 24 घंटा के अनलॉक (एक रिवॉर्ड वीडियो के बाद)
• 21 पाठ, 264 शब्द के शब्दावली आ एक चिंतन-डायरी
• जन्म पत्री PDF एक बेर के भुगतान पर

प्रो में का जुड़ेला
• कोनो विज्ञापन नइखे; विज्ञापन SDK शुरू ही ना होला
• असीमित प्रोफ़ाइल आ याद
• कोनो भी तारीख़-सीमा खातिर मुहूर्त खोज, कैलेंडर (.ics) निर्यात के साथे
• प्रत्यंतर दशा आ दशा-बदलाव के सूचना
• D2 से D60 तक सब वर्ग कुंडली, KP, अष्टकवर्ग, प्रश्न आ वर्षफल बिना अनलॉक
• मिलान के पूरा व्याख्या आ मिलान PDF; जन्म पत्री PDF शामिल
• "हमार कुंडली से पूछीं": फ़ोन पर ही चले वाला भाषा मॉडल (Gemma) राउर आपन कुंडली के बारे में सवाल के उत्तर देला; एकरा खातिर पर्याप्त मेमोरी वाला नया फ़ोन आ एक बेर Wi‑Fi डाउनलोड चाहीं, आ एकर उत्तर "AI पाठ, गलत हो सकेला" के रूप में चिह्नित बा

भाषा
अंग्रेज़ी, हिंदी आ भोजपुरी, विजेट, याद आ PDF समेत।

राउर डेटा
जन्म विवरण आ नोट राउर फ़ोन के डेटाबेस में रहेला। कोनो खाता नइखे, कोनो सिंक नइखे, हमनी के कोनो एनालिटिक्स नइखे। जगह खोज 37,000 जगह के सूची से ऑफ़लाइन होला; "ऑनलाइन खोजीं" खाली रउआ लिखल जगह के नाम OpenStreetMap के भेजेला, आ ऊहो रउआ टैप कइला पर ही। बैकअप एक एन्क्रिप्टेड फ़ाइल बा जे रउआ अपने बनावेनी। सेटिंग में "सब कुछ हटाईं" सारा डेटा एक साथे मेटा देला। मुफ़्त संस्करण में Google AdMob के विज्ञापन देखाला, जेकरा डिवाइस पहचानकर्ता मिलेला; प्रो में विज्ञापन नइखे आ SDK शुरू ना होला।

गिनती कइसे होला
ग्रह स्थिति astronomy-engine से, डिफ़ॉल्ट लाहिड़ी (चित्रपक्ष) अयनांश के साथे (रमन आ KP भी उपलब्ध)। तिथि, नक्षत्र, योग, करण आ पर्व-सूची प्रकाशित पंचांग संदर्भ से जाँचल गइल बा; मापल अंतर हर रिपोर्ट के फ़ुटर आ वेबसाइट पर दिहल बा।

कृपया पढ़ीं
शुभवेला चिंतन खातिर मार्गदर्शन देला। ई चिकित्सा, क़ानूनी भा वित्तीय सलाह नइखे आ कोनो परिणाम के वादा ना करेला। ई रत्न, अनुष्ठान भा उपाय ना बेचेला आ कोनो उपाय के स्वास्थ्य से ना जोड़ेला।

वेब संस्करण: https://sudish007.github.io/shubhvela/bho/
गोपनीयता नीति: https://sudish007.github.io/shubhvela/bho/privacy/
```

## Category, tags, contact, URLs

| Field | Value |
|---|---|
| App or game | App |
| Category | **Lifestyle**, tag **Astrology**. Play's category list has no "Astrology" entry (checked 2026-10-30: Astrotalk and InstaAstro are listed under Lifestyle, [Play category help](https://support.google.com/googleplay/android-developer/answer/113475)); the spec's "Astrology" is expressed through the tag. |
| Tags (≤ 5) | Astrology, Horoscope, Calendar, Hinduism, Spirituality |
| Free or paid | Free (contains ads, offers in-app purchases) |
| Contact e-mail | `grievance@shubhvela.in` — **provisional** (OWNER-TODO item 8). Replace with the real mailbox in Play Console, `app/src/legal.ts`, `web/src/strings/*.json` and `docs/BREACH-PROCESS.md` on the same day. Play requires a working address before publishing. |
| Contact website | https://sudish007.github.io/shubhvela/ |
| Privacy policy URL | https://sudish007.github.io/shubhvela/en/privacy/ (hi: `/hi/privacy/`, bho: `/bho/privacy/`; `/privacy/` redirects to English) |
| Terms URL (linked from the Pro screen) | https://sudish007.github.io/shubhvela/en/terms/ |
| Account deletion URL (Play "Data deletion" field) | https://sudish007.github.io/shubhvela/en/data-deletion/ — the page states that there is no account and explains Settings → Privacy → **Delete everything**. In the "App account deletion" declaration answer **"My app does not allow users to create an account"**; the data-deletion URL still goes in the optional field. |
| Developer name shown | Sudish Kumar (personal account) |
| Website for the app-ads.txt | https://sudish007.github.io/shubhvela/app-ads.txt — **not created yet**; AdMob asks for it once the real AdMob app exists (OWNER-TODO item 4). |

All three URLs returned HTTP 200 on 2026-10-30 (`Invoke-WebRequest`, see verification-d04.md).

## Store settings

| Field | Answer |
|---|---|
| Default language | English (India) — en-IN |
| Additional listing | Hindi — hi-IN (texts above; screenshots `screenshots/hi/`) |
| Bhojpuri | Not offered by Play as a listing locale (2026-10-30). Keep `screenshots/bho/` and the texts for the website. |
| Countries | India first; the rest of the world may be added at once (prices in USD below). |
| Pricing | Free app |
| Distribution: Wear OS / TV / Auto / Chromebook / Tablet | Phones only is fine; the layouts work on tablets but no tablet screenshots were shot — leave the 7"/10" screenshot slots empty rather than upload phone shots there. |
| Managed Google Play / Family Library | No |
| Designed for Families programme | **No** (18+ audience below) |

## Target audience and content

| Question | Answer | Why |
|---|---|---|
| Target age group(s) | **18 and over** only | Astrology content; purchases; ads. Nothing is aimed at children. |
| Does the app appeal to children? | No | Almanac/computation tool. |
| Ads | **Yes, contains ads** (free tier; Google AdMob with test IDs until OWNER-TODO item 4 is done) | Spec F38. Pro removes all ads. |
| Ads SDK compliant with Families policy | Not applicable (not in the Families programme) | |
| News app | No | |
| COVID-19 contact tracing / status | No | |
| Government app | No | |
| Financial features | **None** | The app does not offer loans, payments, trading or any financial product. In-app purchases via Play Billing are not "financial features". |
| Health | **None of these** | No medical features; the disclaimer forbids health claims (Drugs and Magic Remedies Act 1954). |
| Data safety | See below | |
| Content rating | See below | |
| Advertising ID | **Yes, the app uses the advertising ID** — purpose: **Advertising or marketing** (the AdMob SDK reads it on the free tier). `com.google.android.gms.permission.AD_ID` is merged by the SDK's manifest. | AdMob disclosure page (developers.google.com/admob/android/privacy/play-data-disclosure). |

## Data safety

Principles the answers rest on (verified in the 1.0.0 source):
no account, no server of ours, no analytics or crash-reporting SDK of ours; all user data lives in SQLite on the device;
network calls are limited to (1) the Google Mobile Ads SDK on the free tier, (2) Google Play Billing, (3) one GET to
`nominatim.openstreetmap.org/search` with the typed place name when the user taps **Search online**, and (4) one
Wi-Fi download of the Gemma model file from huggingface.co when a Pro user accepts the "Ask my chart" download.
Backups are files the user creates (AES-256-GCM, password-derived key) and stores wherever they like. "Delete
everything" (Settings → Privacy) drops every table and the entitlement cache.

### Overview questions

| Question | Answer |
|---|---|
| Does your app collect or share any of the required user data types? | **Yes** (because of the ads SDK on the free tier and the optional online place search). |
| Is all of the user data collected by your app encrypted in transit? | **Yes** (TLS for AdMob, Play Billing, Nominatim and the model download). |
| Do you provide a way for users to request that their data is deleted? | **Yes** — in-app **Delete everything** removes all on-device data; ad identifiers are reset in Android settings; the data-deletion page explains both. Note that we hold no copy to delete. |
| Account creation | The app does not let users create an account (see the account-deletion declaration above). |
| Committed to the Play Families policy | No (not enrolled). |
| Independent security review | No. |

### Data types

Mark everything else as **Not collected**. "Collected" means it leaves the device; data that only ever sits in the on-device database (birth details, names, notes, journal, reminders, preferences) is **not** collected under Play's definition and is not listed.

| Play data type | Collected? | Shared? | Ephemeral? | Required or optional | Purpose(s) | Source in the app |
|---|---|---|---|---|---|---|
| Location › **Approximate location** | Yes | Yes | Yes | Optional (only on the free tier; a user can go Pro or limit ad tracking) | Advertising or marketing; Analytics; Fraud prevention, security and compliance | The Google Mobile Ads SDK estimates a coarse location from the IP address. The app's own location mode (Today → "Use my location") keeps the GPS fix on the device and never transmits it. |
| Location › Precise location | **No** | — | — | — | — | The fix is used on-device for sunrise/panchang only. |
| Personal info (name, e-mail, …) | **No** | — | — | — | — | Profile names and birth data never leave the phone. |
| Financial info › **Purchase history** | **Yes** (conservative) | No | No | Optional (only if the user buys) | App functionality | Google Play Billing processes the purchase; the app keeps the purchase token on the device to restore Pro and report credits. Google is the processor; declaring "collected, not shared" is the safe reading. |
| Health and fitness | No | — | — | — | — | |
| Messages | No | — | — | — | — | |
| Photos and videos | No | — | — | — | — | The camera is used only to scan a share-code QR; frames are decoded on-device and not stored. |
| Audio files | No | — | — | — | — | Text-to-speech output only. |
| Files and docs | **No** | — | — | — | — | Backup files and PDFs are created on request and handed to the system share sheet; nothing is uploaded by the app. |
| Calendar | No | — | — | — | — | `.ics` files are generated and shared; the calendar is not read. |
| Contacts | No | — | — | — | — | |
| App activity › **App interactions** | Yes | Yes | No | Optional (free tier only) | Advertising or marketing; Analytics; Fraud prevention, security and compliance | Google Mobile Ads SDK ("user product interactions": app launch, taps on ads, video views). |
| App activity › **In-app search history** | **Yes** (user-initiated) | No* | Yes | Optional | App functionality | The place name typed into the birth-place field is sent to OpenStreetMap Nominatim only when the user taps **Search online**. *Transfer to OpenStreetMap on an explicit user action falls under Play's user-initiated-action exemption from the sharing disclosure; the privacy policy still names it. |
| App activity › Installed apps / Other user-generated content / Other actions | No | — | — | — | — | |
| Web browsing | No | — | — | — | — | |
| App info and performance › **Crash logs** | No | — | — | — | — | No crash reporter of ours. (Android's own crash reporting to Google is outside the form.) |
| App info and performance › **Diagnostics** | Yes | Yes | No | Optional (free tier only) | Analytics; Fraud prevention, security and compliance | Google Mobile Ads SDK (app launch time, hang rate, energy usage). |
| App info and performance › Other app performance data | No | — | — | — | — | |
| **Device or other IDs** | Yes | Yes | No | Optional (free tier only; resettable in Android settings) | Advertising or marketing; Analytics; Fraud prevention, security and compliance | Google Mobile Ads SDK: Android advertising ID, app set ID. |

The privacy page names the four endpoints: Nominatim, AdMob, Play Billing and (since 1.0.0, added by d-ship on
2026-10-30 after the Phase D review) the Hugging Face model download for Pro users who accept "Ask my chart" — the same
sentence is in the first-launch notice (`consent.leaves`) and Settings → Privacy (`privacy.networkList`). The page does
not spell out that an IP address is visible to every server the phone talks to; if a Play reviewer asks, add that sentence
to `web/src/strings/*.json` `privacy.leaves` (the model download carries no user data beyond the request itself).

### Security practices

| Question | Answer |
|---|---|
| Data encrypted in transit | Yes |
| Users can request data deletion | Yes (in-app Delete everything; nothing is held server-side) |
| Follows the Families policy | No |
| Independent security review | No |

## Content rating (IARC questionnaire)

Category to pick at the start: **Utility, productivity, communication or other** (not "Reference, news or educational",
not "Entertainment"). Expected ratings: IARC Generic 3+, PEGI 3, ESRB Everyone, USK 0, ACB G; India follows IARC Generic.

| Question | Answer | Note |
|---|---|---|
| Violence (any form) | No | |
| Sexuality / nudity | No | |
| Language (profanity) | No | |
| Controlled substances (drugs, alcohol, tobacco) | No | |
| Gambling (simulated or real) | No | |
| Fear / horror content | No | Forbidden-word lists exclude fear language from the corpus. |
| Crude humour | No | |
| Does the app share the user's current location with other users? | No | The optional GPS fix stays on the device. |
| Does the app allow users to interact or exchange content with each other? | **No** | Share codes are exported by the user through the system share sheet or a QR; the app has no in-app messaging, feed or user directory. |
| Does the app allow users to purchase digital goods? | **Yes** | Play Billing subscription, lifetime and three one-time reports. |
| Does the app contain ads? | **Yes** | AdMob on the free tier. |
| Does the app share personal information with third parties? | **Yes** — with the advertising SDK (device identifiers). | Consistent with Data safety. |
| Unrestricted web access (a browser)? | No | Links open the system browser; the in-app WebView shows only the app's own generated PDF HTML. |
| Miscellaneous: horoscopes / astrology content | If asked ("Does the app contain content related to the occult, astrology or horoscopes?") answer **Yes** | Still rated 3+/Everyone in IARC. |
| Promotion of real-world products or services | No | No remedies, gemstones or consultations are sold or promoted. |

## Products (Play Console → Monetise)

Prices per spec F39/F40; the app requests exactly these ids (`app/src/billing/products.ts`). Create them before uploading
the AAB, otherwise the Pro screen shows Play's "item not available" inline (B03). Localised prices come from Play; the
app shows the INR figures below only while offline, captioned "store price may differ".

### Subscription

| Field | Value |
|---|---|
| Product ID | `shubhvela_pro` |
| Name | Shubhvela Pro |
| Description (≤ 80) | No ads, unlimited profiles and reminders, all charts, PDFs and Ask my chart. |
| Base plan `monthly` | Auto-renewing, 1 month, ₹49 (India), $2.99 (default for other countries); grace period 7 days; no free trial, no intro offer |
| Base plan `yearly` | Auto-renewing, 1 year, ₹299 (India), $19.99 elsewhere; grace period 7 days; no free trial |
| Benefits list (Play shows up to 4) | No ads · Unlimited profiles and reminders · Every divisional chart and report · Ask my chart on-device |

### One-time products

| Product ID | Type | Name | Description (≤ 80) | India | Elsewhere |
|---|---|---|---|---|---|
| `shubhvela_pro_lifetime` | Non-consumable | Shubhvela Pro — lifetime | Everything in Pro, once, for as long as the app exists. | ₹999 | $49.99 |
| `report_janam_patri` | Consumable | Janam Patri PDF | One Janam Patri PDF for one profile (included in Pro). | ₹99 | $1.99 |
| `report_matching` | Consumable | Matching report PDF | One kundli-matching PDF for one pair (included in Pro). | ₹99 | $1.99 |
| `report_varshaphal` | Consumable | Varshaphal report PDF | One Varshaphal (annual chart) PDF for one profile and year. | ₹149 | $2.99 |

Notes: the three reports are consumables (P19) — one purchase = one delivered report; the app marks the credit delivered
when the preview is opened. Varshaphal is paid on both tiers (M2 wording "₹149 in Free and Pro"). USD prices for the
reports were not fixed by the spec; the values above follow Play's price-tier rounding of the INR amounts and may be
changed by the owner in the Console without any app change.

### Licence testers and the test track

1. Play Console → Settings → Licence testing: add the Gmail addresses of the testers (your own account first). Set
   the response to **RESPOND_NORMALLY**. Testers are not charged; subscriptions renew on a shortened schedule (monthly
   = 5 minutes, yearly = 30 minutes).
2. Create an **Internal testing** release, upload `release/Shubhvela-1.0.0.aab` (built by d-ship), add the tester
   e-mails to the list, share the opt-in link; install from Play (sideloaded APKs cannot buy).
3. In the app: Settings → Pro → Plans → pick a plan → Continue → the Play sheet shows "Test card, always approves".
   After purchase the Pro screen shows the status lines; Settings → Pro → **Restore purchases** must bring Pro back after
   a reinstall; **Manage** opens the Play subscription centre for `shubhvela_pro`.
4. Reports: Charts → ⋮ → Janam Patri → Buy ₹99 as a free user, then open the preview (credit consumed); as a Pro tester
   the same row says "included in Pro".
5. Cancel the test subscription from the Play subscription centre; after the shortened period the app must show Pro off
   and ads back on the next cold start.
6. Ads: a tester device with Play Services shows Google's **test** units until `app/app.json` `extra.admob.live` is
   `true` with the real ids (OWNER-TODO item 4).

## Release notes

Play limit: 500 characters per language. Files: `release-notes/1.0.0.en.md`, `1.0.0.hi.md`, `1.0.0.bho.md` (the
`--check` counts them). Paste en into en-IN and hi into hi-IN.

## Pre-launch report expectations

The pre-launch crawler will see the consent notice first (first launch) and must tap "OK, continue"; it has no Play
products so the Pro screen shows the inline "item not available" line; it has no network identity for ads so test
banners may not fill. None of these is a defect.

## What is NOT in this kit

- Real AdMob ids, the Play Store URL (`playUrl` in `web/src/strings/*.json` and `app/app.json` `extra.playUrl` are empty
  until the listing exists), the final grievance mailbox, `app-ads.txt`, the signed AAB (d-ship builds it) — all owner
  steps in `docs/OWNER-TODO.md`.
- 21 of 24 screenshot slots are 864×1920 stand-ins upscaled by the brand generator (`screenshots/sources.json`,
  `pending: true`); d-ship re-shoots them raw. Upload to Play only when no slot is pending.
