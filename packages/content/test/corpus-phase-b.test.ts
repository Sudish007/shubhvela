// B02: yogas (40), kootas 8 x 3 levels + exceptions, Mangal dosha variants, muhurat activity / rule texts, naamkaran names.
// Ids are the engine's Phase B rule ids (packages/engine/src/rules/ruleIds.ts) so every "Why?" sheet resolves; every text
// is draft, names its rule and source, and stays in the reflective register (spec 7, design 6, FEAT-B02 acceptance).
import { describe, expect, it } from 'vitest';
import { YOGA_RULE_IDS } from '../../engine/src/yogas/index';
import { KOOTA_EXCEPTION_IDS, KOOTA_IDS, MANGAL_RULE_IDS } from '../../engine/src/matching/index';
import { MUHURAT_ACTIVITY_RULE_IDS, MUHURAT_RULE_IDS } from '../../engine/src/muhurat/index';
import { allSyllables } from '../../engine/src/naamkaran/index';
import { nakshatraNames } from '../../engine/src/locale/index';
import { ruleParamsB } from '../../engine/src/rules/ruleIds';
import { loadCorpus, loadNaamkaranNames, lookup, naamkaranNames, ruleText } from '../src/index';

const words = (s: string): number => s.trim().split(/\s+/).filter(Boolean).length;
const DEV = /^[\u0900-\u097F]+$/u;
const LAT = /^[A-Za-z]+$/;

function checkCommon(domain: string): void {
  const { snippets, fallback } = loadCorpus(domain, 'en');
  expect(fallback).toBe(false);
  for (const s of snippets) {
    expect(s.review, `${domain}/${s.id} review`).toBe('draft');
    expect(s.rule.trim().length, `${domain}/${s.id} names no rule`).toBeGreaterThan(8);
    expect(s.source, `${domain}/${s.id} has no source`).toBeTruthy();
    expect(s.params?.length, `${domain}/${s.id} lists no inputs`).toBeGreaterThan(0);
    expect(s.text, `${domain}/${s.id} fear language`).not.toMatch(/\b(danger|disaster|doom|death|evil|curse|inauspicious day)\b/i);
    expect(s.text, `${domain}/${s.id} outcome promise`).not.toMatch(/\byou will\b|\bwill (bring|give|cause|make you|lead to|result in)\b|\bis certain\b|\bdestined\b/i);
  }
}

describe('yogas/en.json', () => {
  const { snippets } = loadCorpus('yogas', 'en');
  it('has 40 snippets: every engine YOGA_RULE_IDS id (31 yogas + 7 bhanga) plus yoga-kala-amrita and yoga-none, 50-90 words, level 1', () => {
    checkCommon('yogas');
    expect(snippets.length).toBe(40);
    const ids = new Set(snippets.map((s) => s.id));
    for (const id of YOGA_RULE_IDS) expect(ids.has(id), `yogas/${id} missing`).toBe(true);
    expect(ids.has('yoga-kala-amrita')).toBe(true);
    expect(ids.has('yoga-none')).toBe(true);
    const bad = snippets.map((s) => ({ id: s.id, n: words(s.text) })).filter(({ n }) => n < 50 || n > 90);
    expect(bad, JSON.stringify(bad)).toEqual([]);
    for (const s of snippets) expect(s.level, s.id).toBe(1);
  });
  it('uses formed/cancelled vocabulary and the engine params of its rule id', () => {
    for (const s of snippets) {
      expect(s.text, s.id).toMatch(/formed|cancelled|set aside|present/);
      // yoga-kala-amrita shares the yoga-* params; yoga-none (the empty card) lists only `checked`.
      const params = s.id === 'yoga-none' ? ['checked'] : ruleParamsB(s.id);
      if (params) expect(s.params, `${s.id} params`).toEqual([...params]);
    }
    expect(lookup('yogas', 'yoga-kemadruma', 'en')!.text).toMatch(/cancel/);
    expect(lookup('yogas', 'yoga-gaja-kesari', 'en')!.text).toMatch(/kendra/);
  });
});

