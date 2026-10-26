// Yoga detection (spec F16, design 10.3 F16 "name, one-line rule, state tag when cancelled", plan B01).
// yogas(chart) evaluates every yoga in YOGA_IDS on the whole-sign D1 chart and returns the ones whose forming
// condition holds, each as {id, formed, cancelledBy?, ruleId, participants, params}. A yoga whose condition holds
// but whose cancellation (bhanga) rule also holds is returned with formed: false and cancelledBy = the bhanga
// rule id, so the card can show "cancelled" with the cancelling rule (never fear language). The rules corpus
// carries one sentence per yoga id (`yoga-<id>`) and per bhanga id.
//
// Conventions (classical sources named per yoga in RULE sources; BPHS = Brihat Parashara Hora Shastra, PD =
// Phaladeepika, SA = Saravali, JP = Jataka Parijata):
// - Houses are whole-sign from the chart's first house (Lagna; the Moon sign in Moon-chart mode, where the
//   Lagna-based yogas are evaluated from the Moon and `fromMoonChart` is set so the UI marks them approx.).
// - Natural benefics: Jupiter, Venus, Mercury (Mercury taken as benefic regardless of association), waxing Moon
//   (Shukla paksha, tithi 8-15 of Shukla and 1-7 of Krishna counted as bright). Natural malefics: Sun, Mars, Saturn,
//   Rahu, Ketu. The nodes never form conjunction yogas except Guru-Chandala and Kala Sarpa.
// - "Conjunction" = same sign. "Aspect" uses Parashara's full aspects: every planet aspects the 7th sign; Mars also
//   4 and 8; Jupiter also 5 and 9; Saturn also 3 and 10.
// - Kendra = 1, 4, 7, 10; trikona = 1, 5, 9; dusthana = 6, 8, 12; upachaya = 3, 6, 10, 11.
import { type ChartData, type ChartPlanet, signDignity } from '../kundli/index';
import { type PlanetId, SIGN_LORDS } from '../locale/index';

export const YOGA_IDS = [
  'ruchaka',
  'bhadra',
  'hamsa',
  'malavya',
  'sasa',
  'gaja-kesari',
  'budhaditya',
  'chandra-mangala',
  'sunapha',
  'anapha',
  'durudhara',
  'kemadruma',
  'vesi',
  'vasi',
  'ubhayachari',
  'adhi',
  'vasumati',
  'amala',
  'saraswati',
  'lakshmi',
  'shakata',
  'guru-chandala',
  'kala-sarpa',
  'neecha-bhanga-raja',
  'harsha',
  'sarala',
  'vimala',
  'dhana-2-11',
  'raja-kendra-trikona',
  'dharma-karmadhipati',
  'parivartana',
] as const;
export type YogaId = (typeof YOGA_IDS)[number];

/** Cancellation (bhanga) rule ids a yoga row may carry in `cancelledBy`. */
export const YOGA_BHANGA_IDS = [
  'kemadruma-bhanga-kendra-from-moon',
  'kemadruma-bhanga-kendra-from-lagna',
  'kemadruma-bhanga-moon-conjunction',
  'gaja-kesari-bhanga-jupiter-weak',
  'shakata-bhanga-jupiter-kendra',
  'mahapurusha-bhanga-combust',
  'parivartana-dainya',
] as const;
export type YogaBhangaId = (typeof YOGA_BHANGA_IDS)[number];

/** `yoga-<id>` for every yoga plus the bhanga ids (RULE_IDS). */
export const YOGA_RULE_IDS: readonly string[] = [...YOGA_IDS.map((id) => `yoga-${id}`), ...YOGA_BHANGA_IDS];

export type YogaParam = string | number | boolean | null | string[] | number[];

