// Interpretive corpus domains (plan.md A06+): per-domain counts >= spec section 7, ids derived from the engine id tables,
// 40-90 words of English per snippet, review draft, every snippet names its rule and has a source (design.md 4 and 6).
import { describe, expect, it } from 'vitest';
import { PLANET_IDS, planetNames, signNames, SIGN_LORDS } from '../../engine/src/locale/index';
import { naturalRelation, signDignity, type DignityTag } from '../../engine/src/kundli/index';
import { loadCorpus, lookup } from '../src/index';
import { ruleIdOfKey, RULE_PARAMS, DAILY_FRAGMENT_KEYS, DASHA_PAIR_KEYS, SADE_SATI_KEYS, DAY_STRENGTH_KEYS, TARA_KEYS } from '../../engine/src/rules/daily';
import { nakshatraNames, tithiNames, weekdayNames } from '../../engine/src/locale/index';
import { NAKSHATRA_LORDS, SPECIAL_YOGA_FRAGMENT_KEYS } from '../../engine/src/panchang/panchang';
import { paramsOf } from '../src/t';

/** Word bounds per domain (spec 7 "40-90 words" for A06; later clusters add their domains here). */
const WORD_BOUNDS: Record<string, [number, number]> = {
  'planet-sign': [40, 90],
  'planet-house': [40, 90],
  dignity: [40, 90],
  // A07 (FEAT steps): lagna 60-90, nakshatra x pada 40-70, transit readings 30-90, daily fragments one to two sentences.
  lagna: [60, 90],
  'nakshatra-pada': [40, 70],
  transit: [30, 90],
  daily: [8, 60],
};

