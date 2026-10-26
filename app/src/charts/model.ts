// Pure helpers behind the Charts tab (design.md 4, 10.3; plan A11): variant selection, corpus/glossary ids, the
// antar-strip geometry (M13: labels only in cells >= 28 dp), duration and position formatting, the chart's
// accessibility summary. No React here so every rule is unit-testable; every value derives from engine output.
import { chalit, isDivisionalChartId, locale, LOCKED_VARGA_IDS, moonChart, sunChart, varga, vargaInfo, type ChartData, type ChartPlanet, type DashaNode, type DashaTree, type DivisionalChartId, type PlanetId } from '@shubhvela/engine';
import { noBreak } from '../components/Num';
import type { Lang, TFn } from '../i18n';
import { fmtDate } from '../today/format';

/** Row chips (Lagna · Moon · Sun · Chalit · D9) plus the 14 locked vargas chosen from the "14 more vargas" sheet (B04). */
export type RowChip = 'lagna' | 'moon' | 'sun' | 'chalit' | 'D9';
export type ChartVariantChip = RowChip | DivisionalChartId;
export const VARIANT_CHIPS: readonly RowChip[] = ['lagna', 'moon', 'sun', 'chalit', 'D9'];

/** Row chips available for a chart: Moon-chart mode (F2) drops Lagna and Chalit, which need a birth time. */
export function chipsFor(chart: Pick<ChartData, 'moonChart'>): RowChip[] {
  return chart.moonChart ? ['moon', 'sun', 'D9'] : [...VARIANT_CHIPS];
}

/** True for the 14 vargas that sit behind the `vargas` key (D9 is a row chip and free). */
export function isLockedVarga(chip: ChartVariantChip): chip is DivisionalChartId {
  return isDivisionalChartId(chip) && (LOCKED_VARGA_IDS as readonly string[]).includes(chip);
}

export const CHIP_KEY: Record<RowChip, string> = {
  lagna: 'charts.lagna_chip',
  moon: 'charts.moon_chip',
  sun: 'charts.sun_chip',
  chalit: 'charts.chalit_chip',
  D9: 'charts.d9_chip',
};

/** "D10 Dasamsa" from the vargas.* strings (identical in every language: the Sanskrit name is the term). */
export function vargaLabel(id: DivisionalChartId, t: TFn): string {
  return t(`vargas.${id.toLowerCase()}`);
}

/** "read for work and standing" - the classical area a varga is read for (never a prediction). */
export function vargaDomainText(id: DivisionalChartId, t: TFn): string {
  return t('vargas.readFor', { domain: t(`vargas.domain.${vargaInfo(id).domainKey.replace('varga-domain-', '')}`) });
}

const variantCache = new WeakMap<ChartData, Map<ChartVariantChip, ChartData>>();

/** The ChartData drawn in the hero for a chip (memoised per base chart); the table and sheets read the base D1 chart. */
export function chartForChip(base: ChartData, chip: ChartVariantChip): ChartData {
  let m = variantCache.get(base);
  if (!m) {
    m = new Map();
    variantCache.set(base, m);
  }
  const hit = m.get(chip);
  if (hit) return hit;
  const v = computeVariant(base, chip);
  m.set(chip, v);
  return v;
}

function computeVariant(base: ChartData, chip: ChartVariantChip): ChartData {
  switch (chip) {
    case 'lagna':
      return base;
    case 'moon':
      return base.moonChart ? base : moonChart(base);
    case 'sun':
      return sunChart(base);
    case 'chalit':
      return chalit(base);
    default:
      // D9 and the 14 locked vargas all go through the same engine varga() and the same Chart component (F12).
      return varga(base, chip);
  }
}

/** Hero card title: unknown birth time names the Moon chart honestly (design 6). */
export function heroTitle(chip: ChartVariantChip, base: Pick<ChartData, 'moonChart'>, t: TFn): string {
  if (base.moonChart && (chip === 'lagna' || chip === 'moon')) return t('charts.moonUnknownTime');
  switch (chip) {
    case 'lagna':
      return t('charts.d1Title');
    case 'moon':
      return t('charts.moonChartTitle');
    case 'sun':
      return t('charts.sunChartTitle');
    case 'chalit':
      return t('charts.chalitTitle');
    case 'D9':
      return t('charts.d9Title');
    default:
      return vargaLabel(chip, t);
  }
}