describe('koota/en.json', () => {
  const { snippets } = loadCorpus('koota', 'en');
  it('has koota-<id>-<1|2|3> for the 8 kootas (24) plus the 4 exception rules; levels grow in length', () => {
    checkCommon('koota');
    const expected = [...KOOTA_IDS.flatMap((k) => [1, 2, 3].map((l) => `koota-${k}-${l}`)), ...KOOTA_EXCEPTION_IDS];
    expect(snippets.map((s) => s.id).sort()).toEqual([...expected].sort());
    for (const k of KOOTA_IDS) {
      const l1 = lookup('koota', `koota-${k}-1`, 'en')!;
      const l2 = lookup('koota', `koota-${k}-2`, 'en')!;
      const l3 = lookup('koota', `koota-${k}-3`, 'en')!;
      expect(l1.snippet.level).toBe(1);
      expect(l2.snippet.level).toBe(2);
      expect(l3.snippet.level).toBe(3);
      // Level 1 is one sentence (the free-tier summary); 2 a paragraph; 3 the full explanation.
      expect(l1.text.split(/(?<=[.!?])\s+(?=[A-Z])/).length, `${k} level 1 sentences`).toBe(1);
      expect(words(l1.text)).toBeLessThanOrEqual(40);
      expect(words(l2.text)).toBeGreaterThanOrEqual(50);
      expect(words(l3.text)).toBeGreaterThan(words(l2.text));
      // Every level names the rule id and lists the engine params of the koota row.
      for (const s of [l1, l2, l3]) {
        expect(s.snippet.rule).toBe(`koota-${k}`);
        expect(s.snippet.params).toEqual([...ruleParamsB(`koota-${k}`)!]);
        expect(ruleText(`koota-${k}`, 'en')).not.toBeNull();
      }
    }
    for (const id of KOOTA_EXCEPTION_IDS) {
      const s = lookup('koota', id, 'en')!;
      expect(s.snippet.level).toBe(3);
      expect(s.snippet.params).toEqual([...ruleParamsB(id)!]);
    }
  });
  it('Nadi and Bhakoot level 3 texts name their exceptions', () => {
    expect(lookup('koota', 'koota-nadi-3', 'en')!.text).toMatch(/same sign.*different nakshatras|same nakshatra.*different padas/);
    expect(lookup('koota', 'koota-bhakoot-3', 'en')!.text).toMatch(/2\/12/);
    expect(lookup('koota', 'koota-bhakoot-3', 'en')!.text).toMatch(/same-lord exception/);
  });
});

describe('mangal/en.json', () => {
  it('has mangal-dosha, mangal-dosha-none and the six cancellation rows, each naming its rule and avoiding fear language', () => {
    checkCommon('mangal');
    const { snippets } = loadCorpus('mangal', 'en');
    const expected = [...MANGAL_RULE_IDS, 'mangal-dosha-none'];
    expect(snippets.map((s) => s.id).sort()).toEqual([...expected].sort());
    expect(snippets.filter((s) => s.id.startsWith('mangal-cancel-')).length).toBe(6);
    for (const s of snippets) {
      expect(words(s.text), s.id).toBeGreaterThanOrEqual(50);
      expect(words(s.text), s.id).toBeLessThanOrEqual(110);
      expect(s.text, s.id).not.toMatch(/\b(harm|fatal|widow|widower|accident|divorce)\b/i);
      const ruleId = s.id === 'mangal-dosha-none' ? 'mangal-dosha' : s.id;
      expect(s.rule).toBe(ruleId);
      expect(s.params).toEqual([...ruleParamsB(ruleId)!]);
    }
  });
});