/** Minimum snippet counts per domain (spec section 7 volumes; FEAT-A06 / FEAT-A07 acceptance). */
const MIN_COUNTS: Record<string, number> = {
  'planet-sign': 108,
  'planet-house': 108,
  dignity: 12,
  lagna: 12,
  'nakshatra-pada': 108,
  'dasha-pairs': 90,
  transit: 39,
  daily: 95,
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

  // ---- A07: lagna, nakshatra x pada, dasha pairs, transits, daily fragments ----

  it('lagna ids are exactly lagna-<sign> for the 12 signs; each rule names the sign and its 1st-house lord', () => {
    const { snippets } = loadCorpus('lagna', 'en');
    expect(snippets.map((s) => s.id).sort()).toEqual([...Array.from({ length: 12 }, (_, i) => `lagna-${signKey(i + 1)}`)].sort());
    for (let sign = 1; sign <= 12; sign++) {
      const s = lookup('lagna', `lagna-${signKey(sign)}`, 'en')!;
      const lord = planetNames.en[SIGN_LORDS[sign - 1]];
      expect(s.snippet.rule).toContain(signNames.en[sign - 1]);
      expect(s.snippet.rule).toContain(lord);
      expect(s.text).toContain(signNames.en[sign - 1]);
      expect(s.text).toContain(lord);
    }
  });

  it('nakshatra-pada ids are exactly nakshatra-<1..27>-<1..4>; each names the nakshatra, its Vimshottari lord and the pada navamsa sign', () => {
    const { snippets } = loadCorpus('nakshatra-pada', 'en');
    const expected: string[] = [];
    for (let n = 1; n <= 27; n++) for (let p = 1; p <= 4; p++) expected.push(`nakshatra-${n}-${p}`);
    expect(snippets.map((s) => s.id).sort()).toEqual([...expected].sort());
    for (let n = 1; n <= 27; n++) {
      for (let p = 1; p <= 4; p++) {
        const s = lookup('nakshatra-pada', `nakshatra-${n}-${p}`, 'en')!;
        const lord = planetNames.en[NAKSHATRA_LORDS[n - 1]];
        // Navamsa of a pada: the 108 padas map onto the 12 navamsa signs in order from Mesha (pada 1 of Ashwini).
        const navamsa = signNames.en[((n - 1) * 4 + (p - 1)) % 12];
        expect(s.snippet.rule, s.snippet.id).toContain(nakshatraNames.en[n - 1]);
        expect(s.snippet.rule, s.snippet.id).toContain(lord);
        expect(s.snippet.rule, s.snippet.id).toContain(navamsa);
        expect(s.text, s.snippet.id).toContain(nakshatraNames.en[n - 1]);
        expect(s.text, s.snippet.id).toContain(lord);
        expect(s.text, s.snippet.id).toContain(`${navamsa} navamsa`);
        // No naamkaran syllables here (B02 owns them).
        expect(s.text, s.snippet.id).not.toMatch(/syllable|naamkaran/i);
      }
    }
  });

  it('dasha-pairs: 9 dasha-maha-<lord> + the 81 engine DASHA_PAIR_KEYS; each antar text states the Parashara relation of antar lord to maha lord', () => {
    const { snippets } = loadCorpus('dasha-pairs', 'en');
    const mahaIds = PLANET_IDS.map((p) => `dasha-maha-${p}`);
    expect(snippets.map((s) => s.id).sort()).toEqual([...mahaIds, ...DASHA_PAIR_KEYS].sort());
    expect(snippets.length).toBe(90);
    const REL_WORDS: Record<string, RegExp> = {
      self: /the same planet by nature as/,
      friend: /a natural friend of/,
      neutral: /neutral to/,
      enemy: /a natural enemy of/,
    };
    for (const p of PLANET_IDS) {
      const m = lookup('dasha-pairs', `dasha-maha-${p}`, 'en')!;
      expect(words(m.text), m.snippet.id).toBeGreaterThanOrEqual(50);
      expect(words(m.text), m.snippet.id).toBeLessThanOrEqual(80);
      expect(m.text).toContain(`${planetNames.en[p]} mahadasha`);
      expect(m.text, `${m.snippet.id} does not say what it is read for`).toMatch(/is read for/);
      for (const a of PLANET_IDS) {
        const s = lookup('dasha-pairs', `dasha-${p}-${a}`, 'en')!;
        expect(words(s.text), s.snippet.id).toBeGreaterThanOrEqual(30);
        expect(words(s.text), s.snippet.id).toBeLessThanOrEqual(60);
        expect(s.text).toContain(`${planetNames.en[a]} antardasha`);
        expect(s.text).toContain(`${planetNames.en[p]} mahadasha`);
        expect(s.text, `${s.snippet.id} relation`).toMatch(REL_WORDS[naturalRelation(a, p)]);
        expect(s.snippet.rule, `${s.snippet.id} rule relation`).toMatch(REL_WORDS[naturalRelation(a, p)]);
      }
    }
  });

  it('transit ids are transit-<saturn|jupiter|rahu>-<1..12> + sade-sati-phase-1..3; each names the house from the Moon and its classical basis', () => {
    const { snippets } = loadCorpus('transit', 'en');
    const expected: string[] = ['sade-sati-phase-1', 'sade-sati-phase-2', 'sade-sati-phase-3'];
    for (const p of ['saturn', 'jupiter', 'rahu']) for (let h = 1; h <= 12; h++) expected.push(`transit-${p}-${h}`);
    expect(snippets.map((s) => s.id).sort()).toEqual(expected.sort());
    const ordinal = (h: number): string => `${h}${h === 1 ? 'st' : h === 2 ? 'nd' : h === 3 ? 'rd' : 'th'} sign from`;
    for (const [p, name] of [['saturn', 'Saturn'], ['jupiter', 'Jupiter'], ['rahu', 'Rahu']] as const) {
      for (let h = 1; h <= 12; h++) {
        const s = lookup('transit', `transit-${p}-${h}`, 'en')!;
        expect(s.text, s.snippet.id).toContain(name);
        expect(s.text, s.snippet.id).toContain(ordinal(h));
        expect(s.snippet.rule, s.snippet.id).toContain(ordinal(h));
        expect(s.snippet.source, s.snippet.id).toMatch(/Phaladeepika|convention/);
      }
    }
    // The three phases are Saturn in the 12th / 1st / 2nd from the Moon (BPHS).
    expect(lookup('transit', 'sade-sati-phase-1', 'en')!.text).toMatch(/12th sign from the natal Moon/);
    expect(lookup('transit', 'sade-sati-phase-2', 'en')!.text).toMatch(/sign of the natal Moon itself/);
    expect(lookup('transit', 'sade-sati-phase-3', 'en')!.text).toMatch(/2nd sign from the natal Moon/);
  });

  it('daily: exactly one fragment per engine DAILY_FRAGMENT_KEYS entry (>= 95), one to two sentences each', () => {
    const { snippets } = loadCorpus('daily', 'en');
    expect(snippets.map((s) => s.id).sort()).toEqual([...DAILY_FRAGMENT_KEYS].sort());
    expect(DAILY_FRAGMENT_KEYS.length).toBeGreaterThanOrEqual(95);
    // Spec section 7 categories: Tara bala 9, Chandra bala 12, tithi 30, nakshatra 27, vara 7, special yogas >= 10.
    const count = (re: RegExp) => snippets.filter((s) => re.test(s.id)).length;
    expect(count(/^tara-bala-\d$/)).toBe(9);
    expect(count(/^chandra-bala-\d+$/)).toBe(12);
    expect(count(/^tithi-\d+$/)).toBe(30);
    expect(count(/^nakshatra-\d+$/)).toBe(27);
    expect(count(/^vara-\d$/)).toBe(7);
    const special = snippets.filter((s) => SPECIAL_YOGA_FRAGMENT_KEYS.includes(s.id) || /^bhadra-|^panchak$/.test(s.id)).length;
    expect(special).toBeGreaterThanOrEqual(10);
    expect(snippets.filter((s) => SADE_SATI_KEYS.includes(s.id)).length).toBe(6);
    expect(snippets.filter((s) => DAY_STRENGTH_KEYS.includes(s.id)).length).toBe(3);
    for (const s of snippets) {
      const sentences = s.text.split(/(?<=[.!?])\s+(?=[A-Z{])/).filter(Boolean).length;
      expect(sentences, `${s.id}: ${sentences} sentences`).toBeLessThanOrEqual(2);
    }
  });

  it('daily: every fragment\'s params set equals the engine RULE_PARAMS of its ruleId, and its {placeholders} are all declared', () => {
    const { snippets } = loadCorpus('daily', 'en');
    for (const s of snippets) {
      const ruleId = ruleIdOfKey(s.id);
      expect(ruleId, `${s.id} is not a key any daily rule emits`).not.toBeNull();
      expect(s.params, `${s.id} params`).toEqual([...RULE_PARAMS[ruleId!]]);
      for (const p of paramsOf(s.text)) expect(RULE_PARAMS[ruleId!], `${s.id} interpolates undeclared {${p}}`).toContain(p);
    }
    // The dasha row's pair keys resolve in dasha-pairs with the same contract.
    for (const key of DASHA_PAIR_KEYS) {
      expect(ruleIdOfKey(key)).toBe('dasha-lords');
      for (const p of paramsOf(lookup('dasha-pairs', key, 'en')!.text)) expect(RULE_PARAMS['dasha-lords']).toContain(p);
    }
  });

  it('daily: Chandra bala, Tara bala, tithi, nakshatra and vara fragments name their input; Chandrashtama uses the design wording', () => {
    const GOOD = [1, 3, 6, 7, 10, 11];
    for (let h = 1; h <= 12; h++) {
      const s = lookup('daily', `chandra-bala-${h}`, 'en')!;
      expect(s.text).toMatch(new RegExp(`${h}(st|nd|rd|th) sign from your birth Moon`));
      if (h === 8) expect(s.text).toMatch(/Chandrashtama/);
      if (h === 8) expect(s.text).toMatch(/routine tasks today, new starts tomorrow/);
      expect(s.text, s.snippet.id).toMatch(GOOD.includes(h) ? /a favourable Chandra bala house/ : /not among the favourable|Chandrashtama/);
    }
    const TARA_NAMES = ['', 'Janma', 'Sampat', 'Vipat', 'Kshema', 'Pratyari', 'Sadhaka', 'Vadha', 'Mitra', 'Param Mitra'];
    for (let t = 1; t <= 9; t++) {
      const s = lookup('daily', `tara-bala-${t}`, 'en')!;
      expect(s.text, s.snippet.id).toContain(`${TARA_NAMES[t]} tara`);
      expect(s.snippet.rule, s.snippet.id).toContain(TARA_NAMES[t]);
      expect(TARA_KEYS[t]).toBeTruthy();
    }
    for (let t = 1; t <= 30; t++) expect(lookup('daily', `tithi-${t}`, 'en')!.text, `tithi-${t}`).toContain(tithiNames.en[t - 1]);
    for (let n = 1; n <= 27; n++) {
      const s = lookup('daily', `nakshatra-${n}`, 'en')!;
      expect(s.text, s.snippet.id).toContain(nakshatraNames.en[n - 1]);
      expect(s.text, s.snippet.id).toContain(planetNames.en[NAKSHATRA_LORDS[n - 1]]);
    }
    for (let v = 0; v <= 6; v++) expect(lookup('daily', `vara-${v}`, 'en')!.text).toContain(weekdayNames.en[v]);
    // Fear language never (FEAT-A07 step 6): 'avoid starting new work' is fine, danger/disaster are not.
    for (const s of loadCorpus('daily', 'en').snippets) expect(s.text, s.id).not.toMatch(/\b(danger|disaster|doom|death|evil|curse|inauspicious day)\b/i);
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