export interface YogaResult {
  id: YogaId;
  /** Family for grouping: mahapurusha | lunar | solar | benefic | raja | dhana | vipreet | dosha | exchange. */
  family: 'mahapurusha' | 'lunar' | 'solar' | 'benefic' | 'raja' | 'dhana' | 'vipreet' | 'nodal' | 'exchange' | 'bhanga';
  /** True when the forming condition holds and no cancellation applies. */
  formed: boolean;
  /** Bhanga rule id when the yoga is present but cancelled. */
  cancelledBy?: YogaBhangaId;
  ruleId: string;
  participants: PlanetId[];
  /** Houses (from the first house) the participants occupy, in participant order. */
  houses: number[];
  params: Record<string, YogaParam>;
  /** True when a Lagna-based rule was evaluated from the Moon because the birth time is unknown. */
  fromMoonChart: boolean;
}

export interface YogasReport {
  yogas: YogaResult[];
  /** Number of formed (not cancelled) yogas = the card's "N found". */
  found: number;
  /** Every yoga id that was checked. */
  checked: readonly YogaId[];
  ruleIds: readonly string[];
}

const KENDRA = [1, 4, 7, 10];
const TRIKONA = [1, 5, 9];
const DUSTHANA = [6, 8, 12];
const UPACHAYA = [3, 6, 10, 11];
const SEVEN: readonly PlanetId[] = ['Su', 'Mo', 'Ma', 'Me', 'Ju', 'Ve', 'Sa'];
const BENEFICS: readonly PlanetId[] = ['Ju', 'Ve', 'Me'];
const MAHAPURUSHA: Record<'Ma' | 'Me' | 'Ju' | 'Ve' | 'Sa', YogaId> = { Ma: 'ruchaka', Me: 'bhadra', Ju: 'hamsa', Ve: 'malavya', Sa: 'sasa' };
// Deep exaltation signs (0 = Mesha) and debilitation = exaltation + 6.
const EXALT_SIGN: Partial<Record<PlanetId, number>> = { Su: 0, Mo: 1, Ma: 9, Me: 5, Ju: 3, Ve: 11, Sa: 6 };

function dist(fromSign: number, toSign: number): number {
  return ((toSign - fromSign + 12) % 12) + 1;
}

function aspects(p: ChartPlanet, targetSign: number): boolean {
  const d = dist(p.sign, targetSign);
  if (d === 7) return true;
  if (p.id === 'Ma' && (d === 4 || d === 8)) return true;
  if (p.id === 'Ju' && (d === 5 || d === 9)) return true;
  if (p.id === 'Sa' && (d === 3 || d === 10)) return true;
  return false;
}

interface Ctx {
  chart: ChartData;
  byId: Record<PlanetId, ChartPlanet>;
  first: number;
  /** Sign in each house 1-12. */
  signOfHouse: (h: number) => number;
  lordOfHouse: (h: number) => PlanetId;
  houseOf: (p: ChartPlanet) => number;
  planetsInSign: (sign: number) => ChartPlanet[];
  fromMoonChart: boolean;
}

function ctxOf(chart: ChartData): Ctx {
  const byId = {} as Record<PlanetId, ChartPlanet>;
  for (const p of chart.planets) byId[p.id] = p;
  const first = chart.firstHouseSign;
  return {
    chart,
    byId,
    first,
    signOfHouse: (h) => ((first - 1 + h - 1) % 12) + 1,
    lordOfHouse: (h) => SIGN_LORDS[(first - 1 + h - 1) % 12],
    houseOf: (p) => dist(first, p.sign),
    planetsInSign: (sign) => chart.planets.filter((p) => p.sign === sign),
    fromMoonChart: chart.moonChart,
  };
}

function result(ctx: Ctx, id: YogaId, family: YogaResult['family'], participants: PlanetId[], params: Record<string, YogaParam>, cancelledBy?: YogaBhangaId): YogaResult {
  const r: YogaResult = {
    id,
    family,
    formed: !cancelledBy,
    ruleId: `yoga-${id}`,
    participants,
    houses: participants.map((p) => ctx.houseOf(ctx.byId[p])),
    params,
    fromMoonChart: ctx.fromMoonChart && family !== 'lunar' && family !== 'solar',
  };
  if (cancelledBy) r.cancelledBy = cancelledBy;
  return r;
}

