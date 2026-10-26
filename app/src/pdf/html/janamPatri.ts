// Janam Patri report HTML (spec F31; design.md 10.6): every section in the profile's PDF language from the engine's
// janamPatriModel - header, panchang at birth, the D1 / D9 / Moon charts in the chosen style (engine chart-layout),
// planet table, dasha table (maha + antar, current marked), avakahada chakra, ghatak chakra, Mangal dosha statement
// with every cancellation rule, "How this was computed", disclaimer. Nothing is typed here that the engine did not
// compute; labels come from the UI strings of the PDF language.
import { formatInZone, type ChartStyle, type JanamPatriModel, type PlanetTableRow } from '@shubhvela/engine';
import { CHART_STYLE_KEY } from '../../settingsLabels';
import { chartSvg } from '../chartSvg';
import { approxMark, computedSection, disclaimerSection, document, esc, headerSection, kvRows, paragraph, section, table, type ReportContext } from './common';

export const JANAM_PATRI_SECTIONS = ['header', 'panchangAtBirth', 'charts', 'planetTable', 'dashaTable', 'avakahada', 'ghatak', 'mangal', 'howComputed', 'disclaimer'] as const;

export interface JanamPatriHtmlOptions {
  style: ChartStyle;
}

function time(ms: number | null, tz: string): string {
  return ms === null ? '—' : formatInZone(ms, tz, 'HH:mm');
}

function date(ms: number, tz: string, lang: ReportContext['lang']): string {
  return formatInZone(ms, tz, 'd MMM yyyy', lang);
}

/** Notes column of the planet table: dignity tags, R, combust, approx (UI dignity vocabulary). */
export function planetNotes(ctx: ReportContext, p: PlanetTableRow): string {
  const { t } = ctx;
  const order = ['exalted', 'debilitated', 'own', 'friend', 'enemy', 'neutral', 'combust', 'retro', 'vargottama'];
  const tags = [...p.tags].sort((a, b) => order.indexOf(a) - order.indexOf(b)).map((tag) => t(`dignity.${tag}`));
  return [...tags, ...(p.approx ? [t('common.approx')] : [])].join(' · ');
}

export function planetTableHtml(ctx: ReportContext, rows: readonly PlanetTableRow[], withHouse = true): string {
  const { t } = ctx;
  const headers = [t('pdf.col.planet'), t('pdf.col.sign'), t('pdf.col.nakshatra'), ...(withHouse ? [t('pdf.col.house')] : []), t('pdf.col.notes')];
  return table(
    headers,
    rows.map((p) => [p.name, `${p.signName} ${p.degree}`, `${p.nakshatraName} ${p.pada}`, ...(withHouse ? [p.house] : []), planetNotes(ctx, p)]),
    { numeric: withHouse ? [3] : [] },
  );
}

