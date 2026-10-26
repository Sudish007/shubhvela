// Varshaphal / Tajika annual chart (spec F17, design 10.3 F17 + 10.6 Varshaphal report, plan B01).
// Everything is computed: the solar-return instant by search on the sidereal Sun, the annual chart with the
// engine's own computeChartAt(), Muntha, the year lord by the five-candidate (panchadhikari) Tajika rule with
// Panchavargiya bala, the basic Tajika aspect list, the Vimshottari-proportional Mudda dasha and the transit calendar.
//
// Conventions (listed under "How this was computed"; sources: Tajika Neelakanthi (TN), Varsha Tantra):
// - Solar return (varsha pravesha) = the instant the sidereal Sun returns to its natal longitude in the given
//   Gregorian year, with the natal chart's ayanamsa; `year` is the Gregorian year of the return and age = year -
//   birth year (age 0 = the birth itself). The chart is cast for the birthplace unless another place is given.
// - Muntha: the natal Lagna sign advanced one sign per completed year; its house is read in the annual chart. In
//   Moon-chart mode (unknown birth time) the Moon sign stands in and the result is approx.
// - Year lord (Varshesha): the five candidates are the Muntha lord, the natal Lagna lord, the annual Lagna lord,
//   the tri-rashi lord of the annual Lagna sign (day/night table of TN) and the dina/ratri lord (lord of the Sun's
//   sign for a day return, of the Moon's sign for a night return). Only candidates that aspect the annual Lagna by a
//   Tajika aspect (sign distance 1, 3, 4, 5, 7, 9, 10, 11; 2/12 and 6/8 are no aspect) qualify; a candidate with a
//   friendly aspect (3/11, 5/9) is preferred over one with an inimical aspect (B.V. Raman, Varshaphala ch. 4 art.
//   47-52: "a favourable aspect to the Lagna overrides lordships and strength"); within a tier the highest
//   Panchavargiya bala wins, an exact tie goes to the dina/ratri lord, then to the candidate order above. If no
//   candidate aspects the Lagna the strongest candidate is taken and `method` says so.
// - Panchavargiya bala (TN) in vishwa: kshetra 30/22.5/15/7.5/3.75/1.875, uccha 20 x (180 - distance from the deep
//   exaltation point)/180, hadda (Egyptian terms) 15/11.25/7.5/3.75/1.875/0.9375, drekkana 10/7.5/5/2.5/1.25/0.625,
//   navamsa 5/3.75/2.5/1.25/0.625/0.3125 for own / adhimitra / mitra / sama / shatru / adhishatru, where the six-fold
//   relationship is the compound of Parashara's natural friendship and the temporal one (friend when the other planet
//   is 2, 3, 4, 10, 11 or 12 signs away in the annual chart). Total / 4 (max 20): < 5 weak, 5-10 ordinary, 10-15
//   powerful, >= 15 very strong (B.V. Raman, Varshaphala ch. 3 art. 37-46; the worked example there reproduces these
//   unit values: Saturn in own sign 30, Sun in a friend's sign 15, Mars in a neutral's sign 7.5).
// - Tajika aspects by sign distance: 3/11 friendly, 5/9 secret friendly, 1/7 inimical, 4/10 secret inimical;
//   2/12 and 6/8 are no aspect. Orb-based ithasala/ishrafa are not computed in v1.
// - Mudda dasha: the year (this return -> next return) divided in the Vimshottari proportions (years/120), starting
//   from the natal Moon's nakshatra lord (FEAT-B01 convention; the sum of the periods is exactly the year).
// - Transit calendar: sidereal sign intervals of the Sun, Mars, Jupiter, Saturn, Rahu and Ketu over the year.
import { Body, Ecliptic, GeoVector } from 'astronomy-engine';
import { type AyanamsaType } from '../../vendor/jyotish/src/core/ayanamsa';
import { type ChartData, type ChartPlace, computeChartAt, houseFromSign, naturalRelation } from '../kundli/index';
import { type IngressPlanet, ingressDates, siderealLongitude } from '../dasha/index';
import { PLANET_IDS, type PlanetId, SIGN_LORDS } from '../locale/index';
import { DAY_MS, type GeoPoint, ayanamsaAt, dayFrame, localDateOf, nextCrossing, norm360, resolveZone, siderealSun, wrap180 } from '../panchang/astro';
import { NAKSHATRA_LORDS } from '../panchang/panchang';
import { VIMSHOTTARI_ORDER, VIMSHOTTARI_YEARS } from '../dasha/index';
import { utcToWall } from '../tz/index';

