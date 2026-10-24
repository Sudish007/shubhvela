// ChartData model over the vendored jyotish fork (design.md 4, spec F2/F11/F19, plan.md A02, P11).
// Pure functions: computeChart(birth, opts) -> ChartData, varga(chart, 'D9'), chalit(chart), moonChart(chart),
// sunChart(chart), trueNodeLongitude(utcMs). All astronomy in UTC; the birth wall time is converted with the
// bundled tz table (never Intl, never the device offset).
import { Body, Ecliptic, GeoVector, NextMoonNode, NodeEventKind, Observer, SearchMoonNode } from 'astronomy-engine';
import { getAyanamsa } from '../../vendor/jyotish/src/core/ayanamsa';
import { getNakshatra, getNakshatraPada, getPlanetaryPosition, getRahuPosition, getUdayaLagna } from '../../vendor/jyotish/src/core/calculations';
import { getHouses } from '../../vendor/jyotish/src/kundli/houses';
import { getAllVargas } from '../../vendor/jyotish/src/kundli/vargas';
import { PLANET_IDS, PLANET_KEYS, SIGN_LORDS, type PlanetId } from '../locale/index';
import { canonicalZone, localToUtc } from '../tz/index';

export type Ayanamsa = 'lahiri' | 'kp' | 'raman';
export type NodeMode = 'mean' | 'true';
export type HouseSystem = 'whole_sign';
export type ApproxMinutes = 0 | 15 | 30 | 60;

export const VARGA_IDS = [
  'D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8', 'D9', 'D10', 'D11', 'D12', 'D16', 'D20', 'D24', 'D27', 'D30', 'D40', 'D45', 'D60',
] as const;
export type VargaId = (typeof VARGA_IDS)[number];
export type ChartVariant = 'lagna' | 'moon' | 'sun' | 'chalit' | VargaId;

export type DignityTag =
  | 'exalted'
  | 'debilitated'
  | 'own'
  | 'friend'
  | 'enemy'
  | 'neutral'
  | 'combust'
  | 'retro'
  | 'vargottama';

export interface BirthInput {
  /** YYYY-MM-DD in the birth place's civil calendar. */
  date: string;
  /** HH:MM wall-clock time; omit (or set timeUnknown) for Moon-chart mode. */
  time?: string;
  timeUnknown?: boolean;
  /** Uncertainty window declared by the user (F2); 0 = exact. */
  approxMinutes?: ApproxMinutes;
  /** IANA zone id (canonical or alias; must exist in the engine tz table). */
  tz: string;
  lat: number;
  lon: number;
  elevation?: number;
}

export interface ChartOptions {
  ayanamsa?: Ayanamsa;
  node?: NodeMode;
  houseSystem?: HouseSystem;
}

export interface ChartPoint {
  /** Sidereal longitude 0-360. */
  longitude: number;
  /** 1 = Mesha ... 12 = Meena. */
  sign: number;
  degree: number;
  minute: number;
  second: number;
  /** 1 = Ashwini ... 27 = Revati. */
  nakshatra: number;
  /** 1-4. */
  pada: number;
  /** F2: within 1 deg of a sign boundary, or the drift over the uncertainty window crosses one. */
  approx: boolean;
  /** Longitudes at utc -/+ the uncertainty window (present when a window applies). */
  drift?: { minus: number; plus: number };
}

export type ChartLagna = ChartPoint;

export interface ChartPlanet extends ChartPoint {
  id: PlanetId;
  /** Whole-sign house from the chart's first-house sign (1-12). */
  house: number;
  tags: DignityTag[];
  /** Degrees per day (negative = retrograde). */
  speed: number;
  retrograde: boolean;
  combust: boolean;
  vargottama: boolean;
}

export interface ChartHouse {
  n: number;
  sign: number;
  lord: PlanetId;
  occupants: PlanetId[];
}

export interface ChartMeta {
  ayanamsa: Ayanamsa;
  ayanamsaDegrees: number;
  node: NodeMode;
  nodeMethod: string;
  ephemeris: 'astronomy-engine 2.1.19';
  tz: string;
  utcMs: number;
  offsetMinutes: number;
  clockGap: boolean;
  overlap: boolean;
  lat: number;
  lon: number;
  elevation: number;
  houseSystem: HouseSystem;
  timeUnknown: boolean;
  approxMinutes: number;
  /** Degrees from the Sun within which a planet is marked combust (retrograde orb in brackets). */
  combustionOrbs: Record<string, string>;
  computedAt: string;
}

