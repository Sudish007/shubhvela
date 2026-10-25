// panchang(day, observer, tz) -> PanchangDay: every F8 field (spec 3.2 F8, design 10.2 F8, plan A03).
// Anchor = the udaya (sunrise) values of the civil date; transitions are listed over the Vedic day
// (sunrise -> next sunrise). All instants are UTC ms; the caller renders them with formatInZone.
//
// Conventions (binding for A04 to validate against Drik Panchang; also listed in FEAT-A03 findings):
// - Udaya tithi/nakshatra/yoga/karana = the value running at sunrise; "endsAt" is its exact end.
// - Vara = weekday of the civil date of sunrise (the Vedic day keeps it until the next sunrise).
// - Amanta month = lunation named by the sankranti it contains; Adhik when it has none (astro.ts).
// - Purnimanta month per purnimantaMonth() (Krishna paksha -> next name, except inside an Adhik lunation).
// - Vikram/Shaka change at Chaitra Shukla Pratipada (samvatFor()).
// - Ritu and ayana are given on two bases because Drik Panchang prints both ("Drik Ritu" / "Vedic Ritu"):
//   `drik` = tropical Sun (Vasanta from tropical 330 deg, Uttarayana from the December solstice);
//   `vedic` ritu = the Amanta lunar month pair (Chaitra-Vaishakha Vasanta ... Magha-Phalguna Shishira, an
//   Adhik month counts with its name), `vedic` ayana = sidereal Sun (Uttarayana from Makara sankranti).
//   (A04: the earlier sidereal-Sun ritu disagreed with Drik on 7 of 60 days; the lunar-month rule agrees.)
// - Brahma muhurta = the 14th of the 15 equal muhurtas of the NIGHT (sunset -> sunrise), i.e. 2/15 -> 1/15 of
//   the night before sunrise (Drik Panchang; validated in A04 — the fixed 96 -> 48 minute variant was up to
//   16 min off in June). Abhijit = 8th of 15 equal daytime muhurtas.
// - Hora = 12 equal daytime horas + 12 equal night horas starting with the vara lord (Chaldean order
//   Sun, Venus, Mercury, Moon, Saturn, Jupiter, Mars).
// - Moonrise/moonset are the events of the VEDIC day (sunrise -> next sunrise), as Drik Panchang prints them
//   (a moonrise after midnight belongs to the previous civil date's panchang); null when the Moon does not
//   rise/set in that span. The instant is the Moon's centre on the true horizon (astro.ts).
// - Vikram/Shaka change on the Chaitra Shukla Pratipada day; when that Pratipada touches no sunrise (kshaya)
//   the day it begins carries the new year while the month at sunrise stays the old one (Drik, 2026-03-19).
import { type AyanamsaType } from '../../vendor/jyotish/src/core/ayanamsa';
import { calculateChoghadiya } from '../../vendor/jyotish/src/core/muhurta/choghadiya';
import { getSpecialYoga } from '../../vendor/jyotish/src/core/calculations';
import { utcToWall } from '../tz/index';
import { type PlanetId } from '../locale/index';
import {
  DAY_MS,
  MIN_MS,
  type DayFrame,
  type GeoPoint,
  type LunarMonth,
  type Paksha,
  type Samvat,
  addDays,
  ayanamsaAt,
  dayFrame,
  intervalsCovering,
  karanaInterval,
  localMidnight,
  lunationAt,
  moonSignInterval,
  moonriseBetween,
  moonsetBetween,
  nakshatraInterval,
  nextCrossing,
  nextLunation,
  prevCrossing,
  parseLocalDate,
  pakshaOfTithi,
  purnimantaMonth,
  resolveZone,
  samvatFor,
  siderealMoon,
  siderealSun,
  sunsetOn,
  sunTropical,
  STEP,
  sunSignIndexAt,
  tithiInterval,
  VISHTI_KARANA,
  weekdayOf,
  yogaInterval,
} from './astro';

export type { GeoPoint, DayFrame, LunarMonth, Paksha, Samvat } from './astro';

export interface PanchangOptions {
  ayanamsa?: AyanamsaType;
}

export interface TimedValue {
  /** 0-based index into the locale name table. */
  index: number;
  start: number;
  end: number;
}

export interface TithiValue extends TimedValue {
  /** 1-30. */
  n: number;
  paksha: Paksha;
}

