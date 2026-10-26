// Report assembly (plan B07): route params -> engine report model -> HTML string in the profile's PDF language, plus
// the purchase reference (P19: a consumable is delivered to ONE profile or pair) and the file name. The same function
// serves the preview WebView, the Download/Share PDF and the dev pdf-dump route, so what is previewed is what prints.
import { janamPatriModel, matchingReportModel, varshaphalReportModel, type ChartStyle, type ReportProfile } from '@shubhvela/engine';
import type { Profile } from '../db/profiles';
import type { ReportKind } from '../entitlements';
import { makeT, type Lang, type TFn } from '../i18n';
import { profileLabel } from '../muhurat/ForField';
import { resolveSide, sideFromParams, sidesToParams, type MatchRouteParams, type MatchSide } from '../match/model';
import { reportContext } from './html/common';
import { JANAM_PATRI_SECTIONS, janamPatriHtml } from './html/janamPatri';
import { MATCHING_SECTIONS, matchingReportHtml } from './html/matchingReport';
import { VARSHAPHAL_SECTIONS, varshaphalReportHtml } from './html/varshaphalReport';
import { fmtDayLong } from '../today/format';

export type ReportParams =
  | { kind: 'janam_patri'; profileId: number }
  | { kind: 'matching'; a: MatchSide; b: MatchSide }
  | { kind: 'varshaphal'; profileId: number; year: number };

export const REPORT_KINDS: readonly ReportKind[] = ['janam_patri', 'matching', 'varshaphal'];

export function isReportKind(s: string | undefined): s is ReportKind {
  return (REPORT_KINDS as readonly string[]).includes(s ?? '');
}

/** Route query -> params; null when the query is incomplete. */
export function reportParamsFrom(kind: string | undefined, q: Record<string, string | undefined> & MatchRouteParams): ReportParams | null {
  if (!isReportKind(kind)) return null;
  if (kind === 'matching') {
    const a = sideFromParams(q, 'a');
    const b = sideFromParams(q, 'b');
    return a && b ? { kind, a, b } : null;
  }
  const profileId = Number(q.profile);
  if (!Number.isFinite(profileId)) return null;
  if (kind === 'varshaphal') {
    const year = Number(q.year);
    return Number.isFinite(year) ? { kind, profileId, year } : null;
  }
  return { kind, profileId };
}

/** Route query of params (inverse of reportParamsFrom). */
export function reportParamsToQuery(p: ReportParams): Record<string, string> {
  if (p.kind === 'matching') return sidesToParams(p.a, p.b);
  if (p.kind === 'varshaphal') return { profile: String(p.profileId), year: String(p.year) };
  return { profile: String(p.profileId) };
}

function sideKey(s: MatchSide): string {
  return s.kind === 'profile' ? `p${s.id}` : `c${s.code}`;
}

/** Purchase reference: the profile (Janam Patri), the unordered pair (Matching), the profile + year (Varshaphal). */
export function reportRefId(p: ReportParams): string {
  if (p.kind === 'matching') return `pair:${[sideKey(p.a), sideKey(p.b)].sort().join('|')}`;
  if (p.kind === 'varshaphal') return `p${p.profileId}:${p.year}`;
  return `p${p.profileId}`;
}

export interface BuiltReport {
  kind: ReportKind;
  /** PDF language (the profile's; profile A's for matching; the UI language when A is a code side). */
  lang: Lang;
  title: string;
  /** Who the report is for, for the preview caption ("For Priya", "Priya · Amma"). */
  subject: string;
  /** Side / profile labels (1 or 2) for the delivery message. */
  names: string[];
  html: string;
  /** Section ids in document order (tests, dev dump). */
  sections: readonly string[];
  refId: string;
  fileName: string;
}

export interface BuildDeps {
  profiles: readonly Profile[];
  /** UI-language translate for side labels and the preview caption. */
  t: TFn;
  uiLang: Lang;
  style: ChartStyle;
  fontCss: string;
  nowMs: number;
}

function reportProfile(p: Profile): ReportProfile {
  return { name: p.name ?? undefined, placeName: p.placeName, gender: p.gender === 'female' ? 'f' : p.gender === 'male' ? 'm' : p.gender === 'other' ? 'x' : undefined };
}

function safeName(s: string): string {
  return s.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'report';
}

/** Builds the report; throws when a profile is missing or a code is invalid (the screen shows errors.chart). */
export function buildReport(p: ReportParams, deps: BuildDeps): BuiltReport {
  const find = (id: number): Profile => {
    const prof = deps.profiles.find((x) => x.id === id);
    if (!prof) throw new Error(`Profile ${id} not found`);
    return prof;
  };
  const refId = reportRefId(p);
  if (p.kind === 'matching') {
    const a = resolveSide('a', p.a, deps.profiles, deps.t);
    const b = resolveSide('b', p.b, deps.profiles, deps.t);
    const lang: Lang = a.profile?.pdfLanguage ?? b.profile?.pdfLanguage ?? deps.uiLang;
    const tr = makeT(lang);
    const model = matchingReportModel(a.chart, b.chart, { a: a.profile ? reportProfile(a.profile) : { name: a.label }, b: b.profile ? reportProfile(b.profile) : { name: b.label } }, lang, { nowMs: deps.nowMs });
    const ctx = reportContext(lang, deps.fontCss, tr('pdf.generatedAt', { date: fmtDayLong(deps.nowMs, a.chart.meta.tz, lang) }));
    const html = matchingReportHtml(model, ctx, { style: deps.style, labels: { a: a.label, b: b.label } });
    return { kind: p.kind, lang, title: deps.t('report.matching'), subject: deps.t('match.sides', { a: a.label, b: b.label }), names: [a.label, b.label], html, sections: MATCHING_SECTIONS, refId, fileName: `shubhvela-matching-${safeName(a.label)}-${safeName(b.label)}.pdf` };
  }
  const profile = find(p.profileId);
  const lang = profile.pdfLanguage;
  const tr = makeT(lang);
  const ctx = reportContext(lang, deps.fontCss, tr('pdf.generatedAt', { date: fmtDayLong(deps.nowMs, profile.tz, lang) }));
  const label = profileLabel(profile, deps.t);
  // chartFor is memoised per profile + F19 settings (engine-bridge); resolveSide reuses it for profile sides.
  const chart = resolveSide('a', { kind: 'profile', id: profile.id }, deps.profiles, deps.t).chart;
  if (p.kind === 'varshaphal') {
    const model = varshaphalReportModel(chart, p.year, reportProfile(profile), lang, { nowMs: deps.nowMs });
    const html = varshaphalReportHtml(model, ctx, { style: deps.style });
    return { kind: p.kind, lang, title: `${deps.t('report.varshaphal')} · ${p.year}`, subject: deps.t('pdf.forProfile', { name: label }), names: [label], html, sections: VARSHAPHAL_SECTIONS, refId, fileName: `shubhvela-varshaphal-${p.year}-${safeName(label)}.pdf` };
  }
  const model = janamPatriModel(chart, reportProfile(profile), lang, { nowMs: deps.nowMs });
  const html = janamPatriHtml(model, ctx, { style: deps.style });
  return { kind: p.kind, lang, title: deps.t('report.janamPatri'), subject: deps.t('pdf.forProfile', { name: label }), names: [label], html, sections: JANAM_PATRI_SECTIONS, refId, fileName: `shubhvela-janam-patri-${safeName(label)}.pdf` };
}
