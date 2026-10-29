// Register and forbidden-content checks over every UI string and every corpus file (spec 7, build-rules corpus rules).
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEVANAGARI_MIN_RATIO, forbiddenHits, hasPercentClaim, isDevanagariDominant, maithiliHits, scriptCounts } from '../../content-tools/src/forbidden';
import { loadUi } from '../src/index';

const ROOT = resolve(__dirname, '..');
type Lang = 'en' | 'hi' | 'bho';

/** Domains whose `rule` field is translated prose. In snippet domains `rule` is metadata (an engine rule id or the English rule sentence) copied byte-for-byte into hi/bho files, so it is scanned only in English. */
const RULE_IS_PROSE = new Set(['festivals']);

function corpusTexts(lang: Lang): { file: string; id: string; text: string }[] {
  const out: { file: string; id: string; text: string }[] = [];
  const corpusDir = resolve(ROOT, 'corpus');
  for (const domain of readdirSync(corpusDir)) {
    const p = resolve(corpusDir, domain, `${lang}.json`);
    try {
      const rows = JSON.parse(readFileSync(p, 'utf8')) as Record<string, unknown>[];
      for (const r of rows) {
        for (const field of ['text', 'what', 'rule', 'meaning', 'conventionNote']) {
          if (field === 'rule' && lang !== 'en' && !RULE_IS_PROSE.has(domain)) continue;
          if (typeof r[field] === 'string') out.push({ file: `${domain}/${lang}.json`, id: `${r.id}.${field}`, text: r[field] as string });
        }
        if (Array.isArray(r.body)) (r.body as string[]).forEach((para, i) => out.push({ file: `${domain}/${lang}.json`, id: `${r.id}.body[${i}]`, text: para }));
      }
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
    }
  }
  return out;
}

/** Keys whose Latin content is the product's own name or a code (not translatable text). */
const LATIN_OK_KEYS = new Set(['settings.lang.en', 'charts.retroMark', 'charts.degree', 'common.range', 'common.pro', 'dasha.pro_tag', 'share.footerUrl', 'backup.fileName']);

describe('register: Hindi and Bhojpuri UI strings are Devanagari-dominant', () => {
  for (const lang of ['hi', 'bho'] as const) {
    it(`${lang}: every string is Devanagari apart from allow-listed technical terms`, () => {
      const bad: string[] = [];
      for (const [k, v] of Object.entries(loadUi(lang))) {
        if (LATIN_OK_KEYS.has(k)) continue;
        if (!isDevanagariDominant(v, DEVANAGARI_MIN_RATIO[lang])) bad.push(`${k}: ${JSON.stringify(scriptCounts(v))} "${v}"`);
      }
      expect(bad, bad.join('\n')).toEqual([]);
    });
  }

  it('bho uses the respectful register (रउआ/राउर) and never Hindi आप/आपका or Maithili forms', () => {
    const bho = loadUi('bho');
    const hindiPronoun = Object.entries(bho).filter(([, v]) => /(^|[\s,.;:!?()“”"'-])(आप|आपका|आपकी|आपके|आपको)(?=$|[\s,.;:!?()“”"'-])/u.test(v));
    expect(hindiPronoun.map(([k]) => k), 'Hindi pronoun in Bhojpuri').toEqual([]);
    const maithili = Object.entries(bho).filter(([, v]) => maithiliHits(v).length > 0);
    expect(maithili.map(([k, v]) => `${k}: ${maithiliHits(v).join(',')}`), 'Maithili forms in Bhojpuri').toEqual([]);
    expect(bho['today.yourMoon']).toMatch(/राउर/);
    expect(bho['onboarding.intentTitle']).toMatch(/रउआ/);
    expect(bho['verdict.avoid']).toBe('बचीं');
    const hindiVerbs = Object.entries(bho).filter(([, v]) => /(^|\s)(है|हैं|करें|देखें|खोलें)(?=$|[\s,.;:!?()।])/u.test(v));
    expect(hindiVerbs.map(([k]) => k), 'Hindi verb forms in Bhojpuri').toEqual([]);
  });

  it('hi uses the respectful आप register (no तू/तुम)', () => {
    const hi = loadUi('hi');
    const informal = Object.entries(hi).filter(([, v]) => /(^|[\s,.;:!?()“”"'-])(तू|तुम|तुम्हारा|तुम्हारी|तेरा|तेरी)(?=$|[\s,.;:!?()“”"'-])/u.test(v));
    expect(informal.map(([k]) => k)).toEqual([]);
  });
});

describe('forbidden content', () => {
  for (const lang of ['en', 'hi', 'bho'] as const) {
    it(`${lang}: no forbidden phrase and no percentage claim in UI strings`, () => {
      const bad: string[] = [];
      for (const [k, v] of Object.entries(loadUi(lang))) {
        const hits = forbiddenHits(v, lang);
        if (hits.length) bad.push(`${k}: ${hits.join(', ')}`);
        if (hasPercentClaim(v)) bad.push(`${k}: percentage claim "${v}"`);
      }
      expect(bad, bad.join('\n')).toEqual([]);
    });

    it(`${lang}: no forbidden phrase and no percentage claim in corpus files`, () => {
      const bad: string[] = [];
      for (const { file, id, text } of corpusTexts(lang)) {
        const hits = forbiddenHits(text, lang);
        if (hits.length) bad.push(`${file} ${id}: ${hits.join(', ')}`);
        if (hasPercentClaim(text)) bad.push(`${file} ${id}: percentage claim`);
        if (lang !== 'en' && !isDevanagariDominant(text, DEVANAGARI_MIN_RATIO[lang])) bad.push(`${file} ${id}: not Devanagari-dominant`);
        if (lang === 'bho' && maithiliHits(text).length) bad.push(`${file} ${id}: Maithili ${maithiliHits(text).join(',')}`);
      }
      expect(bad, bad.join('\n')).toEqual([]);
    });
  }

  it('the checker itself catches the classes of claim it exists for', () => {
    expect(forbiddenHits('This is guaranteed to bring success', 'en')).toContain('guaranteed to');
    expect(forbiddenHits('No outcome is guaranteed.', 'en')).toEqual([]);
    expect(forbiddenHits('Wear a gemstone to fix it', 'en')).toContain('wear a gemstone');
    expect(forbiddenHits('यह उपाय करें और रत्न धारण करें', 'hi')).toEqual(expect.arrayContaining(['रत्न धारण', 'उपाय करें']));
    expect(hasPercentClaim('95% accurate')).toBe(true);
    expect(hasPercentClaim('8/10 rules met')).toBe(false);
    expect(maithiliHits('हम जाइत छी')).toContain('छी');
    expect(maithiliHits('हम जात बानी')).toEqual([]);
  });
});