function ownOrExalted(p: ChartPlanet): boolean {
  const d = signDignity(p.id, p.sign);
  return d === 'own' || d === 'exalted';
}

function mahapurusha(ctx: Ctx, out: YogaResult[]): void {
  for (const id of ['Ma', 'Me', 'Ju', 'Ve', 'Sa'] as const) {
    const p = ctx.byId[id];
    const h = ctx.houseOf(p);
    if (!KENDRA.includes(h) || !ownOrExalted(p)) continue;
    // BPHS 75: the planet must be in own or exaltation sign in a kendra; a combust planet cannot confer the yoga.
    out.push(result(ctx, MAHAPURUSHA[id], 'mahapurusha', [id], { house: h, sign: p.sign, dignity: signDignity(id, p.sign) ?? null }, p.combust ? 'mahapurusha-bhanga-combust' : undefined));
  }
}

function lunar(ctx: Ctx, out: YogaResult[]): void {
  const moon = ctx.byId.Mo;
  const jup = ctx.byId.Ju;
  const dJ = dist(moon.sign, jup.sign);
  if (KENDRA.includes(dJ)) {
    // PD 6.3: Jupiter in a kendra from the Moon; the yoga needs a Jupiter that is neither debilitated nor combust.
    const weak = jup.combust || signDignity('Ju', jup.sign) === 'debilitated';
    out.push(result(ctx, 'gaja-kesari', 'lunar', ['Ju', 'Mo'], { houseFromMoon: dJ, jupiterSign: jup.sign, jupiterCombust: jup.combust, jupiterDignity: signDignity('Ju', jup.sign) ?? null }, weak ? 'gaja-kesari-bhanga-jupiter-weak' : undefined));
  }
  const mars = ctx.byId.Ma;
  if (mars.sign === moon.sign) out.push(result(ctx, 'chandra-mangala', 'lunar', ['Mo', 'Ma'], { sign: moon.sign }));
  // Sunapha / Anapha / Durudhara / Kemadruma (BPHS 36): planets other than the Sun and the nodes in the 2nd and 12th
  // from the Moon.
  const second = ctx.planetsInSign(((moon.sign) % 12) + 1).filter((p) => !['Su', 'Mo', 'Ra', 'Ke'].includes(p.id));
  const twelfth = ctx.planetsInSign(((moon.sign + 10) % 12) + 1).filter((p) => !['Su', 'Mo', 'Ra', 'Ke'].includes(p.id));
  if (second.length && twelfth.length) out.push(result(ctx, 'durudhara', 'lunar', ['Mo', ...second.map((p) => p.id), ...twelfth.map((p) => p.id)], { second: second.map((p) => p.id), twelfth: twelfth.map((p) => p.id) }));
  else if (second.length) out.push(result(ctx, 'sunapha', 'lunar', ['Mo', ...second.map((p) => p.id)], { second: second.map((p) => p.id) }));
  else if (twelfth.length) out.push(result(ctx, 'anapha', 'lunar', ['Mo', ...twelfth.map((p) => p.id)], { twelfth: twelfth.map((p) => p.id) }));
  else {
    // Kemadruma with the three classical bhanga rules (PD 6.8, JP): a planet (not Sun/nodes) conjunct the Moon; a
    // planet in a kendra from the Moon; a planet in a kendra from the Lagna.
    const withMoon = ctx.planetsInSign(moon.sign).filter((p) => !['Su', 'Mo', 'Ra', 'Ke'].includes(p.id));
    const kendraFromMoon = ctx.chart.planets.filter((p) => !['Mo', 'Ra', 'Ke'].includes(p.id) && [4, 7, 10].includes(dist(moon.sign, p.sign)));
    const kendraFromLagna = ctx.fromMoonChart ? [] : ctx.chart.planets.filter((p) => !['Mo', 'Ra', 'Ke'].includes(p.id) && KENDRA.includes(ctx.houseOf(p)));
    let cancelledBy: YogaBhangaId | undefined;
    if (withMoon.length) cancelledBy = 'kemadruma-bhanga-moon-conjunction';
    else if (kendraFromMoon.length) cancelledBy = 'kemadruma-bhanga-kendra-from-moon';
    else if (kendraFromLagna.length) cancelledBy = 'kemadruma-bhanga-kendra-from-lagna';
    out.push(
      result(
        ctx,
        'kemadruma',
        'lunar',
        ['Mo'],
        {
          withMoon: withMoon.map((p) => p.id),
          kendraFromMoon: kendraFromMoon.map((p) => p.id),
          kendraFromLagna: kendraFromLagna.map((p) => p.id),
        },
        cancelledBy,
      ),
    );
  }
  // Adhi yoga (BPHS 36.9 / PD): the benefics Mercury, Jupiter and Venus all in the 6th, 7th or 8th from the Moon.
  const adhi = BENEFICS.map((id) => ctx.byId[id]).filter((p) => [6, 7, 8].includes(dist(moon.sign, p.sign)));
  if (adhi.length === 3) out.push(result(ctx, 'adhi', 'lunar', ['Mo', ...adhi.map((p) => p.id)], { housesFromMoon: adhi.map((p) => dist(moon.sign, p.sign)) }));
  // Shakata (PD 6.4): Jupiter in the 6th, 8th or 12th from the Moon; cancelled when Jupiter is in a kendra from the Lagna.
  if ([6, 8, 12].includes(dJ)) {
    const inKendra = !ctx.fromMoonChart && KENDRA.includes(ctx.houseOf(jup));
    out.push(result(ctx, 'shakata', 'lunar', ['Ju', 'Mo'], { houseFromMoon: dJ, jupiterHouse: ctx.houseOf(jup) }, inKendra ? 'shakata-bhanga-jupiter-kendra' : undefined));
  }
}

