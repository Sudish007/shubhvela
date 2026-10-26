# Verification — A02 Engine foundation (tz table, gazetteer, ChartData, chart layout, locale, design samples)

Step: coder `a02-engine-foundation`, workflow `wf_86107bfa6c58305a`, Phase A, FEAT-A02. Date: 2026-10-24 (IST evening / 19:xx UTC).
Worktree: `c:/Users/sudiskmr/Downloads/DomainClassification/shubhvela`. Commit: `feat(engine): time-zone table, gazetteer build, chart data model and layout` (hash in section 8).

## 1. What was built

| Area | Files | Public functions / data |
|---|---|---|
| Time zones (F4, design 10.1, plan P10) | `packages/engine/scripts/build-tz-table.ts`, `packages/engine/data/tz-transitions.json` (578,830 bytes; header `tzdb: "2026e"`, 344 zones, 253 links, 36,180 transitions, range 1900–2100), `packages/engine/src/tz/index.ts` | `offsetAt(zone, utcMs)`, `localToUtc(zone, {y,m,d,hh,mm,ss?}) -> {utcMs, offsetMinutes, clockGap, overlap}`, `utcToWall(utcMs, zone)`, `canonicalZone(name)`, `hasZone(name)`, `zoneList()`, `zoneIndex(zone)`, `zoneAt(i)`, `formatInZone(utcMs, zone, pattern, lang)`, `formatOffset(min)`, `TZDB_VERSION` |
| Gazetteer (F1, plan P3, N8) | `packages/engine/scripts/build-gazetteer.ts`, `packages/engine/data/gazetteer.sqlite` (4,292,608 bytes), `packages/engine/data/gazetteer.meta.json`, `packages/engine/data/web-cities.json` (331 rows), `app/assets/gazetteer.sqlite` (byte-identical copy), `packages/engine/src/gazetteer/index.ts` | `searchPlaces(db, query, limit)`, `placeById(db, id)`, `gazetteerMeta(db)`, `foldToAscii(s)`; `GazetteerDb = { all(sql, params) }` so expo-sqlite and `node:sqlite` both fit |
| ChartData model (F2, F11, F19, P11) | `packages/engine/src/kundli/index.ts` | `computeChart(birth, opts) -> ChartData`, `varga(chart, 'D1'…'D60')`, `chalit(chart)` (Sripati), `moonChart(chart)`, `sunChart(chart)`, `trueNodeLongitude(utcMs)`, `signDignity(id, sign)`, constants `COMBUSTION_ORBS`, `EPHEMERIS`, `TRUE_NODE_METHOD`, `MEAN_NODE_METHOD`, `VARGA_IDS` |
| Chart layout (design 4, M19, M20) | `packages/engine/src/chart-layout/index.ts` | `layout(style, chart, fontScale, renderedWidth, {lang?, centreLines?}) -> ChartLayout`, `hitTest(layout, x, y)`, geometry helpers `pointInPolygon`, `distanceToPolygonEdges`, `boxInsidePolygon`, `boxesIntersect`, `segmentNearBox`, `estimateTextWidth`, `itemBox` |
| Locale tables | `packages/engine/src/locale/index.ts` (exported as the namespace `locale`, plus `LANGS`, `PLANET_IDS`, `PLANET_KEYS`, `planetIdFromKey`, `SIGN_LORDS`, `planetGlyphs`, `glyphScript`, types `Lang`, `PlanetId`) | weekday (long/short), Gregorian month (long/short), lunar month, sign (Sanskrit en + Western list), nakshatra (+ short), planet, tithi, paksha, yoga, karana, Bhadra/Adhik labels in en/hi/bho; Latin glyphs Su Mo Ma Me Ju Ve Sa Ra Ke and Devanagari glyphs सू चं मं बु गु शु श रा के |
| Design samples (R1-M5, N2) | `packages/engine/scripts/design-samples.ts` | output in section 6 |
| Tests | `packages/engine/test/{tz,gazetteer,kundli,chart-layout}.test.ts` (+ A01 `public-api`, `smoke`) | 55 tests in 6 files |
| Wiring | `packages/engine/package.json`: `build:data` = `tsx scripts/build-tz-table.ts && tsx scripts/build-gazetteer.ts` (the gazetteer step copies the sqlite into `app/assets/`); `design-samples` script; `packages/engine/src/index.ts` re-exports the new modules | |

