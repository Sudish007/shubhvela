// Ashtakoota matching, Mangal dosha and "beyond gun milan" (spec F29, design 10.6 F29, plan B01).
// Scores come from the vendored fork's koota functions (vendor/jyotish/src/matching/kootas.ts), which the A04/B01
// matching suite compares with Drik Panchang's Ashta Kuta totals; this module adds key-based labels, the explicit
// exception / cancellation rule ids the UI shows as rows, and the four "beyond gun milan" rows.
//
// Conventions (B01, calibrated on the 20 Drik Panchang reference pairs, reference/CONVENTIONS.md section 1c):
// - Chart `a` is the vara (groom) side and `b` the kanya (bride) side for the kootas whose tables are ordered
//   (Varna, Vashya, Tara, Bhakoot); the UI's A/B pickers map to this. Both sides are plain ChartData.
// - Vashya: Dhanu is Manava in its first half and Chatushpada in its second, Makara Chatushpada in its first half and
//   Jalachara in its second (Muhurta Chintamani; Drik m04/m16); the other signs have one class.
// - Nadi dosha (same nadi) exceptions: same Moon sign with different nakshatras, or the same nakshatra with different
//   padas -> full 8 points (Drik m02). Same nakshatra AND same pada keeps the dosha (Drik m15).
// - Bhakoot dosha (2/12, 5/9, 6/8): Drik applies NO same-lord exception (m17: Mesha-Vrishchika = 0), so the score
//   follows Drik and the traditional exception is only NAMED as `bhakootNote`; the same nakshatra and pada on both
//   sides is scored 0 (eka-nakshatra eka-pada, Drik m15).
// - Yoni keeps the fork's 4-level table (same 4, neutral 2, enemy 1, sworn enemy 0); Drik grades friendly pairs 3 and
//   unfriendly 1 with a table B01 could not source, so six reference pairs differ by one point (documented).
// - Mangal dosha: Mars in 1, 2, 4, 7, 8 or 12 counted from the Lagna, the Moon or Venus (Drik's rule set, 2nd house
//   included). Cancellation rules are listed as rows with `applies`; `cancelled` is true when any applies. In Moon-
//   chart mode the Lagna reference is skipped and `lagnaUnknown` is set.
// - Dasha overlap: the two Vimshottari trees over the next five years, intersected at antar level, each overlap
//   labelled with the natural relationship between the two maha lords (Parashara's friendship table).
import { NAKSHATRA_GANA, NAKSHATRA_NADI, NAKSHATRA_YONI, RASHI_VARNA, RASHI_VASHYA } from '../../vendor/jyotish/src/matching/constants';
import { calculateGana, calculateGrahaMaitri, calculateTara, calculateVarna, calculateYoni } from '../../vendor/jyotish/src/matching/kootas';
import { type ChartData, type ChartPlanet, type NaturalRelation, naturalRelation, signDignity } from '../kundli/index';
import { type DashaNode, dasha } from '../dasha/index';
import { type PlanetId, SIGN_LORDS } from '../locale/index';
import { DAY_MS } from '../panchang/astro';

export type KootaId = 'varna' | 'vashya' | 'tara' | 'yoni' | 'grahaMaitri' | 'gana' | 'bhakoot' | 'nadi';
export const KOOTA_IDS: readonly KootaId[] = ['varna', 'vashya', 'tara', 'yoni', 'grahaMaitri', 'gana', 'bhakoot', 'nadi'];
export const KOOTA_MAX: Record<KootaId, number> = { varna: 1, vashya: 2, tara: 3, yoni: 4, grahaMaitri: 5, gana: 6, bhakoot: 7, nadi: 8 };
export const KOOTA_RULE_IDS: readonly string[] = KOOTA_IDS.map((k) => `koota-${k}`);
export const KOOTA_EXCEPTION_IDS = ['nadi-exception-same-rashi', 'nadi-exception-same-nakshatra-pada', 'bhakoot-exception-same-lord', 'bhakoot-same-nakshatra-pada'] as const;
export type NadiExceptionId = 'nadi-exception-same-rashi' | 'nadi-exception-same-nakshatra-pada';

