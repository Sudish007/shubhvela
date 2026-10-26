// Share-a-code (spec F30, design 10.6 F30 mode A + design 11 validation, plan B01, review M8).
// ONE payload, three carriers: the 20-character Crockford base32 typed code, the QR / web URL
// `/m/?v=1&d=YYYYMMDD&t=HHMM|u&a=0|15|30|60&lat=±dd.dd&lon=±ddd.dd&tz=<IANA>&g=f|m|x`, and the deep links
// `shubhvela://kundli?...` / `shubhvela://m?...`. The same parser serves `/kundli/` (which may add the display extras
// ay, nd, st, n) and `/m/` (which may not). No name travels in the code or the /m/ URL.
//
// Code layout (100 bits, MSB first, design 10.6):
//   2  version (1)                      17 days since 1900-01-01 (0 .. 131071 -> 2258-11)
//   11 minutes of the day, 1440 = unknown time (t=u)
//   2  approx index (0, 15, 30, 60 min)   15 (lat + 90) x 100, 0 .. 18000 at 0.01 deg
//   16 (lon + 180) x 100, 0 .. 36000      10 index into the engine's sorted canonical zone list (zoneIndex/zoneAt)
//   2  gender (0 x, 1 f, 2 m)              8 CRC-8 (poly 0x07, init 0) over the 13 bytes with the CRC field zeroed
//   17 reserved zero
// Decoding is case-insensitive and maps I/L -> 1 and O -> 0 (Crockford); hyphens and spaces are ignored. Every
// failure throws ShareCodeError with a `code` the UI maps to the one message of design 11.
import { type BirthInput } from '../kundli/index';
import { canonicalZone, zoneAt, zoneIndex, zoneList } from '../tz/index';

export const SHARE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export const SHARE_CODE_LENGTH = 20;
export const SHARE_VERSION = 1;
export const SHARE_BASE_URL = 'https://sudish007.github.io/shubhvela/';
export const SHARE_SCHEME = 'shubhvela';
export const SHARE_APPROX_VALUES = [0, 15, 30, 60] as const;
export type ShareApprox = (typeof SHARE_APPROX_VALUES)[number];
export type ShareGender = 'x' | 'f' | 'm';

export interface SharePayload {
  v: 1;
  /** YYYY-MM-DD. */
  date: string;
  /** HH:MM or null for unknown. */
  time: string | null;
  approx: ShareApprox;
  /** Rounded to 0.01 deg. */
  lat: number;
  lon: number;
  /** Canonical IANA id from the engine table. */
  tz: string;
  gender: ShareGender;
}

/** Display extras allowed on /kundli/ and shubhvela://kundli only (M8). */
export interface KundliExtras {
  ay?: 'lahiri' | 'kp' | 'raman';
  nd?: 'mean' | 'true';
  st?: 'north' | 'south' | 'east';
  /** Display name, <= 40 chars. */
  n?: string;
}

export type ShareCodeErrorCode = 'length' | 'alphabet' | 'crc' | 'version' | 'range' | 'zone';
export type ShareUrlErrorCode = 'version' | 'date' | 'time' | 'approx' | 'lat' | 'lon' | 'tz' | 'gender' | 'extras-not-allowed' | 'extra' | 'path';

export class ShareCodeError extends Error {
  constructor(public readonly code: ShareCodeErrorCode, message: string) {
    super(message);
    this.name = 'ShareCodeError';
  }
}

export class ShareUrlError extends Error {
  constructor(public readonly code: ShareUrlErrorCode, message: string) {
    super(message);
    this.name = 'ShareUrlError';
  }
}

const UNKNOWN_MINUTES = 1440;
const GENDER_CODES: ShareGender[] = ['x', 'f', 'm'];
const EPOCH_1900 = Date.UTC(1900, 0, 1);
const DAY_MS = 86_400_000;

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function parseIsoDate(date: string): { y: number; m: number; d: number } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) throw new ShareCodeError('range', `Invalid date ${date}`);
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const t = Date.UTC(y, mo - 1, d);
  const back = new Date(t);
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d) throw new ShareCodeError('range', `Invalid date ${date}`);
  return { y, m: mo, d };
}

function daysSince1900(date: string): number {
  const { y, m, d } = parseIsoDate(date);
  return Math.round((Date.UTC(y, m - 1, d) - EPOCH_1900) / DAY_MS);
}

function dateFromDays(days: number): string {
  const t = new Date(EPOCH_1900 + days * DAY_MS);
  return `${t.getUTCFullYear()}-${pad2(t.getUTCMonth() + 1)}-${pad2(t.getUTCDate())}`;
}