// ---- ids shared with the content package (corpus/planet-sign, planet-house, lagna, glossary) ----

/** Lower-case English planet names: corpus ids `sun-mesha`, `sun-1`; glossary ids `sun`. */
export const PLANET_SLUG: Record<PlanetId, string> = {
  Su: 'sun',
  Mo: 'moon',
  Ma: 'mars',
  Me: 'mercury',
  Ju: 'jupiter',
  Ve: 'venus',
  Sa: 'saturn',
  Ra: 'rahu',
  Ke: 'ketu',
};

/** Lower-case Sanskrit sign names (1 = mesha ... 12 = meena) = glossary and corpus ids. */
export function signSlug(sign: number): string {
  return locale.signNames.en[((sign - 1) % 12 + 12) % 12].toLowerCase();
}

export function planetSignId(id: PlanetId, sign: number): string {
  return `${PLANET_SLUG[id]}-${signSlug(sign)}`;
}

export function planetHouseId(id: PlanetId, house: number): string {
  return `${PLANET_SLUG[id]}-${house}`;
}

export function lagnaId(sign: number): string {
  return `lagna-${signSlug(sign)}`;
}

export function planetName(lang: Lang, id: PlanetId): string {
  return locale.planetNames[lang][id];
}

export function signName(lang: Lang, sign: number): string {
  return locale.signNames[lang][((sign - 1) % 12 + 12) % 12];
}

export function nakshatraShortName(lang: Lang, n: number): string {
  return locale.nakshatraShort[lang][((n - 1) % 27 + 27) % 27];
}

export function nakshatraName(lang: Lang, n: number): string {
  return locale.nakshatraNames[lang][((n - 1) % 27 + 27) % 27];
}

/** "13°24′" (Latin digits; rendered through Num because U+2032 is not in Noto Sans Devanagari). */
export function degreeText(p: { degree: number; minute: number }, t: TFn): string {
  return t('charts.degree', { deg: p.degree, min: locale.pad2(p.minute) });
}

/**
 * Planet-table nakshatra cell: the SHORT name of design 4 / charts.html ("U. Bhadrapada 2") with the pada glued to the
 * last word only (N4). Only the space next to the pada becomes U+00A0, so "U." may wrap away from "Bhadrapada 2";
 * the full name in a forced single run broke mid-word in the table column on the A13 emulator shots
 * ("Uttara Bhadr / apada 2"; fixed by the Phase A fixer together with the 39 % column).
 */
export function padaText(p: { nakshatra: number; pada: number }, lang: Lang, t: TFn): string {
  const pada = String(p.pada);
  const s = t('charts.pada', { nakshatra: nakshatraShortName(lang, p.nakshatra), pada });
  const i = s.lastIndexOf(pada);
  if (i < 0) return noBreak(s);
  return s.slice(0, i).replace(/\s+$/, '\u00A0') + pada + s.slice(i + pada.length).replace(/^\s+/, '\u00A0');
}

/** The dignity/mark tags of a planet in display order; `approx` is the F2 marker (design 4 table). */
export function tagsFor(p: Pick<ChartPlanet, 'tags' | 'approx'>): string[] {
  const order = ['exalted', 'debilitated', 'own', 'friend', 'enemy', 'neutral', 'combust', 'retro', 'vargottama'];
  const tags = [...p.tags].sort((a, b) => order.indexOf(a) - order.indexOf(b));
  return p.approx ? [...tags, 'approx'] : tags;
}

/** Why? rule id behind an approx tag: declared uncertainty window, else a position within 1 deg of a boundary. */
export function approxRuleId(approxMinutes: number): string {
  return approxMinutes > 0 ? 'approx-birth-time' : 'approx-sign-boundary';
}

// ---- accessibility ----

