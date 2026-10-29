// Every rule id the engine can emit has a one-sentence rule with a source in corpus/rules/en.json (design.md 6).
import { describe, expect, it } from 'vitest';
import { RULE_IDS, FESTIVAL_RULE_IDS, VRAT_RULE_IDS } from '../../engine/src/rules/ruleIds';
import { loadCorpus, lookup, ruleText } from '../src/index';

describe('rules corpus covers the engine', () => {
  const rules = loadCorpus('rules', 'en');
  const ids = new Set(rules.snippets.map((s) => s.id));

  it('has an entry for every RULE_IDS id and nothing the engine does not emit', () => {
    const missing = RULE_IDS.filter((id) => !ids.has(id));
    expect(missing, `missing rules: ${missing.join(', ')}`).toEqual([]);
    const extra = rules.snippets.map((s) => s.id).filter((id) => !RULE_IDS.includes(id));
    expect(extra, `rule entries without an engine id: ${extra.join(', ')}`).toEqual([]);
    expect(RULE_IDS.length).toBe(new Set(RULE_IDS).size);
    expect(RULE_IDS.length).toBeGreaterThanOrEqual(60);
    expect(FESTIVAL_RULE_IDS.length).toBeGreaterThanOrEqual(60);
    expect(VRAT_RULE_IDS.length).toBe(12);
  });

  it('every rule is one sentence with a source and lists its inputs', () => {
    for (const s of rules.snippets) {
      expect(s.source, `${s.id} has no source`).toBeTruthy();
      expect(s.params?.length, `${s.id} lists no inputs`).toBeGreaterThan(0);
      expect(s.review).toBe('draft');
      // One sentence: exactly one terminal full stop at the end (abbreviations like "approx." are not used mid-sentence here).
      expect(s.text.trim().endsWith('.'), `${s.id} does not end with a full stop`).toBe(true);
      expect(s.text.split(/\.\s+[A-Z]/).length, `${s.id} is more than one sentence: ${s.text}`).toBe(1);
    }
  });

  it('loaders report the language actually used and flag a fallback', () => {
    // Translation-agnostic: before the agent-written rules/hi.json lands this resolves to English with fallback true;
    // afterwards to Hindi / Bhojpuri with fallback false (test/translations.test.ts checks the translated records).
    const hi = loadCorpus('rules', 'hi');
    expect(['hi', 'en']).toContain(hi.lang);
    expect(hi.fallback).toBe(hi.lang !== 'hi');
    expect(hi.snippets.length).toBeGreaterThan(0);
    if (hi.lang === 'en') expect(hi.snippets.length).toBe(rules.snippets.length);
    const r = ruleText('rahu-kaal', 'bho');
    expect(r).not.toBeNull();
    expect(r!.fallback).toBe(r!.lang !== 'bho');
    expect(r!.text).toMatch(r!.lang === 'en' ? /Rahu Kaal/ : /राहु काल/);
    expect(lookup('rules', 'no-such-rule', 'en')).toBeNull();
    expect(loadCorpus('no-such-domain', 'en').snippets).toEqual([]);
  });
});