function solar(ctx: Ctx, out: YogaResult[]): void {
  const sun = ctx.byId.Su;
  const merc = ctx.byId.Me;
  if (sun.sign === merc.sign) out.push(result(ctx, 'budhaditya', 'solar', ['Su', 'Me'], { sign: sun.sign, mercuryCombust: merc.combust }));
  // Vesi / Vasi / Ubhayachari (BPHS 36): planets other than the Moon and the nodes in the 2nd / 12th from the Sun.
  const second = ctx.planetsInSign((sun.sign % 12) + 1).filter((p) => !['Su', 'Mo', 'Ra', 'Ke'].includes(p.id));
  const twelfth = ctx.planetsInSign(((sun.sign + 10) % 12) + 1).filter((p) => !['Su', 'Mo', 'Ra', 'Ke'].includes(p.id));
  if (second.length && twelfth.length) out.push(result(ctx, 'ubhayachari', 'solar', ['Su', ...second.map((p) => p.id), ...twelfth.map((p) => p.id)], { second: second.map((p) => p.id), twelfth: twelfth.map((p) => p.id) }));
  else if (second.length) out.push(result(ctx, 'vesi', 'solar', ['Su', ...second.map((p) => p.id)], { second: second.map((p) => p.id) }));
  else if (twelfth.length) out.push(result(ctx, 'vasi', 'solar', ['Su', ...twelfth.map((p) => p.id)], { twelfth: twelfth.map((p) => p.id) }));
}

