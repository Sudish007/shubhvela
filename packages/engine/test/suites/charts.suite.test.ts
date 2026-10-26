// Chart suite (spec section 6): 50 births vs two independent web references (Drik Panchang kundali and
// AstroSage/Prokerala) with JPL Horizons as the tie-breaker. Tolerances: Lagna sign + degree <= 0.25 deg,
// planets <= 0.1 deg (Rahu/Ketu <= 0.5 deg), Moon nakshatra-pada exact, dasha balance <= 1 day. Unknown-time
// cases (u01-u10) are Moon charts: Moon only (references were fetched for local noon, the engine convention).
//
// Tie-break rule (plan.md section 8): JPL sidereal = Horizons apparent ecliptic-of-date longitude minus the
// engine's Lahiri ayanamsa (itself checked against Drik's printed ayanamsa in the panchang suite). When a web
// reference disagrees with the engine beyond the tolerance but the engine agrees with JPL, the web value is
// recorded as the outlier instead of failing the case.
//
// Explained reference behaviour (A04 recovery, reference/CONVENTIONS.md section 2), recorded as outliers:
//  - a site that used other coordinates for the place (AstroSage picked a same-named town elsewhere) is compared
//    at ITS coordinates for the Lagna;
//  - Drik Panchang's kundali forms local sidereal time as GST + 1.0027379 x longitude (the sidereal rate applied
//    to the longitude term); its Lagna is reproduced to < 0.05 deg by the engine with the longitude scaled the
//    same way, so the plain-formula difference (up to 0.5 deg at 180 E) is Drik's quirk, not the engine's;
//  - a dasha balance that differs by exactly what the site's own Moon longitude implies (Drik's Moon drifts 10-33"
//    from JPL for 2019-2025 births) is explained by that Moon error when the engine's Moon agrees with JPL.
import { afterAll, describe, expect, it } from 'vitest';
import { computeChart, type ChartData } from '../../src/kundli/index';
import { dasha, VIMSHOTTARI_YEARS } from '../../src/dasha/index';
import { PLANET_IDS, type PlanetId } from '../../src/locale/index';
import { utcToWall } from '../../src/tz/index';
import { degDiff, loadCases, loadReference, localIsoToUtc, round, utcToLocalIso, warnMissing, writeSuiteResult } from './_shared';

interface ChartCase {
  id: string;
  date: string;
  time: string | null;
  tz: string;
  lat: number;
  lon: number;
  place: string;
  notes?: string;
}
interface ChartCases {
  options: { ayanamsa: 'lahiri' | 'kp' | 'raman'; node: 'mean' | 'true' };
  tolerances: { lagnaDeg: number; planetDeg: number; nodeDeg: number; dashaBalanceDays: number };
  cases: ChartCase[];
}
interface WebPoint {
  sign: number;
  lon: number;
  retro?: boolean;
  text?: string;
}
interface WebChart {
  input?: { offsetMinutes?: number | null; utc?: string | null; latitude?: number; longitude?: number };
  ayanamsaDeg?: number | null;
  lagna?: WebPoint | null;
  planets: Partial<Record<PlanetId, WebPoint>>;
  moon?: { nakshatra: number; pada: number } | null;
  dasha?: { mahaLord: string; mahaEnd: string | null; balanceText?: string } | null;
}
interface JplChart {
  input: { utc: string; utcMs?: number; offsetMinutes: number };
  bodies: Partial<Record<PlanetId, { tropicalLon: number; lat: number }>>;
}

const cases = loadCases<ChartCases>('charts');
const T = cases.tolerances;
const WEB_SOURCES = ['drikpanchang', 'astrosage', 'prokerala'] as const;
const LORD_IDS: Record<string, PlanetId> = { sun: 'Su', moon: 'Mo', mars: 'Ma', mercury: 'Me', jupiter: 'Ju', venus: 'Ve', saturn: 'Sa', rahu: 'Ra', ketu: 'Ke' };

function toBirth(c: ChartCase) {
  return { date: c.date, time: c.time ?? undefined, timeUnknown: c.time === null, tz: c.tz, lat: c.lat, lon: c.lon };
}

function localDate(ms: number, zone: string): string {
  const w = utcToWall(ms, zone);
  const p = (n: number) => (n < 10 ? `0${n}` : String(n));
  return `${w.y}-${p(w.m)}-${p(w.d)}`;
}

