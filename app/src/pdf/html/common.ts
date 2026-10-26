// Shared pieces of the three report HTML documents (design.md 2.2, 6, 10.6; spec F31, section 10): one stylesheet in
// the light palette (paper / ink / accent, hairlines, no gradients or shadows), the embedded @font-face block, the
// birth-details header, key/value and table helpers, the "How this was computed" section and the three-language
// disclaimer that closes EVERY report. The same HTML string is shown in the preview WebView (fluid width) and handed
// to expo-print (A4 pages), so the CSS is fluid with an @page rule.
import type { ComputedWithLine, ReportHeader } from '@shubhvela/engine';
import { makeT, type Lang, type TFn } from '../../i18n';
import { colors, type as typeScale } from '../../theme/tokens';
import { PDF_FAMILY } from '../fonts';

export const esc = (s: string | number | null | undefined): string =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export interface ReportContext {
  lang: Lang;
  t: TFn;
  /** @font-face block from app/src/pdf/fonts.ts ('' in unit tests that only check the structure). */
  fontCss: string;
  /** Generated-at line already formatted in the report language. */
  generatedLine: string;
}

export function reportContext(lang: Lang, fontCss: string, generatedLine: string): ReportContext {
  return { lang, t: makeT(lang), fontCss, generatedLine };
}

/** Section ids every report test asserts on (the F31 list for the Janam Patri; the design 10.6 lists for the others). */
export type SectionId = string;

export function section(id: SectionId, title: string, body: string): string {
  return `<section class="s" id="${esc(id)}" data-section="${esc(id)}"><h2>${esc(title)}</h2>${body}</section>`;
}

export function kvRows(rows: readonly [string, string | number | null | undefined][]): string {
  return `<table class="kv"><tbody>${rows
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => `<tr><th scope="row">${esc(k)}</th><td>${esc(v)}</td></tr>`)
    .join('')}</tbody></table>`;
}

export function table(headers: readonly string[], rows: readonly (readonly (string | number)[])[], opts: { numeric?: readonly number[]; current?: readonly boolean[] } = {}): string {
  const numeric = new Set(opts.numeric ?? []);
  const head = `<thead><tr>${headers.map((h, i) => `<th scope="col"${numeric.has(i) ? ' class="num"' : ''}>${esc(h)}</th>`).join('')}</tr></thead>`;
  const body = rows
    .map((r, ri) => `<tr${opts.current?.[ri] ? ' class="cur"' : ''}>${r.map((c, i) => `<td${numeric.has(i) ? ' class="num"' : ''}>${esc(c)}</td>`).join('')}</tr>`)
    .join('');
  return `<table class="grid">${head}<tbody>${body}</tbody></table>`;
}

export function paragraph(text: string, cls = ''): string {
  return `<p${cls ? ` class="${cls}"` : ''}>${esc(text)}</p>`;
}

/** The light palette and the type scale as CSS (tokens only; nothing hand-typed). */
export function stylesheet(lang: Lang, fontCss: string): string {
  const c = colors.light;
  const body = lang === 'en' ? `'${PDF_FAMILY.sans}'` : `'${PDF_FAMILY.devanagari}', '${PDF_FAMILY.sans}'`;
  const line = lang === 'en' ? typeScale.body.line : typeScale.body.lineDevanagari;
  return `${fontCss}
@page { size: A4; margin: 14mm 14mm 16mm 14mm; }
html { -webkit-text-size-adjust: 100%; }
body { margin: 0; padding: 16px; background: ${c.paper}; color: ${c.ink}; font-family: ${body}; font-size: ${typeScale.body.size}px; line-height: ${line}px; font-variant-numeric: tabular-nums; }
h1, h2, .brand { font-family: '${PDF_FAMILY.display}', ${body}; font-weight: 400; margin: 0; }
h1 { font-size: ${typeScale.display.size}px; line-height: ${typeScale.display.line}px; }
h2 { font-size: ${typeScale.sheetTitle.size}px; line-height: ${typeScale.sheetTitle.line}px; margin: 0 0 8px; border-bottom: 1px solid ${c.hair}; padding-bottom: 4px; }
h3 { font-size: ${typeScale.heading.size}px; line-height: ${typeScale.heading.line}px; font-weight: 600; margin: 12px 0 4px; }
.brand { font-size: ${typeScale.sheetTitle.size}px; color: ${c.accent}; }
.cover { border: 1.5px solid ${c.ink}; border-radius: 12px; padding: 16px; background: ${c.surface}; margin-bottom: 16px; }
.cover .sub { color: ${c.ink2}; margin-top: 4px; }
.s { margin: 0 0 20px; break-inside: avoid-page; }
.s.long { break-inside: auto; }
p { margin: 0 0 8px; }
.cap { font-size: ${typeScale.caption.size}px; line-height: ${typeScale.caption.line}px; color: ${c.ink3}; }
.approx { color: ${c.indigo}; border: 1px solid ${c.indigo}; border-radius: 4px; padding: 0 4px; font-size: ${typeScale.micro.size}px; line-height: ${typeScale.micro.line}px; display: inline-block; vertical-align: middle; }
.tag { color: ${c.ink2}; border: 1px solid ${c.hair2}; border-radius: 4px; padding: 0 4px; font-size: ${typeScale.micro.size}px; line-height: ${typeScale.micro.line}px; display: inline-block; vertical-align: middle; }
table { border-collapse: collapse; width: 100%; }
table.kv th { text-align: left; font-weight: 400; color: ${c.ink3}; font-size: ${typeScale.caption.size}px; padding: 6px 8px 6px 0; width: 38%; vertical-align: top; border-top: 1px solid ${c.hair}; }
table.kv td { padding: 6px 0; vertical-align: top; border-top: 1px solid ${c.hair}; }
table.kv tr:first-child th, table.kv tr:first-child td { border-top: 0; }
table.grid { font-size: ${typeScale.label.size}px; line-height: ${typeScale.label.line}px; }
table.grid th { text-align: left; font-weight: 600; color: ${c.ink3}; font-size: ${typeScale.micro.size}px; line-height: ${typeScale.micro.line}px; padding: 6px 6px 4px 0; border-bottom: 1px solid ${c.hair2}; }
table.grid td { padding: 6px 6px 6px 0; border-bottom: 1px solid ${c.hair}; vertical-align: top; }
table.grid .num { text-align: right; font-variant-numeric: tabular-nums; }
table.grid tr.cur td { background: ${c.accentTint}; }
.charts { display: flex; flex-wrap: wrap; gap: 16px; justify-content: space-between; }
.chart { flex: 1 1 260px; max-width: 360px; }
.chart svg { width: 100%; height: auto; display: block; }
.chart .cap { text-align: center; margin-top: 4px; }
.two { display: flex; flex-wrap: wrap; gap: 16px; }
.two > div { flex: 1 1 260px; }
.footer { border-top: 1px solid ${c.hair2}; padding-top: 12px; margin-top: 24px; }
.disclaimer { border: 1px solid ${c.hair2}; border-radius: 8px; padding: 12px; background: ${c.surface}; }
.num, .latin { font-family: '${PDF_FAMILY.sans}'; font-variant-numeric: tabular-nums; }
ul { margin: 0 0 8px; padding-left: 20px; }
li { margin: 0 0 4px; }
`;
}

