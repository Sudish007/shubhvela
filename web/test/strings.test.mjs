// Web-only strings (web/src/strings/<lang>.json): identical key sets, Devanagari register for hi/bho, no forbidden
// claims or percentage claims in any language (spec 7 register rules, build-rules corpus rules), the 331-city count and
// the client key list resolvable in every language.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEVANAGARI_MIN_RATIO, LATIN_ALLOWLIST, forbiddenHits, hasPercentClaim, maithiliHits } from '../../packages/content-tools/src/forbidden.ts';
import { CLIENT_KEYS } from '../src/client-keys.mjs';
import { tr } from '../src/i18n.mjs';

const DIR = resolve(__dirname, '..', 'src', 'strings');
const load = (lang) => JSON.parse(readFileSync(resolve(DIR, `${lang}.json`), 'utf8'));
const en = load('en');
const hi = load('hi');
const bho = load('bho');

/** Latin technical terms the web copy needs beyond the content allow-list (brand/product names, standards, file words). */
const WEB_LATIN = [
  'GitHub Pages', 'GitHub', 'Store', 'Billing', 'SDK', 'EEA', 'UK', 'URL', 'MIT', 'OFL', 'IANA', 'EN', 'true', 'D1', 'D9',
  'Chitrapaksha', 'Lahiri', 'Raman', 'Drik Panchang', 'Wi-Fi', 'RAM', 'GB', 'PDF', 'QR', 'JSON', 'tz',
];
const ALLOW = [...LATIN_ALLOWLIST, ...WEB_LATIN].sort((a, b) => b.length - a.length);
function devanagariDominant(s, min) {
  let t = s.replace(/\{[a-zA-Z0-9_]+\}/g, ' ');
  for (const term of ALLOW) t = t.split(term).join(' ');
  const dev = (t.match(/[\u0900-\u097F]/g) ?? []).length;
  const lat = (t.match(/[A-Za-z]/g) ?? []).length;
  return dev + lat === 0 || dev / (dev + lat) >= min;
}
/** Keys whose value is a code, a URL fragment or the product name in Latin by design. */
const LATIN_OK = new Set(['site.name', 'site.playUrl', 'site.grievanceEmail', 'lang.en', 'lang.hi', 'lang.bho', 'mini.nextDay', 'mini.none', 'form.placePicked', 'result.placeCoords', 'result.bornLine', 'result.bornLineUnknown', 'home.festivalLine', 'result.styleTag', 'theme.dark', 'theme.light']);

describe('web strings', () => {
  it('have identical key sets in en, hi and bho with no empty values (except the Play URL placeholder)', () => {
    const keys = Object.keys(en).sort();
    expect(Object.keys(hi).sort()).toEqual(keys);
    expect(Object.keys(bho).sort()).toEqual(keys);
    for (const [lang, table] of Object.entries({ en, hi, bho })) {
      for (const [k, v] of Object.entries(table)) {
        if (k === 'site.playUrl') continue;
        expect(typeof v === 'string' && v.trim().length > 0, `${lang} ${k}`).toBe(true);
      }
    }
  });

  it('keep every {param} of the English string in hi and bho', () => {
    for (const [k, v] of Object.entries(en)) {
      const params = [...v.matchAll(/\{([a-zA-Z0-9_]+)\}/g)].map((m) => m[1]).sort();
      for (const [lang, table] of Object.entries({ hi, bho })) {
        const got = [...table[k].matchAll(/\{([a-zA-Z0-9_]+)\}/g)].map((m) => m[1]).sort();
        expect(got, `${lang} ${k}`).toEqual(params);
      }
    }
  });

  it('hi and bho are Devanagari-dominant apart from allow-listed technical terms', () => {
    for (const [lang, table] of Object.entries({ hi, bho })) {
      const bad = Object.entries(table).filter(([k, v]) => !LATIN_OK.has(k) && !devanagariDominant(v, DEVANAGARI_MIN_RATIO[lang])).map(([k, v]) => `${k}: ${v}`);
      expect(bad, bad.join('\n')).toEqual([]);
    }
  });

  it('bho uses the respectful register: no Hindi आप forms, no Hindi है/हैं/करें, no Maithili forms; रउआ/राउर present', () => {
    const hindiPronoun = Object.entries(bho).filter(([, v]) => /(^|[\s,.;:!?()“”"'-])(आप|आपका|आपकी|आपके|आपको)(?=$|[\s,.;:!?()“”"'-])/u.test(v));
    expect(hindiPronoun.map(([k]) => k)).toEqual([]);
    const hindiVerbs = Object.entries(bho).filter(([, v]) => /(^|\s)(है|हैं|करें|देखें|खोलें|चुनें|लिखें)(?=$|[\s,.;:!?()।])/u.test(v));
    expect(hindiVerbs.map(([k]) => k)).toEqual([]);
    const maithili = Object.entries(bho).filter(([, v]) => maithiliHits(v).length > 0);
    expect(maithili.map(([k]) => k)).toEqual([]);
    expect(Object.values(bho).some((v) => /राउर/.test(v))).toBe(true);
    expect(Object.values(bho).some((v) => /रउआ/.test(v))).toBe(true);
  });

  it('hi uses the respectful आप register (no तू/तुम)', () => {
    const informal = Object.entries(hi).filter(([, v]) => /(^|[\s,.;:!?()“”"'-])(तू|तुम|तुम्हारा|तुम्हारी|तेरा|तेरी)(?=$|[\s,.;:!?()“”"'-])/u.test(v));
    expect(informal.map(([k]) => k)).toEqual([]);
  });

  it('carry no forbidden claim and no percentage claim in any language (D8)', () => {
    for (const [lang, table] of Object.entries({ en, hi, bho })) {
      const bad = [];
      for (const [k, v] of Object.entries(table)) {
        const hits = forbiddenHits(v, lang);
        if (hits.length) bad.push(`${k}: ${hits.join(', ')}`);
        if (hasPercentClaim(v)) bad.push(`${k}: percentage claim`);
      }
      expect(bad, bad.join('\n')).toEqual([]);
    }
  });

  it('say 331 cities everywhere the English copy does (N5) and never mention a feature outside F1-F43', () => {
    const count = (table) => Object.values(table).filter((v) => /331/.test(v)).length;
    expect(count(en)).toBeGreaterThan(0);
    expect(count(hi)).toBe(count(en));
    expect(count(bho)).toBe(count(en));
    for (const table of [en, hi, bho]) {
      for (const v of Object.values(table)) expect(v).not.toMatch(/rectif|tarot|numerolog|testimonial/i);
    }
  });

  it('resolve every client key and the UI strings the templates use in all three languages', () => {
    for (const lang of ['en', 'hi', 'bho']) {
      const t = tr(lang);
      for (const key of [...CLIENT_KEYS, 'settings.lang.en', 'settings.lang.hi', 'settings.lang.bho', 'onboarding.birthDate', 'onboarding.place', 'settings.nodes', 'charts.styleNorth', 'common.optional']) {
        expect(t.has(key), `${lang} ${key}`).toBe(true);
      }
      expect(t('nav.kundli')).not.toBe('nav.kundli');
    }
  });
});
