// Deep links from the web companion (spec F37, design.md 3 / 9 M9, plan C04, M8): the four link kinds the manifest's
// `shubhvela` scheme can carry, each validated with the SAME rules as the web pages -
//   shubhvela://kundli?<M8 query>        -> "Chart from a link": the birth form pre-filled (extras ay/nd/st/n allowed)
//   shubhvela://m?<M8 query>             -> Matching with the payload as side B (extras rejected: `n` never travels on /m/)
//   shubhvela://festival/<slug>/<year>   -> Festival detail (slug must be an engine festival rule; year inside the tz table)
//   shubhvela://panchang/<city-slug>     -> Today with that city as the observer (one of the 331 web cities)
// The M8 parser is the engine's parseShareUrl (shared with the web kundli page); invalid links return an `invalid`
// target with the partial pre-fill so the form shows inline errors for what did not parse (design.md 11 "URL state").
import { canonicalZone, encodeShareCode, festivalRule, parseShareUrl, SHARE_APPROX_VALUES, ShareUrlError, webCity, type KundliExtras, type SharePayload, type WebCity } from '@shubhvela/engine';
import type { Observer } from './today/model';

/** Years the engine's tz table covers (plan P10: 1900-2100); a festival link outside it is refused honestly. */
export const DEEPLINK_YEAR_MIN = 1900;
export const DEEPLINK_YEAR_MAX = 2100;

export type DeepLinkInvalidReason = 'path' | 'payload' | 'version' | 'festival' | 'year' | 'city';

export interface KundliPrefill {
  birthDate: string | null;
  birthTime: string | null;
  timeUnknown: boolean;
  approx: 0 | 15 | 30 | 60;
  lat: number | null;
  lon: number | null;
  tz: string | null;
  gender: 'f' | 'm' | 'x' | null;
  name: string | null;
  /** Fields whose value did not parse under the M8 rules (shown with inline errors). */
  errors: ('date' | 'time' | 'approx' | 'lat' | 'lon' | 'tz' | 'gender' | 'name' | 'version')[];
}

export type DeepLinkTarget =
  | { kind: 'kundli'; payload: SharePayload; extras: KundliExtras; prefill: KundliPrefill }
  | { kind: 'm'; payload: SharePayload; code: string }
  | { kind: 'festival'; slug: string; year: number }
  | { kind: 'panchang'; city: WebCity; observer: Observer }
  | { kind: 'invalid'; reason: DeepLinkInvalidReason; link: 'kundli' | 'm' | 'festival' | 'panchang' | null; prefill?: KundliPrefill; detail?: string };

function queryMap(query: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const part of query.split('&')) {
    if (!part) continue;
    const i = part.indexOf('=');
    try {
      const k = decodeURIComponent(i < 0 ? part : part.slice(0, i)).trim();
      const v = decodeURIComponent((i < 0 ? '' : part.slice(i + 1)).replace(/\+/g, ' ')).trim();
      if (!out.has(k)) out.set(k, v);
    } catch {
      // A malformed escape sequence: skip the pair; the strict parser reports the field.
    }
  }
  return out;
}

/** Lenient, field-by-field read of an M8 query so an invalid link still pre-fills what did parse. */
export function prefillFromQuery(query: string, nowMs: number = Date.now()): KundliPrefill {
  const q = queryMap(query);
  const p: KundliPrefill = { birthDate: null, birthTime: null, timeUnknown: false, approx: 0, lat: null, lon: null, tz: null, gender: null, name: null, errors: [] };
  if (q.get('v') !== '1') p.errors.push('version');
  const d = q.get('d') ?? '';
  const dm = /^(\d{4})(\d{2})(\d{2})$/.exec(d);
  if (dm) {
    const iso = `${dm[1]}-${dm[2]}-${dm[3]}`;
    const ms = Date.UTC(Number(dm[1]), Number(dm[2]) - 1, Number(dm[3]));
    const back = new Date(ms);
    const valid = back.getUTCFullYear() === Number(dm[1]) && back.getUTCMonth() === Number(dm[2]) - 1 && back.getUTCDate() === Number(dm[3]);
    if (valid && ms >= Date.UTC(1900, 0, 1) && ms <= nowMs + 86_400_000) p.birthDate = iso;
    else {
      p.birthDate = valid ? iso : null;
      p.errors.push('date');
    }
  } else p.errors.push('date');
  const tt = q.get('t') ?? '';
  if (tt === 'u') p.timeUnknown = true;
  else {
    const tm = /^(\d{2})(\d{2})$/.exec(tt);
    if (tm && Number(tm[1]) <= 23 && Number(tm[2]) <= 59) p.birthTime = `${tm[1]}:${tm[2]}`;
    else p.errors.push('time');
  }
  const a = Number(q.get('a') ?? '0');
  if ((SHARE_APPROX_VALUES as readonly number[]).includes(a)) p.approx = a as KundliPrefill['approx'];
  else p.errors.push('approx');
  const lat = Number(q.get('lat'));
  if (q.has('lat') && Number.isFinite(lat) && lat >= -90 && lat <= 90) p.lat = lat;
  else p.errors.push('lat');
  const lon = Number(q.get('lon'));
  if (q.has('lon') && Number.isFinite(lon) && lon >= -180 && lon <= 180) p.lon = lon;
  else p.errors.push('lon');
  const tz = canonicalZone(q.get('tz') ?? '');
  if (tz) p.tz = tz;
  else p.errors.push('tz');
  const g = q.get('g') ?? 'x';
  if (g === 'f' || g === 'm' || g === 'x') p.gender = g;
  else p.errors.push('gender');
  const n = q.get('n');
  if (n !== undefined) {
    if (Array.from(n).length <= 40) p.name = n || null;
    else {
      p.name = Array.from(n).slice(0, 40).join('');
      p.errors.push('name');
    }
  }
  return p;
}