export interface ChartData {
  variant: ChartVariant;
  /** Undefined in Moon-chart mode and in Moon/Sun reference charts. */
  lagna?: ChartLagna;
  /** Sign placed in house 1 (Lagna sign, Moon sign in Moon-chart mode, Sun sign in the Sun chart). */
  firstHouseSign: number;
  planets: ChartPlanet[];
  houses: ChartHouse[];
  /** True when the birth time is unknown and the chart is counted from the Moon (F2). */
  moonChart: boolean;
  approx: { lagna: boolean };
  meta: ChartMeta;
}

export const EPHEMERIS = 'astronomy-engine 2.1.19' as const;
export const COMBUSTION_ORBS: Record<string, string> = {
  Moon: '12',
  Mars: '17',
  Mercury: '14 (12 when retrograde)',
  Jupiter: '11',
  Venus: '10 (8 when retrograde)',
  Saturn: '15',
};

// Parashara's natural (naisargika) friendships. Row = planet, value = relationship to the sign lord.
type Relation = 'friend' | 'neutral' | 'enemy';
const FRIENDSHIP: Record<Exclude<PlanetId, 'Ra' | 'Ke'>, Partial<Record<PlanetId, Relation>>> = {
  Su: { Mo: 'friend', Ma: 'friend', Ju: 'friend', Me: 'neutral', Ve: 'enemy', Sa: 'enemy' },
  Mo: { Su: 'friend', Me: 'friend', Ma: 'neutral', Ju: 'neutral', Ve: 'neutral', Sa: 'neutral' },
  Ma: { Su: 'friend', Mo: 'friend', Ju: 'friend', Ve: 'neutral', Sa: 'neutral', Me: 'enemy' },
  Me: { Su: 'friend', Ve: 'friend', Ma: 'neutral', Ju: 'neutral', Sa: 'neutral', Mo: 'enemy' },
  Ju: { Su: 'friend', Mo: 'friend', Ma: 'friend', Sa: 'neutral', Me: 'enemy', Ve: 'enemy' },
  Ve: { Me: 'friend', Sa: 'friend', Ma: 'neutral', Ju: 'neutral', Su: 'enemy', Mo: 'enemy' },
  Sa: { Me: 'friend', Ve: 'friend', Ju: 'neutral', Su: 'enemy', Mo: 'enemy', Ma: 'enemy' },
};
// Sign indexes 0-11 (0 = Mesha).
const EXALTATION: Partial<Record<PlanetId, number>> = { Su: 0, Mo: 1, Ma: 9, Me: 5, Ju: 3, Ve: 11, Sa: 6 };
const DEBILITATION: Partial<Record<PlanetId, number>> = { Su: 6, Mo: 7, Ma: 3, Me: 11, Ve: 5, Ju: 9, Sa: 0 };
const OWN: Partial<Record<PlanetId, number[]>> = {
  Su: [4],
  Mo: [3],
  Ma: [0, 7],
  Me: [2, 5],
  Ju: [8, 11],
  Ve: [1, 6],
  Sa: [9, 10],
};

const DAY_MS = 86_400_000;
const BODIES: Record<Exclude<PlanetId, 'Ra' | 'Ke'>, Body> = {
  Su: Body.Sun,
  Mo: Body.Moon,
  Ma: Body.Mars,
  Me: Body.Mercury,
  Ju: Body.Jupiter,
  Ve: Body.Venus,
  Sa: Body.Saturn,
};

function norm360(x: number): number {
  return ((x % 360) + 360) % 360;
}

function pointFromLongitude(longitude: number): Omit<ChartPoint, 'approx'> {
  const lon = norm360(longitude);
  const signIndex = Math.floor(lon / 30);
  const inSign = lon - signIndex * 30;
  // Round to the arc-second once, then decompose, so 29 deg 59' 59.7" never shows as 30 deg 00'.
  const totalSeconds = Math.min(30 * 3600 - 1, Math.round(inSign * 3600));
  const degree = Math.floor(totalSeconds / 3600);
  const minute = Math.floor((totalSeconds % 3600) / 60);
  const second = totalSeconds % 60;
  return {
    longitude: lon,
    sign: signIndex + 1,
    degree,
    minute,
    second,
    nakshatra: getNakshatra(lon) + 1,
    pada: getNakshatraPada(lon),
  };
}

