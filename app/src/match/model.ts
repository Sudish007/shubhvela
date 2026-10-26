// Matching model (F29, design.md 10.6 F29; plan B06). A "side" of the match is a stored profile or a 20-character
// share code (entered details are encoded to a code too, so the result route carries every side the same way:
// `a=p<id>` | `a=c<CODE>`, with the optional display label `an` and source `as`). Charts of code sides are computed
// locally with computeChart() under the F19 settings; every number on the result screen is engine output.
import {
  ashtakoota,
  beyondGunMilan,
  computeChart,
  decodeShareCode,
  mangalDoshaPair,
  type AshtakootaResult,
  type BeyondGunMilanReport,
  type ChartData,
  type KootaRow,
  type MangalPairReport,
  type SharePayload,
} from '@shubhvela/engine';
import type { Profile } from '../db/profiles';
import { chartFor, chartOptions } from '../engine-bridge/charts';
import type { Lang, TFn } from '../i18n';
import { profileLabel } from '../muhurat/ForField';
import { birthOf } from '../share/payload';
import { planetName, signName } from '../today/format';

export type MatchSideKey = 'a' | 'b';
export type CodeSource = 'entered' | 'scanned' | 'typed';

export type MatchSide = { kind: 'profile'; id: number } | { kind: 'code'; code: string; label: string | null; source: CodeSource };

export type MatchRouteParams = {
  a?: string;
  b?: string;
  an?: string;
  bn?: string;
  as?: string;
  bs?: string;
};

const SOURCES: readonly CodeSource[] = ['entered', 'scanned', 'typed'];

/** Route params of two sides (expo-router query string). */
export function sidesToParams(a: MatchSide, b: MatchSide): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, side] of [['a', a], ['b', b]] as const) {
    if (side.kind === 'profile') out[key] = `p${side.id}`;
    else {
      out[key] = `c${side.code}`;
      if (side.label) out[`${key}n`] = side.label;
      out[`${key}s`] = side.source;
    }
  }
  return out;
}

export function sideFromParams(params: MatchRouteParams, key: MatchSideKey): MatchSide | null {
  const raw = params[key];
  if (!raw) return null;
  if (raw.startsWith('p')) {
    const id = Number(raw.slice(1));
    return Number.isFinite(id) ? { kind: 'profile', id } : null;
  }
  if (raw.startsWith('c')) {
    const source = params[`${key}s`] as CodeSource | undefined;
    const label = params[`${key}n`];
    return { kind: 'code', code: raw.slice(1), label: label?.trim() ? label.trim().slice(0, 40) : null, source: source && SOURCES.includes(source) ? source : 'typed' };
  }
  return null;
}

export interface ResolvedSide {
  key: MatchSideKey;
  side: MatchSide;
  label: string;
  chart: ChartData;
  profile: Profile | null;
  payload: SharePayload | null;
  timeUnknown: boolean;
  approxMinutes: number;
}

const codeChartCache = new Map<string, ChartData>();

/** Chart of a code side, memoised per code + F19 settings. */
export function chartForCode(code: string): { chart: ChartData; payload: SharePayload } {
  const payload = decodeShareCode(code);
  const opts = chartOptions();
  const k = `${code}|${opts.ayanamsa}|${opts.node}`;
  const hit = codeChartCache.get(k);
  if (hit) return { chart: hit, payload };
  const chart = computeChart(birthOf(payload), opts);
  codeChartCache.set(k, chart);
  return { chart, payload };
}

export function clearCodeChartCache(): void {
  codeChartCache.clear();
}

/** Display name of a side: the profile's label, the entered name, or "From a code" / "Entered details". */
export function sideLabel(side: MatchSide, profiles: readonly Profile[], t: TFn): string {
  if (side.kind === 'profile') {
    const p = profiles.find((x) => x.id === side.id);
    return p ? profileLabel(p, t) : t('match.pickA');
  }
  if (side.label) return side.label;
  return side.source === 'entered' ? t('match.enteredDetails') : t('match.fromCode');
}

