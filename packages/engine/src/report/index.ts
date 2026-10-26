// Report data models (spec F31 + F40, design 10.6 "Janam Patri PDF", "Matching report PDF", "Varshaphal report
// PDF", plan B01). Pure data: every value is computed here from ChartData and the engine modules; B07 renders the
// HTML, embeds the fonts and gates the purchase. Labels are keys (planet ids, sign numbers, i18n keys) with a few
// pre-resolved display names from the locale tables for the language asked, so the renderer never computes.
//
// Conventions:
// - Panchang at birth: tithi, nakshatra, yoga and karana are the values running at the birth instant; vara, lunar
//   month, samvat, sunrise/sunset and moonrise are those of the Vedic day holding the instant (a birth before sunrise
//   belongs to the previous civil date's Vedic day). Unknown time -> the civil date's sunrise values, marked approx.
// - Avakahada chakra: varna, vashya, yoni, gana, nadi, nakshatra-charan, rashi (Moon sign), lagna (BPHS / Muhurta
//   Chintamani tables, the same tables the matching kootas use), plus the name syllable (naamkaran table), tatva
//   (element of the Moon sign), nakshatra lord and rashi lord.
// - Ghatak chakra (Muhurta Chintamani, "ghata" verses; the table every Janam Patri prints): for the Moon sign the
//   ghata month (Purnimanta name), tithi group, weekday, nakshatra, yoga, karana, ghata Moon sign and ghata Lagna.
//   The prahar column of some printed tables is omitted because no classical verse for it could be confirmed in B01.
// - Mangal dosha statement: matching.mangalDosha() with its cancellation rows.
// - "How this was computed": ayanamsa name and value, node method, ephemeris, time-zone source (tzdb release),
//   house system, rounding (arc-second), plus the rule ids of the conventions the report used.
import { NAKSHATRA_GANA, NAKSHATRA_NADI, NAKSHATRA_YONI, RASHI_VARNA, RASHI_VASHYA } from '../../vendor/jyotish/src/matching/constants';
import { type AshtakootaResult, type BeyondGunMilanReport, type MangalPairReport, type MangalDoshaReport, ashtakoota, beyondGunMilan, mangalDosha, mangalDoshaPair } from '../matching/index';
import { type ChartData, type ChartPlanet, type DignityTag, moonChart as toMoonChart, varga } from '../kundli/index';
import { type DashaNode, type DashaTree, current, dasha } from '../dasha/index';
import { LANGS, type Lang, type PlanetId, SIGN_LORDS, lunarMonthNames, nakshatraNames, planetNames, signNames, tithiNames, weekdayNames, yogaNames, karanaNames } from '../locale/index';
import { type NaamkaranResult, syllablesForChart } from '../naamkaran/index';
import { type GeoPoint, karanaInterval, localDateOf, nakshatraIndexAt, resolveZone, yogaIndexAt } from '../panchang/astro';
import { type PanchangDay, NAKSHATRA_LORDS, panchang, tithiAt } from '../panchang/panchang';
import { type VarshaphalReport, varshaphal } from '../varshaphal/index';
import { TZDB_VERSION, formatInZone, formatOffset, utcToWall } from '../tz/index';

export const REPORT_RULE_IDS = ['avakahada-chakra', 'ghatak-chakra', 'how-computed'] as const;
export const REPORT_DISCLAIMER_KEY = 'disclaimer.report';

export interface ReportProfile {
  name?: string;
  placeName?: string;
  gender?: 'f' | 'm' | 'x';
}

export interface ComputedWithLine {
  /** i18n key of the line label (report.computed.<key>). */
  key: 'ayanamsa' | 'node' | 'ephemeris' | 'timezone' | 'houseSystem' | 'rounding' | 'conventions';
  value: string;
}

export interface ReportHeader {
  name: string | null;
  gender: 'f' | 'm' | 'x' | null;
  birthDate: string;
  birthTime: string | null;
  timeUnknown: boolean;
  approxMinutes: number;
  place: string | null;
  lat: number;
  lon: number;
  tz: string;
  offset: string;
  clockGap: boolean;
  /** Formatted in the profile zone and language ("Saturday 14 March 1998 · 06:42"). */
  birthLine: string;
  generatedAt: string;
  lang: Lang;
}

