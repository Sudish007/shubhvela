// Transit-to-natal daily rules (spec F6, F24; design 10.2 F6, 10.4 F24; plan A03).
// dailyNote() returns 3-5 rows in the FIXED order of design 10.2 F6; every row is {ruleId, keys, params}: the
// content package resolves `keys` to fragments in the UI language and interpolates `params`; the "Why?" sheet
// shows the rule text of `ruleId` with the inputs. Nothing here is prose.
//
// Rule ids and keys (binding for the content clusters, see FEAT-A03 findings):
//   chandra-bala        keys chandra-bala-<house 1..12>            (house 8 = Chandrashtama)
//   tara-bala           keys tara-bala-<1..9>                       (janma, sampat, vipat, kshema, pratyak, sadhana, naidhana, mitra, parama-mitra)
//   day-tithi-nakshatra keys tithi-<1..30>, nakshatra-<1..27>, vara-<0..6>, [special yoga keys], [bhadra-earth|bhadra-heaven|bhadra-patal], [panchak]
//   sade-sati           keys sade-sati-phase-<1..3> | dhaiya-4 | dhaiya-8 | sade-sati-none
//   dasha-lords         keys dasha-<maha>-<antar> (planet ids Su Mo Ma Me Ju Ve Sa Ra Ke), day-strength-<strong|mixed|weak>
import { type ChartData, naturalRelation } from '../kundli/index';
import { type PlanetId } from '../locale/index';
import { type GeoPoint, type Tradition, resolveZone } from '../panchang/astro';
import { type PanchangDay, type PanchangOptions, type Window, panchang } from '../panchang/panchang';
import { current, dasha, sadeSati, type SadeSatiReport } from '../dasha/index';

export type RuleParam = string | number | boolean | null | Window[];

export interface DailyRule {
  /** 1-based position in the fixed order. */
  order: number;
  ruleId: 'chandra-bala' | 'tara-bala' | 'day-tithi-nakshatra' | 'sade-sati' | 'dasha-lords';
  /** Content fragment keys in reading order. */
  keys: string[];
  params: Record<string, RuleParam>;
}

export interface DailyNoteOptions extends PanchangOptions {
  /** Pre-computed panchang of the day (avoids recomputation when the caller already has it). */
  panchang?: PanchangDay;
  /** Pre-computed Sade Sati report. */
  sadeSati?: SadeSatiReport;
}

/** Favourable Moon houses from the natal Moon (classical Chandra bala): 1, 3, 6, 7, 10, 11. */
export const CHANDRA_BALA_GOOD = [1, 3, 6, 7, 10, 11] as const;
export const TARA_KEYS = ['', 'janma', 'sampat', 'vipat', 'kshema', 'pratyak', 'sadhana', 'naidhana', 'mitra', 'parama-mitra'] as const;
export const TARA_GOOD = [2, 4, 6, 8, 9] as const;

export function moonHouseFrom(natalSign: number, transitSign: number): number {
  return ((transitSign - natalSign + 12) % 12) + 1;
}

/** Tara number 1-9 counted from the natal nakshatra to the day's nakshatra (both 1-27). */
export function taraNumber(natalNakshatra: number, dayNakshatra: number): number {
  const count = ((dayNakshatra - natalNakshatra + 27) % 27) + 1;
  return count % 9 || 9;
}

function natal(chart: ChartData): { moonSign: number; moonNakshatra: number } {
  const moon = chart.planets.find((p) => p.id === 'Mo');
  if (!moon) throw new Error('Chart has no Moon');
  return { moonSign: moon.sign, moonNakshatra: moon.nakshatra };
}