/** "North Indian chart, Lagna Meena. House 1, Meena: Mars, Mercury, Saturn. House 2, Mesha: empty. ..." */
export function chartA11yLabel(chart: ChartData, styleName: string, lang: Lang, t: TFn): string {
  const summary = chart.houses
    .map((h) => {
      const planets = chart.planets.filter((p) => p.house === h.n).map((p) => planetName(lang, p.id));
      return planets.length
        ? t('charts.chartA11yHouse', { n: h.n, sign: signName(lang, h.sign), planets: planets.join(', ') })
        : t('charts.chartA11yEmpty', { n: h.n, sign: signName(lang, h.sign) });
    })
    .join(' ');
  const lagna = chart.moonChart ? t('charts.moonUnknownTime') : signName(lang, chart.firstHouseSign);
  return t('charts.chartA11y', { style: styleName, lagna, summary });
}

// ---- dasha (F14, design 10.3 M13) ----

/** Narrowest antar cell that still carries its label (dp); narrower cells keep the planet in the accessible label. */
export const ANTAR_LABEL_MIN_DP = 28;

export interface AntarCell {
  node: DashaNode;
  x: number;
  width: number;
  current: boolean;
  /** Draw the planet label inside the cell (width >= 28 dp); otherwise only the accessible label names it. */
  label: boolean;
}

/** Nine cells proportional to the antar durations inside the maha, in dp for a strip of `width`. */
export function antarCells(maha: DashaNode, nowMs: number, width: number): AntarCell[] {
  const span = maha.end - maha.start;
  const out: AntarCell[] = [];
  let x = 0;
  for (const a of maha.children ?? []) {
    const w = ((a.end - a.start) / span) * width;
    out.push({ node: a, x, width: w, current: a.start <= nowMs && nowMs < a.end, label: w >= ANTAR_LABEL_MIN_DP });
    x += w;
  }
  return out;
}

/** x position (dp) of the "you are here" marker inside the maha strip. */
export function antarMarkerX(maha: DashaNode, nowMs: number, width: number): number {
  const f = (nowMs - maha.start) / (maha.end - maha.start);
  return Math.min(width, Math.max(0, f * width));
}

export interface NextAntar {
  maha: DashaNode;
  antar: DashaNode;
}

/** The antar after the running one (crossing into the next maha when needed); null at the end of the tree. */
export function nextAntar(tree: DashaTree, nowMs: number): NextAntar | null {
  for (let i = 0; i < tree.mahas.length; i++) {
    const m = tree.mahas[i];
    const antars = m.children ?? [];
    for (let j = 0; j < antars.length; j++) {
      const a = antars[j];
      if (a.start <= nowMs && nowMs < a.end) {
        if (j + 1 < antars.length) return { maha: m, antar: antars[j + 1] };
        const nm = tree.mahas[i + 1];
        return nm && nm.children && nm.children.length ? { maha: nm, antar: nm.children[0] } : null;
      }
    }
  }
  return null;
}

const DAY_MS = 86_400_000;

/** "1 year 3 months 6 days" from a span in ms (dasha year 365.2425 d, month = year / 12); zero parts omitted. */
export function durationText(ms: number, t: TFn): string {
  const yearDays = 365.2425;
  let days = Math.max(0, Math.round(ms / DAY_MS));
  const years = Math.floor(days / yearDays);
  days -= Math.round(years * yearDays);
  const months = Math.floor(days / (yearDays / 12));
  days -= Math.round(months * (yearDays / 12));
  const parts: string[] = [];
  if (years) parts.push(t('common.years', { count: years }));
  if (months) parts.push(t('common.months', { count: months }));
  if (days || parts.length === 0) parts.push(t('common.days', { count: Math.max(0, days) }));
  return parts.join(' ');
}

/** "26 Nov 2025 – 14 Dec 2026" with the dash glued (N4). */
export function dateRange(start: number, end: number, tz: string, lang: Lang, t: TFn): string {
  return t('common.range', { from: noBreak(fmtDate(start, tz, lang)), to: noBreak(fmtDate(end, tz, lang)) });
}

/** Civil birth date "YYYY-MM-DD" -> "14 Mar 1998" via the engine month table. */
export function fmtBirthDate(day: string, lang: Lang): string {
  const [y, m, d] = day.split('-').map(Number);
  return `${d} ${locale.monthShort[lang][m - 1]} ${y}`;
}

/** "Lucknow" from "Lucknow, Uttar Pradesh, India" for the one-line birth caption. */
export function shortPlace(placeName: string): string {
  return placeName.split(',')[0].trim() || placeName;
}