function benefic(ctx: Ctx, out: YogaResult[]): void {
  const moon = ctx.byId.Mo;
  // Vasumati (PD 6.5): all natural benefics in upachaya houses from the Lagna (or from the Moon).
  const ben = BENEFICS.map((id) => ctx.byId[id]);
  const fromLagna = !ctx.fromMoonChart && ben.every((p) => UPACHAYA.includes(ctx.houseOf(p)));
  const fromMoon = ben.every((p) => UPACHAYA.includes(dist(moon.sign, p.sign)));
  if (fromLagna || fromMoon) out.push(result(ctx, 'vasumati', 'benefic', ben.map((p) => p.id), { from: fromLagna ? 'lagna' : 'moon', houses: ben.map((p) => (fromLagna ? ctx.houseOf(p) : dist(moon.sign, p.sign))) }));
  // Amala (PD 6.6): a natural benefic in the 10th from the Lagna or from the Moon.
  const tenthLagna = ctx.fromMoonChart ? [] : ben.filter((p) => ctx.houseOf(p) === 10);
  const tenthMoon = ben.filter((p) => dist(moon.sign, p.sign) === 10);
  if (tenthLagna.length || tenthMoon.length) {
    const ps = tenthLagna.length ? tenthLagna : tenthMoon;
    out.push(result(ctx, 'amala', 'benefic', ps.map((p) => p.id), { from: tenthLagna.length ? 'lagna' : 'moon' }));
  }
  // Saraswati (PD 6.17): Jupiter, Venus and Mercury each in a kendra, trikona or the 2nd house, Jupiter in own,
  // exaltation or friendly sign.
  const sarHouses = [1, 2, 4, 5, 7, 9, 10];
  const jup = ctx.byId.Ju;
  const jupDig = signDignity('Ju', jup.sign);
  if (!ctx.fromMoonChart && ben.every((p) => sarHouses.includes(ctx.houseOf(p))) && (jupDig === 'own' || jupDig === 'exalted' || jupDig === 'friend')) {
    out.push(result(ctx, 'saraswati', 'benefic', ['Ju', 'Ve', 'Me'], { houses: ben.map((p) => ctx.houseOf(p)), jupiterDignity: jupDig }));
  }
  // Lakshmi (PD 6.16): the 9th lord in own or exaltation sign in a kendra or trikona, with the Lagna lord strong
  // (not debilitated, not combust).
  if (!ctx.fromMoonChart) {
    const l9 = ctx.byId[ctx.lordOfHouse(9)];
    const l1 = ctx.byId[ctx.lordOfHouse(1)];
    const l9h = ctx.houseOf(l9);
    if (ownOrExalted(l9) && (KENDRA.includes(l9h) || TRIKONA.includes(l9h)) && !l1.combust && signDignity(l1.id, l1.sign) !== 'debilitated') {
      out.push(result(ctx, 'lakshmi', 'benefic', [l9.id, l1.id], { ninthLordHouse: l9h, ninthLordDignity: signDignity(l9.id, l9.sign) ?? null, lagnaLordDignity: signDignity(l1.id, l1.sign) ?? null }));
    }
  }
}

function nodal(ctx: Ctx, out: YogaResult[]): void {
  const jup = ctx.byId.Ju;
  const rahu = ctx.byId.Ra;
  const ketu = ctx.byId.Ke;
  if (jup.sign === rahu.sign || jup.sign === ketu.sign) out.push(result(ctx, 'guru-chandala', 'nodal', ['Ju', jup.sign === rahu.sign ? 'Ra' : 'Ke'], { sign: jup.sign }));
  // Kala Sarpa: all seven planets on one side of the Rahu-Ketu axis (strictly between the nodes, no planet conjunct
  // a node). Rahu -> Ketu order = the classical form, Ketu -> Rahu = the reversed (Kala Amrita) form; the type name
  // comes from Rahu's house.
  const seven = SEVEN.map((id) => ctx.byId[id]);
  const side = (from: number, to: number): boolean => seven.every((p) => {
    const d = dist(from, p.sign);
    return d > 1 && d < dist(from, to);
  });
  const rahuToKetu = side(rahu.sign, ketu.sign);
  const ketuToRahu = side(ketu.sign, rahu.sign);
  if (rahuToKetu || ketuToRahu) {
    out.push(result(ctx, 'kala-sarpa', 'nodal', ['Ra', 'Ke'], { direction: rahuToKetu ? 'rahu-to-ketu' : 'ketu-to-rahu', rahuHouse: ctx.houseOf(rahu), ketuHouse: ctx.houseOf(ketu), typeIndex: ctx.houseOf(rahu) }));
  }
}

