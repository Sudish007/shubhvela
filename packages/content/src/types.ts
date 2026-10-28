// Shared content types (schemas in ../schema/*.json are the normative shape; these mirror them for TypeScript users).
export const CONTENT_LANGUAGES = ['en', 'hi', 'bho'] as const;
export type ContentLanguage = (typeof CONTENT_LANGUAGES)[number];

/** Flat UI string map: keys namespaced with dots, plurals as `_one` / `_other`, params as `{name}`. */
export type UiStrings = Record<string, string>;

export type ReviewState = 'draft' | 'reviewed';

/** One corpus snippet (schema/snippet.schema.json). For the `rules` domain `text` is the one-sentence rule itself. */
export interface Snippet {
  /** Stable id, identical across languages (for `rules`: the engine ruleId). */
  id: string;
  /** The rule this snippet explains (engine ruleId or rule family). */
  rule: string;
  /** Classical text name, or 'convention' when no single source applies. */
  source?: string;
  /** 1 = one line, 2 = paragraph, 3 = full explanation. */
  level: 1 | 2 | 3;
  text: string;
  review: ReviewState;
  /** Names of the `{param}` placeholders / engine inputs the text refers to. */
  params?: string[];
}

export interface GlossaryEntry {
  id: string;
  term_dev: string;
  term_lat: string;
  meaning: string;
  related?: string[];
}

export interface FestivalText {
  id: string;
  slug: string;
  name: string;
  what: string;
  rule: string;
  conventionNote?: string;
  review: ReviewState;
}

/** One name in Devanagari and Latin (schema/naamkaran-names.schema.json). */
export interface NameEntry {
  dev: string;
  lat: string;
}

/** Name list for one nakshatra pada (F28): the starting syllable and 3-5 names, no meanings claimed. */
export interface NaamkaranNames {
  id: string;
  nakshatra: number;
  pada: number;
  syllable: NameEntry;
  names: NameEntry[];
  /** Almanac substitution used when the syllable has no common names. */
  note?: string;
  review: ReviewState;
}

/** "Try it on your chart" row of a lesson: an expo-router route inside the app and the ui key of the card it opens. */
export interface LessonTryIt {
  route: string;
  /** UI string key (e.g. `charts.houses`) resolved with t() in the UI language. */
  label: string;
}

/** One Learn lesson (schema/lesson.schema.json, F32). `body` paragraphs may contain only LESSON_PLACEHOLDERS (src/lessons.ts). */
export interface Lesson {
  id: string;
  n: number;
  title: string;
  minutes: number;
  body: string[];
  /** Glossary ids linked from the lesson. */
  terms: string[];
  tryIt: LessonTryIt;
  /** Corpus snippet level (2 | 3) that "Mark done" unlocks for the Why? sheets; never a commercial item. */
  unlocksLevel: 2 | 3;
  review: ReviewState;
}

export type TranslationParams = Record<string, string | number | boolean | null | undefined>;

export interface CorpusLookup {
  text: string;
  /** Language the text is actually in (first of the fallback chain that had it). */
  lang: ContentLanguage;
  /** True when the requested language had no entry and a fallback language (bho -> hi -> en) was used. */
  fallback: boolean;
  snippet: Snippet;
}