export interface PanchangAtBirth {
  approx: boolean;
  vedicDate: string;
  vara: number;
  varaName: string;
  tithi: { n: number; paksha: 'shukla' | 'krishna'; name: string; endsAt: number };
  nakshatra: { n: number; pada: number; name: string; lord: PlanetId; endsAt: number };
  yoga: { n: number; name: string };
  karana: { n: number; name: string; bhadra: boolean };
  monthAmanta: { index: number; adhik: boolean; name: string };
  monthPurnimanta: { index: number; adhik: boolean; name: string };
  vikramSamvat: number;
  shakaSamvat: number;
  sunrise: number | null;
  sunset: number | null;
  moonrise: number | null;
  moonSign: { n: number; name: string };
  sunSign: { n: number; name: string };
}

export interface PlanetTableRow {
  id: PlanetId;
  name: string;
  sign: number;
  signName: string;
  /** "dd°mm'" with Latin digits (design 2.2). */
  degree: string;
  longitude: number;
  nakshatra: number;
  nakshatraName: string;
  pada: number;
  house: number;
  tags: DignityTag[];
  retrograde: boolean;
  combust: boolean;
  approx: boolean;
}

export interface DashaTableRow {
  lord: PlanetId;
  name: string;
  start: number;
  end: number;
  current: boolean;
  antars: { lord: PlanetId; name: string; start: number; end: number; current: boolean }[];
}

export interface AvakahadaChakra {
  varna: 'brahmin' | 'kshatriya' | 'vaishya' | 'shudra';
  vashya: 'chatushpada' | 'manava' | 'jalachara' | 'vanachara' | 'keeta';
  yoni: string;
  gana: 'deva' | 'manushya' | 'rakshasa';
  nadi: 'adi' | 'madhya' | 'antya';
  nakshatra: { n: number; name: string };
  nakshatraCharan: number;
  nakshatraLord: PlanetId;
  rashi: { n: number; name: string; lord: PlanetId };
  lagna: { n: number; name: string; lord: PlanetId } | null;
  tatva: 'fire' | 'earth' | 'air' | 'water';
  nameSyllable: NaamkaranResult;
  ruleId: 'avakahada-chakra';
}

export interface GhatakChakra {
  moonSign: number;
  /** Purnimanta month index 0 = Chaitra and its name. */
  month: { index: number; name: string };
  tithiGroup: 'nanda' | 'bhadra' | 'jaya' | 'rikta' | 'purna';
  /** Tithis (1-15 of either paksha) in the group. */
  tithis: number[];
  vara: { n: number; name: string };
  nakshatra: { n: number; name: string };
  yoga: { n: number; name: string };
  karana: { n: number; name: string };
  chandra: { n: number; name: string };
  lagna: { n: number; name: string };
  ruleId: 'ghatak-chakra';
}

export interface JanamPatriModel {
  kind: 'janam-patri';
  lang: Lang;
  header: ReportHeader;
  panchangAtBirth: PanchangAtBirth;
  charts: { d1: ChartData; d9: ChartData; moon: ChartData };
  planetTable: PlanetTableRow[];
  dashaTable: DashaTableRow[];
  dashaBalance: DashaTree['balanceAtBirth'];
  avakahada: AvakahadaChakra;
  ghatakChakra: GhatakChakra;
  mangalStatement: MangalDoshaReport;
  computedWith: ComputedWithLine[];
  disclaimer: string;
  ruleIds: string[];
}

export interface MatchingReportModel {
  kind: 'matching';
  lang: Lang;
  a: { header: ReportHeader; chart: ChartData; moon: ChartData };
  b: { header: ReportHeader; chart: ChartData; moon: ChartData };
  ashtakoota: AshtakootaResult;
  mangal: MangalPairReport;
  beyond: BeyondGunMilanReport;
  computedWith: ComputedWithLine[];
  disclaimer: string;
  ruleIds: string[];
}

export interface VarshaphalReportModel {
  kind: 'varshaphal';
  lang: Lang;
  header: ReportHeader;
  year: number;
  age: number;
  /** Solar-return line in the profile zone ("Saturday 14 March 2026 · 11:02"). */
  returnLine: string;
  varshaphal: VarshaphalReport;
  planetTable: PlanetTableRow[];
  muddaTable: { lord: PlanetId; name: string; start: number; end: number }[];
  transitTable: { planet: PlanetId; name: string; sign: number; signName: string; from: number; to: number; retrogradeEntry: boolean }[];
  computedWith: ComputedWithLine[];
  disclaimer: string;
  ruleIds: string[];
}