function dignityYogas(ctx: Ctx, out: YogaResult[]): void {
  // Neecha Bhanga Raja Yoga (PD 7.29-30): a debilitated planet whose fall is cancelled because (a) the lord of the
  // debilitation sign or (b) the lord of its exaltation sign is in a kendra from the Lagna or the Moon, or (c) the
  // debilitated planet itself is in a kendra from the Lagna or the Moon, or (d) it exchanges signs with the lord
  // of the sign it occupies.
  const moon = ctx.byId.Mo;
  const kendraFrom = (p: ChartPlanet): boolean => (!ctx.fromMoonChart && KENDRA.includes(ctx.houseOf(p))) || KENDRA.includes(dist(moon.sign, p.sign));
  for (const id of SEVEN) {
    const p = ctx.byId[id];
    if (signDignity(id, p.sign) !== 'debilitated') continue;
    const debLord = ctx.byId[SIGN_LORDS[p.sign - 1]];
    const exSign = EXALT_SIGN[id];
    const exLord = exSign === undefined ? undefined : ctx.byId[SIGN_LORDS[exSign]];
    const reasons: string[] = [];
    if (debLord.id !== id && kendraFrom(debLord)) reasons.push('debilitation-lord-in-kendra');
    if (exLord && exLord.id !== id && kendraFrom(exLord)) reasons.push('exaltation-lord-in-kendra');
    if (kendraFrom(p)) reasons.push('planet-in-kendra');
    if (debLord.id !== id && SIGN_LORDS[debLord.sign - 1] === id) reasons.push('exchange-with-sign-lord');
    if (reasons.length) out.push(result(ctx, 'neecha-bhanga-raja', 'raja', [id, ...(reasons.includes('debilitation-lord-in-kendra') ? [debLord.id] : []), ...(reasons.includes('exaltation-lord-in-kendra') && exLord ? [exLord.id] : [])], { planet: id, sign: p.sign, reasons }));
  }
}

