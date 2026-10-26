// Krishnamurti Paddhati (spec F15 / F19, design 10.3 F15 "Placidus cusps table, sub-lords, significators by
// house, ruling planets for now", plan B01). Pure functions over the engine's own inputs; the Placidus solver and
// the Vimshottari sub-division come from the vendored fork (`calculateTropicalPlacidusCusps`, `getKpSubLordDetails`).
//
// Conventions:
// - Ayanamsa defaults to KP (Krishnamurti, 22.363889 deg at J1900 + IAU 2006 precession, see vendor ayanamsa.ts);
//   Settings may pass Lahiri or Raman (F19). The house system is fixed to Placidus (spec F19).
// - Cusps: tropical Ascendant and Midheaven from the fork (true obliquity), intermediate cusps by Placidus semi-arc
//   trisection, then minus the ayanamsa. Above |latitude| ~ 66 deg Placidus degenerates; the solver still returns
//   values and `polar: true` is set so the UI can mark them approx.
// - Four-fold lords: sign lord, star (nakshatra) lord, sub lord and sub-sub lord by the Vimshottari proportions
//   (120-year cycle), starting each nakshatra's sub division with its own star lord.
// - A planet's house = the Placidus house whose [cusp, next cusp) span holds its longitude ("bhava" rule, not the
//   whole sign). Nodes follow the chart option (mean default, true via P11).
// - Significators (KP strength order A > B > C > D): A = planets in the star of an occupant of the house;
//   B = occupants; C = planets in the star of the house's cusp (sign) lord; D = the cusp lord. Rahu/Ketu stand in
//   for the lord of the sign they occupy and for planets conjunct them (agent rule) only in `agents`, never in A-D.
// - Ruling planets at an instant: Lagna sub lord, Lagna star lord, Lagna sign lord, Moon sub lord, Moon star lord,
//   Moon sign lord, day lord (vara of the Vedic day at the observer, from the engine's tz table), de-duplicated in
//   that order; a node in the star of a ruling planet is added as an agent.
import { Observer } from 'astronomy-engine';
import { getAyanamsa, type AyanamsaType } from '../../vendor/jyotish/src/core/ayanamsa';
import { getKpSubLordDetails, getMidheaven, getUdayaLagna } from '../../vendor/jyotish/src/core/calculations';
import { calculateTropicalPlacidusCusps } from '../../vendor/jyotish/src/kundli/kp';
import { type BirthInput, type ChartData, type ChartOptions, type ChartPlace, chartPoint, computeChart, computeChartAt } from '../kundli/index';
import { PLANET_IDS, type PlanetId, planetIdFromKey, SIGN_LORDS } from '../locale/index';
import { type GeoPoint, dayFrame, localDateOf, norm360, resolveZone } from '../panchang/astro';
import { VARA_LORDS } from '../panchang/panchang';

export interface KpOptions extends ChartOptions {
  /** Default 'kp'. */
  ayanamsa?: AyanamsaType;
}

export interface KpLords {
  signLord: PlanetId;
  starLord: PlanetId;
  subLord: PlanetId;
  subSubLord: PlanetId;
}

export interface KpCuspRow extends KpLords {
  /** 1-12. */
  n: number;
  longitude: number;
  sign: number;
  degree: number;
  minute: number;
  second: number;
  nakshatra: number;
  pada: number;
  /** Longitude of the next cusp (the house runs [longitude, end)). */
  end: number;
  span: number;
  occupants: PlanetId[];
}

export interface KpPlanetRow extends KpLords {
  id: PlanetId;
  longitude: number;
  sign: number;
  degree: number;
  minute: number;
  second: number;
  nakshatra: number;
  pada: number;
  /** Placidus house 1-12. */
  house: number;
  retrograde: boolean;
  combust: boolean;
}

export interface KpHouseSignificators {
  house: number;
  A: PlanetId[];
  B: PlanetId[];
  C: PlanetId[];
  D: PlanetId[];
  /** Nodes acting for the sign lord or a conjunct planet of this house (KP agent rule), listed separately. */
  agents: PlanetId[];
}

export interface KpRulingPlanetsReport {
  at: number;
  lagna: KpLords & { longitude: number; sign: number };
  moon: KpLords & { longitude: number; sign: number };
  dayLord: PlanetId;
  /** De-duplicated ruling planets in KP order. */
  list: PlanetId[];
  /** Nodes in the star of a ruling planet (agents). */
  agents: PlanetId[];
  ruleId: 'kp-ruling-planets';
}