export type Relation6 = 'own' | 'adhimitra' | 'mitra' | 'sama' | 'shatru' | 'adhishatru';
export type YearLordRole = 'muntha-lord' | 'janma-lagna-lord' | 'varsha-lagna-lord' | 'tri-rashi-lord' | 'dina-ratri-lord';
export type TajikaAspectKind = 'friendly-3-11' | 'secret-friendly-5-9' | 'inimical-1-7' | 'secret-inimical-4-10';
export type TajikaBody = PlanetId | 'Lg';

export interface PanchavargiyaBala {
  planet: PlanetId;
  kshetra: { value: number; relation: Relation6; signLord: PlanetId };
  uccha: { value: number; distance: number };
  hadda: { value: number; relation: Relation6; lord: PlanetId };
  drekkana: { value: number; relation: Relation6; lord: PlanetId };
  navamsa: { value: number; relation: Relation6; lord: PlanetId };
  /** Sum in vishwa (max 80). */
  total: number;
  /** total / 4 (max 20). */
  rupas: number;
  /** B.V. Raman's classes of total/4: < 5 weak, 5-10 ordinary, 10-15 powerful, >= 15 very strong. */
  grade: 'weak' | 'ordinary' | 'powerful' | 'very-strong';
}

export interface YearLordCandidate {
  role: YearLordRole;
  planet: PlanetId;
  bala: number;
  aspectsLagna: boolean;
  aspectKind: TajikaAspectKind | null;
}

export interface TajikaAspect {
  a: TajikaBody;
  b: TajikaBody;
  kind: TajikaAspectKind;
  /** Sign distance from a to b (1-12). */
  distance: number;
}

export interface MuddaPeriod {
  lord: PlanetId;
  start: number;
  end: number;
  /** Fraction of the year (years / 120). */
  share: number;
}

export interface TransitInterval {
  planet: PlanetId;
  /** 1-12. */
  sign: number;
  from: number;
  to: number;
  /** True when the planet entered the sign moving backwards. */
  retrogradeEntry: boolean;
}

export interface VarshaphalReport {
  /** Gregorian year of the solar return and the age it begins. */
  year: number;
  age: number;
  instant: number;
  tz: string;
  place: ChartPlace;
  /** Instant of the following return (end of the Varshaphal year). */
  nextInstant: number;
  chart: ChartData;
  dayReturn: boolean;
  muntha: { sign: number; house: number; lord: PlanetId; base: 'lagna' | 'moon'; ruleId: 'varshaphal-muntha' };
  yearLord: { planet: PlanetId; role: YearLordRole; candidates: YearLordCandidate[]; method: 'tajika-panchadhikari' | 'tajika-panchadhikari-no-aspect-fallback'; ruleId: 'varshaphal-year-lord' };
  balas: Record<PlanetId, PanchavargiyaBala | null>;
  tajikaAspects: TajikaAspect[];
  muddaDasha: MuddaPeriod[];
  transitCalendar: TransitInterval[];
  /** Keys of the method lines (rules corpus) shown under "How this was computed". */
  computedWith: string[];
  approx: boolean;
  ruleIds: readonly string[];
}

export const VARSHAPHAL_RULE_IDS = [
  'varshaphal-solar-return',
  'varshaphal-muntha',
  'varshaphal-year-lord',
  'varshaphal-panchavargiya-bala',
  'varshaphal-tajika-aspects',
  'varshaphal-mudda-dasha',
  'varshaphal-transit-calendar',
] as const;

/** Deep exaltation points (sidereal degrees): Sun 10 Mesha, Moon 3 Vrishabha, Mars 28 Makara, Mercury 15 Kanya, Jupiter 5 Karka, Venus 27 Meena, Saturn 20 Tula. */
export const DEEP_EXALTATION: Record<Exclude<PlanetId, 'Ra' | 'Ke'>, number> = { Su: 10, Mo: 33, Ma: 298, Me: 165, Ju: 95, Ve: 357, Sa: 200 };

