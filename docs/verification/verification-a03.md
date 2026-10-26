# Verification — A03 Engine panchang, goodHours merge, daily rules, dasha, calendar

Step: coder `a03-engine-panchang-rules`, workflow `wf_86107bfa6c58305a`, Phase A, FEAT-A03. Date: 2026-10-24 (IST night / 20:xx–21:xx UTC).
Worktree: `c:/Users/sudiskmr/Downloads/DomainClassification/shubhvela`. Commit: `feat(engine): panchang, goodHours merge, daily rules, dasha, calendar rules` (hash in section 9).

## 1. What was built (all under `packages/engine/`, pure TypeScript, UTC inside, tz table for every civil date)

| Area | Files | Public functions / data (from `@shubhvela/engine`) |
|---|---|---|
| Shared astronomy | `src/panchang/astro.ts` | `GeoPoint`, `localDateOf`, `localMidnight`, `addDays`, `weekdayOf`, `sunriseOn`, `sunsetOn`, `moonriseBetween`, `moonsetBetween`, `dayFrame` (sunrise/sunset/next sunrise, polar guard), `elongation`, `siderealSun/Moon`, `tithiIndexAt`, `nakshatraIndexAt`, `nextCrossing/prevCrossing` (step + bisection to 1 s), `tithiInterval`, `nakshatraInterval`, `yogaInterval`, `karanaInterval`, `moonSignInterval`, `lunationAt`, `lunationsBetween`, `nextLunation`, `prevLunation` (new moon → new moon with Amanta month index, adhik, kshaya), `purnimantaMonth`, `amantaMonthOf`, `samvatFor`, `lagnaSignEnd` |
| Panchang (F8) | `src/panchang/panchang.ts` | `panchang(dayLocal, geo, tz, {ayanamsa}) -> PanchangDay`: sunrise/sunset/nextSunrise, civil moonrise/moonset, vara + varaLord, udaya tithi/nakshatra(pada, lord)/yoga/karana(bhadra) with start/end, full interval lists for the Vedic day (`tithis`, `nakshatras`, `yogas`, `karanas`, `moonSigns`, exactly contiguous), sunSign/moonSign, `monthAmanta`/`monthPurnimanta` (index + adhik), `lunation`, `samvat` (`vikramSamvat`, `shakaSamvat`), `ritu {vedic, drik}`, `ayana {vedic, drik}`, `rahuKaal`/`yamaganda`/`gulika`/`abhijit`/`brahma` (before next sunrise)/`brahmaMorning`, `choghadiya {day, night}`, `hora[24]`, `bhadra[]` (Vishti windows with earth/heaven/patal), `panchak`, `dishaShool`, `specialYogas`; helpers `dishaShool(vara)`, `eighth`, `partOfEight`, `abhijitWindow`, `brahmaWindow`, `choghadiyaSlots`, `horaSlots`, `bhadraWindows`, `bhadraLocation`, `panchakWindow`, `specialYogas`, `tithiAt`, `nakshatraAt`; tables `VARA_LORDS`, `HORA_ORDER`, `NAKSHATRA_LORDS`, `RAHU_PART`, `YAMAGANDA_PART`, `GULIKA_PART`, `BRAHMA_MUHURTA_MINUTES` |
| goodHours (F5/F27, the ONLY verdict producer) | `src/panchang/goodHours.ts` | `goodHours(dayLocal, geo, tz) -> {day, tz, vara, noSun, ticks {sunrise, noon, sunset, nextSunrise, moonrise}, spans[], segments[], flags {panchak?, bhadra?}, hora[], legend[]}`; `goodHoursFromFrame`, `segmentInputs`, `mergeVerdicts` (pure merge for tests), `legendFor`, `bandPosition`, `bandTime`, `spanWidthDp`, `labelFor` (N3), `at` (Now line state), `verdictAt`, `rowVerdictAt`; constants `DAY_FRACTION = 0.75`, `LABEL_MIN_DP = 60` |
| Daily rules (F6/F24) | `src/rules/daily.ts` | `dailyNote(chart, dayLocal, geo, tz, {panchang?, sadeSati?, ayanamsa?}) -> DailyRule[]` ({order, ruleId, keys, params}), `familyToday(profiles, dayLocal, geo, tz)`, `chandraBalaRule`, `taraBalaRule`, `dayRule`, `sadeSatiRule`, `dashaLordsRule`, `moonHouseFrom`, `taraNumber`, `dayStrength`, `CHANDRA_BALA_GOOD`, `TARA_KEYS`, `TARA_GOOD` |
| Dasha / transits (F7/F14/F15) | `src/dasha/index.ts` | `dasha(chart) -> DashaTree` (maha → antar → pratyantar, `balanceAtBirth`, ≥ 120 years), `current(tree, ms)`, `nextChange(tree, ms, level)`, `changesBetween`, `ingressDates(planet, from, to, {ayanamsa, node})` for Saturn/Jupiter/Rahu/Ketu (direct and retrograde crossings), `siderealLongitude`, `sadeSati(chart, now, {yearsBack, yearsAhead}) -> {state, episodes[{start,end,phases}], dhaiyas, next {kind, at, approx:false}, saturnIntervals}`, `DASHA_YEAR_DAYS`, `VIMSHOTTARI_ORDER`, `VIMSHOTTARI_YEARS` |
| Tithi events (F20/F21) | `src/calendar/observance.ts`, `src/calendar/tithiEvents.ts` | `observanceDay(span, timing, zone, geo, prefer)`, `timingPoint`, `tithiSpanIn`, `tithiIndexOf`, `sunsetRuleDay`; `tithiEventDates(rule, fromYear, toYear, tradition, geo, tz, convention)`, `janmaTithiFromBirth(chart)`, `pitruPaksha(year, geo, tz)`, `barsiDates(ancestor, fromYear, toYear, tradition, geo, tz)` |
| Vrats (F22) | `src/calendar/vrats.ts` | `VRAT_FAMILIES` (12), `vratOccurrences(family, from, to, geo, tz, tradition)`, `allVratOccurrences`, `ekadashiKey`, `ghatasthapanaWindow`, `spanTithiIndex` |
| Festivals (F23) | `data/festival-rules.json` (102 rules), `src/calendar/festivals.ts` | `FESTIVAL_RULES`, `festivalRule(slug)`, `festivals(year, tradition, region, geo, tz) -> FestivalOccurrence[]` |
| Upcoming (F7) | `src/calendar/upcoming.ts` | `upcoming(profile, savedMuhurats, now, geo, tz, {vratHorizonDays}) -> UpcomingItem[]` in the fixed order familyTithi · vrat · savedMuhurat · dashaChange · majorTransit; `UPCOMING_ORDER` |
| Kundli addition | `src/kundli/index.ts` | `naturalRelation(planet, other)` (Parashara table; Rahu read as Saturn, Ketu as Mars) for the dasha day-strength |
| Wiring | `src/index.ts` re-exports `panchang`, `rules`, `dasha`, `calendar`; `vitest.config.ts` (testTimeout 180 s for the sweep tests); `scripts/design-samples.ts` prints the merged goodHours model + F8 fields for the three mock days | |
| Tests | `test/{panchang,goodhours,goodhours-property,rules,dasha,calendar,vrats}.test.ts` | 77 new tests (section 2.1) |