interface Split {
  link: 'kundli' | 'm' | 'festival' | 'panchang' | null;
  path: string[];
  query: string;
}

/** `shubhvela://festival/holi/2026?x=y` -> {link: 'festival', path: ['holi', '2026'], query: 'x=y'}; also accepts the bare path. */
export function splitDeepLink(url: string): Split {
  const s = url.trim();
  const scheme = /^([a-z][a-z0-9+.-]*):\/\//i.exec(s);
  const rest = scheme ? s.slice(scheme[0].length) : s.replace(/^\//, '');
  const [beforeHash] = rest.split('#', 1);
  const qi = beforeHash.indexOf('?');
  const pathPart = qi < 0 ? beforeHash : beforeHash.slice(0, qi);
  const query = qi < 0 ? '' : beforeHash.slice(qi + 1);
  const segs = pathPart
    .split('/')
    .map((x) => {
      try {
        return decodeURIComponent(x).trim();
      } catch {
        return x.trim();
      }
    })
    .filter(Boolean);
  // shubhvela://<link>/... puts the link first; an http(s) page URL carries the site's base path before it.
  const isWeb = !!scheme && /^https?$/i.test(scheme[1]);
  const idx = isWeb ? segs.findIndex((x) => /^(kundli|m|festival|panchang)$/i.test(x)) : 0;
  const word = segs[idx]?.toLowerCase();
  if (idx < 0 || !word || !/^(kundli|m|festival|panchang)$/.test(word)) return { link: null, path: [], query };
  return { link: word as Split['link'], path: segs.slice(idx + 1), query };
}

/** "Made by a newer version" only when a `v` is present and not 1; a link with no `v` at all is simply malformed. */
function invalidReason(e: unknown, query: string): DeepLinkInvalidReason {
  if (e instanceof ShareUrlError && e.code === 'version' && queryMap(query).has('v')) return 'version';
  return 'payload';
}

export interface ParseDeepLinkOptions {
  nowMs?: number;
}

export function parseDeepLink(url: string, opts: ParseDeepLinkOptions = {}): DeepLinkTarget {
  const nowMs = opts.nowMs ?? Date.now();
  const { link, path, query } = splitDeepLink(url);
  if (!link) return { kind: 'invalid', reason: 'path', link: null };
  switch (link) {
    case 'kundli': {
      const prefill = prefillFromQuery(query, nowMs);
      try {
        const r = parseShareUrl(`shubhvela://kundli?${query}`, { nowMs, allowKundliExtras: true });
        return { kind: 'kundli', payload: r.payload, extras: r.extras, prefill };
      } catch (e) {
        return { kind: 'invalid', reason: invalidReason(e, query), link, prefill, detail: e instanceof ShareUrlError ? e.code : 'path' };
      }
    }
    case 'm': {
      try {
        const r = parseShareUrl(`shubhvela://m?${query}`, { nowMs, allowKundliExtras: false });
        return { kind: 'm', payload: r.payload, code: encodeShareCode(r.payload) };
      } catch (e) {
        return { kind: 'invalid', reason: invalidReason(e, query), link, prefill: prefillFromQuery(query, nowMs), detail: e instanceof ShareUrlError ? e.code : 'path' };
      }
    }
    case 'festival': {
      const slug = (path[0] ?? '').toLowerCase();
      if (!slug || !festivalRule(slug)) return { kind: 'invalid', reason: 'festival', link, detail: slug };
      const year = Number(path[1]);
      if (!path[1] || !Number.isInteger(year) || year < DEEPLINK_YEAR_MIN || year > DEEPLINK_YEAR_MAX) return { kind: 'invalid', reason: 'year', link, detail: path[1] ?? '' };
      return { kind: 'festival', slug, year };
    }
    case 'panchang': {
      const city = webCity(path[0] ?? '');
      if (!city) return { kind: 'invalid', reason: 'city', link, detail: path[0] ?? '' };
      return { kind: 'panchang', city, observer: { lat: city.lat, lon: city.lon, tz: city.tz, placeName: `${city.name}, ${city.admin1 ? `${city.admin1}, ` : ''}${city.countryName}`, source: 'city' } };
    }
  }
}

/** The in-app route a valid target opens (the route files under app/ call this after parsing). */
export function routeForTarget(target: DeepLinkTarget): string | null {
  switch (target.kind) {
    case 'festival':
      return `/family/festival/${encodeURIComponent(target.slug)}?year=${target.year}`;
    case 'panchang':
      return `/(tabs)/today?city=${encodeURIComponent(target.city.slug)}`;
    case 'm':
      return '/family/match';
    case 'kundli':
      return '/kundli';
    default:
      return null;
  }
}

/** Rebuilds the M8 query string from expo-router's params object (the route file receives the query already split). */
export function queryFromParams(params: Record<string, string | string[] | undefined>): string {
  return Object.entries(params)
    .filter(([k]) => k !== 'id')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(Array.isArray(v) ? v[0] ?? '' : v ?? '')}`)
    .join('&');
}
