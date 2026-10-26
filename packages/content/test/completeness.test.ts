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
/** Phase B namespaces (plan.md section 2 i18n; FEAT-B02). */
const PHASE_B_NAMESPACES = ['pro', 'ads', 'unlock', 'vargas', 'kp', 'ashtakavarga', 'varshaphal', 'muhurat', 'travel', 'naamkaran', 'match', 'share', 'pdf', 'report'];
const NAMESPACES = [...PHASE_A_NAMESPACES, ...PHASE_B_NAMESPACES];

describe('UI string completeness', () => {
  it('en, hi and bho have identical key sets', () => {
    const enKeys = Object.keys(en).sort();
    expect(Object.keys(hi).sort()).toEqual(enKeys);
    expect(Object.keys(bho).sort()).toEqual(enKeys);
    expect(enKeys.length).toBeGreaterThan(300);
  });

  it('every Phase A and Phase B namespace is present and no key is outside the declared namespaces', () => {
    const present = new Set(Object.keys(en).map((k) => k.split('.')[0]));
    for (const ns of NAMESPACES) expect(present.has(ns), `namespace ${ns} missing`).toBe(true);
    for (const ns of present) expect(NAMESPACES, `unexpected namespace ${ns}`).toContain(ns);
  });

  it('Phase B binding copy (spec section 9 matrix verbatim, M2 "included in Pro", N5 "All 14 activities", design 5 / 10.6 strings)', () => {
    const rows: [string, string, string][] = [
      ['Kundli D1 + D9, planet table, dignities, yogas, current + next dasha', '✓', '✓'],
      ['Today bar, daily note, panchang sheet, widgets, TTS', '✓', '✓'],
      ['Profiles', '2', 'unlimited'],
      ['Tithi birthday / shraddha / vrat reminders', '5', 'unlimited'],
      ['Muhurat finder', 'today + 7 days', 'any range + .ics'],
      ['Dasha', 'maha + antar', 'pratyantar + alerts'],
      ['Matching', 'scores + summary', 'full explanations + PDF'],
      ['D2–D60 (except D9), KP, Ashtakavarga, Prashna, Varshaphal', '24-h rewarded unlock', '✓'],
      ['Lessons, glossary, journal', '✓', '✓'],
      ['Ask my chart (on-device)', '—', '✓'],
      ['Janam Patri PDF', '₹99', 'included'],
      ['Ads', 'native + banner + capped interstitial + rewarded', 'none'],
    ];
    rows.forEach(([label, free, pro], i) => {
      expect(en[`pro.row.${i + 1}.label`]).toBe(label);
      expect(en[`pro.row.${i + 1}.free`]).toBe(free);
      expect(en[`pro.row.${i + 1}.pro`]).toBe(pro);
    });
    expect(en['pro.includedInPro']).toBe('included in Pro');
    expect(en['pdf.includedInPro']).toBe('included in Pro');
    expect(en['report.includedInPro']).toBe('included in Pro');
    expect(en['pro.recurring']).toBe('Recurring. Cancel in Play → Subscriptions.');
    expect(en['pro.graceNotice']).toBe('Payment issue — update your card in Play');
    expect(en['muhurat.allActivities_chip']).toBe('All 14 activities');
    expect(en['share.codeContains']).toBe('This code contains birth date, time and place but no name.');
    expect(en['ads.label']).toBe('Ad');
    expect(en['ads.proRemoves']).toBe('Pro removes every ad');
    expect(en['ads.removeAds']).toBe('Remove ads');
    expect(en['unlock.row']).toBe('Unlock {feature} · watch an ad · 24 h');
    expect(en['unlock.till']).toBe('unlocked till {time} tomorrow');
    expect(en['unlock.watch']).toBe('Watch an ad · unlock for 24 h');
    expect(en['muhurat.rulesMet']).toBe('{met}/{of} rules met');
    expect(en['muhurat.partialTitle']).toBe('Best partial matches');
    expect(en['match.gunaHeadline']).toBe('{total} of 36 guna');
    expect(en['varshaphal.yearFrom']).toBe('Your Vedic year from {date} · {time}');
    expect(en['pro.storePriceMayDiffer']).toBe('store price may differ');
    // Pro screen never carries testimonials, counts or "most popular" badges (design 5): no such key exists.
    expect(Object.keys(en).filter((k) => /popular|testimonial|usersCount|liveCount/i.test(k))).toEqual([]);
    // Bhojpuri Pro copy addresses the user as रउआ/राउर; Hindi as आप.
    expect(bho['pro.pricesNote']).toMatch(/राउर/);
    expect(bho['unlock.onlyOnTap']).toMatch(/रउआ/);
    expect(hi['unlock.onlyOnTap']).toMatch(/आप/);
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