/** Resolves a side to its chart; throws when the profile is missing or the code is invalid. */
export function resolveSide(key: MatchSideKey, side: MatchSide, profiles: readonly Profile[], t: TFn): ResolvedSide {
  if (side.kind === 'profile') {
    const p = profiles.find((x) => x.id === side.id);
    if (!p) throw new Error(`Profile ${side.id} not found`);
    return { key, side, label: sideLabel(side, profiles, t), chart: chartFor(p), profile: p, payload: null, timeUnknown: p.timeUnknown, approxMinutes: p.timeUnknown ? 0 : p.timeApproxMinutes };
  }
  const { chart, payload } = chartForCode(side.code);
  return { key, side, label: sideLabel(side, profiles, t), chart, profile: null, payload, timeUnknown: payload.time === null, approxMinutes: payload.approx };
}

export interface MatchReport {
  guna: AshtakootaResult;
  mangal: MangalPairReport;
  beyond: BeyondGunMilanReport;
}

/** The whole F29 computation (a = vara side, b = kanya side, engine convention). */
export function computeMatch(a: ChartData, b: ChartData, nowMs: number): MatchReport {
  return { guna: ashtakoota(a, b), mangal: mangalDoshaPair(a, b), beyond: beyondGunMilan(a, b, nowMs) };
}

/** "23.5" stays "23.5"; integers print without a decimal (B01: never truncate the half point). */
export function fmtGuna(total: number): string {
  return Number.isInteger(total) ? String(total) : total.toFixed(1);
}

/** Corpus explanation level behind every "Why?" on the result screen: 1 on free, 3 on Pro (spec section 9). */
export function kootaLevel(pro: boolean): 1 | 3 {
  return pro ? 3 : 1;
}

/** Display value of a koota's side key (varna/vashya/yoni/gana/nadi keys, tara numbers, planet ids, sign numbers). */
export function kootaSideText(row: KootaRow, value: string, t: TFn, lang: Lang): string {
  switch (row.id) {
    case 'varna':
    case 'vashya':
    case 'yoni':
    case 'gana':
    case 'nadi':
      return t(`match.${row.id}.${value}`);
    case 'tara':
      return t('match.tara.n', { n: value });
    case 'grahaMaitri':
      return planetName(lang, value as Parameters<typeof planetName>[1]);
    case 'bhakoot':
      return signName(lang, Number(value));
  }
}

export function fullKootaCount(guna: AshtakootaResult): number {
  return guna.kootas.filter((k) => k.points === k.max).length;
}

/** Params of the computed one-paragraph summary (`match.summary`); every value is engine output. */
export function summaryParams(report: MatchReport, aLabel: string, bLabel: string, t: TFn): Record<string, string | number> {
  const nadi = report.guna.kootas.find((k) => k.id === 'nadi')!;
  const bhakoot = report.guna.kootas.find((k) => k.id === 'bhakoot')!;
  const nadiText = report.guna.nadiException ? t('match.doshaLifted', { rule: t(`match.exception.${report.guna.nadiException}`) }) : nadi.detail.dosha ? t('match.doshaPresent') : t('match.doshaNone');
  const bhakootText = bhakoot.detail.dosha ? t('match.doshaPresent') : report.guna.bhakootException ? `${t('match.doshaPresent')} · ${t(`match.exception.${report.guna.bhakootException}`)}` : t('match.doshaNone');
  const mangalWord = (r: MangalPairReport['a']): string => (!r.present ? t('match.mangalNone') : r.effective ? t('match.mangalEffective') : t('match.mangalCancelled'));
  return {
    a: aLabel,
    b: bLabel,
    total: fmtGuna(report.guna.total),
    full: fullKootaCount(report.guna),
    nadi: nadiText,
    bhakoot: bhakootText,
    mangalA: report.mangal.bothManglik.applies ? t('match.mangalBalanced') : mangalWord(report.mangal.a),
    mangalB: report.mangal.bothManglik.applies ? t('match.mangalBalanced') : mangalWord(report.mangal.b),
  };
}
