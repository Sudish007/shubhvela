// Strings for the templates: the app's UI strings (packages/content/ui/<lang>.json, identical key sets in en/hi/bho) plus
// the web-only strings in web/src/strings/<lang>.json. `tr(lang)` returns t(key, params): web string first, then UI string,
// then the English web/UI string, then the key itself (so a missing key is visible, never an empty string).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { REPO_DIR, WEB_DIR, LANGS } from './config.mjs';
import { fill } from './html.mjs';

const cache = new Map();

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function uiStrings(lang) {
  const key = `ui:${lang}`;
  if (!cache.has(key)) cache.set(key, readJson(resolve(REPO_DIR, 'packages', 'content', 'ui', `${lang}.json`)));
  return cache.get(key);
}

export function webStrings(lang) {
  const key = `web:${lang}`;
  if (!cache.has(key)) cache.set(key, readJson(resolve(WEB_DIR, 'src', 'strings', `${lang}.json`)));
  return cache.get(key);
}

function plural(lang, count) {
  if (lang === 'en') return count === 1 ? 'one' : 'other';
  return count === 0 || count === 1 ? 'one' : 'other';
}

/** Translator for one language. t(key, params) with {param} interpolation and `_one/_other` plurals on params.count. */
export function tr(lang) {
  if (!LANGS.includes(lang)) throw new Error(`Unknown language ${lang}`);
  const web = webStrings(lang);
  const ui = uiStrings(lang);
  const webEn = webStrings('en');
  const uiEn = uiStrings('en');
  const lookup = (k) => web[k] ?? ui[k] ?? webEn[k] ?? uiEn[k];
  const t = (key, params) => {
    let k = key;
    if (params && typeof params.count === 'number' && lookup(`${key}_${plural(lang, params.count)}`) !== undefined) {
      k = `${key}_${plural(lang, params.count)}`;
    }
    const s = lookup(k);
    if (s === undefined) return key;
    return params ? fill(s, params) : s;
  };
  t.lang = lang;
  t.has = (key) => lookup(key) !== undefined;
  /** Subset of strings as a plain object (for the client bundle's JSON block). */
  t.pick = (keys) => Object.fromEntries(keys.map((k) => [k, lookup(k) ?? k]));
  return t;
}

/** Devanagari-dominant languages need the Devanagari body face. */
export function isDevanagari(lang) {
  return lang !== 'en';
}