/** Navamsa sign (0-11) of a longitude: 108 equal parts, 9 per sign, starting at Mesha. */
function navamsaSign(longitude: number): number {
  return Math.floor(norm360(longitude) / (360 / 108)) % 12;
}

function isVargottama(longitude: number): boolean {
  return navamsaSign(longitude) === Math.floor(norm360(longitude) / 30);
}

interface RawPosition {
  longitude: number;
  speed: number;
  retrograde: boolean;
  combust: boolean;
  vargottama: boolean;
}

interface RawChart {
  ayanamsa: number;
  lagna: number;
  planets: Record<PlanetId, RawPosition>;
}

/**
 * P11: the fork exposes only the mean node, so the true node is taken as the Moon's tropical longitude at the
 * two node crossings surrounding the instant (ascending: longitude; descending: longitude + 180), linearly
 * interpolated. Labelled "true node (interpolated between crossings)" under "How this was computed".
 */
export function trueNodeLongitude(utcMs: number): { tropical: number; speed: number } {
  let node = SearchMoonNode(new Date(utcMs - 20 * DAY_MS));
  let prev = node;
  while (node.time.date.getTime() <= utcMs) {
    prev = node;
    node = NextMoonNode(node);
  }
  const sample = (n: typeof node): number => {
    const lon = Ecliptic(GeoVector(Body.Moon, n.time.date, true)).elon;
    return norm360(n.kind === NodeEventKind.Ascending ? lon : lon + 180);
  };
  const t0 = prev.time.date.getTime();
  const t1 = node.time.date.getTime();
  const n0 = sample(prev);
  const n1 = sample(node);
  const delta = ((n1 - n0 + 540) % 360) - 180;
  const frac = (utcMs - t0) / (t1 - t0);
  return { tropical: norm360(n0 + delta * frac), speed: (delta / (t1 - t0)) * DAY_MS };
}

export const TRUE_NODE_METHOD = 'true node (interpolated between crossings)';
export const MEAN_NODE_METHOD = 'mean node (Meeus)';

function computeRaw(utcMs: number, observer: Observer, ayanamsaType: Ayanamsa, node: NodeMode): RawChart {
  const date = new Date(utcMs);
  const ayanamsa = getAyanamsa(date, ayanamsaType);
  const lagna = getUdayaLagna(date, observer, ayanamsa);
  const planets = {} as Record<PlanetId, RawPosition>;
  for (const id of ['Su', 'Mo', 'Ma', 'Me', 'Ju', 'Ve', 'Sa'] as const) {
    const p = getPlanetaryPosition(BODIES[id], date, ayanamsa);
    planets[id] = { longitude: p.longitude, speed: p.speed, retrograde: p.isRetrograde, combust: p.isCombust, vargottama: p.isVargottama };
  }
  let rahuLon: number;
  let rahuSpeed: number;
  if (node === 'true') {
    const tn = trueNodeLongitude(utcMs);
    rahuLon = norm360(tn.tropical - ayanamsa);
    rahuSpeed = tn.speed;
  } else {
    const r = getRahuPosition(date, ayanamsa);
    rahuLon = r.longitude;
    rahuSpeed = r.speed;
  }
  planets.Ra = { longitude: rahuLon, speed: rahuSpeed, retrograde: rahuSpeed < 0, combust: false, vargottama: isVargottama(rahuLon) };
  const ketuLon = norm360(rahuLon + 180);
  planets.Ke = { longitude: ketuLon, speed: rahuSpeed, retrograde: rahuSpeed < 0, combust: false, vargottama: isVargottama(ketuLon) };
  return { ayanamsa, lagna, planets };
}

export type NaturalRelation = 'self' | 'friend' | 'neutral' | 'enemy';

/**
 * Parashara's natural relationship of `planet` towards `other` (A03 daily rules: dasha lords' day-strength).
 * The nodes have no row in the table; Rahu is read as Saturn and Ketu as Mars (the usual co-lordship).
 */
