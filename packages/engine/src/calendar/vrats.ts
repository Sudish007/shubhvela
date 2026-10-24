// Vrat assistant (spec F22, design 10.4 F22, plan A03): 12 vrat families with the computed time that matters.
// Conventions (observance.ts has the generic ones):
// - ekadashi      : Smarta day = first day whose sunrise has Ekadashi (udaya); `vaishnavaDate` moves to the next
//                   day when Dashami still runs at arunodaya (sunrise - 96 min) or Ekadashi touches two sunrises.
//                   Parana = next day, from max(sunrise, end of Hari Vasara = first quarter of Dwadashi) to
//                   min(Dwadashi end, sunrise + daylight/5 = pratah kala); if Dwadashi has already ended at
//                   sunrise the window is sunrise -> sunrise + daylight/5. Names via the fork's Ekadashi table
//                   (Padmini/Parama in an Adhik month).
// - pradosh       : Trayodashi prevailing at pradosh kala (sunset + night/10); window sunset -> sunset + night/5.
//                   Soma/Bhauma/Shani Pradosh by the weekday of the vrat day.
// - sankashti     : Krishna Chaturthi prevailing at moonrise; keyTime = moonrise; `angaraki` on Tuesdays.
// - vinayaka      : Shukla Chaturthi at madhyahna (the monthly pair of Sankashti; 12th family).
// - masikShivaratri: Krishna Chaturdashi at nishita; window = nishita kala (+-24 min around mid-night).
// - purnima       : udaya day; keyTime = moonrise of that day (civil evening).
// - amavasya      : udaya day.
// - karwaChauth   : Kartik Krishna Chaturthi (Purnimanta) = Ashwin Krishna Chaturthi (Amanta) at moonrise.
// - chhath        : Kartik Shukla Shashthi (udaya); keyTime = sunset (sandhya arghya) -> next sunrise (usha arghya).
// - teej          : Hariyali (Shravana S3), Kajari (Bhadrapada K3 Purnimanta = Shravana K3 Amanta),
//                   Hartalika (Bhadrapada S3); udaya.
// - navratri      : Chaitra and Sharad (Ashwin) Shukla Pratipada -> Navami, one occurrence per civil day;
//                   day 1 carries the Ghatasthapana window = sunrise -> end of the rising dwiswabhava lagna,
//                   clipped to Pratipada; when shorter than 10 min the Abhijit window is given instead.
// - satyanarayan  : Purnima; day where Purnima prevails at sunset (pradosh test), else the udaya day;
//                   keyTime = sandhya (sunset -> sunset + night/5).
import { getEkadashiName } from '../../vendor/jyotish/src/core/festivals';
import { abhijitWindow } from '../panchang/panchang';
import {
  DAY_MS,
  MIN_MS,
  type GeoPoint,
  type Lunation,
  type LunarMonth,
  type Paksha,
  type Tradition,
  addDays,
  lagnaSignEnd,
  localDateOf,
  lunationsBetween,
  moonriseBetween,
  purnimantaMonth,
  resolveZone,
  sunriseOn,
  tithiIndexAt,
  weekdayOf,
} from '../panchang/astro';
import { type Observance, type Timing, dayRef, observanceDay, timingPoint, tithiIndexOf, tithiSpanIn } from './observance';

export const VRAT_FAMILIES = [
  'ekadashi',
  'pradosh',
  'sankashti',
  'vinayakaChaturthi',
  'masikShivaratri',
  'purnima',
  'amavasya',
  'karwaChauth',
  'chhath',
  'teej',
  'navratri',
  'satyanarayan',
] as const;
export type VratFamily = (typeof VRAT_FAMILIES)[number];

export type KeyTimeKind = 'parana' | 'pradosh' | 'moonrise' | 'nishita' | 'madhyahna' | 'sunset-to-sunrise' | 'ghatasthapana' | 'ghatasthapana-abhijit' | 'sandhya' | 'sunrise';

export interface KeyTime {
  kind: KeyTimeKind;
  start: number;
  end?: number;
}

export interface VratOccurrence {
  family: VratFamily;
  /** Name key (content id): e.g. ekadashi-nirjala, pradosh-soma, sankashti, teej-hartalika, navratri-sharad. */
  name: string;
  date: string;
  /** Lunar position in both naming systems. */
  month: { amanta: LunarMonth; purnimanta: LunarMonth };
  paksha: Paksha;
  /** 1-15. */
  tithi: number;
  tithiSpan: { start: number; end: number };
  keyTime: KeyTime;
  convention: string;
  ruleId: string;
  /** Family-specific extras. */
  extra?: Record<string, string | number | boolean>;
}

