// Chart computation for the app: engine.computeChart with the F19 settings, memoised per profile + settings.
// Everything shown about a chart comes from here (D8: every number computed).
import { computeChart, dasha, locale, sadeSati, type ChartData, type ChartOptions, type DashaTree, type SadeSatiReport } from '@shubhvela/engine';
import { listProfiles, type Profile } from '../db/profiles';
import { getSetting, type Lang } from '../db/settings';
import { toBirthInput } from './profiles';

const cache = new Map<string, ChartData>();
// Dasha trees are keyed by the chart object, so a recomputed chart (new settings) gets a new tree automatically.
const dashaCache = new WeakMap<ChartData, DashaTree>();

export function chartOptions(): Required<Pick<ChartOptions, 'ayanamsa' | 'node'>> {
  return { ayanamsa: getSetting('ayanamsa'), node: getSetting('node') };
}

function keyFor(p: Profile, opts: ChartOptions): string {
  return [p.id, p.birthDate, p.birthTime, p.timeUnknown, p.timeApproxMinutes, p.lat, p.lon, p.tz, opts.ayanamsa, opts.node].join('|');
}

/** Synchronous (design.md 10.1 F1: "Show my chart" computes on-device and lands on Today). */
export function chartFor(p: Profile, opts: ChartOptions = chartOptions()): ChartData {
  const k = keyFor(p, opts);
  const hit = cache.get(k);
  if (hit) return hit;
  const chart = computeChart(toBirthInput(p), opts);
  cache.set(k, chart);
  return chart;
}

/** Called when F19 settings change or data is deleted: every chart is recomputed on next use. */
export function clearChartCache(): void {
  cache.clear();
}

/**
 * F19: after an ayanamsa/node change every profile's chart is recomputed NOW with the new settings (the toast that
 * follows reports a recomputation that has actually happened). Returns the number of charts recomputed.
 */
export function recomputeAllCharts(): number {
  clearChartCache();
  const opts = chartOptions();
  let n = 0;
  for (const p of listProfiles()) {
    try {
      chartFor(p, opts);
      n++;
    } catch (e) {
      if (__DEV__) console.warn('chart failed', p.id, e);
    }
  }
  return n;
}

/** Vimshottari tree for a chart, memoised per chart object (engine.dasha spans >= 120 years and is not free). */
export function dashaFor(chart: ChartData): DashaTree {
  const hit = dashaCache.get(chart);
  if (hit) return hit;
  const tree = dasha(chart);
  dashaCache.set(chart, tree);
  return tree;
}

const sadeSatiCache = new WeakMap<ChartData, { nowMs: number; report: SadeSatiReport }>();

/** Sade Sati report for a chart at an instant, memoised per chart object and instant (~160 ms of ingress search). */
export function sadeSatiFor(chart: ChartData, nowMs: number): SadeSatiReport {
  const hit = sadeSatiCache.get(chart);
  if (hit && hit.nowMs === nowMs) return hit.report;
  const report = sadeSati(chart, nowMs);
  sadeSatiCache.set(chart, { nowMs, report });
  return report;
}

export interface MoonLine {
  sign: string;
  nakshatra: string;
  pada: number;
  /** F2: approximate birth time or Moon within 1 deg of a sign boundary. */
  approx: boolean;
  moonChart: boolean;
}

/** The F1 first value: Moon sign and nakshatra in the UI language (engine locale tables, N6). */
export function moonLine(chart: ChartData, lang: Lang): MoonLine {
  const moon = chart.planets.find((pl) => pl.id === 'Mo');
  if (!moon) throw new Error('chart has no Moon');
  return {
    sign: locale.signNames[lang][moon.sign - 1],
    nakshatra: locale.nakshatraNames[lang][moon.nakshatra - 1],
    pada: moon.pada,
    approx: moon.approx,
    moonChart: chart.moonChart,
  };
}
