// Token contrast (design.md 2.1 / 12): recompute the WCAG ratio of every contrastPairs entry in both themes.
import { describe, expect, it } from 'vitest';
import { contrastRatio, contrastReport, generate, loadTokens, validate, type DesignTokens } from '../scripts/gen-tokens';

const tokens = loadTokens();

describe('design tokens', () => {
  it('every contrast pair meets its minimum in light and dark', () => {
    const report = contrastReport(tokens);
    const failing = report.pairs.filter((p) => p.light < p.min || p.dark < p.min);
    expect(failing, JSON.stringify(failing)).toEqual([]);
    expect(report.pairs.length).toBe(tokens.contrastPairs.length);
    expect(report.pairs.length).toBe(22);
  });

  it('matches the ratios recorded in design.md 2.1 for the headline pairs', () => {
    const c = tokens.color;
    expect(contrastRatio(c.ink.light, c.surface.light)).toBe(17.36);
    expect(contrastRatio(c.ink.dark, c.surface.dark)).toBe(14.83);
    expect(contrastRatio(c['ink-3'].light, c.surface.light)).toBe(5.43);
    expect(contrastRatio(c.good.light, c.neutral.light)).toBe(3.11);
    expect(contrastRatio(c.night.dark, c.neutral.dark)).toBe(3.22);
    expect(contrastRatio(c['avoid-hatch'].light, c.avoid.light)).toBe(3.99);
    expect(contrastRatio(c.accent.light, c['accent-tint'].light)).toBe(4.83);
    expect(contrastRatio('#FFFFFF', '#000000')).toBe(21);
  });

  it('every type size is on the scale {26,22,20,18,17,15,13,12} and nothing is below 12', () => {
    expect(tokens.type.sizes).toEqual([26, 22, 20, 18, 17, 15, 13, 12]);
    for (const s of Object.values(tokens.type.scale)) expect(tokens.type.sizes).toContain(s.size);
    expect(Math.min(...tokens.type.sizes)).toBe(12);
    expect(tokens.type.chart.signNumeral).toBeGreaterThanOrEqual(12);
  });

  it('review fixes N7 and M6 are in the file', () => {
    expect(tokens.type.scale.micro.note).not.toMatch(/band label/);
    expect(tokens.type.scale.caption.note).toMatch(/inline band labels/);
    expect('bannerStrip' in tokens.size).toBe(false);
    expect(tokens.size.bannerPadding).toBe(16);
    expect(String(tokens.size.bottomPaddingAboveBanner)).not.toMatch(/82/);
    expect(String(tokens.size.bottomPaddingAboveBanner)).toMatch(/bannerPadding/);
  });

  it('the generator rejects an off-scale type size (N7)', () => {
    const bad: DesignTokens = JSON.parse(JSON.stringify(tokens));
    bad.type.scale.label.size = 14;
    expect(() => validate(bad)).toThrow(/not in the scale/);
    expect(() => generate(bad)).toThrow(/not in the scale/);
    const low: DesignTokens = JSON.parse(JSON.stringify(tokens));
    low.type.sizes.push(11);
    low.type.scale.micro.size = 11;
    expect(() => validate(low)).toThrow(/12 sp floor/);
  });

  it('the generator rejects a reintroduced fixed banner strip (M6) and a failing contrast pair', () => {
    const strip: DesignTokens = JSON.parse(JSON.stringify(tokens));
    strip.size.bannerStrip = 82;
    expect(() => validate(strip)).toThrow(/bannerStrip/);
    const dim: DesignTokens = JSON.parse(JSON.stringify(tokens));
    dim.color['ink-3'].light = '#BBBBBB';
    expect(() => generate(dim)).toThrow(/contrast failure/);
  });
});
