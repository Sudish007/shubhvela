// F30 / M8: 20-character Crockford code round trip for random payloads, CRC and version rejection, I/L/O mapping,
// URL format/parse round trip for /m/, /kundli/ and the shubhvela:// deep links, kundli extras rejected on /m/.
import { describe, expect, it } from 'vitest';
import {
  SHARE_ALPHABET,
  SHARE_CODE_LENGTH,
  ShareCodeError,
  ShareUrlError,
  type SharePayload,
  birthFromPayload,
  crc8,
  decodeShareCode,
  encodeShareCode,
  formatShareCode,
  normaliseShareCode,
  parseShareUrl,
  shareQuery,
  toDeepLink,
  toShareUrl,
} from '../src/share/index';
import { computeChart } from '../src/kundli/index';
import { zoneList } from '../src/tz/index';

const PRIYA: Omit<SharePayload, 'v'> = { date: '1998-03-14', time: '06:42', approx: 0, lat: 26.85, lon: 80.95, tz: 'Asia/Kolkata', gender: 'f' };
const NOW = Date.UTC(2026, 9, 27);

/** Deterministic LCG so the 50 payloads are reproducible. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

function randomPayload(r: () => number): Omit<SharePayload, 'v'> {
  const zones = zoneList();
  const y = 1900 + Math.floor(r() * 126);
  const m = 1 + Math.floor(r() * 12);
  const d = 1 + Math.floor(r() * 28);
  const unknown = r() < 0.2;
  const hh = Math.floor(r() * 24);
  const mm = Math.floor(r() * 60);
  const pad = (n: number) => (n < 10 ? `0${n}` : String(n));
  return {
    date: `${y}-${pad(m)}-${pad(d)}`,
    time: unknown ? null : `${pad(hh)}:${pad(mm)}`,
    approx: ([0, 15, 30, 60] as const)[Math.floor(r() * 4)],
    lat: Math.round((r() * 180 - 90) * 100) / 100,
    lon: Math.round((r() * 360 - 180) * 100) / 100,
    tz: zones[Math.floor(r() * zones.length)],
    gender: (['x', 'f', 'm'] as const)[Math.floor(r() * 3)],
  };
}

describe('share code (F30)', () => {
  it('encodes to 20 Crockford characters and decodes back for 50 random payloads', () => {
    const r = rng(20261027);
    for (let i = 0; i < 50; i++) {
      const p = randomPayload(r);
      const code = encodeShareCode(p);
      expect(code).toHaveLength(SHARE_CODE_LENGTH);
      for (const ch of code) expect(SHARE_ALPHABET).toContain(ch);
      const back = decodeShareCode(code);
      expect(back).toEqual({ v: 1, ...p });
    }
  });

  it('is case-insensitive, maps I/L to 1 and O to 0, ignores separators (Crockford)', () => {
    const code = encodeShareCode(PRIYA);
    expect(decodeShareCode(code.toLowerCase())).toEqual({ v: 1, ...PRIYA });
    expect(decodeShareCode(formatShareCode(code))).toEqual({ v: 1, ...PRIYA });
    expect(formatShareCode(code)).toMatch(/^[0-9A-Z]{4}(-[0-9A-Z]{4}){4}$/);
    const confusable = code.replace(/1/g, 'I').replace(/0/g, 'O');
    expect(decodeShareCode(confusable)).toEqual({ v: 1, ...PRIYA });
    expect(normaliseShareCode(' ab-cd il o ')).toBe('ABCD110');
    expect(decodeShareCode(code.replace(/1/g, 'L'))).toEqual({ v: 1, ...PRIYA });
  });

  it('rejects a corrupted character (CRC), a wrong length, a bad alphabet character and another version', () => {
    const code = encodeShareCode(PRIYA);
    const flip = (i: number): string => {
      const alt = SHARE_ALPHABET[(SHARE_ALPHABET.indexOf(code[i]) + 1) % 32];
      return code.slice(0, i) + alt + code.slice(i + 1);
    };
    // Changing any single character is rejected: payload / CRC characters fail the CRC; a character inside the 17
    // reserved zero bits (the last three and a half characters) passes the CRC but fails the "reserved bits set" check.
    let crcRejections = 0;
    for (let i = 0; i < SHARE_CODE_LENGTH; i++) {
      let err: unknown;
      try {
        decodeShareCode(flip(i));
      } catch (e) {
        err = e;
      }
      expect(err).toBeInstanceOf(ShareCodeError);
      expect(['crc', 'version']).toContain((err as ShareCodeError).code);
      if ((err as ShareCodeError).code === 'crc') crcRejections++;
    }
    expect(crcRejections).toBeGreaterThanOrEqual(16);
    expect(() => decodeShareCode(code.slice(0, 19))).toThrow(expect.objectContaining({ code: 'length' }));
    expect(() => decodeShareCode(code + 'A')).toThrow(expect.objectContaining({ code: 'length' }));
    expect(() => decodeShareCode(code.slice(0, 19) + 'U')).toThrow(expect.objectContaining({ code: 'alphabet' }));
    // Version 2 with a valid CRC: build the code by hand from the bits.
    const bits = [...code].reduce((acc, ch) => (acc << 5n) | BigInt(SHARE_ALPHABET.indexOf(ch)), 0n);
    const withVersion2 = (bits & ~(3n << 98n)) | (2n << 98n);
    const bytes = new Uint8Array(13);
    let v = (withVersion2 & ~(0xffn << 17n)) << 4n;
    for (let i = 12; i >= 0; i--) {
      bytes[i] = Number(v & 0xffn);
      v >>= 8n;
    }
    const fixed = (withVersion2 & ~(0xffn << 17n)) | (BigInt(crc8(bytes)) << 17n);
    let s = '';
    for (let i = 19; i >= 0; i--) s += SHARE_ALPHABET[Number((fixed >> BigInt(i * 5)) & 31n)];
    expect(() => decodeShareCode(s)).toThrow(expect.objectContaining({ code: 'version' }));
    expect(() => encodeShareCode({ ...PRIYA, tz: 'Mars/Olympus' })).toThrow(expect.objectContaining({ code: 'zone' }));
    expect(() => encodeShareCode({ ...PRIYA, lat: 95 })).toThrow(expect.objectContaining({ code: 'range' }));
    expect(() => encodeShareCode({ ...PRIYA, date: '1899-12-31' })).toThrow(expect.objectContaining({ code: 'range' }));
  });

  it('CRC-8 (poly 0x07) matches the standard check value', () => {
    expect(crc8(new TextEncoder().encode('123456789'))).toBe(0xf4);
    expect(crc8(new Uint8Array(0))).toBe(0);
  });

  it('formats the M8 URL and parses it back; lat/lon never carry a plus sign', () => {
    const url = toShareUrl(PRIYA);
    expect(url).toBe('https://sudish007.github.io/shubhvela/m/?v=1&d=19980314&t=0642&a=0&lat=26.85&lon=80.95&tz=Asia%2FKolkata&g=f');
    const parsed = parseShareUrl(url, { nowMs: NOW });
    expect(parsed.kind).toBe('m');
    expect(parsed.payload).toEqual({ v: 1, ...PRIYA });
    expect(parsed.extras).toEqual({});
    expect(shareQuery({ ...PRIYA, time: null, approx: 30, lat: -33.868, lon: 151.209, tz: 'Australia/Sydney', gender: 'x' })).toBe('v=1&d=19980314&t=u&a=30&lat=-33.87&lon=151.21&tz=Australia%2FSydney&g=x');
    expect(shareQuery({ ...PRIYA, lat: 0.004, lon: -0.004 })).toContain('lat=0.00&lon=0.00');
    const kundli = toShareUrl(PRIYA, 'https://example.org/site', 'kundli', { ay: 'kp', nd: 'true', st: 'south', n: 'Priya' });
    expect(kundli).toBe('https://example.org/site/kundli/?v=1&d=19980314&t=0642&a=0&lat=26.85&lon=80.95&tz=Asia%2FKolkata&g=f&ay=kp&nd=true&st=south&n=Priya');
    const pk = parseShareUrl(kundli, { nowMs: NOW });
    expect(pk.kind).toBe('kundli');
    expect(pk.extras).toEqual({ ay: 'kp', nd: 'true', st: 'south', n: 'Priya' });
    expect(() => toShareUrl(PRIYA, undefined, 'm', { n: 'Priya' })).toThrow(ShareUrlError);
  });

  it('parses the shubhvela:// deep links and bare queries with one schema; rejects kundli extras on /m/', () => {
    const deep = toDeepLink(PRIYA);
    expect(deep).toBe('shubhvela://m?v=1&d=19980314&t=0642&a=0&lat=26.85&lon=80.95&tz=Asia%2FKolkata&g=f');
    expect(parseShareUrl(deep, { nowMs: NOW }).payload).toEqual({ v: 1, ...PRIYA });
    const deepK = toDeepLink(PRIYA, 'kundli', { st: 'east' });
    expect(deepK.startsWith('shubhvela://kundli?')).toBe(true);
    expect(parseShareUrl(deepK, { nowMs: NOW })).toMatchObject({ kind: 'kundli', extras: { st: 'east' } });
    expect(parseShareUrl('v=1&d=19980314&t=u&a=15&lat=26.85&lon=80.95&tz=Asia/Calcutta&g=m', { nowMs: NOW }).payload).toEqual({ v: 1, date: '1998-03-14', time: null, approx: 15, lat: 26.85, lon: 80.95, tz: 'Asia/Kolkata', gender: 'm' });
    expect(() => parseShareUrl('https://sudish007.github.io/shubhvela/m/?v=1&d=19980314&t=0642&a=0&lat=26.85&lon=80.95&tz=Asia%2FKolkata&g=f&ay=kp', { nowMs: NOW })).toThrow(expect.objectContaining({ code: 'extras-not-allowed' }));
    expect(() => parseShareUrl('shubhvela://m?v=1&d=19980314&t=0642&a=0&lat=26.85&lon=80.95&tz=Asia%2FKolkata&g=f&n=Priya', { nowMs: NOW })).toThrow(expect.objectContaining({ code: 'extras-not-allowed' }));
    // The caller can force the extras policy.
    expect(parseShareUrl('/m/?v=1&d=19980314&t=0642&a=0&lat=26.85&lon=80.95&tz=Asia%2FKolkata&g=f&st=north', { nowMs: NOW, allowKundliExtras: true }).extras).toEqual({ st: 'north' });
  });

  it('validates every field with the design 11 rules', () => {
    const base = 'd=19980314&t=0642&a=0&lat=26.85&lon=80.95&tz=Asia%2FKolkata&g=f';
    const bad = (q: string, code: string) => expect(() => parseShareUrl(q, { nowMs: NOW })).toThrow(expect.objectContaining({ code }));
    bad(`v=2&${base}`, 'version');
    bad(base, 'version');
    bad('v=1&d=1998314&t=0642&a=0&lat=26.85&lon=80.95&tz=Asia%2FKolkata', 'date');
    bad('v=1&d=18991231&t=0642&a=0&lat=26.85&lon=80.95&tz=Asia%2FKolkata', 'date');
    bad('v=1&d=20270101&t=0642&a=0&lat=26.85&lon=80.95&tz=Asia%2FKolkata', 'date');
    bad('v=1&d=19980230&t=0642&a=0&lat=26.85&lon=80.95&tz=Asia%2FKolkata', 'date');
    bad('v=1&d=19980314&t=2460&a=0&lat=26.85&lon=80.95&tz=Asia%2FKolkata', 'time');
    bad('v=1&d=19980314&t=642&a=0&lat=26.85&lon=80.95&tz=Asia%2FKolkata', 'time');
    bad('v=1&d=19980314&t=0642&a=20&lat=26.85&lon=80.95&tz=Asia%2FKolkata', 'approx');
    bad('v=1&d=19980314&t=0642&a=0&lat=91&lon=80.95&tz=Asia%2FKolkata', 'lat');
    bad('v=1&d=19980314&t=0642&a=0&lat=26.85&lon=-181&tz=Asia%2FKolkata', 'lon');
    bad('v=1&d=19980314&t=0642&a=0&lat=26.85&lon=80.95&tz=Nowhere%2FCity', 'tz');
    bad('v=1&d=19980314&t=0642&a=0&lat=26.85&lon=80.95&tz=Asia%2FKolkata&g=q', 'gender');
    bad(`v=1&${base}&ay=fagan`, 'extras-not-allowed');
    expect(() => parseShareUrl(`https://sudish007.github.io/shubhvela/kundli/?v=1&${base}&ay=fagan`, { nowMs: NOW })).toThrow(expect.objectContaining({ code: 'extra' }));
    expect(() => parseShareUrl(`https://sudish007.github.io/shubhvela/kundli/?v=1&${base}&n=${'x'.repeat(41)}`, { nowMs: NOW })).toThrow(expect.objectContaining({ code: 'extra' }));
    expect(() => parseShareUrl('https://sudish007.github.io/shubhvela/panchang/delhi/?v=1', { nowMs: NOW })).toThrow(expect.objectContaining({ code: 'path' }));
    // Gender defaults to x when absent.
    expect(parseShareUrl(`v=1&d=19980314&t=0642&a=0&lat=26.85&lon=80.95&tz=Asia%2FKolkata`, { nowMs: NOW }).payload.gender).toBe('x');
  });

  it('a decoded payload computes the same chart as the typed birth', () => {
    const p = decodeShareCode(encodeShareCode(PRIYA));
    const fromCode = computeChart(birthFromPayload(p));
    const direct = computeChart({ date: '1998-03-14', time: '06:42', tz: 'Asia/Kolkata', lat: 26.85, lon: 80.95 });
    expect(fromCode.planets.map((x) => x.longitude)).toEqual(direct.planets.map((x) => x.longitude));
    expect(fromCode.lagna!.sign).toBe(direct.lagna!.sign);
    const unknown = birthFromPayload({ ...p, time: null });
    expect(unknown.timeUnknown).toBe(true);
    expect(unknown.time).toBeUndefined();
  });
});
