// A08: festival texts, vrat texts and the glossary (spec section 7: festivals 60, vrats 12, glossary 150).
// Festivals: one entry per slug of the engine festival table, the rule sentence identical to corpus/rules, 80-150 words of
// what-to-do, a Purnimanta/Amanta or North/South convention note. Vrats: one per engine VratFamily. Glossary: >= 150 terms,
// Devanagari headword + Latin + one line, related ids resolve, and every Sanskrit term the UI strings, the rules corpus and
// the engine name tables use has an entry.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { VRAT_FAMILIES } from '../../engine/src/calendar/vrats';
import { lunarMonthNames, nakshatraNames, planetNames, PLANET_IDS, signNames, tithiNames } from '../../engine/src/locale/index';
import { isDevanagariDominant, scriptCounts } from '../../content-tools/src/forbidden';
import { festivalText, glossaryTerm, loadCorpus, loadFestivals, loadGlossary, loadUi, lookup, ruleText } from '../src/index';

const ROOT = resolve(__dirname, '..');
const words = (s: string): number => s.trim().split(/\s+/).filter(Boolean).length;
const slugOf = (term: string): string => term.toLowerCase().replace(/\s*\(.*\)$/, '').trim().replace(/\s+/g, '-');

interface FestivalRule {
  slug: string;
  names: { en: string; hi: string; bho: string };
  region?: 'north' | 'south';
}
const table = JSON.parse(readFileSync(resolve(ROOT, '..', 'engine', 'data', 'festival-rules.json'), 'utf8')) as { rules: FestivalRule[] };

describe('festivals/en.json', () => {
  const { items, fallback } = loadFestivals('en');

  it('has exactly one entry per engine festival slug (>= 60), ids festival-<slug>, names from the engine table, review draft', () => {
    expect(fallback).toBe(false);
    expect(items.length).toBeGreaterThanOrEqual(60);
    expect(items.map((f) => f.slug).sort()).toEqual(table.rules.map((r) => r.slug).sort());
    const byId = new Map(table.rules.map((r) => [r.slug, r]));
    for (const f of items) {
      expect(f.id, f.slug).toBe(`festival-${f.slug}`);
      expect(f.name, f.slug).toBe(byId.get(f.slug)!.names.en);
      expect(f.review, f.slug).toBe('draft');
    }
  });

  it('every rule sentence is the one the Why? sheet shows (corpus/rules festival-<slug>)', () => {
    for (const f of items) {
      const r = ruleText(`festival-${f.slug}`, 'en');
      expect(r, `rules/festival-${f.slug} missing`).not.toBeNull();
      expect(f.rule, f.slug).toBe(r!.text);
    }
  });

  it('what-to-do is 80-150 words and the convention note names the convention (Purnimanta/Amanta, solar, nakshatra, region)', () => {
    const bad: string[] = [];
    for (const f of items) {
      const n = words(f.what);
      if (n < 80 || n > 150) bad.push(`${f.slug}: what ${n} words`);
      if (!f.conventionNote || words(f.conventionNote) < 8) bad.push(`${f.slug}: convention note too short`);
      if (f.conventionNote && !/Purnimanta|Amanta|solar|sankranti|nakshatra|north|south|region/i.test(f.conventionNote)) bad.push(`${f.slug}: convention note names no convention`);
    }
    expect(bad, bad.join('\n')).toEqual([]);
  });

  it('festivalText() resolves by slug with the English fallback flagged for other languages when no file exists', () => {
    const en = festivalText('diwali', 'en');
    expect(en?.item.name).toBe('Diwali (Lakshmi Puja)');
    expect(en?.fallback).toBe(false);
    expect(festivalText('no-such-festival', 'en')).toBeNull();
    const hi = festivalText('diwali', 'hi');
    expect(hi?.item.slug).toBe('diwali');
    if (hi?.lang === 'en') expect(hi.fallback).toBe(true);
  });
});

describe('vrats/en.json', () => {
  it('has exactly one snippet per engine VratFamily with the engine ruleId vrat-<family> and the rules-corpus timing sentence', () => {
    const { snippets, fallback } = loadCorpus('vrats', 'en');
    expect(fallback).toBe(false);
    expect(snippets.map((s) => s.id).sort()).toEqual(VRAT_FAMILIES.map((f) => `vrat-${f}`).sort());
    expect(snippets.length).toBe(12);
    for (const family of VRAT_FAMILIES) {
      const s = lookup('vrats', `vrat-${family}`, 'en');
      expect(s, family).not.toBeNull();
      expect(s!.snippet.rule, family).toBe(ruleText(`vrat-${family}`, 'en')!.text);
      expect(s!.snippet.source, family).toBeTruthy();
      // Every vrat text explains its timing in words (parana, moonrise, sunset/sunrise, pradosh, nishita, madhyahna, arghya).
      expect(s!.text, family).toMatch(/parana|moonrise|sunrise|sunset|pradosh|nishita|midnight|midday|madhyahna|arghya|Ghatasthapana/i);
    }
  });
});