## 2. Commands run (FEAT-A02 verification list) and results

### 2.1 `npm run build:data -w packages/engine`

```
tz-transitions.json: tzdb 2026e, 344 zones, 253 links, 36180 transitions, 565.3 KB (all tzdb zones)
build-gazetteer: cache C:\Users\sudiskmr\AppData\Local\Temp\shubhvela-geonames
  (first run downloaded cities1000.zip 10821 KB, cities15000.zip 3284 KB, alternatenames/IN.zip 1339 KB,
   alternatenames/NP.zip 419 KB, admin1CodesASCII.txt 148 KB, countryInfo.txt 31 KB; later runs use the cache)
  cities1000 171590 rows, cities15000 34180 rows, hindi names 1413, admin1 3865, countries 252
  rows 37937 (IN 7206, NP 74, name_hi 758), zones 260, countries 244
  gazetteer.sqlite 4.09 MB (budget 8 MB) -> also copied to app/assets/gazetteer.sqlite
  web cities: 300 IN + Kathmandu + 30 diaspora = 331
  diaspora resolved: London 2643743, Birmingham 2655603, Leicester 2644668, New York City 5128581, Edison 5097529,
    Chicago 4887398, Houston 4699066, Dallas 4684888, San Jose 5392171, Los Angeles 5368361, Atlanta 4180439,
    Washington 4140963, Toronto 6167865, Vancouver 6173331, Dubai 292223, Abu Dhabi 292968, Sharjah 292672,
    Doha 290030, Muscat 287286 (tz Asia/Dubai), Riyadh 108410, Kuwait City 285787 (tz Asia/Riyadh),
    Singapore 1880252 (tz Asia/Singapore), Kuala Lumpur 1735161 (tz Asia/Singapore), Sydney 2147714,
    Melbourne 2158177, Auckland 2193733, Durban 1007311, Port Louis 934154, Port of Spain 3573890
    (tz America/Puerto_Rico), Suva 2198148
  Kathmandu: 1283240 pop 1442271 tz Asia/Kathmandu
  largest IN: Mumbai 12691836; Delhi 11034555; Bengaluru 8495492; Hyderabad 6993262; Ahmedabad 6357693 ... smallest kept: Gadag 172612
```

GeoNames dump `Last-Modified`: Sat, 24 Oct 2026 01:56:31 GMT (cities), 02:00:38 / 02:01:15 (IN / NP alternate names), 02:02:21 (countryInfo). Exit code 0.

Gazetteer facts: **4,292,608 bytes (4.09 MB, budget 8 MB — test-enforced)**; 37,937 rows (cities1000 for IN NP BD LK PK BT = 7,206 IN + 74 NP + …; cities15000 elsewhere; the 331 web cities forced in); 758 rows carry a Hindi name (`name_hi`, GeoNames `alternateNames` lang=hi for IN/NP; 1,413 Hindi names exist in the dumps, the rest belong to places below the population cut); 260 distinct zones, all canonical ids of the tz table (test-enforced); 244 countries; indexes on `name_ascii` and `name_hi` (NOCASE); tables `places`, `countries`, `meta` (source, dump_last_modified, tzdb, generated, schema).

`web-cities.json`: 300 largest Indian places by GeoNames population (feature codes PPL* excluding sections/historical) + Kathmandu + the 30 diaspora cities of plan P3, each with `geonameid, name, nameAscii, nameHi, admin1, country, countryName, lat, lon, tz, slug, population, group`; slugs unique (collisions get the admin1 suffix).

### 2.2 `npm test -w packages/engine`

```
 RUN  v5.0.5 C:/Users/sudiskmr/Downloads/DomainClassification/shubhvela/packages/engine
 Test Files  6 passed (6)
      Tests  55 passed (55)
   Duration  5.26s
```

