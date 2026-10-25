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

export interface Lesson {
  id: string;
  n: number;
  title: string;
  minutes: number;
  body: string[];
  terms: string[];
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