const EKADASHI_KEY: Record<string, string> = {
  'Kamada Ekadashi': 'kamada',
  'Varuthini Ekadashi': 'varuthini',
  'Mohini Ekadashi': 'mohini',
  'Apara Ekadashi': 'apara',
  'Nirjala Ekadashi': 'nirjala',
  'Yogini Ekadashi': 'yogini',
  'Devshayani Ekadashi': 'devshayani',
  'Kamika Ekadashi': 'kamika',
  'Shravana Putrada Ekadashi': 'shravana-putrada',
  'Aja Ekadashi': 'aja',
  'Parsva Ekadashi (Parivartini)': 'parivartini',
  'Indira Ekadashi': 'indira',
  'Papankusha Ekadashi': 'papankusha',
  'Rama Ekadashi': 'rama',
  'Devutthana Ekadashi': 'devutthana',
  'Utpanna Ekadashi': 'utpanna',
  'Mokshada Ekadashi': 'mokshada',
  'Saphala Ekadashi': 'saphala',
  'Pausha Putrada Ekadashi': 'pausha-putrada',
  'Shattila Ekadashi': 'shattila',
  'Jaya Ekadashi': 'jaya',
  'Vijaya Ekadashi': 'vijaya',
  'Amalaki Ekadashi': 'amalaki',
  'Papmochani Ekadashi': 'papmochani',
  'Padmini Ekadashi': 'padmini',
  'Parama Ekadashi': 'parama',
};

/** Content key of the Ekadashi of an Amanta month/paksha (adhik -> padmini/parama). */
export function ekadashiKey(amantaMonth: number, paksha: Paksha, adhik: boolean): string {
  const name = getEkadashiName(amantaMonth, paksha === 'shukla' ? 'Shukla' : 'Krishna', adhik);
  return EKADASHI_KEY[name] ?? name.toLowerCase().replace(/[^a-z]+/g, '-');
}

interface Ctx {
  zone: string;
  geo: GeoPoint;
  from: number;
  to: number;
}

function months(l: Lunation, paksha: Paksha): { amanta: LunarMonth; purnimanta: LunarMonth } {
  const amanta = { index: l.monthIndex, adhik: l.adhik };
  return { amanta, purnimanta: purnimantaMonth(amanta, paksha) };
}

function occurrence(family: VratFamily, name: string, l: Lunation, index: number, obs: Observance, keyTime: KeyTime, extra?: VratOccurrence['extra']): VratOccurrence {
  const paksha: Paksha = index < 15 ? 'shukla' : 'krishna';
  return {
    family,
    name,
    date: obs.date,
    month: months(l, paksha),
    paksha,
    tithi: (index % 15) + 1,
    tithiSpan: obs.span,
    keyTime,
    convention: obs.convention,
    ruleId: `vrat-${family}`,
    ...(extra ? { extra } : {}),
  };
}

function tithiDay(l: Lunation, index: number, timing: Timing, ctx: Ctx, prefer: 'first' | 'last' = 'first'): Observance {
  return observanceDay(tithiSpanIn(l, index), timing, ctx.zone, ctx.geo, prefer);
}

function sunriseKey(date: string, ctx: Ctx): KeyTime {
  return { kind: 'sunrise', start: sunriseOn(date, ctx.zone, ctx.geo) ?? 0 };
}