Per file: `tz.test.ts` 16 (F4 cases Delhi 1944-06-15 → +06:30; 1942-08-31 +05:30 vs 1942-09-01 +06:30 and the 1945-10-15 end; Kathmandu 1990 → +05:45 (1985 → +05:30); Dubai 2005 → +04:00; London 1988-07-01 → +01:00 / 1988-01-15 → +00:00; New York 2024-03-10 02:30 gap → 03:30 EDT with `clockGap`; London 2024-10-27 01:30 overlap → earlier BST instant with `overlap`; Madras Mean Time +05:21:10 kept to the second; `canonicalZone` links/case; `zoneIndex`/`zoneAt` round trip; `formatInZone` en/hi/bho; ICU self-test 344 zones × 2,000 seeded-random instants = 688,000 comparisons, plus every zone id accepted by `Intl`), `gazetteer.test.ts` 9, `kundli.test.ts` 16, `chart-layout.test.ts` 10 (incl. 2,016 layouts: 3 styles × 12 houses × 1..7 planets × en/hi × fontScale 1.0/1.3 × widths 296/412 with zero glyph/badge/label outside its house, zero box intersections, rendered size ≥ 12 sp), `public-api.test.ts` 3, `smoke.test.ts` 1.

### 2.3 `npm run typecheck`

All five workspaces (`content`, `content-tools`, `engine`, `app`, `web`) `tsc --noEmit` clean, exit code 0.

### 2.4 `npx tsx packages/engine/scripts/design-samples.ts`

Exit code 0; full output in section 6.

## 3. Time-zone table details (plan P10, design 10.1 F4)

