// Browser bundle for the data pages' city picker (FEAT-D02): recomputes, with the SAME engine functions the build used,
// the block the page shows for New Delhi for the city the visitor picked — festival sunrise/moonrise (engine.panchang),
// muhurat windows (engine muhurat.score, no profile: Chandra/Tara bala stay unmet, as on the static page) and the next
// vrat occurrences (engine vratOccurrences). Rows are rendered by rows.mjs, shared with the Node templates. Loaded
// lazily by client/picker.js; nothing leaves the browser.
import { panchang } from '../../../packages/engine/src/panchang/index.ts';
import { score, splitWindows } from '../../../packages/engine/src/muhurat/index.ts';
import { vratOccurrences, type VratFamily } from '../../../packages/engine/src/calendar/vrats.ts';
import { formatInZone, utcToWall } from '../../../packages/engine/src/tz/index.ts';
import { WEB_CITIES, type WebCity } from '../../../packages/engine/src/gazetteer/webCities.ts';
import * as locale from '../../../packages/engine/src/locale/index.ts';
import type { Lang } from '../../../packages/engine/src/locale/index.ts';
import { fill } from '../html.mjs';
import { monthDates } from '../dates.mjs';
import { byDate } from '../data/muhurat.mjs';
import { nextOccurrences, yearRange } from '../data/vrats.mjs';
import { dayTimesRows, emptyWindowsRow, occurrenceRows, windowRows } from '../rows.mjs';

type Cfg =
  | { kind: 'festival'; lang: Lang; date: string; slug: string; year: number; defaultCity: string }
  | { kind: 'muhurat'; lang: Lang; activity: string; month: string; defaultCity: string; minRules: number; nightAllowed: boolean }
  | { kind: 'vrat'; lang: Lang; family: string; from: string; defaultCity: string; next: number };

/** The subset of the engine module the shared formatters use (format.mjs / rows.mjs take the module as a parameter). */
const engine = { formatInZone, utcToWall, locale };

function readJson<T>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing #${id}`);
  return JSON.parse(el.textContent || '{}') as T;
}

function translator(strings: Record<string, string>) {
  const t = (key: string, params?: Record<string, string | number>) => {
    const s = strings[key];
    if (s === undefined) return key;
    return params ? fill(s, params) : s;
  };
  return t;
}

function cityOf(slug: string): WebCity | null {
  return WEB_CITIES.find((c) => c.slug === slug) ?? null;
}

function cityLabel(c: WebCity, lang: Lang): string {
  return lang === 'en' || !c.nameHi ? c.name : c.nameHi;
}

function setText(id: string, text: string) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

let cfgCache: Cfg | null = null;
let tCache: ReturnType<typeof translator> | null = null;

/** Recomputes the page's data block for `slug`. Called by picker.js after a change or when the URL carries ?city=. */
export function recompute(slug: string): void {
  const cfg = cfgCache ?? (cfgCache = readJson<Cfg>('cfg'));
  const t = tCache ?? (tCache = translator(readJson<Record<string, string>>('i18n')));
  const city = cityOf(slug) ?? cityOf(cfg.defaultCity);
  if (!city) throw new Error('unknown city');
  const geo = { lat: city.lat, lon: city.lon };
  const lang = cfg.lang;
  const label = cityLabel(city, lang);
  const out = document.getElementById('pick-out');
  if (!out) return;
  out.setAttribute('data-city', city.slug);
  if (cfg.kind === 'festival') {
    const p = panchang(cfg.date, geo, city.tz);
    out.innerHTML = dayTimesRows(engine, t, lang, { cityLabel: label, date: cfg.date, p, tz: city.tz });
    return;
  }
  if (cfg.kind === 'muhurat') {
    const dates = monthDates(cfg.month);
    const windows = score(cfg.activity, { from: dates[0], to: dates[dates.length - 1] }, [], geo, city.tz);
    const { matches, partials } = splitWindows(windows);
    const body = (id: string, rows: typeof matches) => {
      const tb = document.querySelector(`#${id} tbody`);
      if (tb) tb.innerHTML = rows.length ? windowRows(engine, t, lang, byDate(rows), city.tz).join('') : emptyWindowsRow(t);
    };
    body('windows', matches);
    body('partials', partials);
    setText('winh', t('muhurat.windowsH', { city: label }));
    const sum = document.querySelector('details.more > summary .num');
    if (sum) sum.textContent = `(${partials.length})`;
    return;
  }
  if (cfg.kind === 'vrat') {
    const { from, to } = yearRange(cfg.from);
    const occs = nextOccurrences(vratOccurrences(cfg.family as VratFamily, from, to, geo, city.tz), cfg.from, cfg.next);
    const tb = document.querySelector('#occurrences tbody');
    if (tb) tb.innerHTML = occurrenceRows(engine, t, lang, occs, city.tz).join('');
    setText('nexth', t('vrat.nextH', { count: occs.length, city: label }));
    setText('vrat-computed', t('vrat.howComputed', { convention: occs[0]?.convention ?? '', tz: city.tz }));
  }
}
