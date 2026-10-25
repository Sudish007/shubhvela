// Chart computation for the app: engine.computeChart with the F19 settings, memoised per profile + settings.
// Everything shown about a chart comes from here (D8: every number computed).
import { computeChart, locale, type ChartData, type ChartOptions } from '@shubhvela/engine';
import type { Profile } from '../db/profiles';
import { getSetting, type Lang } from '../db/settings';
import { toBirthInput } from './profiles';

const cache = new Map<string, ChartData>();

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