export interface NakshatraValue extends TimedValue {
  /** 1-4 at sunrise (for the udaya entry) or at the interval start. */
  pada: number;
  /** Vimshottari lord of the nakshatra. */
  lord: PlanetId;
}

export interface KaranaValue extends TimedValue {
  /** Vishti karana = Bhadra. */
  bhadra: boolean;
}

export interface Window {
  start: number;
  end: number;
}

export type ChoghadiyaName = 'Udveg' | 'Chal' | 'Labh' | 'Amrit' | 'Kaal' | 'Rog' | 'Shubh';

export interface ChoghadiyaSlot extends Window {
  name: ChoghadiyaName;
  /** 'good' | 'neutral' | 'bad' as the classical rating. */
  rating: 'good' | 'neutral' | 'bad';
  night: boolean;
  /** 1-8 within the day or night half. */
  n: number;
}

export interface HoraSlot extends Window {
  lord: PlanetId;
  night: boolean;
  /** 1-24 from sunrise. */
  n: number;
}

export type RituIndex = 0 | 1 | 2 | 3 | 4 | 5; // Vasanta, Grishma, Varsha, Sharad, Hemanta, Shishira
export type Ayana = 'uttarayana' | 'dakshinayana';
export type BhadraLocation = 'earth' | 'heaven' | 'patal';

export interface BhadraWindow extends Window {
  location: BhadraLocation;
  /** Sidereal Moon sign (0 = Mesha) that decided the location (at the Bhadra start). */
  moonSign: number;
}

export interface SpecialYogaDay {
  key: string;
  auspicious: boolean;
}

export interface PanchangDay {
  date: string;
  tz: string;
  offsetMinutes: number;
  ayanamsa: AyanamsaType;
  ayanamsaDeg: number;
  /** True when sunrise/sunset/next sunrise are undefined (polar latitudes); the astronomical fields are then empty. */
  noSun: boolean;
  sunrise: number | null;
  sunset: number | null;
  nextSunrise: number | null;
  /** Moonrise/moonset inside the Vedic day sunrise -> next sunrise (null when the Moon does not rise/set in it). */
  moonrise: number | null;
  moonset: number | null;
  /** 0 = Sunday. */
  vara: number;
  varaLord: PlanetId;
  /** Values at sunrise with their end times. */
  tithi: TithiValue;
  nakshatra: NakshatraValue;
  yoga: TimedValue;
  karana: KaranaValue;
  /** Every tithi/nakshatra/yoga/karana/moon-sign interval touching the Vedic day, in order. */
  tithis: TithiValue[];
  nakshatras: NakshatraValue[];
  yogas: TimedValue[];
  karanas: KaranaValue[];
  moonSigns: TimedValue[];
  /** Sidereal signs at sunrise, 0 = Mesha. */
  sunSign: number;
  moonSign: number;
  monthAmanta: LunarMonth;
  monthPurnimanta: LunarMonth;
  /** The lunation (new moon to new moon) holding the sunrise. */
  lunation: { start: number; end: number; fullMoon: number };
  samvat: Samvat;
  vikramSamvat: number;
  shakaSamvat: number;
  ritu: { vedic: RituIndex; drik: RituIndex };
  ayana: { vedic: Ayana; drik: Ayana };
  /** Classical day segments (also the inputs of goodHours). */
  rahuKaal: Window | null;
  yamaganda: Window | null;
  gulika: Window | null;
  abhijit: Window | null;
  /** 14th night muhurta (2/15 -> 1/15 of the night) before the NEXT sunrise: the Brahma muhurta inside this Vedic day. */
  brahma: Window | null;
  /** The same window before THIS sunrise (the one almanacs print for the civil morning). */
  brahmaMorning: Window | null;
  choghadiya: { day: ChoghadiyaSlot[]; night: ChoghadiyaSlot[] };
  hora: HoraSlot[];
  /** Vishti karana windows overlapping the Vedic day. */
  bhadra: BhadraWindow[];
  /** Moon in Kumbha/Meena (Dhanishta pada 3 -> Revati) overlapping the Vedic day; full extent. */
  panchak: Window | null;
  /** Direction to avoid for travel on this vara. */
  dishaShool: DishaShoolInfo;
  specialYogas: SpecialYogaDay[];
}

export type Direction = 'east' | 'west' | 'north' | 'south';

export interface DishaShoolInfo {
  vara: number;
  avoid: Direction;
  safe: Direction[];
  ruleId: 'disha-shool';
}

