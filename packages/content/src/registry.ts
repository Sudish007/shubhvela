// Static registry of every bundled JSON file. Add a line here when a corpus file lands (English masters in
// A06-A08 / B02 / C02; hi/bho drafts after each corpus-translate Action run). Nothing else in the package knows paths.
import type { ContentLanguage, Snippet, UiStrings } from './types';
import en from '../ui/en.json';
import hi from '../ui/hi.json';
import bho from '../ui/bho.json';
import rulesEn from '../corpus/rules/en.json';

export const UI: Record<ContentLanguage, UiStrings> = {
  en: en as UiStrings,
  hi: hi as UiStrings,
  bho: bho as UiStrings,
};

export const CORPUS: Record<string, Partial<Record<ContentLanguage, Snippet[]>>> = {
  rules: { en: rulesEn as Snippet[] },
};