/** Hadda (Egyptian terms) per sign: [end degree, lord] in order (Tajika Neelakanthi). */
export const HADDA: readonly (readonly [number, PlanetId][])[] = [
  [[6, 'Ju'], [12, 'Ve'], [20, 'Me'], [25, 'Ma'], [30, 'Sa']],
  [[8, 'Ve'], [14, 'Me'], [22, 'Ju'], [27, 'Sa'], [30, 'Ma']],
  [[6, 'Me'], [12, 'Ju'], [17, 'Ve'], [24, 'Ma'], [30, 'Sa']],
  [[7, 'Ma'], [13, 'Ve'], [19, 'Me'], [26, 'Ju'], [30, 'Sa']],
  [[6, 'Ju'], [11, 'Ve'], [18, 'Sa'], [24, 'Me'], [30, 'Ma']],
  [[7, 'Me'], [17, 'Ve'], [21, 'Ju'], [28, 'Ma'], [30, 'Sa']],
  [[6, 'Sa'], [14, 'Me'], [21, 'Ju'], [28, 'Ve'], [30, 'Ma']],
  [[7, 'Ma'], [11, 'Ve'], [19, 'Me'], [24, 'Ju'], [30, 'Sa']],
  [[12, 'Ju'], [17, 'Ve'], [21, 'Me'], [26, 'Sa'], [30, 'Ma']],
  [[7, 'Me'], [14, 'Ju'], [22, 'Ve'], [26, 'Sa'], [30, 'Ma']],
  [[7, 'Me'], [13, 'Ve'], [20, 'Ju'], [25, 'Ma'], [30, 'Sa']],
  [[12, 'Ve'], [16, 'Ju'], [19, 'Me'], [28, 'Ma'], [30, 'Sa']],
];

/**
 * Tri-rashi (trirasyadhipati) lords by the element of the annual Lagna sign, [day lord, night lord]: fiery signs
 * Sun / Jupiter, earthy Venus / Moon, airy Saturn / Mercury, watery Mars / Mars (Tajika Neelakanthi; B.V. Raman,
 * Varshaphala ch. 4). Index 0 = Mesha.
 */
export const TRI_RASHI_LORDS: readonly (readonly [PlanetId, PlanetId])[] = [
  ['Su', 'Ju'], // Mesha (fire)
  ['Ve', 'Mo'], // Vrishabha (earth)
  ['Sa', 'Me'], // Mithuna (air)
  ['Ma', 'Ma'], // Karka (water)
  ['Su', 'Ju'], // Simha
  ['Ve', 'Mo'], // Kanya
  ['Sa', 'Me'], // Tula
  ['Ma', 'Ma'], // Vrishchika
  ['Su', 'Ju'], // Dhanu
  ['Ve', 'Mo'], // Makara
  ['Sa', 'Me'], // Kumbha
  ['Ma', 'Ma'], // Meena
];

const BALA_VALUES: Record<'kshetra' | 'hadda' | 'drekkana' | 'navamsa', Record<Relation6, number>> = {
  kshetra: { own: 30, adhimitra: 22.5, mitra: 15, sama: 7.5, shatru: 3.75, adhishatru: 1.875 },
  hadda: { own: 15, adhimitra: 11.25, mitra: 7.5, sama: 3.75, shatru: 1.875, adhishatru: 0.9375 },
  drekkana: { own: 10, adhimitra: 7.5, mitra: 5, sama: 2.5, shatru: 1.25, adhishatru: 0.625 },
  navamsa: { own: 5, adhimitra: 3.75, mitra: 2.5, sama: 1.25, shatru: 0.625, adhishatru: 0.3125 },
};

function dist(fromSign: number, toSign: number): number {
  return ((toSign - fromSign + 12) % 12) + 1;
}

export function tajikaAspectKind(distance: number): TajikaAspectKind | null {
  if (distance === 3 || distance === 11) return 'friendly-3-11';
  if (distance === 5 || distance === 9) return 'secret-friendly-5-9';
  if (distance === 1 || distance === 7) return 'inimical-1-7';
  if (distance === 4 || distance === 10) return 'secret-inimical-4-10';
  return null;
}

/** Six-fold (panchadha) relationship of `planet` towards `other` in a chart: natural x temporal. */
export function compoundRelation(chart: ChartData, planet: PlanetId, other: PlanetId): Relation6 {
  if (planet === other) return 'own';
  const natural = naturalRelation(planet, other);
  if (natural === 'self') return 'own';
  const a = chart.planets.find((p) => p.id === planet);
  const b = chart.planets.find((p) => p.id === other);
  if (!a || !b) throw new Error(`Chart lacks ${planet} or ${other}`);
  const d = dist(a.sign, b.sign);
  const temporalFriend = [2, 3, 4, 10, 11, 12].includes(d);
  if (natural === 'friend') return temporalFriend ? 'adhimitra' : 'sama';
  if (natural === 'neutral') return temporalFriend ? 'mitra' : 'shatru';
  return temporalFriend ? 'sama' : 'adhishatru';
}