/** Vashya table (fork, Muhurta Chintamani): rows/cols Chatushpada, Manava, Jalachara, Vanachara, Keeta. */
const VASHYA_TABLE: readonly (readonly number[])[] = [
  [2, 1, 1, 0.5, 1],
  [1, 2, 0.5, 0, 1],
  [1, 0.5, 2, 1, 1],
  [0.5, 0, 1, 2, 0],
  [1, 1, 1, 0, 2],
];

/** Vashya class 0-4 of a sidereal Moon longitude: Dhanu Manava/Chatushpada and Makara Chatushpada/Jalachara by half. */
export function vashyaClass(moonLongitude: number): number {
  const lon = ((moonLongitude % 360) + 360) % 360;
  const sign = Math.floor(lon / 30);
  const firstHalf = lon - sign * 30 < 15;
  if (sign === 8) return firstHalf ? 1 : 0;
  if (sign === 9) return firstHalf ? 0 : 2;
  return RASHI_VASHYA[sign];
}
export const MANGAL_RULE_IDS = [
  'mangal-dosha',
  'mangal-cancel-own-exalted',
  'mangal-cancel-sign-house',
  'mangal-cancel-jupiter-moon-conjunction',
  'mangal-cancel-jupiter-aspect',
  'mangal-cancel-debilitated-combust',
  'mangal-cancel-both-manglik',
] as const;
export const BEYOND_RULE_IDS = ['beyond-seventh-lords', 'beyond-venus', 'beyond-moon-sign-relation', 'beyond-dasha-overlap'] as const;

const VARNA_KEYS = ['brahmin', 'kshatriya', 'vaishya', 'shudra'] as const;
const VASHYA_KEYS = ['chatushpada', 'manava', 'jalachara', 'vanachara', 'keeta'] as const;
const YONI_KEYS = ['horse', 'elephant', 'sheep', 'snake', 'dog', 'cat', 'rat', 'cow', 'buffalo', 'tiger', 'deer', 'monkey', 'mongoose', 'lion'] as const;
const GANA_KEYS = ['deva', 'manushya', 'rakshasa'] as const;
const NADI_KEYS = ['adi', 'madhya', 'antya'] as const;

export type KootaDetail = Record<string, string | number | boolean | null>;

export interface KootaRow {
  id: KootaId;
  points: number;
  max: number;
  /** Key-based labels of the two sides (varna/vashya/yoni/gana/nadi keys, planet ids, tara numbers, bhakoot distance). */
  a: string;
  b: string;
  detail: KootaDetail;
  ruleId: string;
}

export interface AshtakootaResult {
  total: number;
  max: 36;
  kootas: KootaRow[];
  /** Nadi dosha lifted: same Moon sign (different nakshatras) or same nakshatra (different padas). */
  nadiException?: NadiExceptionId;
  /** Bhakoot scored 0 although the sign distance is fine: both Moons in the same nakshatra and pada. */
  bhakootException?: 'bhakoot-same-nakshatra-pada';
  /** The traditional same-lord exception WOULD apply; named for the dosha row but not scored (Drik applies none). */
  bhakootNote?: 'bhakoot-exception-same-lord';
  a: { moonSign: number; nakshatra: number; pada: number };
  b: { moonSign: number; nakshatra: number; pada: number };
}

function moonOf(chart: ChartData): ChartPlanet {
  const m = chart.planets.find((p) => p.id === 'Mo');
  if (!m) throw new Error('Chart has no Moon');
  return m;
}

