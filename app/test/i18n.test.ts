// i18n: the three UI files import with identical key sets, every literal t('...') key used by the app exists, the
// pseudo-locale pads +30 %, and fonts resolve per language (Tiro display everywhere, Noto Sans / Noto Sans Devanagari body).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { loadUi } from '@shubhvela/content';
import { LANGS, makeT, stringsFor, translate } from '../src/i18n';
import { fontFamilyFor, textStyle } from '../src/theme/typography';

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

describe('i18n', () => {
  it('en, hi, bho import with identical key sets', () => {
    const en = Object.keys(loadUi('en')).sort();
    for (const l of LANGS) expect(Object.keys(loadUi(l)).sort()).toEqual(en);
  });

  it('every literal t("...") key in app/app and app/src exists in en.json', () => {
    const en = loadUi('en');
    const files = [...walk(join(__dirname, '..', 'app')), ...walk(join(__dirname, '..', 'src'))];
    const missing: string[] = [];
    for (const f of files) {
      const src = readFileSync(f, 'utf8');
      for (const m of src.matchAll(/\bt[l]?\(\s*'([a-zA-Z0-9_.]+)'/g)) {
        if (!(m[1] in en) && !(`${m[1]}_one` in en)) missing.push(`${f}: ${m[1]}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('settingsLabels keys exist', () => {
    const en = loadUi('en');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const labels = require('../src/settingsLabels') as Record<string, Record<string, string> | ((s: string) => string)>;
    for (const [name, map] of Object.entries(labels)) {
      if (typeof map === 'function') continue;
      for (const key of Object.values(map)) expect([name, key, en[key] !== undefined]).toEqual([name, key, true]);
    }
  });

  it('t interpolates and falls back to English for a missing key', () => {
    expect(translate('hi', 'onboarding.step', { n: 2, total: 3 })).toBe(loadUi('hi')['onboarding.step'].replace('{n}', '2').replace('{total}', '3'));
    expect(makeT('bho')('common.why')).toBe(loadUi('bho')['common.why']);
    expect(makeT('bho')('nope.missing')).toBe('nope.missing');
  });

  it('pseudo-locale pads every string by about 30 %', () => {
    globalThis.__PSEUDO_LOCALE__ = true;
    try {
      const en = loadUi('en');
      const pseudo = stringsFor('en');
      for (const k of ['common.why', 'onboarding.birthTitle', 'consent.whatStored']) {
        expect(pseudo[k].startsWith(en[k])).toBe(true);
        expect(Array.from(pseudo[k]).length).toBeGreaterThanOrEqual(Math.ceil(Array.from(en[k]).length * 1.3) - 1);
      }
    } finally {
      globalThis.__PSEUDO_LOCALE__ = undefined;
    }
  });

  it('resolves fonts: Tiro for display in every language; Noto Sans (en) / Noto Sans Devanagari (hi, bho) body; 600 = SemiBold face', () => {
    for (const l of LANGS) expect(fontFamilyFor('display', l, 400)).toBe('TiroDevanagariHindi');
    expect(fontFamilyFor('body', 'en', 400)).toBe('NotoSans');
    expect(fontFamilyFor('body', 'en', 600)).toBe('NotoSans-SemiBold');
    expect(fontFamilyFor('body', 'hi', 400)).toBe('NotoSansDevanagari');
    expect(fontFamilyFor('body', 'bho', 600)).toBe('NotoSansDevanagari-SemiBold');
    expect(fontFamilyFor('body', 'hi', 400, true)).toBe('NotoSans');
    expect(textStyle('body', 'hi')).toMatchObject({ fontSize: 17, lineHeight: 28, fontFamily: 'NotoSansDevanagari' });
    expect(textStyle('body', 'en')).toMatchObject({ fontSize: 17, lineHeight: 26, fontFamily: 'NotoSans' });
    expect(textStyle('micro', 'bho').fontSize).toBe(12);
  });
});