export function naturalRelation(planet: PlanetId, other: PlanetId): NaturalRelation {
  const asTable = (id: PlanetId): Exclude<PlanetId, 'Ra' | 'Ke'> => (id === 'Ra' ? 'Sa' : id === 'Ke' ? 'Ma' : id);
  const a = asTable(planet);
  const b = asTable(other);
  if (a === b) return 'self';
  return FRIENDSHIP[a][b] ?? 'neutral';
}

/** Sign-based dignity (design 4 table; moolatrikona folded into own; nodes carry no relationship tag). */
export function signDignity(id: PlanetId, sign: number): DignityTag | undefined {
  const s = sign - 1;
  if (id === 'Ra' || id === 'Ke') return undefined;
  if (EXALTATION[id] === s) return 'exalted';
  if (DEBILITATION[id] === s) return 'debilitated';
  if (OWN[id]?.includes(s)) return 'own';
  const lord = SIGN_LORDS[s];
  return FRIENDSHIP[id][lord] ?? 'neutral';
}

function tagsFor(id: PlanetId, sign: number, raw: { retrograde: boolean; combust: boolean; vargottama: boolean }, withVargottama: boolean): DignityTag[] {
  const tags: DignityTag[] = [];
  const dignity = signDignity(id, sign);
  if (dignity) tags.push(dignity);
  if (raw.combust) tags.push('combust');
  // Nodes are always retrograde by construction (mean node); the tag would carry no information.
  if (raw.retrograde && id !== 'Ra' && id !== 'Ke') tags.push('retro');
  if (withVargottama && raw.vargottama) tags.push('vargottama');
  return tags;
}

function nearBoundary(longitude: number): boolean {
  const inSign = norm360(longitude) % 30;
  return inSign < 1 || inSign > 29;
}

function crossesBoundary(a: number, b: number, mapToSign: (lon: number) => number): boolean {
  return mapToSign(a) !== mapToSign(b);
}

function parseDate(date: string): { y: number; m: number; d: number } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) throw new Error(`Invalid birth date (expected YYYY-MM-DD): ${date}`);
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) throw new Error(`Invalid birth date: ${date}`);
  return { y, m: mo, d };
}

function parseTime(time: string): { hh: number; mm: number } {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!m) throw new Error(`Invalid birth time (expected HH:MM): ${time}`);
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (hh > 23 || mm > 59) throw new Error(`Invalid birth time: ${time}`);
  return { hh, mm };
}

function buildHouses(firstHouseSign: number, planets: ChartPlanet[]): ChartHouse[] {
  const houses: ChartHouse[] = [];
  for (let n = 1; n <= 12; n++) {
    const sign = ((firstHouseSign - 1 + n - 1) % 12) + 1;
    houses.push({ n, sign, lord: SIGN_LORDS[sign - 1], occupants: planets.filter((p) => p.house === n).map((p) => p.id) });
  }
  return houses;
}

function houseFromSign(sign: number, firstHouseSign: number): number {
  return ((sign - firstHouseSign + 12) % 12) + 1;
}

/**
 * Computes the D1 Rashi chart (ChartData) for a birth. Unknown time -> Moon-chart mode (positions at local
 * noon, drift window +-12 h, lagna undefined, houses counted from the Moon sign).
 */