/** Ashtakoota (36 guna) between chart a (vara side) and chart b (kanya side). */
export function ashtakoota(a: ChartData, b: ChartData): AshtakootaResult {
  const ma = moonOf(a);
  const mb = moonOf(b);
  const aR = ma.sign - 1;
  const bR = mb.sign - 1;
  const aN = ma.nakshatra - 1;
  const bN = mb.nakshatra - 1;
  const varna = calculateVarna(aR, bR, 'en');
  const tara = calculateTara(aN, bN, 'en');
  const yoni = calculateYoni(aN, bN, 'en');
  const maitri = calculateGrahaMaitri(aR, bR, 'en');
  const gana = calculateGana(aN, bN, 'en');
  const aV = vashyaClass(ma.longitude);
  const bV = vashyaClass(mb.longitude);
  const vashyaPoints = VASHYA_TABLE[aV][bV];
  const taraAB = ((bN - aN + 27) % 27) + 1;
  const taraBA = ((aN - bN + 27) % 27) + 1;
  const bhakootDistance = ((bR - aR + 12) % 12) + 1;
  const sameLord = SIGN_LORDS[aR] === SIGN_LORDS[bR];
  const bhakootBad = [2, 12, 5, 9, 6, 8].includes(bhakootDistance);
  const samePada = aN === bN && ma.pada === mb.pada;
  const bhakootPoints = bhakootBad || samePada ? 0 : 7;
  const nadiSame = NAKSHATRA_NADI[aN] === NAKSHATRA_NADI[bN];
  const nadiException: NadiExceptionId | null = !nadiSame ? null : aR === bR && aN !== bN ? 'nadi-exception-same-rashi' : aN === bN && ma.pada !== mb.pada ? 'nadi-exception-same-nakshatra-pada' : null;
  const nadiPoints = !nadiSame || nadiException ? 8 : 0;
  const kootas: KootaRow[] = [
    { id: 'varna', points: varna.score, max: 1, a: VARNA_KEYS[RASHI_VARNA[aR]], b: VARNA_KEYS[RASHI_VARNA[bR]], detail: { aVarna: VARNA_KEYS[RASHI_VARNA[aR]], bVarna: VARNA_KEYS[RASHI_VARNA[bR]] }, ruleId: 'koota-varna' },
    { id: 'vashya', points: vashyaPoints, max: 2, a: VASHYA_KEYS[aV], b: VASHYA_KEYS[bV], detail: { aVashya: VASHYA_KEYS[aV], bVashya: VASHYA_KEYS[bV] }, ruleId: 'koota-vashya' },
    { id: 'tara', points: tara.score, max: 3, a: String(taraBA % 9 || 9), b: String(taraAB % 9 || 9), detail: { countAtoB: taraAB, countBtoA: taraBA, taraAtoB: taraAB % 9 || 9, taraBtoA: taraBA % 9 || 9 }, ruleId: 'koota-tara' },
    { id: 'yoni', points: yoni.score, max: 4, a: YONI_KEYS[NAKSHATRA_YONI[aN]], b: YONI_KEYS[NAKSHATRA_YONI[bN]], detail: { aYoni: YONI_KEYS[NAKSHATRA_YONI[aN]], bYoni: YONI_KEYS[NAKSHATRA_YONI[bN]] }, ruleId: 'koota-yoni' },
    { id: 'grahaMaitri', points: maitri.score, max: 5, a: SIGN_LORDS[aR], b: SIGN_LORDS[bR], detail: { aLord: SIGN_LORDS[aR], bLord: SIGN_LORDS[bR], aToB: naturalRelation(SIGN_LORDS[aR], SIGN_LORDS[bR]), bToA: naturalRelation(SIGN_LORDS[bR], SIGN_LORDS[aR]) }, ruleId: 'koota-grahaMaitri' },
    { id: 'gana', points: gana.score, max: 6, a: GANA_KEYS[NAKSHATRA_GANA[aN]], b: GANA_KEYS[NAKSHATRA_GANA[bN]], detail: { aGana: GANA_KEYS[NAKSHATRA_GANA[aN]], bGana: GANA_KEYS[NAKSHATRA_GANA[bN]] }, ruleId: 'koota-gana' },
    {
      id: 'bhakoot',
      points: bhakootPoints,
      max: 7,
      a: String(ma.sign),
      b: String(mb.sign),
      detail: { distance: bhakootDistance, dosha: bhakootBad, sameNakshatraPada: samePada, exception: samePada && !bhakootBad ? 'bhakoot-same-nakshatra-pada' : null, note: bhakootBad && sameLord ? 'bhakoot-exception-same-lord' : null },
      ruleId: 'koota-bhakoot',
    },
    { id: 'nadi', points: nadiPoints, max: 8, a: NADI_KEYS[NAKSHATRA_NADI[aN]], b: NADI_KEYS[NAKSHATRA_NADI[bN]], detail: { aNadi: NADI_KEYS[NAKSHATRA_NADI[aN]], bNadi: NADI_KEYS[NAKSHATRA_NADI[bN]], dosha: nadiSame && !nadiException, exception: nadiException }, ruleId: 'koota-nadi' },
  ];
  const total = kootas.reduce((s, k) => s + k.points, 0);
  const out: AshtakootaResult = {
    total,
    max: 36,
    kootas,
    a: { moonSign: ma.sign, nakshatra: ma.nakshatra, pada: ma.pada },
    b: { moonSign: mb.sign, nakshatra: mb.nakshatra, pada: mb.pada },
  };
  if (nadiException) out.nadiException = nadiException;
  if (samePada && !bhakootBad) out.bhakootException = 'bhakoot-same-nakshatra-pada';
  if (bhakootBad && sameLord) out.bhakootNote = 'bhakoot-exception-same-lord';
  return out;
}