export interface KpReport {
  utcMs: number;
  tz: string;
  ayanamsa: AyanamsaType;
  ayanamsaDegrees: number;
  houseSystem: 'placidus';
  cusps: KpCuspRow[];
  planets: KpPlanetRow[];
  significators: KpHouseSignificators[];
  /** Houses each planet signifies at any level (sorted). */
  planetSignificators: Record<PlanetId, { A: number[]; B: number[]; C: number[]; D: number[]; all: number[] }>;
  rulingPlanetsAtBirth: KpRulingPlanetsReport;
  /** |lat| >= 66 deg: Placidus is unreliable, values carry the approx marker. */
  polar: boolean;
  /** True when the birth time is unknown; cusps are then computed for local noon and must be shown as approx. */
  timeUnknown: boolean;
  nodeMethod: string;
  ruleIds: readonly string[];
}

export const KP_RULE_IDS = ['kp-cusps-placidus', 'kp-sub-lord', 'kp-significators', 'kp-ruling-planets'] as const;
export const KP_POLAR_LATITUDE = 66;

function lord(name: string): PlanetId {
  const id = planetIdFromKey(name);
  if (!id) throw new Error(`Unknown KP lord ${name}`);
  return id;
}

function lordsOf(longitude: number): KpLords & { nakshatra: number; pada: number } {
  const d = getKpSubLordDetails(norm360(longitude));
  return { signLord: lord(d.rashiLord), starLord: lord(d.nakshatraLord), subLord: lord(d.subLord), subSubLord: lord(d.subSubLord), nakshatra: d.nakshatraIndex + 1, pada: d.pada };
}

function inHouse(lon: number, start: number, end: number): boolean {
  const p = norm360(lon);
  const s = norm360(start);
  const e = norm360(end);
  return s < e ? p >= s && p < e : p >= s || p < e;
}

/** Sidereal Placidus cusps (12, index 0 = house 1) for an instant at a place. */
export function placidusCusps(utcMs: number, place: ChartPlace, ayanamsa: AyanamsaType): number[] {
  const date = new Date(utcMs);
  const observer = new Observer(place.lat, place.lon, place.elevation ?? 0);
  const ay = getAyanamsa(date, ayanamsa);
  const tropAsc = getUdayaLagna(date, observer, 0);
  const tropMc = getMidheaven(date, observer, 0);
  // Placidus trisection with the mean obliquity (the fork's constant); the Ascendant and MC themselves come from the
  // true obliquity, so cusps 1/4/7/10 agree with the Lagna of the D1 chart.
  const cusps = calculateTropicalPlacidusCusps(tropMc, tropAsc, Math.max(-KP_POLAR_LATITUDE + 0.01, Math.min(KP_POLAR_LATITUDE - 0.01, place.lat)), 23.4392911);
  return cusps.map((c) => norm360(c - ay));
}

function buildReport(chart: ChartData, ayanamsa: AyanamsaType): KpReport {
  const place: ChartPlace = { lat: chart.meta.lat, lon: chart.meta.lon, elevation: chart.meta.elevation };
  const cuspLons = placidusCusps(chart.meta.utcMs, place, ayanamsa);
  const cusps: KpCuspRow[] = cuspLons.map((lon, i) => {
    const point = chartPoint(lon);
    const end = cuspLons[(i + 1) % 12];
    return { n: i + 1, longitude: lon, sign: point.sign, degree: point.degree, minute: point.minute, second: point.second, end, span: norm360(end - lon), occupants: [], ...lordsOf(lon) };
  });
  const planets: KpPlanetRow[] = chart.planets.map((p) => {
    const house = cusps.find((c) => inHouse(p.longitude, c.longitude, c.end))?.n ?? 1;
    cusps[house - 1].occupants.push(p.id);
    return {
      id: p.id,
      longitude: p.longitude,
      sign: p.sign,
      degree: p.degree,
      minute: p.minute,
      second: p.second,
      house,
      retrograde: p.retrograde,
      combust: p.combust,
      ...lordsOf(p.longitude),
    };
  });
  const byId = (id: PlanetId): KpPlanetRow => planets.find((p) => p.id === id) as KpPlanetRow;
  const significators: KpHouseSignificators[] = cusps.map((c) => {
    const B = [...c.occupants];
    const D = [c.signLord];
    const A = PLANET_IDS.filter((id) => B.includes(byId(id).starLord));
    const C = PLANET_IDS.filter((id) => byId(id).starLord === c.signLord);
    const agents = (['Ra', 'Ke'] as PlanetId[]).filter((n) => {
      const node = byId(n);
      const conjunct = planets.filter((p) => p.id !== n && p.id !== 'Ra' && p.id !== 'Ke' && p.sign === node.sign).map((p) => p.id);
      return node.signLord === c.signLord || conjunct.some((p) => B.includes(p) || D.includes(p));
    });
    return { house: c.n, A, B, C, D, agents };
  });
  const planetSignificators = {} as KpReport['planetSignificators'];
  for (const id of PLANET_IDS) {
    const A = significators.filter((s) => s.A.includes(id)).map((s) => s.house);
    const B = significators.filter((s) => s.B.includes(id)).map((s) => s.house);
    const C = significators.filter((s) => s.C.includes(id)).map((s) => s.house);
    const D = significators.filter((s) => s.D.includes(id)).map((s) => s.house);
    planetSignificators[id] = { A, B, C, D, all: Array.from(new Set([...A, ...B, ...C, ...D])).sort((a, b) => a - b) };
  }
  return {
    utcMs: chart.meta.utcMs,
    tz: chart.meta.tz,
    ayanamsa,
    ayanamsaDegrees: chart.meta.ayanamsaDegrees,
    houseSystem: 'placidus',
    cusps,
    planets,
    significators,
    planetSignificators,
    rulingPlanetsAtBirth: rulingPlanetsFromChart(chart, cuspLons[0]),
    polar: Math.abs(chart.meta.lat) >= KP_POLAR_LATITUDE,
    timeUnknown: chart.meta.timeUnknown,
    nodeMethod: chart.meta.nodeMethod,
    ruleIds: KP_RULE_IDS,
  };
}