function lordshipYogas(ctx: Ctx, out: YogaResult[]): void {
  if (ctx.fromMoonChart) return; // house lordships need the Lagna
  const lordOf = (h: number): ChartPlanet => ctx.byId[ctx.lordOfHouse(h)];
  // Vipreet Raja (PD 6.68): lords of the 6th, 8th and 12th in dusthanas.
  const vipreet: [YogaId, number][] = [['harsha', 6], ['sarala', 8], ['vimala', 12]];
  for (const [id, h] of vipreet) {
    const l = lordOf(h);
    const lh = ctx.houseOf(l);
    if (DUSTHANA.includes(lh)) out.push(result(ctx, id, 'vipreet', [l.id], { lordOf: h, inHouse: lh }));
  }
  // Dhana (BPHS 41 / PD): the lords of the 2nd and the 11th conjunct, in mutual exchange or in mutual aspect.
  const l2 = lordOf(2);
  const l11 = lordOf(11);
  if (l2.id !== l11.id) {
    const conj = l2.sign === l11.sign;
    const exch = ctx.houseOf(l2) === 11 && ctx.houseOf(l11) === 2;
    const aspect = aspects(l2, l11.sign) && aspects(l11, l2.sign);
    if (conj || exch || aspect) out.push(result(ctx, 'dhana-2-11', 'dhana', [l2.id, l11.id], { relation: conj ? 'conjunction' : exch ? 'exchange' : 'mutual-aspect' }));
  }
  // Raja yoga (BPHS 41): a kendra lord and a trikona lord conjunct or in mutual exchange (every pair listed).
  const pairs: string[] = [];
  const participants: PlanetId[] = [];
  const seen = new Set<string>();
  for (const k of KENDRA) {
    for (const t of TRIKONA) {
      if (k === t) continue;
      const a = lordOf(k);
      const b = lordOf(t);
      if (a.id === b.id) continue;
      const key = [a.id, b.id].sort().join('-');
      if (seen.has(key)) continue;
      const conj = a.sign === b.sign;
      const exch = ctx.houseOf(a) === t && ctx.houseOf(b) === k;
      if (conj || exch) {
        seen.add(key);
        pairs.push(`${a.id}:${k}+${b.id}:${t}:${conj ? 'conjunction' : 'exchange'}`);
        for (const id of [a.id, b.id]) if (!participants.includes(id)) participants.push(id);
      }
    }
  }
  if (pairs.length) out.push(result(ctx, 'raja-kendra-trikona', 'raja', participants, { pairs }));
  // Dharma-Karmadhipati (BPHS 41): the 9th and 10th lords conjunct or in exchange.
  const l9 = lordOf(9);
  const l10 = lordOf(10);
  if (l9.id !== l10.id) {
    const conj = l9.sign === l10.sign;
    const exch = ctx.houseOf(l9) === 10 && ctx.houseOf(l10) === 9;
    if (conj || exch) out.push(result(ctx, 'dharma-karmadhipati', 'raja', [l9.id, l10.id], { relation: conj ? 'conjunction' : 'exchange' }));
  }
  // Parivartana (exchange of signs between two lords). Maha when both lords own good houses (1,2,4,5,7,9,10,11),
  // Khala when one owns the 3rd, Dainya when one owns a dusthana (6,8,12) - Dainya is reported as cancelled.
  const exchanges: string[] = [];
  const kinds: string[] = [];
  const exParticipants: PlanetId[] = [];
  const seenEx = new Set<string>();
  let dainya = false;
  for (const p of ctx.chart.planets) {
    if (p.id === 'Ra' || p.id === 'Ke') continue;
    const hostLord = ctx.byId[SIGN_LORDS[p.sign - 1]];
    if (hostLord.id === p.id) continue;
    if (SIGN_LORDS[hostLord.sign - 1] !== p.id) continue;
    const key = [p.id, hostLord.id].sort().join('-');
    if (seenEx.has(key)) continue;
    seenEx.add(key);
    // Each planet sits in the house the other one owns, so the two exchanged houses are where the two planets sit.
    const housesOwned = [ctx.houseOf(p), ctx.houseOf(hostLord)];
    const kind = housesOwned.some((h) => DUSTHANA.includes(h)) ? 'dainya' : housesOwned.some((h) => h === 3) ? 'khala' : 'maha';
    if (kind === 'dainya') dainya = true;
    exchanges.push(`${p.id}<->${hostLord.id}`);
    kinds.push(kind);
    for (const id of [p.id, hostLord.id]) if (!exParticipants.includes(id)) exParticipants.push(id);
  }
  if (exchanges.length) out.push(result(ctx, 'parivartana', 'exchange', exParticipants, { exchanges, kinds }, dainya && kinds.every((k) => k === 'dainya') ? 'parivartana-dainya' : undefined));
}

/** Every yoga present in the chart, formed or cancelled (design 10.3 F16). */
export function yogas(chart: ChartData): YogasReport {
  const ctx = ctxOf(chart);
  const out: YogaResult[] = [];
  mahapurusha(ctx, out);
  lunar(ctx, out);
  solar(ctx, out);
  benefic(ctx, out);
  nodal(ctx, out);
  dignityYogas(ctx, out);
  lordshipYogas(ctx, out);
  return { yogas: out, found: out.filter((y) => y.formed).length, checked: YOGA_IDS, ruleIds: YOGA_RULE_IDS };
}
