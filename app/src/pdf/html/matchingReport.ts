// Matching report HTML (design.md 10.6 "Matching report PDF", M21): both birth headers and charts in the chosen
// style, the 36-guna table (exact total, e.g. 23.5), the per-koota explanation at corpus level 3, the dosha section
// (Nadi / Bhakoot with the exceptions named, Mangal dosha per person with every cancellation rule), "Beyond gun milan"
// with the dasha overlaps, "How this was computed", disclaimer; in the PDF language of profile A.
import { lookup } from '@shubhvela/content';
import { formatInZone, locale, type ChartStyle, type KootaRow, type MangalDoshaReport, type MatchingReportModel } from '@shubhvela/engine';
import { chartSvg } from '../chartSvg';
import { approxMark, computedSection, disclaimerSection, document, esc, headerSection, paragraph, section, table, type ReportContext } from './common';

export const MATCHING_SECTIONS = ['headerA', 'headerB', 'charts', 'gunaTable', 'kootaExplanations', 'doshas', 'beyond', 'howComputed', 'disclaimer'] as const;

export interface MatchingHtmlOptions {
  style: ChartStyle;
  /** Side labels (profile name, entered name or "From a code"). */
  labels: { a: string; b: string };
}

function fmtGuna(total: number): string {
  return Number.isInteger(total) ? String(total) : total.toFixed(1);
}

/** Display value of a koota side key (the same mapping the result screen uses). */
function sideText(ctx: ReportContext, row: KootaRow, value: string): string {
  const { t, lang } = ctx;
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
      return planetName(lang, value);
    case 'bhakoot':
      return signName(lang, Number(value));
  }
}

// Locale tables through the engine (no app-side name lists).
function planetName(lang: ReportContext['lang'], id: string): string {
  return (locale.planetNames[lang] as Record<string, string>)[id] ?? id;
}
function signName(lang: ReportContext['lang'], sign: number): string {
  return locale.signNames[lang][((sign - 1) % 12 + 12) % 12];
}

function mangalBlock(ctx: ReportContext, label: string, r: MangalDoshaReport): string {
  const { t, lang } = ctx;
  const status = !r.present ? t('match.mangalNone') : `${t('match.mangalPresent')} · ${t(r.effective ? 'match.mangalEffective' : 'match.mangalCancelled')}`;
  const refs = r.references.map((x) => `<li>${esc(t('match.mangalRefs', { house: x.house, reference: t(`match.ref.${x.from}`) }))}${x.dosha ? ` <span class="tag">${esc(t('match.doshaPresent'))}</span>` : ''}</li>`).join('');
  const explanation = lookup('mangal', r.present ? 'mangal-dosha' : 'mangal-dosha-none', lang)?.text;
  const cancels = r.present
    ? `<h3>${esc(t('match.cancellations'))}</h3><ul>${r.cancellations
        .map((c) => {
          const text = c.applies ? lookup('mangal', c.ruleId, lang)?.text : null;
          return `<li>${esc(t(`match.cancel.${c.ruleId}`))} <span class="tag">${esc(t(c.applies ? 'match.applies_tag' : 'match.notApplied_tag'))}</span>${text ? `<div class="cap">${esc(text)}</div>` : ''}</li>`;
        })
        .join('')}</ul>`
    : '';
  return `<h3>${esc(t('match.mangalFor', { name: label }))}</h3><p><strong>${esc(t('match.mangal'))}: ${esc(status)}</strong>${r.lagnaUnknown ? ` ${approxMark(ctx)}` : ''}</p>${explanation ? paragraph(explanation) : ''}<ul>${refs}</ul>${cancels}`;
}

