// @shubhvela/content public API: UI strings (en/hi/bho), corpus loaders with flagged English fallback, t() with
// {param} interpolation and plurals, and the +30 % pseudo-locale for layout tests. No runtime schema dependency.
export { CONTENT_LANGUAGES } from './types';
export type { ContentLanguage, UiStrings, Snippet, GlossaryEntry, FestivalText, Lesson, ReviewState, TranslationParams, CorpusLookup } from './types';
export { loadUi, loadCorpus, lookup, ruleText, corpusDomains, loadFestivals, festivalText, loadGlossary, glossaryTerm } from './load';
export type { CorpusLoad } from './load';
export { t, interpolate, pluralCategory, paramsOf, visibleLength, pseudoLocale, pseudoString } from './t';