// ---------------------------------------------------------------- Mangal dosha

export const MANGAL_HOUSES = [1, 2, 4, 7, 8, 12] as const;

export interface MangalReference {
  from: 'lagna' | 'moon' | 'venus';
  /** House of Mars counted from the reference (1-12). */
  house: number;
  dosha: boolean;
}

export interface MangalCancellation {
  ruleId: (typeof MANGAL_RULE_IDS)[number];
  applies: boolean;
  detail: KootaDetail;
}

export interface MangalDoshaReport {
  /** Mars in a dosha house from at least one reference. */
  present: boolean;
  /** present and no cancellation rule applies. */
  effective: boolean;
  cancelled: boolean;
  references: MangalReference[];
  fromLagna: MangalReference | null;
  fromMoon: MangalReference;
  fromVenus: MangalReference;
  houses: readonly number[];
  marsSign: number;
  marsHouse: number | null;
  cancellations: MangalCancellation[];
  lagnaUnknown: boolean;
  ruleId: 'mangal-dosha';
}

function dist(fromSign: number, toSign: number): number {
  return ((toSign - fromSign + 12) % 12) + 1;
}

/** Mangal dosha of one chart with every cancellation rule evaluated. */
export function mangalDosha(chart: ChartData): MangalDoshaReport {
  const mars = chart.planets.find((p) => p.id === 'Ma');
  const moon = moonOf(chart);
  const venus = chart.planets.find((p) => p.id === 'Ve');
  const jup = chart.planets.find((p) => p.id === 'Ju');
  if (!mars || !venus || !jup) throw new Error('Chart lacks Mars, Venus or Jupiter');
  const lagnaUnknown = chart.moonChart || !chart.lagna;
  const ref = (from: MangalReference['from'], sign: number): MangalReference => {
    const house = dist(sign, mars.sign);
    return { from, house, dosha: (MANGAL_HOUSES as readonly number[]).includes(house) };
  };
  const fromLagna = lagnaUnknown ? null : ref('lagna', chart.firstHouseSign);
  const fromMoon = ref('moon', moon.sign);
  const fromVenus = ref('venus', venus.sign);
  const references = [fromLagna, fromMoon, fromVenus].filter((r): r is MangalReference => r !== null);
  const present = references.some((r) => r.dosha);
  const marsHouse = lagnaUnknown ? null : dist(chart.firstHouseSign, mars.sign);
  const dignity = signDignity('Ma', mars.sign);
  const signHousePairs: Record<number, number> = { 1: 1, 8: 4, 10: 7, 4: 8, 9: 12 }; // Mesha in 1, Vrishchika in 4, Makara in 7, Karka in 8, Dhanu in 12
  const jupDist = dist(jup.sign, mars.sign);
  const cancellations: MangalCancellation[] = [
    { ruleId: 'mangal-cancel-own-exalted', applies: dignity === 'own' || dignity === 'exalted', detail: { marsSign: mars.sign, dignity: dignity ?? null } },
    { ruleId: 'mangal-cancel-sign-house', applies: marsHouse !== null && signHousePairs[mars.sign] === marsHouse, detail: { marsSign: mars.sign, marsHouse } },
    { ruleId: 'mangal-cancel-jupiter-moon-conjunction', applies: mars.sign === jup.sign || mars.sign === moon.sign, detail: { withJupiter: mars.sign === jup.sign, withMoon: mars.sign === moon.sign } },
    { ruleId: 'mangal-cancel-jupiter-aspect', applies: [5, 7, 9].includes(jupDist), detail: { marsFromJupiter: jupDist } },
    { ruleId: 'mangal-cancel-debilitated-combust', applies: dignity === 'debilitated' || mars.combust, detail: { debilitated: dignity === 'debilitated', combust: mars.combust } },
  ];
  const cancelled = present && cancellations.some((c) => c.applies);
  return {
    present,
    effective: present && !cancelled,
    cancelled,
    references,
    fromLagna,
    fromMoon,
    fromVenus,
    houses: MANGAL_HOUSES,
    marsSign: mars.sign,
    marsHouse,
    cancellations,
    lagnaUnknown,
    ruleId: 'mangal-dosha',
  };
}

