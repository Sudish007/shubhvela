import { describe, expect, it } from 'vitest';
import {
  CHOGHADIYA_ORDER,
  DAY_SEQUENCES,
  NIGHT_CHOGHADIYA_ORDER,
  NIGHT_SEQUENCES,
} from '../vendor/jyotish/src/core/muhurta/choghadiya';
import { HORA_ORDER, VARA_LORDS, panchang } from '../src/panchang/panchang';
import { goodHours } from '../src/panchang/goodHours';
import { formatInZone } from '../src/tz/index';

const ZONE = 'Asia/Kolkata';
const LUCKNOW = { lat: 26.85, lon: 80.95 };
const hm = (ms: number) => formatInZone(ms, ZONE, 'HH:mm');

/** Choghadiya lord table: each choghadiya is named after a planet; the cycle is the hora-lord order. */
const LORD_OF: Record<string, string> = {
  Udveg: 'Su',
  Chal: 'Ve',
  Labh: 'Me',
  Amrit: 'Mo',
  Kaal: 'Sa',
  Shubh: 'Ju',
  Rog: 'Ma',
};

function rotation(cycle: readonly string[], startIdx: number): string[] {
  return Array.from({ length: 8 }, (_, i) => cycle[(startIdx + i) % 7]);
}

describe('choghadiya weekday tables (Phase A review B1: Shubh/Rog swap)', () => {
  it('the day cycle is the hora-lord order Sun > Venus > Mercury > Moon > Saturn > Jupiter > Mars', () => {
    expect(CHOGHADIYA_ORDER.map((c) => LORD_OF[c])).toEqual([...HORA_ORDER]);
    expect(CHOGHADIYA_ORDER).toEqual(['Udveg', 'Chal', 'Labh', 'Amrit', 'Kaal', 'Shubh', 'Rog']);
  });

  it('every day row is the 8-slot rotation of the day cycle starting at the weekday lord', () => {
    for (let vara = 0; vara < 7; vara++) {
      const lord = VARA_LORDS[vara];
      const start = CHOGHADIYA_ORDER.findIndex((c) => LORD_OF[c] === lord);
      expect(start, `weekday ${vara}`).toBeGreaterThanOrEqual(0);
      expect(DAY_SEQUENCES[vara], `weekday ${vara}`).toEqual(rotation(CHOGHADIYA_ORDER, start));
      expect(DAY_SEQUENCES[vara][7]).toBe(DAY_SEQUENCES[vara][0]);
    }
  });

  it('every night row is the 8-slot rotation of Shubh, Amrit, Chal, Rog, Kaal, Labh, Udveg starting at the 5th lord', () => {
    for (let vara = 0; vara < 7; vara++) {
      // The night cycle = every 5th planet of the day cycle; it starts at the choghadiya 4 steps on from the day start.
      const dayStart = CHOGHADIYA_ORDER.indexOf(DAY_SEQUENCES[vara][0]);
      const nightStartName = CHOGHADIYA_ORDER[(dayStart + 5) % 7];
      const start = NIGHT_CHOGHADIYA_ORDER.indexOf(nightStartName);
      expect(NIGHT_SEQUENCES[vara], `weekday ${vara}`).toEqual(rotation(NIGHT_CHOGHADIYA_ORDER, start));
      expect(NIGHT_SEQUENCES[vara][7]).toBe(NIGHT_SEQUENCES[vara][0]);
    }
  });

  it('matches the published Sun/Mon/Wed/Fri rows (Drik Panchang / Prokerala tables)', () => {
    expect(DAY_SEQUENCES[0]).toEqual(['Udveg', 'Chal', 'Labh', 'Amrit', 'Kaal', 'Shubh', 'Rog', 'Udveg']);
    expect(DAY_SEQUENCES[1]).toEqual(['Amrit', 'Kaal', 'Shubh', 'Rog', 'Udveg', 'Chal', 'Labh', 'Amrit']);
    expect(DAY_SEQUENCES[3]).toEqual(['Labh', 'Amrit', 'Kaal', 'Shubh', 'Rog', 'Udveg', 'Chal', 'Labh']);
    expect(DAY_SEQUENCES[5]).toEqual(['Chal', 'Labh', 'Amrit', 'Kaal', 'Shubh', 'Rog', 'Udveg', 'Chal']);
    // Prokerala, Monday 26 Oct 2026 (Mumbai): Amrut, Kaal, Shubh, Rog, Udveg, Char, Labh, Amrut; night Char, Rog, Kaal, Labh, Udveg, Shubh, Amrut, Char.
    expect(NIGHT_SEQUENCES[1]).toEqual(['Chal', 'Rog', 'Kaal', 'Labh', 'Udveg', 'Shubh', 'Amrit', 'Chal']);
  });

  it('Sunday 25 Oct 2026 at Lucknow: the 6th day choghadiya is Shubh (good) and the 7th Rog (avoid)', () => {
    const p = panchang('2026-10-25', LUCKNOW, ZONE);
    expect(p.vara).toBe(0);
    expect(p.choghadiya.day.map((c) => c.name)).toEqual(DAY_SEQUENCES[0]);
    const gh = goodHours('2026-10-25', LUCKNOW, ZONE);
    const six = gh.segments.find((s) => s.id === 'chog-day-6')!;
    const seven = gh.segments.find((s) => s.id === 'chog-day-7')!;
    expect(six.name).toBe('choghadiya-shubh');
    expect(six.nature).toBe('good');
    expect(hm(six.start)).toBe('13:14');
    expect(hm(six.end)).toBe('14:39');
    expect(seven.name).toBe('choghadiya-rog');
    expect(seven.verdict).toBe('avoid');
    // Sunday Rahu Kaal is the 8th eighth, Yamaganda the 5th and Gulika the 7th: the 6th eighth is free of every kaal,
    // so the whole Shubh segment stays good in the merged band.
    expect(six.verdict).toBe('good');
    expect(six.overriddenBy ?? []).toEqual([]);
  });
});
