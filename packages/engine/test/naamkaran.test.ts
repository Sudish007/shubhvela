// F28: 27 x 4 syllables, Devanagari + Latin, the classical table spot-checked, chart lookup from the Moon.
import { describe, expect, it } from 'vitest';
import { computeChart } from '../src/kundli/index';
import { NAAMKARAN_RULE_ID, allSyllables, syllables, syllablesForChart } from '../src/naamkaran/index';

describe('naamkaran syllables (F28)', () => {
  it('has 108 entries, every syllable Devanagari with a Latin form, no duplicates inside a nakshatra', () => {
    const all = allSyllables();
    expect(all).toHaveLength(108);
    for (const s of all) {
      expect(s.syllable.devanagari).toMatch(/^[\u0900-\u097F]+$/);
      expect(s.syllable.latin).toMatch(/^[A-Z][a-z]*$/);
    }
    for (let n = 1; n <= 27; n++) {
      const row = all.filter((s) => s.nakshatra === n);
      expect(row.map((s) => s.pada)).toEqual([1, 2, 3, 4]);
      expect(new Set(row.map((s) => s.syllable.devanagari)).size).toBe(4);
    }
  });

  it('matches the classical table on spot checks', () => {
    expect(syllables(1, 1).syllable).toEqual({ devanagari: 'चु', latin: 'Chu' });
    expect(syllables(1, 4).syllable).toEqual({ devanagari: 'ला', latin: 'La' });
    expect(syllables(3, 1).syllable).toEqual({ devanagari: 'अ', latin: 'A' });
    expect(syllables(8, 4).syllable).toEqual({ devanagari: 'डा', latin: 'Da' });
    expect(syllables(12, 4).syllable).toEqual({ devanagari: 'पी', latin: 'Pi' });
    expect(syllables(19, 3).syllable).toEqual({ devanagari: 'भा', latin: 'Bha' });
    expect(syllables(27, 4).syllable).toEqual({ devanagari: 'ची', latin: 'Chi' });
    expect(syllables(13, 2).nakshatraSyllables.map((s) => s.devanagari)).toEqual(['पू', 'ष', 'ण', 'ठ']);
    expect(syllables(5, 2).ruleId).toBe(NAAMKARAN_RULE_ID);
    expect(() => syllables(0, 1)).toThrow();
    expect(() => syllables(28, 1)).toThrow();
    expect(() => syllables(1, 5)).toThrow();
  });

  it('reads the Moon nakshatra and pada from a chart (Priya: Uttara Phalguni 4 -> Pi)', () => {
    const chart = computeChart({ date: '1998-03-14', time: '06:42', tz: 'Asia/Kolkata', lat: 26.85, lon: 80.95 });
    const r = syllablesForChart(chart);
    expect(r.nakshatra).toBe(12);
    expect(r.pada).toBe(4);
    expect(r.syllable.latin).toBe('Pi');
  });
});