/** Vara lords, 0 = Sunday. */
export const VARA_LORDS: readonly PlanetId[] = ['Su', 'Mo', 'Ma', 'Me', 'Ju', 'Ve', 'Sa'];
/** Hora sequence (Chaldean order). */
export const HORA_ORDER: readonly PlanetId[] = ['Su', 'Ve', 'Me', 'Mo', 'Sa', 'Ju', 'Ma'];
/** Vimshottari lords by nakshatra (0 = Ashwini). */
export const NAKSHATRA_LORDS: readonly PlanetId[] = ['Ke', 'Ve', 'Su', 'Mo', 'Ma', 'Ra', 'Ju', 'Sa', 'Me', 'Ke', 'Ve', 'Su', 'Mo', 'Ma', 'Ra', 'Ju', 'Sa', 'Me', 'Ke', 'Ve', 'Su', 'Mo', 'Ma', 'Ra', 'Ju', 'Sa', 'Me'];

const DISHA_SHOOL: readonly Direction[] = ['west', 'east', 'north', 'north', 'south', 'west', 'east'];
const ALL_DIRECTIONS: readonly Direction[] = ['east', 'west', 'north', 'south'];

/** Disha Shool (travel direction to avoid) for a weekday (0 = Sunday): Sun/Fri west, Mon/Sat east, Tue/Wed north, Thu south. */
export function dishaShool(vara: number): DishaShoolInfo {
  const v = ((vara % 7) + 7) % 7;
  const avoid = DISHA_SHOOL[v];
  return { vara: v, avoid, safe: ALL_DIRECTIONS.filter((d) => d !== avoid), ruleId: 'disha-shool' };
}

/** Rahu Kaal, Yamaganda and Gulika as eighths of daylight (1-based part per weekday, Sun..Sat). */
export const RAHU_PART = [8, 2, 7, 5, 6, 4, 3] as const;
export const YAMAGANDA_PART = [5, 4, 3, 2, 1, 7, 6] as const;
export const GULIKA_PART = [7, 6, 5, 4, 3, 2, 1] as const;

export function eighth(frame: Pick<DayFrame, 'sunrise' | 'sunset'>, part: number): Window {
  return partOfEight(frame.sunrise, frame.sunset, part);
}

export function abhijitWindow(frame: Pick<DayFrame, 'sunrise' | 'sunset'>): Window {
  const unit = (frame.sunset - frame.sunrise) / 15;
  return { start: Math.round(frame.sunrise + 7 * unit), end: Math.round(frame.sunrise + 8 * unit) };
}

/** Fallback muhurta length when the night length is unknown (polar guard). */
export const BRAHMA_MUHURTA_MINUTES = 48;

/**
 * Brahma muhurta before a sunrise = the 14th of the night's 15 equal muhurtas: from 2/15 to 1/15 of the night
 * (sunset -> that sunrise) before it. Without a night start the fixed 96 -> 48 minute window is used.
 */
export function brahmaWindow(sunrise: number, nightStart?: number): Window {
  const unit = nightStart !== undefined && nightStart < sunrise ? (sunrise - nightStart) / 15 : BRAHMA_MUHURTA_MINUTES * MIN_MS;
  return { start: Math.round(sunrise - 2 * unit), end: Math.round(sunrise - unit) };
}

/** k-th of 8 equal parts of [start, end], 1-based; integer ms so coincident boundaries compare equal. */
export function partOfEight(start: number, end: number, part: number): Window {
  const unit = (end - start) / 8;
  return { start: Math.round(start + (part - 1) * unit), end: Math.round(start + part * unit) };
}

/**
 * Day and night choghadiya: names and ratings from the fork's weekday sequences, boundaries from partOfEight()
 * so they coincide exactly with the Rahu Kaal / Yamaganda / Gulika eighths.
 */
export function choghadiyaSlots(frame: DayFrame): { day: ChoghadiyaSlot[]; night: ChoghadiyaSlot[] } {
  const r = calculateChoghadiya(new Date(frame.sunrise), new Date(frame.sunset), new Date(frame.nextSunrise), frame.vara);
  const map = (night: boolean, from: number, to: number) => (c: { name: string; rating: string }, i: number): ChoghadiyaSlot => ({
    name: c.name as ChoghadiyaName,
    rating: c.rating as 'good' | 'neutral' | 'bad',
    ...partOfEight(from, to, i + 1),
    night,
    n: i + 1,
  });
  return { day: r.day.map(map(false, frame.sunrise, frame.sunset)), night: r.night.map(map(true, frame.sunset, frame.nextSunrise)) };
}

