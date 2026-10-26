// Naamkaran helper (spec F28, design 10.5 F28, plan B01): the starting syllable of a name from the Moon's nakshatra
// pada (data/naamkaran-syllables.json, the classical avakahada nama-akshara table). No meanings are claimed beyond
// the syllable rule; the name lists per syllable belong to the content package (corpus/naamkaran-names, B02).
import tableJson from '../../data/naamkaran-syllables.json';
import { type ChartData } from '../kundli/index';

export interface NaamkaranSyllable {
  devanagari: string;
  latin: string;
}

export interface NaamkaranResult {
  /** 1-27. */
  nakshatra: number;
  /** 1-4. */
  pada: number;
  /** The pada's starting syllable. */
  syllable: NaamkaranSyllable;
  /** All four syllables of the nakshatra (the card lists the pada's syllable first, then the siblings). */
  nakshatraSyllables: NaamkaranSyllable[];
  ruleId: 'naamkaran-syllable';
}

interface TableFile {
  version: number;
  nakshatras: { n: number; syllables: [string, string][] }[];
}

const TABLE = tableJson as unknown as TableFile;

export const NAAMKARAN_RULE_ID = 'naamkaran-syllable' as const;

/** Starting syllable for a Moon nakshatra (1-27) and pada (1-4). */
export function syllables(nakshatra: number, pada: number): NaamkaranResult {
  const row = TABLE.nakshatras.find((r) => r.n === nakshatra);
  if (!row) throw new Error(`Nakshatra out of range: ${nakshatra}`);
  if (!Number.isInteger(pada) || pada < 1 || pada > 4) throw new Error(`Pada out of range: ${pada}`);
  const all = row.syllables.map(([devanagari, latin]) => ({ devanagari, latin }));
  return { nakshatra, pada, syllable: all[pada - 1], nakshatraSyllables: all, ruleId: NAAMKARAN_RULE_ID };
}

/** Starting syllable from a chart's Moon. */
export function syllablesForChart(chart: ChartData): NaamkaranResult {
  const moon = chart.planets.find((p) => p.id === 'Mo');
  if (!moon) throw new Error('Chart has no Moon');
  return syllables(moon.nakshatra, moon.pada);
}

/** Every syllable of the table (108 entries, nakshatra-major) for the content completeness test. */
export function allSyllables(): { nakshatra: number; pada: number; syllable: NaamkaranSyllable }[] {
  return TABLE.nakshatras.flatMap((r) => r.syllables.map(([devanagari, latin], i) => ({ nakshatra: r.n, pada: i + 1, syllable: { devanagari, latin } })));
}