export function chandraBalaRule(chart: ChartData, p: PanchangDay): DailyRule {
  const { moonSign } = natal(chart);
  const transit = p.moonSign + 1;
  const house = moonHouseFrom(moonSign, transit);
  const first = p.moonSigns[0];
  const changes = p.nextSunrise !== null && first.end < p.nextSunrise;
  const nextHouse = changes ? moonHouseFrom(moonSign, ((p.moonSigns[1]?.index ?? first.index + 1) % 12) + 1) : null;
  return {
    order: 1,
    ruleId: 'chandra-bala',
    keys: [`chandra-bala-${house}`],
    params: {
      house,
      natalMoonSign: moonSign,
      transitMoonSign: transit,
      favourable: (CHANDRA_BALA_GOOD as readonly number[]).includes(house),
      chandrashtama: house === 8,
      moonSignEndsAt: changes ? first.end : null,
      nextHouse,
    },
  };
}

export function taraBalaRule(chart: ChartData, p: PanchangDay): DailyRule {
  const { moonNakshatra } = natal(chart);
  const dayNak = p.nakshatra.index + 1;
  const tara = taraNumber(moonNakshatra, dayNak);
  const changes = p.nextSunrise !== null && p.nakshatra.end < p.nextSunrise;
  const nextNak = changes ? (p.nakshatras[1]?.index ?? p.nakshatra.index + 1) % 27 : null;
  return {
    order: 2,
    ruleId: 'tara-bala',
    keys: [`tara-bala-${tara}`],
    params: {
      tara,
      taraKey: TARA_KEYS[tara],
      natalNakshatra: moonNakshatra,
      dayNakshatra: dayNak,
      auspicious: (TARA_GOOD as readonly number[]).includes(tara),
      nakshatraEndsAt: changes ? p.nakshatra.end : null,
      nextTara: nextNak !== null ? taraNumber(moonNakshatra, nextNak + 1) : null,
    },
  };
}

export function dayRule(p: PanchangDay): DailyRule {
  const keys = [`tithi-${p.tithi.n}`, `nakshatra-${p.nakshatra.index + 1}`, `vara-${p.vara}`, ...p.specialYogas.map((y) => y.key)];
  const bhadra = p.bhadra[0];
  if (bhadra) keys.push(`bhadra-${bhadra.location}`);
  if (p.panchak) keys.push('panchak');
  return {
    order: 3,
    ruleId: 'day-tithi-nakshatra',
    keys,
    params: {
      tithi: p.tithi.n,
      paksha: p.tithi.paksha,
      tithiEndsAt: p.tithi.end,
      nakshatra: p.nakshatra.index + 1,
      nakshatraEndsAt: p.nakshatra.end,
      yoga: p.yoga.index + 1,
      vara: p.vara,
      specialYogas: p.specialYogas.map((y) => y.key).join(','),
      bhadraStart: bhadra ? bhadra.start : null,
      bhadraEnd: bhadra ? bhadra.end : null,
      bhadraLocation: bhadra ? bhadra.location : null,
      panchakStart: p.panchak ? p.panchak.start : null,
      panchakEnd: p.panchak ? p.panchak.end : null,
    },
  };
}

export function sadeSatiRule(report: SadeSatiReport): DailyRule {
  const s = report.state;
  const key = s.kind === 'sadesati' ? `sade-sati-phase-${s.phase}` : s.kind === 'dhaiya' ? `dhaiya-${s.house}` : 'sade-sati-none';
  return {
    order: 4,
    ruleId: 'sade-sati',
    keys: [key],
    params: {
      state: s.kind,
      phase: s.kind === 'sadesati' ? s.phase : null,
      house: s.kind === 'dhaiya' ? s.house : null,
      saturnSign: report.saturnSign,
      saturnHouseFromMoon: report.saturnHouseFromMoon,
      natalMoonSign: report.natalMoonSign,
      since: s.start,
      until: s.end,
      nextKind: report.next ? report.next.kind : null,
      nextAt: report.next ? report.next.at : null,
      approx: report.next ? report.next.approx : false,
    },
  };
}

export type DayStrength = 'strong' | 'mixed' | 'weak';

