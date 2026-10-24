// Upcoming strip (spec F7, design 10.2 F7, plan A03): the next family tithi, vrat, saved muhurat, dasha change
// and major transit for a profile, in the fixed card order. Empty kinds are omitted (the UI shows "Add a family
// date" when everything is empty).
import { type ChartData } from '../kundli/index';
import { DAY_MS, type GeoPoint, type Tradition, localDateOf, resolveZone, sunriseOn } from '../panchang/astro';
import { type DashaLevel, type IngressPlanet, dasha, ingressDates, nextChange } from '../dasha/index';
import { janmaTithiFromBirth, tithiEventDates } from './tithiEvents';
import { VRAT_FAMILIES, type VratFamily, type VratOccurrence, allVratOccurrences } from './vrats';

export type UpcomingKind = 'familyTithi' | 'vrat' | 'savedMuhurat' | 'dashaChange' | 'majorTransit';
export const UPCOMING_ORDER: readonly UpcomingKind[] = ['familyTithi', 'vrat', 'savedMuhurat', 'dashaChange', 'majorTransit'];

export interface UpcomingProfile {
  id?: string;
  name?: string;
  chart: ChartData;
  tradition: Tradition;
  /** Enabled vrat families (default: all twelve). */
  vratFamilies?: readonly VratFamily[];
}

export interface SavedMuhurat {
  id?: string;
  activity: string;
  start: number;
  end: number;
}

export interface UpcomingItem {
  kind: UpcomingKind;
  /** Instant the card counts down to. */
  at: number;
  /** Civil date of `at` in the profile's zone. */
  date: string;
  ruleId: string;
  params: Record<string, string | number | boolean | null>;
}

export interface UpcomingOptions {
  /** Days ahead to search for vrats (default 60). */
  vratHorizonDays?: number;
}

/**
 * Next items for the Upcoming strip. `nowMs` is the reference instant; `geo`/`tz` are the profile's current
 * location (events are computed where the user is, like the Today band).
 */
export function upcoming(profile: UpcomingProfile, savedMuhurats: SavedMuhurat[], nowMs: number, geo: GeoPoint, tz: string, opts: UpcomingOptions = {}): UpcomingItem[] {
  const zone = resolveZone(tz);
  const today = localDateOf(nowMs, zone);
  const year = Number(today.slice(0, 4));
  const items: UpcomingItem[] = [];

  // 1. Family tithi: the profile's next janma tithi.
  const janma = janmaTithiFromBirth(profile.chart);
  const dates = tithiEventDates(janma.amanta, year, year + 1, 'amanta', geo, zone).filter((d) => d.date >= today);
  if (dates.length) {
    const next = dates[0];
    const month = profile.tradition === 'amanta' ? next.month.amanta : next.month.purnimanta;
    const birthYear = Number(localDateOf(profile.chart.meta.utcMs, profile.chart.meta.tz).slice(0, 4));
    items.push({
      kind: 'familyTithi',
      at: sunriseOn(next.date, zone, geo) ?? Date.UTC(next.year, Number(next.date.slice(5, 7)) - 1, Number(next.date.slice(8, 10))),
      date: next.date,
      ruleId: 'janma-tithi',
      params: {
        name: profile.name ?? null,
        month: month.index,
        adhik: month.adhik,
        paksha: janma.paksha,
        tithi: janma.amanta.tithi,
        system: profile.tradition,
        nth: next.year - birthYear,
        convention: next.convention,
        bornInAdhik: janma.adhik,
      },
    });
  }

  // 2. Next vrat among the enabled families.
  const families = profile.vratFamilies ?? VRAT_FAMILIES;
  if (families.length) {
    const horizon = nowMs + (opts.vratHorizonDays ?? 60) * DAY_MS;
    // Today's vrat still counts while its key time (parana, moonrise, pradosh ...) has not passed.
    const occ: VratOccurrence | undefined = allVratOccurrences(nowMs, horizon, geo, zone, families).find((o) => o.date > today || (o.date === today && (o.keyTime.end ?? o.keyTime.start) >= nowMs));
    if (occ) {
      const month = profile.tradition === 'amanta' ? occ.month.amanta : occ.month.purnimanta;
      items.push({
        kind: 'vrat',
        at: sunriseOn(occ.date, zone, geo) ?? Date.UTC(Number(occ.date.slice(0, 4)), Number(occ.date.slice(5, 7)) - 1, Number(occ.date.slice(8, 10))),
        date: occ.date,
        ruleId: occ.ruleId,
        params: { family: occ.family, name: occ.name, keyTimeKind: occ.keyTime.kind, keyTimeStart: occ.keyTime.start, keyTimeEnd: occ.keyTime.end ?? null, month: month.index, adhik: month.adhik, paksha: occ.paksha, tithi: occ.tithi },
      });
    }
  }

  // 3. Next saved muhurat.
  const saved = savedMuhurats.filter((m) => m.end > nowMs).sort((a, b) => a.start - b.start)[0];
  if (saved) {
    items.push({ kind: 'savedMuhurat', at: saved.start, date: localDateOf(saved.start, zone), ruleId: `muhurat-${saved.activity}`, params: { activity: saved.activity, start: saved.start, end: saved.end, id: saved.id ?? null } });
  }

  // 4. Next dasha change (antar level; a maha change always coincides with an antar change).
  const tree = dasha(profile.chart);
  const antar = nextChange(tree, nowMs, 'antar');
  if (antar) {
    const maha = nextChange(tree, nowMs, 'maha');
    const level: DashaLevel = maha && maha.at === antar.at ? 'maha' : 'antar';
    const change = level === 'maha' && maha ? maha : antar;
    items.push({
      kind: 'dashaChange',
      at: change.at,
      date: localDateOf(change.at, zone),
      ruleId: 'dasha-change',
      params: { level, from: change.from, to: change.to, within: change.within.join('-') || null, nextMaha: level === 'maha' && maha ? maha.to : antar.within[0] ?? null },
    });
  }

  // 5. Next major transit: Saturn, Jupiter or Rahu/Ketu sign change.
  const horizons: Record<Exclude<IngressPlanet, 'Ketu'>, number> = { Saturn: 3.2, Jupiter: 1.6, Rahu: 2 };
  let best: { planet: IngressPlanet; at: number; fromSign: number; toSign: number; retrograde: boolean } | null = null;
  for (const planet of ['Saturn', 'Jupiter', 'Rahu'] as const) {
    const ev = ingressDates(planet, nowMs, nowMs + horizons[planet] * 365.25 * DAY_MS, { ayanamsa: profile.chart.meta.ayanamsa, node: profile.chart.meta.node })[0];
    if (ev && (!best || ev.at < best.at)) best = ev;
  }
  if (best) {
    items.push({
      kind: 'majorTransit',
      at: best.at,
      date: localDateOf(best.at, zone),
      ruleId: `transit-${best.planet.toLowerCase()}`,
      params: { planet: best.planet, fromSign: best.fromSign, toSign: best.toSign, retrograde: best.retrograde, ketuToSign: best.planet === 'Rahu' ? ((best.toSign + 5) % 12) + 1 : null },
    });
  }

  return items.sort((a, b) => UPCOMING_ORDER.indexOf(a.kind) - UPCOMING_ORDER.indexOf(b.kind));
}