export function matchingReportHtml(m: MatchingReportModel, ctx: ReportContext, opts: MatchingHtmlOptions): string {
  const { t, lang } = ctx;
  const { a: aLabel, b: bLabel } = opts.labels;
  const k = m.ashtakoota;

  const centre = (title: string) => (opts.style === 'north' ? undefined : [title]);
  const chartBlock = (title: string, chart: MatchingReportModel['a']['chart']) =>
    `<div class="chart">${chartSvg(opts.style, chart, { lang, width: 320, centreLines: centre(title), title })}<div class="cap">${esc(title)}</div></div>`;
  const charts = `<div class="charts">${chartBlock(t('report.sideA', { name: aLabel }), m.a.chart)}${chartBlock(t('report.sideB', { name: bLabel }), m.b.chart)}</div>`;

  const total = `<p><strong class="num">${esc(t('match.gunaHeadline', { total: fmtGuna(k.total) }))}</strong></p>`;
  const gunaRows = k.kootas.map((row) => [t(`match.koota.${row.id}`), sideText(ctx, row, row.a), sideText(ctx, row, row.b), `${row.points} / ${row.max}`]);
  const gunaTable = total + table([t('report.col.koota'), t('report.sideA', { name: aLabel }), t('report.sideB', { name: bLabel }), t('report.col.points')], gunaRows, { numeric: [3] });

  const explanations = k.kootas
    .map((row) => {
      const text = lookup('koota', `koota-${row.id}-3`, lang)?.text ?? lookup('koota', `koota-${row.id}-1`, lang)?.text ?? '';
      return `<h3>${esc(t(`match.koota.${row.id}`))} · <span class="num">${row.points} / ${row.max}</span></h3>${paragraph(text)}`;
    })
    .join('');

  const nadi = k.kootas.find((x) => x.id === 'nadi')!;
  const bk = k.kootas.find((x) => x.id === 'bhakoot')!;
  const nadiLine = k.nadiException
    ? `${t('match.nadiDosha')}: ${t('match.doshaLifted', { rule: t(`match.exception.${k.nadiException}`) })}`
    : `${t('match.nadiDosha')}: ${t(nadi.detail.dosha ? 'match.doshaPresent' : 'match.doshaNone')}`;
  const bkLine = bk.detail.dosha
    ? `${t('match.bhakootDosha')}: ${t('match.doshaPresent')}${k.bhakootNote ? ` · ${t('match.doshaNoted', { rule: t(`match.exception.${k.bhakootNote}`) })}` : ''}`
    : k.bhakootException
      ? `${t('match.bhakootDosha')}: ${t('match.doshaPresent')} · ${t(`match.exception.${k.bhakootException}`)}`
      : `${t('match.bhakootDosha')}: ${t('match.doshaNone')}`;
  const nadiText = k.nadiException ? lookup('koota', k.nadiException, lang)?.text : undefined;
  const bkText = k.bhakootNote ? lookup('koota', k.bhakootNote, lang)?.text : k.bhakootException ? lookup('koota', k.bhakootException, lang)?.text : undefined;
  const both = m.mangal.a.present || m.mangal.b.present ? `<p>${esc(t('match.cancel.mangal-cancel-both-manglik'))} <span class="tag">${esc(t(m.mangal.bothManglik.applies ? 'match.applies_tag' : 'match.notApplied_tag'))}</span></p>` : '';
  const doshas = `<p><strong>${esc(nadiLine)}</strong></p>${nadiText ? paragraph(nadiText, 'cap') : ''}<p><strong>${esc(bkLine)}</strong></p>${bkText ? paragraph(bkText, 'cap') : ''}${mangalBlock(ctx, aLabel, m.mangal.a)}${mangalBlock(ctx, bLabel, m.mangal.b)}${both}`;

  const TITLE_KEY: Record<string, string> = { 'seventh-lords': 'match.beyond.seventhLords', venus: 'match.beyond.venus', 'moon-sign-relation': 'match.beyond.moonSignRelation', 'dasha-overlap': 'match.beyond.dashaOverlap' };
  const tz = m.a.chart.meta.tz;
  const overlaps = m.beyond.dashaOverlaps
    .map((o) =>
      `<li>${esc(
        t('match.overlapLine', {
          from: formatInZone(o.start, tz, 'd MMM yyyy', lang),
          to: formatInZone(o.end, tz, 'd MMM yyyy', lang),
          aMaha: planetName(lang, o.aMaha),
          aAntar: planetName(lang, o.aAntar),
          bMaha: planetName(lang, o.bMaha),
          bAntar: planetName(lang, o.bAntar),
        }),
      )}</li>`,
    )
    .join('');
  const beyond =
    paragraph(t('match.beyondNote'), 'cap') +
    m.beyond.rows
      .map((row) => {
        const text = `${t(TITLE_KEY[row.id])}: ${t(`match.tone.${row.tone}`)}`;
        const rule = lookup('rules', row.ruleId, lang)?.text;
        return `<p><strong>${esc(text)}</strong>${row.approx ? ` ${approxMark(ctx)}` : ''}</p>${rule ? paragraph(rule, 'cap') : ''}${row.id === 'dasha-overlap' && overlaps ? `<ul>${overlaps}</ul>` : ''}`;
      })
      .join('');

  const body =
    headerSection(ctx, m.a.header, 'headerA') +
    headerSection(ctx, m.b.header, 'headerB') +
    section('charts', t('pdf.section.charts'), charts) +
    section('gunaTable', t('report.section.gunaTable'), gunaTable) +
    `<section class="s long" id="kootaExplanations" data-section="kootaExplanations"><h2>${esc(t('report.section.kootaExplanations'))}</h2>${explanations}</section>` +
    `<section class="s long" id="doshas" data-section="doshas"><h2>${esc(t('report.section.doshas'))}</h2>${doshas}</section>` +
    section('beyond', t('report.section.beyond'), beyond) +
    computedSection(ctx, m.computedWith, m.ruleIds, 'howComputed') +
    disclaimerSection(ctx, m.disclaimer, 'disclaimer');

  return document(ctx, t('report.matching'), [t('match.sides', { a: aLabel, b: bLabel }), t('match.gunaHeadline', { total: fmtGuna(k.total) })], body);
}
