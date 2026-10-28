// Every rule id the engine can hand to the UI for a "Why?" sheet (design.md 6: rule sentence + inputs + classical
// source). The content package's rules corpus (packages/content/corpus/rules/<lang>.json) must have one entry per id;
// packages/content/test/rules.test.ts asserts it. Ids are the literal strings emitted by goodHours(), dailyNote(),
// familyToday(), computeChart() tags, the calendar module (vrat-*, festival-*, janma-tithi, barsi, pitru-paksha,
// dasha-change, transit-*) and the dignity/approx honesty markers. Fragment keys of the daily note that carry their
// own rule (chandra-bala-<house>, tara-bala-<n>, sade-sati-phase-<n>, dhaiya-<house>) are listed too so the sheet
// can show the specific rule of the row, not only the family rule.
import { VRAT_FAMILIES } from '../calendar/vrats';
import { FESTIVAL_RULES } from '../calendar/festivals';
import { VARGA_RULE_IDS } from '../vargas/index';
import { ASHTAKAVARGA_RULE_IDS } from '../ashtakavarga/index';
import { KP_RULE_IDS } from '../kp/index';
import { YOGA_RULE_IDS } from '../yogas/index';
import { VARSHAPHAL_RULE_IDS } from '../varshaphal/index';
import { MUHURAT_ACTIVITY_RULE_IDS, MUHURAT_RULE_IDS } from '../muhurat/index';
import { NAAMKARAN_RULE_ID } from '../naamkaran/index';
import { BEYOND_RULE_IDS, KOOTA_EXCEPTION_IDS, KOOTA_RULE_IDS, MANGAL_RULE_IDS } from '../matching/index';
import { REPORT_RULE_IDS } from '../report/index';

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

// ---------------------------------------------------------------- Phase B (B01 engine B; corpus entries by B02)

/** Divisional charts F12: `varga-d2` ... `varga-d60` (15). */
export const PHASE_B_VARGA_RULE_IDS: readonly string[] = VARGA_RULE_IDS;
/** Ashtakavarga F15 (3) and KP F15/F19 (4). */
export const PHASE_B_ASHTAKAVARGA_KP_RULE_IDS: readonly string[] = [...ASHTAKAVARGA_RULE_IDS, ...KP_RULE_IDS];
/** Yogas F16: `yoga-<id>` (31) plus the bhanga rule ids (7). */
export const PHASE_B_YOGA_RULE_IDS: readonly string[] = YOGA_RULE_IDS;
/** Varshaphal F17 (7). */
export const PHASE_B_VARSHAPHAL_RULE_IDS: readonly string[] = VARSHAPHAL_RULE_IDS;
/** Muhurat F26: the ten rule chips (`muhurat-rule-<rule>`) and the 14 activity tables (`muhurat-<activity>`, also the saved-muhurat rule id of the Upcoming strip). */
export const PHASE_B_MUHURAT_RULE_IDS: readonly string[] = [...MUHURAT_RULE_IDS, ...MUHURAT_ACTIVITY_RULE_IDS];
/** Naamkaran F28 (1). */
export const PHASE_B_NAAMKARAN_RULE_IDS: readonly string[] = [NAAMKARAN_RULE_ID];
/** Matching F29: 8 kootas, 2 exceptions, Mangal dosha + 6 cancellation rows, 4 beyond-gun-milan rows. */
export const PHASE_B_MATCHING_RULE_IDS: readonly string[] = [...KOOTA_RULE_IDS, ...KOOTA_EXCEPTION_IDS, ...MANGAL_RULE_IDS, ...BEYOND_RULE_IDS];
/** Report models F31 (3). */
export const PHASE_B_REPORT_RULE_IDS: readonly string[] = REPORT_RULE_IDS;