function ekadashi(l: Lunation, ctx: Ctx): VratOccurrence[] {
  const out: VratOccurrence[] = [];
  for (const paksha of ['shukla', 'krishna'] as const) {
    const index = tithiIndexOf(paksha, 11);
    const obs = tithiDay(l, index, 'udaya', ctx);
    const sunrise = sunriseOn(obs.date, ctx.zone, ctx.geo);
    // Vaishnava rule: Dashami at arunodaya (sunrise - 96 min) or Ekadashi at two sunrises -> next day.
    let vaishnavaDate = obs.date;
    if (sunrise !== null) {
      const arunodaya = tithiIndexAt(sunrise - 96 * MIN_MS);
      const next = sunriseOn(addDays(obs.date, 1), ctx.zone, ctx.geo);
      const twoSunrises = next !== null && next < obs.span.end;
      if (arunodaya === index - 1 || twoSunrises) vaishnavaDate = addDays(obs.date, 1);
    }
    // Parana on the day after the fast.
    const paranaDate = addDays(obs.date, 1);
    const ref = dayRef(paranaDate, ctx.zone, ctx.geo);
    const dwadashi = tithiSpanIn(l, index + 1);
    let keyTime: KeyTime;
    if (ref) {
      const pratahEnd = Math.round(ref.sunrise + (ref.sunset - ref.sunrise) / 5);
      const hariVasaraEnd = Math.round(dwadashi.start + (dwadashi.end - dwadashi.start) / 4);
      let start = Math.max(ref.sunrise, hariVasaraEnd);
      let end = Math.min(dwadashi.end, pratahEnd);
      if (dwadashi.end <= ref.sunrise) {
        // Dwadashi already over at sunrise: parana in the pratah kala.
        start = ref.sunrise;
        end = pratahEnd;
      } else if (end <= start) {
        // Hari Vasara runs past the pratah kala: parana right after it, before Dwadashi ends (or sunset).
        end = Math.min(dwadashi.end, Math.max(ref.sunset, start + 60 * MIN_MS));
      }
      keyTime = { kind: 'parana', start, end };
    } else {
      keyTime = { kind: 'parana', start: dwadashi.start, end: dwadashi.end };
    }
    out.push(
      occurrence('ekadashi', `ekadashi-${ekadashiKey(l.monthIndex, paksha, l.adhik)}`, l, index, obs, keyTime, {
        vaishnavaDate,
        paranaDate,
        hariVasaraEnd: Math.round(dwadashi.start + (dwadashi.end - dwadashi.start) / 4),
        dwadashiEnd: dwadashi.end,
      }),
    );
  }
  return out;
}

const PRADOSH_NAMES: Record<number, string> = { 0: 'ravi', 1: 'soma', 2: 'bhauma', 3: 'saumya', 4: 'guru', 5: 'bhrigu', 6: 'shani' };

function pradosh(l: Lunation, ctx: Ctx): VratOccurrence[] {
  return (['shukla', 'krishna'] as const).map((paksha) => {
    const index = tithiIndexOf(paksha, 13);
    const obs = tithiDay(l, index, 'pradosh', ctx);
    const vara = weekdayOf(obs.date);
    const keyTime: KeyTime = obs.window ? { kind: 'pradosh', start: obs.window.start, end: obs.window.end } : sunriseKey(obs.date, ctx);
    return occurrence('pradosh', `pradosh-${PRADOSH_NAMES[vara]}`, l, index, obs, keyTime, { vara });
  });
}

function moonriseKey(obs: Observance, ctx: Ctx): KeyTime {
  if (obs.at !== undefined) return { kind: 'moonrise', start: obs.at };
  const ref = dayRef(obs.date, ctx.zone, ctx.geo);
  const mr = ref ? moonriseBetween(ref.sunrise, ref.nextSunrise, ctx.geo) : null;
  return mr !== null ? { kind: 'moonrise', start: mr } : sunriseKey(obs.date, ctx);
}

function sankashti(l: Lunation, ctx: Ctx): VratOccurrence[] {
  const index = tithiIndexOf('krishna', 4);
  const obs = tithiDay(l, index, 'moonrise', ctx);
  const angaraki = weekdayOf(obs.date) === 2;
  return [occurrence('sankashti', angaraki ? 'sankashti-angaraki' : 'sankashti', l, index, obs, moonriseKey(obs, ctx), { angaraki })];
}

function vinayaka(l: Lunation, ctx: Ctx): VratOccurrence[] {
  const index = tithiIndexOf('shukla', 4);
  const obs = tithiDay(l, index, 'madhyahna', ctx);
  const keyTime: KeyTime = obs.window ? { kind: 'madhyahna', start: obs.window.start, end: obs.window.end } : sunriseKey(obs.date, ctx);
  return [occurrence('vinayakaChaturthi', 'vinayaka-chaturthi', l, index, obs, keyTime)];
}

function masikShivaratri(l: Lunation, ctx: Ctx): VratOccurrence[] {
  const index = tithiIndexOf('krishna', 14);
  const obs = tithiDay(l, index, 'nishita', ctx);
  const keyTime: KeyTime = obs.window ? { kind: 'nishita', start: obs.window.start, end: obs.window.end } : sunriseKey(obs.date, ctx);
  return [occurrence('masikShivaratri', 'masik-shivaratri', l, index, obs, keyTime)];
}

