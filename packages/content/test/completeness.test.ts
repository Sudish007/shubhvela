import { describe, expect, it } from 'vitest';
import { CONTENT_LANGUAGES, loadUi, paramsOf, visibleLength, pseudoLocale, pseudoString, t, pluralCategory } from '../src/index';

const en = loadUi('en');
const hi = loadUi('hi');
const bho = loadUi('bho');

/** Key-suffix budgets for strings that live in constrained boxes (README "Constrained-box key convention"). */
const BUDGETS: [RegExp, number, string][] = [
  [/^tabs\./, 12, 'tab label'],
  [/_band$/, 10, 'inline band label'],
  [/_tag$/, 14, 'tag'],
  [/^dignity\.[a-z]+$/, 14, 'dignity tag'],
  [/_chip$/, 18, 'chip'],
  [/_col$/, 20, 'table header'],
];

const PHASE_A_NAMESPACES = [
  'common', 'tabs', 'onboarding', 'consent', 'today', 'band', 'verdict', 'panchang', 'note', 'upcoming', 'charts', 'dignity', 'dasha',
  'sadesati', 'family', 'events', 'vrat', 'calendar', 'reminders', 'settings', 'privacy', 'disclaimer', 'about', 'errors',
];

describe('UI string completeness', () => {
  it('en, hi and bho have identical key sets', () => {
    const enKeys = Object.keys(en).sort();
    expect(Object.keys(hi).sort()).toEqual(enKeys);
    expect(Object.keys(bho).sort()).toEqual(enKeys);
    expect(enKeys.length).toBeGreaterThan(300);
  });

  it('every Phase A namespace is present and no key is outside the declared namespaces', () => {
    const present = new Set(Object.keys(en).map((k) => k.split('.')[0]));
    for (const ns of PHASE_A_NAMESPACES) expect(present.has(ns), `namespace ${ns} missing`).toBe(true);
    for (const ns of present) expect(PHASE_A_NAMESPACES, `unexpected namespace ${ns}`).toContain(ns);
  });

  it('no string is empty or whitespace in any language', () => {
    for (const lang of CONTENT_LANGUAGES) for (const [k, v] of Object.entries(loadUi(lang))) expect(v.trim(), `${lang}:${k}`).not.toBe('');
  });

  it('every {param} in en appears in hi and bho, and vice versa', () => {
    for (const k of Object.keys(en)) {
      const p = paramsOf(en[k]).sort();
      expect(paramsOf(hi[k]).sort(), `hi:${k}`).toEqual(p);
      expect(paramsOf(bho[k]).sort(), `bho:${k}`).toEqual(p);
    }
  });

  it('plural keys come in _one/_other pairs', () => {
    for (const k of Object.keys(en)) {
      if (k.endsWith('_one')) expect(en[k.replace(/_one$/, '_other')], `${k} lacks _other`).toBeDefined();
      if (k.endsWith('_other')) expect(en[k.replace(/_other$/, '_one')], `${k} lacks _one`).toBeDefined();
    }
  });

  it('constrained-box strings respect their length budgets in all three languages', () => {
    const over: string[] = [];
    for (const lang of CONTENT_LANGUAGES) {
      const ui = loadUi(lang);
      for (const [k, v] of Object.entries(ui)) {
        for (const [re, max, label] of BUDGETS) {
          if (re.test(k) && visibleLength(v) > max) over.push(`${lang}:${k} (${label}) ${visibleLength(v)} > ${max}: "${v}"`);
        }
      }
    }
    expect(over, over.join('\n')).toEqual([]);
  });

  it('design.md section 4 dignity vocabulary is exact', () => {
    const table: Record<string, [string, string, string]> = {
      exalted: ['exalted', 'उच्च', 'उच्च'],
      debilitated: ['debilitated', 'नीच राशि', 'नीच राशि'],
      own: ['own sign', 'स्वराशि', 'आपन राशि'],
      friend: ["friend's sign", 'मित्र राशि', 'मित्र राशि'],
      enemy: ['enemy sign', 'शत्रु राशि', 'शत्रु राशि'],
      neutral: ['neutral', 'सम राशि', 'सम राशि'],
      combust: ['combust', 'अस्त', 'अस्त'],
      retro: ['R retrograde', 'R वक्री', 'R वक्री'],
      vargottama: ['vargottama', 'वर्गोत्तम', 'वर्गोत्तम'],
      approx: ['approx.', 'लगभग', 'लगभग'],
    };
    for (const [key, [e, h, b]] of Object.entries(table)) {
      expect(en[`dignity.${key}`]).toBe(e);
      expect(hi[`dignity.${key}`]).toBe(h);
      expect(bho[`dignity.${key}`]).toBe(b);
    }
  });

  it('honesty-marker strings from design.md 6/7 are present', () => {
    expect(en['common.why']).toBe('Why?');
    expect(hi['common.why']).toBe('क्यों?');
    expect(bho['common.why']).toBe('काहे?');
    expect(en['common.approx']).toBe('approx.');
    expect(en['common.howComputed']).toBe('How this was computed');
    expect(en['today.noteFooter']).toBe("Guidance for reflection, computed from your chart and today's sky. Not a prediction.");
    expect(en['band.nightLegend']).toBe('Night (pattern = verdict)');
    expect(bho['verdict.avoid']).toBe('बचीं');
    expect(hi['verdict.avoid']).toBe('टालें');
    expect(bho['today.yourMoon']).toContain('राउर');
    expect(en['family.addMember']).toBe('Add family member');
    expect(en['charts.moonUnknownTime']).toBe('Moon chart · birth time unknown');
    expect(en['errors.placeEmpty']).toBe('No town found — try the nearest larger town or search online');
    for (const k of ['consent.whatStored', 'consent.where', 'consent.delete', 'consent.grievance', 'consent.leaves']) expect(en[k]).toBeTruthy();
    for (const k of ['disclaimer.reflection', 'disclaimer.notAdvice', 'disclaimer.noGuarantee']) for (const ui of [en, hi, bho]) expect(ui[k]).toBeTruthy();
  });
});

describe('t()', () => {
  it('interpolates params and leaves unknown placeholders visible', () => {
    expect(t(en, 'today.yourMoon', { sign: 'Vrishchika', nakshatra: 'Anuradha' })).toBe('Your Moon: Vrishchika · Anuradha');
    expect(t(en, 'today.flagPanchak', {})).toBe('Panchak till {until}');
  });
  it('returns the key for unknown keys and falls back to English', () => {
    expect(t(hi, 'nope.missing')).toBe('nope.missing');
    expect(t({}, 'common.why', undefined, 'hi', en)).toBe('Why?');
  });
  it('chooses plural forms by language', () => {
    expect(t(en, 'common.inDays', { count: 1 })).toBe('in 1 day');
    expect(t(en, 'common.inDays', { count: 3 })).toBe('in 3 days');
    expect(pluralCategory('hi', 0)).toBe('one');
    expect(pluralCategory('en', 0)).toBe('other');
    expect(t(hi, 'common.months', { count: 2 }, 'hi')).toBe('2 महीने');
  });
});

describe('pseudoLocale', () => {
  it('expands every string by about 30 % and keeps params intact', () => {
    const p = pseudoLocale(en, 1.3);
    expect(Object.keys(p)).toEqual(Object.keys(en));
    for (const [k, v] of Object.entries(en)) {
      expect(paramsOf(p[k])).toEqual(paramsOf(v));
      expect(visibleLength(p[k])).toBeGreaterThanOrEqual(Math.ceil(visibleLength(v) * 1.3));
    }
    expect(pseudoString('Today')).toBe('Today x');
  });
});