/** Every Phase B rule id in a stable order (B02 writes one rules-corpus sentence per id). */
export const PHASE_B_RULE_IDS: readonly string[] = [
  ...PHASE_B_VARGA_RULE_IDS,
  ...PHASE_B_ASHTAKAVARGA_KP_RULE_IDS,
  ...PHASE_B_YOGA_RULE_IDS,
  ...PHASE_B_VARSHAPHAL_RULE_IDS,
  ...PHASE_B_MUHURAT_RULE_IDS,
  ...PHASE_B_NAAMKARAN_RULE_IDS,
  ...PHASE_B_MATCHING_RULE_IDS,
  ...PHASE_B_REPORT_RULE_IDS,
];

/**
 * Inputs (param names) the Why? sheet of each Phase B rule id lists, in emission order — the counterpart of
 * RULE_PARAMS (rules/daily.ts) for the B01 modules. Values are raw engine data: 1-based sign / nakshatra / house
 * numbers, planet ids, UTC ms for instants, booleans for flags; the UI formats them. Ids not listed here (the
 * per-varga, per-activity and per-yoga ids) share the params of their family entry below.
 */
export const RULE_PARAMS_B: Record<string, readonly string[]> = {
  'varga-*': ['divisor', 'name', 'classBased', 'd1Sign', 'd1Degree', 'vargaSign'],
  'ashtakavarga-bav': ['planet', 'bySign', 'byHouse', 'total', 'firstHouseSign', 'lagnaAssumed'],
  'ashtakavarga-sav': ['sav', 'total', 'firstHouseSign', 'lagnaAssumed'],
  'ashtakavarga-house-strength': ['house', 'sign', 'bindus', 'strength', 'strongMin', 'weakMax'],
  'kp-cusps-placidus': ['n', 'longitude', 'sign', 'degree', 'minute', 'ayanamsa', 'ayanamsaDegrees', 'polar', 'timeUnknown'],
  'kp-sub-lord': ['longitude', 'signLord', 'starLord', 'subLord', 'subSubLord'],
  'kp-significators': ['house', 'A', 'B', 'C', 'D', 'agents'],
  'kp-ruling-planets': ['at', 'lagnaSubLord', 'lagnaStarLord', 'lagnaSignLord', 'moonSubLord', 'moonStarLord', 'moonSignLord', 'dayLord', 'list', 'agents'],
  'yoga-*': ['id', 'family', 'formed', 'cancelledBy', 'participants', 'houses', 'fromMoonChart'],
  'kemadruma-bhanga-kendra-from-moon': ['kendraFromMoon'],
  'kemadruma-bhanga-kendra-from-lagna': ['kendraFromLagna'],
  'kemadruma-bhanga-moon-conjunction': ['withMoon'],
  'gaja-kesari-bhanga-jupiter-weak': ['jupiterCombust', 'jupiterDignity'],
  'shakata-bhanga-jupiter-kendra': ['jupiterHouse'],
  'mahapurusha-bhanga-combust': ['house', 'sign', 'dignity'],
  'parivartana-dainya': ['exchanges', 'kinds'],
  'varshaphal-solar-return': ['year', 'age', 'instant', 'nextInstant', 'natalSunLongitude', 'ayanamsa', 'tz', 'lat', 'lon'],
  'varshaphal-muntha': ['sign', 'house', 'lord', 'base', 'age'],
  'varshaphal-year-lord': ['planet', 'role', 'candidates', 'method', 'dayReturn'],
  'varshaphal-panchavargiya-bala': ['planet', 'kshetra', 'uccha', 'hadda', 'drekkana', 'navamsa', 'total', 'rupas', 'grade'],
  'varshaphal-tajika-aspects': ['a', 'b', 'kind', 'distance'],
  'varshaphal-mudda-dasha': ['lord', 'start', 'end', 'share', 'natalMoonNakshatra'],
  'varshaphal-transit-calendar': ['planet', 'sign', 'from', 'to', 'retrogradeEntry'],
  'muhurat-rule-tithi': ['tithi', 'paksha', 'tithiEndsAt', 'allowed'],
  'muhurat-rule-nakshatra': ['nakshatra', 'nakshatraEndsAt', 'allowed'],
  'muhurat-rule-vara': ['vara', 'allowed'],
  'muhurat-rule-chandra-bala': ['houses', 'transitMoonSign', 'natalMoonSigns', 'favourable', 'reason'],
  'muhurat-rule-tara-bala': ['taras', 'dayNakshatra', 'natalNakshatras', 'favourable', 'reason'],
  'muhurat-rule-rahu-kaal': ['rahuKaalStart', 'rahuKaalEnd', 'clipped'],
  'muhurat-rule-bhadra': ['bhadraStart', 'bhadraEnd', 'location'],
  'muhurat-rule-panchak': ['panchakStart', 'panchakEnd'],
  'muhurat-rule-abhijit': ['abhijitStart', 'abhijitEnd'],
  'muhurat-rule-choghadiya': ['choghadiya', 'good'],
  'muhurat-*': ['activity', 'start', 'end', 'day', 'tithi', 'nakshatra', 'vara', 'choghadiya', 'met', 'of', 'partial', 'allowedTithis', 'allowedNakshatras', 'allowedVaras', 'nightAllowed', 'sources'],
  'naamkaran-syllable': ['nakshatra', 'pada', 'syllable', 'nakshatraSyllables'],
  'koota-varna': ['points', 'max', 'aVarna', 'bVarna'],
  'koota-vashya': ['points', 'max', 'aVashya', 'bVashya'],
  'koota-tara': ['points', 'max', 'countAtoB', 'countBtoA', 'taraAtoB', 'taraBtoA'],
  'koota-yoni': ['points', 'max', 'aYoni', 'bYoni'],
  'koota-grahaMaitri': ['points', 'max', 'aLord', 'bLord', 'aToB', 'bToA'],
  'koota-gana': ['points', 'max', 'aGana', 'bGana'],
  'koota-bhakoot': ['points', 'max', 'distance', 'dosha', 'exception'],
  'koota-nadi': ['points', 'max', 'aNadi', 'bNadi', 'dosha', 'exception'],
  'nadi-exception-same-rashi': ['aMoonSign', 'bMoonSign', 'aNakshatra', 'bNakshatra'],
  'nadi-exception-same-nakshatra-pada': ['aNakshatra', 'bNakshatra', 'aPada', 'bPada'],
  'bhakoot-exception-same-lord': ['aMoonSign', 'bMoonSign', 'lord'],
  'bhakoot-same-nakshatra-pada': ['aNakshatra', 'bNakshatra', 'aPada', 'bPada'],
  'mangal-dosha': ['present', 'effective', 'cancelled', 'references', 'marsSign', 'marsHouse', 'houses', 'lagnaUnknown'],
  'mangal-cancel-own-exalted': ['marsSign', 'dignity'],
  'mangal-cancel-sign-house': ['marsSign', 'marsHouse'],
  'mangal-cancel-jupiter-moon-conjunction': ['withJupiter', 'withMoon'],
  'mangal-cancel-jupiter-aspect': ['marsFromJupiter'],
  'mangal-cancel-debilitated-combust': ['debilitated', 'combust'],
  'mangal-cancel-both-manglik': ['aEffective', 'bEffective'],
  'beyond-seventh-lords': ['aSeventhLord', 'bSeventhLord', 'relation', 'reverse', 'aSeventhSign', 'bSeventhSign', 'tone'],
  'beyond-venus': ['aVenusSign', 'bVenusSign', 'distance', 'aDignity', 'bDignity', 'lordsRelation', 'tone'],
  'beyond-moon-sign-relation': ['aMoonSign', 'bMoonSign', 'distance', 'lordsRelation', 'tone'],
  'beyond-dasha-overlap': ['years', 'periods', 'friendlyDays', 'hostileDays', 'aMahaNow', 'bMahaNow', 'tone'],
  'avakahada-chakra': ['varna', 'vashya', 'yoni', 'gana', 'nadi', 'nakshatra', 'nakshatraCharan', 'nakshatraLord', 'rashi', 'lagna', 'tatva', 'nameSyllable'],
  'ghatak-chakra': ['moonSign', 'month', 'tithiGroup', 'tithis', 'vara', 'nakshatra', 'yoga', 'karana', 'chandra', 'lagna'],
  'how-computed': ['ayanamsa', 'node', 'ephemeris', 'timezone', 'houseSystem', 'rounding', 'conventions'],
  'disha-shool': ['vara', 'avoid', 'safe', 'panchak', 'panchakStart', 'panchakEnd', 'panchakAvoid', 'bhadraEarth', 'bhadraStart', 'bhadraEnd'],
};

