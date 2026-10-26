// Varshaphal report HTML (design.md 10.6 "Varshaphal report PDF", M21, ₹149 both tiers): birth header, the solar-
// return chart in the chosen style with its planet table, Muntha, year lord with the five Tajika candidates, Tajika
// aspects, the month-by-month Mudda dasha table, the transit calendar for the year, "How this was computed",
// disclaimer. Every value is engine varshaphal() output through varshaphalReportModel.
import { formatInZone, locale, type ChartStyle, type VarshaphalReportModel } from '@shubhvela/engine';
import { chartSvg } from '../chartSvg';
import { computedSection, disclaimerSection, document, esc, headerSection, paragraph, section, table, type ReportContext } from './common';
import { planetTableHtml } from './janamPatri';

export const VARSHAPHAL_SECTIONS = ['header', 'solarReturn', 'muntha', 'yearLord', 'tajika', 'mudda', 'transits', 'howComputed', 'disclaimer'] as const;

export interface VarshaphalHtmlOptions {
  style: ChartStyle;
}

export function varshaphalReportHtml(m: VarshaphalReportModel, ctx: ReportContext, opts: VarshaphalHtmlOptions): string {
  const { t, lang } = ctx;
  const v = m.varshaphal;
  const tz = v.tz;
  const planet = (id: string): string => (locale.planetNames[lang] as Record<string, string>)[id] ?? id;
  const sign = (n: number): string => locale.signNames[lang][((n - 1) % 12 + 12) % 12];
  const body = (id: string): string => (id === 'Lg' ? t('charts.lagna') : planet(id));
  const date = (ms: number): string => formatInZone(ms, tz, 'd MMM yyyy', lang);

  const title = t('varshaphal.summaryTitle', { year: m.year });
  const centre = opts.style === 'north' ? undefined : [title];
  const returnChart =
    paragraph(t('report.returnLine', { line: m.returnLine })) +
    paragraph(`${t('varshaphal.ageLine', { year: m.year, age: m.age })} · ${t(v.dayReturn ? 'varshaphal.dayReturn' : 'varshaphal.nightReturn')}`, 'cap') +
    `<div class="charts"><div class="chart">${chartSvg(opts.style, v.chart, { lang, width: 320, centreLines: centre, title: t('varshaphal.returnChart') })}<div class="cap">${esc(t('varshaphal.returnChart'))}</div></div></div>` +
    planetTableHtml(ctx, m.planetTable, !v.chart.moonChart) +
    (v.approx ? paragraph(t('varshaphal.approxMoon'), 'cap') : '');

  const muntha = paragraph(t('varshaphal.munthaLine', { sign: sign(v.muntha.sign), house: v.muntha.house, lord: planet(v.muntha.lord) }));

  const lord =
    paragraph(t('varshaphal.yearLordLine', { planet: planet(v.yearLord.planet), role: t(`varshaphal.role.${v.yearLord.role}`) })) +
    `<h3>${esc(t('varshaphal.candidates'))}</h3>` +
    table(
      [t('varshaphal.candidate_col'), t('pdf.col.planet'), t('varshaphal.bala_col'), t('varshaphal.aspects')],
      v.yearLord.candidates.map((c) => [t(`varshaphal.role.${c.role}`), planet(c.planet), c.bala.toFixed(2), c.aspectsLagna ? `${t('varshaphal.aspectsLagna')}${c.aspectKind ? ` · ${t(`varshaphal.aspect.${c.aspectKind}`)}` : ''}` : t('varshaphal.noAspect')]),
      { numeric: [2] },
    );

  const aspects = v.tajikaAspects.length
    ? table(
        [t('report.col.bodies'), t('report.col.aspect'), t('report.col.distance')],
        v.tajikaAspects.map((a) => [`${body(a.a)} · ${body(a.b)}`, t(`varshaphal.aspect.${a.kind}`), a.distance]),
        { numeric: [2] },
      )
    : paragraph(t('report.noAspects'), 'cap');

  const mudda = table(
    [t('pdf.col.planet'), t('pdf.col.from'), t('pdf.col.to')],
    m.muddaTable.map((p) => [p.name, formatInZone(p.start, tz, 'd MMM yyyy HH:mm', lang), formatInZone(p.end, tz, 'd MMM yyyy HH:mm', lang)]),
  );

  const transits = table(
    [t('pdf.col.planet'), t('pdf.col.sign'), t('pdf.col.from'), t('pdf.col.to'), t('pdf.col.notes')],
    m.transitTable.map((x) => [x.name, x.signName, date(x.from), date(x.to), x.retrogradeEntry ? t('varshaphal.retroEntry_tag') : '']),
  );

  const html =
    headerSection(ctx, m.header, 'header') +
    section('solarReturn', t('report.section.solarReturn'), returnChart) +
    section('muntha', t('report.section.muntha'), muntha) +
    section('yearLord', t('report.section.yearLord'), lord) +
    section('tajika', t('report.section.tajika'), aspects) +
    `<section class="s long" id="mudda" data-section="mudda"><h2>${esc(t('report.section.mudda'))}</h2>${mudda}</section>` +
    `<section class="s long" id="transits" data-section="transits"><h2>${esc(t('report.section.transits'))}</h2>${transits}</section>` +
    computedSection(ctx, m.computedWith, m.ruleIds, 'howComputed') +
    disclaimerSection(ctx, m.disclaimer, 'disclaimer');

  const sub = [m.header.name ? t('pdf.forProfile', { name: m.header.name }) : '', t('report.returnLine', { line: m.returnLine })];
  return document(ctx, `${t('report.varshaphal')} · ${m.year}`, sub, html);
}