/**
 * Sanskrit terms the UI strings (ui/en.json) and the rules corpus use, and the glossary id each must resolve to.
 * The test asserts both halves: the term really occurs in the UI/rules text (so the list stays honest) and the glossary has it.
 */
const LINKED_TERMS: Record<string, string> = {
  Panchang: 'panchang',
  Tithi: 'tithi',
  Nakshatra: 'nakshatra',
  Yoga: 'yoga',
  Karana: 'karana',
  Paksha: 'paksha',
  Shukla: 'shukla-paksha',
  Krishna: 'krishna-paksha',
  Amanta: 'amanta',
  Purnimanta: 'purnimanta',
  Adhik: 'adhik-maas',
  Kshaya: 'kshaya-tithi',
  Samvat: 'samvat',
  Vikram: 'vikram-samvat',
  Shaka: 'shaka-samvat',
  Sankranti: 'sankranti',
  Ayana: 'ayana',
  Uttarayana: 'uttarayana',
  Dakshinayana: 'dakshinayana',
  Ritu: 'ritu',
  Vasanta: 'vasanta',
  Grishma: 'grishma',
  Varsha: 'varsha',
  Sharad: 'sharad',
  Hemanta: 'hemanta',
  Shishira: 'shishira',
  Abhijit: 'abhijit',
  'Brahma muhurta': 'brahma-muhurta',
  'Rahu Kaal': 'rahu-kaal',
  Yamaganda: 'yamaganda',
  Gulika: 'gulika',
  Mandi: 'gulika',
  Choghadiya: 'choghadiya',
  Amrit: 'amrit',
  Shubh: 'shubh',
  Labh: 'labh',
  Chal: 'chal',
  Rog: 'rog',
  Kaal: 'kaal',
  Udveg: 'udveg',
  Hora: 'hora',
  Bhadra: 'bhadra',
  Vishti: 'vishti',
  Panchak: 'panchak',
  'Disha Shool': 'disha-shool',
  Aparahna: 'aparahna',
  Madhyahna: 'madhyahna',
  Pradosh: 'pradosh',
  Nishita: 'nishita',
  Sandhya: 'sandhya',
  Parana: 'parana',
  'Hari Vasara': 'hari-vasara',
  Smarta: 'smarta',
  Vaishnava: 'vaishnava',
  Nirjala: 'nirjala',
  Vrat: 'vrat',
  Ekadashi: 'ekadashi',
  Dwadashi: 'dwadashi',
  Sankashti: 'sankashti',
  Angaraki: 'angaraki',
  'Vinayaka Chaturthi': 'vinayaka-chaturthi',
  'Masik Shivaratri': 'masik-shivaratri',
  Ghatasthapana: 'ghatasthapana',
  Navratri: 'navratri',
  arghya: 'arghya',
  Chhath: 'chhath',
  'Nahay Khay': 'nahay-khay',
  Kharna: 'kharna',
  Teej: 'teej',
  'Karwa Chauth': 'karwa-chauth',
  Satyanarayan: 'satyanarayan',
  Shraddha: 'shraddha',
  'Pitru Paksha': 'pitru-paksha',
  Mahalaya: 'mahalaya',
  Barsi: 'barsi',
  'Janma tithi': 'janma-tithi',
  'Amrit Siddhi': 'amrit-siddhi',
  'Sarvartha Siddhi': 'sarvartha-siddhi',
  'Ravi Pushya': 'ravi-pushya',
  'Guru Pushya': 'guru-pushya',
  Tripushkar: 'tripushkar',
  Dwipushkar: 'dwipushkar',
  'Ravi Yoga': 'ravi-yoga',
  Kundli: 'kundli',
  Lagna: 'lagna',
  Rashi: 'rashi',
  Bhava: 'bhava',
  Chalit: 'bhava-chalit',
  Navamsa: 'navamsa',
  Vargottama: 'vargottama',
  Ayanamsa: 'ayanamsa',
  Lahiri: 'lahiri',
  Dasha: 'dasha',
  Vimshottari: 'vimshottari',
  Mahadasha: 'mahadasha',
  Antardasha: 'antardasha',
  Pratyantar: 'pratyantar-dasha',
  'Sade Sati': 'sade-sati',
  Dhaiya: 'dhaiya',
  Kantaka: 'dhaiya',
  Ashtama: 'dhaiya',
  'Chandra bala': 'chandra-bala',
  Chandrashtama: 'chandrashtama',
  'Tara bala': 'tara-bala',
  Janma: 'janma-tara',
  Sampat: 'sampat',
  Vipat: 'vipat',
  Kshema: 'kshema',
  Pratyak: 'pratyari',
  Sadhana: 'sadhaka',
  Naidhana: 'vadha',
  Mitra: 'mitra-tara',
  Parashara: 'parashara',
  Jayanti: 'jayanti',
  Puja: 'puja',
  'Akshaya Tritiya': 'akshaya-tritiya',
  swakshetra: 'swakshetra',
};

