// t(): key lookup with `{param}` interpolation and `_one` / `_other` plurals; pseudoLocale(): +30 % layout test strings.
import type { ContentLanguage, TranslationParams, UiStrings } from './types';

const PARAM_RE = /\{([a-zA-Z0-9_]+)\}/g;

/**
 * CLDR plural category for the three locales. English: one = exactly 1. Hindi (and Bhojpuri, which follows it):
 * one = 0 or 1. Only `one` and `other` exist in the three languages.
 */
export function pluralCategory(lang: ContentLanguage, count: number): 'one' | 'other' {
  if (lang === 'en') return count === 1 ? 'one' : 'other';
  return count === 0 || count === 1 ? 'one' : 'other';
}

export function interpolate(template: string, params?: TranslationParams): string {
  if (!params) return template;
  return template.replace(PARAM_RE, (whole, name: string) => {
    const v = params[name];
    return v === undefined || v === null ? whole : String(v);
  });
}

/**
 * Resolves `key` in `ui`. When `params.count` is a number and `<key>_one` / `<key>_other` exist, the plural form is
 * chosen for `lang`. Missing keys return the key itself (visible in dev, never an empty string). `fallback` (normally
 * the English map) is consulted before giving up.
 */
export function t(ui: UiStrings, key: string, params?: TranslationParams, lang: ContentLanguage = 'en', fallback?: UiStrings): string {
  const count = params?.count;
  if (typeof count === 'number') {
    const cat = pluralCategory(lang, count);
    const pk = `${key}_${cat}`;
    const plural = ui[pk] ?? ui[`${key}_other`] ?? fallback?.[pk] ?? fallback?.[`${key}_other`];
    if (plural !== undefined) return interpolate(plural, params);
  }
  const s = ui[key] ?? fallback?.[key];
  if (s === undefined) return key;
  return interpolate(s, params);
}

/** Lists the `{param}` names used by a string, in order of first appearance. */
export function paramsOf(template: string): string[] {
  const out: string[] = [];
  for (const m of template.matchAll(PARAM_RE)) if (!out.includes(m[1])) out.push(m[1]);
  return out;
}

/** Visible length of a string for the layout budget: code points, with `{params}` counted as 6 characters each. */
export function visibleLength(s: string): number {
  return Array.from(s.replace(PARAM_RE, 'xxxxxx')).length;
}

/**
 * Pseudo-locale for the +30 % layout test (design.md 7): every string is padded to `factor` x its visible length
 * with trailing letters so wrapping and truncation show up in snapshots. `{params}` are preserved untouched.
 */
export function pseudoLocale(ui: UiStrings, factor = 1.3): UiStrings {
  const out: UiStrings = {};
  for (const [k, v] of Object.entries(ui)) out[k] = pseudoString(v, factor);
  return out;
}

export function pseudoString(s: string, factor = 1.3): string {
  const len = visibleLength(s);
  if (len === 0) return s;
  const extra = Math.max(1, Math.ceil(len * factor) - len);
  return `${s} ${'x'.repeat(Math.max(0, extra - 1))}`;
}