function purnima(l: Lunation, ctx: Ctx): VratOccurrence[] {
  const index = 14;
  const obs = tithiDay(l, index, 'udaya', ctx);
  return [occurrence('purnima', 'purnima', l, index, obs, moonriseKey(obs, ctx))];
}

function amavasya(l: Lunation, ctx: Ctx): VratOccurrence[] {
  const index = 29;
  const obs = tithiDay(l, index, 'udaya', ctx);
  return [occurrence('amavasya', 'amavasya', l, index, obs, sunriseKey(obs.date, ctx))];
}

function karwaChauth(l: Lunation, ctx: Ctx): VratOccurrence[] {
  if (l.monthIndex !== 6 || l.adhik) return []; // Amanta Ashwin Krishna Chaturthi = Purnimanta Kartik Krishna Chaturthi
  const index = tithiIndexOf('krishna', 4);
  const obs = tithiDay(l, index, 'moonrise', ctx);
  return [occurrence('karwaChauth', 'karwa-chauth', l, index, obs, moonriseKey(obs, ctx))];
}

function chhath(l: Lunation, ctx: Ctx): VratOccurrence[] {
  if (l.monthIndex !== 7 || l.adhik) return []; // Kartik Shukla Shashthi
  const index = tithiIndexOf('shukla', 6);
  const obs = tithiDay(l, index, 'udaya', ctx);
  const ref = dayRef(obs.date, ctx.zone, ctx.geo);
  const keyTime: KeyTime = ref ? { kind: 'sunset-to-sunrise', start: ref.sunset, end: ref.nextSunrise } : sunriseKey(obs.date, ctx);
  const out = [occurrence('chhath', 'chhath', l, index, obs, keyTime, { nahayKhay: addDays(obs.date, -2), kharna: addDays(obs.date, -1), ushaArghya: addDays(obs.date, 1) })];
  return out;
}

function teej(l: Lunation, ctx: Ctx): VratOccurrence[] {
  const out: VratOccurrence[] = [];
  if (l.adhik) return out;
  if (l.monthIndex === 4) {
    // Amanta Shravana: Hariyali Teej (S3) and Kajari Teej (K3 = Purnimanta Bhadrapada Krishna Tritiya).
    const s3 = tithiIndexOf('shukla', 3);
    const o1 = tithiDay(l, s3, 'udaya', ctx);
    out.push(occurrence('teej', 'teej-hariyali', l, s3, o1, sunriseKey(o1.date, ctx)));
    const k3 = tithiIndexOf('krishna', 3);
    const o2 = tithiDay(l, k3, 'udaya', ctx);
    out.push(occurrence('teej', 'teej-kajari', l, k3, o2, sunriseKey(o2.date, ctx)));
  }
  if (l.monthIndex === 5) {
    const s3 = tithiIndexOf('shukla', 3);
    const o = tithiDay(l, s3, 'udaya', ctx);
    out.push(occurrence('teej', 'teej-hartalika', l, s3, o, sunriseKey(o.date, ctx)));
  }
  return out;
}

/** Ghatasthapana window on a Pratipada day: sunrise -> end of the rising dwiswabhava lagna, clipped to Pratipada. */
export function ghatasthapanaWindow(date: string, pratipadaEnd: number, zone: string, geo: GeoPoint): KeyTime {
  const ref = dayRef(date, zone, geo);
  if (!ref) return { kind: 'sunrise', start: 0 };
  const lagnaEnd = lagnaSignEnd(ref.sunrise, geo);
  const end = Math.min(lagnaEnd, pratipadaEnd);
  if (end - ref.sunrise >= 10 * MIN_MS) return { kind: 'ghatasthapana', start: ref.sunrise, end };
  const abhijit = abhijitWindow(ref);
  return { kind: 'ghatasthapana-abhijit', start: abhijit.start, end: abhijit.end };
}

