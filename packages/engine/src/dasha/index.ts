// Vimshottari dasha tree, "you are here" lookups, planet ingress search and the Sade Sati / Dhaiya tracker
// (spec F7, F14, F15; design 10.3 F14/F15; plan A03). Pure functions over ChartData; all instants UTC ms.
//
// Conventions:
// - Dasha years are 365.2425 days (the fork's constant); the tree always spans at least 120 years from birth.
// - Ingress dates are exact sidereal sign crossings found by scanning + bisection (retrograde crossings are
//   reported with `retrograde: true`); nothing uses mean motion, so Sade Sati dates carry `approx: false`.
// - Sade Sati = Saturn in the 12th, 1st or 2nd sign from the natal Moon (phases 1, 2, 3); Dhaiya = Saturn in
//   the 4th or 8th sign. Retrograde re-entries appear as separate intervals inside the same episode.
import { Body, Ecliptic, GeoVector } from 'astronomy-engine';
import { getVimshottariDasha } from '../../vendor/jyotish/src/core/dashas';
import { type AyanamsaType } from '../../vendor/jyotish/src/core/ayanamsa';
import { type ChartData, type NodeMode, trueNodeLongitude } from '../kundli/index';
import { type PlanetId, planetIdFromKey } from '../locale/index';
import { DAY_MS, MIN_MS, ayanamsaAt, meanNodeTropical, norm360, wrap180 } from '../panchang/astro';

export type DashaLevel = 'maha' | 'antar' | 'pratyantar';

export interface DashaNode {
  lord: PlanetId;
  start: number;
  end: number;
  level: DashaLevel;
  children?: DashaNode[];
}

export interface DashaTree {
  birthUtcMs: number;
  /** Sidereal Moon longitude used for the balance. */
  moonLongitude: number;
  /** 1-27. */
  birthNakshatra: number;
  pada: number;
  balanceAtBirth: { lord: PlanetId; years: number; end: number };
  mahas: DashaNode[];
  yearDays: number;
}

export const DASHA_YEAR_DAYS = 365.2425;
export const VIMSHOTTARI_ORDER: readonly PlanetId[] = ['Ke', 'Ve', 'Su', 'Mo', 'Ma', 'Ra', 'Ju', 'Sa', 'Me'];
export const VIMSHOTTARI_YEARS: Record<PlanetId, number> = { Ke: 7, Ve: 20, Su: 6, Mo: 10, Ma: 7, Ra: 18, Ju: 16, Sa: 19, Me: 17 };

function lordId(name: string): PlanetId {
  const id = planetIdFromKey(name);
  if (!id) throw new Error(`Unknown dasha lord ${name}`);
  return id;
}

/** Full Vimshottari tree (maha -> antar -> pratyantar) with exact dates; spans >= 120 years from birth. */
export function dasha(chart: ChartData): DashaTree {
  const moon = chart.planets.find((p) => p.id === 'Mo');
  if (!moon) throw new Error('Chart has no Moon');
  const birth = new Date(chart.meta.utcMs);
  const horizon = new Date(chart.meta.utcMs + 120 * DASHA_YEAR_DAYS * DAY_MS + DAY_MS);
  const r = getVimshottariDasha(moon.longitude, birth, horizon);
  const mahas: DashaNode[] = r.mahadashas.map((m) => ({
    lord: lordId(m.planet),
    start: m.startTime.getTime(),
    end: m.endTime.getTime(),
    level: 'maha',
    children: (m.antars ?? []).map((a) => ({
      lord: lordId(a.planet),
      start: a.startTime.getTime(),
      end: a.endTime.getTime(),
      level: 'antar',
      children: (a.pratyantars ?? []).map((p) => ({ lord: lordId(p.planet), start: p.startTime.getTime(), end: p.endTime.getTime(), level: 'pratyantar' })),
    })),
  }));
  const first = mahas[0];
  return {
    birthUtcMs: chart.meta.utcMs,
    moonLongitude: moon.longitude,
    birthNakshatra: moon.nakshatra,
    pada: moon.pada,
    balanceAtBirth: { lord: first.lord, years: (first.end - first.start) / (DASHA_YEAR_DAYS * DAY_MS), end: first.end },
    mahas,
    yearDays: DASHA_YEAR_DAYS,
  };
}

