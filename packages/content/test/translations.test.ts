// Parity of the agent-written Hindi / Bhojpuri corpus files with their English masters (owner decision 2026-10-29,
// PRD .agents/tasks/corpus-translate/prd.json). Data-driven over the registry: every hi/bho table that is registered is
// checked record by record; a domain without a translation file contributes nothing here (fallback.test.ts covers the
// chain). Contract per translated record: same id, every non-text field byte-identical to en.json, the same {placeholders}
// and paragraph breaks, Latin digits only, no Latin-script words apart from the allow-listed product names, and the
// resolvers return it in its own language with fallback: false.
import { describe, expect, it } from 'vitest';
import { LATIN_ALLOWLIST } from '../../content-tools/src/forbidden';
import { CORPUS, FESTIVALS, GLOSSARY, LESSONS } from '../src/registry';
import { festivalText, glossaryTerm, loadUi, lookup, lesson, ruleText, type ContentLanguage } from '../src/index';

type Row = Record<string, unknown> & { id: string };
type Lang = Exclude<ContentLanguage, 'en'>;
const LANGS: readonly Lang[] = ['hi', 'bho'];

/** Fields translated per domain (same contract as packages/content-tools FIELDS_BY_DOMAIN); everything else is copied from en.json. */
const TEXT_FIELDS: Record<string, string[]> = {
  festivals: ['name', 'what', 'rule', 'conventionNote'],
  lessons: ['title', 'body'],
  glossary: ['meaning'],
};
const textFields = (domain: string): string[] => TEXT_FIELDS[domain] ?? ['text'];

/** Latin tokens a Devanagari text may contain: product / technical names (content-tools allow-list) plus proper nouns settled in the termbank (A/B = match profiles, A–D = KP significator grades, as the UI shows them). */
const LATIN_OK = new Set<string>([...LATIN_ALLOWLIST, 'Readers', 'UTC', 'GMT', 'A', 'B', 'C', 'D']);
const PARAM_RE = /\{([a-zA-Z0-9_]+)\}/g;
const params = (s: string): string => Array.from(s.matchAll(PARAM_RE), (m) => m[1]).sort().join(',');
const latinWords = (s: string): string[] =>
  Array.from(s.replace(PARAM_RE, ' ').matchAll(/[A-Za-z][A-Za-z0-9.'’-]*/g), (m) => m[0].replace(/[.'’-]+$/, '')).filter((t) => t && !LATIN_OK.has(t));

interface Table {
  domain: string;
  rows: Partial<Record<ContentLanguage, Row[]>>;
  resolve: (id: string, lang: ContentLanguage) => { lang: ContentLanguage; fallback: boolean } | null;
}

const TABLES: Table[] = [
  ...Object.entries(CORPUS).map(([domain, rows]) => ({ domain, rows: rows as Partial<Record<ContentLanguage, Row[]>>, resolve: (id: string, lang: ContentLanguage) => lookup(domain, id, lang) })),
  { domain: 'festivals', rows: FESTIVALS as Partial<Record<ContentLanguage, Row[]>>, resolve: (id, lang) => festivalText(id.replace(/^festival-/, ''), lang) },
  { domain: 'glossary', rows: GLOSSARY as Partial<Record<ContentLanguage, Row[]>>, resolve: (id, lang) => glossaryTerm(id, lang) },
  { domain: 'lessons', rows: LESSONS as Partial<Record<ContentLanguage, Row[]>>, resolve: (id, lang) => lesson(id, lang) },
];

function checkString(where: string, en: string, tr: string, bad: string[]): void {
  if (tr.trim() === '') bad.push(`${where}: empty`);
  if (tr === en) bad.push(`${where}: identical to English`);
  if (params(en) !== params(tr)) bad.push(`${where}: placeholders {${params(tr)}} differ from en {${params(en)}}`);
  if ((en.match(/\n/g) ?? []).length !== (tr.match(/\n/g) ?? []).length) bad.push(`${where}: paragraph breaks differ`);
  if (/[\u0966-\u096F]/.test(tr)) bad.push(`${where}: Devanagari digits`);
  const latin = latinWords(tr);
  if (latin.length) bad.push(`${where}: Latin words ${[...new Set(latin)].join(' ')}`);
}