export function janamPatriHtml(m: JanamPatriModel, ctx: ReportContext, opts: JanamPatriHtmlOptions): string {
  const { t, lang } = ctx;
  const tz = m.header.tz;
  const pb = m.panchangAtBirth;

  const panchang = kvRows([
    [t('pdf.vedicDay'), `${pb.vedicDate} · ${pb.varaName}`],
    [t('panchang.tithi'), `${t(pb.tithi.paksha === 'krishna' ? 'panchang.krishna' : 'panchang.shukla')} ${pb.tithi.name} · ${t('panchang.till', { time: formatInZone(pb.tithi.endsAt, tz, 'd MMM HH:mm', lang) })}`],
    [t('panchang.nakshatra'), `${pb.nakshatra.name} ${pb.nakshatra.pada} · ${t('panchang.till', { time: formatInZone(pb.nakshatra.endsAt, tz, 'd MMM HH:mm', lang) })}`],
    [t('panchang.yoga'), pb.yoga.name],
    [t('panchang.karana'), pb.karana.bhadra ? t('panchang.vishtiBhadra') : pb.karana.name],
    [t('panchang.month'), t('pdf.monthLine', { purnimanta: pb.monthPurnimanta.name, amanta: pb.monthAmanta.name })],
    [t('panchang.samvat'), `${t('panchang.vikram', { year: pb.vikramSamvat })} · ${t('panchang.shaka', { year: pb.shakaSamvat })}`],
    [t('panchang.sunriseSunset'), `${time(pb.sunrise, tz)} · ${time(pb.sunset, tz)}`],
    [t('panchang.moonriseMoonset').split(' · ')[0], time(pb.moonrise, tz)],
    [t('panchang.sunMoon'), `${t('panchang.sunIn', { sign: pb.sunSign.name })} · ${t('panchang.moonIn', { sign: pb.moonSign.name })}`],
  ]);
  const panchangNote = pb.approx ? paragraph(`${t('common.approx')} · ${t('pdf.timeUnknownNote')}`, 'cap') : '';

  const centre = (title: string) => (opts.style === 'north' ? undefined : [title]);
  const chartBlock = (title: string, chart: JanamPatriModel['charts']['d1']) =>
    `<div class="chart">${chartSvg(opts.style, chart, { lang, width: 320, centreLines: centre(title), title })}<div class="cap">${esc(title)}</div></div>`;
  const charts = m.header.timeUnknown
    ? chartBlock(t('pdf.chart.moon'), m.charts.moon)
    : chartBlock(t('pdf.chart.d1'), m.charts.d1) + chartBlock(t('pdf.chart.d9'), m.charts.d9) + chartBlock(t('pdf.chart.moon'), m.charts.moon);
  const chartsNote = paragraph(`${t(CHART_STYLE_KEY[opts.style])} · ${t('charts.housesLine', { system: t('charts.houseSystem.whole-sign') })}`, 'cap');

  const planets = planetTableHtml(ctx, m.planetTable, !m.header.timeUnknown) + paragraph(t('pdf.approxLegend'), 'cap');

  const dashaRows: (string | number)[][] = [];
  const current: boolean[] = [];
  for (const maha of m.dashaTable) {
    dashaRows.push([maha.name, '', date(maha.start, tz, lang), date(maha.end, tz, lang)]);
    current.push(maha.current);
    for (const a of maha.antars) {
      dashaRows.push(['', a.name, date(a.start, tz, lang), date(a.end, tz, lang)]);
      current.push(a.current);
    }
  }
  const balance = paragraph(t('dasha.balance', { lord: m.planetTable.find((p) => p.id === m.dashaBalance.lord)?.name ?? m.dashaBalance.lord, years: m.dashaBalance.years.toFixed(2) }), 'cap');
  const dasha = balance + table([t('pdf.col.maha'), t('pdf.col.antar'), t('pdf.col.from'), t('pdf.col.to')], dashaRows, { current });

  const av = m.avakahada;
  const avakahada = kvRows([
    [t('pdf.avakahada.varna'), t(`match.varna.${av.varna}`)],
    [t('pdf.avakahada.vashya'), t(`match.vashya.${av.vashya}`)],
    [t('pdf.avakahada.yoni'), t(`match.yoni.${av.yoni}`)],
    [t('pdf.avakahada.gana'), t(`match.gana.${av.gana}`)],
    [t('pdf.avakahada.nadi'), t(`match.nadi.${av.nadi}`)],
    [t('pdf.avakahada.nakshatraCharan'), `${av.nakshatra.name} · ${av.nakshatraCharan}`],
    [t('pdf.avakahada.nakshatraLord'), m.planetTable.find((p) => p.id === av.nakshatraLord)?.name ?? av.nakshatraLord],
    [t('pdf.avakahada.rashi'), av.rashi.name],
    [t('pdf.avakahada.rashiLord'), m.planetTable.find((p) => p.id === av.rashi.lord)?.name ?? av.rashi.lord],
    [t('pdf.avakahada.lagna'), av.lagna ? `${av.lagna.name} · ${m.planetTable.find((p) => p.id === av.lagna!.lord)?.name ?? av.lagna.lord}` : t('common.unknown')],
    [t('pdf.avakahada.tatva'), t(`pdf.tatva.${av.tatva}`)],
    [t('pdf.avakahada.nameSyllable'), `${av.nameSyllable.syllable.devanagari} (${av.nameSyllable.syllable.latin})`],
  ]);

  const g = m.ghatakChakra;
  const ghatak =
    paragraph(t('pdf.ghatakNote'), 'cap') +
    kvRows([
      [t('pdf.ghatak.month'), g.month.name],
      [t('pdf.ghatak.tithi'), t(`pdf.tithiGroup.${g.tithiGroup}`, { tithis: g.tithis.join(', ') })],
      [t('pdf.ghatak.vara'), g.vara.name],
      [t('pdf.ghatak.nakshatra'), g.nakshatra.name],
      [t('pdf.ghatak.yoga'), g.yoga.name],
      [t('pdf.ghatak.karana'), g.karana.name],
      [t('pdf.ghatak.chandra'), g.chandra.name],
      [t('pdf.ghatak.lagna'), g.lagna.name],
    ]);

  const ms = m.mangalStatement;
  const status = !ms.present ? t('match.mangalNone') : `${t('match.mangalPresent')} · ${t(ms.effective ? 'match.mangalEffective' : 'match.mangalCancelled')}`;
  const refs = ms.references.map((r) => `<li>${esc(t('match.mangalRefs', { house: r.house, reference: t(`match.ref.${r.from}`) }))}${r.dosha ? ` <span class="tag">${esc(t('match.doshaPresent'))}</span>` : ''}</li>`).join('');
  const cancels = ms.present
    ? `<h3>${esc(t('match.cancellations'))}</h3><ul>${ms.cancellations.map((c) => `<li>${esc(t(`match.cancel.${c.ruleId}`))} <span class="tag">${esc(t(c.applies ? 'match.applies_tag' : 'match.notApplied_tag'))}</span></li>`).join('')}</ul>`
    : '';
  const mangal = `<p><strong>${esc(t('match.mangal'))}: ${esc(status)}</strong>${ms.lagnaUnknown ? ` ${approxMark(ctx)}` : ''}</p><ul>${refs}</ul>${cancels}`;

  const body =
    headerSection(ctx, m.header, 'header') +
    section('panchangAtBirth', t('pdf.section.panchangAtBirth'), panchang + panchangNote) +
    section('charts', t('pdf.section.charts'), `<div class="charts">${charts}</div>${chartsNote}`) +
    section('planetTable', t('pdf.section.planetTable'), planets) +
    `<section class="s long" id="dashaTable" data-section="dashaTable"><h2>${esc(t('pdf.section.dashaTable'))}</h2>${dasha}</section>` +
    section('avakahada', t('pdf.section.avakahada'), avakahada) +
    section('ghatak', t('pdf.section.ghatak'), ghatak) +
    section('mangal', t('pdf.section.mangal'), mangal) +
    computedSection(ctx, m.computedWith, m.ruleIds, 'howComputed') +
    disclaimerSection(ctx, m.disclaimer, 'disclaimer');

  const title = t('report.janamPatri');
  const sub = [m.header.name ? t('pdf.forProfile', { name: m.header.name }) : '', t('pdf.born', { line: m.header.birthLine }), m.header.place ?? ''];
  return document(ctx, title, sub, body);
}