export interface DashaPosition {
  maha: DashaNode;
  antar: DashaNode;
  pratyantar: DashaNode;
}

function findAt(nodes: DashaNode[] | undefined, utcMs: number): DashaNode | undefined {
  return nodes?.find((n) => n.start <= utcMs && utcMs < n.end);
}

/** The running maha/antar/pratyantar at an instant (null before birth or after the tree). */
export function current(tree: DashaTree, utcMs: number): DashaPosition | null {
  const maha = findAt(tree.mahas, utcMs);
  if (!maha) return null;
  const antar = findAt(maha.children, utcMs);
  if (!antar) return null;
  const pratyantar = findAt(antar.children, utcMs);
  if (!pratyantar) return null;
  return { maha, antar, pratyantar };
}

export interface DashaChange {
  level: DashaLevel;
  at: number;
  from: PlanetId;
  to: PlanetId;
  /** Parent lords of the new period (maha for an antar change; maha + antar for a pratyantar change). */
  within: PlanetId[];
}

function flatten(tree: DashaTree, level: DashaLevel): { node: DashaNode; within: PlanetId[] }[] {
  const out: { node: DashaNode; within: PlanetId[] }[] = [];
  for (const m of tree.mahas) {
    if (level === 'maha') {
      out.push({ node: m, within: [] });
      continue;
    }
    for (const a of m.children ?? []) {
      if (level === 'antar') {
        out.push({ node: a, within: [m.lord] });
        continue;
      }
      for (const p of a.children ?? []) out.push({ node: p, within: [m.lord, a.lord] });
    }
  }
  return out;
}

/** Next change of the given level strictly after `utcMs`; null when the tree ends first. */
export function nextChange(tree: DashaTree, utcMs: number, level: DashaLevel): DashaChange | null {
  const list = flatten(tree, level);
  for (let i = 0; i + 1 < list.length; i++) {
    const cur = list[i].node;
    if (cur.start <= utcMs && utcMs < cur.end) {
      const next = list[i + 1];
      return { level, at: cur.end, from: cur.lord, to: next.node.lord, within: next.within };
    }
  }
  return null;
}

/** Every change (maha, antar, pratyantar) inside [fromMs, toMs], ascending. */
export function changesBetween(tree: DashaTree, fromMs: number, toMs: number): DashaChange[] {
  const out: DashaChange[] = [];
  for (const level of ['maha', 'antar', 'pratyantar'] as const) {
    const list = flatten(tree, level);
    for (let i = 0; i + 1 < list.length; i++) {
      const end = list[i].node.end;
      if (end > fromMs && end <= toMs) out.push({ level, at: end, from: list[i].node.lord, to: list[i + 1].node.lord, within: list[i + 1].within });
    }
  }
  return out.sort((a, b) => a.at - b.at);
}

// ---------------------------------------------------------------- ingress search

export type IngressPlanet = 'Saturn' | 'Jupiter' | 'Rahu' | 'Ketu';

export interface IngressEvent {
  planet: IngressPlanet;
  at: number;
  /** 1-12. */
  fromSign: number;
  toSign: number;
  retrograde: boolean;
}

export interface IngressOptions {
  ayanamsa?: AyanamsaType;
  node?: NodeMode;
}

const SCAN_STEP: Record<IngressPlanet, number> = {
  Saturn: 2 * DAY_MS,
  Jupiter: 1 * DAY_MS,
  Rahu: 5 * DAY_MS,
  Ketu: 5 * DAY_MS,
};

function longitudeFn(planet: IngressPlanet, opts: IngressOptions): (ms: number) => number {
  const ay = opts.ayanamsa ?? 'lahiri';
  if (planet === 'Saturn' || planet === 'Jupiter') {
    const body = planet === 'Saturn' ? Body.Saturn : Body.Jupiter;
    return (ms) => norm360(Ecliptic(GeoVector(body, new Date(ms), true)).elon - ayanamsaAt(ms, ay));
  }
  const node = opts.node ?? 'mean';
  const rahu = node === 'true' ? (ms: number) => trueNodeLongitude(ms).tropical : meanNodeTropical;
  const shift = planet === 'Ketu' ? 180 : 0;
  return (ms) => norm360(rahu(ms) + shift - ayanamsaAt(ms, ay));
}

