// Interpretive corpus domains (plan.md A06+): per-domain counts >= spec section 7, ids derived from the engine id tables,
// 40-90 words of English per snippet, review draft, every snippet names its rule and has a source (design.md 4 and 6).
import { describe, expect, it } from 'vitest';
import { PLANET_IDS, planetNames, signNames } from '../../engine/src/locale/index';
import { signDignity, type DignityTag } from '../../engine/src/kundli/index';
import { loadCorpus, lookup } from '../src/index';

/** Word bounds per domain (spec 7 "40-90 words" for A06; later clusters add their domains here). */
const WORD_BOUNDS: Record<string, [number, number]> = {
  'planet-sign': [40, 90],
  'planet-house': [40, 90],
  dignity: [40, 90],
};

/** Minimum snippet counts per domain (spec section 7 volumes; FEAT-A06 acceptance). */
const MIN_COUNTS: Record<string, number> = {
  'planet-sign': 108,
  'planet-house': 108,
  dignity: 12,
};

const words = (s: string): number => s.trim().split(/\s+/).filter(Boolean).length;

/** Snippet id fragment for a planet: lowercase English name from the engine locale table (Su -> "sun"). */
const planetKey = (id: (typeof PLANET_IDS)[number]): string => planetNames.en[id].toLowerCase();
/** Snippet id fragment for a sign (1-12): lowercase English name from the engine locale table (1 -> "mesha"). */
const signKey = (sign: number): string => signNames.en[sign - 1].toLowerCase();

const DIGNITY_TAGS: DignityTag[] = ['exalted', 'debilitated', 'own', 'friend', 'enemy', 'neutral', 'combust', 'retro', 'vargottama'];
const EXTRA_DIGNITY_IDS = ['approx-lagna', 'approx-planet', 'moon-chart-mode', 'house-lord', 'sign-lord'];