/** Params of a Phase B rule id, resolving the per-family wildcards (`varga-d9` -> `varga-*`, `yoga-hamsa` -> `yoga-*`, `muhurat-marriage` -> `muhurat-*`). */
export function ruleParamsB(ruleId: string): readonly string[] | undefined {
  if (RULE_PARAMS_B[ruleId]) return RULE_PARAMS_B[ruleId];
  if (/^varga-d\d+$/.test(ruleId)) return RULE_PARAMS_B['varga-*'];
  if (/^yoga-/.test(ruleId)) return RULE_PARAMS_B['yoga-*'];
  if (/^muhurat-(?!rule-)/.test(ruleId)) return RULE_PARAMS_B['muhurat-*'];
  return undefined;
}

// ---------------------------------------------------------------- Phase C (C02 corpus; C04 Prashna + Ask my chart)

/** Prashna F18: the chart of the moment the question is asked, at the place of asking (C04 `app/app/charts/prashna`). */
export const PRASHNA_RULE_IDS = ['prashna-chart-of-the-moment', 'prashna-lagna-of-the-hour', 'prashna-question-private'] as const;

/**
 * Ask my chart F35 system rules (spec 3.7 / design 10.7). The prompt builder (C04 `app/src/ai/prompt.ts`) reads these
 * sentences from the rules corpus in the UI language and prepends them to the chart JSON and the corpus snippets, so the
 * rules the model is given are the same rules the Why? sheet can show; `ask-label` is the fixed line above every answer.
 */
