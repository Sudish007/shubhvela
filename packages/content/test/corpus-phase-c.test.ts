// C02: lessons (spec F32: >= 20 five-minute lessons that use the reader's own chart), glossary cross-links (every
// lesson term resolves), the Prashna / Ask-my-chart rules entries (spec F18/F35), and the third-person daily fragments
// for Family Today (carry-over B-REVIEW-MEDIUM-2). Placeholders a lesson body uses must be in the schema's allowed
// set, which is mirrored by LESSON_PLACEHOLDERS so the app's resolver can be typed against it.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ASK_RULE_IDS, PRASHNA_RULE_IDS, PHASE_C_RULE_IDS, RULE_IDS, ruleParamsC } from '../../engine/src/rules/ruleIds';
import { DAILY_FRAGMENT_KEYS } from '../../engine/src/rules/daily';
import { LESSON_PLACEHOLDERS, lesson, lessonPlaceholders, loadCorpus, loadGlossary, loadLessons, loadUi, lookup, renderLesson, ruleText } from '../src/index';

const ROOT = resolve(__dirname, '..');
const words = (s: string): number => s.trim().split(/\s+/).filter(Boolean).length;

const TOPICS_IN_ORDER = [
  /kundli/i,
  /signs and houses/i,
  /moon.*nakshatra/i,
  /lagna.*approximate/i,
  /planets and dignities/i,
  /house lords/i,
  /panchang/i,
  /good-hours.*kaal/i,
  /choghadiya and hora/i,
  /tithi birthdays/i,
  /vrats.*festivals/i,
  /vimshottari dasha/i,
  /sade sati/i,
  /yogas/i,
  /divisional.*D9/i,
  /ashtakavarga/i,
  /KP/,
  /matching beyond the score/i,
  /muhurat rules/i,
  /why\?.*honesty/i,
  /how this app computes/i,
];

describe('lessons/en.json', () => {
  const { items, fallback } = loadLessons('en');
  const schema = JSON.parse(readFileSync(resolve(ROOT, 'schema', 'lesson.schema.json'), 'utf8')) as { placeholders: Record<string, string> };

  it('has >= 20 lessons, ids lesson-NN in order, 5 minutes each, review draft, in the spec topic order', () => {
    expect(fallback).toBe(false);
    expect(items.length).toBeGreaterThanOrEqual(20);
    items.forEach((l, i) => {
      expect(l.n, l.id).toBe(i + 1);
      expect(l.id).toBe(`lesson-${String(i + 1).padStart(2, '0')}`);
      expect(l.minutes, l.id).toBe(5);
      expect(l.review, l.id).toBe('draft');
    });
    TOPICS_IN_ORDER.forEach((re, i) => expect(items[i].title, `lesson ${i + 1} topic`).toMatch(re));
  });

  it('every body is 350-450 words (a five-minute read) in at least four paragraphs and ends with a "try it" paragraph', () => {
    const bad: string[] = [];
    for (const l of items) {
      const n = words(l.body.join(' '));
      if (n < 350 || n > 450) bad.push(`${l.id}: ${n} words`);
      if (l.body.length < 4) bad.push(`${l.id}: ${l.body.length} paragraphs`);
      if (!/\b(open|tap|find|go to|try)\b/i.test(l.body[l.body.length - 1])) bad.push(`${l.id}: last paragraph is not a try-it instruction`);
    }
    expect(bad, bad.join('\n')).toEqual([]);
  });

  it('LESSON_PLACEHOLDERS equals the schema placeholder list, and every {placeholder} in a body is in it', () => {
    expect([...LESSON_PLACEHOLDERS]).toEqual(Object.keys(schema.placeholders));
    const allowed = new Set<string>(LESSON_PLACEHOLDERS);
    const bad: string[] = [];
    let total = 0;
    for (const l of items) {
      const used = lessonPlaceholders(l);
      total += used.length;
      for (const p of used) if (!allowed.has(p)) bad.push(`${l.id}: {${p}}`);
      if (used.length === 0) bad.push(`${l.id}: uses no chart value (lessons use the reader's own chart as the example)`);
    }
    expect(bad, bad.join('\n')).toEqual([]);
    expect(total).toBeGreaterThan(40);
    // Every allowed placeholder is used by at least one lesson, so the app's resolver has no dead fields.
    const usedAnywhere = new Set(items.flatMap((l) => lessonPlaceholders(l)));
    const unused = LESSON_PLACEHOLDERS.filter((p) => !usedAnywhere.has(p));
    expect(unused, `placeholders declared but never used: ${unused.join(', ')}`).toEqual([]);
  });

  it('every tryIt route is an app route with a ui label key that exists in all three languages', () => {
    const en = loadUi('en');
    const hi = loadUi('hi');
    const bho = loadUi('bho');
    const bad: string[] = [];
    for (const l of items) {
      if (!l.tryIt.route.startsWith('/')) bad.push(`${l.id}: route ${l.tryIt.route}`);
      if (!/^\/(\(tabs\)\/(today|charts|family|learn)|charts\/|family\/|settings\/)/.test(l.tryIt.route)) bad.push(`${l.id}: route ${l.tryIt.route} is not under a known screen`);
      for (const [lang, ui] of [['en', en], ['hi', hi], ['bho', bho]] as const) if (!ui[l.tryIt.label]) bad.push(`${l.id}: label ${l.tryIt.label} missing in ${lang}`);
    }
    expect(bad, bad.join('\n')).toEqual([]);
  });

  it('unlocksLevel is 2 for the first half and 3 for the second, never anything commercial', () => {
    for (const l of items) {
      expect([2, 3], l.id).toContain(l.unlocksLevel);
      expect(l.unlocksLevel, l.id).toBe(l.n <= 12 ? 2 : 3);
      expect(JSON.stringify(l)).not.toMatch(/\b(pro|unlockFeature|ad|reward|price|buy)\b/);
    }
  });

  it('every lesson term resolves to a glossary id, and the glossary covers every Sanskrit term the lesson titles use', () => {
    const glossary = new Set(loadGlossary('en').items.map((g) => g.id));
    const bad: string[] = [];
    for (const l of items) for (const t of l.terms) if (!glossary.has(t)) bad.push(`${l.id} -> ${t}`);
    expect(bad, bad.join('\n')).toEqual([]);
    for (const [term, id] of [['kundli', 'kundli'], ['nakshatra', 'nakshatra'], ['lagna', 'lagna'], ['panchang', 'panchang'], ['choghadiya', 'choghadiya'], ['hora', 'hora'], ['vrat', 'vrat'], ['vimshottari', 'vimshottari'], ['sade sati', 'sade-sati'], ['yoga', 'jataka-yoga'], ['d9', 'navamsa'], ['ashtakavarga', 'ashtakavarga'], ['kp', 'kp'], ['muhurat', 'muhurat']]) {
      expect(items.some((l) => l.title.toLowerCase().includes(term)), `no lesson title mentions ${term}`).toBe(true);
      expect(glossary.has(id), `${term} -> ${id}`).toBe(true);
    }
  });

  it('lesson bodies name no forbidden claim and keep the honesty vocabulary', () => {
    for (const l of items) {
      const text = l.body.join(' ');
      expect(text, l.id).not.toMatch(/\b(will happen|guarantee|predict(s|ed)? that|accuracy|%)\b/i);
    }
    expect(lesson('lesson-13', 'en')!.item.body.join(' ')).toMatch(/sells nothing/i);
    expect(lesson('lesson-20', 'en')!.item.body.join(' ')).toContain('AI explanation from your chart');
  });

  it('renderLesson() fills placeholders and leaves unknown ones visible; lesson() walks the fallback chain', () => {
    const l = lesson('lesson-01', 'en')!.item;
    const out = renderLesson(l, { name: 'Priya', moonSign: 'Vrishchika', lagna: 'Kumbha', birthPlace: 'Lucknow' });
    expect(out.join(' ')).toContain('Priya, your Moon was in Vrishchika');
    expect(out.join(' ')).toContain('{moonSignLord}');
    const bho = lesson('lesson-01', 'bho');
    expect(bho?.item.id).toBe('lesson-01');
    if (bho?.lang === 'en') expect(bho.fallback).toBe(true);
    expect(lesson('lesson-99', 'en')).toBeNull();
  });
});

