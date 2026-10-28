// Grounded prompt for "Ask my chart" (spec F35, design.md 10.7, plan C04): system rules (the corpus `rules` domain,
// ASK_RULE_IDS minus the label) + the computed chart as compact JSON (planets, houses, running dasha, today's daily
// rule ids) + ONLY the corpus snippets whose ids match what the question names (planets, signs, houses/themes), always
// with the Lagna, the Moon and the running dasha pair as the baseline, trimmed to the model's budget. The snippet ids
// and the rule ids go back to the UI, which prints "Rules used" under every answer. No React, pure functions.
import { ASK_RULE_IDS, locale, type ChartData, type DailyRule, type DashaTree, type PlanetId } from '@shubhvela/engine';
import { lookup, ruleText } from '@shubhvela/content';
import { lagnaId, planetHouseId, planetSignId, PLANET_SLUG } from '../charts/model';
import type { Lang } from '../i18n';

/** Design.md 11: a question is at most 300 characters. */
export const ASK_MAX = 300;
/**
 * Characters of prompt the 2048-token session (bridge LOAD_OPTIONS.maxTokens, prefill + decode) leaves room for:
 * ~5,600 characters is about 1,400 tokens of English/JSON, keeping ~600 tokens for the answer.
 */
export const PROMPT_CHAR_BUDGET = 5600;

export type AskQuestionProblem = 'empty' | 'tooLong';

export function validateAskQuestion(q: string): AskQuestionProblem | null {
  const n = Array.from(q.trim()).length;
  if (n === 0) return 'empty';
  if (n > ASK_MAX) return 'tooLong';
  return null;
}

/** The six system rules the model is given (the seventh id, `ask-label`, is the UI banner). */
export const SYSTEM_RULE_IDS: readonly string[] = ASK_RULE_IDS.filter((id) => id !== 'ask-label');

/** English keywords -> whole-sign houses the question is about (Parashara's house significations, kept short). */
const HOUSE_THEMES: Record<string, number[]> = {
  career: [10],
  job: [10, 6],
  work: [10, 6],
  profession: [10],
  business: [7, 10],
  money: [2, 11],
  wealth: [2, 11],
  income: [2, 11],
  savings: [2],
  debt: [6],
  marriage: [7],
  partner: [7],
  spouse: [7],
  husband: [7],
  wife: [7],
  relationship: [7, 5],
  love: [5, 7],
  children: [5],
  child: [5],
  education: [4, 5],
  study: [4, 5],
  studies: [4, 5],
  exam: [5],
  home: [4],
  property: [4],
  mother: [4],
  father: [9],
  family: [2, 4],
  siblings: [3],
  brother: [3],
  sister: [3],
  health: [1, 6],
  body: [1],
  travel: [9, 12],
  abroad: [12, 9],
  foreign: [12],
  spiritual: [9, 12],
  dharma: [9],
  luck: [9],
  fortune: [9],
  enemies: [6],
  court: [6],
  loss: [12],
  expenses: [12],
  friends: [11],
  gains: [11],
  self: [1],
  personality: [1],
  // Hindi / Bhojpuri (Devanagari) themes
  नौकरी: [10, 6],
  काम: [10, 6],
  करियर: [10],
  व्यापार: [7, 10],
  धन: [2, 11],
  पैसा: [2, 11],
  विवाह: [7],
  शादी: [7],
  पति: [7],
  पत्नी: [7],
  संतान: [5],
  बच्चे: [5],
  पढ़ाई: [4, 5],
  शिक्षा: [4, 5],
  घर: [4],
  माता: [4],
  माँ: [4],
  पिता: [9],
  भाई: [3],
  बहन: [3],
  स्वास्थ्य: [1, 6],
  सेहत: [1, 6],
  यात्रा: [9, 12],
  विदेश: [12],
  भाग्य: [9],
};

function wordsOf(question: string): string[] {
  return question
    .toLowerCase()
    .split(/[^\p{L}\p{M}\p{N}]+/u)
    .filter(Boolean);
}