- Source: `moment-timezone` 0.6.5 `data/packed/latest.json`, unpacked with `moment.tz.unpack`; **tzdb 2026e** (recorded in `header.tzdb`). Periods clipped to 1900-01-01 … 2100-12-31; consecutive identical offsets merged. moment's data carries rule-generated transitions through 2499, so the "post-2037 extrapolation" of P10 was not needed (header field `future` says so).
- Shape: `zones[id] = { untils: UTC seconds[], offsets: minutes east[] }` with `offsets.length = untils.length + 1`; `links[alias] = canonical`. Renames applied to the current IANA spelling: Europe/Kiev → Europe/Kyiv, Pacific/Enderbury → Pacific/Kanton, America/Godthab → America/Nuuk, Asia/Rangoon → Asia/Yangon, Asia/Kuala_Lumpur → Asia/Singapore, Asia/Brunei → Asia/Kuching (old names kept as links). N8: the gazetteer build maps every GeoNames zone through `canonicalZone()` and fails if a zone is missing (none was).
- **Deviation from P10, deliberate:** the committed table keeps **all 344 zones (565 KB)** instead of only the gazetteer + web-city zones (288 zones, 427 KB), because `tz-lookup` for manually entered coordinates can return any zone and design 11's "zone id missing from the table" row must stay unreachable. The restriction is available with `SHUBHVELA_TZ_RESTRICT=1` (reads `gazetteer.meta.json.zones`). No user-visible effect.
- Runtime never touches `Intl`; `formatInZone` uses the locale tables and Latin digits.
- ICU self-test: Node 24.16.0 ships ICU 78.3 with **tzdata 2026b**; the table is **2026e**. A 6-hourly sweep of every zone over 1900 … 2026-06-01 found exactly three past divergences, all explained by the tzdb NEWS file (https://data.iana.org/time-zones/tzdb/NEWS): Europe/Dublin 1925-09-20..10-04 (2026e: "In 1925 Ireland fell back on 09-20 not 10-04"), America/Bogota 1992-05-02 (2026d: Colombia's spring forward at 00:00 not 24:00), Asia/Tehran 1979-05-26 (2026d: Iran's spring forward at 00:00 not 24:00); and the POSIX-style names CST6CDT/EST5EDT/MST7MDT/PST8PDT before 1966-10-30 (2026d reverted them to US federal rules). Future timestamps differ for Alberta (permanent −06, 2026c), Northwest Territories (permanent −06, 2026d), Manitoba (permanent −05, 2026e) and Morocco/Western Sahara (permanent +00 from 2026-09-20, 2026c). The vitest self-test therefore samples 1900 … 2026-06-01 and skips exactly those four documented past windows; the table's newer values are asserted explicitly.

## 4. ChartData model details (F2, F11, F19, P11)

- `computeChart({date, time?, timeUnknown?, approxMinutes 0|15|30|60, tz, lat, lon, elevation?}, {ayanamsa lahiri|kp|raman, node mean|true, houseSystem whole_sign})`. Wall time → UTC through the tz table (gap/overlap flags copied to `meta.clockGap`/`meta.overlap`). Positions from the fork's `getPlanetaryPosition` / `getUdayaLagna` / `getRahuPosition`; Ketu = Rahu + 180.
- Dignity tags per design 4 (Parashara natural friendships; exalted/debilitated/own/friend/enemy/neutral; moolatrikona folded into `own`; nodes carry no relationship tag), plus `combust` (fork orbs: Moon 12, Mars 17, Mercury 14/12 R, Jupiter 11, Venus 10/8 R, Saturn 15 — listed in `meta.combustionOrbs` for "How this was computed"), `retro` (not for the always-retrograde nodes), `vargottama` (same sign in D1 and D9).
- F2 approx rule: any body or the Lagna within 1° of a sign boundary, or whose longitude at utc ± approxMinutes falls in a different sign (`drift` kept on the point). `timeUnknown` (or no time): positions at local noon, drift ±12 h, `lagna` undefined, `moonChart: true`, houses counted from the Moon sign; `chalit()` refuses (needs a birth time).
- `varga()` uses the fork's `getAllVargas` sign rules (D1–D12, D16, D20, D24, D27, D30, D40, D45, D60); `chalit()` = Sripati bhavas via the fork's `getHouses(…, 'sripati', date, observer, ayanamsa)` with the astronomical Midheaven; `moonChart()`/`sunChart()` re-count houses.
- **P11 fork limitation confirmed:** the fork has only the mean node (`getRahuPosition`, Meeus). `trueNodeLongitude(utcMs)` interpolates the Moon's longitude between the surrounding `SearchMoonNode`/`NextMoonNode` crossings (astronomy-engine); `meta.nodeMethod` = "true node (interpolated between crossings)". For the sample birth: true Rahu 136.73° vs mean 136.08°.
- Fork limitations noticed for later clusters: `getKundli()` formats `birthDetails` with `Intl`/device time zone (not used by `computeChart`); `calculateVimshottariDasha` defaults `asOf` to `new Date()` (the script passes an explicit as-of through `getVimshottariDasha`); the fork's Brahma muhurta uses night/15 muhurtas (04:44–05:35 on 2026-10-22 Delhi) while Drik Panchang uses 48-minute muhurtas (would be 04:50–05:38) — A03 must pick the convention and A04 validates; the fork's `getPanchangam` masa is Amanta only.

## 5. Chart layout details (design 4, M19, M20)

- `viewBox 0 0 320 320`, frame at 1…319. North: 12 fixed diamonds/triangles, Lagna sign in the top diamond, houses anticlockwise, numerals 22 (diamonds) / 24 (triangles) units inside the inner vertex on the bisector. South: 4×4 grid of 79.5-unit cells, signs clockwise from Meena top-left, Lagna (first-house) mark = 2 px diagonal in the top-left of the cell, sign names at the bottom-left. East: 3×3 with the four corners split by the outer→inner diagonal, houses anticlockwise from the top centre, numerals at the right-angle (outer) vertex of each corner triangle and at the mock positions for the four edge rectangles; corner-triangle glyphs are start/end-anchored toward the outer corner and stack past the numeral so they never touch the diagonal.
- Text sizes: `labelSize = 12 × fontScale ÷ (renderedWidth/320)`, `glyphSize = 13.5 (Latin) | 14.5 (Devanagari) × fontScale ÷ (renderedWidth/320)` → rendered 12 sp / 13.5 sp / 14.5 sp × fontScale. Density: 2×2 (two per line, line gap 18 units at 13.5) → 3×2 at five or more planets (glyph × 0.9) → "+N" badge beyond six (5 glyphs + badge; hidden planets listed per house). If a block would overflow its house (polygon with 1.5-unit stroke margin, sign label box, South Lagna diagonal) the layout tries the denser mode first, then ONE chart-wide shrink step (uniform glyph size) down to the 12 sp floor, then hides planets behind the badge.
- **Layout rule not spelled out in design.md (recorded, no pause needed):** in the South style the sign-name label falls back to the sign numeral when the name would overflow its cell at the current fontScale (e.g. "Vrishchika" at 1.3× on a 296-dp card); numerals are already the North/East vocabulary and the alternative is clipped text (HARD rule). At 1.0× all twelve English and Devanagari names fit at 296 dp and above.
- `hitTest`: point-in-polygon → nearest glyph centre within the house; ambiguous (open the house sheet) when the two nearest centres are both within 12 dp or the house hides planets; empty house → house only; outside every house (South/East centre) → null.
- Measured on the sample chart (Priya): at 296 dp / 1.0× all three styles use 2×2 with glyphs at 12.0 sp rendered minimum (labels) and 13.5 sp (glyphs); at 296 dp / 1.3× North and South step the 3-planet houses to 3×2 and shrink once (min rendered 15.0 / 13.4 sp), East stays 2×2 (15.6 sp). No box ever leaves its house and no two boxes intersect (2,016-layout test).

## 6. design-samples.ts output (R1-M5, N2) — these computed values supersede the mocks' SAMPLE numbers; the mocks were not edited

```
design-samples 2026-10-24T19:12:33.247Z | tzdb 2026e | ephemeris astronomy-engine 2.1.19 | ayanamsa Lahiri | node mean

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

=== (b) Sample chart: 1998-03-14 06:42 Lucknow 26.85/80.95 Asia/Kolkata (approx +-30 min, Lahiri, mean node, whole sign) ===
UTC 1998-03-14T01:12:00.000Z (offset +330 min) · ayanamsa 23.8319°
Lagna Meena 6°44′ Uttara Bhadrapada 2 [approx.: +-30 min drift 326.27..347.20 crosses a sign boundary]
Planets (D1):
  Sun      Kumbha      29°25′   Purva Bhadrapada 3     H12  enemy [approx.]
  Moon     Kanya       8°45′    Uttara Phalguni 4      H7   friend
  Mars     Meena       13°24′   Uttara Bhadrapada 4    H1   friend, combust
  Mercury  Meena       16°01′   Uttara Bhadrapada 4    H1   debilitated
  Jupiter  Kumbha      15°10′   Shatabhisha 3          H12  neutral, vargottama
  Venus    Makara      13°45′   Shravana 2             H11  friend
  Saturn   Meena       25°44′   Revati 3               H1   neutral
  Rahu     Simha       16°04′   Purva Phalguni 1       H6   vargottama
  Ketu     Kumbha      16°04′   Shatabhisha 3          H12  vargottama
Houses (whole sign): 1:Meena/Ju[Ma Me Sa] 2:Mesha/Ma 3:Vrishabha/Ve 4:Mithuna/Me 5:Karka/Mo 6:Simha/Su[Ra] 7:Kanya/Me[Mo] 8:Tula/Ve 9:Vrishchika/Ma 10:Dhanu/Ju 11:Makara/Sa[Ve] 12:Kumbha/Sa[Su Ju Ke]
D9 Navamsa: Lagna Kanya · Su Mithuna, Mo Meena, Ma Vrishchika, Me Vrishchika, Ju Kumbha*, Ve Vrishabha, Sa Kumbha, Ra Simha*, Ke Kumbha* (* = vargottama)
Chalit (Sripati): Su H1, Mo H7, Ma H1, Me H1, Ju H12, Ve H11, Sa H2, Ra H6, Ke H12 · cusps 1:Meena 2:Mesha 3:Vrishabha 4:Mithuna 5:Karka 6:Simha 7:Kanya 8:Tula 9:Vrishchika 10:Dhanu 11:Makara 12:Kumbha
Moon chart first house: Kanya · Moon Uttara Phalguni pada 4
Vimshottari dasha (as of 22 Oct 2026 10:58): birth nakshatra Uttara Phalguni pada 4
  Mahadashas: Sun 14 Mar 1998 - 5 Oct 1998; Moon 5 Oct 1998 - 5 Oct 2008; Mars 5 Oct 2008 - 5 Oct 2015; Rahu 5 Oct 2015 - 5 Oct 2033; Jupiter 5 Oct 2033 - 5 Oct 2049; Saturn 5 Oct 2049 - 4 Oct 2068; Mercury 4 Oct 2068 - 4 Oct 2085; Ketu 4 Oct 2085 - 4 Oct 2092; Venus 4 Oct 2092 - 5 Oct 2112
  Now: Rahu mahadasha (5 Oct 2015 - 5 Oct 2033) · Ketu antardasha (5 Apr 2026 - 24 Apr 2027) · Rahu pratyantar (12 Sep 2026 - 9 Nov 2026)
  Next antardasha: Rahu-Venus from 24 Apr 2027 (184 days from as-of)

How this was computed: Lahiri ayanamsa, mean node, astronomy-engine ephemeris, time zone Asia/Kolkata from the bundled tz table (historical rules), whole-sign houses, Sripati chalit; times rounded to the minute.
```

Differences from the mocks' SAMPLE text worth noting for A05/A10/A11 (the mocks are placeholders by rule): the sample profile's Moon is **Kanya · Uttara Phalguni 4** (mock said Vrishchika · Anuradha), the running dasha is **Rahu mahadasha / Ketu antardasha** (mock said Ketu / Rahu), the Lagna is **Meena 6°44′** (mock 0°48′), Delhi 2026-10-22 sunrise/sunset/moonrise are **06:26 / 17:44 / 15:21** (mock 06:27 / 17:41 / 14:36), Rahu Kaal **13:30–14:55**, Abhijit **11:42–12:28**. The tithi (Ashwin Shukla Ekadashi on Thu 22 Oct, Purnima on Mon 26 Oct) and the Vikram/Shaka years match the mocks.

## 7. Not verified (explicit)

- F4 acceptance "match reference calculators": the four births were verified against the IANA tzdb (through the generated table and Node's ICU), not against an external astrology calculator's chart; planet/Lagna positions against drikpanchang/AstroSage are the A04 chart suite (not run here).
- The design-sample panchang values (sunrise, tithi/nakshatra end times, Rahu Kaal, Brahma muhurta, choghadiya) are the vendored fork's output and were NOT compared with Drik Panchang; that is the A04 panchang suite. The Brahma-muhurta convention difference (night/15 vs 48 min) is flagged in section 4 for A03/A04.
- Hermes / React Native runtime: the tz table, gazetteer interface and layout ran only under Node (vitest, tsx). Opening `app/assets/gazetteer.sqlite` with expo-sqlite (`importDatabaseFromAssetAsync`) and the Metro `assetExts` wiring are exercised first in the app clusters (A06+).
- Chart layout was verified numerically (no box leaves its house, no intersections, ≥ 12 sp) but not visually: no renderer exists yet (A09/A11 draw it with react-native-svg; D01 on the web). Text widths are Noto Sans estimates, not measured glyph metrics.
- Hindi names: only 758 of 7,280 IN/NP rows have a GeoNames Hindi alternate name; Devanagari search therefore reaches only those places. Not changed (GeoNames is the only data source in scope).
- `tz-lookup` (manual coordinates → zone) is a devDependency and is not yet called anywhere; the app cluster that adds the "Advanced" lat/lon field wires it.
- Root `npm test` (all workspaces) was not re-run in this step; only `npm test -w packages/engine` (required) and root `npm run typecheck` (required, clean). No file outside `packages/engine/` and `app/assets/gazetteer.sqlite` changed.
- Disk: 2.98 GB free on C: after this step (GeoNames cache ≈ 16 MB in `%TEMP%\shubhvela-geonames`); no Gradle/emulator work in this step.

## 8. Commit and push

- ONE commit `92d9f26` — `feat(engine): time-zone table, gazetteer build, chart data model and layout` (19 files, +9,384 / −4; parent `743c16c` = A01 bootstrap).
- `git pull --rebase origin main` → "Current branch main is up to date."; `git push origin main` → `743c16c..92d9f26 main -> main`. Working tree clean afterwards (`git --no-pager status --porcelain` empty; `.agents/` is gitignored, so this file and `features/FEAT-A02.json` live outside git by design).
- FEAT-A02.json: `status: "completed"`, `findings` filled (public names, data paths, fork limitations, tzdb/ICU divergences, sample-profile truths for later clusters).