export function haddaLord(longitude: number): PlanetId {
  const lon = norm360(longitude);
  const sign = Math.floor(lon / 30);
  const deg = lon - sign * 30;
  for (const [end, lord] of HADDA[sign]) if (deg < end) return lord;
  return HADDA[sign][4][1];
}

export function drekkanaLord(longitude: number): PlanetId {
  const lon = norm360(longitude);
  const sign = Math.floor(lon / 30);
  const part = Math.min(2, Math.floor((lon - sign * 30) / 10));
  return SIGN_LORDS[(sign + part * 4) % 12];
}

export function navamsaLord(longitude: number): PlanetId {
  const idx = Math.floor(norm360(longitude) / (360 / 108)) % 12;
  return SIGN_LORDS[idx];
}

/** Panchavargiya bala of one of the seven planets in an (annual) chart; null for the nodes. */
export function panchavargiyaBala(chart: ChartData, planet: PlanetId): PanchavargiyaBala | null {
  if (planet === 'Ra' || planet === 'Ke') return null;
  const p = chart.planets.find((x) => x.id === planet);
  if (!p) throw new Error(`Chart has no ${planet}`);
  const rel = (other: PlanetId): Relation6 => compoundRelation(chart, planet, other);
  const signLord = SIGN_LORDS[p.sign - 1];
  const kRel = rel(signLord);
  const hLord = haddaLord(p.longitude);
  const hRel = rel(hLord);
  const dLord = drekkanaLord(p.longitude);
  const dRel = rel(dLord);
  const nLord = navamsaLord(p.longitude);
  const nRel = rel(nLord);
  const distance = Math.abs(wrap180(p.longitude - DEEP_EXALTATION[planet]));
  const uccha = (20 * (180 - distance)) / 180;
  const kshetra = BALA_VALUES.kshetra[kRel];
  const hadda = BALA_VALUES.hadda[hRel];
  const drekkana = BALA_VALUES.drekkana[dRel];
  const navamsa = BALA_VALUES.navamsa[nRel];
  const total = kshetra + uccha + hadda + drekkana + navamsa;
  const rupas = total / 4;
  return {
    planet,
    kshetra: { value: kshetra, relation: kRel, signLord },
    uccha: { value: uccha, distance },
    hadda: { value: hadda, relation: hRel, lord: hLord },
    drekkana: { value: drekkana, relation: dRel, lord: dLord },
    navamsa: { value: navamsa, relation: nRel, lord: nLord },
    total,
    rupas,
    grade: rupas >= 15 ? 'very-strong' : rupas >= 10 ? 'powerful' : rupas >= 5 ? 'ordinary' : 'weak',
  };
}

/** Tajika aspects between every pair of the nine planets and the Lagna (sign based). */
export function tajikaAspects(chart: ChartData): TajikaAspect[] {
  const bodies: { id: TajikaBody; sign: number }[] = [{ id: 'Lg', sign: chart.firstHouseSign }, ...chart.planets.map((p) => ({ id: p.id as TajikaBody, sign: p.sign }))];
  const out: TajikaAspect[] = [];
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const d = dist(bodies[i].sign, bodies[j].sign);
      const kind = tajikaAspectKind(d);
      if (kind) out.push({ a: bodies[i].id, b: bodies[j].id, kind, distance: d });
    }
  }
  return out;
}

function birthYear(chart: ChartData): number {
  return utcToWall(chart.meta.utcMs, chart.meta.tz).y;
}

/** The instant in `year` when the sidereal Sun returns to its natal longitude (the chart's ayanamsa). */
export function solarReturnInstant(chart: ChartData, year: number): number {
  const sun = chart.planets.find((p) => p.id === 'Su');
  if (!sun) throw new Error('Chart has no Sun');
  const by = birthYear(chart);
  const age = year - by;
  if (age < 0) throw new Error(`Solar return year ${year} is before the birth year ${by}`);
  if (age === 0) return chart.meta.utcMs;
  const ay: AyanamsaType = chart.meta.ayanamsa;
  const approx = chart.meta.utcMs + age * 365.2422 * DAY_MS;
  const f = (ms: number): number => siderealSun(ms, ay);
  return nextCrossing(f, sun.longitude, approx - 6 * DAY_MS, 5 * DAY_MS, 12);
}

