// Prashna (F18, design.md 10.3; plan C04): pure helpers behind the question screen. The chart of the moment is
// engine.computeChartAt(now, place, zone, F19 settings) - the same computation as a birth chart with the instant
// exact. The reading is a list of interpretive ROWS, each with the rule id its Why? sheet shows and the corpus
// snippet (planet-sign / planet-house / lagna domains) the sentence comes from; nothing here is written by hand.
// The observer is the one Today uses: the device fix when Settings -> Location is "Use my location" and a fix exists,
// otherwise the self profile's place (design.md 10.2). No React in this file.
import { at, computeChartAt, goodHours, localDateOf, type ChartData, type ChartPlanet, type PlanetId } from '@shubhvela/engine';
import { lookup, type CorpusLookup } from '@shubhvela/content';
import { hasDb } from '../db/connection';
import type { Profile } from '../db/profiles';
import { getSetting } from '../db/settings';
import { chartOptions } from '../engine-bridge/charts';
import type { Lang, TFn } from '../i18n';
import { getDeviceFix, type DeviceFix } from '../location/gps';
import { fmtTime } from '../today/format';
import { observerFromProfile, type Observer } from '../today/model';
import { lagnaId, planetHouseId, planetName, planetSignId, nakshatraName, shortPlace, signName } from './model';

/** Design.md 11: the question is at most 120 characters (code points, so Devanagari counts per letter). */
export const PRASHNA_MAX = 120;

export type QuestionProblem = 'empty' | 'tooLong';

export function questionLength(q: string): number {
  return Array.from(q.trim()).length;
}

export function validateQuestion(q: string): QuestionProblem | null {
  const n = questionLength(q);
  if (n === 0) return 'empty';
  if (n > PRASHNA_MAX) return 'tooLong';
  return null;
}

export interface CurrentObserverDeps {
  fix?: () => Promise<DeviceFix | null>;
}

/**
 * The observer "now": Today's rule - GPS fix when Settings -> Location is 'gps' and a fix is available, else the
 * self profile's place. `fallback` is true when 'gps' was chosen but no fix came (the screen says which place was used).
 */
export async function currentObserver(self: Profile, deps: CurrentObserverDeps = {}): Promise<{ observer: Observer; fallback: boolean }> {
  const mode = hasDb() ? getSetting('locationMode') : 'city';
  if (mode !== 'gps') return { observer: observerFromProfile(self), fallback: false };
  const f = await (deps.fix ?? getDeviceFix)();
  if (!f) return { observer: observerFromProfile(self), fallback: true };
  return { observer: { lat: f.lat, lon: f.lon, tz: f.tz, placeName: null, source: 'gps' }, fallback: false };
}

export interface PrashnaRowModel {
  /** Rule id behind the sentence (Why? sheet); every row has one (design.md 11 honesty owner). */
  ruleId: string;
  /** The sentence shown. */
  text: string;
  /** Inputs the Why? sheet lists. */
  inputs: Record<string, string | number>;
  glossary: string[];
  /** Longer corpus explanation for the Why? sheet (the snippet's full text when the row is a snippet). */
  explanation?: string;
  explanationTitle?: string;
  /** Language the snippet resolved to (fallback chain), for the honesty of the sheet. */
  snippetLang?: string;
  testID: string;
}

export interface PrashnaReading {
  chart: ChartData;
  /** The instant the chart is cast for (UTC ms). */
  utcMs: number;
  observer: Pick<Observer, 'lat' | 'lon' | 'tz' | 'placeName'>;
  lagnaSign: number;
  lagnaLord: PlanetId;
  moon: ChartPlanet;
  /** Planetary hora running at the instant (null outside the Vedic day frame, e.g. polar latitudes). */
  hora: PlanetId | null;
  rows: PrashnaRowModel[];
  /** Corpus snippet ids the reading used (for "How this was computed"). */
  snippetIds: string[];
}

function firstSentence(text: string): string {
  const m = /^.*?[.!?](\s|$)/.exec(text);
  return (m ? m[0] : text).trim();
}