export const WORDMARK = 'Shubhvela · शुभवेला';
export const WEB_URL = 'sudish007.github.io/shubhvela';

/** Document wrapper: fonts, stylesheet, the wordmark cover block (title + subtitle lines) and the sections. */
export function document(ctx: ReportContext, title: string, subLines: readonly string[], body: string): string {
  const sub = subLines.filter(Boolean).map((l) => `<div class="sub">${esc(l)}</div>`).join('');
  return `<!DOCTYPE html><html lang="${ctx.lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)}</title><style>${stylesheet(ctx.lang, ctx.fontCss)}</style></head><body>
<header class="cover"><div class="brand">${esc(WORDMARK)}</div><h1>${esc(title)}</h1>${sub}<div class="cap">${esc(ctx.generatedLine)} · ${esc(WEB_URL)}</div></header>
${body}
</body></html>`;
}

/** Birth-details header (name, birth line, place, coordinates, zone, approx note) as the first section. */
export function headerSection(ctx: ReportContext, h: ReportHeader, id = 'header'): string {
  const { t } = ctx;
  const rows: [string, string | null][] = [
    [t('onboarding.name'), h.name],
    [t('onboarding.birthDate'), h.birthLine],
    [t('pdf.place'), h.place],
    [t('pdf.coordinatesLabel'), t('pdf.coordinates', { lat: h.lat.toFixed(2), lon: h.lon.toFixed(2) })],
    [t('pdf.timezoneLabel'), t('pdf.timezone', { tz: h.tz, offset: h.offset })],
  ];
  const notes: string[] = [];
  if (h.timeUnknown) notes.push(t('pdf.timeUnknownNote'));
  else if (h.approxMinutes > 0) notes.push(t('pdf.approxBirthTime', { minutes: h.approxMinutes }));
  return section(id, t('pdf.section.header'), kvRows(rows) + notes.map((n) => paragraph(n, 'cap')).join(''));
}

/** "How this was computed": one row per engine line plus the rule ids used. */
export function computedSection(ctx: ReportContext, lines: readonly ComputedWithLine[], ruleIds: readonly string[], id = 'howComputed'): string {
  const { t } = ctx;
  const rows: [string, string][] = lines.map((l) => [t(`report.computed.${l.key}`), l.value]);
  return section(id, t('pdf.section.howComputed'), kvRows(rows) + paragraph(t('pdf.ruleIds', { ids: [...new Set(ruleIds)].join(', ') }), 'cap'));
}

/** The disclaimer (spec section 10) in the report language; closes every report. */
export function disclaimerSection(ctx: ReportContext, key: string, id = 'disclaimer'): string {
  const { t } = ctx;
  return section(id, t('pdf.section.disclaimer'), `<div class="disclaimer">${paragraph(t(key))}${paragraph(t('disclaimer.notAdvice'))}${paragraph(t('disclaimer.noGuarantee'))}</div>`);
}

export function approxMark(ctx: ReportContext): string {
  return `<span class="approx">${esc(ctx.t('common.approx'))}</span>`;
}

/** Section ids present in an HTML string, in document order (for tests and the dev dump). */
export function sectionIds(html: string): string[] {
  return [...html.matchAll(/data-section="([^"]+)"/g)].map((m) => m[1]);
}

/** Section headings present in an HTML string, in document order. */
export function sectionHeadings(html: string): string[] {
  return [...html.matchAll(/<h2>([^<]*)<\/h2>/g)].map((m) => m[1]);
}