describe('glossary/en.json', () => {
  const { items, fallback } = loadGlossary('en');
  const ids = new Set(items.map((g) => g.id));
  const byLat = new Map(items.map((g) => [slugOf(g.term_lat), g.id]));
  const resolves = (term: string): boolean => ids.has(slugOf(term)) || byLat.has(slugOf(term));

  it('has >= 150 unique terms, each with a Devanagari headword, a Latin transliteration and a one-line meaning (<= 160 chars)', () => {
    expect(fallback).toBe(false);
    expect(items.length).toBeGreaterThanOrEqual(150);
    expect(ids.size).toBe(items.length);
    const bad: string[] = [];
    for (const g of items) {
      if (!isDevanagariDominant(g.term_dev, 0.9)) bad.push(`${g.id}: term_dev not Devanagari ${JSON.stringify(scriptCounts(g.term_dev))}`);
      if (scriptCounts(g.term_lat).devanagari > 0) bad.push(`${g.id}: term_lat contains Devanagari`);
      if (Array.from(g.meaning).length > 160) bad.push(`${g.id}: meaning ${Array.from(g.meaning).length} chars`);
      if (/\n/.test(g.meaning)) bad.push(`${g.id}: meaning is not one line`);
    }
    expect(bad, bad.join('\n')).toEqual([]);
  });

  it('every related id resolves to another glossary entry', () => {
    const bad: string[] = [];
    for (const g of items) for (const r of g.related ?? []) if (!ids.has(r)) bad.push(`${g.id} -> ${r}`);
    expect(bad, bad.join('\n')).toEqual([]);
  });

  it('covers every engine name: 12 signs, 9 planets, 27 nakshatras, 15 tithi names + Amavasya, 12 lunar months', () => {
    const missing: string[] = [];
    for (const s of signNames.en) if (!resolves(s)) missing.push(`sign ${s}`);
    for (const p of PLANET_IDS) if (!ids.has(planetNames.en[p].toLowerCase())) missing.push(`planet ${planetNames.en[p]}`);
    for (const n of nakshatraNames.en) if (!resolves(n)) missing.push(`nakshatra ${n}`);
    for (const t of new Set(tithiNames.en)) if (!resolves(t)) missing.push(`tithi ${t}`);
    for (const m of lunarMonthNames.en) if (!resolves(m) && !ids.has(`${m.toLowerCase()}-month`)) missing.push(`month ${m}`);
    expect(missing, missing.join('\n')).toEqual([]);
  });

  it('covers every glossary-linked term the UI strings and the rules corpus use', () => {
    const ui = Object.values(loadUi('en')).join('\n');
    const rules = loadCorpus('rules', 'en').snippets.map((s) => s.text).join('\n');
    const haystack = `${ui}\n${rules}`;
    const notUsed: string[] = [];
    const notCovered: string[] = [];
    for (const [term, id] of Object.entries(LINKED_TERMS)) {
      if (!new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i').test(haystack)) notUsed.push(term);
      if (!ids.has(id)) notCovered.push(`${term} -> ${id}`);
    }
    expect(notUsed, `terms listed but not used in ui/en.json or rules/en.json:\n${notUsed.join('\n')}`).toEqual([]);
    expect(notCovered, `terms used but missing from the glossary:\n${notCovered.join('\n')}`).toEqual([]);
  });

  it('glossaryTerm() resolves ids with the English fallback flagged for other languages when no file exists', () => {
    expect(glossaryTerm('rahu-kaal', 'en')?.item.term_dev).toBe('राहु काल');
    expect(glossaryTerm('nope', 'en')).toBeNull();
    const bho = glossaryTerm('tithi', 'bho');
    expect(bho?.item.id).toBe('tithi');
    if (bho?.lang === 'en') expect(bho.fallback).toBe(true);
  });
});
