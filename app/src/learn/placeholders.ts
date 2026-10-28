// Lesson placeholder resolver (F32, C02 contract in packages/content/src/lessons.ts): every name in LESSON_PLACEHOLDERS maps
// to a display string computed from the reader's own chart (engine output in the UI language), never typed. Values that
// cannot be computed (unknown birth time -> no Lagna; no yoga formed) are the UI strings lesson.lagnaUnknown / lesson.noYoga,
// never an empty string, so every sentence still reads. Only the placeholders a lesson uses are evaluated (the thunks are
// lazy and share one set of memoised engine results), so the reader never pays for KP or Ashtakavarga it does not show.
import {
  changesBetween,
  current,
  formatOffset,
  janmaTithiFromBirth,
  locale,
  moonHouseFrom,
  NAKSHATRA_LORDS,
  panchang,
  SIGN_LORDS,
  taraNumber,
  TARA_KEYS,
  tithiEventDates,
  varga,
  type ChartData,
  type PanchangDay,
  type PlanetId,
} from '@shubhvela/engine';
import { LESSON_PLACEHOLDERS, type LessonPlaceholder, type LessonValues } from '@shubhvela/content';
import type { Profile } from '../db/profiles';
import { ashtakavargaFor, dashaFor, kpFor, sadeSatiFor, yogasFor } from '../engine-bridge/charts';
import type { Lang, TFn } from '../i18n';
import { fmtCivilDate, fmtDate, fmtRange, fmtTime, nakshatraName, planetName, signName, tithiName, weekdayName } from '../today/format';
import { vedicDayFor } from '../today/model';

export interface LessonContext {
  profile: Profile;
  chart: ChartData;
  nowMs: number;
  lang: Lang;
  t: TFn;
}

function planet(chart: ChartData, id: PlanetId) {
  const p = chart.planets.find((x) => x.id === id);
  if (!p) throw new Error(`chart has no ${id}`);
  return p;
}

/** "{deg}°{min}′" via the charts.degree template (Latin digits). */
function degreeOf(t: TFn, deg: number, min: number): string {
  return t('charts.degree', { deg, min: min < 10 ? `0${min}` : String(min) });
}

function yearsText(years: number): string {
  return (Math.round(years * 10) / 10).toFixed(1);
}