/** Planet ids named in the question (English names and the engine's hi/bho names). */
export function detectPlanets(question: string, lang: Lang): PlanetId[] {
  const words = new Set(wordsOf(question));
  const found: PlanetId[] = [];
  for (const id of Object.keys(PLANET_SLUG) as PlanetId[]) {
    const names = new Set<string>([PLANET_SLUG[id], locale.planetNames.en[id].toLowerCase(), locale.planetNames[lang][id].toLowerCase()]);
    if ([...names].some((n) => words.has(n))) found.push(id);
  }
  return found;
}

/** Signs (1-12) named in the question (Sanskrit names in English transliteration plus the UI language's names). */
export function detectSigns(question: string, lang: Lang): number[] {
  const words = new Set(wordsOf(question));
  const out: number[] = [];
  for (let i = 0; i < 12; i++) {
    const names = [locale.signNames.en[i].toLowerCase(), locale.signNames[lang][i].toLowerCase()];
    if (names.some((n) => words.has(n))) out.push(i + 1);
  }
  return out;
}

/** Houses the question is about: explicit "7th house" style mentions plus theme keywords. */
export function detectHouses(question: string): number[] {
  const out = new Set<number>();
  for (const m of question.matchAll(/\b(1[0-2]|[1-9])(?:st|nd|rd|th)?\s*(?:house|bhava|भाव)/giu)) out.add(Number(m[1]));
  for (const w of wordsOf(question)) {
    const houses = HOUSE_THEMES[w];
    if (houses) houses.forEach((h) => out.add(h));
  }
  return [...out].sort((a, b) => a - b);
}

export interface ChartPlanetJson {
  id: PlanetId;
  sign: string;
  deg: number;
  house: number;
  nak: string;
  pada: number;
  /** Dignity / state tags; omitted when empty. */
  tags?: string[];
  /** Present (true) only for a retrograde planet. */
  retro?: true;
}

export interface ChartJson {
  lagna: { sign: string; deg: number; approx: boolean } | null;
  moonChart: boolean;
  planets: ChartPlanetJson[];
  /** House number -> "Sign/Lord" (occupants follow from the planets' houses). */
  houses: Record<string, string>;
  dasha: { maha: PlanetId; antar: PlanetId; antarEnds: string } | null;
  today: string[];
  ayanamsa: string;
}

/** The compact, lossless-enough JSON the model reads (English sign/nakshatra names: the corpus ids use them). */
export function chartJson(chart: ChartData, tree: DashaTree | null, nowMs: number, today: readonly DailyRule[]): ChartJson {
  const sign = (s: number) => locale.signNames.en[((s - 1) % 12 + 12) % 12];
  const nak = (n: number) => locale.nakshatraNames.en[((n - 1) % 27 + 27) % 27];
  let dasha: ChartJson['dasha'] = null;
  if (tree) {
    const maha = tree.mahas.find((m) => m.start <= nowMs && nowMs < m.end);
    const antar = maha?.children?.find((a) => a.start <= nowMs && nowMs < a.end);
    if (maha && antar) dasha = { maha: maha.lord, antar: antar.lord, antarEnds: new Date(antar.end).toISOString().slice(0, 10) };
  }
  const houses: Record<string, string> = {};
  for (const h of chart.houses) houses[String(h.n)] = `${sign(h.sign)}/${h.lord}`;
  return {
    lagna: chart.lagna ? { sign: sign(chart.lagna.sign), deg: Math.round(chart.lagna.degree + chart.lagna.minute / 60), approx: chart.lagna.approx } : null,
    moonChart: chart.moonChart,
    planets: chart.planets.map((p) => {
      const o: ChartPlanetJson = { id: p.id, sign: sign(p.sign), deg: Math.round(p.degree + p.minute / 60), house: p.house, nak: nak(p.nakshatra), pada: p.pada };
      if (p.tags.length) o.tags = [...p.tags];
      if (p.retrograde) o.retro = true;
      return o;
    }),
    houses,
    dasha,
    today: today.map((r) => r.ruleId),
    ayanamsa: chart.meta.ayanamsa,
  };
}

export interface Snippet {
  domain: string;
  id: string;
  text: string;
}

/**
 * Snippet ids relevant to the question, most relevant first: Lagna, Moon (sign + house), the running dasha pair, then
 * every named planet (sign + house), every named house (its lord's placements and its occupants), every named sign
 * that is the Lagna. Duplicates removed; order is the inclusion priority under the budget.
 */