function navratri(l: Lunation, ctx: Ctx): VratOccurrence[] {
  if (l.adhik || (l.monthIndex !== 0 && l.monthIndex !== 6)) return [];
  const which = l.monthIndex === 0 ? 'chaitra' : 'sharad';
  const first = tithiSpanIn(l, 0);
  const navami = tithiSpanIn(l, 8);
  const firstDay = observanceDay(first, 'udaya', ctx.zone, ctx.geo);
  const lastDay = observanceDay(navami, 'udaya', ctx.zone, ctx.geo);
  const out: VratOccurrence[] = [];
  let n = 1;
  for (let d = firstDay.date; d <= lastDay.date && n <= 10; d = addDays(d, 1), n++) {
    const sunrise = sunriseOn(d, ctx.zone, ctx.geo);
    const idx = sunrise !== null ? spanTithiIndex(tithiIndexAt(sunrise), 0, 8) : Math.min(8, n - 1);
    const span = tithiSpanIn(l, idx);
    const obs: Observance = { date: d, convention: n === 1 ? firstDay.convention : 'udaya', span };
    const keyTime: KeyTime = n === 1 ? ghatasthapanaWindow(d, first.end, ctx.zone, ctx.geo) : sunriseKey(d, ctx);
    out.push(occurrence('navratri', `navratri-${which}`, l, idx, obs, keyTime, { day: n, which }));
  }
  return out;
}

/**
 * Tithi (0-29) shown for a day inside a multi-day span: the sunrise tithi, clamped into the span. A begin-day
 * first day (sunrise still in the previous tithi) shows the span's first tithi; a kshaya day shows the last.
 */
export function spanTithiIndex(sunriseTithi: number, from: number, to: number): number {
  if (sunriseTithi >= from && sunriseTithi <= to) return sunriseTithi;
  // Before the span (e.g. Amavasya 29 before Pratipada 0, or Dashami before Pratipada in the other paksha) -> first.
  const before = (from - sunriseTithi + 30) % 30;
  const after = (sunriseTithi - to + 30) % 30;
  return before <= after ? from : to;
}

function satyanarayan(l: Lunation, ctx: Ctx): VratOccurrence[] {
  const index = 14;
  const atSunset = tithiDay(l, index, 'pradosh', ctx);
  const obs = atSunset.convention.endsWith('begin-day') ? tithiDay(l, index, 'udaya', ctx) : atSunset;
  const ref = dayRef(obs.date, ctx.zone, ctx.geo);
  const keyTime: KeyTime = ref ? { kind: 'sandhya', start: ref.sunset, end: Math.round(ref.sunset + (ref.nextSunrise - ref.sunset) / 5) } : sunriseKey(obs.date, ctx);
  return [occurrence('satyanarayan', 'satyanarayan', l, index, obs, keyTime)];
}

const GENERATORS: Record<VratFamily, (l: Lunation, ctx: Ctx) => VratOccurrence[]> = {
  ekadashi,
  pradosh,
  sankashti,
  vinayakaChaturthi: vinayaka,
  masikShivaratri,
  purnima,
  amavasya,
  karwaChauth,
  chhath,
  teej,
  navratri,
  satyanarayan,
};

/**
 * Occurrences of a vrat family between two instants (dates in the zone), with the computed key time.
 * The dates do not depend on the month-naming tradition (every occurrence carries both names); the parameter
 * is accepted so callers can pass the profile's setting uniformly.
 */
export function vratOccurrences(family: VratFamily, rangeStartMs: number, rangeEndMs: number, geo: GeoPoint, tz: string, _tradition: Tradition = 'purnimanta'): VratOccurrence[] {
  const zone = resolveZone(tz);
  if (!GENERATORS[family]) throw new Error(`Unknown vrat family ${family}`);
  const ctx: Ctx = { zone, geo, from: rangeStartMs, to: rangeEndMs };
  const firstDate = localDateOf(rangeStartMs, zone);
  const lastDate = localDateOf(rangeEndMs, zone);
  const out: VratOccurrence[] = [];
  for (const l of lunationsBetween(rangeStartMs - 2 * DAY_MS, rangeEndMs + 2 * DAY_MS)) {
    for (const o of GENERATORS[family](l, ctx)) {
      // Keep the occurrences whose civil date lies inside the range's civil dates (zone independent compare).
      if (o.date < firstDate || o.date > lastDate) continue;
      out.push(o);
    }
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/** All families at once (Settings -> Vrats, Family tab cards). */
export function allVratOccurrences(rangeStartMs: number, rangeEndMs: number, geo: GeoPoint, tz: string, families: readonly VratFamily[] = VRAT_FAMILIES): VratOccurrence[] {
  return families
    .flatMap((f) => vratOccurrences(f, rangeStartMs, rangeEndMs, geo, tz))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

export type { Paksha, Tradition, LunarMonth };