/** Sidereal longitude of an ingress planet at an instant (exported for the daily note and tests). */
export function siderealLongitude(planet: IngressPlanet, utcMs: number, opts: IngressOptions = {}): number {
  return longitudeFn(planet, opts)(utcMs);
}

/**
 * Sign ingresses of Saturn, Jupiter or the nodes inside [fromMs, toMs]: scan at the planet's step, bisect each
 * sign change to the minute. Direct and retrograde crossings are both reported.
 */
export function ingressDates(planet: IngressPlanet, fromMs: number, toMs: number, opts: IngressOptions = {}): IngressEvent[] {
  const lon = longitudeFn(planet, opts);
  const step = (opts.node === 'true' && (planet === 'Rahu' || planet === 'Ketu')) ? DAY_MS : SCAN_STEP[planet];
  const out: IngressEvent[] = [];
  let a = fromMs;
  let sa = Math.floor(lon(a) / 30);
  while (a < toMs) {
    const b = Math.min(a + step, toMs);
    const sb = Math.floor(lon(b) / 30);
    if (sb !== sa) {
      const forward = (sb - sa + 12) % 12 === 1;
      const boundary = (forward ? sb : sa) * 30;
      let lo = a;
      let hi = b;
      // f < 0 before a forward crossing; for a retrograde crossing the sign flips the other way.
      const f = (ms: number): number => wrap180(lon(ms) - boundary) * (forward ? 1 : -1);
      for (let i = 0; i < 40 && hi - lo > MIN_MS / 2; i++) {
        const mid = (lo + hi) / 2;
        if (f(mid) < 0) lo = mid;
        else hi = mid;
      }
      out.push({ planet, at: Math.round((lo + hi) / 2), fromSign: sa + 1, toSign: sb + 1, retrograde: !forward });
    }
    a = b;
    sa = sb;
  }
  return out;
}

// ---------------------------------------------------------------- Sade Sati / Dhaiya

export interface SignInterval {
  /** 1-12. */
  sign: number;
  start: number;
  end: number;
}

export interface SadeSatiPhase {
  /** 1 = Saturn in the 12th from the Moon, 2 = over the Moon, 3 = in the 2nd. */
  n: 1 | 2 | 3;
  start: number;
  end: number;
}

export interface SadeSatiEpisode {
  start: number;
  end: number;
  phases: SadeSatiPhase[];
}

export interface DhaiyaInterval {
  /** 4 = Kantaka (4th from the Moon), 8 = Ashtama (8th). */
  house: 4 | 8;
  start: number;
  end: number;
}

export type SadeSatiState =
  | { kind: 'sadesati'; phase: 1 | 2 | 3; start: number; end: number }
  | { kind: 'dhaiya'; house: 4 | 8; start: number; end: number }
  | { kind: 'none'; start: number; end: number };

export type SadeSatiEventKind = 'sadesati-start' | 'sadesati-phase' | 'sadesati-end' | 'dhaiya-start' | 'dhaiya-end';

export interface SadeSatiReport {
  /** 1-12. */
  natalMoonSign: number;
  /** Saturn's sidereal sign at `now`, 1-12. */
  saturnSign: number;
  /** House of transit Saturn counted from the natal Moon, 1-12. */
  saturnHouseFromMoon: number;
  state: SadeSatiState;
  episodes: SadeSatiEpisode[];
  dhaiyas: DhaiyaInterval[];
  next: { kind: SadeSatiEventKind; at: number; approx: boolean } | null;
  window: { from: number; to: number };
  saturnIntervals: SignInterval[];
}

export interface SadeSatiOptions extends IngressOptions {
  /** Years before `now` to include (default 12). */
  yearsBack?: number;
  /** Years after `now` to include (default 32, one Saturn cycle beyond the current episode). */
  yearsAhead?: number;
}

