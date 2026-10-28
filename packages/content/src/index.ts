// @shubhvela/content public API: UI strings (en/hi/bho), corpus loaders with flagged English fallback, t() with
// {param} interpolation and plurals, and the +30 % pseudo-locale for layout tests. No runtime schema dependency.
export { CONTENT_LANGUAGES } from './types';
export type { ContentLanguage, UiStrings, Snippet, GlossaryEntry, FestivalText, Lesson, LessonTryIt, NaamkaranNames, NameEntry, ReviewState, TranslationParams, CorpusLookup } from './types';
export { loadUi, loadCorpus, lookup, ruleText, corpusDomains, loadFestivals, festivalText, loadGlossary, glossaryTerm, loadNaamkaranNames, naamkaranNames, FALLBACK_CHAIN } from './load';
export type { CorpusLoad, Resolved } from './load';
export { LESSON_PLACEHOLDERS, loadLessons, lesson, lessonPlaceholders, renderLesson } from './lessons';
export type { LessonPlaceholder, LessonValues } from './lessons';
export { t, interpolate, pluralCategory, paramsOf, visibleLength, pseudoLocale, pseudoString } from './t';