/** A dasha lord's day-strength from its natural relation to the vara lord: self/friend strong, neutral mixed, enemy weak. */
export function dayStrength(lord: PlanetId, varaLord: PlanetId): DayStrength {
  const rel = naturalRelation(lord, varaLord);
  return rel === 'self' || rel === 'friend' ? 'strong' : rel === 'neutral' ? 'mixed' : 'weak';
}

export function dashaLordsRule(chart: ChartData, p: PanchangDay, atMs: number): DailyRule | null {
  const tree = dasha(chart);
  const cur = current(tree, atMs);
  if (!cur) return null;
  const mahaStrength = dayStrength(cur.maha.lord, p.varaLord);
  const antarStrength = dayStrength(cur.antar.lord, p.varaLord);
  const horasOf = (lord: PlanetId): Window[] => p.hora.filter((h) => h.lord === lord).map((h) => ({ start: h.start, end: h.end }));
  return {
    order: 5,
    ruleId: 'dasha-lords',
    keys: [`dasha-${cur.maha.lord}-${cur.antar.lord}`, `day-strength-${mahaStrength}`],
    params: {
      maha: cur.maha.lord,
      antar: cur.antar.lord,
      pratyantar: cur.pratyantar.lord,
      mahaEnd: cur.maha.end,
      antarEnd: cur.antar.end,
      varaLord: p.varaLord,
      mahaDayStrength: mahaStrength,
      antarDayStrength: antarStrength,
      mahaRelation: naturalRelation(cur.maha.lord, p.varaLord),
      antarRelation: naturalRelation(cur.antar.lord, p.varaLord),
      mahaHoras: horasOf(cur.maha.lord),
      antarHoras: horasOf(cur.antar.lord),
    },
  };
}

/**
 * The personal daily note: Chandra bala -> Tara bala -> day (tithi/nakshatra + Bhadra/Panchak advice) ->
 * Sade Sati/Dhaiya state -> dasha lords' day-strength. 3-5 rows (the dasha row is omitted outside the tree).
 */
export function dailyNote(chart: ChartData, dayLocal: string, geo: GeoPoint, tz: string, opts: DailyNoteOptions = {}): DailyRule[] {
  const zone = resolveZone(tz);
  const p = opts.panchang ?? panchang(dayLocal, geo, zone, { ayanamsa: opts.ayanamsa ?? chart.meta.ayanamsa });
  const anchor = p.sunrise ?? Date.UTC(Number(dayLocal.slice(0, 4)), Number(dayLocal.slice(5, 7)) - 1, Number(dayLocal.slice(8, 10)), 6);
  const rows: DailyRule[] = [chandraBalaRule(chart, p), taraBalaRule(chart, p), dayRule(p)];
  const report = opts.sadeSati ?? sadeSati(chart, anchor, { ayanamsa: chart.meta.ayanamsa });
  rows.push(sadeSatiRule(report));
  const d = dashaLordsRule(chart, p, anchor);
  if (d) rows.push(d);
  return rows;
}

export interface FamilyProfile {
  id: string;
  name?: string;
  chart: ChartData;
  tradition?: Tradition;
}

export interface FamilyTodayRow {
  profileId: string;
  name: string | null;
  ruleId: 'family-today';
  keys: string[];
  params: Record<string, RuleParam>;
}

/** One Moon-based line per family member for the Family tab (F24): Chandra bala + Tara bala, Chandrashtama stated plainly. */
export function familyToday(profiles: FamilyProfile[], dayLocal: string, geo: GeoPoint, tz: string, opts: PanchangOptions = {}): FamilyTodayRow[] {
  const zone = resolveZone(tz);
  const p = panchang(dayLocal, geo, zone, opts);
  return profiles.map((pr) => {
    const cb = chandraBalaRule(pr.chart, p);
    const tb = taraBalaRule(pr.chart, p);
    return {
      profileId: pr.id,
      name: pr.name ?? null,
      ruleId: 'family-today',
      keys: [...cb.keys, ...tb.keys],
      params: { name: pr.name ?? null, ...cb.params, ...tb.params },
    };
  });
}