describe('rules/en.json Phase C entries (Prashna, Ask my chart)', () => {
  it('every PHASE_C_RULE_IDS id has a one-sentence rule with source and params = ruleParamsC', () => {
    expect(PRASHNA_RULE_IDS.length).toBe(3);
    expect(ASK_RULE_IDS.length).toBe(7);
    for (const id of PHASE_C_RULE_IDS) {
      expect(RULE_IDS).toContain(id);
      const r = ruleText(id, 'en');
      expect(r, id).not.toBeNull();
      expect(r!.snippet.source, id).toBeTruthy();
      expect(r!.snippet.params, id).toEqual([...ruleParamsC(id)!]);
    }
  });

  it('the Ask-my-chart system rules say what spec F35 requires: explain from the chart, cite the rule, no outcome promises, no medical/legal/financial advice', () => {
    const text = (id: string): string => ruleText(id, 'en')!.text;
    expect(text('ask-system-explain-from-chart')).toMatch(/only from the computed chart/i);
    expect(text('ask-system-cite-rule')).toMatch(/cite the id of a rule/i);
    expect(text('ask-system-no-outcome-promises')).toMatch(/never promise/i);
    expect(text('ask-system-no-medical-legal-financial')).toMatch(/medical, legal or financial/i);
    expect(text('ask-system-no-medical-legal-financial')).toMatch(/no gemstone, puja/i);
    expect(text('ask-label')).toContain('AI explanation from your chart, can be wrong');
    expect(text('prashna-question-private')).toMatch(/never sent anywhere/i);
    expect(text('prashna-chart-of-the-moment')).toMatch(/instant the question is asked/i);
  });
});

describe('daily-third/en.json (Family Today third-person variants)', () => {
  it('covers exactly the daily fragments that address the reader, same ids, params = [name, ...daily params], no second person', () => {
    const daily = loadCorpus('daily', 'en').snippets;
    const third = loadCorpus('daily-third', 'en').snippets;
    const secondPerson = daily.filter((s) => /\b(you|your|yours|yourself)\b/i.test(s.text)).map((s) => s.id).sort();
    expect(third.map((s) => s.id).sort()).toEqual(secondPerson);
    expect(third.length).toBeGreaterThanOrEqual(30);
    for (const s of third) {
      const d = daily.find((x) => x.id === s.id)!;
      expect(DAILY_FRAGMENT_KEYS).toContain(s.id);
      expect(s.rule).toBe(d.rule);
      expect(s.source).toBe(d.source);
      expect(s.params).toEqual(['name', ...(d.params ?? [])]);
      expect(s.text, s.id).toContain('{name}');
      expect(s.text, s.id).not.toMatch(/\b(you|your|yours|yourself)\b/i);
    }
    const r = lookup('daily-third', 'chandra-bala-8', 'bho');
    expect(r?.text).toContain("{name}'s birth Moon");
    expect(r?.fallback).toBe(true);
  });
});