const VARNA_KEYS = ['brahmin', 'kshatriya', 'vaishya', 'shudra'] as const;
const VASHYA_KEYS = ['chatushpada', 'manava', 'jalachara', 'vanachara', 'keeta'] as const;
const YONI_KEYS = ['horse', 'elephant', 'sheep', 'snake', 'dog', 'cat', 'rat', 'cow', 'buffalo', 'tiger', 'deer', 'monkey', 'mongoose', 'lion'] as const;
const GANA_KEYS = ['deva', 'manushya', 'rakshasa'] as const;
const NADI_KEYS = ['adi', 'madhya', 'antya'] as const;
const TATVA: readonly AvakahadaChakra['tatva'][] = ['fire', 'earth', 'air', 'water'];
const TITHI_GROUPS: Record<GhatakChakra['tithiGroup'], number[]> = { nanda: [1, 6, 11], bhadra: [2, 7, 12], jaya: [3, 8, 13], rikta: [4, 9, 14], purna: [5, 10, 15] };

/**
 * Ghatak chakra rows by Moon sign (0 = Mesha): [Purnimanta month index (0 = Chaitra), tithi group, vara 0-6,
 * nakshatra 1-27, yoga 1-27, karana index 0-10 (locale.karanaNames order), ghata Moon sign 1-12]. Muhurta Chintamani
 * ghata verses: months Kartik, Margashirsha, Ashadha, Pausha, Jyeshtha, Bhadrapada, Magha, Phalguna, Chaitra,
 * Vaishakha, Shravana, Ashwin; tithi groups Nanda, Purna, Bhadra, Bhadra, Jaya, Purna, Rikta, Nanda, Jaya, Rikta,
 * Jaya, Purna; weekdays Sun, Sat, Mon, Wed, Sat, Sat, Thu, Fri, Fri, Tue, Thu, Fri; nakshatras Magha, Hasta, Swati,
 * Anuradha, Mula, Shravana, Shatabhisha, Revati, Rohini, Mrigashira, Ardra, Ashlesha; ghata Moon signs Mesha, Kanya,
 * Kumbha, Mesha, Simha, Mithuna, Mithuna, Kanya, Meena, Mesha, Dhanu, Kumbha; the ghata Lagna is the sign itself.
 */
export const GHATAK_TABLE: readonly (readonly [number, GhatakChakra['tithiGroup'], number, number, number, number, number])[] = [
  [7, 'nanda', 0, 10, 1, 0, 1],
  [8, 'purna', 6, 13, 2, 1, 6],
  [3, 'bhadra', 1, 15, 3, 2, 11],
  [9, 'bhadra', 3, 17, 4, 3, 1],
  [2, 'jaya', 6, 19, 5, 4, 5],
  [5, 'purna', 6, 22, 6, 5, 3],
  [10, 'rikta', 4, 24, 7, 6, 3],
  [11, 'nanda', 5, 27, 8, 7, 6],
  [0, 'jaya', 5, 4, 9, 8, 12],
  [1, 'rikta', 2, 5, 10, 9, 1],
  [4, 'jaya', 4, 6, 11, 10, 9],
  [6, 'purna', 5, 9, 12, 0, 11],
];