export function relevantSnippetIds(chart: ChartData, json: ChartJson, question: string, lang: Lang): { domain: string; id: string }[] {
  const out: { domain: string; id: string }[] = [];
  const seen = new Set<string>();
  const add = (domain: string, id: string) => {
    const k = `${domain}/${id}`;
    if (!seen.has(k)) {
      seen.add(k);
      out.push({ domain, id });
    }
  };
  const planet = (id: PlanetId) => {
    const p = chart.planets.find((x) => x.id === id);
    if (!p) return;
    add('planet-sign', planetSignId(id, p.sign));
    add('planet-house', planetHouseId(id, p.house));
  };
  if (!chart.moonChart) add('lagna', lagnaId(chart.firstHouseSign));
  planet('Mo');
  if (json.dasha) add('dasha-pairs', `dasha-${json.dasha.maha}-${json.dasha.antar}`);
  for (const id of detectPlanets(question, lang)) planet(id);
  for (const h of detectHouses(question)) {
    const house = chart.houses.find((x) => x.n === h);
    if (!house) continue;
    planet(house.lord);
    house.occupants.forEach(planet);
  }
  for (const s of detectSigns(question, lang)) if (s === chart.firstHouseSign && !chart.moonChart) add('lagna', lagnaId(s));
  return out;
}

export interface BuiltPrompt {
  prompt: string;
  /** Rule ids the answer should cite (system rules + the snippet ids actually included). */
  ruleIds: string[];
  snippetIds: string[];
  /** Snippets that matched but did not fit the budget. */
  dropped: string[];
  chars: number;
}

export interface BuildPromptInput {
  chart: ChartData;
  tree: DashaTree | null;
  today: readonly DailyRule[];
  nowMs: number;
  question: string;
  lang: Lang;
  profileName?: string | null;
  budget?: number;
}

export function buildPrompt(input: BuildPromptInput): BuiltPrompt {
  const budget = input.budget ?? PROMPT_CHAR_BUDGET;
  const lang = input.lang;
  const rules = SYSTEM_RULE_IDS.map((id) => ({ id, text: ruleText(id, lang)?.text ?? '' })).filter((r) => r.text);
  const json = chartJson(input.chart, input.tree, input.nowMs, input.today);
  const question = input.question.trim().slice(0, ASK_MAX);
  const head = [`SYSTEM RULES (${lang}):`, ...rules.map((r) => `- [${r.id}] ${r.text}`), '', `CHART (${input.profileName ?? 'this person'}): ${JSON.stringify(json)}`, '', 'CORPUS SNIPPETS (cite by id):'].join('\n');
  const tail = ['', `QUESTION: ${question}`, 'ANSWER (plain language, cite rule ids in brackets, no predictions):'].join('\n');
  let used = head.length + tail.length;
  const included: Snippet[] = [];
  const dropped: string[] = [];
  for (const ref of relevantSnippetIds(input.chart, json, question, lang)) {
    const s = lookup(ref.domain, ref.id, lang);
    if (!s) continue;
    const line = `- [${ref.id}] ${s.text}`;
    if (used + line.length + 1 > budget) {
      dropped.push(ref.id);
      continue;
    }
    included.push({ domain: ref.domain, id: ref.id, text: s.text });
    used += line.length + 1;
  }
  const body = included.length ? included.map((s) => `- [${s.id}] ${s.text}`).join('\n') : '- (none matched; answer only from the chart and say so)';
  const prompt = `${head}\n${body}${tail}`;
  return { prompt, ruleIds: [...rules.map((r) => r.id), ...included.map((s) => s.id)], snippetIds: included.map((s) => s.id), dropped, chars: prompt.length };
}

/** Rule ids the model actually cited in its answer ("[sun-mesha]"), intersected with the ones it was given. */
export function citedRuleIds(answer: string, given: readonly string[]): string[] {
  const byLower = new Map(given.map((id) => [id.toLowerCase(), id]));
  const out: string[] = [];
  for (const m of answer.matchAll(/\[([a-z0-9][a-z0-9-]*)\]/gi)) {
    const id = byLower.get(m[1].toLowerCase());
    if (id && !out.includes(id)) out.push(id);
  }
  return out;
}
