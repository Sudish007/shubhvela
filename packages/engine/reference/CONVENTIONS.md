# Reference conventions (spec section 6 validation suites)

What the engine computes, what the reference almanacs print, and every place where the two differ on
purpose. Written by the A04 validation step from the fetched reference data under this folder; the suites in
`test/suites/` encode these rules. Nothing here is a tolerance fudge: an entry either documents a convention the
engine adopted to match the reference, or an intentional difference with its classical basis.

## 1. Engine conventions adopted from the references (validated)

| Quantity | Convention (engine after A04) | Evidence |
|---|---|---|
| Lahiri ayanamsa | 23°15'00.658" at 1956-03-21 0h ET (Lahiri's definition, Swiss Ephemeris `SE_SIDM_LAHIRI`) + IAU 2006 accumulated general precession in longitude, no nutation term | Drik Panchang prints "Lahiri Ayanamsha" on every day page; the engine is within 0.0021° (7.6", constant) on 150 days of 2026–2027 (`results.json` panchang.maxDeviation.ayanamsaDeg). The upstream library's J1900 anchor sat 24" low. Drik's value shows no nutation wobble, so none is added. |
| Sunrise / sunset | Upper limb of the Sun with 34' refraction at sea level (Drik "Hindu sunrise") | 150/150 within 1 min (rounded minutes) |
| Moonrise / moonset | Centre of the Moon's disc on the true (unrefracted) horizon, topocentric (parallax included); listed for the Vedic day sunrise → next sunrise | Drik moonrise is 4 min later than the upper-limb + refraction event; with the centre rule 150/150 within 1 min. Drik lists the moonrise/moonset that fall between sunrise and the next sunrise ("No Moonrise" when none) |
| Rounding of printed times | Drik rounds to the nearest minute (17:44:40 → 05:45 PM) | the suites round the engine the same way before measuring |
| Tithi / nakshatra / yoga / karana | Value at sunrise plus every following interval that starts before the next sunrise; an interval running past the next sunrise prints no end ("upto Full Night") | 150/150 names equal, ends within 2 min (1 min for nakshatra and yoga) |
| Rahu Kaal, Yamaganda, Gulika | 8 equal parts of daylight; Rahu part by weekday Sun..Sat = 8,2,7,5,6,4,3; Yamaganda 5,4,3,2,1,7,6; Gulika 7,6,5,4,3,2,1 | within 1 min |
| Abhijit | 8th of 15 equal daytime muhurtas (sunrise + 7/15 .. 8/15 of daylight); listed every weekday | within 1 min; Drik also lists it on Wednesdays |
| Brahma muhurta | 14th of the 15 equal muhurtas of the night: 2/15 → 1/15 of the night (sunset → sunrise) before sunrise | Drik 04:45–05:35 for Delhi 2026-10-22 (night 12h42m); the fixed 96→48 min rule was up to 16 min off in June |
| Bhadra (Vishti karana) | Every Vishti window overlapping the Vedic day, printed clipped to sunrise / next sunrise | window count and clipped bounds within 1 min |
| Panchak | Sidereal Moon 300°→360° (Dhanishta pada 3 → Revati); printed clipped to the Vedic day or "Whole Day" | within 1 min |
| Lunar month | Amanta month named by the sankranti inside the lunation (Adhik = none); Purnimanta = Amanta for Shukla paksha, next name for Krishna paksha except inside an Adhik lunation | 150/150 both month names and the Adhik flag equal Drik's "Chandramasa" rows |
| Vikram / Shaka samvat | Change on the Chaitra Shukla Pratipada day; when that Pratipada touches no sunrise (kshaya, e.g. 2026-03-19) the day it begins already carries the new year while the month at sunrise is still the old one | Drik 2026-03-19: Vikram 2083 / Shaka 1948 with Chandramasa Phalguna (Amanta) |
| "Vedic" ritu | By Amanta lunar month pair: Chaitra–Vaishakha Vasanta, Jyeshtha–Ashadha Grishma, Shravana–Bhadrapada Varsha, Ashwin–Kartik Sharad, Margashirsha–Pausha Hemanta, Magha–Phalguna Shishira (an Adhik month counts under its name) | Drik "Vedic Ritu" on 150/150 days; the earlier sidereal-Sun rule disagreed on 7 of the first 60 |
| "Drik" ritu and ayana | Tropical Sun: Vasanta from 330°, Uttarayana from the December solstice | 150/150 |
| "Vedic" ayana | Sidereal Sun: Uttarayana from Makara sankranti (270°) | 150/150 |

## 1b. Festival rules adopted from the references (A04 recovery, 2026-2028 Delhi pages)

| Rule | Convention (engine after A04) | Evidence |
|---|---|---|
| Ekadashi fasts (every `*-ekadashi`, `gita-jayanti`, `dev-uthani-ekadashi`) | udaya day; two Ekadashi sunrises (vriddhi) → the later day; when the following Dwadashi touches no sunrise (kshaya) the fast stays on the day the Ekadashi began so the parana falls inside the Dwadashi (`ekadashiVrata` in the table; the vrat module's Smarta day follows the same two rules) | 72 Drik Ekadashi dates 2026-2028: 65 plain udaya, 2 vriddhi → later day (Padmini 2026, Vijaya 2027), 4 kshaya-Ekadashi begin days, 3 kshaya-Dwadashi begin days (Pausha Putrada 2027, Jaya 2028, Utpanna 2028); all 72 reproduced |
| Akshaya Tritiya | udaya with the tri-muhurta rule: the Tritiya must run ≥ 3 muhurtas (144 min) after sunrise, else the previous day (`minMuhurtas: 3`, Nirnaya Sindhu) | Drik 2026-04-19 (next-day Tritiya lasts 1 h 37 m), 2027-05-09 (3 h 28 m), 2028-04-27 |
| Vasant Panchami | purvahna-vyapini: Panchami at sunrise + ¼ daylight, first day when both | Drik 2028-01-31 (Panchami 07:15 → next day 09:28) |
| Sharad Purnima (Kojagara), Kalabhairav Jayanti | nishita (tithi at midnight) | Drik 2026-10-25, 2027-10-14, 2028-10-02; Kalabhairav 2027-11-20, 2028-11-09 |
| Maha Navami | the day before Vijaya Dashami (Navami joined with Ashtami is kept, Navami joined with Dashami rejected — Nirnaya Sindhu) | Drik 2026-10-19 / 2027-10-08 / 2028-09-26 while plain udaya gave the Dashami day in all three years |
| Narasimha Jayanti, Bhai Dooj, Radha Ashtami | when the tithi covers the reference kala (pradosh / aparahna / madhyahna) on two days, the later day | Drik 2026-04-30, 2026-11-11, 2027-09-08 |
| Vat Purnima | pradosh-vyapini Purnima | Drik 2028-06-06 (Purnima 12:30 → next day 11:38) |
| Vishu | Malayalam month start: the sankranti day only when the sankranti is before sunrise, else the next day (`dayRule: sunrise`); Puthandu keeps the sunset rule | Drik Vishu Kani 2026-04-15, 2027-04-15, 2028-04-14 vs sankrantis 04-14 09:40, 04-14 15:33, 04-13 21:48 |
| Baisakhi | the civil date of the Mesha sankranti (`dayRule: same-day`) | Drik 2028-04-13 (sankranti 21:48) |
| Onam, Thaipusam, Karthigai Deepam | the day whose DAYLIGHT the nakshatra covers most (a sunrise inside the nakshatra is not required) | Drik Onam 2027-09-12 (Thiruvonam 09-12 02:59 → 09-13 06:05, one minute after sunrise), Thaipusam 2027-01-22 (Pushya 10:25 → next day 07:31) |
| Krishna Janmashtami | Jayanti yoga: the Vedic day on which Ashtami and Rohini coincide at any instant is taken even when the Ashtami is at nishita only on another day; otherwise nishita, Rohini deciding between two days | Drik 2027-08-25 (Ashtami 08-24 20:25 → 08-25 19:20, Rohini from 08-25 12:28) |
| Festival list vs region | Drik's city pages list festivals of every region (Pongal, Onam, Vishu for Delhi); the suite evaluates both regions at the city and the app's region filter stays a display preference | 2026-2028 Delhi pages |

## 2. Reference-site behaviour recorded, not adopted

| Site | Behaviour | How the suite handles it | Evidence |
|---|---|---|---|
| Drik Panchang kundali | Local sidereal time is formed as GST + 1.0027379 × longitude (the sidereal rate applied to the longitude term), so its Lagna is off by ≈ 0.0027° per degree of longitude: −0.2° in India, −0.5° at Suva (178° E), +0.38° at San Jose (122° W), ≈ 0 in Britain | The engine's Lagna with the longitude scaled by 1.00273791 reproduces Drik's Lagna to ≤ 0.010° on the 57 timed charts (`lagnaDeg:drikpanchang-quirk-model`); AstroSage agrees with the engine's plain Lagna to ≤ 0.034°; such a Drik Lagna is recorded as an explained outlier, not an engine deviation | `reference/results.json` charts.outliers |
| Drik Panchang kundali | The Moon's longitude drifts from JPL Horizons for recent births: 0" (1942-1998), 4" (2010), 10" (2019), 27-33" (2020-2025); the printed Vimshottari balance follows that Moon (31" ≈ 4 days of a Mercury mahadasha) | When the engine's Moon is within 18" of JPL and the site's Moon error predicts the whole balance difference within 1 day, the dasha is an explained outlier | c19, c30, c33, c36, c50 |
| Drik Panchang kundali | Dasha year ≈ 365.2564 d (sidereal year; Mercury 17 y = 6209 d 8 h 36 m) vs the engine's 365.2425 d | ≤ 0.25 d over a balance; inside the 1-day tolerance | c19 table |
| Drik Panchang kundali | Historical offsets: Oslo 1960-06-21 computed at UTC+2 (tzdb: +1, no DST in Norway that year) | compared at the site's instant; the tz suite owns the offset | c44 |
| AstroSage | The place autocomplete is taken literally: "Gorakhpur" → Gorakhpur (Haryana), "Siwan" → Siwan (Haryana), "Patna" → Patna (UP), "Hyderabad" → Hyderabad (Sindh, UTC+5), "Houston"/"Moscow"/"San Jose" resolved to other zones | The site records its coordinates and zone; the Lagna is compared at the site's coordinates and the planets at the site's instant | c03, c04, c09, c19, c33, c34, c36, c45 |
| AstroSage | Mahadasha dates printed to the day with a Y-M-D calendar-arithmetic balance: 2-6 days from Drik and the engine for every birth | outlier when Drik agrees with the engine (or when the site's own Moon explains it); the only unexplained case is u10 (no Drik reference yet) | results charts.outliers |
| AstroSage | Nakshatra column truncated/blank for some rows (parsed as null) | ignored when null, JPL decides the pada | c03, c15, c25 |
| Drik Panchang festivals | Ganga Dussehra 2026 is listed on 2026-05-25, inside Adhik Jyeshtha | not adopted (see section 3) | delhi-2026 page |
| Drik Panchang festivals | Holika Dahan 2026 on 2026-03-03 with Holi 2026-03-04: the total lunar eclipse of 2026-03-03 (sutak) moves the dahan to the Pratipada evening per Drik and the national press | not adopted — v1 has no eclipse model (see section 3; carry-over) | delhi-2026 page; press 2026-02 |
| Drik Panchang festivals | Balarama Jayanti (Bhadrapada Shukla Shashthi) ≠ Hal Shashthi; Kannada/Telugu Hanuman Jayanti follow other rules than the Tamil Margazhi Amavasya | name-map maps only the matching Drik names; unmapped slug-years are skipped and counted as a shortfall, never compared against the wrong event | name-map.json notes |

## 3. Intentional festival-date differences

Entries keyed `slug@city-year` are accepted by `festivals.suite.test.ts`; every other difference is a failure.

- `holika-dahan@delhi-2026`, `holi@delhi-2026`, `holika-dahan@chennai-2026`, `holi@chennai-2026`: engine 2026-03-02 / 03-03 (Purnima at pradosh on the 2nd, Bhadra 17:56 → 05:28, dahan after Bhadra before sunrise; Holi the next day). Drik prints 03-03 / 03-04 because the total lunar eclipse of 2026-03-03 and its sutak forbid the Purnima-night dahan. The engine has no eclipse model in v1; carry-over item "eclipse/sutak rule for Holika Dahan (Dharmasindhu)". 2027 (03-21 / 03-22) and 2028 (03-10 / 03-11) agree with Drik.
- `ganga-dussehra@delhi-2026`, `ganga-dussehra@chennai-2026`: engine 2026-06-24 (nija Jyeshtha Shukla Dashami; Adhik months carry no festival, Dharmasindhu). Drik lists 2026-05-25, the Adhik Jyeshtha Dashami. Kept as the Adhik rule; the same rule gives Drik's dates for Nirjala Ekadashi (06-25) and Vat Savitri (06-15) in the nija month.
- `sheetala-ashtami@delhi-2028`: engine 2028-03-18 (Chaitra Krishna Ashtami at sunrise 06:27, tithi until 17:30). Drik prints 03-17, where the Ashtami begins at 16:26. Drik's rule for Basoda could not be inferred from one case (2026 and 2027 agree with udaya); recorded as unresolved, not as an engine change.
