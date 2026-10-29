// Parity of the agent-written Hindi / Bhojpuri corpus files with their English masters (owner decision 2026-10-29,
// PRD .agents/tasks/corpus-translate/prd.json). Data-driven over the registry: every hi/bho table that is registered is
// checked record by record; a domain without a translation file contributes nothing here (fallback.test.ts covers the
// chain). Contract per translated record: same id, every non-text field byte-identical to en.json, the same {placeholders}
// and paragraph breaks, Latin digits only, no Latin-script words apart from the allow-listed product names, and the
// resolvers return it in its own language with fallback: false.
import { describe, expect, it } from 'vitest';
import { LATIN_ALLOWLIST } from '../../content-tools/src/forbidden';
import { CORPUS, FESTIVALS, GLOSSARY, LESSONS } from '../src/registry';
import { festivalText, glossaryTerm, loadGlossary, loadLessons, loadUi, lookup, lesson, lessonPlaceholders, ruleText, type ContentLanguage } from '../src/index';

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

  it('T05: festivals is complete in hi and bho; every slug resolves in its own language with the engine name, the convention-note templates and the Ekadashi parana wording', () => {
    const en = FESTIVALS.en!;
    for (const lang of LANGS) {
      expect(FESTIVALS[lang]!.map((r) => r.id).sort(), `festivals/${lang} complete`).toEqual(en.map((r) => r.id).sort());
      for (const f of en) {
        const r = festivalText(f.slug, lang)!;
        expect(r, `${f.slug} ${lang}`).not.toBeNull();
        expect(r.lang, `${f.slug} ${lang} resolves in its own language`).toBe(lang);
        expect(r.fallback).toBe(false);
      }
    }
    // Makar Sankranti: the Bhojpuri name is the engine's खिचड़ी (मकर संक्रांति); the solar rule has no Purnimanta/Amanta difference.
    const sankrantiBho = festivalText('makar-sankranti', 'bho')!;
    expect(sankrantiBho.item.name).toBe('खिचड़ी (मकर संक्रांति)');
    expect(sankrantiBho.item.what).toContain('निरयण मकर राशि');
    expect(sankrantiBho.item.conventionNote).toContain('सौर नियम');
    expect(festivalText('makar-sankranti', 'hi')!.item.conventionNote).toContain('15 जनवरी');
    // Pongal shares the sankranti moment; the Tamil names stay in Devanagari and the South-region note is kept.
    expect(festivalText('pongal', 'hi')!.item.what).toContain('पोंगलो पोंगल');
    expect(festivalText('pongal', 'bho')!.item.conventionNote).toContain('दक्खिन क्षेत्र');
    // Raksha Bandhan: engine name राखी (रक्षाबंधन) in Bhojpuri, the Bhadra exception named in both languages.
    const rakhiBho = festivalText('raksha-bandhan', 'bho')!;
    expect(rakhiBho.item.name).toBe('राखी (रक्षाबंधन)');
    expect(rakhiBho.item.conventionNote).toContain('भद्रा');
    expect(rakhiBho.item.what).not.toMatch(/(^|\s)(है|हैं)(\s|।)/);
    expect(festivalText('raksha-bandhan', 'hi')!.item.conventionNote).toContain('निर्णय सिंधु');
    // Ekadashi records keep the parana / Hari Vasara wording and the Smarta-Vaishnava convention line in each language.
    const nirjalaHi = festivalText('nirjala-ekadashi', 'hi')!;
    expect(nirjalaHi.item.what).toContain('पारण');
    expect(nirjalaHi.item.conventionNote).toContain('स्मार्त और वैष्णव');
    const nirjalaBho = festivalText('nirjala-ekadashi', 'bho')!;
    expect(nirjalaBho.item.what).toContain('पारन');
    expect(nirjalaBho.item.conventionNote).toContain('हरि वासर');
    expect(nirjalaBho.item.conventionNote).toContain('स्मार्त आ वैष्णव');
    // Vat Savitri: the Bhojpuri engine name बरसाइत; the Hindi note cross-references Vat Purnima.
    expect(festivalText('vat-savitri', 'bho')!.item.name).toBe('बरसाइत (वट सावित्री)');
    expect(festivalText('vat-savitri', 'hi')!.item.conventionNote).toContain('वट पूर्णिमा');
  });

  it('T06: vrats, muhurat-activities, koota and mangal are complete in hi and bho; every id resolves in its own language with the screen names of the vrat, muhurat and match screens', () => {
    for (const domain of ['vrats', 'muhurat-activities', 'koota', 'mangal']) {
      const en = CORPUS[domain].en!;
      for (const lang of LANGS) {
        const rows = CORPUS[domain][lang];
        expect(rows, `${domain}/${lang} registered`).toBeDefined();
        expect(rows!.map((r) => r.id).sort(), `${domain}/${lang} complete`).toEqual(en.map((r) => r.id).sort());
        for (const r of en) {
          const got = lookup(domain, r.id, lang)!;
          expect(got, `${domain}/${r.id} ${lang}`).not.toBeNull();
          expect(got.lang, `${domain}/${r.id} ${lang} resolves in its own language`).toBe(lang);
          expect(got.fallback).toBe(false);
          // `rule` is engine metadata (an id or the English rule sentence) and stays byte-identical.
          expect(got.snippet.rule).toBe(r.rule);
        }
      }
    }
    // Vrats: the what-to-do paragraph keeps the vrat screen's step and parana names in each language.
    const chhathBho = lookup('vrats', 'vrat-chhath', 'bho')!;
    expect(chhathBho.text).toContain('नहाय खाय');
    expect(chhathBho.text).toContain('खरना');
    expect(chhathBho.text).toContain(loadUi('bho')['vrat.chhath.sandhyaArghya']);
    expect(chhathBho.text).toContain(loadUi('bho')['vrat.chhath.ushaArghya']);
    expect(chhathBho.text).not.toMatch(/(^|\s)(है|हैं)(\s|।)/);
    expect(lookup('vrats', 'vrat-chhath', 'hi')!.text).toContain('संध्या अर्घ्य');
    const ekadashiHi = lookup('vrats', 'vrat-ekadashi', 'hi')!;
    expect(ekadashiHi.text).toContain('पारण');
    expect(ekadashiHi.text).toContain('हरि वासर');
    expect(ekadashiHi.text).toContain('स्मार्त');
    const ekadashiBho = lookup('vrats', 'vrat-ekadashi', 'bho')!;
    expect(ekadashiBho.text).toContain('पारन');
    expect(ekadashiBho.text).toContain('वैष्णव');
    expect(lookup('vrats', 'vrat-navratri', 'hi')!.text).toContain('घटस्थापना');
    expect(lookup('vrats', 'vrat-navratri', 'bho')!.text).toContain(loadUi('bho')['vrat.family.navratri']);
    // Muhurat activities: the engine's own activity names, the tithi digits and the finder's UI titles.
    const grihaHi = lookup('muhurat-activities', 'muhurat-griha-pravesh', 'hi')!;
    expect(grihaHi.text).toContain('गृह प्रवेश');
    expect(grihaHi.text).toContain('2, 3, 5, 7, 10, 11, 12 और 13');
    expect(lookup('muhurat-activities', 'muhurat-vehicle-purchase', 'bho')!.text).toContain('गाड़ी खरीद');
    expect(lookup('muhurat-activities', 'muhurat-vehicle-purchase', 'hi')!.text).toContain('वाहन खरीद');
    for (const lang of LANGS) {
      expect(lookup('muhurat-activities', 'muhurat-ranking', lang)!.text).toContain(loadUi(lang)['muhurat.partialTitle']);
      expect(lookup('muhurat-activities', 'muhurat-rule-panchak', lang)!.text).toContain(loadUi(lang)['travel.title']);
      const tara = lookup('muhurat-activities', 'muhurat-rule-tara-bala', lang)!.text;
      for (const n of ['(2)', '(4)', '(6)', '(8)', '(9)']) expect(tara).toContain(n);
    }
    // Koota: point totals, the match screen's koota / nadi / animal names, and the Drik Panchang spelling.
    for (const lang of LANGS) {
      const bhakoot = lookup('koota', 'koota-bhakoot-1', lang)!.text;
      expect(bhakoot).toContain('भकूट (7 अंक)');
      expect(bhakoot).toContain('2/12, 5/9');
      const nadi = lookup('koota', 'koota-nadi-3', lang)!.text;
      expect(nadi).toContain('36 में से 8 अंक');
      expect(nadi).toContain('नाड़ी दोष');
      expect(nadi).toContain('दृक् पंचांग');
      for (const k of ['match.nadi.adi', 'match.nadi.madhya', 'match.nadi.antya']) expect(nadi).toContain(loadUi(lang)[k]);
      const yoni = lookup('koota', 'koota-yoni-3', lang)!.text;
      for (const k of ['match.yoni.horse', 'match.yoni.elephant', 'match.yoni.mongoose', 'match.yoni.lion']) expect(yoni).toContain(loadUi(lang)[k]);
      const gana = lookup('koota', 'koota-gana-2', lang)!.text;
      for (const k of ['match.gana.deva', 'match.gana.manushya', 'match.gana.rakshasa']) expect(gana).toContain(loadUi(lang)[k]);
    }
    expect(lookup('koota', 'koota-tara-3', 'bho')!.text).toContain('“काहे?” शीट');
    expect(lookup('koota', 'koota-tara-3', 'hi')!.text).toContain('“क्यों?” शीट');
    // Mangal: the match screen's dosha vocabulary (मौजूद / प्रभावी / निरस्ति-नियम / लागू नहीं) and the respectful plural for Mars.
    const mangalHi = lookup('mangal', 'mangal-dosha', 'hi')!.text;
    expect(mangalHi).toContain('मंगल दोष मौजूद है');
    expect(mangalHi).toContain('निरस्ति-नियम');
    expect(mangalHi).toContain('“क्यों?” के इनपुट');
    const mangalBho = lookup('mangal', 'mangal-dosha', 'bho')!.text;
    expect(mangalBho).toContain('मंगल दोष मौजूद बा');
    expect(mangalBho).toContain('“काहे?” के इनपुट');
    expect(mangalBho).toContain('बाड़न');
    expect(mangalBho).not.toMatch(/(^|\s)(है|हैं)(\s|।)/);
    expect(lookup('mangal', 'mangal-cancel-both-manglik', 'hi')!.text).toContain(`“${loadUi('hi')['match.notApplied_tag']}”`);
    expect(lookup('mangal', 'mangal-cancel-both-manglik', 'bho')!.text).toContain(`“${loadUi('bho')['match.notApplied_tag']}”`);
    expect(lookup('mangal', 'mangal-cancel-sign-house', 'bho')!.text).toContain('राशि-भाव जोड़ी');
  });

  it('T07: the glossary is complete in hi and bho (whole-file domain), every term resolves in its own language with the headwords untouched, the UI / engine names and the degree ranges of the English master', () => {
    const en = GLOSSARY.en!;
    for (const lang of LANGS) {
      const rows = GLOSSARY[lang];
      expect(rows, `glossary/${lang} registered`).toBeDefined();
      expect(rows!.map((r) => r.id).sort(), `glossary/${lang} complete`).toEqual(en.map((r) => r.id).sort());
      // The list screen renders one whole file, so loadGlossary must return the requested language without fallback.
      const list = loadGlossary(lang);
      expect(list.lang).toBe(lang);
      expect(list.fallback).toBe(false);
      expect(list.items.length).toBe(en.length);
      for (const g of en) {
        const r = glossaryTerm(g.id, lang)!;
        expect(r, `glossary/${g.id} ${lang}`).not.toBeNull();
        expect(r.lang, `glossary/${g.id} ${lang} resolves in its own language`).toBe(lang);
        expect(r.fallback).toBe(false);
        // Headwords and cross-references are metadata shared by every language; only `meaning` is translated.
        expect(r.item.term_dev).toBe(g.term_dev);
        expect(r.item.term_lat).toBe(g.term_lat);
        expect(r.item.related).toEqual(g.related);
        expect(r.item.meaning).not.toBe(g.meaning);
      }
    }
    // Rahu Kaal: the daytime-eighth wording of the rules corpus, respectful register, no Hindi verb in Bhojpuri.
    const rahuHi = glossaryTerm('rahu-kaal', 'hi')!.item.meaning;
    expect(rahuHi).toContain('दिनमान का आठवाँ भाग');
    expect(rahuHi).toContain('नई शुरुआत');
    const rahuBho = glossaryTerm('rahu-kaal', 'bho')!.item.meaning;
    expect(rahuBho).toContain('दिनमान के आठवाँ हिस्सा');
    expect(rahuBho).toContain('नया शुरुआत');
    expect(rahuBho).not.toMatch(/(^|\s)(है|हैं)(\s|।)/);
    // Degrees and digits stay Latin and keep the English notation.
    for (const lang of LANGS) {
      expect(glossaryTerm('tithi', lang)!.item.meaning).toContain('12°');
      expect(glossaryTerm('krittika', lang)!.item.meaning).toContain("26°40'");
      expect(glossaryTerm('sarvashtakavarga', lang)!.item.meaning).toContain('337');
      expect(glossaryTerm('ayanamsa', lang)!.item.meaning).toContain('KP');
      expect(glossaryTerm('ayanamsa', lang)!.item.meaning).toContain('लाहिरी');
      expect(glossaryTerm('vakri', lang)!.item.meaning).toMatch(/\bR\b/);
    }
    // Festival and month cross-references follow the engine's own hi / bho tables (D10): दीपावली / दियरी, कार्तिक / कातिक.
    const kartikHi = glossaryTerm('kartik', 'hi')!.item.meaning;
    expect(kartikHi).toContain('दीपावली');
    expect(kartikHi).toContain('करवा चौथ');
    const kartikBho = glossaryTerm('kartik', 'bho')!.item.meaning;
    expect(kartikBho).toContain('दियरी');
    expect(kartikBho).toContain('करवा चउथ');
    expect(glossaryTerm('navratri', 'bho')!.item.meaning).toContain('चइत आ आसिन');
    expect(glossaryTerm('navratri', 'hi')!.item.meaning).toContain('चैत्र और आश्विन');
    expect(glossaryTerm('makara', 'bho')!.item.meaning).toContain('खिचड़ी (मकर संक्रांति)');
    // Karka keeps the English "Karkata, the crab" gloss in Devanagari (the Western sign name is on the forbidden list).
    for (const lang of LANGS) expect(glossaryTerm('karka', lang)!.item.meaning).toContain('कर्कट, केकड़ा');
    // Bhojpuri register: respectful plural for planets, UI weekday names, no Hindi pronoun.
    expect(glossaryTerm('ashwini', 'bho')!.item.meaning).toContain('स्वामी केतु बाड़न');
    expect(glossaryTerm('ravi-pushya', 'bho')!.item.meaning).toContain('एतवार');
    expect(glossaryTerm('ravi-pushya', 'hi')!.item.meaning).toContain('रविवार');
    expect(glossaryTerm('guru-pushya', 'bho')!.item.meaning).toContain('बियफे');
    expect(glossaryTerm('chhath', 'bho')!.item.meaning).toContain(loadUi('bho')['vrat.chhath.sandhyaArghya']);
    expect(glossaryTerm('chhath', 'hi')!.item.meaning).toContain('संध्या अर्घ्य');
  });

  it('T10: lessons are complete in hi and bho (whole-file domain), loadLessons returns the requested language without fallback, every lesson resolves in its own language with the English placeholders and the UI screen names', () => {
    const en = LESSONS.en!;
    for (const lang of LANGS) {
      const rows = LESSONS[lang];
      expect(rows, `lessons/${lang} registered`).toBeDefined();
      expect(rows!.map((r) => r.id).sort(), `lessons/${lang} complete`).toEqual(en.map((r) => r.id).sort());
      // The Learn tab renders one whole file, so loadLessons must return the requested language without fallback, ordered by n.
      const list = loadLessons(lang);
      expect(list.lang).toBe(lang);
      expect(list.fallback).toBe(false);
      expect(list.items.length).toBe(21);
      expect(list.items.map((l) => l.n)).toEqual(en.map((l) => l.n).sort((a, b) => a - b));
      for (const l of en) {
        const r = lesson(l.id, lang)!;
        expect(r, `lessons/${l.id} ${lang}`).not.toBeNull();
        expect(r.lang, `lessons/${l.id} ${lang} resolves in its own language`).toBe(lang);
        expect(r.fallback).toBe(false);
        // Metadata the app routes on is shared by every language; title and body are translated paragraph for paragraph.
        expect(r.item.n).toBe(l.n);
        expect(r.item.tryIt).toEqual(l.tryIt);
        expect(r.item.terms).toEqual(l.terms);
        expect(r.item.unlocksLevel).toBe(l.unlocksLevel);
        expect(r.item.body.length).toBe(l.body.length);
        expect(r.item.title).not.toBe(l.title);
        // The resolver fills the same placeholder set in every language (LESSON_PLACEHOLDERS is the app's contract).
        expect(lessonPlaceholders(r.item).sort(), `lessons/${l.id} ${lang} placeholders`).toEqual(lessonPlaceholders(l).sort());
      }
    }
    // lesson-01 keeps every placeholder in Bhojpuri; lesson-13 in Hindi (the per-paragraph multiset is checked below for every row).
    expect(lesson('lesson-01', 'bho')!.item.body.join(' ')).toContain('{name}');
    expect(lesson('lesson-01', 'bho')!.item.body.join(' ')).toContain('{moonSign}');
    expect(lesson('lesson-13', 'hi')!.item.body.join(' ')).toContain('{saturnHouseFromMoon}');
    expect(lesson('lesson-13', 'hi')!.item.body.join(' ')).toContain('{saturnHouse}');
    // Lesson 15: the D9 paragraph keeps all four chart placeholders and the UI varga names.
    for (const lang of LANGS) {
      const d9 = lesson('lesson-15', lang)!.item;
      expect(d9.title).toContain('D9');
      for (const p of ['{moonDegree}', '{moonSign}', '{moonNavamsaSign}', '{lagnaNavamsaSign}']) expect(d9.body[1]).toContain(p);
      expect(d9.body[3]).toContain('द्रेष्काण');
      expect(d9.body[3]).toContain('षष्ट्यंश');
      expect(d9.body[2]).toContain('वर्गोत्तम');
    }
    // Lesson 16: SAV placeholders and the Ashtakavarga screen's strength words (सबल / मध्यम / निर्बल) and the 337 total as words.
    for (const lang of LANGS) {
      const av = lesson('lesson-16', lang)!.item;
      expect(av.body[2]).toContain('{savLagna}');
      expect(av.body[2]).toContain('{savTenth}');
      for (const w of ['सबल', 'मध्यम', 'निर्बल']) expect(av.body[2]).toContain(w);
      expect(av.body[1]).toContain('BAV');
      expect(av.body[1]).toContain('SAV');
    }
    // Lesson 17: KP screen names (भाव-संधि, उप-स्वामी, सत्तारूढ़ ग्रह, प्लेसिडस) and the Latin grade letters A to D.
    for (const lang of LANGS) {
      const kp = lesson('lesson-17', lang)!.item;
      expect(kp.body[1]).toContain('{kpLagnaSubLord}');
      expect(kp.body.join(' ')).toContain(loadUi(lang)['kp.subLord_col']);
      expect(kp.body.join(' ')).toContain('भाव-संधि');
      expect(kp.body[3]).toContain('सत्तारूढ़ ग्रह');
      expect(kp.body[0]).toContain('प्लेसिडस');
      expect(kp.body[2]).toMatch(/\bA\b/);
      expect(kp.body[2]).toMatch(/\bD\b/);
    }
    // Lesson 18: the match screen's koota names and the "beyond" section title, respectful honorific for the reader's Mars.
    for (const lang of LANGS) {
      const m = lesson('lesson-18', lang)!.item;
      for (const k of ['varna', 'vashya', 'tara', 'yoni', 'grahaMaitri', 'gana', 'bhakoot', 'nadi']) expect(m.body[0]).toContain(loadUi(lang)[`match.koota.${k}`]);
      expect(m.body[5]).toContain(loadUi(lang)['match.beyondTitle']);
      expect(m.body[5]).toContain(loadUi(lang)['match.title']);
      expect(m.body[2]).toContain('{marsHouse}');
      expect(m.body[3]).toContain('{seventhLord}');
    }
    expect(lesson('lesson-18', 'bho')!.item.body[2]).toContain('राउर मंगल');
    expect(lesson('lesson-18', 'bho')!.item.body[2]).toContain('बाड़न');
    expect(lesson('lesson-18', 'hi')!.item.body[2]).toContain('आपके मंगल');
    // Lesson 19: the ten muhurat rule names as the finder's chips print them; the finder's own title.
    for (const lang of LANGS) {
      const mu = lesson('lesson-19', lang)!.item;
      expect(mu.body[0]).toContain(loadUi(lang)['muhurat.title']);
      for (const k of ['tithi', 'nakshatra', 'vara', 'chandra-bala', 'tara-bala', 'bhadra', 'panchak', 'choghadiya']) {
        const name = loadUi(lang)[`muhurat.rule.${k}`].replace(/ (नहीं|ना)$/, '');
        expect(mu.body[2], `lesson-19 ${lang} rule ${k}`).toContain(name);
      }
      // The English names the rule plainly ("Abhijit", "Rahu Kaal"); the chips add "bonus" / "avoided".
      expect(mu.body[2]).toContain('अभिजित');
      expect(mu.body[2]).toContain('राहु काल');
      expect(mu.body[5]).toContain(loadUi(lang)['muhurat.partialTitle']);
      expect(mu.body[3]).toContain('{moonSign}');
      expect(mu.body[3]).toContain('{nakshatra}');
    }
    // Lesson 20: the honesty markers are quoted as the UI prints them (Why?, approx., How this was computed, for reflection, the Ask-my-chart label).
    for (const lang of LANGS) {
      const w = lesson('lesson-20', lang)!.item;
      const ui = loadUi(lang);
      expect(w.title).toContain(`“${ui['common.why']}”`);
      expect(w.body[0]).toContain(`“${ui['common.why']}”`);
      expect(w.body[1]).toContain(`“${ui['common.approx']}”`);
      expect(w.body[2]).toContain(`“${ui['common.howComputed']}”`);
      expect(w.body[2]).toContain('{ayanamsa}');
      expect(w.body[2]).toContain('{nodeMode}');
      expect(w.body[3]).toContain(`“${ui['common.forReflection']}”`);
      expect(w.body[4]).toContain(ui['ask.label']);
      expect(w.body[4]).toContain(`“${ui['ask.rowTitle']}”`);
      expect(w.body[5]).toContain(`“${ui['today.title']}”`);
    }
    // Lesson 21: the calculation settings names (सेटिंग / गणना), the four settings placeholders, UTC and the dasha-year constant.
    for (const lang of LANGS) {
      const c = lesson('lesson-21', lang)!.item;
      const ui = loadUi(lang);
      expect(c.body[0]).toContain('{ephemeris}');
      expect(c.body[1]).toContain('{ayanamsa}');
      expect(c.body[1]).toContain('{ayanamsaDegrees}');
      expect(c.body[2]).toContain('{nodeMode}');
      expect(c.body[3]).toContain('{birthTz}');
      expect(c.body[3]).toContain('UTC');
      expect(c.body[4]).toContain('365.2425');
      expect(c.body[4]).toContain(`“${ui['settings.calculation']}”`);
      expect(c.body[5]).toContain(ui['settings.title']);
      expect(c.body[2]).toContain(ui['settings.nodes.true'].replace(/ \(.*\)$/, ''));
    }
    // Bhojpuri register: no Hindi है / हैं in any lesson body, respectful imperatives in the try-it paragraph.
    for (const l of LESSONS.bho!) {
      expect(l.body.join(' '), `${l.id} bho`).not.toMatch(/(^|\s)(है|हैं|करें|देखें|खोलें)(\s|।|,|;)/);
      expect(l.body[5], `${l.id} bho try-it`).toMatch(/(खोलीं|जाईं|चुनीं|खोजीं|पढ़ीं)/);
    }
    for (const l of LESSONS.hi!) expect(l.body[5], `${l.id} hi try-it`).toMatch(/(खोलें|जाएँ|चुनें|ढूँढ़ें|पढ़ें|फैलाएँ|गिनें)/);
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