function signIntervals(planet: PlanetId, lon: (ms: number) => number, fromMs: number, toMs: number, stepMs: number): TransitInterval[] {
  const out: TransitInterval[] = [];
  let a = fromMs;
  let sa = Math.floor(lon(a) / 30);
  let start = fromMs;
  let retro = false;
  while (a < toMs) {
    const b = Math.min(a + stepMs, toMs);
    const sb = Math.floor(lon(b) / 30);
    if (sb !== sa) {
      const forward = (sb - sa + 12) % 12 === 1;
      const boundary = (forward ? sb : sa) * 30;
      let lo = a;
      let hi = b;
      const g = (ms: number): number => wrap180(lon(ms) - boundary) * (forward ? 1 : -1);
      for (let i = 0; i < 40 && hi - lo > 30_000; i++) {
        const mid = (lo + hi) / 2;
        if (g(mid) < 0) lo = mid;
        else hi = mid;
      }
      const at = Math.round((lo + hi) / 2);
      out.push({ planet, sign: sa + 1, from: start, to: at, retrogradeEntry: retro });
      start = at;
      retro = !forward;
      sa = sb;
    }
    a = b;
  }
  out.push({ planet, sign: sa + 1, from: start, to: toMs, retrogradeEntry: retro });
  return out;
}

function transitCalendar(chart: ChartData, fromMs: number, toMs: number): TransitInterval[] {
  const ay = chart.meta.ayanamsa;
  const opts = { ayanamsa: ay, node: chart.meta.node };
  const out: TransitInterval[] = [];
  const body = (b: Body) => (ms: number): number => norm360(Ecliptic(GeoVector(b, new Date(ms), true)).elon - ayanamsaAt(ms, ay));
  out.push(...signIntervals('Su', body(Body.Sun), fromMs, toMs, 5 * DAY_MS));
  out.push(...signIntervals('Ma', body(Body.Mars), fromMs, toMs, 2 * DAY_MS));
  const slow: [PlanetId, IngressPlanet][] = [['Ju', 'Jupiter'], ['Sa', 'Saturn'], ['Ra', 'Rahu'], ['Ke', 'Ketu']];
  for (const [id, name] of slow) {
    const events = ingressDates(name, fromMs, toMs, opts);
    let start = fromMs;
    let sign = Math.floor(siderealLongitude(name, fromMs, opts) / 30) + 1;
    let retro = false;
    for (const e of events) {
      out.push({ planet: id, sign, from: start, to: e.at, retrogradeEntry: retro });
      start = e.at;
      sign = e.toSign;
      retro = e.retrograde;
    }
    out.push({ planet: id, sign, from: start, to: toMs, retrogradeEntry: retro });
  }
  return out;
}

/** Mudda dasha: the year divided in Vimshottari proportion, starting from the natal Moon's nakshatra lord. */
export function muddaDasha(natalMoonNakshatra: number, fromMs: number, toMs: number): MuddaPeriod[] {
  const startLord = NAKSHATRA_LORDS[natalMoonNakshatra - 1];
  const startIdx = VIMSHOTTARI_ORDER.indexOf(startLord);
  const length = toMs - fromMs;
  const out: MuddaPeriod[] = [];
  let t = fromMs;
  for (let i = 0; i < 9; i++) {
    const lord = VIMSHOTTARI_ORDER[(startIdx + i) % 9];
    const share = VIMSHOTTARI_YEARS[lord] / 120;
    const end = i === 8 ? toMs : Math.round(fromMs + length * (out.reduce((s, p) => s + p.share, 0) + share));
    out.push({ lord, start: t, end, share });
    t = end;
  }
  return out;
}

export interface VarshaphalOptions {
  /** Place of the annual chart (default: the birthplace). */
  place?: ChartPlace;
  /** Zone of the annual chart (default: the natal zone). */
  tz?: string;
}