describe('muhurat-activities/en.json', () => {
  const { snippets } = loadCorpus('muhurat-activities', 'en');
  it('has the 14 activity tables, the 10 rule chips and the N18 ranking explanation', () => {
    checkCommon('muhurat-activities');
    const expected = [...MUHURAT_ACTIVITY_RULE_IDS, ...MUHURAT_RULE_IDS, 'muhurat-ranking'];
    expect(snippets.map((s) => s.id).sort()).toEqual([...expected].sort());
    expect(MUHURAT_ACTIVITY_RULE_IDS.length).toBe(14);
    expect(MUHURAT_RULE_IDS.length).toBe(10);
    for (const id of MUHURAT_ACTIVITY_RULE_IDS) {
      const s = lookup('muhurat-activities', id, 'en')!;
      expect(words(s.text), id).toBeGreaterThanOrEqual(60);
      expect(words(s.text), id).toBeLessThanOrEqual(130);
      // Each activity text says which tithis, nakshatras and weekdays the table allows.
      expect(s.text, id).toMatch(/tithis? \d/);
      expect(s.text, id).toMatch(/Monday|Sunday/);
      expect(s.text, id).toMatch(/Ashwini|Rohini|Mrigashira|Pushya|Hasta|Revati|Anuradha/);
      expect(s.snippet.params).toEqual([...ruleParamsB(id)!]);
    }
    for (const id of MUHURAT_RULE_IDS) {
      const s = lookup('muhurat-activities', id, 'en')!;
      expect(words(s.text), id).toBeGreaterThanOrEqual(40);
      expect(words(s.text), id).toBeLessThanOrEqual(90);
      expect(s.snippet.params).toEqual([...ruleParamsB(id)!]);
    }
    const ranking = lookup('muhurat-activities', 'muhurat-ranking', 'en')!.text;
    expect(ranking).toMatch(/rules met/);
    expect(ranking).toMatch(/Abhijit/);
    expect(ranking).toMatch(/earlier start/);
    expect(ranking).toMatch(/longer/);
    expect(ranking).toMatch(/fewer than four/);
    expect(ranking).toMatch(/never probabilities/);
  });
});

describe('naamkaran-names/en.json', () => {
  const { items, fallback } = loadNaamkaranNames('en');
  it('has one entry per engine syllable (108), matching nakshatra, pada and syllable, with 3-5 names in Devanagari + Latin and no meanings', () => {
    expect(fallback).toBe(false);
    const engine = allSyllables();
    expect(engine.length).toBe(108);
    expect(items.length).toBe(108);
    for (const e of engine) {
      const n = naamkaranNames(e.nakshatra, e.pada, 'en');
      expect(n, `${e.nakshatra}-${e.pada}`).not.toBeNull();
      const it = n!.item;
      expect(it.id).toBe(`nakshatra-${e.nakshatra}-${e.pada}`);
      expect(it.syllable).toEqual({ dev: e.syllable.devanagari, lat: e.syllable.latin });
      expect(it.review).toBe('draft');
      expect(it.names.length, it.id).toBeGreaterThanOrEqual(3);
      expect(it.names.length, it.id).toBeLessThanOrEqual(5);
      const seen = new Set<string>();
      for (const nm of it.names) {
        expect(nm.dev, `${it.id} ${nm.lat}`).toMatch(DEV);
        expect(nm.lat, `${it.id} ${nm.lat}`).toMatch(LAT);
        expect(seen.has(nm.dev), `${it.id} duplicate ${nm.dev}`).toBe(false);
        seen.add(nm.dev);
        // Names start with the syllable's consonant (or vowel); when they cannot, the entry carries a note saying so.
        const first = Array.from(e.syllable.devanagari)[0];
        if (!nm.dev.startsWith(first)) expect(it.note, `${it.id}: ${nm.dev} does not start with ${e.syllable.devanagari} and no note explains it`).toBeTruthy();
      }
      // No meaning claims anywhere (spec F28, design 10.5).
      expect(JSON.stringify(it)).not.toMatch(/"meaning"/);
      if (it.note) expect(it.note).not.toMatch(/\bmeans?\b/i);
    }
    expect(naamkaranNames(28, 1, 'en')).toBeNull();
    expect(naamkaranNames(1, 5, 'en')).toBeNull();
    expect(nakshatraNames.en.length).toBe(27);
  });
  it('hi and bho fall back to the English file with the flag set (names are not translated)', () => {
    for (const lang of ['hi', 'bho'] as const) {
      const r = loadNaamkaranNames(lang);
      expect(r.items.length).toBe(108);
      expect(r.fallback).toBe(true);
      expect(r.lang).toBe('en');
    }
  });
});