export const ASK_RULE_IDS = [
  'ask-system-explain-from-chart',
  'ask-system-cite-rule',
  'ask-system-no-outcome-promises',
  'ask-system-no-medical-legal-financial',
  'ask-system-grounded-corpus',
  'ask-system-honest-limits',
  'ask-label',
] as const;

export const PHASE_C_RULE_IDS: readonly string[] = [...PRASHNA_RULE_IDS, ...ASK_RULE_IDS];

/** Why?-sheet inputs of the Phase C rule ids (counterpart of RULE_PARAMS_B). */
export const RULE_PARAMS_C: Record<string, readonly string[]> = {
  'prashna-chart-of-the-moment': ['askedAt', 'lat', 'lon', 'tz', 'lagnaSign', 'moonSign', 'moonNakshatra'],
  'prashna-lagna-of-the-hour': ['askedAt', 'lagnaSign', 'lagnaLord', 'lagnaDegree', 'hora'],
  'prashna-question-private': ['storedLocally', 'question'],
  'ask-system-explain-from-chart': ['chartJson', 'profileName'],
  'ask-system-cite-rule': ['ruleIds'],
  'ask-system-no-outcome-promises': ['forbidden'],
  'ask-system-no-medical-legal-financial': ['forbidden'],
  'ask-system-grounded-corpus': ['snippetIds', 'lang'],
  'ask-system-honest-limits': ['model', 'onDevice'],
  'ask-label': ['model'],
};

/** Params of a Phase C rule id. */
export function ruleParamsC(ruleId: string): readonly string[] | undefined {
  return RULE_PARAMS_C[ruleId];
}

/** The union, in a stable order; the content tests iterate this list. */
export const RULE_IDS: readonly string[] = [
  ...GOOD_HOURS_RULE_IDS,
  ...DAILY_RULE_IDS,
  ...CHART_RULE_IDS,
  ...CALENDAR_RULE_IDS,
  ...VRAT_RULE_IDS,
  ...FESTIVAL_RULE_IDS,
  ...PHASE_B_RULE_IDS,
  ...PHASE_C_RULE_IDS,
];