export function horaSlots(frame: DayFrame): HoraSlot[] {
  const startIdx = HORA_ORDER.indexOf(VARA_LORDS[frame.vara]);
  const dayUnit = (frame.sunset - frame.sunrise) / 12;
  const nightUnit = (frame.nextSunrise - frame.sunset) / 12;
  const out: HoraSlot[] = [];
  for (let k = 0; k < 24; k++) {
    const night = k >= 12;
    const base = night ? frame.sunset : frame.sunrise;
    const unit = night ? nightUnit : dayUnit;
    const j = night ? k - 12 : k;
    out.push({
      lord: HORA_ORDER[(startIdx + k) % 7],
      start: Math.round(base + j * unit),
      end: Math.round(base + (j + 1) * unit),
      night,
      n: k + 1,
    });
  }
  return out;
}

/** Bhadra residence by the Moon's sidereal sign (Muhurta Chintamani): Karka/Simha/Kumbha/Meena earth; Mesha/Vrishabha/Mithuna/Vrishchika heaven; Kanya/Tula/Dhanu/Makara patal. */
export function bhadraLocation(moonSign: number): BhadraLocation {
  if ([3, 4, 10, 11].includes(moonSign)) return 'earth';
  if ([0, 1, 2, 7].includes(moonSign)) return 'heaven';
  return 'patal';
}

/** Vishti (Bhadra) karana windows overlapping [fromMs, toMs]. */
export function bhadraWindows(fromMs: number, toMs: number, ay: AyanamsaType = 'lahiri'): BhadraWindow[] {
  const first = karanaInterval(fromMs);
  const all = intervalsCovering(first, (k) => karanaInterval(k.end + MIN_MS), toMs, 6);
  return all
    .filter((k) => k.index === VISHTI_KARANA && k.end > fromMs && k.start < toMs)
    .map((k) => {
      const moonSign = Math.floor(siderealMoon(k.start, ay) / 30) % 12;
      return { start: k.start, end: k.end, location: bhadraLocation(moonSign), moonSign };
    });
}

/**
 * Panchak = Moon in Kumbha or Meena (sidereal 300 -> 360 deg, i.e. Dhanishta pada 3 to the end of Revati).
 * Returns the full window when it overlaps [fromMs, toMs], else null.
 */
export function panchakWindow(fromMs: number, toMs: number, ay: AyanamsaType = 'lahiri'): Window | null {
  const f = (ms: number): number => siderealMoon(ms, ay);
  const lonStart = f(fromMs);
  const lonEnd = f(toMs);
  const inside = (lon: number): boolean => lon >= 300;
  // The Moon moves ~13 deg/day, so a day can only touch Panchak by being inside at sunrise or entering later.
  if (!inside(lonStart) && !inside(lonEnd)) return null;
  const start = inside(lonStart) ? prevCrossing(f, 300, fromMs, STEP.moon) : nextCrossing(f, 300, fromMs, STEP.moon);
  if (start >= toMs) return null;
  const end = nextCrossing(f, 0, start, STEP.moon);
  return { start, end };
}

const RITU_FROM_LON = (lon: number): RituIndex => (Math.floor((((lon - 330) % 360) + 360) % 360 / 60) % 6) as RituIndex;
/** Vedic ritu from the Amanta month (0 = Chaitra): Chaitra-Vaishakha Vasanta ... Magha-Phalguna Shishira. */
const RITU_FROM_MONTH = (monthIndex: number): RituIndex => Math.floor(monthIndex / 2) as RituIndex;
const AYANA_FROM_LON = (lon: number): Ayana => (lon >= 270 || lon < 90 ? 'uttarayana' : 'dakshinayana');

function tithiValue(t: { index: number; start: number; end: number }): TithiValue {
  return { ...t, n: t.index + 1, paksha: pakshaOfTithi(t.index) };
}

function nakshatraValue(n: { index: number; start: number; end: number }, atMs: number, ay: AyanamsaType): NakshatraValue {
  const lon = siderealMoon(atMs, ay);
  const pada = (Math.floor(lon / (360 / 108)) % 4) + 1;
  return { ...n, pada, lord: NAKSHATRA_LORDS[n.index] };
}

function karanaValue(k: { index: number; start: number; end: number }): KaranaValue {
  return { index: k.index, start: k.start, end: k.end, bhadra: k.index === VISHTI_KARANA };
}

