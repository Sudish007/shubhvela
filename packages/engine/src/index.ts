// @shubhvela/engine public API.
// A01: re-exports the vendored @prisri/jyotish fork (ISC, see vendor/jyotish/VENDOR.md).
// A02: Shubhvela modules tz, gazetteer, kundli (ChartData model), chart-layout and locale.
// Later clusters add panchang, rules, calendar, muhurat, matching, share, naamkaran, report beside these lines.
export * from '../vendor/jyotish/src/index';
export * from './tz/index';
export * from './gazetteer/index';
export * from './kundli/index';
export * from './chart-layout/index';
// The locale tables share names with the fork's English constants (nakshatraNames, tithiNames, ...), so they
// are exposed as a namespace: `import { locale } from '@shubhvela/engine'; locale.signNames.hi[0]`.
export * as locale from './locale/index';
export type { Lang, PlanetId } from './locale/index';
export { LANGS, PLANET_IDS, PLANET_KEYS, planetIdFromKey, SIGN_LORDS, planetGlyphs, glyphScript } from './locale/index';
