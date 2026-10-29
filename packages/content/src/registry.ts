// Static registry of every bundled JSON file. Add a line here when a corpus file lands (English masters in
// A06-A08 / B02 / C02; hi + bho files are agent-written translations of the English master, owner decision 2026-10-29,
// one `hi:` / `bho:` key per table as each domain lands — see .agents/tasks/corpus-translate and
// docs/CONTENT-TRANSLATION.md; load.ts resolves bho -> hi -> en per id, so a partial file is fine). Nothing else in the
// package knows paths.
import type { ContentLanguage, FestivalText, GlossaryEntry, Lesson, NaamkaranNames, Snippet, UiStrings } from './types';
import en from '../ui/en.json';
import hi from '../ui/hi.json';
import bho from '../ui/bho.json';
import rulesEn from '../corpus/rules/en.json';
import rulesHi from '../corpus/rules/hi.json';
import rulesBho from '../corpus/rules/bho.json';
import planetSignEn from '../corpus/planet-sign/en.json';
import planetHouseEn from '../corpus/planet-house/en.json';
import dignityEn from '../corpus/dignity/en.json';
import dignityHi from '../corpus/dignity/hi.json';
import dignityBho from '../corpus/dignity/bho.json';
import lagnaEn from '../corpus/lagna/en.json';
import lagnaHi from '../corpus/lagna/hi.json';
import lagnaBho from '../corpus/lagna/bho.json';
import nakshatraPadaEn from '../corpus/nakshatra-pada/en.json';
import nakshatraPadaHi from '../corpus/nakshatra-pada/hi.json';
import nakshatraPadaBho from '../corpus/nakshatra-pada/bho.json';
import dashaPairsEn from '../corpus/dasha-pairs/en.json';
import transitEn from '../corpus/transit/en.json';
import transitHi from '../corpus/transit/hi.json';
import transitBho from '../corpus/transit/bho.json';
import dailyEn from '../corpus/daily/en.json';
import dailyHi from '../corpus/daily/hi.json';
import dailyBho from '../corpus/daily/bho.json';
import vratsEn from '../corpus/vrats/en.json';
import vratsHi from '../corpus/vrats/hi.json';
import vratsBho from '../corpus/vrats/bho.json';
import festivalsEn from '../corpus/festivals/en.json';
import festivalsHi from '../corpus/festivals/hi.json';
import festivalsBho from '../corpus/festivals/bho.json';
import glossaryEn from '../corpus/glossary/en.json';
import glossaryHi from '../corpus/glossary/hi.json';
import glossaryBho from '../corpus/glossary/bho.json';
import yogasEn from '../corpus/yogas/en.json';
import yogasHi from '../corpus/yogas/hi.json';
import yogasBho from '../corpus/yogas/bho.json';
import kootaEn from '../corpus/koota/en.json';
import kootaHi from '../corpus/koota/hi.json';
import kootaBho from '../corpus/koota/bho.json';
import mangalEn from '../corpus/mangal/en.json';
import mangalHi from '../corpus/mangal/hi.json';
import mangalBho from '../corpus/mangal/bho.json';
import muhuratActivitiesEn from '../corpus/muhurat-activities/en.json';
import muhuratActivitiesHi from '../corpus/muhurat-activities/hi.json';
import muhuratActivitiesBho from '../corpus/muhurat-activities/bho.json';
import naamkaranNamesEn from '../corpus/naamkaran-names/en.json';
import dailyThirdEn from '../corpus/daily-third/en.json';
import dailyThirdHi from '../corpus/daily-third/hi.json';
import dailyThirdBho from '../corpus/daily-third/bho.json';
import lessonsEn from '../corpus/lessons/en.json';
import lessonsHi from '../corpus/lessons/hi.json';
import lessonsBho from '../corpus/lessons/bho.json';

export const UI: Record<ContentLanguage, UiStrings> = {
  en: en as UiStrings,
  hi: hi as UiStrings,
  bho: bho as UiStrings,
};