export function computeChart(birth: BirthInput, opts: ChartOptions = {}): ChartData {
  const ayanamsaType: Ayanamsa = opts.ayanamsa ?? 'lahiri';
  const node: NodeMode = opts.node ?? 'mean';
  const houseSystem: HouseSystem = opts.houseSystem ?? 'whole_sign';
  const zone = canonicalZone(birth.tz);
  if (!zone) throw new Error(`Unknown time zone: ${birth.tz}`);
  if (!Number.isFinite(birth.lat) || birth.lat < -90 || birth.lat > 90) throw new Error(`Invalid latitude: ${birth.lat}`);
  if (!Number.isFinite(birth.lon) || birth.lon < -180 || birth.lon > 180) throw new Error(`Invalid longitude: ${birth.lon}`);
  const { y, m, d } = parseDate(birth.date);
  const timeUnknown = Boolean(birth.timeUnknown) || !birth.time;
  const { hh, mm } = timeUnknown ? { hh: 12, mm: 0 } : parseTime(birth.time as string);
  const conv = localToUtc(zone, { y, m, d, hh, mm });
  const utcMs = conv.utcMs;
  const driftMinutes = timeUnknown ? 720 : (birth.approxMinutes ?? 0);
  const elevation = birth.elevation ?? 0;
  const observer = new Observer(birth.lat, birth.lon, elevation);

  const main = computeRaw(utcMs, observer, ayanamsaType, node);
  const minus = driftMinutes ? computeRaw(utcMs - driftMinutes * 60_000, observer, ayanamsaType, node) : null;
  const plus = driftMinutes ? computeRaw(utcMs + driftMinutes * 60_000, observer, ayanamsaType, node) : null;
  const signOf = (lon: number): number => Math.floor(norm360(lon) / 30);

  const approxOf = (lon: number, lonMinus?: number, lonPlus?: number): boolean =>
    nearBoundary(lon) ||
    (lonMinus !== undefined && crossesBoundary(lonMinus, lon, signOf)) ||
    (lonPlus !== undefined && crossesBoundary(lon, lonPlus, signOf));

  let lagna: ChartLagna | undefined;
  if (!timeUnknown) {
    lagna = {
      ...pointFromLongitude(main.lagna),
      approx: approxOf(main.lagna, minus?.lagna, plus?.lagna),
      ...(minus && plus ? { drift: { minus: norm360(minus.lagna), plus: norm360(plus.lagna) } } : {}),
    };
  }
  const moonSign = Math.floor(norm360(main.planets.Mo.longitude) / 30) + 1;
  const firstHouseSign = lagna ? lagna.sign : moonSign;

  const planets: ChartPlanet[] = PLANET_IDS.map((id) => {
    const raw = main.planets[id];
    const point = pointFromLongitude(raw.longitude);
    const planet: ChartPlanet = {
      id,
      ...point,
      approx: approxOf(raw.longitude, minus?.planets[id].longitude, plus?.planets[id].longitude),
      house: houseFromSign(point.sign, firstHouseSign),
      tags: tagsFor(id, point.sign, raw, true),
      speed: raw.speed,
      retrograde: raw.retrograde,
      combust: raw.combust,
      vargottama: raw.vargottama,
    };
    if (minus && plus) planet.drift = { minus: norm360(minus.planets[id].longitude), plus: norm360(plus.planets[id].longitude) };
    return planet;
  });

  return {
    variant: 'lagna',
    lagna,
    firstHouseSign,
    planets,
    houses: buildHouses(firstHouseSign, planets),
    moonChart: timeUnknown,
    approx: { lagna: lagna ? lagna.approx : false },
    meta: {
      ayanamsa: ayanamsaType,
      ayanamsaDegrees: main.ayanamsa,
      node,
      nodeMethod: node === 'true' ? TRUE_NODE_METHOD : MEAN_NODE_METHOD,
      ephemeris: EPHEMERIS,
      tz: zone,
      utcMs,
      offsetMinutes: conv.offsetMinutes,
      clockGap: conv.clockGap,
      overlap: conv.overlap,
      lat: birth.lat,
      lon: birth.lon,
      elevation,
      houseSystem,
      timeUnknown,
      approxMinutes: driftMinutes,
      combustionOrbs: COMBUSTION_ORBS,
      computedAt: new Date().toISOString(),
    },
  };
}

function rashiCentric(chart: ChartData, variant: 'moon' | 'sun', firstHouseSign: number): ChartData {
  const planets = chart.planets.map((p) => ({ ...p, house: houseFromSign(p.sign, firstHouseSign) }));
  return {
    ...chart,
    variant,
    lagna: undefined,
    firstHouseSign,
    planets,
    houses: buildHouses(firstHouseSign, planets),
    approx: { lagna: false },
  };
}

/** Chandra Kundli: the Moon's sign becomes house 1; positions unchanged. */
export function moonChart(chart: ChartData): ChartData {
  const moon = chart.planets.find((p) => p.id === 'Mo');
  if (!moon) throw new Error('Chart has no Moon');
  return rashiCentric(chart, 'moon', moon.sign);
}

/** Surya Kundli: the Sun's sign becomes house 1; positions unchanged. */
export function sunChart(chart: ChartData): ChartData {
  const sun = chart.planets.find((p) => p.id === 'Su');
  if (!sun) throw new Error('Chart has no Sun');
  return rashiCentric(chart, 'sun', sun.sign);
}

