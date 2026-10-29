// Parity of the agent-written Hindi / Bhojpuri corpus files with their English masters (owner decision 2026-10-29,
// PRD .agents/tasks/corpus-translate/prd.json). Data-driven over the registry: every hi/bho table that is registered is
// checked record by record; a domain without a translation file contributes nothing here (fallback.test.ts covers the
// chain). Contract per translated record: same id, every non-text field byte-identical to en.json, the same {placeholders}
// and paragraph breaks, Latin digits only, no Latin-script words apart from the allow-listed product names, and the
// resolvers return it in its own language with fallback: false.
import { describe, expect, it } from 'vitest';
import { LATIN_ALLOWLIST } from '../../content-tools/src/forbidden';
import { nakshatraNames, planetNames, signNames, type PlanetId } from '../../engine/src/locale/index';
import { signDignity } from '../../engine/src/kundli/index';
import { NAKSHATRA_LORDS } from '../../engine/src/panchang/panchang';
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

  it('T11: yogas, dignity and lagna are complete in hi and bho; every id resolves in its own language with the Yogas-card names, the dignity tag names and the engine sign names', () => {
    for (const domain of ['yogas', 'dignity', 'lagna']) {
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
          // `rule` is the English rule sentence (yogas, dignity) or the English caption (lagna): metadata, byte-identical.
          expect(got.snippet.rule).toBe(r.rule);
        }
      }
      // Bhojpuri register: no Hindi है / हैं anywhere in the three domains.
      for (const r of CORPUS[domain].bho!) expect(r.text, `${domain}/${r.id} bho`).not.toMatch(/(^|\s)(है|हैं)(\s|।|,|;)/);
    }
    // Yogas: the paragraph names the yoga as the Yogas card does (yogas.name.*) and keeps the rules-corpus vocabulary.
    const gajaHi = lookup('yogas', 'yoga-gaja-kesari', 'hi')!.text;
    expect(gajaHi).toContain(`${loadUi('hi')['yogas.name.gaja-kesari']} योग`);
    expect(gajaHi).toContain('चंद्र से गिनने पर केंद्र');
    const gajaBho = lookup('yogas', 'yoga-gaja-kesari', 'bho')!.text;
    expect(gajaBho).toContain(`${loadUi('bho')['yogas.name.gaja-kesari']} योग`);
    expect(gajaBho).toContain('चंद्र से गिनला पर केंद्र');
    expect(lookup('yogas', 'yoga-kala-sarpa', 'bho')!.text).toContain(loadUi('bho')['yogas.name.kala-sarpa']);
    expect(lookup('yogas', 'yoga-kala-sarpa', 'hi')!.text).toContain('राहु–केतु अक्ष');
    for (const lang of LANGS) {
      const ui = loadUi(lang);
      for (const k of ['ruchaka', 'bhadra', 'hamsa', 'malavya', 'sasa', 'harsha', 'sarala', 'vimala', 'neecha-bhanga-raja', 'dharma-karmadhipati']) {
        expect(lookup('yogas', `yoga-${k}`, lang)!.text, `yoga-${k} ${lang} names the yoga as the card does`).toContain(`${ui[`yogas.name.${k}`]} योग`);
      }
      const parivartana = lookup('yogas', 'yoga-parivartana', lang)!.text;
      for (const kind of ['महा', 'खल', 'दैन्य']) expect(parivartana).toContain(kind);
      expect(lookup('yogas', 'yoga-harsha', lang)!.text).toContain('विपरीत राज योग');
      expect(lookup('yogas', 'yoga-none', lang)!.text).toContain(`“${ui['common.why']}” के इनपुट`);
    }
    // Set aside (a combust forming planet) stays distinct from cancelled (भंग), as in the rules corpus.
    expect(lookup('yogas', 'mahapurusha-bhanga-combust', 'hi')!.text).toContain('अलग रख दिया गया');
    expect(lookup('yogas', 'mahapurusha-bhanga-combust', 'bho')!.text).toContain('अलगा राख दिहल गइल');
    expect(lookup('yogas', 'kemadruma-bhanga-moon-conjunction', 'hi')!.text).toContain('भंग');
    expect(lookup('yogas', 'shakata-bhanga-jupiter-kendra', 'bho')!.text).toContain('भंग');
    // Dignity: the tag names of the planet sheet (dignity.*), the degree orbs and the D1 / D9 notation.
    for (const lang of LANGS) {
      const ui = loadUi(lang);
      const combust = lookup('dignity', 'combust', lang)!.text;
      for (const orb of ['12°', '17°', '14°', '11°', '10°', '15°']) expect(combust).toContain(orb);
      expect(combust).toContain('अस्त-सीमा');
      expect(lookup('dignity', 'own', lang)!.text).toContain(ui['dignity.own']);
      expect(lookup('dignity', 'own', lang)!.text).toContain('मूलत्रिकोण');
      expect(lookup('dignity', 'exalted', lang)!.text).toContain('सूर्य मेष में');
      expect(lookup('dignity', 'debilitated', lang)!.text).toContain('सूर्य तुला में');
      expect(lookup('dignity', 'friend', lang)!.text).toContain('नैसर्गिक मित्र');
      expect(lookup('dignity', 'enemy', lang)!.text).toContain('नैसर्गिक शत्रु');
      expect(lookup('dignity', 'retro', lang)!.text).toContain('वक्री');
      const varg = lookup('dignity', 'vargottama', lang)!.text;
      expect(varg).toContain("3°20'");
      expect(varg).toContain('D1');
      expect(varg).toContain('D9');
      const approx = lookup('dignity', 'approx-lagna', lang)!.text;
      expect(approx).toContain(`“${ui['common.approx']}”`);
      expect(approx).toContain('1°');
      expect(approx).toContain('15, 30');
      expect(lookup('dignity', 'house-lord', lang)!.text).toContain(ui['charts.houseSystem.whole-sign']);
    }
    expect(lookup('dignity', 'moon-chart-mode', 'hi')!.text).toContain('भाव 1');
    expect(lookup('dignity', 'moon-chart-mode', 'bho')!.text).toContain('घर 1');
    expect(lookup('dignity', 'moon-chart-mode', 'bho')!.text).toContain(loadUi('bho')['charts.moonChartTitle']);
    // Lagna: every record opens with the engine sign name, names the 1st-house lord and ends on a reflective question or reading.
    const SIGNS: [string, string][] = [['mesha', 'मेष'], ['vrishabha', 'वृषभ'], ['mithuna', 'मिथुन'], ['karka', 'कर्क'], ['simha', 'सिंह'], ['kanya', 'कन्या'], ['tula', 'तुला'], ['vrishchika', 'वृश्चिक'], ['dhanu', 'धनु'], ['makara', 'मकर'], ['kumbha', 'कुंभ'], ['meena', 'मीन']];
    for (const [key, name] of SIGNS) {
      const hi = lookup('lagna', `lagna-${key}`, 'hi')!.text;
      expect(hi.startsWith(`${name} लग्न होने पर`), `lagna-${key} hi opens with the sign`).toBe(true);
      expect(hi).toContain('पहले भाव के स्वामी');
      const bho = lookup('lagna', `lagna-${key}`, 'bho')!.text;
      expect(bho.startsWith(`${name} लग्न होखला पर`), `lagna-${key} bho opens with the sign`).toBe(true);
      expect(bho).toContain('पहिला घर के स्वामी');
      expect(bho).not.toMatch(/राउर|रउआ|आपके|आपका/);
    }
    expect(lookup('lagna', 'lagna-mesha', 'hi')!.text).toContain('चिंतन का प्रश्न');
    expect(lookup('lagna', 'lagna-mesha', 'bho')!.text).toContain('सोच-विचार के सवाल');
    expect(lookup('lagna', 'lagna-mesha', 'hi')!.text).toContain('आठवें भाव');
    expect(lookup('lagna', 'lagna-mesha', 'bho')!.text).toContain('आठवाँ घर');
  });

  it('T12: transit is complete in hi and bho; every id resolves in its own language with the English rule and params, the sign-from-Moon ordinals, the Sade Sati / Dhaiya names and the honesty markers', () => {
    const en = CORPUS.transit.en!;
    for (const lang of LANGS) {
      const rows = CORPUS.transit[lang];
      expect(rows, `transit/${lang} registered`).toBeDefined();
      expect(rows!.map((r) => r.id).sort(), `transit/${lang} complete`).toEqual(en.map((r) => r.id).sort());
      for (const r of en) {
        const got = lookup('transit', r.id, lang)!;
        expect(got, `transit/${r.id} ${lang}`).not.toBeNull();
        expect(got.lang, `transit/${r.id} ${lang} resolves in its own language`).toBe(lang);
        expect(got.fallback).toBe(false);
        // `rule` is the English gochara rule sentence and `params` the engine's inputs: metadata, byte-identical.
        expect(got.snippet.rule).toBe(r.rule);
        expect(got.snippet.params).toEqual(r.params);
      }
      // Bhojpuri register: no Hindi है / हैं anywhere in the domain.
      if (lang === 'bho') for (const r of rows!) expect(r.text, `transit/${r.id} bho`).not.toMatch(/(^|\s)(है|हैं)(\s|।|,|;)/);
    }
    // transit-<planet>-<h> address the reader and open with the planet and the ordinal sign from the birth Moon (hi feminine, bho invariable, as the daily Chandra bala fragments).
    const ORD_HI = ['पहली', 'दूसरी', 'तीसरी', 'चौथी', 'पाँचवीं', 'छठी', 'सातवीं', 'आठवीं', 'नौवीं', 'दसवीं', 'ग्यारहवीं', 'बारहवीं'];
    const ORD_BHO = ['पहिला', 'दूसरा', 'तीसरा', 'चउथा', 'पाँचवाँ', 'छठा', 'सातवाँ', 'आठवाँ', 'नउवाँ', 'दसवाँ', 'एगारहवाँ', 'बारहवाँ'];
    const PLANETS: [string, string][] = [['saturn', 'शनि'], ['jupiter', 'गुरु'], ['rahu', 'राहु']];
    for (const [key, name] of PLANETS) {
      for (let h = 1; h <= 12; h++) {
        const hi = lookup('transit', `transit-${key}-${h}`, 'hi')!.text;
        expect(hi.startsWith(`${name} आपके जन्म-चंद्र से ${ORD_HI[h - 1]} राशि में गोचर कर रहे हैं`), `transit-${key}-${h} hi opens with the planet and the ordinal`).toBe(true);
        expect(hi).toContain('के लिए पढ़ा जाता है');
        const bho = lookup('transit', `transit-${key}-${h}`, 'bho')!.text;
        expect(bho.startsWith(`${name} राउर जनम-चंद्र से ${ORD_BHO[h - 1]} राशि में गोचर करत बाड़न`), `transit-${key}-${h} bho opens with the planet and the ordinal`).toBe(true);
        expect(bho).toContain('खातिर पढ़ल जाला');
      }
    }
    // Saturn: the Sade Sati phases and the two Dhaiyas carry the names the daily fragments and the Sade Sati card use.
    expect(lookup('transit', 'transit-saturn-1', 'hi')!.text).toContain('साढ़े साती का मध्य चरण');
    expect(lookup('transit', 'transit-saturn-1', 'bho')!.text).toContain('साढ़े साती के बीच के चरन');
    expect(lookup('transit', 'transit-saturn-2', 'hi')!.text).toContain('साढ़े साती का अंतिम चरण');
    expect(lookup('transit', 'transit-saturn-2', 'bho')!.text).toContain('साढ़े साती के अंतिम चरन');
    expect(lookup('transit', 'transit-saturn-12', 'hi')!.text).toContain('साढ़े साती का आरंभिक चरण');
    expect(lookup('transit', 'transit-saturn-12', 'bho')!.text).toContain('साढ़े साती के शुरुआती चरन');
    expect(lookup('transit', 'transit-saturn-4', 'hi')!.text).toContain('कंटक ढैया');
    expect(lookup('transit', 'transit-saturn-4', 'bho')!.text).toContain('कंटक ढइया');
    expect(lookup('transit', 'transit-saturn-8', 'hi')!.text).toContain('अष्टम ढैया');
    expect(lookup('transit', 'transit-saturn-8', 'bho')!.text).toContain('अष्टम ढइया');
    for (const lang of LANGS) {
      for (const h of [4, 8]) expect(lookup('transit', `transit-saturn-${h}`, lang)!.text).toContain('लगभग ढाई साल');
      // "classically favourable" = the termbank honesty marker (शास्त्रों में / शास्त्र में); Rahu's favourable houses are a convention, so those say परंपरा के चलन से.
      for (const id of ['transit-saturn-6', 'transit-saturn-11', 'transit-jupiter-2', 'transit-jupiter-5', 'transit-jupiter-7', 'transit-jupiter-9', 'transit-jupiter-11']) {
        expect(lookup('transit', id, lang)!.text, `${id} ${lang}`).toContain(lang === 'hi' ? 'शास्त्रों में अनुकूल' : 'शास्त्र में अनुकूल');
      }
      for (const h of [3, 6, 11]) expect(lookup('transit', `transit-rahu-${h}`, lang)!.text, `transit-rahu-${h} ${lang}`).toContain('परंपरा के चलन से अनुकूल');
      // The three Sade Sati phases keep the rules-corpus opening and, like the English, name the natal Moon without a second-person pronoun.
      for (let p = 1; p <= 3; p++) {
        const t = lookup('transit', `sade-sati-phase-${p}`, lang)!.text;
        expect(t.startsWith(lang === 'hi' ? `साढ़े साती का चरण ${p}: शनि जन्म-चंद्र` : `साढ़े साती के चरन ${p}: शनि जनम-चंद्र`), `sade-sati-phase-${p} ${lang}`).toBe(true);
        expect(t).not.toMatch(/राउर|रउआ|आपके|आपका/);
        expect(t).toContain('ढाई साल');
      }
    }
    expect(lookup('transit', 'sade-sati-phase-2', 'hi')!.text).toContain('शास्त्रों में सबसे ज़्यादा माँग');
    expect(lookup('transit', 'sade-sati-phase-2', 'bho')!.text).toContain('शास्त्र में सबले बेसी माँग');
  });

  it('T13: the nakshatra-pada slice is registered in hi and bho with one id set; every translated id resolves in its own language with the English rule, the engine nakshatra / lord / navamsa names and the pada ordinal, and an untranslated id along the chain', () => {
    const en = CORPUS['nakshatra-pada'].en!;
    const hi = CORPUS['nakshatra-pada'].hi!;
    const bho = CORPUS['nakshatra-pada'].bho!;
    expect(hi.length).toBeGreaterThanOrEqual(54);
    expect(hi.length).toBeLessThanOrEqual(en.length);
    expect(bho.map((r) => r.id).sort(), 'nakshatra-pada hi and bho carry the same slice').toEqual(hi.map((r) => r.id).sort());
    const enById = new Map(en.map((r) => [r.id, r]));
    // Masculine ordinals (पद is masculine): hi पहला … चौथा, bho पहिला … चउथा (UI charts.houseOrdinal).
    const PADA_HI = ['पहला', 'दूसरा', 'तीसरा', 'चौथा'];
    const PADA_BHO = ['पहिला', 'दूसरा', 'तीसरा', 'चउथा'];
    for (const lang of LANGS) {
      const names = nakshatraNames[lang];
      const signs = signNames[lang];
      const planets = planetNames[lang];
      for (const row of CORPUS['nakshatra-pada'][lang]!) {
        const master = enById.get(row.id)!;
        const got = lookup('nakshatra-pada', row.id, lang)!;
        expect(got, `nakshatra-pada/${row.id} ${lang}`).not.toBeNull();
        expect(got.lang, `nakshatra-pada/${row.id} ${lang} resolves in its own language`).toBe(lang);
        expect(got.fallback).toBe(false);
        // `rule` is the English rule sentence and `params` the engine inputs: metadata, byte-identical (D3).
        expect(got.snippet.rule).toBe(master.rule);
        expect(got.snippet.params).toEqual(master.params);
        const [, n, p] = row.id.match(/^nakshatra-(\d+)-(\d+)$/)!.map(Number);
        const lord = planets[NAKSHATRA_LORDS[n - 1]];
        const navamsa = signs[((n - 1) * 4 + (p - 1)) % 12];
        const t = got.text;
        // Opening frame: "<Nakshatra> नक्षत्र में चंद्र, जिसके स्वामी <lord> हैं" / "… जेकर स्वामी <lord> बाड़न" (Hasta: स्वयं चंद्र / चंद्र खुदे), the Moon in the respectful plural.
        if (lang === 'hi') expect(t, `${row.id} hi opens with the nakshatra and its lord`).toMatch(new RegExp(`^${names[n - 1]} नक्षत्र में चंद्र, जिसके स्वामी (स्वयं )?${lord} हैं`));
        else expect(t, `${row.id} bho opens with the nakshatra and its lord`).toMatch(new RegExp(`^${names[n - 1]} नक्षत्र में चंद्र, जेकर स्वामी ${lord}( खुदे)? बाड़न`));
        // The pada sentence names the ordinal pada and the engine navamsa sign.
        expect(t, `${row.id} ${lang} names the pada and its navamsa`).toContain(lang === 'hi' ? `${PADA_HI[p - 1]} पद ${navamsa} नवांश में पड़ता है` : `${PADA_BHO[p - 1]} पद ${navamsa} नवांश में पड़ेला`);
        // These paragraphs describe the chart, not the reader: no second-person pronoun; bho carries no Hindi है / हैं.
        expect(t).not.toMatch(/राउर|रउआ|आपके|आपका|आपकी/);
        if (lang === 'bho') expect(t, `nakshatra-pada/${row.id} bho`).not.toMatch(/(^|\s)(है|हैं)(\s|।|,|;)/);
      }
    }
    // Ids outside the integrated slice resolve further down the chain (bho -> hi -> en) and say so.
    const translated = new Set(hi.map((r) => r.id));
    const pending = en.map((r) => r.id).filter((id) => !translated.has(id));
    for (const id of pending.slice(0, 20)) {
      for (const lang of LANGS) {
        const r = lookup('nakshatra-pada', id, lang)!;
        expect(r, `${id} ${lang}`).not.toBeNull();
        expect(r.fallback).toBe(r.lang !== lang);
      }
    }
  });

  it('T14: nakshatra-pada is complete in hi and bho; each nakshatra repeats one opening sentence across its four padas, the Moon-ruled nakshatras say so, and the own-sign / exaltation / last-sign navamsa notes use the engine and UI names', () => {
    const en = CORPUS['nakshatra-pada'].en!;
    for (const lang of LANGS) {
      const rows = CORPUS['nakshatra-pada'][lang]!;
      expect(rows.map((r) => r.id).sort(), `nakshatra-pada/${lang} complete`).toEqual(en.map((r) => r.id).sort());
      // D21: the first sentence of a nakshatra is written once and repeated byte-for-byte in its four padas, so one fix corrects all four.
      const firstByNakshatra = new Map<number, Set<string>>();
      for (const row of rows) {
        const n = Number(row.id.match(/^nakshatra-(\d+)-\d$/)![1]);
        const first = lookup('nakshatra-pada', row.id, lang)!.text.split('। ')[0];
        if (!firstByNakshatra.has(n)) firstByNakshatra.set(n, new Set());
        firstByNakshatra.get(n)!.add(first);
      }
      expect(firstByNakshatra.size).toBe(27);
      for (const [n, firsts] of firstByNakshatra) expect(firsts.size, `nakshatra ${n} ${lang} opening sentence differs between padas`).toBe(1);
    }
    // Rohini (4) and Shravana (22) are ruled by the Moon itself; Rohini's English adds "its own nakshatra".
    const rohiniHi = lookup('nakshatra-pada', 'nakshatra-4-1', 'hi')!;
    expect(rohiniHi.fallback).toBe(false);
    expect(rohiniHi.text).toContain('जिसके स्वामी स्वयं चंद्र हैं, यानी यह उनका अपना नक्षत्र है');
    expect(rohiniHi.text).toContain('बैलगाड़ी');
    const rohiniBho = lookup('nakshatra-pada', 'nakshatra-4-1', 'bho')!;
    expect(rohiniBho.fallback).toBe(false);
    expect(rohiniBho.text).toContain('जेकर स्वामी चंद्र खुदे बाड़न, माने ई उनकर आपन नक्षत्र बा');
    expect(lookup('nakshatra-pada', 'nakshatra-22-1', 'hi')!.text).toContain('जिसके स्वामी स्वयं चंद्र हैं और जिसका प्रतीक कान है');
    expect(lookup('nakshatra-pada', 'nakshatra-22-1', 'bho')!.text).toContain('जेकर स्वामी चंद्र खुदे बाड़न आ जेकर प्रतीक कान बा');
    // "<X>'s own sign" navamsa notes: the Moon (22-4), Rohini (4-2), Shatabhisha (24-3, bho engine name सतभिखा).
    expect(lookup('nakshatra-pada', 'nakshatra-22-4', 'hi')!.text).toContain('कर्क नवांश में पड़ता है, जो चंद्र की अपनी राशि है');
    expect(lookup('nakshatra-pada', 'nakshatra-22-4', 'bho')!.text).toContain('कर्क नवांश में पड़ेला, जे चंद्र के आपन राशि बा');
    expect(lookup('nakshatra-pada', 'nakshatra-4-2', 'hi')!.text).toContain('वृषभ नवांश में पड़ता है, जो रोहिणी की अपनी राशि है');
    expect(lookup('nakshatra-pada', 'nakshatra-4-2', 'bho')!.text).toContain('वृषभ नवांश में पड़ेला, जे रोहिणी के आपन राशि बा');
    expect(nakshatraNames.bho[23]).toBe('सतभिखा');
    expect(lookup('nakshatra-pada', 'nakshatra-24-3', 'hi')!.text).toContain(`कुंभ नवांश में पड़ता है, जो ${nakshatraNames.hi[23]} की अपनी राशि है`);
    expect(lookup('nakshatra-pada', 'nakshatra-24-3', 'bho')!.text).toContain(`कुंभ नवांश में पड़ेला, जे ${nakshatraNames.bho[23]} के आपन राशि बा`);
    // "Jupiter's exaltation sign" uses the dignity sheet's tag (ui dignity.exalted = उच्च in both languages); "the last of the zodiac" = राशिचक्र की / के अंतिम राशि.
    for (const lang of LANGS) {
      expect(loadUi(lang)['dignity.exalted']).toBe('उच्च');
      const punarvasu = lookup('nakshatra-pada', 'nakshatra-7-4', lang)!;
      expect(punarvasu.lang).toBe(lang);
      expect(punarvasu.text).toContain(lang === 'hi' ? 'जो गुरु की उच्च राशि है' : 'जे गुरु के उच्च राशि बा');
      expect(lookup('nakshatra-pada', 'nakshatra-27-4', lang)!.text).toContain(lang === 'hi' ? 'जो राशिचक्र की अंतिम राशि है' : 'जे राशिचक्र के अंतिम राशि बा');
    }
    // The Bhadrapada "cot" legs are चारपाई / खाट, kept distinct from the Phalguni "bed" legs पलंग / खटिया (T13).
    expect(lookup('nakshatra-pada', 'nakshatra-25-1', 'hi')!.text).toContain('चारपाई के अगले पाए');
    expect(lookup('nakshatra-pada', 'nakshatra-26-1', 'hi')!.text).toContain('चारपाई के पिछले पाए');
    expect(lookup('nakshatra-pada', 'nakshatra-25-1', 'bho')!.text).toContain('खाट के अगिला पाया');
    expect(lookup('nakshatra-pada', 'nakshatra-26-1', 'bho')!.text).toContain('खाट के पिछिला पाया');
    expect(lookup('nakshatra-pada', 'nakshatra-11-1', 'hi')!.text).toContain('पलंग के अगले पाए');
    expect(lookup('nakshatra-pada', 'nakshatra-11-1', 'bho')!.text).toContain('खटिया के अगिला पाया');
  });

  it('T15: the planet-sign slice is registered in hi and bho with one id set; every translated id opens with the engine planet and sign names, names the dignity tag the planet sheet shows (or the no-dignity convention for the nodes), keeps the English rule / params, and an untranslated id resolves along the chain', () => {
    const en = CORPUS['planet-sign'].en!;
    const hi = CORPUS['planet-sign'].hi!;
    const bho = CORPUS['planet-sign'].bho!;
    expect(hi.length).toBeGreaterThanOrEqual(54);
    expect(hi.length).toBeLessThanOrEqual(en.length);
    expect(bho.map((r) => r.id).sort(), 'planet-sign hi and bho carry the same slice').toEqual(hi.map((r) => r.id).sort());
    const enById = new Map(en.map((r) => [r.id, r]));
    // Ids are `<planet>-<sign>` with the lowercase English engine names (corpus-interpretive.test.ts).
    const PLANET_BY_KEY = new Map<string, PlanetId>((Object.keys(planetNames.en) as PlanetId[]).map((p) => [planetNames.en[p].toLowerCase(), p]));
    const SIGN_BY_KEY = new Map(signNames.en.map((s, i) => [s.toLowerCase(), i]));
    for (const lang of LANGS) {
      const ui = loadUi(lang);
      // The paragraph sits under the planet sheet's dignity tag, so it names the tag as the sheet prints it (dignity.*, D11).
      const TAG_WORD: Record<string, string> = { exalted: 'उच्च राशि', debilitated: 'नीच राशि', own: ui['dignity.own'], friend: ui['dignity.friend'], enemy: ui['dignity.enemy'], neutral: ui['dignity.neutral'] };
      for (const row of CORPUS['planet-sign'][lang]!) {
        const master = enById.get(row.id)!;
        const got = lookup('planet-sign', row.id, lang)!;
        expect(got, `planet-sign/${row.id} ${lang}`).not.toBeNull();
        expect(got.lang, `planet-sign/${row.id} ${lang} resolves in its own language`).toBe(lang);
        expect(got.fallback).toBe(false);
        // `rule` is the English rule caption, `source` and `params` engine metadata: byte-identical (D3).
        expect(got.snippet.rule).toBe(master.rule);
        expect(got.snippet.source).toBe(master.source);
        expect(got.snippet.params).toEqual(master.params);
        const [, planetKey, signKey] = row.id.match(/^([a-z]+)-([a-z]+)$/)!;
        const planet = PLANET_BY_KEY.get(planetKey)!;
        const signIndex = SIGN_BY_KEY.get(signKey)!;
        const t = got.text;
        // Opening frame: the sheet title order "<planet> <sign> में" (charts.planetInSign) with the engine names, the planet in the respectful plural.
        expect(t.startsWith(`${planetNames[lang][planet]} ${signNames[lang][signIndex]} में`), `${row.id} ${lang} opens with the planet and the sign`).toBe(true);
        const dignity = signDignity(planet, signIndex + 1);
        if (dignity) {
          expect(t, `${row.id} ${lang} names the ${dignity} tag`).toContain(TAG_WORD[dignity]);
          // Friend / enemy / neutral / exalted cite Parashara's table as the English does; own and debilitated do not.
          if (dignity !== 'own' && dignity !== 'debilitated') expect(t, `${row.id} ${lang} cites Parashara`).toContain('पराशर');
        } else {
          // Rahu / Ketu: no sign dignity, by convention; the node is named as the glossary names it (चंद्र-पात).
          expect(t, `${row.id} ${lang} states the no-dignity convention`).toContain('बल-स्थिति');
          expect(t).toContain('परंपरा');
          expect(t).toContain('चंद्र-पात');
        }
        // Honesty markers: "tends to" (प्रायः / अक्सर) and "is read for" in every record; the full "The placement tends to show up as"
        // frame wherever the English uses it (the debilitated records say "so effort / growth / thinking tends to …" instead).
        expect(t).toContain(lang === 'hi' ? 'प्रायः' : 'अक्सर');
        if (/placement tends to show up as/.test(String(master.text))) expect(t, `${row.id} ${lang} keeps the placement frame`).toContain(lang === 'hi' ? 'यह स्थिति प्रायः' : 'ई स्थिति अक्सर');
        else expect(t, `${row.id} ${lang} cites the texts`).toContain(lang === 'hi' ? 'शास्त्रों में' : 'शास्त्र में');
        // "It is read for how …" closes every record except sun-mesha, which ends on "The reflective question is …" (honestyMarkers).
        if (/It is read for/.test(String(master.text))) expect(t).toContain(lang === 'hi' ? 'के लिए पढ़ा जाता है' : 'खातिर पढ़ल जाला');
        else expect(t, `${row.id} ${lang} keeps the reflective question`).toContain(lang === 'hi' ? 'चिंतन का प्रश्न यह है कि' : 'सोच-विचार के सवाल ई बा कि');
        // These paragraphs describe the chart, not the reader: no second-person pronoun; bho carries no Hindi है / हैं.
        expect(t).not.toMatch(/राउर|रउआ|आपके|आपका|आपकी/);
        if (lang === 'bho') expect(t, `planet-sign/${row.id} bho`).not.toMatch(/(^|\s)(है|हैं)(\s|।|,|;)/);
      }
    }
    // Exaltation / debilitation records keep the planet-sheet wording of the dignity.*Desc rows (अपनी / आपन उच्च राशि में).
    expect(lookup('planet-sign', 'jupiter-karka', 'hi')!.text).toContain('अपनी उच्च राशि में');
    expect(lookup('planet-sign', 'jupiter-karka', 'bho')!.text).toContain('आपन उच्च राशि में');
    expect(lookup('planet-sign', 'mars-karka', 'hi')!.text).toContain('मकर में उनकी उच्च राशि के ठीक सामने');
    expect(lookup('planet-sign', 'mars-karka', 'bho')!.text).toContain('मकर में उनकर उच्च राशि के ठीक सामने');
    expect(lookup('planet-sign', 'mercury-kanya', 'hi')!.text).toContain('उच्च का टैग उस पर वरीयता पाता है');
    expect(lookup('planet-sign', 'mercury-kanya', 'bho')!.text).toContain('उच्च के टैग ओह पर वरीयता पावेला');
    // Ids outside the integrated slice resolve further down the chain (bho -> hi -> en) and say so.
    const translated = new Set(hi.map((r) => r.id));
    const pending = en.map((r) => r.id).filter((id) => !translated.has(id));
    for (const id of pending.slice(0, 20)) {
      for (const lang of LANGS) {
        const r = lookup('planet-sign', id, lang)!;
        expect(r, `${id} ${lang}`).not.toBeNull();
        expect(r.fallback).toBe(r.lang !== lang);
      }
    }
  });

  it('T16: planet-sign is complete in hi and bho; the Rahu records open with the north node and keep the three convention sentences apart, "Rahu amplifies" is one fixed clause, the Sun in Mesha closes on the reflective question, the Sun in Vrishabha names the natural enemy, and the exalted / debilitated / own frames hold for the Moon, Saturn, Sun and Venus', () => {
    const en = CORPUS['planet-sign'].en!;
    const enById = new Map(en.map((r) => [r.id, r]));
    for (const lang of LANGS) {
      const rows = CORPUS['planet-sign'][lang]!;
      expect(rows.map((r) => r.id).sort(), `planet-sign/${lang} complete`).toEqual(en.map((r) => r.id).sort());
      const ui = loadUi(lang);
      const hi = lang === 'hi';
      // Rahu: sheet-title opening with the north node as the glossary names it, the English convention sentence variant kept apart (D23), one fixed "Rahu amplifies" clause.
      const CONVENTION: Array<[RegExp, string]> = hi
        ? [[/this app assigns no sign dignity/, 'यह ऐप आम परंपरा के अनुसार पातों को कोई राशि बल-स्थिति नहीं देता'], [/no sign dignity is assigned to the nodes here/, 'यहाँ परंपरा के अनुसार पातों को कोई राशि बल-स्थिति नहीं दी जाती'], [/nodes carry no sign dignity in this app/, 'इस ऐप में परंपरा के अनुसार पातों पर कोई राशि बल-स्थिति नहीं लगती']]
        : [[/this app assigns no sign dignity/, 'ई ऐप आम परंपरा के हिसाब से पात के कवनो राशि बल-स्थिति ना देला'], [/no sign dignity is assigned to the nodes here/, 'इहाँ परंपरा के हिसाब से पात के कवनो राशि बल-स्थिति ना दिहल जाला'], [/nodes carry no sign dignity in this app/, 'ई ऐप में परंपरा के हिसाब से पात पर कवनो राशि बल-स्थिति ना लागे']];
      for (let i = 0; i < 12; i++) {
        const id = `rahu-${signNames.en[i].toLowerCase()}`;
        const master = enById.get(id)!;
        const got = lookup('planet-sign', id, lang)!;
        expect(got.lang, `${id} ${lang}`).toBe(lang);
        expect(got.fallback).toBe(false);
        expect(got.text.startsWith(hi ? `राहु ${signNames.hi[i]} में हैं, यानी उत्तरी चंद्र-पात` : `राहु ${signNames.bho[i]} में बाड़न, माने उत्तर ओर के चंद्र-पात`), `${id} ${lang} opens with the north node`).toBe(true);
        const variant = CONVENTION.find(([re]) => re.test(String(master.text)));
        expect(variant, `${id}: unknown English convention sentence`).toBeDefined();
        expect(got.text, `${id} ${lang} convention sentence`).toContain(variant![1]);
        if (/Rahu amplifies,/.test(String(master.text))) expect(got.text, `${id} ${lang} amplifies clause`).toContain(hi ? 'राहु जिसे छूते हैं उसे बढ़ा देते हैं, इसलिए यह स्थिति प्रायः' : 'राहु जेकरा छूवेलन ओकरा बढ़ा देलन, एह से ई स्थिति अक्सर');
        else expect(got.text, `${id} ${lang} long amplifies clause`).toContain(hi ? 'राहु जिसे भी छूते हैं उसे बढ़ाने और अपरिचित बनाने के रूप में पढ़े जाते हैं' : 'राहु जेकरा भी छूवेलन ओकरा बढ़ावे आ अनजान बनावे के रूप में पढ़ल जालन');
      }
      // Sun in Mesha: the exalted frame in its "read by Parashara's dignity table" form, and the reflective question instead of "It is read for".
      const sunMesha = lookup('planet-sign', 'sun-mesha', lang)!.text;
      expect(sunMesha).toContain(hi ? 'अपनी उच्च राशि में हैं, जिसे पराशर की बल-स्थिति तालिका में सूर्य का पूरा बल पढ़ा जाता है' : 'आपन उच्च राशि में बाड़न, जेकरा पराशर के बल-स्थिति तालिका में सूर्य के पूरा बल पढ़ल जाला');
      expect(sunMesha).toContain(hi ? 'चिंतन का प्रश्न यह है कि' : 'सोच-विचार के सवाल ई बा कि');
      expect(sunMesha).not.toContain(hi ? 'के लिए पढ़ा जाता है' : 'खातिर पढ़ल जाला');
      // Sun in Vrishabha: "a natural enemy in Parashara's table, so the tag reads enemy sign" (ui dignity.enemy).
      expect(lookup('planet-sign', 'sun-vrishabha', lang)!.text).toContain(hi ? `जो पराशर की तालिका में नैसर्गिक शत्रु हैं, इसलिए टैग ${ui['dignity.enemy']} दिखाता है` : `जे पराशर के तालिका में नैसर्गिक शत्रु बाड़न, एह से टैग ${ui['dignity.enemy']} देखावेला`);
      // Sun in Tula: "Classically this is read as …" and the placement frame in one record.
      const sunTula = lookup('planet-sign', 'sun-tula', lang)!.text;
      expect(sunTula).toContain(hi ? 'शास्त्रों में इसे इस रूप में पढ़ा जाता है कि' : 'शास्त्र में एकरा एह रूप में पढ़ल जाला कि');
      expect(sunTula).toContain(hi ? 'यह स्थिति प्रायः' : 'ई स्थिति अक्सर');
      // Exalted / debilitated frames keep the planet-sheet wording (dignity.exaltedDesc / debilitatedDesc) and name the opposite sign.
      for (const [id, planet] of [['moon-vrishabha', 'Mo'], ['saturn-tula', 'Sa'], ['venus-meena', 'Ve']] as Array<[string, PlanetId]>) {
        expect(lookup('planet-sign', id, lang)!.text, `${id} ${lang}`).toContain(hi ? `${ui['dignity.exaltedDesc']} हैं, जो पराशर की बल-स्थिति तालिका में ${planetNames.hi[planet]} का पूरा बल है` : `${ui['dignity.exaltedDesc']} बाड़न, जे पराशर के बल-स्थिति तालिका में ${planetNames.bho[planet]} के पूरा बल बा`);
      }
      for (const [id, opposite] of [['moon-vrishchika', 1], ['saturn-mesha', 6], ['sun-tula', 0], ['venus-kanya', 11]] as Array<[string, number]>) {
        expect(lookup('planet-sign', id, lang)!.text, `${id} ${lang}`).toContain(hi ? `${ui['dignity.debilitatedDesc']} हैं, जो ${signNames.hi[opposite]} में उनकी उच्च राशि के ठीक सामने है` : `${ui['dignity.debilitatedDesc']} बाड़न, जे ${signNames.bho[opposite]} में उनकर उच्च राशि के ठीक सामने बा`);
      }
      // Own-sign frame names the sheet tag (dignity.own).
      for (const id of ['saturn-kumbha', 'saturn-makara', 'sun-simha', 'venus-tula', 'venus-vrishabha']) {
        expect(lookup('planet-sign', id, lang)!.text, `${id} ${lang}`).toContain(hi ? `अपनी ही राशि में हैं, इसलिए बल-स्थिति का टैग ${ui['dignity.own']} दिखाता है` : `आपन राशि में बाड़न, एह से बल-स्थिति के टैग ${ui['dignity.own']} देखावेला`);
      }
    }
  });

  it('T17: the planet-house slice is registered in hi and bho with one id set; every translated id opens with the engine planet name and the house ordinal the planet sheet shows, keeps the "is read for" / placement frames, names the south node only in the Ketu records, keeps the English rule / params, and an untranslated id resolves along the chain', () => {
    const en = CORPUS['planet-house'].en!;
    const hi = CORPUS['planet-house'].hi!;
    const bho = CORPUS['planet-house'].bho!;
    expect(hi.length).toBeGreaterThanOrEqual(54);
    expect(hi.length).toBeLessThanOrEqual(en.length);
    expect(bho.map((r) => r.id).sort(), 'planet-house hi and bho carry the same slice').toEqual(hi.map((r) => r.id).sort());
    const enById = new Map(en.map((r) => [r.id, r]));
    // Ids are `<planet>-<house 1..12>` with the lowercase English engine planet names (corpus-interpretive.test.ts).
    const PLANET_BY_KEY = new Map<string, PlanetId>((Object.keys(planetNames.en) as PlanetId[]).map((p) => [planetNames.en[p].toLowerCase(), p]));
    // The paragraph sits under charts.planetInHouse "{planet} {house} में": Hindi declines the UI ordinal (पहला भाव -> पहले भाव में), Bhojpuri ordinals are invariable (पहिला घर में).
    const HI_OBLIQUE: Record<number, string> = { 1: 'पहले', 2: 'दूसरे', 3: 'तीसरे', 4: 'चौथे', 5: 'पाँचवें', 6: 'छठे', 7: 'सातवें', 8: 'आठवें', 9: 'नौवें', 10: 'दसवें', 11: 'ग्यारहवें', 12: 'बारहवें' };
    for (const lang of LANGS) {
      const ui = loadUi(lang);
      const isHi = lang === 'hi';
      for (const row of CORPUS['planet-house'][lang]!) {
        const master = enById.get(row.id)!;
        const got = lookup('planet-house', row.id, lang)!;
        expect(got, `planet-house/${row.id} ${lang}`).not.toBeNull();
        expect(got.lang, `planet-house/${row.id} ${lang} resolves in its own language`).toBe(lang);
        expect(got.fallback).toBe(false);
        // `rule` is the English rule caption, `source` and `params` engine metadata: byte-identical (D3).
        expect(got.snippet.rule).toBe(master.rule);
        expect(got.snippet.source).toBe(master.source);
        expect(got.snippet.params).toEqual(master.params);
        const [, planetKey, houseStr] = row.id.match(/^([a-z]+)-(\d{1,2})$/)!;
        const planet = PLANET_BY_KEY.get(planetKey)!;
        const house = Number(houseStr);
        const t = got.text;
        // Opening frame: the sheet title order "<planet> <house> में" with the engine planet name, the planet in the respectful plural.
        const opening = isHi ? `${planetNames.hi[planet]} ${HI_OBLIQUE[house]} भाव में हैं` : `${planetNames.bho[planet]} ${ui[`charts.houseOrdinal.${house}`]} में बाड़न`;
        expect(t.startsWith(opening), `${row.id} ${lang} opens "${opening}"`).toBe(true);
        // Honesty markers: "is read for" (opening theme list and the closing "It is read for how") and "The placement tends to show up as".
        expect(t).toContain(isHi ? 'के लिए पढ़ा जाता है' : 'खातिर पढ़ल जाला');
        expect(t, `${row.id} ${lang} keeps the placement frame`).toContain(isHi ? 'यह स्थिति प्रायः' : 'ई स्थिति अक्सर');
        expect(t, `${row.id} ${lang} keeps the closing frame`).toContain(isHi ? 'इसे इस बात के लिए पढ़ा जाता है कि' : 'एकरा एह बात खातिर पढ़ल जाला कि');
        // Ketu: "which the south node detaches from" / "where the south node is classically at ease" (glossary wording for the node); no other planet names the node.
        if (planet === 'Ke') {
          expect(t, `${row.id} ${lang} names the south node`).toContain('चंद्र-पात');
          if (/classically at ease/.test(String(master.text))) expect(t, `${row.id} ${lang} classically at ease`).toContain(isHi ? 'शास्त्रों में सहज माने जाते हैं' : 'शास्त्र में सहज मानल जालन');
          else expect(t, `${row.id} ${lang} detaches`).toContain(isHi ? 'विरक्ति देते हैं' : 'अलगाव देलन');
        } else {
          expect(t).not.toContain('चंद्र-पात');
        }
        // These paragraphs describe the chart, not the reader: no second-person pronoun; bho carries no Hindi है / हैं.
        expect(t).not.toMatch(/राउर|रउआ|आपके|आपका|आपकी/);
        if (lang === 'bho') expect(t, `planet-house/${row.id} bho`).not.toMatch(/(^|\s)(है|हैं)(\s|।|,|;)/);
      }
    }
    // "its natural domain" (Jupiter in the 9th, Mercury in the 3rd) and "the house of effort and courage" (Mars in the 3rd) keep their aside.
    expect(lookup('planet-house', 'jupiter-9', 'hi')!.text).toContain('जो उनका स्वाभाविक क्षेत्र है');
    expect(lookup('planet-house', 'jupiter-9', 'bho')!.text).toContain('जे उनकर आपन सहज क्षेत्र बा');
    expect(lookup('planet-house', 'mercury-3', 'hi')!.text).toContain('जो संवाद का उनका स्वाभाविक क्षेत्र है');
    expect(lookup('planet-house', 'mercury-3', 'bho')!.text).toContain('जे बातचीत के उनकर आपन सहज क्षेत्र बा');
    expect(lookup('planet-house', 'mars-3', 'hi')!.text).toContain('जो परिश्रम और साहस का भाव है');
    expect(lookup('planet-house', 'mars-3', 'bho')!.text).toContain('जे मेहनत आ साहस के घर बा');
    // The 4th-house theme word keeps "home" apart from bhava in Bhojpuri: घर-परिवार / घर-दुआर, while bare घर is the house (चउथा घर में).
    for (const id of ['jupiter-4', 'ketu-4', 'mars-4', 'mercury-4']) {
      const t = lookup('planet-house', id, 'bho')!.text;
      expect(t, `${id} bho`).toContain('घर-परिवार');
      expect(t.replace(/घर-(परिवार|दुआर)/g, '').replace(/चउथा घर में/g, ''), `${id} bho: bare घर only as the bhava`).not.toMatch(/(^|\s)घर(\s|,|।)/);
    }
    // Ids outside the integrated slice resolve further down the chain (bho -> hi -> en) and say so.
    const translated = new Set(hi.map((r) => r.id));
    const pending = en.map((r) => r.id).filter((id) => !translated.has(id));
    for (const id of pending.slice(0, 20)) {
      for (const lang of LANGS) {
        const r = lookup('planet-house', id, lang)!;
        expect(r, `${id} ${lang}`).not.toBeNull();
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