export const CORPUS: Record<string, Partial<Record<ContentLanguage, Snippet[]>>> = {
  // rules hi/bho land in two slices (corpus-translate T02: ids 1-159 sorted, T03: the rest); ruleText falls back per id.
  rules: { en: rulesEn as Snippet[], hi: rulesHi as Snippet[], bho: rulesBho as Snippet[] },
  // A06: ids are `<planet>-<sign>` / `<planet>-<house>` with the lowercase English names of the engine locale tables
  // (sun, moon, mars, mercury, jupiter, venus, saturn, rahu, ketu; mesha ... meena), and the engine DignityTag names.
  // dignity hi/bho are complete (corpus-translate T11); planet-sign / planet-house land in T15-T18.
  'planet-sign': { en: planetSignEn as Snippet[] },
  'planet-house': { en: planetHouseEn as Snippet[] },
  dignity: { en: dignityEn as Snippet[], hi: dignityHi as Snippet[], bho: dignityBho as Snippet[] },
  // A07: lagna-<sign> (lowercase engine sign name); nakshatra-<1..27>-<pada 1..4>; dasha-maha-<PlanetId> and the engine's
  // own daily-note keys dasha-<Maha>-<Antar> (ids Su Mo Ma Me Ju Ve Sa Ra Ke); transit-<saturn|jupiter|rahu>-<1..12> +
  // sade-sati-phase-<1..3>; daily = one fragment per engine DAILY_FRAGMENT_KEYS entry (chandra-bala-<h>, tara-bala-<t>,
  // tithi-<t>, nakshatra-<n>, vara-<v>, the special-yoga / bhadra / panchak keys, sade-sati states, day-strength-*).
  // lagna hi/bho are complete (corpus-translate T11), transit hi/bho too (T12); nakshatra-pada hi/bho land in two slices
  // (T13: ids 1-54 sorted, T14: the rest; lookup falls back per id); dasha-pairs land in T19-T20.
  lagna: { en: lagnaEn as Snippet[], hi: lagnaHi as Snippet[], bho: lagnaBho as Snippet[] },
  'nakshatra-pada': { en: nakshatraPadaEn as Snippet[], hi: nakshatraPadaHi as Snippet[], bho: nakshatraPadaBho as Snippet[] },
  'dasha-pairs': { en: dashaPairsEn as Snippet[] },
  transit: { en: transitEn as Snippet[], hi: transitHi as Snippet[], bho: transitBho as Snippet[] },
  daily: { en: dailyEn as Snippet[], hi: dailyHi as Snippet[], bho: dailyBho as Snippet[] },
  // A08: vrats = one snippet per engine VratFamily with the engine ruleId as id (vrat-ekadashi ... vrat-satyanarayan);
  // `rule` is the timing sentence (same as corpus/rules), `text` the what-to-do paragraph. hi/bho complete (corpus-translate T06).
  vrats: { en: vratsEn as Snippet[], hi: vratsHi as Snippet[], bho: vratsBho as Snippet[] },
  // B02: yogas = one snippet per engine yoga rule id (`yoga-<id>`, the 7 bhanga ids, plus `yoga-kala-amrita` for the
  // reversed Kala Sarpa direction and `yoga-none` for the empty card); koota = `koota-<id>-<level 1|2|3>` for the 8
  // kootas + the 4 KOOTA_EXCEPTION_IDS (level 3); mangal = `mangal-dosha`, `mangal-dosha-none` and the 6
  // `mangal-cancel-*` ids; muhurat-activities = the 14 `muhurat-<activity>` tables, the 10 `muhurat-rule-<rule>` chips
  // and `muhurat-ranking` (N18). koota, mangal and muhurat-activities hi/bho are complete (corpus-translate T06), yogas hi/bho too (T11).
  yogas: { en: yogasEn as Snippet[], hi: yogasHi as Snippet[], bho: yogasBho as Snippet[] },
  koota: { en: kootaEn as Snippet[], hi: kootaHi as Snippet[], bho: kootaBho as Snippet[] },
  mangal: { en: mangalEn as Snippet[], hi: mangalHi as Snippet[], bho: mangalBho as Snippet[] },
  'muhurat-activities': { en: muhuratActivitiesEn as Snippet[], hi: muhuratActivitiesHi as Snippet[], bho: muhuratActivitiesBho as Snippet[] },
  // C02 (carry-over B-REVIEW-MEDIUM-2): third-person variants of the 32 `daily` fragments that address the reader
  // ("your birth Moon"), same ids, params = ['name', ...daily params]. Family Today renders
  // lookup('daily-third', id, lang) ?? lookup('daily', id, lang) for profiles that are not the self profile.
  'daily-third': { en: dailyThirdEn as Snippet[], hi: dailyThirdHi as Snippet[], bho: dailyThirdBho as Snippet[] },
};

/** Lessons (schema/lesson.schema.json): lesson-01 .. lesson-21, bodies with {placeholders} from LESSON_PLACEHOLDERS (src/lessons.ts). hi/bho are complete (corpus-translate T08–T10): the Learn tab renders one whole file, so a lessons translation is registered only when it covers every English id. */
export const LESSONS: Partial<Record<ContentLanguage, Lesson[]>> = {
  en: lessonsEn as Lesson[],
  hi: lessonsHi as Lesson[],
  bho: lessonsBho as Lesson[],
};

/** Naamkaran name lists (schema/naamkaran-names.schema.json): 108 entries `nakshatra-<n>-<pada>`; English only (names are not translated). */
export const NAAMKARAN_NAMES: Partial<Record<ContentLanguage, NaamkaranNames[]>> = {
  en: naamkaranNamesEn as NaamkaranNames[],
};

/** Festival texts (schema/festival-text.schema.json): one per slug of packages/engine/data/festival-rules.json, id festival-<slug>. hi/bho land in two slices (corpus-translate T04: ids 1-51 sorted, T05: the rest); festivalText falls back per slug. */
export const FESTIVALS: Partial<Record<ContentLanguage, FestivalText[]>> = {
  en: festivalsEn as FestivalText[],
  hi: festivalsHi as FestivalText[],
  bho: festivalsBho as FestivalText[],
};

/** Glossary (schema/glossary.schema.json): ids are plain slugs (tithi, rahu-kaal, sade-sati ...); `related` lists other glossary ids. hi/bho are complete (corpus-translate T07): the list screen renders one whole file, so a glossary translation is registered only when it covers every English id. */
export const GLOSSARY: Partial<Record<ContentLanguage, GlossaryEntry[]>> = {
  en: glossaryEn as GlossaryEntry[],
  hi: glossaryHi as GlossaryEntry[],
  bho: glossaryBho as GlossaryEntry[],
};