const VARGA_DIVISOR: Record<VargaId, number> = {
  D1: 1, D2: 2, D3: 3, D4: 4, D5: 5, D6: 6, D7: 7, D8: 8, D9: 9, D10: 10, D11: 11, D12: 12,
  D16: 16, D20: 20, D24: 24, D27: 27, D30: 30, D40: 40, D45: 45, D60: 60,
};

function vargaSignMap(id: VargaId): (lon: number) => number {
  const key = id.toLowerCase();
  const probe = { P: { longitude: 0 } };
  return (lon: number): number => {
    probe.P.longitude = norm360(lon);
    return getAllVargas(0, probe)[key].planets.P.rashi - 1;
  };
}

/**
 * Divisional chart (D2 ... D60) derived from the D1 ChartData via the fork's varga rules. Planet longitudes are
 * expressed inside the varga sign as (degree-in-sign x n) mod 30 (the usual convention). Approx flags are the
 * D1 flag or a varga-boundary crossing inside the uncertainty window.
 */
export function varga(chart: ChartData, id: VargaId): ChartData {
  if (!VARGA_DIVISOR[id]) throw new Error(`Unknown varga: ${id}`);
  const mapSign = vargaSignMap(id);
  const n = VARGA_DIVISOR[id];
  const toVarga = (lon: number): number => {
    const sign = mapSign(lon);
    const inSign = ((norm360(lon) % 30) * n) % 30;
    return sign * 30 + inSign;
  };
  const lagna = chart.lagna
    ? {
        ...pointFromLongitude(toVarga(chart.lagna.longitude)),
        approx:
          chart.lagna.approx ||
          (chart.lagna.drift ? mapSign(chart.lagna.drift.minus) !== mapSign(chart.lagna.longitude) || mapSign(chart.lagna.drift.plus) !== mapSign(chart.lagna.longitude) : false),
      }
    : undefined;
  const moon = chart.planets.find((p) => p.id === 'Mo');
  if (!moon) throw new Error('Chart has no Moon');
  const firstHouseSign = lagna ? lagna.sign : mapSign(moon.longitude) + 1;
  const planets: ChartPlanet[] = chart.planets.map((p) => {
    const point = pointFromLongitude(toVarga(p.longitude));
    const approx = p.approx || (p.drift ? mapSign(p.drift.minus) !== mapSign(p.longitude) || mapSign(p.drift.plus) !== mapSign(p.longitude) : false);
    return {
      ...p,
      ...point,
      approx,
      house: houseFromSign(point.sign, firstHouseSign),
      tags: tagsFor(p.id, point.sign, p, id === 'D1' || id === 'D9'),
      drift: undefined,
    };
  });
  return {
    ...chart,
    variant: id,
    lagna,
    firstHouseSign,
    planets,
    houses: buildHouses(firstHouseSign, planets),
    approx: { lagna: lagna ? lagna.approx : false },
  };
}

/**
 * Bhava Chalit (Sripati): bhava madhyas from the Lagna and the astronomical Midheaven, sandhis at the midpoints;
 * planets are assigned to bhavas by sandhi, so a planet may sit in a different house than in D1. Requires a
 * birth time.
 */
export function chalit(chart: ChartData): ChartData {
  if (!chart.lagna || chart.moonChart) throw new Error('Chalit needs a known birth time');
  const observer = new Observer(chart.meta.lat, chart.meta.lon, chart.meta.elevation);
  const bhavas = getHouses(chart.lagna.longitude, 'sripati', new Date(chart.meta.utcMs), observer, chart.meta.ayanamsaDegrees);
  const inBhava = (lon: number, start: number, end: number): boolean => {
    const p = norm360(lon);
    const s = norm360(start);
    const e = norm360(end);
    return s < e ? p >= s && p < e : p >= s || p < e;
  };
  const planets = chart.planets.map((p) => {
    const b = bhavas.find((h) => inBhava(p.longitude, h.startLongitude, h.endLongitude)) ?? bhavas[0];
    return { ...p, house: b.number };
  });
  const houses: ChartHouse[] = bhavas.map((b) => ({
    n: b.number,
    sign: b.rashi,
    lord: SIGN_LORDS[b.rashi - 1],
    occupants: planets.filter((p) => p.house === b.number).map((p) => p.id),
  }));
  return { ...chart, variant: 'chalit', planets, houses };
}
