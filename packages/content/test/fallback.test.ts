// Fallback chain (owner decision 2026-10-25: the corpus is never machine-translated into Bhojpuri; Hindi arrives only
// when the owner dispatches the corpus-translate Action). Every resolver returns the first language in
// bho -> hi -> en / hi -> en / en that has the id, and reports which one it used; nothing comes back empty.
import { describe, expect, it } from 'vitest';
import { CORPUS, FESTIVALS, GLOSSARY } from '../src/registry';
import { CONTENT_LANGUAGES, corpusDomains, FALLBACK_CHAIN, festivalText, glossaryTerm, loadCorpus, loadFestivals, loadGlossary, lookup, ruleText } from '../src/index';
import { resolve } from '../src/load';

describe('FALLBACK_CHAIN', () => {
  it('is bho -> hi -> en, hi -> en, en', () => {
    expect(FALLBACK_CHAIN.bho).toEqual(['bho', 'hi', 'en']);
    expect(FALLBACK_CHAIN.hi).toEqual(['hi', 'en']);
    expect(FALLBACK_CHAIN.en).toEqual(['en']);
    for (const lang of CONTENT_LANGUAGES) {
      expect(FALLBACK_CHAIN[lang][0]).toBe(lang);
      expect(FALLBACK_CHAIN[lang][FALLBACK_CHAIN[lang].length - 1]).toBe('en');
    }
  });
});

describe('every id resolves in every language with the language used recorded', () => {
  it('lookup(): for each registered domain and each English id, bho and hi return a non-empty text and a lang on the chain', () => {
    for (const domain of corpusDomains()) {
      const en = loadCorpus(domain, 'en');
      expect(en.fallback).toBe(false);
      for (const s of en.snippets) {
        for (const lang of ['hi', 'bho'] as const) {
          const r = lookup(domain, s.id, lang);
          expect(r, `${domain}/${s.id} in ${lang}`).not.toBeNull();
          expect(r!.text.trim().length, `${domain}/${s.id} empty in ${lang}`).toBeGreaterThan(0);
          expect(FALLBACK_CHAIN[lang], `${domain}/${s.id} lang ${r!.lang}`).toContain(r!.lang);
          expect(r!.fallback).toBe(r!.lang !== lang);
          // The resolved language is the FIRST on the chain that has the id.
          const expected = FALLBACK_CHAIN[lang].find((l) => CORPUS[domain][l]?.some((x) => x.id === s.id));
          expect(r!.lang, `${domain}/${s.id} should resolve to ${expected}`).toBe(expected);
        }
      }
    }
  });

  it('loadCorpus(): a whole domain in bho or hi is never empty and reports the file language', () => {
    for (const domain of corpusDomains()) {
      for (const lang of ['hi', 'bho'] as const) {
        const r = loadCorpus(domain, lang);
        expect(r.snippets.length, `${domain} ${lang}`).toBe(loadCorpus(domain, 'en').snippets.length);
        expect(FALLBACK_CHAIN[lang]).toContain(r.lang);
        expect(r.fallback).toBe(r.lang !== lang);
      }
    }
  });

  it('festivals and glossary follow the same chain', () => {
    for (const lang of ['hi', 'bho'] as const) {
      const fs = loadFestivals(lang);
      expect(fs.items.length).toBe(loadFestivals('en').items.length);
      expect(FALLBACK_CHAIN[lang]).toContain(fs.lang);
      for (const f of loadFestivals('en').items) {
        const r = festivalText(f.slug, lang);
        expect(r, `${f.slug} ${lang}`).not.toBeNull();
        expect(r!.item.what.trim().length).toBeGreaterThan(0);
        const expected = FALLBACK_CHAIN[lang].find((l) => FESTIVALS[l]?.some((x) => x.slug === f.slug));
        expect(r!.lang).toBe(expected);
      }
      const gl = loadGlossary(lang);
      expect(gl.items.length).toBe(loadGlossary('en').items.length);
      for (const g of loadGlossary('en').items) {
        const r = glossaryTerm(g.id, lang);
        expect(r, `${g.id} ${lang}`).not.toBeNull();
        const expected = FALLBACK_CHAIN[lang].find((l) => GLOSSARY[l]?.some((x) => x.id === g.id));
        expect(r!.lang).toBe(expected);
        expect(r!.fallback).toBe(r!.lang !== lang);
      }
    }
  });

  it('unknown ids and domains are null / empty in every language, never a stray fallback', () => {
    for (const lang of CONTENT_LANGUAGES) {
      expect(lookup('rules', 'no-such-rule', lang)).toBeNull();
      expect(ruleText('no-such-rule', lang)).toBeNull();
      expect(lookup('no-such-domain', 'rahu-kaal', lang)).toBeNull();
      expect(loadCorpus('no-such-domain', lang)).toEqual({ domain: 'no-such-domain', snippets: [], lang, fallback: false });
      expect(festivalText('no-such-festival', lang)).toBeNull();
      expect(glossaryTerm('no-such-term', lang)).toBeNull();
    }
  });

  it('a Bhojpuri request prefers a Hindi entry over English when Hindi exists for that id (chain order, not file presence)', () => {
    // A simulated table exercises the real resolver's order without depending on which Action batches have run.
    const table = {
      en: [{ id: 'a', text: 'A-en' }, { id: 'b', text: 'B-en' }, { id: 'c', text: 'C-en' }],
      hi: [{ id: 'a', text: 'A-hi' }, { id: 'b', text: 'B-hi' }],
      bho: [{ id: 'a', text: 'A-bho' }],
    };
    const pick = (lang: 'en' | 'hi' | 'bho', id: string) => resolve(table, lang, (rows) => rows.find((x) => x.id === id));
    expect(pick('bho', 'a')).toEqual({ item: { id: 'a', text: 'A-bho' }, lang: 'bho', fallback: false });
    expect(pick('bho', 'b')).toEqual({ item: { id: 'b', text: 'B-hi' }, lang: 'hi', fallback: true });
    expect(pick('bho', 'c')).toEqual({ item: { id: 'c', text: 'C-en' }, lang: 'en', fallback: true });
    expect(pick('hi', 'c')).toEqual({ item: { id: 'c', text: 'C-en' }, lang: 'en', fallback: true });
    expect(pick('en', 'zzz')).toBeNull();
  });
});