/** Domains the app renders as a whole list from one file (GlossaryList, the Learn tab): a translation file is registered only when it covers every English id, otherwise the hi/bho list would shrink to the translated subset. Snippet domains and festivals are read per id and may be integrated slice by slice. */
const WHOLE_FILE_DOMAINS = new Set(['glossary', 'lessons']);

describe('translated corpus files (hi / bho) mirror their English master', () => {
  it('T01: daily and daily-third are complete in hi and bho and resolve in the requested language with fallback false', () => {
    for (const domain of ['daily', 'daily-third']) {
      const en = CORPUS[domain].en!;
      for (const lang of LANGS) {
        const rows = CORPUS[domain][lang];
        expect(rows, `${domain}/${lang} registered`).toBeDefined();
        expect(rows!.map((r) => r.id).sort(), `${domain}/${lang} complete`).toEqual(en.map((r) => r.id).sort());
      }
    }
    const hi = lookup('daily', 'chandra-bala-8', 'hi')!;
    expect(hi.lang).toBe('hi');
    expect(hi.fallback).toBe(false);
    expect(hi.text).toContain('चंद्राष्टम');
    const bho = lookup('daily', 'chandra-bala-8', 'bho')!;
    expect(bho.lang).toBe('bho');
    expect(bho.fallback).toBe(false);
    expect(bho.text).toContain('राउर जनम-चंद्र');
    const third = lookup('daily-third', 'sade-sati-phase-2', 'bho')!;
    expect(third.lang).toBe('bho');
    expect(third.fallback).toBe(false);
    expect(third.text).toContain('{name}');
    expect(third.text).toContain('{since}');
    expect(third.text).toContain('{until}');
    expect(third.text).not.toMatch(/राउर|रउआ/);
  });

  it('T02: the rules slice is registered in hi and bho with one id set, ruleText resolves a translated id in its own language and an untranslated id along the chain', () => {
    const en = CORPUS.rules.en!;
    const hi = CORPUS.rules.hi!;
    const bho = CORPUS.rules.bho!;
    expect(hi.length).toBeGreaterThanOrEqual(159);
    expect(hi.length).toBeLessThanOrEqual(en.length);
    expect(bho.map((r) => r.id).sort(), 'rules hi and bho carry the same slice').toEqual(hi.map((r) => r.id).sort());
    // Festival rule sentences name the festival as the engine's own hi / bho table does (the reader sees both on one card).
    const diwaliHi = ruleText('festival-diwali', 'hi')!;
    expect(diwaliHi.lang).toBe('hi');
    expect(diwaliHi.fallback).toBe(false);
    expect(diwaliHi.text).toContain('दीपावली');
    const diwaliBho = ruleText('festival-diwali', 'bho')!;
    expect(diwaliBho.lang).toBe('bho');
    expect(diwaliBho.fallback).toBe(false);
    expect(diwaliBho.text).toContain('दियरी');
    expect(diwaliBho.text).toContain('कातिक कृष्ण अमावस्या');
    // The Ask-my-chart label rule quotes the fixed UI line of the same language (completeness.test.ts pins the English one).
    for (const lang of LANGS) {
      const label = ruleText('ask-label', lang)!;
      expect(label.lang).toBe(lang);
      expect(label.fallback).toBe(false);
      expect(label.text).toContain(loadUi(lang)['ask.label']);
    }
    const bhadra = ruleText('bhadra', 'bho')!;
    expect(bhadra.lang).toBe('bho');
    expect(bhadra.text).toContain('विष्टि करण');
    expect(bhadra.text).toContain('मेष, वृषभ, मिथुन भा वृश्चिक');
    // Ids outside the integrated slice resolve further down the chain (bho -> hi -> en) and say so.
    const translated = new Set(hi.map((r) => r.id));
    const pending = en.map((r) => r.id).filter((id) => !translated.has(id));
    for (const id of pending.slice(0, 20)) {
      for (const lang of LANGS) {
        const r = ruleText(id, lang)!;
        expect(r, `${id} ${lang}`).not.toBeNull();
        expect(r.fallback).toBe(r.lang !== lang);
      }
    }
  });

  it('T03: rules is complete in hi and bho; yoga, koota, muhurat and Sade Sati rules resolve in their own language with the UI names', () => {
    const en = CORPUS.rules.en!;
    for (const lang of LANGS) expect(CORPUS.rules[lang]!.map((r) => r.id).sort(), `rules/${lang} complete`).toEqual(en.map((r) => r.id).sort());
    // Yoga rules name the yoga as the Yogas card does (yogas.name.* in the UI).
    const gajaHi = ruleText('yoga-gaja-kesari', 'hi')!;
    expect(gajaHi.lang).toBe('hi');
    expect(gajaHi.fallback).toBe(false);
    expect(gajaHi.text).toContain('गजकेसरी योग');
    const kalaSarpaBho = ruleText('yoga-kala-sarpa', 'bho')!;
    expect(kalaSarpaBho.lang).toBe('bho');
    expect(kalaSarpaBho.fallback).toBe(false);
    expect(kalaSarpaBho.text).toContain(loadUi('bho')['yogas.name.kala-sarpa']);
    // Koota rules keep the point totals and the koota name of the match screen.
    const nadiBho = ruleText('koota-nadi', 'bho')!;
    expect(nadiBho.lang).toBe('bho');
    expect(nadiBho.text).toContain('नाड़ी कूट (8 अंक)');
    expect(nadiBho.text).toContain('नाड़ी दोष');
    // Muhurat activity rules name the activity as the engine's own hi / bho table does and keep the tithi digits.
    const grihaHi = ruleText('muhurat-griha-pravesh', 'hi')!;
    expect(grihaHi.lang).toBe('hi');
    expect(grihaHi.text).toContain('गृह प्रवेश');
    expect(grihaHi.text).toContain('2, 3, 5, 7, 10, 11, 12, 13');
    // Sade Sati phases keep the respectful second person of each language.
    const phaseBho = ruleText('sade-sati-phase-1', 'bho')!;
    expect(phaseBho.lang).toBe('bho');
    expect(phaseBho.fallback).toBe(false);
    expect(phaseBho.text).toContain('राउर जनम-चंद्र');
    expect(ruleText('sade-sati-phase-1', 'hi')!.text).toContain('आपके जन्म-चंद्र');
    // The KP significator grades keep the Latin letters the KP screen shows.
    const kpHi = ruleText('kp-significators', 'hi')!;
    expect(kpHi.lang).toBe('hi');
    for (const grade of ['A', 'B', 'C', 'D']) expect(kpHi.text).toContain(`${grade},`);
  });

  it('T04: the festivals slice is registered in hi and bho with one id set, festivalText resolves a translated slug in its own language with the engine name and the Why?-sheet rule sentence, and an untranslated slug along the chain', () => {
    const en = FESTIVALS.en!;
    const hi = FESTIVALS.hi!;
    const bho = FESTIVALS.bho!;
    expect(hi.length).toBeGreaterThanOrEqual(51);
    expect(hi.length).toBeLessThanOrEqual(en.length);
    expect(bho.map((r) => r.id).sort(), 'festivals hi and bho carry the same slice').toEqual(hi.map((r) => r.id).sort());
    // `rule` is the same sentence the Why? sheet shows (corpus/rules festival-<slug>) in every language, as in en.json.
    for (const lang of LANGS) {
      for (const f of FESTIVALS[lang]!) expect(f.rule, `${f.slug} ${lang} rule == rules/festival-${f.slug}`).toBe(ruleText(`festival-${f.slug}`, lang)!.text);
    }
    // Diwali: translated in both languages, named as the engine festival table names it, Smarta/Amanta note in Devanagari.
    const diwaliHi = festivalText('diwali', 'hi')!;
    expect(diwaliHi.lang).toBe('hi');
    expect(diwaliHi.fallback).toBe(false);
    expect(diwaliHi.item.name).toBe('दीपावली (लक्ष्मी पूजा)');
    expect(diwaliHi.item.what).toContain('प्रदोष काल');
    expect(diwaliHi.item.conventionNote).toContain('पूर्णिमांत');
    const diwaliBho = festivalText('diwali', 'bho')!;
    expect(diwaliBho.lang).toBe('bho');
    expect(diwaliBho.fallback).toBe(false);
    expect(diwaliBho.item.name).toContain('दियरी');
    expect(diwaliBho.item.what).toContain('दियरी');
    expect(diwaliBho.item.what).not.toMatch(/(^|\s)(है|हैं)(\s|।)/);
    // Chhath keeps the four step names of the vrat screen in Bhojpuri (nahay khay, kharna, sandhya / usha arghya).
    const chhathBho = festivalText('chhath-puja', 'bho')!;
    expect(chhathBho.lang).toBe('bho');
    expect(chhathBho.item.what).toContain('नहाय खाय');
    expect(chhathBho.item.what).toContain('खरना');
    expect(chhathBho.item.what).toContain('अरघ');
    expect(festivalText('chhath-puja', 'hi')!.item.what).toContain('अर्घ्य');
    // Slugs outside the integrated slice resolve further down the chain (bho -> hi -> en) and say so.
    const translated = new Set(hi.map((r) => r.id));
    const pending = en.filter((r) => !translated.has(r.id));
    for (const f of pending.slice(0, 20)) {
      for (const lang of LANGS) {
        const r = festivalText(f.slug, lang)!;
        expect(r, `${f.slug} ${lang}`).not.toBeNull();
        expect(r.fallback).toBe(r.lang !== lang);
      }
    }
  });

  it('every registered domain has an English master and only hi / bho translations', () => {
    for (const t of TABLES) {
      expect(t.rows.en, `${t.domain} has no en`).toBeDefined();
      for (const l of Object.keys(t.rows)) expect(['en', 'hi', 'bho'], `${t.domain} registers unknown language ${l}`).toContain(l);
    }
  });

  it('glossary and lessons translations, when registered, cover every English id (the app lists them from one file)', () => {
    for (const t of TABLES.filter((x) => WHOLE_FILE_DOMAINS.has(x.domain))) {
      for (const lang of LANGS) {
        const rows = t.rows[lang];
        if (!rows) continue;
        expect(rows.map((r) => r.id).sort(), `${t.domain}/${lang} must be complete`).toEqual(t.rows.en!.map((r) => r.id).sort());
      }
    }
  });

  for (const t of TABLES) {
    for (const lang of LANGS) {
      const rows = t.rows[lang];
      if (!rows) continue;
      const en = t.rows.en!;
      const enById = new Map(en.map((r) => [r.id, r]));

      it(`${t.domain}/${lang}.json: ids exist in en.json, non-text fields are byte-identical, text fields are translated with the same placeholders and only Latin digits`, () => {
        const bad: string[] = [];
        const seen = new Set<string>();
        for (const row of rows) {
          if (seen.has(row.id)) bad.push(`${row.id}: duplicate`);
          seen.add(row.id);
          const master = enById.get(row.id);
          if (!master) {
            bad.push(`${row.id}: not in en.json`);
            continue;
          }
          const fields = textFields(t.domain);
          expect(Object.keys(row).sort(), `${t.domain}/${lang} ${row.id} key set`).toEqual(Object.keys(master).sort());
          for (const k of Object.keys(master)) {
            if (fields.includes(k)) continue;
            if (JSON.stringify(row[k]) !== JSON.stringify(master[k])) bad.push(`${row.id}.${k}: differs from en.json`);
          }
          for (const f of fields) {
            const e = master[f];
            const v = row[f];
            if (e === undefined) continue;
            if (Array.isArray(e)) {
              if (!Array.isArray(v) || v.length !== e.length) {
                bad.push(`${row.id}.${f}: paragraph count differs`);
                continue;
              }
              e.forEach((para, i) => checkString(`${row.id}.${f}[${i}]`, String(para), String((v as unknown[])[i]), bad));
            } else {
              checkString(`${row.id}.${f}`, String(e), String(v), bad);
            }
          }
        }
        expect(bad, bad.join('\n')).toEqual([]);
      });

      it(`${t.domain}/${lang}.json: every translated id resolves in ${lang} with fallback false`, () => {
        for (const row of rows) {
          const r = t.resolve(row.id, lang);
          expect(r, `${t.domain}/${row.id} ${lang}`).not.toBeNull();
          expect(r!.lang, `${t.domain}/${row.id} resolved language`).toBe(lang);
          expect(r!.fallback).toBe(false);
        }
        if (lang === 'hi' && t.rows.bho) {
          // A Bhojpuri request for an id that exists only in Hindi lands on Hindi (chain order bho -> hi -> en).
          const bhoIds = new Set(t.rows.bho.map((r) => r.id));
          for (const row of rows.filter((r) => !bhoIds.has(r.id))) expect(t.resolve(row.id, 'bho')?.lang, `${t.domain}/${row.id} bho -> hi`).toBe('hi');
        }
      });
    }
  }
});
