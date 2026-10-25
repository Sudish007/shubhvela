// Online place search fallback (design.md 10.1 F1, N8): https://nominatim.openstreetmap.org/search?q=&format=jsonv2&limit=5
// only on an explicit "Search online" tap, never per keystroke, with the identifying User-Agent, at most one request
// per second (a module-level gate that waits, never drops), an 8 s timeout, and errors surfaced inline by the caller.
// The lat/lon -> zone id comes from tz-lookup, normalised to the engine's canonical ids; rows without a known zone are
// dropped (design.md 11: "Time zone unknown for this place").
import { canonicalZone } from '@shubhvela/engine';
import Constants from 'expo-constants';
import tzLookup from 'tz-lookup';

export const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
export const NOMINATIM_TIMEOUT_MS = 8000;
export const NOMINATIM_MIN_INTERVAL_MS = 1000;
export const NOMINATIM_LIMIT = 5;
export const WEB_BASE = 'https://sudish007.github.io/shubhvela/';

export function appVersion(): string {
  return Constants.expoConfig?.version ?? '0.0.0';
}

/** "Shubhvela-Android/<version> (+https://sudish007.github.io/shubhvela/)" (disclosed in the consent notice). */
export function userAgent(version: string = appVersion()): string {
  return `Shubhvela-Android/${version} (+${WEB_BASE})`;
}

export interface OnlinePlace {
  name: string;
  /** State / region line as Nominatim reports it (may be empty). */
  admin1: string;
  country: string;
  lat: number;
  lon: number;
  /** Canonical IANA zone id from tz-lookup, normalised by the engine. */
  tz: string;
  displayName: string;
}

interface NominatimRow {
  lat: string;
  lon: string;
  name?: string;
  display_name: string;
  address?: Record<string, string | undefined>;
}

export interface NominatimDeps {
  fetch: typeof fetch;
  now: () => number;
  sleep: (ms: number) => Promise<void>;
  version?: string;
}

const defaultDeps: NominatimDeps = {
  fetch: (...args) => fetch(...args),
  now: () => Date.now(),
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
};

let lastRequestAt = -Infinity;

/** Test seam. */
export function resetNominatimGate(): void {
  lastRequestAt = -Infinity;
}

export class NominatimError extends Error {
  constructor(
    message: string,
    readonly kind: 'timeout' | 'http' | 'network' | 'parse',
  ) {
    super(message);
  }
}

export function toOnlinePlace(row: NominatimRow): OnlinePlace | null {
  const lat = Number(row.lat);
  const lon = Number(row.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  let zone: string | undefined;
  try {
    zone = canonicalZone(tzLookup(lat, lon));
  } catch {
    zone = undefined;
  }
  if (!zone) return null;
  const a = row.address ?? {};
  const name = row.name || a.city || a.town || a.village || a.hamlet || row.display_name.split(',')[0].trim();
  return {
    name,
    admin1: a.state || a.state_district || a.county || '',
    country: a.country || '',
    lat,
    lon,
    tz: zone,
    displayName: row.display_name,
  };
}

/** One search; waits for the 1 req/s gate first. Rejects with NominatimError (caller shows errors.nominatim inline). */
export async function searchNominatim(query: string, deps: Partial<NominatimDeps> = {}): Promise<OnlinePlace[]> {
  const d: NominatimDeps = { ...defaultDeps, ...deps };
  const q = query.trim();
  if (!q) return [];
  const wait = lastRequestAt + NOMINATIM_MIN_INTERVAL_MS - d.now();
  if (wait > 0) await d.sleep(wait);
  lastRequestAt = d.now();

  const url = `${NOMINATIM_URL}?q=${encodeURIComponent(q)}&format=jsonv2&limit=${NOMINATIM_LIMIT}&addressdetails=1`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), NOMINATIM_TIMEOUT_MS);
  let res: Response;
  try {
    res = await d.fetch(url, {
      method: 'GET',
      headers: { 'User-Agent': userAgent(d.version), Accept: 'application/json' },
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(timer);
    const aborted = (e as { name?: string })?.name === 'AbortError';
    throw new NominatimError(aborted ? 'timeout' : String(e), aborted ? 'timeout' : 'network');
  }
  clearTimeout(timer);
  if (!res.ok) throw new NominatimError(`HTTP ${res.status}`, 'http');
  let rows: unknown;
  try {
    rows = await res.json();
  } catch (e) {
    throw new NominatimError(String(e), 'parse');
  }
  if (!Array.isArray(rows)) throw new NominatimError('not an array', 'parse');
  return (rows as NominatimRow[]).map(toOnlinePlace).filter((p): p is OnlinePlace => p !== null);
}