/** Resolver table: one lazy thunk per placeholder; engine results are computed at most once per call of lessonValues(). */
function resolvers(ctx: LessonContext): Record<LessonPlaceholder, () => string> {
  const { profile, chart, nowMs, lang, t } = ctx;
  const geo = { lat: profile.lat, lon: profile.lon };
  const tz = profile.tz;
  const sign = (s: number) => signName(lang, s);
  const name = (id: PlanetId) => planetName(lang, id);
  const lord = (s: number) => name(SIGN_LORDS[s - 1]);
  const moon = planet(chart, 'Mo');
  const unknownLagna = () => t('lesson.lagnaUnknown');

  let tree: ReturnType<typeof dashaFor> | null = null;
  const dashaTree = () => (tree ??= dashaFor(chart));
  const position = () => current(dashaTree(), nowMs);

  let today: PanchangDay | null = null;
  const todayP = () => (today ??= panchang(vedicDayFor(nowMs, geo, tz), geo, tz, { ayanamsa: chart.meta.ayanamsa }));

  let birth: PanchangDay | null = null;
  const birthP = () => (birth ??= panchang(vedicDayFor(chart.meta.utcMs, geo, tz), geo, tz, { ayanamsa: chart.meta.ayanamsa }));
  const at = <T extends { start: number; end: number }>(list: T[]): T | undefined => list.find((v) => v.start <= chart.meta.utcMs && chart.meta.utcMs < v.end) ?? list[0];

  let d9: ChartData | null = null;
  const navamsa = () => (d9 ??= varga(chart, 'D9'));

  const sade = () => sadeSatiFor(chart, nowMs);

  return {
    name: () => profile.name ?? t('family.relation.self'),
    moonSign: () => sign(moon.sign),
    moonSignLord: () => lord(moon.sign),
    lagna: () => (chart.lagna ? sign(chart.lagna.sign) : unknownLagna()),
    lagnaLord: () => (chart.lagna ? lord(chart.lagna.sign) : unknownLagna()),
    sunSign: () => sign(planet(chart, 'Su').sign),
    nakshatra: () => nakshatraName(lang, moon.nakshatra),
    pada: () => String(moon.pada),
    nakshatraLord: () => name(NAKSHATRA_LORDS[moon.nakshatra - 1]),
    mahaLord: () => {
      const p = position();
      return p ? name(p.maha.lord) : name(dashaTree().mahas[0].lord);
    },
    mahaEnds: () => {
      const p = position();
      return fmtDate(p ? p.maha.end : dashaTree().mahas[0].end, tz, lang);
    },
    antarLord: () => {
      const p = position();
      return p ? name(p.antar.lord) : name(dashaTree().mahas[0].children?.[0]?.lord ?? dashaTree().mahas[0].lord);
    },
    antarEnds: () => {
      const p = position();
      return fmtDate(p ? p.antar.end : dashaTree().mahas[0].children?.[0]?.end ?? dashaTree().mahas[0].end, tz, lang);
    },
    balanceLord: () => name(dashaTree().balanceAtBirth.lord),
    balanceYears: () => yearsText(dashaTree().balanceAtBirth.years),
    saturnSign: () => sign(sade().saturnSign),
    saturnHouseFromMoon: () => String(sade().saturnHouseFromMoon),
    saturnHouse: () => String(planet(chart, 'Sa').house),
    jupiterSign: () => sign(planet(chart, 'Ju').sign),
    jupiterHouse: () => String(planet(chart, 'Ju').house),
    marsHouse: () => String(planet(chart, 'Ma').house),
    venusSign: () => sign(planet(chart, 'Ve').sign),
    mercurySign: () => sign(planet(chart, 'Me').sign),
    rahuHouse: () => String(planet(chart, 'Ra').house),
    ketuHouse: () => String(planet(chart, 'Ke').house),
    moonHouse: () => String(moon.house),
    sunHouse: () => String(planet(chart, 'Su').house),
    moonDegree: () => degreeOf(t, moon.degree, moon.minute),
    moonNavamsaSign: () => sign(planet(navamsa(), 'Mo').sign),
    lagnaNavamsaSign: () => {
      const n = navamsa();
      return n.lagna ? sign(n.lagna.sign) : unknownLagna();
    },
    tenthLord: () => name(chart.houses[9].lord),
    seventhLord: () => name(chart.houses[6].lord),
    birthTithi: () => {
      const v = at(birthP().tithis);
      return v ? tithiName(lang, v.index) : tithiName(lang, birthP().tithi.index);
    },
    birthVara: () => weekdayName(lang, birthP().vara),
    birthYoga: () => locale.yogaNames[lang][(at(birthP().yogas) ?? birthP().yoga).index],
    birthKarana: () => locale.karanaNames[lang][(at(birthP().karanas) ?? birthP().karana).index],
    birthPlace: () => profile.placeName,
    birthTz: () => `${chart.meta.tz} (${formatOffset(chart.meta.offsetMinutes)})`,
    ayanamsa: () => t(`settings.ayanamsa.${chart.meta.ayanamsa}`),
    ayanamsaDegrees: () => {
      const deg = chart.meta.ayanamsaDegrees;
      const d = Math.floor(deg);
      return degreeOf(t, d, Math.floor((deg - d) * 60));
    },
    nodeMode: () => t(`settings.nodes.${chart.meta.node}`),
    todayMoonSign: () => sign(todayP().moonSign + 1),
    todayMoonHouseFromMoon: () => String(moonHouseFrom(moon.sign, todayP().moonSign + 1)),
    todayTara: () => t(`note.tara.${TARA_KEYS[taraNumber(moon.nakshatra, todayP().nakshatra.index + 1)]}`),
    todayTithi: () => tithiName(lang, todayP().tithi.index),
    todayNakshatra: () => nakshatraName(lang, todayP().nakshatra.index + 1),
    todayVara: () => weekdayName(lang, todayP().vara),
    rahuKaalToday: () => {
      const w = todayP().rahuKaal;
      return w ? fmtRange(w.start, w.end, tz) : t('common.none');
    },
    sunriseToday: () => {
      const s = todayP().sunrise;
      return s !== null ? fmtTime(s, tz) : t('common.none');
    },
    sunsetToday: () => {
      const s = todayP().sunset;
      return s !== null ? fmtTime(s, tz) : t('common.none');
    },
    nextJanmaTithi: () => {
      const janma = janmaTithiFromBirth(chart);
      const day = vedicDayFor(nowMs, geo, tz);
      const year = Number(day.slice(0, 4));
      const next = tithiEventDates(janma.amanta, year, year + 1, 'amanta', geo, tz).find((d) => d.date >= day);
      return next ? fmtCivilDate(next.date, lang) : t('common.none');
    },
    savLagna: () => String(ashtakavargaFor(chart).sav[0]),
    savTenth: () => String(ashtakavargaFor(chart).sav[9]),
    yogaCount: () => String(yogasFor(chart).found),
    firstYoga: () => {
      const first = yogasFor(chart).yogas.find((y) => y.formed);
      return first ? t(`yogas.name.${first.id}`) : t('lesson.noYoga');
    },
    kpLagnaSubLord: () => name(kpFor(profile).cusps[0].subLord),
    ephemeris: () => chart.meta.ephemeris,
  };
}

/** Values for the placeholders `used` (default: all 57), computed from the reader's chart. */
export function lessonValues(ctx: LessonContext, used: readonly string[] = LESSON_PLACEHOLDERS): LessonValues {
  const table = resolvers(ctx);
  const out: LessonValues = {};
  for (const key of used) {
    const r = table[key as LessonPlaceholder];
    if (!r) continue;
    try {
      out[key as LessonPlaceholder] = r();
    } catch (e) {
      if (__DEV__) console.warn('lesson placeholder failed', key, e);
    }
  }
  return out;
}

/** Natal Moon house of a transit Moon sign (1-12) - shared with the journal month grid. */
export function moonHouseOf(chart: ChartData, transitSign1: number): number {
  return moonHouseFrom(planet(chart, 'Mo').sign, transitSign1);
}

/** Dasha changes (maha + antar, pratyantar when allowed) inside [fromMs, toMs] for the journal hairlines. */
export function dashaChangesIn(chart: ChartData, fromMs: number, toMs: number, withPratyantar: boolean) {
  return changesBetween(dashaFor(chart), fromMs, toMs).filter((c) => withPratyantar || c.level !== 'pratyantar');
}