function dignityRuleId(p: ChartPlanet): string {
  return `dignity-${p.tags.find((x) => ['exalted', 'debilitated', 'own', 'friend', 'enemy', 'neutral'].includes(x)) ?? 'neutral'}`;
}

function snippetRow(args: { snippet: CorpusLookup | null; ruleId: string; heading: string; inputs: Record<string, string | number>; glossary: string[]; testID: string }): PrashnaRowModel | null {
  if (!args.snippet) return null;
  return {
    ruleId: args.ruleId,
    text: firstSentence(args.snippet.text),
    inputs: args.inputs,
    glossary: args.glossary,
    explanation: args.snippet.text,
    explanationTitle: args.heading,
    snippetLang: args.snippet.lang,
    testID: args.testID,
  };
}

/**
 * Casts the chart of `utcMs` at the observer and builds the reading rows (design.md 10.3 F18, plan C04 step 1):
 * the chart-of-the-moment row, the Lagna-of-the-hour row (Lagna sign, its lord and the running hora), the Lagna
 * snippet, the Lagna lord's sign and house snippets, the Moon's sign and house snippets, and the privacy note.
 */
export function castPrashna(utcMs: number, observer: Pick<Observer, 'lat' | 'lon' | 'tz' | 'placeName'>, lang: Lang, t: TFn, opts = chartOptions()): PrashnaReading {
  const chart = computeChartAt(utcMs, { lat: observer.lat, lon: observer.lon }, observer.tz, opts);
  const lagnaSign = chart.firstHouseSign;
  const lagnaLord = chart.houses[0].lord;
  const moon = chart.planets.find((p) => p.id === 'Mo');
  if (!moon) throw new Error('chart has no Moon');
  const lord = chart.planets.find((p) => p.id === lagnaLord);
  if (!lord) throw new Error(`chart has no ${lagnaLord}`);
  const day = localDateOf(utcMs, observer.tz);
  const gh = goodHours(day, { lat: observer.lat, lon: observer.lon }, observer.tz, { ayanamsa: chart.meta.ayanamsa });
  const horaSlot = gh.noSun ? null : at(gh, utcMs)?.hora ?? null;
  const hora = horaSlot ? horaSlot.lord : null;
  const place = observer.placeName ? shortPlace(observer.placeName) : t('today.yourLocation');
  const time = fmtTime(utcMs, observer.tz);
  const coords = { lat: observer.lat.toFixed(2), lon: observer.lon.toFixed(2) };

  const rows: PrashnaRowModel[] = [];
  const snippetIds: string[] = [];
  rows.push({
    ruleId: 'prashna-chart-of-the-moment',
    text: t('prashna.castAt', { time, place }),
    inputs: {
      [t('prashna.reading')]: time,
      [t('onboarding.place')]: `${coords.lat}, ${coords.lon}`,
      [t('onboarding.timezone')]: observer.tz,
      [t('charts.lagna')]: signName(lang, lagnaSign),
      [t('charts.moon_chip')]: `${signName(lang, moon.sign)} · ${nakshatraName(lang, moon.nakshatra)} ${moon.pada}`,
    },
    glossary: ['prashna', 'lagna'],
    testID: 'prashna-row-moment',
  });
  rows.push({
    ruleId: 'prashna-lagna-of-the-hour',
    text: `${t('prashna.lagnaNow', { sign: signName(lang, lagnaSign) })} · ${hora ? t('prashna.horaNow', { planet: planetName(lang, hora) }) : t('errors.noSun')}`,
    inputs: {
      [t('prashna.reading')]: time,
      [t('charts.lagna')]: `${signName(lang, lagnaSign)} ${chart.lagna ? `${chart.lagna.degree}°${String(chart.lagna.minute).padStart(2, '0')}′` : ''}`.trim(),
      [t('kp.signLord_col')]: planetName(lang, lagnaLord),
      [t('today.horaLabel')]: hora ? planetName(lang, hora) : t('common.none'),
    },
    glossary: ['prashna', 'lagna', 'hora'],
    testID: 'prashna-row-lagna',
  });

  const lagnaSnippetId = lagnaId(lagnaSign);
  const lagnaRow = snippetRow({
    snippet: lookup('lagna', lagnaSnippetId, lang),
    ruleId: 'lagna',
    heading: t('charts.lagna'),
    inputs: { [t('charts.lagna')]: signName(lang, lagnaSign), [t('kp.signLord_col')]: planetName(lang, lagnaLord) },
    glossary: ['lagna', 'lagnesh'],
    testID: 'prashna-row-lagna-snippet',
  });
  if (lagnaRow) {
    rows.push(lagnaRow);
    snippetIds.push(lagnaSnippetId);
  }

  const lordSignId = planetSignId(lagnaLord, lord.sign);
  const lordSignRow = snippetRow({
    snippet: lookup('planet-sign', lordSignId, lang),
    ruleId: dignityRuleId(lord),
    heading: t('charts.planetInSign', { planet: planetName(lang, lagnaLord), sign: signName(lang, lord.sign) }),
    inputs: { [t('kp.planet_col')]: planetName(lang, lagnaLord), [t('charts.sign_col')]: signName(lang, lord.sign), [t('charts.houses')]: lord.house },
    glossary: ['lagnesh', 'uchcha', 'neecha', 'swakshetra'],
    testID: 'prashna-row-lord-sign',
  });
  if (lordSignRow) {
    rows.push(lordSignRow);
    snippetIds.push(lordSignId);
  }
  const lordHouseId = planetHouseId(lagnaLord, lord.house);
  const lordHouseRow = snippetRow({
    snippet: lookup('planet-house', lordHouseId, lang),
    ruleId: 'house-lord',
    heading: t('charts.planetInHouse', { planet: planetName(lang, lagnaLord), house: t(`charts.houseOrdinal.${lord.house}`) }),
    inputs: { [t('kp.planet_col')]: planetName(lang, lagnaLord), [t('charts.houses')]: lord.house },
    glossary: ['lagnesh', 'bhava'],
    testID: 'prashna-row-lord-house',
  });
  if (lordHouseRow) {
    rows.push(lordHouseRow);
    snippetIds.push(lordHouseId);
  }

  if (lagnaLord !== 'Mo') {
    const moonSignId = planetSignId('Mo', moon.sign);
    const moonSignRow = snippetRow({
      snippet: lookup('planet-sign', moonSignId, lang),
      ruleId: dignityRuleId(moon),
      heading: t('charts.planetInSign', { planet: planetName(lang, 'Mo'), sign: signName(lang, moon.sign) }),
      inputs: { [t('kp.planet_col')]: planetName(lang, 'Mo'), [t('charts.sign_col')]: signName(lang, moon.sign), [t('charts.nakshatra_col')]: `${nakshatraName(lang, moon.nakshatra)} ${moon.pada}` },
      glossary: ['moon', 'nakshatra'],
      testID: 'prashna-row-moon-sign',
    });
    if (moonSignRow) {
      rows.push(moonSignRow);
      snippetIds.push(moonSignId);
    }
    const moonHouseId = planetHouseId('Mo', moon.house);
    const moonHouseRow = snippetRow({
      snippet: lookup('planet-house', moonHouseId, lang),
      ruleId: 'house-lord',
      heading: t('charts.planetInHouse', { planet: planetName(lang, 'Mo'), house: t(`charts.houseOrdinal.${moon.house}`) }),
      inputs: { [t('kp.planet_col')]: planetName(lang, 'Mo'), [t('charts.houses')]: moon.house },
      glossary: ['moon', 'bhava'],
      testID: 'prashna-row-moon-house',
    });
    if (moonHouseRow) {
      rows.push(moonHouseRow);
      snippetIds.push(moonHouseId);
    }
  }

  rows.push({
    ruleId: 'prashna-question-private',
    text: t('prashna.private'),
    inputs: { [t('privacy.storedTitle')]: t('common.yes') },
    glossary: ['prashna'],
    testID: 'prashna-row-private',
  });

  return { chart, utcMs, observer, lagnaSign, lagnaLord, moon, hora, rows, snippetIds };
}
