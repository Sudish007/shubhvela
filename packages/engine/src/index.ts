// @shubhvela/engine public API.
// A01: re-exports the vendored @prisri/jyotish fork (ISC, see vendor/jyotish/VENDOR.md).
// A02: Shubhvela modules tz, gazetteer, kundli (ChartData model), chart-layout and locale.
// A03: panchang (panchang + goodHours, the only verdict producer), rules (dailyNote, familyToday), dasha
// (Vimshottari tree, ingress search, Sade Sati) and calendar (tithi events, vrats, festivals, upcoming).
// B01: vargas (F12), ashtakavarga + kp (F15), yogas (F16), varshaphal (F17), muhurat scorer + .ics (F26), travel note
// (F27), naamkaran (F28), matching (F29), share-code + URL schema (F30/M8), report models (F31).
export * from '../vendor/jyotish/src/index';
export * from './tz/index';
export * from './gazetteer/index';
export * from './kundli/index';
export * from './chart-layout/index';
export * from './panchang/index';
export * from './panchang/dishaShool';
export * from './rules/index';
export * from './dasha/index';
export * from './calendar/index';
export * from './vargas/index';
export * from './ashtakavarga/index';
export * from './kp/index';
export * from './yogas/index';
export * from './varshaphal/index';
export * from './naamkaran/index';
export * from './matching/index';
export * from './share/index';
export * from './report/index';
// The muhurat scorer is reached as `muhurat.score(...)` (plan.md section 2 API table); its helpers and types are also
// exported flat, with the generic `score` renamed `scoreMuhurat` at the top level.
export * as muhurat from './muhurat/index';
export {
  score as scoreMuhurat,
  splitWindows,
  toIcs,
  clipWindow,
  mergeWindows,
  compareWindows,
  muhuratActivity,
  MUHURAT_ACTIVITIES,
  MUHURAT_ACTIVITY_IDS,
  MUHURAT_ACTIVITY_RULE_IDS,
  MUHURAT_RULE_IDS,
  MUHURAT_RULE_ORDER,
  MUHURAT_MIN_RULES,
  MUHURAT_RULE_COUNT,
  type MuhuratActivity,
  type MuhuratRule,
  type MuhuratRuleId,
  type MuhuratWindow,
  type MuhuratOptions,
  type DateRange,
  type IcsOptions,
  type RuleDetail,
} from './muhurat/index';
// The locale tables share names with the fork's English constants (nakshatraNames, tithiNames, ...), so they
// are exposed as a namespace: `import { locale } from '@shubhvela/engine'; locale.signNames.hi[0]`.
export * as locale from './locale/index';
export type { Lang, PlanetId } from './locale/index';
export { LANGS, PLANET_IDS, PLANET_KEYS, planetIdFromKey, SIGN_LORDS, planetGlyphs, glyphScript } from './locale/index';
