// Static registry of every bundled JSON file. Add a line here when a corpus file lands (English masters in
// A06-A08 / B02 / C02; hi/bho drafts after each corpus-translate Action run). Nothing else in the package knows paths.
import type { ContentLanguage, Snippet, UiStrings } from './types';
import en from '../ui/en.json';
import hi from '../ui/hi.json';
import bho from '../ui/bho.json';
import rulesEn from '../corpus/rules/en.json';
import planetSignEn from '../corpus/planet-sign/en.json';
import planetHouseEn from '../corpus/planet-house/en.json';
import dignityEn from '../corpus/dignity/en.json';

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
};
