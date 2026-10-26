// Ashtakavarga (spec F15, design 10.3 F15 "BAV grid 8x12 and SAV row with house strength bars", plan B01).
// The bindu tables are the fork's BPHS CONTRIBUTIONS (vendor/jyotish/src/ashtakavarga/constants.ts); this module
// feeds them the ChartData signs, returns the grids in house order from the chart's first house and classifies
// each house's Sarvashtakavarga total. Pure data; the UI draws the grid.
//
// Conventions:
// - Reference points: the seven planets Sun..Saturn and the Lagna. In Moon-chart mode (unknown birth time) the Moon
//   sign stands in for the Lagna and `lagnaAssumed` says so (the UI shows the approx. marker).
// - Totals are fixed by the tables: Sun 48, Moon 49, Mars 39, Mercury 54, Jupiter 56, Venus 52, Saturn 39 = 337.
// - House strength from the SAV bindus: >= 28 strong (above the 337/12 = 28.08 average), 25-27 average, < 25 weak
//   (the usual reading of BPHS 66; the thresholds are listed under "How this was computed").
import { calculateAllBAV } from '../../vendor/jyotish/src/ashtakavarga/bav';
import { PLANET_TOTALS, TOTAL_BINDUS, type AshtakavargaPlanet, type ReferencePoint } from '../../vendor/jyotish/src/ashtakavarga/constants';
import { type ChartData } from '../kundli/index';
import { PLANET_KEYS, type PlanetId } from '../locale/index';

export type AshtakavargaPlanetId = 'Su' | 'Mo' | 'Ma' | 'Me' | 'Ju' | 'Ve' | 'Sa';
export const ASHTAKAVARGA_PLANETS: readonly AshtakavargaPlanetId[] = ['Su', 'Mo', 'Ma', 'Me', 'Ju', 'Ve', 'Sa'];
export type HouseStrengthClass = 'strong' | 'average' | 'weak';

export interface BavGrid {
  planet: AshtakavargaPlanetId;
  /** Bindus per house from the chart's first house (index 0 = house 1). */
  byHouse: number[];
  /** Bindus per sign (index 0 = Mesha). */
  bySign: number[];
  /** Fixed table total (48, 49, 39, 54, 56, 52, 39). */
  total: number;
  /** Which reference point gave a bindu to each sign (row = reference point, 12 flags), for the 8x12 grid. */
  contributions: Record<ReferencePoint, number[]>;
}

export interface SavHouse {
  house: number;
  /** 1-12. */
  sign: number;
  bindus: number;
  strength: HouseStrengthClass;
  ruleId: 'ashtakavarga-house-strength';
}

export interface AshtakavargaReport {
  bav: Record<AshtakavargaPlanetId, BavGrid>;
  /** Sarvashtakavarga bindus per house from the first house (index 0 = house 1). */
  sav: number[];
  savBySign: number[];
  houseStrength: SavHouse[];
  /** Always 337. */
  total: number;
  /** First-house sign the grids are counted from. */
  firstHouseSign: number;
  /** 'lagna' normally; 'moon' when the birth time is unknown and the Moon sign stands in for the Lagna. */
  lagnaAssumed: 'lagna' | 'moon';
  thresholds: { strong: number; weak: number };
  ruleIds: readonly string[];
}

export const ASHTAKAVARGA_RULE_IDS = ['ashtakavarga-bav', 'ashtakavarga-sav', 'ashtakavarga-house-strength'] as const;
export const SAV_STRONG_MIN = 28;
export const SAV_WEAK_MAX = 24;

export function savStrength(bindus: number): HouseStrengthClass {
  if (bindus >= SAV_STRONG_MIN) return 'strong';
  if (bindus <= SAV_WEAK_MAX) return 'weak';
  return 'average';
}

function signOf(chart: ChartData, id: PlanetId): number {
  const p = chart.planets.find((x) => x.id === id);
  if (!p) throw new Error(`Chart has no ${id}`);
  return p.sign - 1;
}

/** BAV for the seven planets and the SAV with house strength, counted from the chart's first house. */
export function ashtakavarga(chart: ChartData): AshtakavargaReport {
  const lagnaRashi = chart.firstHouseSign - 1;
  const positions: Record<ReferencePoint, number> = {
    Sun: signOf(chart, 'Su'),
    Moon: signOf(chart, 'Mo'),
    Mars: signOf(chart, 'Ma'),
    Mercury: signOf(chart, 'Me'),
    Jupiter: signOf(chart, 'Ju'),
    Venus: signOf(chart, 'Ve'),
    Saturn: signOf(chart, 'Sa'),
    Ascendant: lagnaRashi,
  };
  const raw = calculateAllBAV(positions, lagnaRashi);
  const bav = {} as Record<AshtakavargaPlanetId, BavGrid>;
  const savBySign = new Array<number>(12).fill(0);
  for (const id of ASHTAKAVARGA_PLANETS) {
    const key = PLANET_KEYS[id] as AshtakavargaPlanet;
    const r = raw[key];
    for (let s = 0; s < 12; s++) savBySign[s] += r.byRashi[s];
    bav[id] = { planet: id, byHouse: [...r.byHouse], bySign: [...r.byRashi], total: PLANET_TOTALS[key], contributions: r.contributionsByRef };
    if (r.totalBindus !== PLANET_TOTALS[key]) throw new Error(`BAV total for ${id} is ${r.totalBindus}, table says ${PLANET_TOTALS[key]}`);
  }
  const sav = Array.from({ length: 12 }, (_, h) => savBySign[(lagnaRashi + h) % 12]);
  const houseStrength: SavHouse[] = sav.map((bindus, i) => ({
    house: i + 1,
    sign: ((lagnaRashi + i) % 12) + 1,
    bindus,
    strength: savStrength(bindus),
    ruleId: 'ashtakavarga-house-strength',
  }));
  return {
    bav,
    sav,
    savBySign,
    houseStrength,
    total: TOTAL_BINDUS,
    firstHouseSign: chart.firstHouseSign,
    lagnaAssumed: chart.moonChart ? 'moon' : 'lagna',
    thresholds: { strong: SAV_STRONG_MIN, weak: SAV_WEAK_MAX },
    ruleIds: ASHTAKAVARGA_RULE_IDS,
  };
}