function moonOf(chart: ChartData): ChartPlanet {
  const m = chart.planets.find((p) => p.id === 'Mo');
  if (!m) throw new Error('Chart has no Moon');
  return m;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function degreeString(p: { degree: number; minute: number }): string {
  return `${p.degree}°${pad2(p.minute)}′`;
}

function header(chart: ChartData, profile: ReportProfile, lang: Lang, nowMs: number): ReportHeader {
  const w = utcToWall(chart.meta.utcMs, chart.meta.tz);
  const date = `${w.y}-${pad2(w.m)}-${pad2(w.d)}`;
  const time = chart.meta.timeUnknown ? null : `${pad2(w.hh)}:${pad2(w.mm)}`;
  return {
    name: profile.name ?? null,
    gender: profile.gender ?? null,
    birthDate: date,
    birthTime: time,
    timeUnknown: chart.meta.timeUnknown,
    approxMinutes: chart.meta.timeUnknown ? 0 : chart.meta.approxMinutes,
    place: profile.placeName ?? null,
    lat: chart.meta.lat,
    lon: chart.meta.lon,
    tz: chart.meta.tz,
    offset: formatOffset(chart.meta.offsetMinutes),
    clockGap: chart.meta.clockGap,
    birthLine: chart.meta.timeUnknown ? formatInZone(chart.meta.utcMs, chart.meta.tz, 'EEEE d MMMM yyyy', lang) : formatInZone(chart.meta.utcMs, chart.meta.tz, "EEEE d MMMM yyyy '·' HH:mm", lang),
    generatedAt: new Date(nowMs).toISOString(),
    lang,
  };
}

/** The Vedic-day panchang holding the birth instant (sunrise before the instant). */
function vedicDay(chart: ChartData): PanchangDay {
  const geo: GeoPoint = { lat: chart.meta.lat, lon: chart.meta.lon, elevation: chart.meta.elevation };
  const zone = resolveZone(chart.meta.tz);
  let date = localDateOf(chart.meta.utcMs, zone);
  let p = panchang(date, geo, zone, { ayanamsa: chart.meta.ayanamsa });
  if (p.sunrise !== null && chart.meta.utcMs < p.sunrise) {
    date = localDateOf(chart.meta.utcMs - 86_400_000, zone);
    p = panchang(date, geo, zone, { ayanamsa: chart.meta.ayanamsa });
  }
  return p;
}

export function panchangAtBirth(chart: ChartData, lang: Lang): PanchangAtBirth {
  const p = vedicDay(chart);
  const at = chart.meta.utcMs;
  const ay = chart.meta.ayanamsa;
  const tithi = tithiAt(at);
  const nakIdx = nakshatraIndexAt(at, ay);
  const nak = p.nakshatras.find((n) => n.index === nakIdx && n.start <= at && at < n.end) ?? p.nakshatra;
  const moon = moonOf(chart);
  const yogaIdx = yogaIndexAt(at, ay);
  const k = karanaInterval(at);
  return {
    approx: chart.meta.timeUnknown,
    vedicDate: p.date,
    vara: p.vara,
    varaName: weekdayNames[lang][p.vara],
    tithi: { n: tithi.n, paksha: tithi.paksha, name: tithiNames[lang][tithi.index], endsAt: tithi.end },
    nakshatra: { n: moon.nakshatra, pada: moon.pada, name: nakshatraNames[lang][moon.nakshatra - 1], lord: NAKSHATRA_LORDS[moon.nakshatra - 1], endsAt: nak.end },
    yoga: { n: yogaIdx + 1, name: yogaNames[lang][yogaIdx] },
    karana: { n: k.index + 1, name: karanaNames[lang][k.index], bhadra: k.index === 6 },
    monthAmanta: { ...p.monthAmanta, name: lunarMonthNames[lang][p.monthAmanta.index] },
    monthPurnimanta: { ...p.monthPurnimanta, name: lunarMonthNames[lang][p.monthPurnimanta.index] },
    vikramSamvat: p.vikramSamvat,
    shakaSamvat: p.shakaSamvat,
    sunrise: p.sunrise,
    sunset: p.sunset,
    moonrise: p.moonrise,
    moonSign: { n: moon.sign, name: signNames[lang][moon.sign - 1] },
    sunSign: { n: (chart.planets.find((x) => x.id === 'Su') as ChartPlanet).sign, name: signNames[lang][(chart.planets.find((x) => x.id === 'Su') as ChartPlanet).sign - 1] },
  };
}

export function planetTable(chart: ChartData, lang: Lang): PlanetTableRow[] {
  return chart.planets.map((p) => ({
    id: p.id,
    name: planetNames[lang][p.id],
    sign: p.sign,
    signName: signNames[lang][p.sign - 1],
    degree: degreeString(p),
    longitude: p.longitude,
    nakshatra: p.nakshatra,
    nakshatraName: nakshatraNames[lang][p.nakshatra - 1],
    pada: p.pada,
    house: p.house,
    tags: p.tags,
    retrograde: p.retrograde,
    combust: p.combust,
    approx: p.approx,
  }));
}

export function dashaTable(tree: DashaTree, nowMs: number, lang: Lang): DashaTableRow[] {
  const cur = current(tree, nowMs);
  const row = (n: DashaNode, isCurrent: boolean) => ({ lord: n.lord, name: planetNames[lang][n.lord], start: n.start, end: n.end, current: isCurrent });
  return tree.mahas.map((m) => ({
    ...row(m, cur?.maha === m),
    antars: (m.children ?? []).map((a) => row(a, cur?.antar === a)),
  }));
}

export function avakahada(chart: ChartData, lang: Lang): AvakahadaChakra {
  const moon = moonOf(chart);
  const r = moon.sign - 1;
  const n = moon.nakshatra - 1;
  return {
    varna: VARNA_KEYS[RASHI_VARNA[r]],
    vashya: VASHYA_KEYS[RASHI_VASHYA[r]],
    yoni: YONI_KEYS[NAKSHATRA_YONI[n]],
    gana: GANA_KEYS[NAKSHATRA_GANA[n]],
    nadi: NADI_KEYS[NAKSHATRA_NADI[n]],
    nakshatra: { n: moon.nakshatra, name: nakshatraNames[lang][n] },
    nakshatraCharan: moon.pada,
    nakshatraLord: NAKSHATRA_LORDS[n],
    rashi: { n: moon.sign, name: signNames[lang][r], lord: SIGN_LORDS[r] },
    lagna: chart.lagna && !chart.moonChart ? { n: chart.lagna.sign, name: signNames[lang][chart.lagna.sign - 1], lord: SIGN_LORDS[chart.lagna.sign - 1] } : null,
    tatva: TATVA[r % 4],
    nameSyllable: syllablesForChart(chart),
    ruleId: 'avakahada-chakra',
  };
}

export function ghatakChakra(chart: ChartData, lang: Lang): GhatakChakra {
  const moon = moonOf(chart);
  const [month, group, vara, nak, yoga, karana, chandra] = GHATAK_TABLE[moon.sign - 1];
  return {
    moonSign: moon.sign,
    month: { index: month, name: lunarMonthNames[lang][month] },
    tithiGroup: group,
    tithis: TITHI_GROUPS[group],
    vara: { n: vara, name: weekdayNames[lang][vara] },
    nakshatra: { n: nak, name: nakshatraNames[lang][nak - 1] },
    yoga: { n: yoga, name: yogaNames[lang][yoga - 1] },
    karana: { n: karana + 1, name: karanaNames[lang][karana] },
    chandra: { n: chandra, name: signNames[lang][chandra - 1] },
    lagna: { n: moon.sign, name: signNames[lang][moon.sign - 1] },
    ruleId: 'ghatak-chakra',
  };
}

export function computedWith(chart: ChartData, conventions: readonly string[]): ComputedWithLine[] {
  return [
    { key: 'ayanamsa', value: `${chart.meta.ayanamsa} ${chart.meta.ayanamsaDegrees.toFixed(4)}°` },
    { key: 'node', value: chart.meta.nodeMethod },
    { key: 'ephemeris', value: chart.meta.ephemeris },
    { key: 'timezone', value: `IANA tzdb ${TZDB_VERSION} (${chart.meta.tz}, ${formatOffset(chart.meta.offsetMinutes)})` },
    { key: 'houseSystem', value: chart.meta.houseSystem },
    { key: 'rounding', value: 'arc-second; times to the minute' },
    { key: 'conventions', value: conventions.join(', ') },
  ];
}

export interface ReportOptions {
  /** "Now" for the current-dasha marker and the generated-at stamp (default Date.now()). */
  nowMs?: number;
}

function assertLang(lang: Lang): void {
  if (!LANGS.includes(lang)) throw new Error(`Unsupported report language: ${lang}`);
}

/** Janam Patri (spec F31): header, panchang at birth, D1/D9/Moon charts, planet table, dasha table, avakahada, ghatak, Mangal statement, how computed, disclaimer. */
export function janamPatriModel(chart: ChartData, profile: ReportProfile, lang: Lang, opts: ReportOptions = {}): JanamPatriModel {
  assertLang(lang);
  const nowMs = opts.nowMs ?? Date.now();
  const tree = dasha(chart);
  const mangal = mangalDosha(chart);
  const conventions = ['lagna', 'house-lord', 'dasha-vimshottari', 'varga-d9', 'avakahada-chakra', 'ghatak-chakra', 'mangal-dosha', 'combustion-orbs', ...(chart.meta.timeUnknown ? ['moon-chart'] : [])];
  return {
    kind: 'janam-patri',
    lang,
    header: header(chart, profile, lang, nowMs),
    panchangAtBirth: panchangAtBirth(chart, lang),
    charts: { d1: chart, d9: varga(chart, 'D9'), moon: toMoonChart(chart) },
    planetTable: planetTable(chart, lang),
    dashaTable: dashaTable(tree, nowMs, lang),
    dashaBalance: tree.balanceAtBirth,
    avakahada: avakahada(chart, lang),
    ghatakChakra: ghatakChakra(chart, lang),
    mangalStatement: mangal,
    computedWith: computedWith(chart, conventions),
    disclaimer: REPORT_DISCLAIMER_KEY,
    ruleIds: [...conventions, ...mangal.cancellations.map((c) => c.ruleId), 'how-computed'],
  };
}

/** Matching report (design 10.6, ₹99): both charts, 36-guna table, dosha section with cancellations, beyond gun milan, how computed, disclaimer; language of profile A. */
export function matchingReportModel(a: ChartData, b: ChartData, profiles: { a: ReportProfile; b: ReportProfile }, lang: Lang, opts: ReportOptions = {}): MatchingReportModel {
  assertLang(lang);
  const nowMs = opts.nowMs ?? Date.now();
  const kootas = ashtakoota(a, b);
  const mangal = mangalDoshaPair(a, b);
  const beyond = beyondGunMilan(a, b, nowMs);
  const conventions = ['koota-varna', 'koota-vashya', 'koota-tara', 'koota-yoni', 'koota-grahaMaitri', 'koota-gana', 'koota-bhakoot', 'koota-nadi', 'mangal-dosha', ...beyond.rows.map((r) => r.ruleId)];
  return {
    kind: 'matching',
    lang,
    a: { header: header(a, profiles.a, lang, nowMs), chart: a, moon: toMoonChart(a) },
    b: { header: header(b, profiles.b, lang, nowMs), chart: b, moon: toMoonChart(b) },
    ashtakoota: kootas,
    mangal,
    beyond,
    computedWith: computedWith(a, conventions),
    disclaimer: REPORT_DISCLAIMER_KEY,
    ruleIds: [
      ...conventions,
      ...(kootas.nadiException ? [kootas.nadiException] : []),
      ...(kootas.bhakootException ? [kootas.bhakootException] : []),
      ...(kootas.bhakootNote ? [kootas.bhakootNote] : []),
      ...mangal.a.cancellations.map((c) => c.ruleId),
      'mangal-cancel-both-manglik',
      'how-computed',
    ],
  };
}

/** Varshaphal report (design 10.6, ₹149): solar-return chart, Muntha, year lord, Tajika aspects, Mudda table, transit calendar, how computed, disclaimer. */
export function varshaphalReportModel(chart: ChartData, year: number, profile: ReportProfile, lang: Lang, opts: ReportOptions = {}): VarshaphalReportModel {
  assertLang(lang);
  const nowMs = opts.nowMs ?? Date.now();
  const v = varshaphal(chart, year);
  const conventions = [...v.ruleIds];
  return {
    kind: 'varshaphal',
    lang,
    header: header(chart, profile, lang, nowMs),
    year,
    age: v.age,
    returnLine: formatInZone(v.instant, v.tz, "EEEE d MMMM yyyy '·' HH:mm", lang),
    varshaphal: v,
    planetTable: planetTable(v.chart, lang),
    muddaTable: v.muddaDasha.map((m) => ({ lord: m.lord, name: planetNames[lang][m.lord], start: m.start, end: m.end })),
    transitTable: v.transitCalendar.map((t) => ({ planet: t.planet, name: planetNames[lang][t.planet], sign: t.sign, signName: signNames[lang][t.sign - 1], from: t.from, to: t.to, retrogradeEntry: t.retrogradeEntry })),
    computedWith: computedWith(v.chart, conventions),
    disclaimer: REPORT_DISCLAIMER_KEY,
    ruleIds: [...conventions, 'how-computed'],
  };
}