function rulingPlanetsFromChart(chart: ChartData, lagnaLon: number): KpRulingPlanetsReport {
  const moon = chart.planets.find((p) => p.id === 'Mo');
  if (!moon) throw new Error('Chart has no Moon');
  const lg = lordsOf(lagnaLon);
  const mo = lordsOf(moon.longitude);
  const date = localDateOf(chart.meta.utcMs, chart.meta.tz);
  const geo: GeoPoint = { lat: chart.meta.lat, lon: chart.meta.lon, elevation: chart.meta.elevation };
  // Vedic day: an instant before sunrise belongs to the previous civil date's vara.
  let frame = dayFrame(date, chart.meta.tz, geo);
  if (frame && chart.meta.utcMs < frame.sunrise) {
    const prev = new Date(chart.meta.utcMs - 86_400_000);
    frame = dayFrame(localDateOf(prev.getTime(), chart.meta.tz), chart.meta.tz, geo) ?? frame;
  }
  const vara = frame ? frame.vara : new Date(chart.meta.utcMs).getUTCDay();
  const dayLord = VARA_LORDS[vara];
  const list: PlanetId[] = [];
  for (const id of [lg.subLord, lg.starLord, lg.signLord, mo.subLord, mo.starLord, mo.signLord, dayLord]) if (!list.includes(id)) list.push(id);
  const agents = (['Ra', 'Ke'] as PlanetId[]).filter((n) => {
    const node = chart.planets.find((p) => p.id === n);
    return node ? list.includes(lordsOf(node.longitude).starLord) || list.includes(SIGN_LORDS[node.sign - 1]) : false;
  });
  return {
    at: chart.meta.utcMs,
    lagna: { ...lg, longitude: lagnaLon, sign: Math.floor(lagnaLon / 30) + 1 },
    moon: { ...mo, longitude: moon.longitude, sign: moon.sign },
    dayLord,
    list,
    agents,
    ruleId: 'kp-ruling-planets',
  };
}

/** KP chart of a birth: Placidus cusps with four-fold lords, planets with lords and houses, significators A-D, ruling planets at birth. */
export function kp(birth: BirthInput, opts: KpOptions = {}): KpReport {
  const ayanamsa = opts.ayanamsa ?? 'kp';
  const chart = computeChart(birth, { ...opts, ayanamsa });
  return buildReport(chart, ayanamsa);
}

/** KP chart of an instant at a place (Prashna-style). */
export function kpAt(utcMs: number, place: ChartPlace, tz: string, opts: KpOptions = {}): KpReport {
  const ayanamsa = opts.ayanamsa ?? 'kp';
  const chart = computeChartAt(utcMs, place, tz, { ...opts, ayanamsa });
  return buildReport(chart, ayanamsa);
}

/** Ruling planets for "now" (design 10.3 F15) at the observer's place. */
export function rulingPlanets(nowMs: number, place: ChartPlace, tz: string, opts: KpOptions = {}): KpRulingPlanetsReport {
  const ayanamsa = opts.ayanamsa ?? 'kp';
  const zone = resolveZone(tz);
  const chart = computeChartAt(nowMs, place, zone, { ...opts, ayanamsa });
  const lagnaLon = placidusCusps(nowMs, place, ayanamsa)[0];
  return rulingPlanetsFromChart(chart, lagnaLon);
}