export interface MangalPairReport {
  a: MangalDoshaReport;
  b: MangalDoshaReport;
  /** Both charts carry an effective dosha: the classical mutual cancellation. */
  bothManglik: MangalCancellation;
  /** True when neither side has an effective dosha after every rule, or both have (mutual cancellation). */
  balanced: boolean;
}

/** Mangal dosha of both sides with the mutual-cancellation row. */
export function mangalDoshaPair(a: ChartData, b: ChartData): MangalPairReport {
  const ra = mangalDosha(a);
  const rb = mangalDosha(b);
  const both = ra.effective && rb.effective;
  return {
    a: ra,
    b: rb,
    bothManglik: { ruleId: 'mangal-cancel-both-manglik', applies: both, detail: { aEffective: ra.effective, bEffective: rb.effective } },
    balanced: both || (!ra.effective && !rb.effective),
  };
}

// ---------------------------------------------------------------- beyond gun milan

export type BeyondParam = string | number | boolean | null | string[] | number[];

export interface BeyondRow {
  id: 'seventh-lords' | 'venus' | 'moon-sign-relation' | 'dasha-overlap';
  ruleId: (typeof BEYOND_RULE_IDS)[number];
  /** harmonious | mixed | challenging (a word, never a score). */
  tone: 'harmonious' | 'mixed' | 'challenging';
  params: Record<string, BeyondParam>;
  /** True when a Lagna-based row was evaluated from the Moon because a birth time is unknown. */
  approx: boolean;
}

export interface DashaOverlap {
  start: number;
  end: number;
  aMaha: PlanetId;
  aAntar: PlanetId;
  bMaha: PlanetId;
  bAntar: PlanetId;
  mahaRelation: NaturalRelation;
  antarRelation: NaturalRelation;
}

export interface BeyondGunMilanReport {
  rows: BeyondRow[];
  dashaOverlaps: DashaOverlap[];
  horizon: { from: number; to: number };
}

function toneOfRelation(r: NaturalRelation): BeyondRow['tone'] {
  return r === 'self' || r === 'friend' ? 'harmonious' : r === 'neutral' ? 'mixed' : 'challenging';
}

/** Sign-distance tone (both directions): 1/7 and 3/11, 5/9 harmonious; 4/10 mixed; 2/12, 6/8 challenging. */
function toneOfDistance(d: number): BeyondRow['tone'] {
  if ([1, 7, 3, 11, 5, 9].includes(d)) return 'harmonious';
  if ([4, 10].includes(d)) return 'mixed';
  return 'challenging';
}

function antarsWithin(tree: DashaNode[], from: number, to: number): { maha: PlanetId; antar: PlanetId; start: number; end: number }[] {
  const out: { maha: PlanetId; antar: PlanetId; start: number; end: number }[] = [];
  for (const m of tree) {
    if (m.end <= from || m.start >= to) continue;
    for (const a of m.children ?? []) {
      if (a.end <= from || a.start >= to) continue;
      out.push({ maha: m.lord, antar: a.lord, start: Math.max(a.start, from), end: Math.min(a.end, to) });
    }
  }
  return out;
}

