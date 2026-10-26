// Chart computation for the app: engine.computeChart with the F19 settings, memoised per profile + settings.
// Everything shown about a chart comes from here (D8: every number computed).
import {
  ashtakavarga,
  computeChart,
  dasha,
  kp,
  locale,
  rulingPlanets,
  sadeSati,
  solarReturnInstant,
  utcToWall,
  varshaphal,
  yogas,
  type AshtakavargaReport,
  type ChartData,
  type ChartOptions,
  type DashaTree,
  type KpReport,
  type KpRulingPlanetsReport,
  type SadeSatiReport,
  type VarshaphalReport,
  type YogasReport,
} from '@shubhvela/engine';
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

// ---- Phase B (B04): yogas, Ashtakavarga, KP, Varshaphal - all memoised per chart object like the dasha tree ----

const yogasCache = new WeakMap<ChartData, YogasReport>();

/** F16 yoga detection for a chart (engine.yogas), memoised per chart object. */
export function yogasFor(chart: ChartData): YogasReport {
  const hit = yogasCache.get(chart);
  if (hit) return hit;
  const r = yogas(chart);
  yogasCache.set(chart, r);
  return r;
}

const avCache = new WeakMap<ChartData, AshtakavargaReport>();

/** F15 BAV/SAV for a chart, memoised per chart object. */
export function ashtakavargaFor(chart: ChartData): AshtakavargaReport {
  const hit = avCache.get(chart);
  if (hit) return hit;
  const r = ashtakavarga(chart);
  avCache.set(chart, r);
  return r;
}

const kpCache = new Map<string, KpReport>();

/**
 * F15 KP report for a profile: Placidus cusps with the KP ayanamsa (engine default) and the F19 node setting,
 * memoised per profile + node. The KP ayanamsa is fixed by the system itself, not by the Lahiri/Raman setting.
 */
export function kpFor(p: Profile): KpReport {
  const node = getSetting('node');
  const k = [p.id, p.birthDate, p.birthTime, p.timeUnknown, p.lat, p.lon, p.tz, node].join('|');
  const hit = kpCache.get(k);
  if (hit) return hit;
  const r = kp(toBirthInput(p), { node });
  kpCache.set(k, r);
  return r;
}

/** KP ruling planets for an instant at the profile's place (design 10.3: "ruling planets for now"). */
export function rulingPlanetsFor(p: Profile, nowMs: number): KpRulingPlanetsReport {
  return rulingPlanets(nowMs, { lat: p.lat, lon: p.lon, elevation: 0 }, p.tz, { node: getSetting('node') });
}

const vpCache = new WeakMap<ChartData, Map<number, VarshaphalReport>>();

/** F17 Varshaphal of a Gregorian year for a natal chart (birthplace, natal zone), memoised per chart + year. */
export function varshaphalFor(chart: ChartData, year: number): VarshaphalReport {
  let m = vpCache.get(chart);
  if (!m) {
    m = new Map();
    vpCache.set(chart, m);
  }
  const hit = m.get(year);
  if (hit) return hit;
  const r = varshaphal(chart, year);
  m.set(year, r);
  return r;
}

const srCache = new WeakMap<ChartData, Map<number, number>>();

/** Solar-return instant of a Gregorian year, memoised (the search costs a few ms per call). */
export function solarReturnFor(chart: ChartData, year: number): number {
  let m = srCache.get(chart);
  if (!m) {
    m = new Map();
    srCache.set(chart, m);
  }
  const hit = m.get(year);
  if (hit != null) return hit;
  const ms = solarReturnInstant(chart, year);
  m.set(year, ms);
  return ms;
}

export interface VedicYear {
  /** Gregorian year of the solar return that opened the running Vedic year. */
  runningYear: number;
  /** Instant that opened the running year (<= nowMs). */
  runningStart: number;
  /** Gregorian year of the next solar return. */
  nextYear: number;
  /** Instant of the next solar return (> nowMs). */
  nextStart: number;
}

/** The running Vedic year and the next return around `nowMs` (the civil year of `nowMs` in the natal zone decides). */
export function vedicYearAt(chart: ChartData, nowMs: number): VedicYear {
  const y = utcToWall(nowMs, chart.meta.tz).y;
  const thisYear = solarReturnFor(chart, y);
  if (thisYear <= nowMs) return { runningYear: y, runningStart: thisYear, nextYear: y + 1, nextStart: solarReturnFor(chart, y + 1) };
  return { runningYear: y - 1, runningStart: solarReturnFor(chart, y - 1), nextYear: y, nextStart: thisYear };
}

/** Instant of the next solar return after `nowMs` (the "Year begins" notification, F17). */
export function nextSolarReturn(chart: ChartData, nowMs: number): number {
  return vedicYearAt(chart, nowMs).nextStart;
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
