// Loaders: static JSON imports (Metro and vitest both bundle them; no fs, no runtime schema validation).
// New corpus domains register themselves in ./registry.ts when their English master lands (A06-A08, B02, C02),
// together with their hi.json / bho.json (owner decision 2026-10-29: Hindi and Bhojpuri are authored by the same
// agents that wrote the English master, no translation API; all 18 in-scope domains are complete in both languages
// as of 2026-10-30, enforced by test/translations.test.ts; `naamkaran-names` stays English by decision —
// docs/CONTENT-TRANSLATION.md).
//
// Fallback chain (kept from the 2026-10-25 decision): every resolver walks FALLBACK_CHAIN[lang] and returns the
// FIRST language that has the id: bho -> hi -> en, hi -> en, en. The result records which language was actually
// used (`lang`) so the UI keeps its chrome in the requested language and shows the snippet in the resolved one;
// no empty strings, no badge. It still protects any future English-only record.
import type { ContentLanguage, CorpusLookup, FestivalText, GlossaryEntry, NaamkaranNames, Snippet, UiStrings } from './types';
import { CORPUS, FESTIVALS, GLOSSARY, NAAMKARAN_NAMES, UI } from './registry';

/** Languages tried, in order, when `lang` has no file or no entry for an id. */
export const FALLBACK_CHAIN: Record<ContentLanguage, readonly ContentLanguage[]> = {
  en: ['en'],
  hi: ['hi', 'en'],
  bho: ['bho', 'hi', 'en'],
};

export interface Resolved<T> {
  item: T;
  /** Language the item is actually in (the first of FALLBACK_CHAIN[requested] that had it). */
  lang: ContentLanguage;
  /** True when `lang` differs from the requested language. */
  fallback: boolean;
}

/** Generic resolver over a per-language table: first language in the chain whose table satisfies `pick`. */
export function resolve<T>(table: Partial<Record<ContentLanguage, T[]>>, lang: ContentLanguage, pick: (rows: T[]) => T | undefined): Resolved<T> | null {
  for (const l of FALLBACK_CHAIN[lang]) {
    const rows = table[l];
    if (!rows) continue;
    const item = pick(rows);
    if (item !== undefined) return { item, lang: l, fallback: l !== lang };
  }
  return null;
}

/** Whole table in the first chain language that has a file (English always exists for a registered domain). */
function resolveAll<T>(table: Partial<Record<ContentLanguage, T[]>>, lang: ContentLanguage): Resolved<T[]> {
  for (const l of FALLBACK_CHAIN[lang]) {
    const rows = table[l];
    if (rows) return { item: rows, lang: l, fallback: l !== lang };
  }
  return { item: [], lang, fallback: false };
}

export function loadUi(lang: ContentLanguage): UiStrings {
  return UI[lang];
}

export interface CorpusLoad {
  domain: string;
  snippets: Snippet[];
  /** Language actually returned (first of the fallback chain with a file). */
  lang: ContentLanguage;
  /** True when `lang` differs from the requested language. */
  fallback: boolean;
}

/** Whole domain in one language, walking the fallback chain (bho -> hi -> en). Unknown domain -> empty list. */
export function loadCorpus(domain: string, lang: ContentLanguage): CorpusLoad {
  const d = CORPUS[domain];
  if (!d) return { domain, snippets: [], lang, fallback: false };
  const r = resolveAll(d, lang);
  return { domain, snippets: r.item, lang: r.lang, fallback: r.fallback };
}

export function corpusDomains(): string[] {
  return Object.keys(CORPUS);
}

/**
 * One snippet by id: the first language in FALLBACK_CHAIN[lang] whose file contains the id (draft translations may
 * lag the master, so the walk is per id, not per file). Null when the id is unknown in every language.
 */
export function lookup(domain: string, id: string, lang: ContentLanguage): CorpusLookup | null {
  const d = CORPUS[domain];
  if (!d) return null;
  const r = resolve(d, lang, (rows) => rows.find((s) => s.id === id));
  return r ? { text: r.item.text, lang: r.lang, fallback: r.fallback, snippet: r.item } : null;
}

/** The one-sentence rule behind a `ruleId` for the "Why?" sheet (domain `rules`). */
export function ruleText(ruleId: string, lang: ContentLanguage): CorpusLookup | null {
  return lookup('rules', ruleId, lang);
}

/** All festival texts in the first chain language that has a file. */
export function loadFestivals(lang: ContentLanguage): { items: FestivalText[]; lang: ContentLanguage; fallback: boolean } {
  const r = resolveAll(FESTIVALS, lang);
  return { items: r.item, lang: r.lang, fallback: r.fallback };
}

/** One festival text by engine slug (`festival-<slug>` id), walking the fallback chain per entry. */
export function festivalText(slug: string, lang: ContentLanguage): Resolved<FestivalText> | null {
  return resolve(FESTIVALS, lang, (rows) => rows.find((f) => f.slug === slug));
}

/** The whole glossary in the first chain language that has a file. */
export function loadGlossary(lang: ContentLanguage): { items: GlossaryEntry[]; lang: ContentLanguage; fallback: boolean } {
  const r = resolveAll(GLOSSARY, lang);
  return { items: r.item, lang: r.lang, fallback: r.fallback };
}

/** One glossary entry by id, walking the fallback chain per entry. */
export function glossaryTerm(id: string, lang: ContentLanguage): Resolved<GlossaryEntry> | null {
  return resolve(GLOSSARY, lang, (rows) => rows.find((g) => g.id === id));
}

/** All 108 naamkaran name lists (F28). Names are Devanagari + Latin in every language, so the file is English-only and `fallback` is true for hi/bho. */
export function loadNaamkaranNames(lang: ContentLanguage): { items: NaamkaranNames[]; lang: ContentLanguage; fallback: boolean } {
  const r = resolveAll(NAAMKARAN_NAMES, lang);
  return { items: r.item, lang: r.lang, fallback: r.fallback };
}

/** Name list for one nakshatra (1-27) and pada (1-4); null when out of range. */
export function naamkaranNames(nakshatra: number, pada: number, lang: ContentLanguage): Resolved<NaamkaranNames> | null {
  return resolve(NAAMKARAN_NAMES, lang, (rows) => rows.find((n) => n.nakshatra === nakshatra && n.pada === pada));
}