/** The four "beyond gun milan" rows: 7th lords, Venus, Moon-sign relationship, dasha overlap over the next five years. */
export function beyondGunMilan(a: ChartData, b: ChartData, nowMs: number): BeyondGunMilanReport {
  const rows: BeyondRow[] = [];
  const seventh = (c: ChartData): PlanetId => SIGN_LORDS[(c.firstHouseSign - 1 + 6) % 12];
  const l7a = seventh(a);
  const l7b = seventh(b);
  const rel7 = naturalRelation(l7a, l7b);
  rows.push({
    id: 'seventh-lords',
    ruleId: 'beyond-seventh-lords',
    tone: toneOfRelation(rel7),
    params: { aSeventhLord: l7a, bSeventhLord: l7b, relation: rel7, reverse: naturalRelation(l7b, l7a), aSeventhSign: ((a.firstHouseSign - 1 + 6) % 12) + 1, bSeventhSign: ((b.firstHouseSign - 1 + 6) % 12) + 1 },
    approx: a.moonChart || b.moonChart,
  });
  const va = a.planets.find((p) => p.id === 'Ve') as ChartPlanet;
  const vb = b.planets.find((p) => p.id === 'Ve') as ChartPlanet;
  const dVenus = dist(va.sign, vb.sign);
  rows.push({
    id: 'venus',
    ruleId: 'beyond-venus',
    tone: toneOfDistance(dVenus),
    params: { aVenusSign: va.sign, bVenusSign: vb.sign, distance: dVenus, aDignity: signDignity('Ve', va.sign) ?? null, bDignity: signDignity('Ve', vb.sign) ?? null, lordsRelation: naturalRelation(SIGN_LORDS[va.sign - 1], SIGN_LORDS[vb.sign - 1]) },
    approx: false,
  });
  const ma = moonOf(a);
  const mb = moonOf(b);
  const dMoon = dist(ma.sign, mb.sign);
  const moonLords = naturalRelation(SIGN_LORDS[ma.sign - 1], SIGN_LORDS[mb.sign - 1]);
  const moonTone = toneOfDistance(dMoon);
  rows.push({
    id: 'moon-sign-relation',
    ruleId: 'beyond-moon-sign-relation',
    tone: moonTone === 'harmonious' && (moonLords === 'enemy') ? 'mixed' : moonTone,
    params: { aMoonSign: ma.sign, bMoonSign: mb.sign, distance: dMoon, lordsRelation: moonLords },
    approx: false,
  });
  const to = nowMs + 5 * 365.2425 * DAY_MS;
  const ta = antarsWithin(dasha(a).mahas, nowMs, to);
  const tb = antarsWithin(dasha(b).mahas, nowMs, to);
  const overlaps: DashaOverlap[] = [];
  for (const x of ta) {
    for (const y of tb) {
      const start = Math.max(x.start, y.start);
      const end = Math.min(x.end, y.end);
      if (end <= start) continue;
      overlaps.push({ start, end, aMaha: x.maha, aAntar: x.antar, bMaha: y.maha, bAntar: y.antar, mahaRelation: naturalRelation(x.maha, y.maha), antarRelation: naturalRelation(x.antar, y.antar) });
    }
  }
  overlaps.sort((p, q) => p.start - q.start);
  const span = overlaps.reduce((s, o) => s + (o.end - o.start), 0) || 1;
  const friendly = overlaps.filter((o) => o.mahaRelation === 'friend' || o.mahaRelation === 'self').reduce((s, o) => s + (o.end - o.start), 0);
  const hostile = overlaps.filter((o) => o.mahaRelation === 'enemy').reduce((s, o) => s + (o.end - o.start), 0);
  rows.push({
    id: 'dasha-overlap',
    ruleId: 'beyond-dasha-overlap',
    tone: hostile > span / 2 ? 'challenging' : friendly > span / 2 ? 'harmonious' : 'mixed',
    params: { years: 5, periods: overlaps.length, friendlyDays: Math.round(friendly / DAY_MS), hostileDays: Math.round(hostile / DAY_MS), aMahaNow: ta[0]?.maha ?? null, bMahaNow: tb[0]?.maha ?? null },
    approx: false,
  });
  return { rows, dashaOverlaps: overlaps, horizon: { from: nowMs, to } };
}