const SPECIAL_YOGA_KEYS: Record<string, string> = {
  'Amrit Siddhi Yoga': 'amrit-siddhi',
  'Ravi Pushya Yoga': 'ravi-pushya',
  'Guru Pushya Yoga': 'guru-pushya',
  'Sarvartha Siddhi Yoga': 'sarvartha-siddhi',
};

const TRIPUSHKAR_NAKSHATRAS = [2, 6, 11, 15, 20, 24]; // Krittika, Punarvasu, U.Phalguni, Vishakha, U.Ashadha, P.Bhadrapada
const DWIPUSHKAR_NAKSHATRAS = [4, 13, 22]; // Mrigashira, Chitra, Dhanishta
const PUSHKAR_TITHIS = [1, 6, 11, 16, 21, 26]; // Dwitiya, Saptami, Dwadashi (both pakshas), 0-based
const PUSHKAR_VARAS = [0, 2, 6]; // Sun, Tue, Sat
const RAVI_YOGA_COUNTS = [4, 6, 9, 10, 13, 20];

/** Special day yogas from vara, nakshatra, tithi and the Sun's nakshatra (keys are the content fragment ids). */
export function specialYogas(vara: number, nakshatra: number, tithi: number, sunNakshatra: number): SpecialYogaDay[] {
  const out: SpecialYogaDay[] = getSpecialYoga(vara, nakshatra).map((y) => ({ key: SPECIAL_YOGA_KEYS[y.name] ?? y.name, auspicious: y.isAuspicious }));
  if (PUSHKAR_VARAS.includes(vara) && PUSHKAR_TITHIS.includes(tithi)) {
    if (TRIPUSHKAR_NAKSHATRAS.includes(nakshatra)) out.push({ key: 'tripushkar', auspicious: true });
    if (DWIPUSHKAR_NAKSHATRAS.includes(nakshatra)) out.push({ key: 'dwipushkar', auspicious: true });
  }
  const count = ((nakshatra - sunNakshatra + 27) % 27) + 1;
  if (RAVI_YOGA_COUNTS.includes(count)) out.push({ key: 'ravi-yoga', auspicious: true });
  return out;
}

/**
 * Full panchang for a civil date at a place. Every number is computed from astronomy-engine and the fork's
 * ayanamsa; the time zone comes from the bundled table.
 */
