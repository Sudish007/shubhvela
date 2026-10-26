// Divisional charts (spec F12, design 4 / 10.3 F12, plan B01). The sign mapping of every varga comes from the
// vendored fork's `kundli/vargas.ts` (BPHS rules, checked in B01 and recorded in reference/CONVENTIONS.md and the
// rules corpus); `varga()` itself lives in ../kundli so D9 is available to the free tier from A02 onward.
// This module adds the F12 list of the 15 divisional charts the product shows (the fork also knows D5, D6, D8 and
// D11, which stay reachable through VARGA_IDS but are not part of F12), the per-varga metadata the chart card and
// the "How this was computed" footer need, and `allVargas()` for the report model.
//
// Conventions (binding, verified against BPHS chapter 6 "Divisional charts"):
// - D2 Hora (Parashara): odd signs 0-15 deg = Sun's hora (Simha), 15-30 deg = Moon's hora (Karka); even signs the
//   reverse. The Kashinatha hora (hora signs counted from the sign itself) is NOT used.
// - D3 Drekkana (Parashara): 0-10 deg the sign itself, 10-20 the 5th sign, 20-30 the 9th sign.
// - D4: 0-7.5 the sign, then the 4th, 7th and 10th signs.  D7: odd signs from the sign itself, even from the 7th.
// - D9: 108 equal parts from Mesha.  D10: odd from the sign, even from the 9th.  D12: twelve parts from the sign.
// - D16: movable from Mesha, fixed from Simha, dual from Dhanu.  D20: movable Mesha, fixed Dhanu, dual Simha.
// - D24: odd from Simha, even from Karka.  D27: fiery from Mesha, earthy Karka, airy Tula, watery Makara.
// - D30 Trimsamsa (BPHS): odd signs Mars 0-5 (Mesha), Saturn 5-10 (Kumbha), Jupiter 10-18 (Dhanu), Mercury 18-25
//   (Mithuna), Venus 25-30 (Tula); even signs Venus 0-5 (Vrishabha), Mercury 5-12 (Kanya), Jupiter 12-20 (Meena),
//   Saturn 20-25 (Makara), Mars 25-30 (Vrishchika). The planet owning the part gives the sign shown in the chart.
// - D40: odd from Mesha, even from Tula.  D45: movable Mesha, fixed Simha, dual Dhanu.  D60: sixty parts from the
//   sign itself (the Shashtyamsa deity names are not used in v1).
// - The degree printed inside a varga sign is (degree in the D1 sign x N) mod 30; dignity tags are recomputed for the
//   varga sign, vargottama is shown only in D1 and D9 (where it is defined).
import { type ChartData, type VargaId, varga, VARGA_IDS } from '../kundli/index';

/** The 15 divisional charts of spec F12 in display order (D9 is free; the other 14 sit behind the `vargas` key). */
export const DIVISIONAL_CHART_IDS = ['D2', 'D3', 'D4', 'D7', 'D9', 'D10', 'D12', 'D16', 'D20', 'D24', 'D27', 'D30', 'D40', 'D45', 'D60'] as const;
export type DivisionalChartId = (typeof DIVISIONAL_CHART_IDS)[number];

/** The 14 charts that are Pro / rewarded-unlock (`vargas` key): every F12 chart except D9 (design 5, spec 9). */
export const LOCKED_VARGA_IDS: readonly DivisionalChartId[] = DIVISIONAL_CHART_IDS.filter((id) => id !== 'D9');

export interface VargaInfo {
  id: DivisionalChartId;
  /** Number of equal parts each sign is divided into (the D-number). */
  divisor: number;
  /** Sanskrit name in Latin letters (glossary headword). */
  name: string;
  /** Rule id of the convention line in the rules corpus (`varga-d2` ...). */
  ruleId: string;
  /** Classical area of life the chart is read for (glossary / lesson key, never a prediction). */
  domainKey: string;
  /** True when the sign mapping depends on odd/even or movable/fixed/dual classes (listed under "How this was computed"). */
  classBased: boolean;
  free: boolean;
}

const INFO: Record<DivisionalChartId, Omit<VargaInfo, 'id' | 'ruleId' | 'free'>> = {
  D2: { divisor: 2, name: 'Hora', domainKey: 'varga-domain-wealth', classBased: true },
  D3: { divisor: 3, name: 'Drekkana', domainKey: 'varga-domain-siblings', classBased: false },
  D4: { divisor: 4, name: 'Chaturthamsa', domainKey: 'varga-domain-property', classBased: false },
  D7: { divisor: 7, name: 'Saptamsa', domainKey: 'varga-domain-children', classBased: true },
  D9: { divisor: 9, name: 'Navamsa', domainKey: 'varga-domain-partner', classBased: false },
  D10: { divisor: 10, name: 'Dasamsa', domainKey: 'varga-domain-work', classBased: true },
  D12: { divisor: 12, name: 'Dwadasamsa', domainKey: 'varga-domain-parents', classBased: false },
  D16: { divisor: 16, name: 'Shodasamsa', domainKey: 'varga-domain-vehicles', classBased: true },
  D20: { divisor: 20, name: 'Vimsamsa', domainKey: 'varga-domain-practice', classBased: true },
  D24: { divisor: 24, name: 'Chaturvimsamsa', domainKey: 'varga-domain-learning', classBased: true },
  D27: { divisor: 27, name: 'Saptavimsamsa', domainKey: 'varga-domain-strength', classBased: true },
  D30: { divisor: 30, name: 'Trimsamsa', domainKey: 'varga-domain-obstacles', classBased: true },
  D40: { divisor: 40, name: 'Khavedamsa', domainKey: 'varga-domain-maternal', classBased: true },
  D45: { divisor: 45, name: 'Akshavedamsa', domainKey: 'varga-domain-character', classBased: true },
  D60: { divisor: 60, name: 'Shashtyamsa', domainKey: 'varga-domain-karma', classBased: false },
};

/** `varga-d2` ... `varga-d60`: one rule line per divisional chart (RULE_IDS). */
export const VARGA_RULE_IDS: readonly string[] = DIVISIONAL_CHART_IDS.map((id) => `varga-${id.toLowerCase()}`);

export function isDivisionalChartId(id: string): id is DivisionalChartId {
  return (DIVISIONAL_CHART_IDS as readonly string[]).includes(id);
}

/** Metadata of one of the 15 F12 charts. */
export function vargaInfo(id: DivisionalChartId): VargaInfo {
  const info = INFO[id];
  if (!info) throw new Error(`Not an F12 divisional chart: ${id}`);
  return { id, ...info, ruleId: `varga-${id.toLowerCase()}`, free: id === 'D9' };
}

/** All 15 divisional charts of a D1 chart, keyed by id (report model, "14 more vargas" sheet). */
export function allVargas(chart: ChartData): Record<DivisionalChartId, ChartData> {
  const out = {} as Record<DivisionalChartId, ChartData>;
  for (const id of DIVISIONAL_CHART_IDS) out[id] = varga(chart, id);
  return out;
}

/** The divisor (N of D-N) of any varga the fork supports. */
export function vargaDivisor(id: VargaId): number {
  if (!(VARGA_IDS as readonly string[]).includes(id)) throw new Error(`Unknown varga: ${id}`);
  return Number(id.slice(1));
}