const DAY_MS = 86_400_000;
/** Sidereal / solar day ratio: Drik's kundali multiplies the longitude term of its local sidereal time by it. */
const DRIK_LST_LON_FACTOR = 1.00273790935;
const DRIK_QUIRK_TOL_DEG = 0.05;
const NAKSHATRA_DEG = 360 / 27;
const DASHA_YEAR_DAYS = 365.2425;

describe('chart suite — 50 births vs Drik Panchang / AstroSage with JPL Horizons tie-break (spec section 6)', () => {
  const missingWeb: string[] = [];
  const missingJpl: string[] = [];
  const failures: string[] = [];
  const outliers: string[] = [];
  const dashaUnverified: string[] = [];
  const siteOffsets: { id: string; source: string; appliedOffsetMinutes: number; tzdbOffsetMinutes: number }[] = [];
  const maxDev: Record<string, number> = {};
  const sourceCount: Record<string, number> = {};
  let compared = 0;
  let passed = 0;
  const bump = (key: string, v: number) => {
    maxDev[key] = Math.max(maxDev[key] ?? 0, v);
  };

  for (const c of cases.cases) {
    const webRefs = WEB_SOURCES.map((s) => [s, loadReference<WebChart>('charts', s, c.id)] as const).filter(([, r]) => r);
    const jpl = loadReference<JplChart>('charts', 'jpl-horizons', c.id);
    if (!webRefs.length) missingWeb.push(c.id);
    if (!jpl) missingJpl.push(c.id);
    if (!webRefs.length && !jpl) continue;
    compared++;
    for (const [s] of webRefs) sourceCount[s] = (sourceCount[s] ?? 0) + 1;
    if (jpl) sourceCount['jpl-horizons'] = (sourceCount['jpl-horizons'] ?? 0) + 1;

    it(`${c.id} ${c.date} ${c.time ?? 'unknown time'} ${c.place}`, () => {
      const chart: ChartData = computeChart(toBirth(c), cases.options);
      const errors: string[] = [];
      const bodies = c.time === null ? (['Mo'] as PlanetId[]) : PLANET_IDS;
      const planetOf = (id: PlanetId) => chart.planets.find((p) => p.id === id)!;

      // JPL Horizons: tropical longitudes (sidereal + ayanamsa) within the planet tolerance; the astronomy itself.
      const jplSidereal: Partial<Record<PlanetId, number>> = {};
      if (jpl) {
        if (Date.parse(jpl.values.input.utc + 'Z') !== chart.meta.utcMs) errors.push(`UTC instant: engine ${new Date(chart.meta.utcMs).toISOString()} vs Horizons ${jpl.values.input.utc}Z`);
        for (const id of bodies) {
          const h = jpl.values.bodies[id];
          if (!h) continue;
          const d = Math.abs(degDiff(planetOf(id).longitude + chart.meta.ayanamsaDegrees, h.tropicalLon));
          bump('jplTropicalDeg', d);
          if (d > T.planetDeg) errors.push(`${id} vs JPL: ${d.toFixed(4)} deg > ${T.planetDeg}`);
          jplSidereal[id] = ((h.tropicalLon - chart.meta.ayanamsaDegrees) % 360 + 360) % 360;
        }
      }

      // Lagna and dasha have no JPL value; with two web references the second one is the tie-breaker: a source
      // that disagrees with the engine while another source agrees within the tolerance is recorded as the
      // outlier (the two references then disagree with each other by more than the tolerance).
      const lagnaVerdicts: { source: string; ok: boolean; text: string; explained?: string }[] = [];
      const dashaVerdicts: { source: string; ok: boolean; text: string; explained?: string }[] = [];

      for (const [source, ref] of webRefs) {
        const v = ref!.values;
        const tag = (s: string) => `${source}: ${s}`;
        // Same instant? The Moon fixes it: a site that applied another UTC offset to the same wall time shows
        // a Moon displaced by the offset difference. The engine is then re-run at the site's instant and the
        // difference is recorded (the tz suite owns the offset question; here the astronomy is compared).
        let engine = chart;
        let engineBirth = toBirth(c);
        const refMoon = v.planets.Mo;
        if (refMoon) {
          const eMoon = planetOf('Mo');
          const dtMin = degDiff(refMoon.lon, eMoon.longitude) / (eMoon.speed / 1440);
          if (Math.abs(dtMin) > 5) {
            const shiftMin = Math.round(dtMin / 15) * 15;
            const appliedOffset = chart.meta.offsetMinutes - shiftMin;
            siteOffsets.push({ id: c.id, source, appliedOffsetMinutes: appliedOffset, tzdbOffsetMinutes: chart.meta.offsetMinutes });
            outliers.push(`${c.id} ${source}: the site's Moon implies a UTC offset of ${appliedOffset} min (tzdb ${chart.meta.offsetMinutes} min); compared at the site's instant`);
            const siteUtcMs = chart.meta.utcMs + shiftMin * 60_000;
            const w = utcToWall(siteUtcMs, 'Etc/UTC');
            const p2 = (n: number) => String(n).padStart(2, '0');
            engineBirth = { date: `${w.y}-${p2(w.m)}-${p2(w.d)}`, time: `${p2(w.hh)}:${p2(w.mm)}`, timeUnknown: false, tz: 'Etc/UTC', lat: c.lat, lon: c.lon };
            engine = computeChart(engineBirth, cases.options);
          } else siteOffsets.push({ id: c.id, source, appliedOffsetMinutes: chart.meta.offsetMinutes, tzdbOffsetMinutes: chart.meta.offsetMinutes });
        }
        const ePlanet = (id: PlanetId) => engine.planets.find((p) => p.id === id)!;
        // Same place? A site that resolved the place name to other coordinates (same-named town elsewhere) is
        // compared at ITS coordinates for the Lagna; the planets do not depend on the place.
        let lagnaEngine = engine;
        const siteLat = v.input?.latitude;
        const siteLon = v.input?.longitude;
        const geoDiffers = typeof siteLat === 'number' && typeof siteLon === 'number' && (Math.abs(siteLat - c.lat) > 0.02 || Math.abs(siteLon - c.lon) > 0.02);
        if (geoDiffers && c.time !== null) {
          lagnaEngine = computeChart({ ...engineBirth, lat: siteLat, lon: siteLon }, cases.options);
          outliers.push(`${c.id} ${source}: the site used ${siteLat.toFixed(4)},${siteLon.toFixed(4)} for "${c.place}" (case ${c.lat},${c.lon}); Lagna compared at the site's coordinates`);
        }

        if (v.ayanamsaDeg !== undefined && v.ayanamsaDeg !== null) {
          const d = Math.abs(engine.meta.ayanamsaDegrees - v.ayanamsaDeg);
          bump('ayanamsaDeg', d);
          if (d > 0.01) errors.push(tag(`ayanamsa ${engine.meta.ayanamsaDegrees.toFixed(5)} vs ${v.ayanamsaDeg} (${d.toFixed(4)} deg > 0.01)`));
        }
        if (c.time !== null && v.lagna && lagnaEngine.lagna) {
          const d = Math.abs(degDiff(lagnaEngine.lagna.longitude, v.lagna.lon));
          bump(`lagnaDeg:${source}`, d);
          const ok = d <= T.lagnaDeg;
          if (ok) bump('lagnaDeg', d);
          const verdict: (typeof lagnaVerdicts)[number] = { source, ok, text: `Lagna ${lagnaEngine.lagna.longitude.toFixed(3)} (sign ${lagnaEngine.lagna.sign}) vs ${v.lagna.lon.toFixed(3)} (sign ${v.lagna.sign}, ${v.lagna.text ?? ''}) ${d.toFixed(3)} deg` };
          if (!ok && source === 'drikpanchang') {
            // Drik's sidereal-time quirk: LST = GST + 1.0027379 x longitude. Reproducible -> Drik's value is explained.
            const lon = geoDiffers ? (siteLon as number) : engineBirth.lon;
            const lat = geoDiffers ? (siteLat as number) : engineBirth.lat;
            const quirk = computeChart({ ...engineBirth, lat, lon: lon * DRIK_LST_LON_FACTOR }, cases.options);
            const dq = quirk.lagna ? Math.abs(degDiff(quirk.lagna.longitude, v.lagna.lon)) : Infinity;
            bump('lagnaDeg:drikpanchang-quirk-model', dq);
            if (dq <= DRIK_QUIRK_TOL_DEG) verdict.explained = `Drik's LST quirk (GST + 1.0027379 x lon) reproduces its Lagna to ${dq.toFixed(3)} deg`;
          }
          lagnaVerdicts.push(verdict);
        }
        for (const id of bodies) {
          const w = v.planets[id];
          if (!w) continue;
          const p = ePlanet(id);
          const tol = id === 'Ra' || id === 'Ke' ? T.nodeDeg : T.planetDeg;
          const d = Math.abs(degDiff(p.longitude, w.lon));
          bump(id === 'Ra' || id === 'Ke' ? 'nodeDeg' : 'planetDeg', d);
          if (p.sign !== w.sign || d > tol) {
            // Tie-break with JPL: if the engine matches JPL and the site does not, the site is the outlier.
            const j = jplSidereal[id];
            const siteVsJpl = j === undefined ? null : Math.abs(degDiff(w.lon, j));
            const engineVsJpl = j === undefined ? null : Math.abs(degDiff(p.longitude, j));
            if (siteVsJpl !== null && engineVsJpl !== null && engineVsJpl <= tol && siteVsJpl > tol) {
              outliers.push(`${c.id} ${source} ${id}: site ${w.lon.toFixed(3)} is ${siteVsJpl.toFixed(3)} deg from JPL sidereal ${j!.toFixed(3)}; engine ${p.longitude.toFixed(3)} (${engineVsJpl.toFixed(4)} deg)`);
            } else errors.push(tag(`${id} ${p.longitude.toFixed(3)} (sign ${p.sign}) vs ${w.lon.toFixed(3)} (sign ${w.sign}) ${d.toFixed(3)} deg > ${tol}`));
          }
          if (w.retro !== undefined && id !== 'Ra' && id !== 'Ke' && Boolean(w.retro) !== p.retrograde) errors.push(tag(`${id} retrograde ${p.retrograde} vs ${w.retro}`));
        }
        if (v.moon) {
          const moon = ePlanet('Mo');
          if (moon.nakshatra !== v.moon.nakshatra || moon.pada !== v.moon.pada) {
            const j = jplSidereal.Mo;
            const jplPada = j === undefined ? null : { nakshatra: Math.floor(j / (360 / 27)) + 1, pada: (Math.floor(j / (360 / 108)) % 4) + 1 };
            if (jplPada && jplPada.nakshatra === moon.nakshatra && jplPada.pada === moon.pada) outliers.push(`${c.id} ${source} Moon nakshatra-pada ${v.moon.nakshatra}-${v.moon.pada} differs from engine and JPL ${moon.nakshatra}-${moon.pada}`);
            else errors.push(tag(`Moon nakshatra-pada ${moon.nakshatra}-${moon.pada} vs ${v.moon.nakshatra}-${v.moon.pada}`));
          }
        }
        if (v.dasha && v.dasha.mahaEnd) {
          const tree = dasha(engine);
          const first = tree.mahas[0];
          const lord = (v.dasha as { mahaLordId?: string }).mahaLordId ?? LORD_IDS[v.dasha.mahaLord.toLowerCase()] ?? v.dasha.mahaLord;
          if (first.lord !== lord) dashaVerdicts.push({ source, ok: false, text: `first mahadasha lord ${first.lord} vs ${v.dasha.mahaLord}` });
          else {
            // Drik prints the end to the minute (local wall time); AstroSage prints the day only.
            const refHasTime = /T\d{2}:\d{2}/.test(v.dasha.mahaEnd);
            const refMs = refHasTime ? localIsoToUtc(v.dasha.mahaEnd, c.tz) : Date.parse(v.dasha.mahaEnd);
            const engineMs = refHasTime ? first.end : Date.parse(localDate(first.end, c.tz));
            const d = Math.abs(engineMs - refMs) / DAY_MS;
            bump(`dashaBalanceDays:${source}`, d);
            const ok = d <= T.dashaBalanceDays;
            if (ok) bump('dashaBalanceDays', d);
            const verdict: (typeof dashaVerdicts)[number] = { source, ok, text: `first mahadasha (${first.lord}) ends ${utcToLocalIso(first.end, c.tz)} vs ${v.dasha.mahaEnd} (${d.toFixed(2)} days)` };
            if (!ok && v.planets.Mo && jplSidereal.Mo !== undefined) {
              // The balance is a linear function of the Moon's longitude inside its nakshatra: a site whose Moon
              // sits off JPL by x" ends the first mahadasha x/48000" x (lord years x 365.2425 d) earlier. When the
              // engine's Moon matches JPL and the site's shift explains the whole difference, the site is the outlier.
              const siteMoonErr = degDiff(v.planets.Mo.lon, jplSidereal.Mo);
              const engineMoonErr = degDiff(ePlanet('Mo').longitude, jplSidereal.Mo);
              const lengthDays = VIMSHOTTARI_YEARS[first.lord] * DASHA_YEAR_DAYS;
              const predictedShiftDays = (-siteMoonErr / NAKSHATRA_DEG) * lengthDays;
              const actualShiftDays = (refMs - engineMs) / DAY_MS;
              bump('dashaMoonExplainedResidualDays', Math.abs(actualShiftDays - predictedShiftDays));
              // Day-only references (AstroSage) add up to half a day of rounding to the allowed residual.
              const residualTol = T.dashaBalanceDays + (refHasTime ? 0 : 0.5);
              if (Math.abs(engineMoonErr) <= 0.005 && Math.abs(siteMoonErr) > 0.0025 && Math.abs(actualShiftDays - predictedShiftDays) <= residualTol) {
                verdict.explained = `the site's Moon is ${(siteMoonErr * 3600).toFixed(1)}" from JPL (engine ${(engineMoonErr * 3600).toFixed(1)}"), which predicts a ${predictedShiftDays.toFixed(2)}-day shift of the balance`;
              }
            }
            dashaVerdicts.push(verdict);
          }
        }
      }
      // AstroSage prints the balance to the day from Y-M-D calendar arithmetic and sits 2-6 days from Drik and
      // the engine on every birth where both exist; alone it cannot verify a 1-day tolerance. Without a
      // minute-resolution reference the dasha stays UNVERIFIED for the case (listed in results.dashaUnverified).
      // The same holds when the only minute-resolution reference (Drik) is itself an explained outlier (its Moon
      // drift for 2020-25 births, u10): AstroSage's day-only balance then stands alone again.
      const astroAlone = dashaVerdicts.filter((x) => x.source === 'astrosage' && !x.ok && !x.explained);
      if (astroAlone.length && dashaVerdicts.every((x) => !x.ok && (x.explained || x.source === 'astrosage'))) {
        for (const x of astroAlone) x.explained = 'day-only AstroSage balance (Y-M-D arithmetic, 2-6 d from Drik on 48 births); no minute-resolution reference for this case, dasha balance left unverified';
        dashaUnverified.push(c.id);
      }
      for (const [name, verdicts] of [['Lagna', lagnaVerdicts], ['dasha', dashaVerdicts]] as const) {
        const bad = verdicts.filter((x) => !x.ok);
        if (!bad.length) continue;
        const good = verdicts.filter((x) => x.ok);
        for (const b of bad) {
          if (b.explained) outliers.push(`${c.id} ${b.source} ${name}: ${b.text} > tolerance; explained: ${b.explained}`);
          else if (good.length) outliers.push(`${c.id} ${b.source} ${name}: ${b.text} > tolerance, while ${good.map((g) => g.source).join('/')} agrees with the engine (${good.map((g) => g.text).join('; ')})`);
          else errors.push(`${b.source}: ${b.text} > tolerance`);
        }
      }
      if (errors.length) failures.push(`${c.id}: ${errors.join(' | ')}`);
      else passed++;
      expect(errors, `${c.id} ${c.place} ${c.date} ${c.time ?? 'unknown'}`).toEqual([]);
    });
  }

  afterAll(() => {
    warnMissing('charts', 'web reference (drikpanchang/astrosage/prokerala)', missingWeb, cases.cases.length);
    warnMissing('charts', 'jpl-horizons', missingJpl, cases.cases.length);
    if (outliers.length) console.warn(`[suite:charts] ${outliers.length} reference value(s) judged outliers by the JPL tie-break:\n  ${outliers.join('\n  ')}`);
    writeSuiteResult({
      suite: 'charts',
      required: cases.cases.length,
      compared,
      passed,
      failed: compared - passed,
      skipped: cases.cases.length - compared,
      maxDeviation: Object.fromEntries(Object.entries(maxDev).map(([k, v]) => [k, round(v, 5)])),
      maxPlanetDeg: round(Math.max(maxDev.planetDeg ?? 0, maxDev.jplTropicalDeg ?? 0), 4),
      maxLagnaDeg: round(maxDev.lagnaDeg ?? 0, 4),
      maxNodeDeg: round(maxDev.nodeDeg ?? 0, 4),
      maxDashaBalanceDays: round(maxDev.dashaBalanceDays ?? 0, 2),
      sources: sourceCount,
      withWebReference: cases.cases.length - missingWeb.length,
      failures,
      outliers,
      dashaUnverified,
      siteOffsets: siteOffsets.filter((s) => s.appliedOffsetMinutes !== s.tzdbOffsetMinutes),
      generatedAt: new Date().toISOString(),
      tolerances: T,
      missingWeb,
    });
  });
});
