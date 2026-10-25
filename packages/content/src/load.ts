// Loaders: static JSON imports (Metro and vitest both bundle them; no fs, no runtime schema validation).
// New corpus domains register themselves in ./registry.ts when their English master lands (A06-A08, B02, C02);
// Hindi/Bhojpuri files written by the corpus-translate Action are added there too once they exist.
import type { ContentLanguage, CorpusLookup, Snippet, UiStrings } from './types';
import { CORPUS, UI } from './registry';

export function loadUi(lang: ContentLanguage): UiStrings {
  return UI[lang];
}

export interface CorpusLoad {
  domain: string;
  snippets: Snippet[];
  /** Language actually returned. */
  lang: ContentLanguage;
  /** True when `lang` had no file for this domain and English was returned instead. */
  fallback: boolean;
}

/** Whole domain in one language, falling back to the English master (flagged). Unknown domain -> empty list. */
export function loadCorpus(domain: string, lang: ContentLanguage): CorpusLoad {
  const d = CORPUS[domain];
  if (!d) return { domain, snippets: [], lang, fallback: false };
  const own = d[lang];
  if (own) return { domain, snippets: own, lang, fallback: false };
  return { domain, snippets: d.en ?? [], lang: 'en', fallback: lang !== 'en' };
}

export function corpusDomains(): string[] {
  return Object.keys(CORPUS);
}

/**
 * One snippet by id. Prefers the requested language; falls back to English (flagged) when the language file is
 * missing OR when the id is missing from it (draft translations may lag the master). Null when the id is unknown.
 */
export function lookup(domain: string, id: string, lang: ContentLanguage): CorpusLookup | null {
  const d = CORPUS[domain];
  if (!d) return null;
  const own = d[lang]?.find((s) => s.id === id);
  if (own) return { text: own.text, lang, fallback: false, snippet: own };
  const en = d.en?.find((s) => s.id === id);
  if (!en) return null;
  return { text: en.text, lang: 'en', fallback: lang !== 'en', snippet: en };
}

/** The one-sentence rule behind a `ruleId` for the "Why?" sheet (domain `rules`). */
export function ruleText(ruleId: string, lang: ContentLanguage): CorpusLookup | null {
  return lookup('rules', ruleId, lang);
}