function saturnIntervals(fromMs: number, toMs: number, opts: IngressOptions): SignInterval[] {
  const events = ingressDates('Saturn', fromMs, toMs, opts);
  const out: SignInterval[] = [];
  let start = fromMs;
  let sign = Math.floor(siderealLongitude('Saturn', fromMs, opts) / 30) + 1;
  for (const e of events) {
    out.push({ sign, start, end: e.at });
    start = e.at;
    sign = e.toSign;
  }
  out.push({ sign, start, end: toMs });
  return out;
}

function houseFrom(sign: number, moonSign: number): number {
  return ((sign - moonSign + 12) % 12) + 1;
}

/**
 * Sade Sati / Dhaiya tracker: current state, phase dates of every episode in the window, Dhaiya intervals and
 * the next event. Dates come from exact Saturn ingress search (no mean motion), hence approx = false.
 */
export function sadeSati(chart: ChartData, nowMs: number, opts: SadeSatiOptions = {}): SadeSatiReport {
  const moon = chart.planets.find((p) => p.id === 'Mo');
  if (!moon) throw new Error('Chart has no Moon');
  const moonSign = moon.sign;
  const from = nowMs - (opts.yearsBack ?? 12) * DASHA_YEAR_DAYS * DAY_MS;
  const to = nowMs + (opts.yearsAhead ?? 32) * DASHA_YEAR_DAYS * DAY_MS;
  const intervals = saturnIntervals(from, to, opts);

  const PHASE_HOUSE: Record<number, 1 | 2 | 3> = { 12: 1, 1: 2, 2: 3 };
  const episodes: SadeSatiEpisode[] = [];
  const dhaiyas: DhaiyaInterval[] = [];
  let open: SadeSatiEpisode | null = null;
  for (const iv of intervals) {
    const h = houseFrom(iv.sign, moonSign);
    const phase = PHASE_HOUSE[h];
    if (phase) {
      if (!open) {
        open = { start: iv.start, end: iv.end, phases: [] };
        episodes.push(open);
      }
      open.phases.push({ n: phase, start: iv.start, end: iv.end });
      open.end = iv.end;
    } else {
      open = null;
      if (h === 4 || h === 8) dhaiyas.push({ house: h, start: iv.start, end: iv.end });
    }
  }

  const cur = intervals.find((iv) => iv.start <= nowMs && nowMs < iv.end) ?? intervals[intervals.length - 1];
  const curHouse = houseFrom(cur.sign, moonSign);
  let state: SadeSatiState;
  if (PHASE_HOUSE[curHouse]) state = { kind: 'sadesati', phase: PHASE_HOUSE[curHouse], start: cur.start, end: cur.end };
  else if (curHouse === 4 || curHouse === 8) state = { kind: 'dhaiya', house: curHouse, start: cur.start, end: cur.end };
  else state = { kind: 'none', start: cur.start, end: cur.end };

  // Next event: inside an episode/Dhaiya the end of the current interval; otherwise the next start.
  const classify = (h: number): 'sadesati' | 'dhaiya' | 'none' => (PHASE_HOUSE[h] ? 'sadesati' : h === 4 || h === 8 ? 'dhaiya' : 'none');
  const idx = intervals.indexOf(cur);
  let next: SadeSatiReport['next'] = null;
  if (idx >= 0 && idx + 1 < intervals.length) {
    const afterKind = classify(houseFrom(intervals[idx + 1].sign, moonSign));
    if (state.kind === 'sadesati') next = { kind: afterKind === 'sadesati' ? 'sadesati-phase' : 'sadesati-end', at: cur.end, approx: false };
    else if (state.kind === 'dhaiya') next = { kind: afterKind === 'sadesati' ? 'sadesati-start' : 'dhaiya-end', at: cur.end, approx: false };
    else {
      const up = intervals.slice(idx + 1).find((iv) => classify(houseFrom(iv.sign, moonSign)) !== 'none');
      if (up) next = { kind: classify(houseFrom(up.sign, moonSign)) === 'sadesati' ? 'sadesati-start' : 'dhaiya-start', at: up.start, approx: false };
    }
  }
  return { natalMoonSign: moonSign, saturnSign: cur.sign, saturnHouseFromMoon: curHouse, state, episodes, dhaiyas, next, window: { from, to }, saturnIntervals: intervals };
}