export function panchang(dayLocal: string, geo: GeoPoint, tz: string, opts: PanchangOptions = {}): PanchangDay {
  const zone = resolveZone(tz);
  const ay: AyanamsaType = opts.ayanamsa ?? 'lahiri';
  parseLocalDate(dayLocal);
  const frame = dayFrame(dayLocal, zone, geo);
  const midnight = localMidnight(dayLocal, zone);
  const anchor = frame ? frame.sunrise : midnight + 6 * 3_600_000; // polar fallback keeps the lunar fields usable
  const vara = frame ? frame.vara : weekdayOf(dayLocal);
  const dayEnd = frame ? frame.nextSunrise : anchor + DAY_MS;
  // Vedic-day moonrise/moonset (Drik Panchang convention); the polar fallback spans the civil day.
  const moonSpan: [number, number] = frame ? [frame.sunrise, frame.nextSunrise] : [midnight, localMidnight(addDays(dayLocal, 1), zone)];
  const moonrise = moonriseBetween(moonSpan[0], moonSpan[1], geo);
  const moonset = moonsetBetween(moonSpan[0], moonSpan[1], geo);
  const previousSunset = frame ? sunsetOn(addDays(dayLocal, -1), zone, geo) : null;
  const offsetMinutes = utcToWall(anchor, zone).offsetMinutes;

  const tithi0 = tithiInterval(anchor);
  const tithis = intervalsCovering(tithi0, (t) => tithiInterval(t.end + MIN_MS), dayEnd, 3).map(tithiValue);
  const nak0 = nakshatraInterval(anchor, ay);
  const nakshatras = intervalsCovering(nak0, (n) => nakshatraInterval(n.end + MIN_MS, ay), dayEnd, 3).map((n, i) => nakshatraValue(n, i === 0 ? anchor : n.start + MIN_MS, ay));
  const yoga0 = yogaInterval(anchor, ay);
  const yogas = intervalsCovering(yoga0, (y) => yogaInterval(y.end + MIN_MS, ay), dayEnd, 3).map((y) => ({ index: y.index, start: y.start, end: y.end }));
  const karana0 = karanaInterval(anchor);
  const karanas = intervalsCovering(karana0, (k) => karanaInterval(k.end + MIN_MS), dayEnd, 5).map(karanaValue);
  const sign0 = moonSignInterval(anchor, ay);
  const moonSigns = intervalsCovering(sign0, (s) => moonSignInterval(s.end + MIN_MS, ay), dayEnd, 2).map((s) => ({ index: s.index, start: s.start, end: s.end }));

  const lunation = lunationAt(anchor);
  const monthAmanta: LunarMonth = { index: lunation.monthIndex, adhik: lunation.adhik };
  const monthPurnimanta = purnimantaMonth(monthAmanta, tithis[0].paksha);
  const wall = utcToWall(anchor, zone);
  // New-year day: Chaitra Shukla Pratipada at sunrise, or — when that Pratipada touches no sunrise — the day
  // it begins (the month at sunrise is still the old one; Drik Panchang 2026-03-19).
  let samvatMonth = monthAmanta.index;
  if (lunation.end < dayEnd) {
    const next = nextLunation(lunation);
    const pratipada = tithis.find((t) => t.index === 0 && t.start >= lunation.end - MIN_MS);
    if (next.monthIndex === 0 && pratipada && pratipada.end < dayEnd) samvatMonth = 0;
  }
  const samvat = samvatFor(samvatMonth, wall.y, wall.m);
  const sunSid = siderealSun(anchor, ay);
  const sunTrop = sunTropical(anchor);
  const sunNakshatra = Math.min(26, Math.floor(sunSid / (360 / 27)));

  const choghadiya = frame ? choghadiyaSlots(frame) : { day: [], night: [] };
  const hora = frame ? horaSlots(frame) : [];
  const bhadra = bhadraWindows(anchor, dayEnd, ay);
  const panchak = panchakWindow(anchor, dayEnd, ay);

  return {
    date: dayLocal,
    tz: zone,
    offsetMinutes,
    ayanamsa: ay,
    ayanamsaDeg: ayanamsaAt(anchor, ay),
    noSun: !frame,
    sunrise: frame ? frame.sunrise : null,
    sunset: frame ? frame.sunset : null,
    nextSunrise: frame ? frame.nextSunrise : null,
    moonrise,
    moonset,
    vara,
    varaLord: VARA_LORDS[vara],
    tithi: tithis[0],
    nakshatra: nakshatras[0],
    yoga: yogas[0],
    karana: karanas[0],
    tithis,
    nakshatras,
    yogas,
    karanas,
    moonSigns,
    sunSign: sunSignIndexAt(anchor, ay),
    moonSign: sign0.index,
    monthAmanta,
    monthPurnimanta,
    lunation: { start: lunation.start, end: lunation.end, fullMoon: lunation.fullMoon },
    samvat,
    vikramSamvat: samvat.vikram,
    shakaSamvat: samvat.shaka,
    ritu: { vedic: RITU_FROM_MONTH(monthAmanta.index), drik: RITU_FROM_LON(sunTrop) },
    ayana: { vedic: AYANA_FROM_LON(sunSid), drik: AYANA_FROM_LON(sunTrop) },
    rahuKaal: frame ? eighth(frame, RAHU_PART[vara]) : null,
    yamaganda: frame ? eighth(frame, YAMAGANDA_PART[vara]) : null,
    gulika: frame ? eighth(frame, GULIKA_PART[vara]) : null,
    abhijit: frame ? abhijitWindow(frame) : null,
    brahma: frame ? brahmaWindow(frame.nextSunrise, frame.sunset) : null,
    brahmaMorning: frame ? brahmaWindow(frame.sunrise, previousSunset ?? undefined) : null,
    choghadiya,
    hora,
    bhadra,
    panchak,
    dishaShool: dishaShool(vara),
    specialYogas: specialYogas(vara, nak0.index, tithi0.index, sunNakshatra),
  };
}

/** Tithi running at an instant with its paksha and 1-based number (ayanamsa independent). */
export function tithiAt(utcMs: number): TithiValue {
  return tithiValue(tithiInterval(utcMs));
}

/** Nakshatra running at an instant. */
export function nakshatraAt(utcMs: number, ay: AyanamsaType = 'lahiri'): NakshatraValue {
  return nakshatraValue(nakshatraInterval(utcMs, ay), utcMs, ay);
}