function minutesOf(time: string | null): number {
  if (time === null) return UNKNOWN_MINUTES;
  const m = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!m) throw new ShareCodeError('range', `Invalid time ${time}`);
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (hh > 23 || mm > 59) throw new ShareCodeError('range', `Invalid time ${time}`);
  return hh * 60 + mm;
}

/** CRC-8 (poly 0x07, init 0x00, no reflection) over bytes. */
export function crc8(bytes: Uint8Array): number {
  let crc = 0;
  for (const b of bytes) {
    crc ^= b;
    for (let i = 0; i < 8; i++) crc = crc & 0x80 ? ((crc << 1) ^ 0x07) & 0xff : (crc << 1) & 0xff;
  }
  return crc;
}

/** The 100 bits as 13 bytes (104 bits, the last 4 bits zero), MSB first. */
function toBytes(bits: bigint): Uint8Array {
  const out = new Uint8Array(13);
  let v = bits << 4n; // 104 bits
  for (let i = 12; i >= 0; i--) {
    out[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return out;
}

const FIELD_BITS = { version: 2n, days: 17n, minutes: 11n, approx: 2n, lat: 15n, lon: 16n, tz: 10n, gender: 2n, crc: 8n, reserved: 17n } as const;

function pack(fields: { version: number; days: number; minutes: number; approx: number; lat: number; lon: number; tz: number; gender: number; crc: number }): bigint {
  let bits = 0n;
  const push = (value: number, width: bigint): void => {
    if (value < 0 || BigInt(value) >= 1n << width) throw new ShareCodeError('range', `Field value ${value} does not fit ${width} bits`);
    bits = (bits << width) | BigInt(value);
  };
  push(fields.version, FIELD_BITS.version);
  push(fields.days, FIELD_BITS.days);
  push(fields.minutes, FIELD_BITS.minutes);
  push(fields.approx, FIELD_BITS.approx);
  push(fields.lat, FIELD_BITS.lat);
  push(fields.lon, FIELD_BITS.lon);
  push(fields.tz, FIELD_BITS.tz);
  push(fields.gender, FIELD_BITS.gender);
  push(fields.crc, FIELD_BITS.crc);
  push(0, FIELD_BITS.reserved);
  return bits;
}

function unpack(bits: bigint): { version: number; days: number; minutes: number; approx: number; lat: number; lon: number; tz: number; gender: number; crc: number; reserved: number } {
  const take = (width: bigint, shift: bigint): number => Number((bits >> shift) & ((1n << width) - 1n));
  let shift = 0n;
  const reserved = take(FIELD_BITS.reserved, shift);
  shift += FIELD_BITS.reserved;
  const crc = take(FIELD_BITS.crc, shift);
  shift += FIELD_BITS.crc;
  const gender = take(FIELD_BITS.gender, shift);
  shift += FIELD_BITS.gender;
  const tz = take(FIELD_BITS.tz, shift);
  shift += FIELD_BITS.tz;
  const lon = take(FIELD_BITS.lon, shift);
  shift += FIELD_BITS.lon;
  const lat = take(FIELD_BITS.lat, shift);
  shift += FIELD_BITS.lat;
  const approx = take(FIELD_BITS.approx, shift);
  shift += FIELD_BITS.approx;
  const minutes = take(FIELD_BITS.minutes, shift);
  shift += FIELD_BITS.minutes;
  const days = take(FIELD_BITS.days, shift);
  shift += FIELD_BITS.days;
  const version = take(FIELD_BITS.version, shift);
  return { version, days, minutes, approx, lat, lon, tz, gender, crc, reserved };
}

function base32Encode(bits: bigint): string {
  let out = '';
  for (let i = SHARE_CODE_LENGTH - 1; i >= 0; i--) out += SHARE_ALPHABET[Number((bits >> BigInt(i * 5)) & 31n)];
  return out;
}

/** Crockford normalisation: upper-case, I/L -> 1, O -> 0, separators dropped. */
export function normaliseShareCode(input: string): string {
  return input.toUpperCase().replace(/[\s-]/g, '').replace(/[IL]/g, '1').replace(/O/g, '0');
}

/** Formats a code in groups of four for display ("ABCD-EFGH-..."). */
export function formatShareCode(code: string): string {
  return code.replace(/(.{4})(?=.)/g, '$1-');
}

export function roundCoord(x: number): number {
  return Math.round(x * 100) / 100;
}

/** Validates and normalises a payload (rounding lat/lon, canonical zone). */
export function normalisePayload(p: Omit<SharePayload, 'v'> & { v?: 1 }): SharePayload {
  if (p.v !== undefined && p.v !== SHARE_VERSION) throw new ShareCodeError('version', `Unsupported payload version ${p.v}`);
  parseIsoDate(p.date);
  minutesOf(p.time);
  if (!(SHARE_APPROX_VALUES as readonly number[]).includes(p.approx)) throw new ShareCodeError('range', `Invalid approx ${p.approx}`);
  if (!Number.isFinite(p.lat) || p.lat < -90 || p.lat > 90) throw new ShareCodeError('range', `Invalid latitude ${p.lat}`);
  if (!Number.isFinite(p.lon) || p.lon < -180 || p.lon > 180) throw new ShareCodeError('range', `Invalid longitude ${p.lon}`);
  const tz = canonicalZone(p.tz);
  if (!tz) throw new ShareCodeError('zone', `Unknown time zone ${p.tz}`);
  if (!GENDER_CODES.includes(p.gender)) throw new ShareCodeError('range', `Invalid gender ${p.gender}`);
  return { v: 1, date: p.date, time: p.time, approx: p.approx, lat: roundCoord(p.lat), lon: roundCoord(p.lon), tz, gender: p.gender };
}

/** Encodes a payload as the 20-character typed code. */
export function encodeShareCode(input: Omit<SharePayload, 'v'> & { v?: 1 }): string {
  const p = normalisePayload(input);
  const days = daysSince1900(p.date);
  if (days < 0) throw new ShareCodeError('range', `Date before 1900: ${p.date}`);
  const tz = zoneIndex(p.tz);
  if (tz < 0) throw new ShareCodeError('zone', `Unknown time zone ${p.tz}`);
  if (zoneList().length > 1024) throw new ShareCodeError('zone', 'Zone table exceeds the 10-bit index');
  const fields = {
    version: SHARE_VERSION,
    days,
    minutes: minutesOf(p.time),
    approx: SHARE_APPROX_VALUES.indexOf(p.approx),
    lat: Math.round((p.lat + 90) * 100),
    lon: Math.round((p.lon + 180) * 100),
    tz,
    gender: GENDER_CODES.indexOf(p.gender),
    crc: 0,
  };
  const crc = crc8(toBytes(pack(fields)));
  return base32Encode(pack({ ...fields, crc }));
}

/** Decodes a typed code (case-insensitive, I/L/O mapped); throws ShareCodeError on length / alphabet / CRC / version. */
export function decodeShareCode(input: string): SharePayload {
  const code = normaliseShareCode(input);
  if (code.length !== SHARE_CODE_LENGTH) throw new ShareCodeError('length', `Expected ${SHARE_CODE_LENGTH} characters, got ${code.length}`);
  let bits = 0n;
  for (const ch of code) {
    const v = SHARE_ALPHABET.indexOf(ch);
    if (v < 0) throw new ShareCodeError('alphabet', `Character ${ch} is not Crockford base32`);
    bits = (bits << 5n) | BigInt(v);
  }
  const f = unpack(bits);
  const expected = crc8(toBytes(pack({ ...f, crc: 0 })));
  if (f.crc !== expected) throw new ShareCodeError('crc', 'Checksum mismatch');
  if (f.version !== SHARE_VERSION) throw new ShareCodeError('version', `Unsupported code version ${f.version}`);
  if (f.reserved !== 0) throw new ShareCodeError('version', 'Reserved bits set');
  if (f.minutes !== UNKNOWN_MINUTES && f.minutes > 1439) throw new ShareCodeError('range', `Invalid minutes ${f.minutes}`);
  if (f.lat > 18000) throw new ShareCodeError('range', 'Latitude out of range');
  if (f.lon > 36000) throw new ShareCodeError('range', 'Longitude out of range');
  const tz = zoneAt(f.tz);
  if (!tz) throw new ShareCodeError('zone', `Zone index ${f.tz} out of range`);
  const gender = GENDER_CODES[f.gender];
  if (!gender) throw new ShareCodeError('range', `Invalid gender code ${f.gender}`);
  return {
    v: 1,
    date: dateFromDays(f.days),
    time: f.minutes === UNKNOWN_MINUTES ? null : `${pad2(Math.floor(f.minutes / 60))}:${pad2(f.minutes % 60)}`,
    approx: SHARE_APPROX_VALUES[f.approx],
    lat: roundCoord(f.lat / 100 - 90),
    lon: roundCoord(f.lon / 100 - 180),
    tz,
    gender,
  };
}

// ---------------------------------------------------------------- URL schema (M8)

export type ShareUrlKind = 'kundli' | 'm';

export interface ShareUrlParseOptions {
  /** Default: true for kundli paths, false for /m/. */
  allowKundliExtras?: boolean;
  /** "Today" for the date range check (default Date.now()). */
  nowMs?: number;
}

export interface ParsedShareUrl {
  kind: ShareUrlKind;
  payload: SharePayload;
  extras: KundliExtras;
}

/** "28.61" / "-33.87": two decimals, a minus sign only when negative (never '+', which URLs read as a space). */
function coordString(x: number): string {
  const r = roundCoord(x);
  return (r === 0 ? 0 : r).toFixed(2);
}

/** Query string of a payload (no leading '?'); numbers never carry a '+' sign. */
export function shareQuery(input: Omit<SharePayload, 'v'> & { v?: 1 }, extras: KundliExtras = {}): string {
  const p = normalisePayload(input);
  const parts = [
    `v=${SHARE_VERSION}`,
    `d=${p.date.replace(/-/g, '')}`,
    `t=${p.time === null ? 'u' : p.time.replace(':', '')}`,
    `a=${p.approx}`,
    `lat=${coordString(p.lat)}`,
    `lon=${coordString(p.lon)}`,
    `tz=${encodeURIComponent(p.tz)}`,
    `g=${p.gender}`,
  ];
  if (extras.ay) parts.push(`ay=${extras.ay}`);
  if (extras.nd) parts.push(`nd=${extras.nd}`);
  if (extras.st) parts.push(`st=${extras.st}`);
  if (extras.n) parts.push(`n=${encodeURIComponent(extras.n.slice(0, 40))}`);
  return parts.join('&');
}

/** `https://sudish007.github.io/shubhvela/m/?...` (QR / web) for a payload; `kind: 'kundli'` gives the `/kundli/` page with optional extras. */
export function toShareUrl(input: Omit<SharePayload, 'v'> & { v?: 1 }, base: string = SHARE_BASE_URL, kind: ShareUrlKind = 'm', extras: KundliExtras = {}): string {
  const root = base.endsWith('/') ? base : `${base}/`;
  if (kind === 'm' && Object.keys(extras).length) throw new ShareUrlError('extras-not-allowed', 'The /m/ payload carries no display extras');
  return `${root}${kind}/?${shareQuery(input, kind === 'kundli' ? extras : {})}`;
}

/** `shubhvela://kundli?...` / `shubhvela://m?...` deep link for a payload. */
export function toDeepLink(input: Omit<SharePayload, 'v'> & { v?: 1 }, kind: ShareUrlKind = 'm', extras: KundliExtras = {}): string {
  if (kind === 'm' && Object.keys(extras).length) throw new ShareUrlError('extras-not-allowed', 'The /m/ payload carries no display extras');
  return `${SHARE_SCHEME}://${kind}?${shareQuery(input, kind === 'kundli' ? extras : {})}`;
}

function kindOf(input: string): { kind: ShareUrlKind | null; query: string } {
  const s = input.trim();
  const deep = new RegExp(`^${SHARE_SCHEME}://(kundli|m)/?(?:\\?(.*))?$`, 'i').exec(s);
  if (deep) return { kind: deep[1].toLowerCase() as ShareUrlKind, query: deep[2] ?? '' };
  const web = /^https?:\/\/[^?#]*\/(kundli|m)\/?(?:\?([^#]*))?(?:#.*)?$/i.exec(s);
  if (web) return { kind: web[1].toLowerCase() as ShareUrlKind, query: web[2] ?? '' };
  const bare = /^\/?(kundli|m)\/?\?(.*)$/i.exec(s);
  if (bare) return { kind: bare[1].toLowerCase() as ShareUrlKind, query: bare[2] };
  return { kind: null, query: s.replace(/^\?/, '') };
}

function parseQuery(query: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const part of query.split('&')) {
    if (!part) continue;
    const i = part.indexOf('=');
    const k = decodeURIComponent(i < 0 ? part : part.slice(0, i)).trim();
    const v = decodeURIComponent((i < 0 ? '' : part.slice(i + 1)).replace(/\+/g, ' ')).trim();
    if (!out.has(k)) out.set(k, v);
  }
  return out;
}

/**
 * Parses a `/kundli/` or `/m/` URL, a `shubhvela://kundli|m?...` deep link or a bare query string with the validation
 * rules of design 11 (v=1, date 1900-01-01..today, t HHMM|u, a 0|15|30|60, lat/lon ranges, tz in the zone table,
 * g f|m|x). Extras ay/nd/st/n are accepted only when allowed (kundli paths); on /m/ they throw `extras-not-allowed`.
 */
export function parseShareUrl(input: string, opts: ShareUrlParseOptions = {}): ParsedShareUrl {
  const { kind, query } = kindOf(input);
  if (!kind && /^[a-z]+:\/\//i.test(input.trim())) throw new ShareUrlError('path', 'Not a kundli or m link');
  const resolvedKind: ShareUrlKind = kind ?? 'm';
  const allowExtras = opts.allowKundliExtras ?? resolvedKind === 'kundli';
  const q = parseQuery(query);
  const get = (k: string): string | undefined => q.get(k);
  if (get('v') !== String(SHARE_VERSION)) throw new ShareUrlError('version', `v must be ${SHARE_VERSION}`);
  const d = get('d') ?? '';
  const dm = /^(\d{4})(\d{2})(\d{2})$/.exec(d);
  if (!dm) throw new ShareUrlError('date', `d must be YYYYMMDD, got ${d}`);
  const date = `${dm[1]}-${dm[2]}-${dm[3]}`;
  try {
    parseIsoDate(date);
  } catch {
    throw new ShareUrlError('date', `Invalid date ${date}`);
  }
  const dayMs = Date.UTC(Number(dm[1]), Number(dm[2]) - 1, Number(dm[3]));
  const now = opts.nowMs ?? Date.now();
  if (dayMs < EPOCH_1900 || dayMs > now + DAY_MS) throw new ShareUrlError('date', `Date out of range: ${date}`);
  const t = get('t') ?? '';
  let time: string | null;
  if (t === 'u') time = null;
  else {
    const tm = /^(\d{2})(\d{2})$/.exec(t);
    if (!tm || Number(tm[1]) > 23 || Number(tm[2]) > 59) throw new ShareUrlError('time', `t must be HHMM or u, got ${t}`);
    time = `${tm[1]}:${tm[2]}`;
  }
  const a = Number(get('a') ?? '0');
  if (!(SHARE_APPROX_VALUES as readonly number[]).includes(a)) throw new ShareUrlError('approx', `a must be 0, 15, 30 or 60`);
  const lat = Number(get('lat'));
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) throw new ShareUrlError('lat', `lat out of range`);
  const lon = Number(get('lon'));
  if (!Number.isFinite(lon) || lon < -180 || lon > 180) throw new ShareUrlError('lon', `lon out of range`);
  const tzRaw = get('tz') ?? '';
  const tz = canonicalZone(tzRaw);
  if (!tz) throw new ShareUrlError('tz', `Unknown time zone ${tzRaw}`);
  const g = (get('g') ?? 'x') as ShareGender;
  if (!GENDER_CODES.includes(g)) throw new ShareUrlError('gender', `g must be f, m or x`);
  const extras: KundliExtras = {};
  const extraKeys = ['ay', 'nd', 'st', 'n'].filter((k) => q.has(k));
  if (extraKeys.length && !allowExtras) throw new ShareUrlError('extras-not-allowed', `Extras not allowed here: ${extraKeys.join(', ')}`);
  if (allowExtras) {
    const ay = get('ay');
    if (ay !== undefined) {
      if (!['lahiri', 'kp', 'raman'].includes(ay)) throw new ShareUrlError('extra', `ay must be lahiri, kp or raman`);
      extras.ay = ay as KundliExtras['ay'];
    }
    const nd = get('nd');
    if (nd !== undefined) {
      if (!['mean', 'true'].includes(nd)) throw new ShareUrlError('extra', `nd must be mean or true`);
      extras.nd = nd as KundliExtras['nd'];
    }
    const st = get('st');
    if (st !== undefined) {
      if (!['north', 'south', 'east'].includes(st)) throw new ShareUrlError('extra', `st must be north, south or east`);
      extras.st = st as KundliExtras['st'];
    }
    const n = get('n');
    if (n !== undefined) {
      if (n.length > 40) throw new ShareUrlError('extra', `n longer than 40 characters`);
      if (n) extras.n = n;
    }
  }
  return { kind: resolvedKind, payload: { v: 1, date, time, approx: a as ShareApprox, lat: roundCoord(lat), lon: roundCoord(lon), tz, gender: g }, extras };
}

/** The BirthInput computeChart() needs from a payload. */
export function birthFromPayload(p: SharePayload): BirthInput {
  return { date: p.date, time: p.time ?? undefined, timeUnknown: p.time === null, approxMinutes: p.approx, tz: p.tz, lat: p.lat, lon: p.lon };
}
