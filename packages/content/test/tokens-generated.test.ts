// The committed app/src/theme/tokens.ts, web/src/tokens.css and ui/token-contrast.json equal a fresh generation.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PATHS, checkOutputs, contrastJson, generate, loadTokens, normaliseEol } from '../scripts/gen-tokens';

describe('generated token outputs are current', () => {
  const g = generate(loadTokens());

  it('tokens.ts, tokens.css and token-contrast.json match (run: npx tsx packages/content/scripts/gen-tokens.ts)', () => {
    expect(checkOutputs(g)).toEqual([]);
    expect(normaliseEol(readFileSync(PATHS.tokensTs, 'utf8'))).toBe(normaliseEol(g.tokensTs));
    expect(normaliseEol(readFileSync(PATHS.tokensCss, 'utf8'))).toBe(normaliseEol(g.tokensCss));
    expect(normaliseEol(readFileSync(PATHS.contrast, 'utf8'))).toBe(normaliseEol(contrastJson(g.contrast)));
  });

  it('tokens.ts exposes the typed API the app relies on', () => {
    expect(g.tokensTs).toMatch(/export const colors: Record<ThemeName, Record<ColorToken, string>>/);
    expect(g.tokensTs).toMatch(/export const TYPE_SIZES = \[26, 22, 20, 18, 17, 15, 13, 12\] as const;/);
    expect(g.tokensTs).toMatch(/export function bottomPaddingAboveBanner/);
    expect(g.tokensTs).not.toMatch(/bannerStrip:/);
    expect(g.tokensTs).toMatch(/bannerPadding: 16/);
  });

  it('tokens.css has :root and html[data-theme="dark"] blocks with every colour and no gradient', () => {
    expect(g.tokensCss).toMatch(/^:root\{--paper:#FAF7F2;/m);
    expect(g.tokensCss).toMatch(/^html\[data-theme="dark"\]\{--paper:#15130F;/m);
    expect(g.tokensCss).not.toMatch(/linear-gradient|radial-gradient|box-shadow/);
    expect(g.tokensCss).toMatch(/--font-floor:12px/);
    expect(g.tokensCss).toMatch(/--size-control:44px/);
  });
});
