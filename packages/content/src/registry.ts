// Static registry of every bundled JSON file. Add a line here when a corpus file lands (English masters in
// A06-A08 / B02 / C02; hi/bho drafts after each corpus-translate Action run). Nothing else in the package knows paths.
import type { ContentLanguage, FestivalText, GlossaryEntry, Snippet, UiStrings } from './types';
import en from '../ui/en.json';
import hi from '../ui/hi.json';
import bho from '../ui/bho.json';
import rulesEn from '../corpus/rules/en.json';
import planetSignEn from '../corpus/planet-sign/en.json';
import planetHouseEn from '../corpus/planet-house/en.json';
import dignityEn from '../corpus/dignity/en.json';
import lagnaEn from '../corpus/lagna/en.json';
import nakshatraPadaEn from '../corpus/nakshatra-pada/en.json';
import dashaPairsEn from '../corpus/dasha-pairs/en.json';
import transitEn from '../corpus/transit/en.json';
import dailyEn from '../corpus/daily/en.json';
import vratsEn from '../corpus/vrats/en.json';
import festivalsEn from '../corpus/festivals/en.json';
import glossaryEn from '../corpus/glossary/en.json';

export const UI: Record<ContentLanguage, UiStrings> = {
  en: en as UiStrings,
  hi: hi as UiStrings,
  bho: bho as UiStrings,
};

export const CORPUS: Record<string, Partial<Record<ContentLanguage, Snippet[]>>> = {
  rules: { en: rulesEn as Snippet[] },
  // A06: ids are `<planet>-<sign>` / `<planet>-<house>` with the lowercase English names of the engine locale tables
  // (sun, moon, mars, mercury, jupiter, venus, saturn, rahu, ketu; mesha ... meena), and the engine DignityTag names.
  'planet-sign': { en: planetSignEn as Snippet[] },
  'planet-house': { en: planetHouseEn as Snippet[] },
  dignity: { en: dignityEn as Snippet[] },
  // A07: lagna-<sign> (lowercase engine sign name); nakshatra-<1..27>-<pada 1..4>; dasha-maha-<PlanetId> and the engine's
  // own daily-note keys dasha-<Maha>-<Antar> (ids Su Mo Ma Me Ju Ve Sa Ra Ke); transit-<saturn|jupiter|rahu>-<1..12> +
  // sade-sati-phase-<1..3>; daily = one fragment per engine DAILY_FRAGMENT_KEYS entry (chandra-bala-<h>, tara-bala-<t>,
  // tithi-<t>, nakshatra-<n>, vara-<v>, the special-yoga / bhadra / panchak keys, sade-sati states, day-strength-*).
  lagna: { en: lagnaEn as Snippet[] },
  'nakshatra-pada': { en: nakshatraPadaEn as Snippet[] },
  'dasha-pairs': { en: dashaPairsEn as Snippet[] },
  transit: { en: transitEn as Snippet[] },
  daily: { en: dailyEn as Snippet[] },
  // A08: vrats = one snippet per engine VratFamily with the engine ruleId as id (vrat-ekadashi ... vrat-satyanarayan);
  // `rule` is the timing sentence (same as corpus/rules), `text` the what-to-do paragraph.
  vrats: { en: vratsEn as Snippet[] },
};

/** Festival texts (schema/festival-text.schema.json): one per slug of packages/engine/data/festival-rules.json, id festival-<slug>. */
export const FESTIVALS: Partial<Record<ContentLanguage, FestivalText[]>> = {
  en: festivalsEn as FestivalText[],
};

/** Glossary (schema/glossary.schema.json): ids are plain slugs (tithi, rahu-kaal, sade-sati ...); `related` lists other glossary ids. */
export const GLOSSARY: Partial<Record<ContentLanguage, GlossaryEntry[]>> = {
  en: glossaryEn as GlossaryEntry[],
};
