// Every rule id the engine can hand to the UI for a "Why?" sheet (design.md 6: rule sentence + inputs + classical
// source). The content package's rules corpus (packages/content/corpus/rules/<lang>.json) must have one entry per id;
// packages/content/test/rules.test.ts asserts it. Ids are the literal strings emitted by goodHours(), dailyNote(),
// familyToday(), computeChart() tags, the calendar module (vrat-*, festival-*, janma-tithi, barsi, pitru-paksha,
// dasha-change, transit-*) and the dignity/approx honesty markers. Fragment keys of the daily note that carry their
// own rule (chandra-bala-<house>, tara-bala-<n>, sade-sati-phase-<n>, dhaiya-<house>) are listed too so the sheet
// can show the specific rule of the row, not only the family rule.
import { VRAT_FAMILIES } from '../calendar/vrats';
import { FESTIVAL_RULES } from '../calendar/festivals';

const range = (from: number, to: number): number[] => Array.from({ length: to - from + 1 }, (_, i) => from + i);

/** Good-hours segments (goodHours segment.ruleId) and the day flags of the Today band. */
export const GOOD_HOURS_RULE_IDS = [
  'rahu-kaal',
  'yamaganda',
  'gulika',
  'abhijit',
  'brahma-muhurat',
  'choghadiya-amrit',
  'choghadiya-shubh',
  'choghadiya-labh',
  'choghadiya-chal',
  'choghadiya-rog',
  'choghadiya-kaal',
  'choghadiya-udveg',
  'hora',
  'bhadra',
  'panchak',
  'disha-shool',
] as const;

/** Daily note rows (DailyRule.ruleId) plus the per-key rules of the Chandra bala, Tara bala and Sade Sati rows. */
export const DAILY_RULE_IDS: readonly string[] = [
  'chandra-bala',
  ...range(1, 12).map((h) => `chandra-bala-${h}`),
  'chandrashtama',
  'tara-bala',
  ...range(1, 9).map((n) => `tara-bala-${n}`),
  'day-tithi-nakshatra',
  'sade-sati',
  'sade-sati-phase-1',
  'sade-sati-phase-2',
  'sade-sati-phase-3',
  'sade-sati-none',
  'dhaiya-4',
  'dhaiya-8',
  'dasha-lords',
  'family-today',
];

/** Chart honesty tags (ChartPlanet.tags, approx flags) and the chart-level conventions listed under "How this was computed". */
export const CHART_RULE_IDS = [
  'dignity-exalted',
  'dignity-debilitated',
  'dignity-own',
  'dignity-friend',
  'dignity-enemy',
  'dignity-neutral',
  'dignity-combust',
  'dignity-retro',
  'dignity-vargottama',
  'vargottama',
  'combustion-orbs',
  'approx-birth-time',
  'approx-sign-boundary',
  'moon-chart',
  'lagna',
  'house-lord',
  'dasha-vimshottari',
  'dasha-change',
] as const;

/** Calendar rules (tithi recurrence, ancestors, upcoming transits). */
export const CALENDAR_RULE_IDS = [
  'janma-tithi',
  'barsi',
  'pitru-paksha',
  'tithi-recurrence-adhik',
  'tithi-recurrence-kshaya',
  'transit-saturn',
  'transit-jupiter',
  'transit-rahu',
] as const;

/** vrat-<family> for the 12 vrat families (VratOccurrence.ruleId). */
export const VRAT_RULE_IDS: readonly string[] = VRAT_FAMILIES.map((f) => `vrat-${f}`);

/** festival-<slug> for every row of data/festival-rules.json (FestivalOccurrence.ruleId). */
export const FESTIVAL_RULE_IDS: readonly string[] = FESTIVAL_RULES.map((r) => `festival-${r.slug}`);

/** The union, in a stable order; the content tests iterate this list. */
export const RULE_IDS: readonly string[] = [
  ...GOOD_HOURS_RULE_IDS,
  ...DAILY_RULE_IDS,
  ...CHART_RULE_IDS,
  ...CALENDAR_RULE_IDS,
  ...VRAT_RULE_IDS,
  ...FESTIVAL_RULE_IDS,
];
