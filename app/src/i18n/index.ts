// UI strings for the app: packages/content ui/<lang>.json (identical key sets, tested there), t(key, params) with
// English as the fallback map, and a LangProvider whose setLang() persists to SQLite and re-renders every string.
import { loadUi, t as contentT, type ContentLanguage, type TranslationParams, type UiStrings } from '@shubhvela/content';
import { createContext, createElement, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { hasDb } from '../db/connection';
import { getSetting, setSetting } from '../db/settings';
import { applyPseudo } from './pseudo';

export type Lang = ContentLanguage;
export const LANGS: readonly Lang[] = ['en', 'hi', 'bho'];
export type { TranslationParams };

export type TFn = (key: string, params?: TranslationParams) => string;

const EN: UiStrings = loadUi('en');

export function stringsFor(lang: Lang): UiStrings {
  return applyPseudo(loadUi(lang));
}

/** Pure translate for non-React code (notifications, dev route). */
export function translate(lang: Lang, key: string, params?: TranslationParams): string {
  return contentT(stringsFor(lang), key, params, lang, applyPseudo(EN));
}

export function makeT(lang: Lang): TFn {
  const ui = stringsFor(lang);
  const fallback = applyPseudo(EN);
  return (key, params) => contentT(ui, key, params, lang, fallback);
}

/** Persisted language, read synchronously; 'en' before the database exists (tests) or on a fresh install. */
export function readInitialLang(): Lang {
  try {
    return hasDb() ? getSetting('language') : 'en';
  } catch {
    return 'en';
  }
}

export interface LangContextValue {
  lang: Lang;
  t: TFn;
  setLang: (lang: Lang) => void;
}

const LangContext = createContext<LangContextValue | null>(null);

export interface LangProviderProps {
  children: ReactNode;
  /** Override for tests and the dev route; defaults to the persisted setting. */
  initialLang?: Lang;
}

export function LangProvider({ children, initialLang }: LangProviderProps) {
  const [lang, setLangState] = useState<Lang>(() => initialLang ?? readInitialLang());
  const setLang = useCallback((next: Lang) => {
    if (hasDb()) setSetting('language', next);
    setLangState(next);
  }, []);
  const value = useMemo<LangContextValue>(() => ({ lang, t: makeT(lang), setLang }), [lang, setLang]);
  return createElement(LangContext.Provider, { value }, children);
}

export function useLang(): LangContextValue {
  const v = useContext(LangContext);
  if (!v) {
    // Outside a provider (unit tests of leaf components): English, non-persisting.
    return { lang: 'en', t: makeT('en'), setLang: () => {} };
  }
  return v;
}

export function useT(): TFn {
  return useLang().t;
}

/** Devanagari UI languages share the Noto Sans Devanagari body face (design.md 2.2). */
export function isDevanagari(lang: Lang): boolean {
  return lang !== 'en';
}