## 2. Commands run (FEAT-A03 verification list) and results

### 2.1 `npm test -w packages/engine`

```
 RUN  v5.0.5 C:/Users/sudiskmr/Downloads/DomainClassification/shubhvela/packages/engine
 Test Files  13 passed (13)
      Tests  132 passed (132)
   Duration  13.07s (tests 82%, import 10%, transform 7%)
```

Per file: A02/A01 suites unchanged (tz 17 + gazetteer 9 + kundli 15 + chart-layout 10 + public-api 3 + smoke 1 = 55; the public-api forbidden-symbol test still passes with the new exports); **new in A03: panchang 8, goodhours 17, goodhours-property 5, rules 9, dasha 11, calendar 18, vrats 9 = 77**.

**Property test (R2-2)** `test/goodhours-property.test.ts`: 365 consecutive days from 2026-01-01 × Delhi, Patna, Mumbai, Chennai, London; for every minute of every Vedic day the band verdict (`verdictAt(spans)`) equals the verdict every covering row claims (`rowVerdictAt`, chip or `parts` sub-range); every row has exactly one chip in {good, neutral, avoid}; the legend equals the set of colours present in the spans (day verdict colours + `night`); spans partition the day exactly. Runtime printed by the test (`npx vitest run --reporter verbose`):

```
[goodhours-property] Delhi:   365 days, 525762 minutes, 7665 rows checked in 3990 ms
[goodhours-property] Patna:   365 days, 525786 minutes, 7665 rows checked in 2375 ms
[goodhours-property] Mumbai:  365 days, 525826 minutes, 7665 rows checked in 1901 ms
[goodhours-property] Chennai: 365 days, 525837 minutes, 7665 rows checked in 1906 ms
[goodhours-property] London:  365 days, 525756 minutes, 7665 rows checked in 1844 ms
```
= 1,825 `goodHours()` calls, 2,628,967 per-minute checks, 38,325 rows, ≈ 12 s of test time in total (the first city carries the parallel-worker contention; run alone each city takes ≈ 1.9 s, i.e. ≈ 5 ms per `goodHours()` call).

### 2.2 `npm run typecheck`

All five workspaces (`content`, `content-tools`, `engine`, `app`, `web`) `tsc --noEmit` clean, exit code 0.

### 2.3 `npx tsx packages/engine/scripts/design-samples.ts`

Exit code 0; section (a) of the output (the three mock days with the merged goodHours model and the F8 fields) is in section 6; section (b) (the sample chart and dasha) is unchanged from `verification-a02.md`.

## 3. Conventions chosen (binding until A04 reports a Drik Panchang difference; also in FEAT-A03 findings and the code headers)

