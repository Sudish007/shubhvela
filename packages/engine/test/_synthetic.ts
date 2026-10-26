// Constructed ChartData for rule tests (yogas, matching): planets placed mid-sign by sign number, whole-sign houses
// from a given Lagna sign, dignity tags from the real signDignity(); nothing here is a real birth.
import { type ChartData, type ChartPlanet, type DignityTag, signDignity } from '../src/kundli/index';
import { PLANET_IDS, type PlanetId, SIGN_LORDS } from '../src/locale/index';

export interface SyntheticOptions {
  lagnaSign?: number;
  /** Degree inside the sign for every planet (default 15). */
  degree?: number;
  combust?: PlanetId[];
  retro?: PlanetId[];
  timeUnknown?: boolean;
}

export function syntheticChart(signs: Record<PlanetId, number>, opts: SyntheticOptions = {}): ChartData {
  const lagnaSign = opts.lagnaSign ?? 1;
  const deg = opts.degree ?? 15;
  const first = opts.timeUnknown ? signs.Mo : lagnaSign;
  const planets: ChartPlanet[] = PLANET_IDS.map((id) => {
    const sign = signs[id];
    const lon = (sign - 1) * 30 + deg;
    const tags: DignityTag[] = [];
    const d = signDignity(id, sign);
    if (d) tags.push(d);
    const combust = opts.combust?.includes(id) ?? false;
    const retrograde = opts.retro?.includes(id) ?? false;
    if (combust) tags.push('combust');
    if (retrograde) tags.push('retro');
    return {
      id,
      longitude: lon,
      sign,
      degree: Math.floor(deg),
      minute: 0,
      second: 0,
      nakshatra: Math.floor(lon / (360 / 27)) + 1,
      pada: (Math.floor(lon / (360 / 108)) % 4) + 1,
      approx: false,
      house: ((sign - first + 12) % 12) + 1,
      tags,
      speed: retrograde ? -0.1 : 1,
      retrograde,
      combust,
      vargottama: false,
    };
  });
  const houses = Array.from({ length: 12 }, (_, i) => {
    const sign = ((first - 1 + i) % 12) + 1;
    return { n: i + 1, sign, lord: SIGN_LORDS[sign - 1], occupants: planets.filter((p) => p.house === i + 1).map((p) => p.id) };
  });
  const lagnaLon = (lagnaSign - 1) * 30 + deg;
  return {
    variant: 'lagna',
    lagna: opts.timeUnknown ? undefined : { longitude: lagnaLon, sign: lagnaSign, degree: deg, minute: 0, second: 0, nakshatra: Math.floor(lagnaLon / (360 / 27)) + 1, pada: 1, approx: false },
    firstHouseSign: first,
    planets,
    houses,
    moonChart: Boolean(opts.timeUnknown),
    approx: { lagna: false },
    meta: {
      ayanamsa: 'lahiri',
      ayanamsaDegrees: 24,
      node: 'mean',
      nodeMethod: 'mean node (Meeus)',
      ephemeris: 'astronomy-engine 2.1.19',
      tz: 'Asia/Kolkata',
      utcMs: Date.UTC(2000, 0, 1, 6, 30),
      offsetMinutes: 330,
      clockGap: false,
      overlap: false,
      lat: 28.6139,
      lon: 77.209,
      elevation: 0,
      houseSystem: 'whole_sign',
      timeUnknown: Boolean(opts.timeUnknown),
      approxMinutes: opts.timeUnknown ? 720 : 0,
      combustionOrbs: {},
      computedAt: '2026-10-27T00:00:00.000Z',
    },
  };
}

/** Sign numbers (1-12) with every planet in its own sign unless overridden. */
export function signsWith(overrides: Partial<Record<PlanetId, number>>): Record<PlanetId, number> {
  const base: Record<PlanetId, number> = { Su: 5, Mo: 4, Ma: 1, Me: 3, Ju: 9, Ve: 2, Sa: 10, Ra: 11, Ke: 5 };
  return { ...base, ...overrides };
}