describe('interpretive corpus: counts, ids and word bounds', () => {
  for (const [domain, min] of Object.entries(MIN_COUNTS)) {
    it(`${domain}/en.json has at least ${min} snippets, all level 1 draft with a rule and a source`, () => {
      const { snippets, fallback } = loadCorpus(domain, 'en');
      expect(fallback).toBe(false);
      expect(snippets.length).toBeGreaterThanOrEqual(min);
      for (const s of snippets) {
        expect(s.level, `${domain}/${s.id} level`).toBe(1);
        expect(s.review, `${domain}/${s.id} review`).toBe('draft');
        expect(s.rule.trim().length, `${domain}/${s.id} names no rule`).toBeGreaterThan(8);
        expect(s.source, `${domain}/${s.id} has no source`).toBeTruthy();
      }
    });
  }

  for (const [domain, [lo, hi]] of Object.entries(WORD_BOUNDS)) {
    it(`${domain}/en.json: every text is ${lo}-${hi} words`, () => {
      const bad = loadCorpus(domain, 'en')
        .snippets.map((s) => ({ id: s.id, n: words(s.text) }))
        .filter(({ n }) => n < lo || n > hi)
        .map(({ id, n }) => `${id}: ${n} words`);
      expect(bad, bad.join('\n')).toEqual([]);
    });
  }

  it('planet-sign ids are exactly <planet>-<sign> for the 9 engine planets x 12 signs, and each rule names both', () => {
    const { snippets } = loadCorpus('planet-sign', 'en');
    const expected: string[] = [];
    for (const p of PLANET_IDS) for (let sign = 1; sign <= 12; sign++) expected.push(`${planetKey(p)}-${signKey(sign)}`);
    expect(snippets.map((s) => s.id).sort()).toEqual([...expected].sort());
    expect(snippets.length).toBe(108);
    for (const p of PLANET_IDS) {
      for (let sign = 1; sign <= 12; sign++) {
        const s = lookup('planet-sign', `${planetKey(p)}-${signKey(sign)}`, 'en');
        expect(s, `${planetKey(p)}-${signKey(sign)} missing`).not.toBeNull();
        expect(s!.snippet.rule).toContain(planetNames.en[p]);
        expect(s!.snippet.rule).toContain(signNames.en[sign - 1]);
        expect(s!.text).toContain(planetNames.en[p]);
        expect(s!.text).toContain(signNames.en[sign - 1]);
      }
    }
  });

  it('planet-house ids are exactly <planet>-<house> for 9 planets x 12 houses, and each rule names the planet and the house', () => {
    const { snippets } = loadCorpus('planet-house', 'en');
    const expected: string[] = [];
    for (const p of PLANET_IDS) for (let h = 1; h <= 12; h++) expected.push(`${planetKey(p)}-${h}`);
    expect(snippets.map((s) => s.id).sort()).toEqual([...expected].sort());
    expect(snippets.length).toBe(108);
    const ordinal = (h: number): string => `${h}${h === 1 ? 'st' : h === 2 ? 'nd' : h === 3 ? 'rd' : 'th'} house`;
    for (const p of PLANET_IDS) {
      for (let h = 1; h <= 12; h++) {
        const s = lookup('planet-house', `${planetKey(p)}-${h}`, 'en');
        expect(s, `${planetKey(p)}-${h} missing`).not.toBeNull();
        expect(s!.snippet.rule).toContain(planetNames.en[p]);
        expect(s!.snippet.rule).toContain(ordinal(h));
        expect(s!.text).toContain(ordinal(h));
        // Every house reading says what the placement is read for (FEAT-A06 step 3).
        expect(s!.text, `${planetKey(p)}-${h} does not say what it is read for`).toMatch(/is read for/);
      }
    }
  });

  it('dignity ids cover every engine DignityTag plus the approx, Moon-chart, house-lord and sign-lord explanations', () => {
    const ids = new Set(loadCorpus('dignity', 'en').snippets.map((s) => s.id));
    for (const tag of DIGNITY_TAGS) expect(ids.has(tag), `dignity/${tag} missing`).toBe(true);
    for (const id of EXTRA_DIGNITY_IDS) expect(ids.has(id), `dignity/${id} missing`).toBe(true);
    // The combust explanation carries the orb rule (design.md 4: orbs listed under "How this was computed").
    const combust = lookup('dignity', 'combust', 'en')!;
    for (const orb of ['12°', '17°', '14°', '11°', '10°', '15°']) expect(combust.text).toContain(orb);
    expect(lookup('dignity', 'vargottama', 'en')!.text).toMatch(/D1/);
    expect(lookup('dignity', 'vargottama', 'en')!.text).toMatch(/D9|Navamsa/);
  });

  it('every planet-sign text states the dignity the engine assigns (design.md 4 vocabulary), and nodes carry none', () => {
    const DIGNITY_WORDS: Record<string, RegExp> = {
      exalted: /exaltation|exalted/,
      debilitated: /debilitat/,
      own: /own sign/,
      friend: /friend's sign/,
      enemy: /enemy sign|enemy's sign/,
      neutral: /neutral/,
    };
    for (const p of PLANET_IDS) {
      for (let sign = 1; sign <= 12; sign++) {
        const s = lookup('planet-sign', `${planetKey(p)}-${signKey(sign)}`, 'en')!;
        const d = signDignity(p, sign);
        if (!d) {
          expect(s.snippet.rule, `${s.snippet.id} node rule`).toMatch(/no dignity tag/);
        } else {
          expect(s.text, `${s.snippet.id} should mention ${d}`).toMatch(DIGNITY_WORDS[d]);
        }
      }
    }
  });

  it('reflective register: no snippet promises an outcome (no "will" predictions, no "you will")', () => {
    const bad: string[] = [];
    for (const domain of Object.keys(MIN_COUNTS)) {
      for (const s of loadCorpus(domain, 'en').snippets) {
        if (/\byou will\b|\bwill (bring|give|cause|make you|lead to|result in)\b|\bis certain\b|\bdestined\b/i.test(s.text)) bad.push(`${domain}/${s.id}`);
      }
    }
    expect(bad, bad.join('\n')).toEqual([]);
  });
});