- **Merge precedence** exactly design 10.2: Avoid = Rahu Kaal ∪ Yamaganda ∪ Gulika ∪ Kaal/Rog/Udveg; Good = (Abhijit ∪ Brahma ∪ Shubh/Labh/Amrit) − Avoid; Neutral = Chal + remainder; Night = sunset → next sunrise at 25 % width; Bhadra (Vishti on earth) and Panchak are flags only. Partition at every boundary (Rahu/Yamaganda/Gulika share the choghadiya eighths exactly — `partOfEight()` rounds to integer ms so coincident boundaries compare equal); adjacent equal verdicts merge for the band but never across sunset; every named segment is a row with one chip.
- **Row chip when an overlay splits a row**: the chip is the verdict covering most of the row (ties keep the row's own nature); `overriddenBy`/`liftedBy` name the causes when the chip differs from the nature; `parts` list the sub-ranges with the other verdict (`kind` overridden | lifted | own). The two design examples hold: "Shubh choghadiya · overridden by Yamaganda" (chip avoid), "Chal choghadiya · 11:42–12:05 lifted by Abhijit" (chip neutral). `includes` names a different-kind segment strictly inside a row with the same verdict ("Amrit choghadiya · includes Brahma muhurat").
- **Brahma muhurta** = fixed 48-minute muhurtas, 96 → 48 min before the NEXT sunrise (the one inside the Vedic day; Drik Panchang convention, chosen over the fork's night/15). `panchang().brahmaMorning` gives the one before the civil morning's sunrise. **Abhijit** = 8th of 15 equal daytime muhurtas, listed every weekday (design-literal; see Not verified for the Wednesday question).
- **Hora** = 12 equal daytime + 12 equal night horas from sunrise, Chaldean order Sun, Venus, Mercury, Moon, Saturn, Jupiter, Mars starting with the vara lord. Hora is not a verdict input.
- **Vara** = weekday of the civil date of sunrise, kept until the next sunrise.
- **Panchak** = sidereal Moon in Kumbha + Meena (300° → 360°, Dhanishta pada 3 → Revati), full extent reported. **Bhadra** = Vishti karana; residence from the Moon's sign at its start (Karka/Simha/Kumbha/Meena earth; Mesha/Vrishabha/Mithuna/Vrishchika heaven; Kanya/Tula/Dhanu/Makara patal). Row flags carry `bhadra` only for Bhadra on earth (design wording); `flags.bhadra` always carries the window with its location.
- **Lunar month**: Amanta lunation named by the sankranti it contains (`(sunSignAtNewMoon + 1) % 12`); Adhik when the Sun's sidereal sign is the same at both new moons; kshaya (two sankrantis) flagged, name of the first kept, next name skipped. **Purnimanta** = Shukla paksha same as Amanta; Krishna paksha → next month name, except inside an Adhik lunation (stays "Adhik <name>"). Calendar functions use Lahiri for these decisions regardless of the chart ayanamsa.
- **Vikram/Shaka** change at Chaitra Shukla Pratipada (Pausha/Magha/Phalguna days in Jan–Apr belong to the previous lunar year; when Chaitra is Adhik the number changes at the first Chaitra — matters first in 2029). Vikram = Shaka + 135.
- **Ritu / ayana** on two bases because Drik Panchang prints both: `vedic` = sidereal Sun (Vasanta = Meena + Mesha, Uttarayana from Makara sankranti), `drik` = tropical Sun with the same pairing (Shishira from the December solstice).
- **Tithi event conventions** (`observance.ts`): udaya (tithi at sunrise; two days → first unless `prefer: last`; kshaya → begin day), aparahna (sunrise + 0.7 × daylight; shraddha/barsi, Raksha Bandhan, Vijaya Dashami, Bhai Dooj), madhyahna (sunrise + 0.5 × daylight; Ganesh Chaturthi, Rama Navami), pradosh (sunset + night/10, window sunset → sunset + night/5; Diwali/Dhanteras/Holika Dahan prefer the LATER day, Dharmasindhu "dinadvaye para"), nishita (middle of the night ± 24 min; Shivaratri, Janmashtami with Rohini preference between two qualifying days), moonrise (Sankashti, Karwa Chauth), begin. **Adhik month skipped (nija month used); kshaya tithi → the day it begins.**
- **Janma tithi** = tithi at the birth instant in the Amanta lunation of birth; recurrence by udaya. **Barsi** by aparahna; the matching Pitru Paksha day is the day whose aparahna tithi has the same number (Purnima → Purnima Shraddha, Amavasya → Sarvapitri). **Pitru Paksha** = Bhadrapada Purnima (aparahna) → Amavasya (aparahna), 15–16 days, kshaya tithis skipped.
- **Ekadashi**: Smarta day = first udaya day; `extra.vaishnavaDate` moves to the next day when Dashami runs at arunodaya (sunrise − 96 min) or Ekadashi touches two sunrises; parana = next day, max(sunrise, end of Hari Vasara = first quarter of Dwadashi) → min(Dwadashi end, sunrise + daylight/5); if Dwadashi has ended at sunrise → sunrise → sunrise + daylight/5. Names from the fork's Amanta-keyed table (Padmini/Parama in an Adhik month).
- **Bhadra-free festivals**: the puja window is clipped to its Bhadra-free part; if Bhadra covers all of it: Raksha Bandhan (aparahna) → next morning when Purnima still runs ≥ 3 muhurtas (144 min) after sunrise, else after Bhadra ends; Holika Dahan (pradosh) → after Bhadra ends, before the next sunrise.
- **Solar festivals**: sankranti day, or the next day when the sankranti is after sunset. **Nakshatra festivals** (Onam, Karthigai Deepam, Thaipusam): the day in the solar month whose sunrise has the nakshatra; two passages → the one nearest the full moon; two consecutive days → the larger daylight coverage; none → begin day.
- **Twelfth vrat family** = Vinayaka Chaturthi (Shukla Chaturthi at madhyahna), the monthly pair of Sankashti; the FEAT named eleven and the spec requires twelve.
- **Dasha**: fork's Vimshottari (365.2425-day years), tree extended to ≥ 120 years from birth. **Sade Sati / ingress**: exact sidereal sign crossings by scan + bisection (Saturn 2-day, Jupiter 1-day, mean node 5-day, true node 1-day steps), retrograde crossings included; no mean motion anywhere → `approx: false` on every date.
- **Dasha day-strength** = natural relation of the maha/antar lord to the vara lord (self/friend strong, neutral mixed, enemy weak; Rahu read as Saturn, Ketu as Mars).

## 4. Rule ids and parameter names emitted (the content clusters depend on these)

`dailyNote()` rows, fixed order, each `{order, ruleId, keys, params}`:

| order | ruleId | keys | params |
|---|---|---|---|
| 1 | `chandra-bala` | `chandra-bala-<house 1..12>` (8 = Chandrashtama) | `house, natalMoonSign, transitMoonSign (1-12), favourable, chandrashtama, moonSignEndsAt (ms|null), nextHouse` |
| 2 | `tara-bala` | `tara-bala-<1..9>` | `tara, taraKey (janma, sampat, vipat, kshema, pratyak, sadhana, naidhana, mitra, parama-mitra), natalNakshatra, dayNakshatra (1-27), auspicious, nakshatraEndsAt, nextTara` |
| 3 | `day-tithi-nakshatra` | `tithi-<1..30>`, `nakshatra-<1..27>`, `vara-<0..6>`, special-yoga keys (`amrit-siddhi`, `sarvartha-siddhi`, `ravi-pushya`, `guru-pushya`, `tripushkar`, `dwipushkar`, `ravi-yoga`), `bhadra-earth` / `bhadra-heaven` / `bhadra-patal`, `panchak` | `tithi, paksha, tithiEndsAt, nakshatra, nakshatraEndsAt, yoga (1-27), vara, specialYogas (comma list), bhadraStart, bhadraEnd, bhadraLocation, panchakStart, panchakEnd` |
| 4 | `sade-sati` | `sade-sati-phase-<1..3>` / `dhaiya-4` / `dhaiya-8` / `sade-sati-none` | `state (sadesati|dhaiya|none), phase, house, saturnSign, saturnHouseFromMoon, natalMoonSign, since, until, nextKind (sadesati-start|sadesati-phase|sadesati-end|dhaiya-start|dhaiya-end), nextAt, approx` |
| 5 | `dasha-lords` | `dasha-<maha>-<antar>` (planet ids Su Mo Ma Me Ju Ve Sa Ra Ke), `day-strength-<strong|mixed|weak>` | `maha, antar, pratyantar, mahaEnd, antarEnd, varaLord, mahaDayStrength, antarDayStrength, mahaRelation, antarRelation, mahaHoras[], antarHoras[]` |

`familyToday()` rows: `ruleId 'family-today'`, keys = the profile's chandra-bala + tara-bala keys, params = `name` + both rows' params.
Segment rule ids (goodHours rows / panchang segments): `rahu-kaal`, `yamaganda`, `gulika`, `abhijit`, `brahma-muhurat`, `choghadiya-<udveg|chal|labh|amrit|kaal|rog|shubh>`; flags `bhadra`, `panchak`; `dishaShool().ruleId = 'disha-shool'`.
Calendar rule ids: `vrat-<family>` (families `ekadashi, pradosh, sankashti, vinayakaChaturthi, masikShivaratri, purnima, amavasya, karwaChauth, chhath, teej, navratri, satyanarayan`; occurrence `name` keys e.g. `ekadashi-nirjala`, `ekadashi-padmini`, `pradosh-soma`, `sankashti-angaraki`, `teej-hartalika`, `navratri-sharad`, `vinayaka-chaturthi`, `masik-shivaratri`, `karwa-chauth`, `chhath`, `satyanarayan`; keyTime kinds `parana, pradosh, moonrise, nishita, madhyahna, sunset-to-sunrise, ghatasthapana, ghatasthapana-abhijit, sandhya, sunrise`), `festival-<slug>` (102 slugs in `data/festival-rules.json`), `janma-tithi`, `dasha-change`, `muhurat-<activity>`, `transit-<saturn|jupiter|rahu>`; Pitru Paksha day keys `purnima-shraddha`, `<tithi>-shraddha`, `sarvapitri-amavasya`.

## 5. Acceptance checks (FEAT-A03)

- goodHours is the only verdict producer: UI never classifies — spans and rows come from `mergeVerdicts()`; the property test passes for 365 × 5 (section 2.1).
- `panchang()` returns every F8 field for Delhi (tests `panchang.test.ts`; design-samples section 6): 2026-03-15 sunrise 06:31 IST (FEAT smoke value), Vikram 2082 / Shaka 1947 before Chaitra, both month systems, ritu/ayana, sun/moon rashi, moonrise/moonset, end times for tithi/nakshatra/yoga/karana.
- `dailyNote()` returns 5 ordered rows for the sample chart on 2026-10-22 (chandra-bala-6, tara-bala-4, tithi-11 + nakshatra-24 + vara-4 + bhadra-earth + panchak, sade-sati-none with next Dhaiya 2027-06-03, dasha-Ra-Ke + day-strength-mixed) and a Chandrashtama row (chandra-bala-8) on 2026-10-26.
- `upcoming()` returns the five kinds in order for a profile with a saved muhurat (familyTithi 2027-03-23, vrat, savedMuhurat, dashaChange 2027-04-24 Ketu→Venus, majorTransit Jupiter → Simha 2026-10-31).
- `festivals()`: 102 rules; 2026 / 2027 / 2028 return 109 / 113 / 112 entries for (purnimanta, north, Delhi) and 97 / 102 / 101 for (amanta, south, Chennai) — all ≥ 60 (multi-day spans count one entry per day; a slug can appear twice when its month falls in both January and December). Pitru Paksha: 2026-09-26 → 10-10 (15 days), 2027-09-15 → 09-29 (15), 2028-09-03 → 09-18 (16). Diwali 2026-11-08 (Kartik Krishna Amavasya at pradosh in Purnimanta naming = Ashwin Amavasya in Amanta), Dhanteras 11-06, Makar Sankranti 01-14 (2027: 01-15 by the after-sunset rule), Maha Shivaratri 02-15, Holika Dahan 03-02 (after Bhadra) / Holi 03-03, Chaitra Navratri from 03-19, Ram Navami 03-26, Raksha Bandhan 08-28 (moved to the morning after Bhadra), Janmashtami 09-04, Ganesh Chaturthi 09-14, Pitru Paksha 09-26 → 10-10, Sharad Navratri from 10-11, Dussehra 10-20, Karwa Chauth 10-29, Chhath 11-15, Onam 08-26, Pongal 01-14, Vishu 04-14, Karthigai Deepam 11-24.
- `tithiEventDates()`: Adhik Jyeshtha 2026 (17 May → 15 Jun) is skipped for a Jyeshtha janma tithi (2026-06-24, nija month); kshaya Chaitra Shukla Pratipada 2026 → begin day 2026-03-19; vriddhi Jyeshtha Purnima 2026 → first day 2026-06-29; Purnimanta Kartik Krishna Amavasya = Amanta Ashwin Amavasya (same dates). Pitru Paksha 2026: 15 days (Panchami kshaya). 12 vrat families each produce 2026 occurrences with key times (24 Ekadashis incl. Padmini/Parama, 25 Pradosh, 13 Sankashti, …).
- Dasha tree spans 120.56 years for the sample birth, `nextChange` strictly monotonic at every level, A02 dates reproduced (Rahu maha 2015-10-05 → 2033-10-05; Rahu-Venus antar from 2027-04-24). Saturn → Mesha 2027-06-03 (retrograde return 2027-10-20), Jupiter → Simha 2026-10-31, mean Rahu → Makara 2026-12-05.

## 6. design-samples.ts output, section (a): the three mock days with the merged goodHours model (R1-M5, N2; supersedes the mocks' SAMPLE numbers; mocks not edited)

```
=== (a) Mock days at New Delhi 28.6139/77.209 Asia/Kolkata ===

--- Thu 22 Oct 2026 (offset +330 min) ---
Sunrise 06:26 · Sunset 17:44 · Moonrise 15:21 · Moonset 02:22
Tithi Shukla Ekadashi till 14:48 · Nakshatra Shatabhisha till 20:48 · Yoga Vriddhi till 23:39 · Karana Vishti
Karana transitions: Vishti till 14:48, Bava till 02:48, Balava till 06:26
Masa Ashwina (fork amanta reckoning) · Ritu Sharad · Dakshinayana · Vikram 2083 · Shaka 1948 · Sun in Tula · Moon in Kumbha
Rahu Kaal 13:30-14:55 · Yamaganda 06:26-07:50 · Gulika 09:15-10:40 · Abhijit 11:42-12:28 · Brahma 04:44-05:35
Choghadiya day: Shubh 06:26-07:50 (good), Rog 07:50-09:15 (bad), Udveg 09:15-10:40 (bad), Chal 10:40-12:05 (neutral), Labh 12:05-13:30 (good), Amrit 13:30-14:55 (good), Kaal 14:55-16:19 (bad), Shubh 16:19-17:44 (good)
Choghadiya night: Amrit 17:44-19:20 (good), Chal 19:20-20:55 (neutral), Rog 20:55-22:30 (bad), Kaal 22:30-00:05 (bad), Labh 00:05-01:41 (good), Udveg 01:41-03:16 (bad), Shubh 03:16-04:51 (good), Amrit 04:51-06:26 (good)
Hora at noon: Moon · Vara Thu · Moon nakshatra pada 2
Varjyam: 22:19-00:02, 03:18-04:58, 03:16-04:53 · Amrit kalam: 08:37-10:21, 13:18-14:58, 12:58-14:35
goodHours ticks: sunrise 06:26 · noon 12:05 · sunset 17:44 · next sunrise 06:26 · moonrise 15:21 · legend good · neutral · avoid · night
goodHours band (11 spans, labels at 358 dp): 06:26-10:40 avoid [yamaganda, Rog choghadiya, gulika, Udveg choghadiya] <avoid>; 10:40-11:42 neutral [Chal choghadiya] <no label>; 11:42-13:30 good [abhijit, Labh choghadiya] <no label>; 13:30-16:19 avoid [rahu-kaal, Kaal choghadiya] <avoid>; 16:19-17:44 good [Shubh choghadiya] <no label>; 17:44-19:20 good (night) [Amrit choghadiya] <no label>; 19:20-20:55 neutral (night) [Chal choghadiya] <no label>; 20:55-00:05 avoid (night) [Rog choghadiya, Kaal choghadiya] <no label>; 00:05-01:41 good (night) [Labh choghadiya] <no label>; 01:41-03:16 avoid (night) [Udveg choghadiya] <no label>; 03:16-06:26 good (night) [Shubh choghadiya, brahma-muhurat, Amrit choghadiya] <no label>
goodHours rows (12 day + 9 night):
  day   rahu-kaal          13:30-14:55  avoid   flag: bhadra · flag: panchak
  day   yamaganda          06:26-07:50  avoid   flag: bhadra · flag: panchak
  day   gulika             09:15-10:40  avoid   flag: bhadra · flag: panchak
  day   abhijit            11:42-12:28  good    flag: bhadra · flag: panchak
  night brahma-muhurat     04:50-05:38  good    flag: panchak
  day   Shubh choghadiya   06:26-07:50  avoid   overridden by yamaganda · flag: bhadra · flag: panchak
  day   Rog choghadiya     07:50-09:15  avoid   flag: bhadra · flag: panchak
  day   Udveg choghadiya   09:15-10:40  avoid   flag: bhadra · flag: panchak
  day   Chal choghadiya    10:40-12:05  neutral 11:42-12:05 lifted by abhijit · flag: bhadra · flag: panchak
  day   Labh choghadiya    12:05-13:30  good    flag: bhadra · flag: panchak
  day   Amrit choghadiya   13:30-14:55  avoid   overridden by rahu-kaal · flag: bhadra · flag: panchak
  day   Kaal choghadiya    14:55-16:19  avoid   flag: panchak
  day   Shubh choghadiya   16:19-17:44  good    flag: panchak
  night Amrit choghadiya   17:44-19:20  good    flag: panchak
  night Chal choghadiya    19:20-20:55  neutral flag: panchak
  night Rog choghadiya     20:55-22:30  avoid   flag: panchak
  night Kaal choghadiya    22:30-00:05  avoid   flag: panchak
  night Labh choghadiya    00:05-01:41  good    flag: panchak
  night Udveg choghadiya   01:41-03:16  avoid   flag: panchak
  night Shubh choghadiya   03:16-04:51  good    flag: panchak
  night Amrit choghadiya   04:51-06:26  good    flag: panchak
goodHours flags: Panchak Wed 21 Oct 07:00 -> Sun 25 Oct 19:21 · Bhadra (earth) Thu 22 Oct 02:36 -> Thu 22 Oct 14:48
goodHours at 10:58: neutral · Chal choghadiya · Mercury hora · next: abhijit 11:42 (good)
goodHours hora: 06:26 Jupiter, 07:22 Mars, 08:19 Sun, 09:15 Venus, 10:12 Mercury, 11:08 Moon, 12:05 Saturn, 13:02 Jupiter, 13:58 Mars, 14:55 Sun, 15:51 Venus, 16:48 Mercury, 17:44 Moon, 18:48 Saturn, 19:51 Jupiter, 20:55 Mars, 21:58 Sun, 23:02 Venus, 00:05 Mercury, 01:09 Moon, 02:12 Saturn, 03:16 Jupiter, 04:19 Mars, 05:23 Sun
panchang F8: Shukla Ekadashi till 14:48, then Shukla Dwadashi till 14:36 · Nakshatra Shatabhisha (pada 2) till 20:48, then Purva Bhadrapada (pada 1) till 21:02 · Yoga Vriddhi till 23:39, then Dhruva till 22:08 · Karana Vishti (Bhadra) till 14:48, then Bava till 02:48, then Balava till 14:36
panchang F8: Vikram 2083 · Shaka 1948 · Month Purnimanta Ashwin · Amanta Ashwin · Ritu vedic Sharad / drik Sharad · Ayana vedic dakshinayana / drik dakshinayana · Sun Tula · Moon Kumbha · Moonrise 15:21 · Moonset 02:22 · Disha Shool south · Brahma (before this sunrise) 04:50-05:38

--- Fri 23 Oct 2026 (offset +330 min) ---
Sunrise 06:26 · Sunset 17:43 · Moonrise 15:51 · Moonset 03:20
Tithi Shukla Dwadashi till 14:36 · Nakshatra Purva Bhadrapada till 21:02 · Yoga Dhruva till 22:08 · Karana Balava
Karana transitions: Balava till 14:36, Kaulava till 02:12, Taitila till 06:27
Masa Ashwina (fork amanta reckoning) · Ritu Sharad · Dakshinayana · Vikram 2083 · Shaka 1948 · Sun in Tula · Moon in Kumbha
Rahu Kaal 10:40-12:05 · Yamaganda 14:54-16:19 · Gulika 07:51-09:16 · Abhijit 11:42-12:27 · Brahma 04:45-05:36
Choghadiya day: Chal 06:26-07:51 (neutral), Labh 07:51-09:16 (good), Amrit 09:16-10:40 (good), Kaal 10:40-12:05 (bad), Rog 12:05-13:29 (bad), Shubh 13:29-14:54 (good), Udveg 14:54-16:19 (bad), Chal 16:19-17:43 (neutral)
Choghadiya night: Rog 17:43-19:19 (bad), Kaal 19:19-20:54 (bad), Labh 20:54-22:30 (good), Udveg 22:30-00:05 (bad), Shubh 00:05-01:41 (good), Amrit 01:41-03:16 (good), Chal 03:16-04:52 (neutral), Rog 04:52-06:27 (bad)
Hora at noon: Mars · Vara Fri · Moon nakshatra pada 2
Varjyam: 03:18-04:58, 03:16-04:53, 06:26-08:00 · Amrit kalam: 13:18-14:58, 12:58-14:35, 15:50-17:24
goodHours ticks: sunrise 06:26 · noon 12:05 · sunset 17:43 · next sunrise 06:27 · moonrise 15:51 · legend good · neutral · avoid · night
goodHours band (14 spans, labels at 358 dp): 06:26-07:51 neutral [Chal choghadiya] <no label>; 07:51-09:16 avoid [gulika] <no label>; 09:16-10:40 good [Amrit choghadiya] <no label>; 10:40-13:29 avoid [rahu-kaal, Kaal choghadiya, Rog choghadiya] <avoid>; 13:29-14:54 good [Shubh choghadiya] <no label>; 14:54-16:19 avoid [yamaganda, Udveg choghadiya] <no label>; 16:19-17:43 neutral [Chal choghadiya] <no label>; 17:43-20:54 avoid (night) [Rog choghadiya, Kaal choghadiya] <no label>; 20:54-22:30 good (night) [Labh choghadiya] <no label>; 22:30-00:05 avoid (night) [Udveg choghadiya] <no label>; 00:05-03:16 good (night) [Shubh choghadiya, Amrit choghadiya] <no label>; 03:16-04:51 neutral (night) [Chal choghadiya] <no label>; 04:51-04:52 good (night) [brahma-muhurat] <no label>; 04:52-06:27 avoid (night) [Rog choghadiya] <no label>
goodHours rows (12 day + 9 night):
  day   rahu-kaal          10:40-12:05  avoid   flag: panchak
  day   yamaganda          14:54-16:19  avoid   flag: panchak
  day   gulika             07:51-09:16  avoid   flag: panchak
  day   abhijit            11:42-12:27  avoid   overridden by rahu-kaal, Kaal choghadiya, Rog choghadiya · flag: panchak
  night brahma-muhurat     04:51-05:39  avoid   overridden by Rog choghadiya · 04:51-04:52 keeps its own nature (good) · flag: panchak
  day   Chal choghadiya    06:26-07:51  neutral flag: panchak
  day   Labh choghadiya    07:51-09:16  avoid   overridden by gulika · flag: panchak
  day   Amrit choghadiya   09:16-10:40  good    flag: panchak
  day   Kaal choghadiya    10:40-12:05  avoid   flag: panchak
  day   Rog choghadiya     12:05-13:29  avoid   flag: panchak
  day   Shubh choghadiya   13:29-14:54  good    flag: panchak
  day   Udveg choghadiya   14:54-16:19  avoid   flag: panchak
  day   Chal choghadiya    16:19-17:43  neutral flag: panchak
  night Rog choghadiya     17:43-19:19  avoid   flag: panchak
  night Kaal choghadiya    19:19-20:54  avoid   flag: panchak
  night Labh choghadiya    20:54-22:30  good    flag: panchak
  night Udveg choghadiya   22:30-00:05  avoid   flag: panchak
  night Shubh choghadiya   00:05-01:41  good    flag: panchak
  night Amrit choghadiya   01:41-03:16  good    flag: panchak
  night Chal choghadiya    03:16-04:52  neutral 04:51-04:52 lifted by brahma-muhurat · flag: panchak
  night Rog choghadiya     04:52-06:27  avoid   flag: panchak
goodHours flags: Panchak Wed 21 Oct 07:00 -> Sun 25 Oct 19:21
goodHours at 10:58: avoid · Kaal choghadiya · Jupiter hora · next: Shubh choghadiya 13:29 (good)
goodHours hora: 06:26 Venus, 07:23 Mercury, 08:19 Moon, 09:16 Saturn, 10:12 Jupiter, 11:08 Mars, 12:05 Sun, 13:01 Venus, 13:58 Mercury, 14:54 Moon, 15:51 Saturn, 16:47 Jupiter, 17:43 Mars, 18:47 Sun, 19:51 Venus, 20:54 Mercury, 21:58 Moon, 23:02 Saturn, 00:05 Jupiter, 01:09 Mars, 02:12 Sun, 03:16 Venus, 04:20 Mercury, 05:23 Moon
panchang F8: Shukla Dwadashi till 14:36, then Shukla Trayodashi till 13:37 · Nakshatra Purva Bhadrapada (pada 2) till 21:02, then Uttara Bhadrapada (pada 1) till 20:31 · Yoga Dhruva till 22:08, then Vyaghata till 20:00 · Karana Balava till 14:36, then Kaulava till 02:12, then Taitila till 13:37
panchang F8: Vikram 2083 · Shaka 1948 · Month Purnimanta Ashwin · Amanta Ashwin · Ritu vedic Sharad / drik Sharad · Ayana vedic dakshinayana / drik dakshinayana · Sun Tula · Moon Kumbha · Moonrise 15:51 · Moonset 03:20 · Disha Shool west · Brahma (before this sunrise) 04:50-05:38

--- Mon 26 Oct 2026 (offset +330 min) ---
Sunrise 06:28 · Sunset 17:41 · Moonrise 17:34 · Moonset 06:26
Tithi Shukla Purnima till 09:41 · Nakshatra Ashwini till 17:41 · Yoga Vajra till 14:16 · Karana Bava
Karana transitions: Bava till 09:41, Balava till 20:24, Kaulava till 06:29
Masa Ashwina (fork amanta reckoning) · Ritu Hemant · Dakshinayana · Vikram 2083 · Shaka 1948 · Sun in Tula · Moon in Mesha
Rahu Kaal 07:52-09:16 · Yamaganda 10:40-12:04 · Gulika 13:29-14:53 · Abhijit 11:42-12:27 · Brahma 04:46-05:37
Choghadiya day: Amrit 06:28-07:52 (good), Kaal 07:52-09:16 (bad), Rog 09:16-10:40 (bad), Shubh 10:40-12:04 (good), Udveg 12:04-13:29 (bad), Chal 13:29-14:53 (neutral), Labh 14:53-16:17 (good), Amrit 16:17-17:41 (good)
Choghadiya night: Chal 17:41-19:17 (neutral), Rog 19:17-20:53 (bad), Kaal 20:53-22:29 (bad), Labh 22:29-00:05 (good), Udveg 00:05-01:41 (bad), Shubh 01:41-03:17 (good), Amrit 03:17-04:53 (good), Chal 04:53-06:29 (neutral)
Hora at noon: Venus · Vara Mon · Moon nakshatra pada 2
Varjyam: 07:56-09:28, 13:57-15:27, 02:28-03:56 · Amrit kalam: 17:04-18:36, 10:59-12:28, 11:15-12:43
goodHours ticks: sunrise 06:28 · noon 12:04 · sunset 17:41 · next sunrise 06:29 · moonrise 17:34 · legend good · avoid · night
goodHours band (11 spans, labels at 358 dp): 06:28-07:52 good [Amrit choghadiya] <no label>; 07:52-14:53 avoid [rahu-kaal, Kaal choghadiya, Rog choghadiya, yamaganda, Udveg choghadiya, gulika] <avoid>; 14:53-17:41 good [Labh choghadiya, Amrit choghadiya] <good>; 17:41-19:17 neutral (night) [Chal choghadiya] <no label>; 19:17-22:29 avoid (night) [Rog choghadiya, Kaal choghadiya] <no label>; 22:29-00:05 good (night) [Labh choghadiya] <no label>; 00:05-01:41 avoid (night) [Udveg choghadiya] <no label>; 01:41-04:53 good (night) [Shubh choghadiya, Amrit choghadiya] <no label>; 04:53-04:53 neutral (night) [Chal choghadiya] <no label>; 04:53-05:41 good (night) [brahma-muhurat] <no label>; 05:41-06:29 neutral (night) [Chal choghadiya] <no label>
goodHours rows (12 day + 9 night):
  day   rahu-kaal          07:52-09:16  avoid   
  day   yamaganda          10:40-12:04  avoid   
  day   gulika             13:29-14:53  avoid   
  day   abhijit            11:42-12:27  avoid   overridden by yamaganda, Udveg choghadiya
  night brahma-muhurat     04:53-05:41  good    
  day   Amrit choghadiya   06:28-07:52  good    
  day   Kaal choghadiya    07:52-09:16  avoid   
  day   Rog choghadiya     09:16-10:40  avoid   
  day   Shubh choghadiya   10:40-12:04  avoid   overridden by yamaganda
  day   Udveg choghadiya   12:04-13:29  avoid   
  day   Chal choghadiya    13:29-14:53  avoid   overridden by gulika
  day   Labh choghadiya    14:53-16:17  good    
  day   Amrit choghadiya   16:17-17:41  good    
  night Chal choghadiya    17:41-19:17  neutral 
  night Rog choghadiya     19:17-20:53  avoid   
  night Kaal choghadiya    20:53-22:29  avoid   
  night Labh choghadiya    22:29-00:05  good    
  night Udveg choghadiya   00:05-01:41  avoid   
  night Shubh choghadiya   01:41-03:17  good    
  night Amrit choghadiya   03:17-04:53  good    
  night Chal choghadiya    04:53-06:29  neutral 04:53-05:41 lifted by brahma-muhurat
goodHours flags: none
goodHours at 10:58: avoid · Shubh choghadiya · Sun hora · next: Labh choghadiya 14:53 (good)
goodHours hora: 06:28 Moon, 07:24 Saturn, 08:20 Jupiter, 09:16 Mars, 10:12 Sun, 11:08 Venus, 12:04 Mercury, 13:01 Moon, 13:57 Saturn, 14:53 Jupiter, 15:49 Mars, 16:45 Sun, 17:41 Venus, 18:45 Mercury, 19:49 Moon, 20:53 Saturn, 21:57 Jupiter, 23:01 Mars, 00:05 Sun, 01:09 Venus, 02:13 Mercury, 03:17 Moon, 04:21 Saturn, 05:25 Jupiter
panchang F8: Shukla Purnima till 09:41, then Krishna Pratipada till 07:01 · Nakshatra Ashwini (pada 2) till 17:41, then Bharani (pada 1) till 15:39 · Yoga Vajra till 14:16, then Siddhi till 10:52 · Karana Bava till 09:41, then Balava till 20:24, then Kaulava till 07:01
panchang F8: Vikram 2083 · Shaka 1948 · Month Purnimanta Ashwin · Amanta Ashwin · Ritu vedic Sharad / drik Hemanta · Ayana vedic dakshinayana / drik dakshinayana · Sun Tula · Moon Mesha · Moonrise 17:34 · Moonset 06:26 · Disha Shool east · Brahma (before this sunrise) 04:52-05:40
```

Reading notes for A10/A05 on the output above: a band span can be shorter than one minute at Brahma/choghadiya boundaries (e.g. Mon 26 Oct "04:53-04:53 neutral"): it is a real sub-minute Chal remainder before Brahma begins, drawn at < 1 dp; the UI should skip spans under 60 s in the accessibility text. Row notes are keys, not prose: the UI composes "overridden by Yamaganda", "11:42–12:05 lifted by Abhijit", "includes Brahma muhurat", "keeps its own nature 04:51–04:52" from `overriddenBy` / `parts` / `includes`.

## 7. Not verified (explicit)

- **No comparison with Drik Panchang or any external almanac in this step** (that is the A04 panchang and festival suites). All tithi/nakshatra/yoga/karana end times, Rahu Kaal etc. are the vendored fork's ephemeris + Lahiri ayanamsa; the festival dates listed in section 5 are the engine's own output. Known real-world anchors that the output does match from memory: Diwali 2026 = 8 Nov, Makar Sankranti 2026 = 14 Jan, Maha Shivaratri 2026 = 15 Feb, Chaitra Navratri 2026 from 19 Mar, Saturn → Mesha 3 Jun 2027, Jupiter → Simha 31 Oct 2026, mean Rahu → Makara 5 Dec 2026, Adhik Jyeshtha 17 May–15 Jun 2026 — not independently fetched.
- **Convention-dependent dates that A04 must check against Drik (and record as intentional differences if they differ)**: Holika Dahan when Bhadra covers the whole pradosh (2026-03-02 "after Bhadra", 2027-03-21 same); Raksha Bandhan moved to the next morning (2026-08-28, 2027-08-17, 2028-08-05); Bhai Dooj / Govardhan "first-of-two" aparahna/udaya picks (2026-11-10 both); Narak Chaturdashi 2026-11-08 (udaya, same day as Diwali); Govardhan Puja 2026-11-10 (Pratipada at sunrise) vs almanacs that put it on 11-09; Dev Uthani Ekadashi 2026-11-20 (kshaya → begin day); Janmashtami 2026-09-04 (nishita-begin-day); the pradosh "later day" preference for Diwali/Dhanteras; Ekadashi kshaya → begin day; Pitru Paksha day assignment by aparahna midpoint; Onam/Karthigai/Thaipusam passage choice; the Makar Sankranti after-sunset rule applied to every solar festival; Vikram/Shaka year change at the first (Adhik) Chaitra in 2029.
- **Abhijit on Wednesdays**: the engine lists Abhijit every weekday (design 10.2 lists 13 daytime segments without a weekday exception). Classical muhurta texts and Drik Panchang treat Abhijit as unavailable on Wednesdays. Not changed here because it would alter what the user sees against the design's literal segment set; flagged for the orchestrator/owner as a one-line decision (`segmentInputs()` is the single place to drop it).
- **Bhadra residence** is taken from the Moon's sign at the Bhadra start (a Bhadra that straddles a Moon sign change keeps the start value); Bhadra "mukha/puccha" sub-periods are not computed.
- **Sade Sati `approx` flag** is always `false` because dates come from exact ingress search, so the "approx." tag of design 10.3 F15 never appears from this module; the UI must not invent it.
- **Kshaya masa** (two sankrantis in one lunation, next in 2122) is flagged but its naming convention was not exercised by any test.
- **Hermes / React Native runtime**: everything ran under Node (vitest 5.0.5, tsx). `goodHours()` costs ≈ 5 ms and `dailyNote()` ≈ 200 ms (includes `sadeSati()` ≈ 160 ms for a 44-year Saturn scan and `dasha()`) on this PC; the app clusters should cache per day.
- **True-node ingress** (`ingressDates('Rahu', …, {node: 'true'})`) scans daily and costs ≈ 0.5 s per 2 years; only `upcoming()` for a true-node profile uses it.
- Root `npm test` (all workspaces) was not run; only the FEAT's three commands. No file outside `packages/engine/` changed. No Gradle/emulator work; disk unchanged (no downloads).
- Bhojpuri festival names in `data/festival-rules.json` (e.g. खिचड़ी, दियरी, जिउतिया, ललही छठ, बरसाइत, सम्मत) are agent-written and need the owner's Bhojpuri review like every bho string (docs/OWNER-TODO.md item).

## 8. Files changed

Modified: `packages/engine/src/index.ts`, `packages/engine/src/kundli/index.ts` (+ `naturalRelation`), `packages/engine/scripts/design-samples.ts`.
Added: `packages/engine/src/panchang/{astro,panchang,goodHours,index}.ts`, `packages/engine/src/rules/{daily,index}.ts`, `packages/engine/src/dasha/index.ts`, `packages/engine/src/calendar/{observance,tithiEvents,vrats,festivals,upcoming,index}.ts`, `packages/engine/data/festival-rules.json`, `packages/engine/vitest.config.ts`, `packages/engine/test/{panchang,goodhours,goodhours-property,rules,dasha,calendar,vrats}.test.ts`.

## 9. Commit and push

- ONE commit `e40ec3f` — `feat(engine): panchang, goodHours merge, daily rules, dasha, calendar rules` (25 files, +4,730 / −5; parent `92d9f26` = A02).
- `git pull --rebase origin main` → "Current branch main is up to date."; `git push origin main` → `92d9f26..e40ec3f  main -> main`. Working tree clean afterwards (`git --no-pager status --porcelain` empty; `.agents/` is gitignored, so this file and `features/FEAT-A03.json` live outside git by design).
- FEAT-A03.json: `status: "completed"`, `findings` filled (public API, rule ids and param names, conventions, sample truths, counts, performance, not-verified list).