/** The Varshaphal of a Gregorian year for a natal chart. */
export function varshaphal(chart: ChartData, year: number, opts: VarshaphalOptions = {}): VarshaphalReport {
  const instant = solarReturnInstant(chart, year);
  const nextInstant = solarReturnInstant(chart, year + 1);
  const age = year - birthYear(chart);
  const place: ChartPlace = opts.place ?? { lat: chart.meta.lat, lon: chart.meta.lon, elevation: chart.meta.elevation };
  const tz = resolveZone(opts.tz ?? chart.meta.tz);
  const annual = computeChartAt(instant, place, tz, { ayanamsa: chart.meta.ayanamsa, node: chart.meta.node });
  const geo: GeoPoint = { lat: place.lat, lon: place.lon, elevation: place.elevation };

  // Day or night return (vara-independent): between sunrise and sunset of the civil date at the place.
  const date = localDateOf(instant, tz);
  const frame = dayFrame(date, tz, geo);
  const dayReturn = frame ? instant >= frame.sunrise && instant < frame.sunset : true;

  const natalMoon = chart.planets.find((p) => p.id === 'Mo');
  if (!natalMoon) throw new Error('Chart has no Moon');
  const munthaBase: 'lagna' | 'moon' = chart.lagna && !chart.moonChart ? 'lagna' : 'moon';
  const baseSign = munthaBase === 'lagna' ? (chart.lagna as { sign: number }).sign : natalMoon.sign;
  const munthaSign = ((baseSign - 1 + age) % 12) + 1;
  const muntha = { sign: munthaSign, house: houseFromSign(munthaSign, annual.firstHouseSign), lord: SIGN_LORDS[munthaSign - 1], base: munthaBase, ruleId: 'varshaphal-muntha' as const };

  const sunSign = (annual.planets.find((p) => p.id === 'Su') as { sign: number }).sign;
  const moonSign = (annual.planets.find((p) => p.id === 'Mo') as { sign: number }).sign;
  const roles: [YearLordRole, PlanetId][] = [
    ['muntha-lord', muntha.lord],
    ['janma-lagna-lord', SIGN_LORDS[chart.firstHouseSign - 1]],
    ['varsha-lagna-lord', SIGN_LORDS[annual.firstHouseSign - 1]],
    ['tri-rashi-lord', TRI_RASHI_LORDS[annual.firstHouseSign - 1][dayReturn ? 0 : 1]],
    ['dina-ratri-lord', SIGN_LORDS[(dayReturn ? sunSign : moonSign) - 1]],
  ];
  const balas = {} as Record<PlanetId, PanchavargiyaBala | null>;
  for (const id of PLANET_IDS) balas[id] = panchavargiyaBala(annual, id);
  const candidates: YearLordCandidate[] = roles.map(([role, planet]) => {
    const p = annual.planets.find((x) => x.id === planet) as { sign: number };
    const d = dist(p.sign, annual.firstHouseSign);
    const kind = tajikaAspectKind(d);
    return { role, planet, bala: balas[planet]?.total ?? 0, aspectsLagna: kind !== null, aspectKind: kind };
  });
  // Highest bala wins; an exact tie goes to the dina/ratri lord (Raman's tie-breaker), then to the candidate order.
  const pick = (list: YearLordCandidate[]): YearLordCandidate =>
    list.reduce((best, c) => (c.bala > best.bala || (c.bala === best.bala && c.role === 'dina-ratri-lord' && best.role !== 'dina-ratri-lord') ? c : best), list[0]);
  const friendly = candidates.filter((c) => c.aspectKind === 'friendly-3-11' || c.aspectKind === 'secret-friendly-5-9');
  const aspecting = candidates.filter((c) => c.aspectsLagna);
  const chosen = friendly.length ? pick(friendly) : aspecting.length ? pick(aspecting) : pick(candidates);
  const yearLord = {
    planet: chosen.planet,
    role: chosen.role,
    candidates,
    method: (aspecting.length ? 'tajika-panchadhikari' : 'tajika-panchadhikari-no-aspect-fallback') as VarshaphalReport['yearLord']['method'],
    ruleId: 'varshaphal-year-lord' as const,
  };

  return {
    year,
    age,
    instant,
    tz,
    place,
    nextInstant,
    chart: annual,
    dayReturn,
    muntha,
    yearLord,
    balas,
    tajikaAspects: tajikaAspects(annual),
    muddaDasha: muddaDasha(natalMoon.nakshatra, instant, nextInstant),
    transitCalendar: transitCalendar(chart, instant, nextInstant),
    computedWith: [...VARSHAPHAL_RULE_IDS],
    approx: chart.moonChart || Boolean(chart.approx.lagna),
    ruleIds: VARSHAPHAL_RULE_IDS,
  };
}
