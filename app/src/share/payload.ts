// Share-a-code payload helpers (F30 mode A, design.md 10.6, plan B06): a profile or a birth form -> the engine's
// SharePayload (no name, lat/lon rounded to 0.01 deg by the engine), the QR URL and the 20-character typed code; and
// the one decoder for anything a user scans or types (a /m/ or /kundli/ URL, a shubhvela:// deep link, a bare query or
// the raw code). Every failure maps to the single message of design.md 11 (`share.invalid`).
import {
  birthFromPayload,
  decodeShareCode,
  encodeShareCode,
  formatShareCode,
  normaliseShareCode,
  parseShareUrl,
  SHARE_ALPHABET,
  SHARE_CODE_LENGTH,
  toShareUrl,
  type BirthInput,
  type SharePayload,
  type ShareGender,
} from '@shubhvela/engine';
import type { Gender, Profile, ProfileInput } from '../db/profiles';
import { approxMinutesOf, type BirthFormValue } from '../profiles/validate';

export function shareGender(g: Gender | null): ShareGender {
  return g === 'female' ? 'f' : g === 'male' ? 'm' : 'x';
}

/** Payload of a stored profile: date, time (null when unknown), approx minutes, place, zone, gender. Never the name. */
export function payloadFromProfile(p: Profile | ProfileInput): SharePayload {
  const approx = p.timeUnknown ? 0 : p.timeApproxMinutes;
  return {
    v: 1,
    date: p.birthDate,
    time: p.timeUnknown || !p.birthTime ? null : p.birthTime,
    approx,
    lat: p.lat,
    lon: p.lon,
    tz: p.tz,
    gender: shareGender(p.gender),
  };
}

/** Payload of a validated birth form (validateForm() must have passed). */
export function payloadFromForm(v: BirthFormValue): SharePayload {
  if (!v.birthDate || !v.place) throw new Error('validateForm() must pass before payloadFromForm()');
  return {
    v: 1,
    date: v.birthDate,
    time: v.timeUnknown ? null : v.birthTime,
    approx: approxMinutesOf(v),
    lat: v.place.lat,
    lon: v.place.lon,
    tz: v.place.tz,
    gender: shareGender(v.gender),
  };
}

export interface ShareCarriers {
  /** `https://sudish007.github.io/shubhvela/m/?v=1&d=...` - the QR content and the web /m/ page. */
  url: string;
  /** 20 Crockford base32 characters. */
  code: string;
  /** The code in groups of four ("ABCD-EFGH-..."). */
  grouped: string;
}

export function carriersFor(payload: SharePayload): ShareCarriers {
  const code = encodeShareCode(payload);
  return { url: toShareUrl(payload), code, grouped: formatShareCode(code) };
}

/** True when the normalised input could only be a typed code (not a link). */
function looksLikeCode(s: string): boolean {
  return !/[:/?=&]/.test(s);
}

/**
 * Decodes whatever was scanned or typed: a /m/ or /kundli/ URL, a deep link, a bare query string, or the raw 20
 * characters (case-insensitive, I/L/O mapped, separators ignored). Returns null on ANY failure - length, alphabet,
 * CRC, version, range, zone, bad URL - so the UI shows the one message of design.md 11.
 */
export function decodeShared(input: string, nowMs: number = Date.now()): SharePayload | null {
  const s = input.trim();
  if (!s) return null;
  try {
    if (looksLikeCode(s)) return decodeShareCode(s);
    return parseShareUrl(s, { nowMs }).payload;
  } catch {
    return null;
  }
}

/** Characters the typed field accepts (after Crockford normalisation); separators are dropped, not counted. */
export function typedCodeProgress(input: string): { normalised: string; complete: boolean; alphabetOk: boolean } {
  const normalised = normaliseShareCode(input);
  const alphabetOk = [...normalised].every((ch) => SHARE_ALPHABET.includes(ch));
  return { normalised, complete: normalised.length === SHARE_CODE_LENGTH, alphabetOk };
}

export function birthOf(payload: SharePayload): BirthInput {
  return birthFromPayload(payload);
}
