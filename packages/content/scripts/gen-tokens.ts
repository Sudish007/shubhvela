// Token generator (design.md 2, plan A05, review items N7 + M6).
// Reads packages/content/ui/design-tokens.json and writes
//   app/src/theme/tokens.ts            typed colour tokens (light/dark), type scale, space, radius, size
//   web/src/tokens.css                 :root and [data-theme="dark"] custom properties (+ hatch/dot SVG patterns)
//   packages/content/ui/token-contrast.json   WCAG 2.x contrast of every contrastPairs entry in both themes
// Usage (from the repo root):  npx tsx packages/content/scripts/gen-tokens.ts [--check]
//   --check  regenerates in memory and exits 1 when any committed output differs (used by CI and the tests).
// The generator THROWS when a type style's size is outside the scale (N7) or when a contrast pair misses its minimum.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface ColorToken {
  light: string;
  dark: string;
  use?: string;
}
export interface TypeStyle {
  size: number;
  line: number;
  lineDevanagari?: number;
  weight: number;
  family: 'display' | 'body';
  note?: string;
}
export interface DesignTokens {
  color: Record<string, ColorToken>;
  contrastPairs: [string, string, number][];
  type: {
    families: Record<string, string>;
    sizes: number[];
    scale: Record<string, TypeStyle>;
    chart: { signNumeral: number; glyphLatin: number; glyphDevanagari: number; note?: string };
  };
  space: number[];
  radius: Record<string, number>;
  size: Record<string, number | string>;
}

export type Theme = 'light' | 'dark';
export const THEMES: readonly Theme[] = ['light', 'dark'];

export interface ContrastRow {
  fg: string;
  bg: string;
  min: number;
  light: number;
  dark: number;
}
export interface ContrastReport {
  pairs: ContrastRow[];
  failures: number;
}
export interface Generated {
  tokensTs: string;
  tokensCss: string;
  contrast: ContrastReport;
}

const HERE = dirname(fileURLToPath(import.meta.url));
export const PATHS = {
  tokens: resolve(HERE, '../ui/design-tokens.json'),
  tokensTs: resolve(HERE, '../../../app/src/theme/tokens.ts'),
  tokensCss: resolve(HERE, '../../../web/src/tokens.css'),
  contrast: resolve(HERE, '../ui/token-contrast.json'),
};

// ---------------------------------------------------------------- colour maths (WCAG 2.x)
function channel(v: number): number {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** Parses #rrggbb or rgba(r,g,b,a); alpha is ignored for luminance (scrim is never a text pair). */
export function rgb(colour: string): [number, number, number] {
  const hex = /^#([0-9a-f]{6})$/i.exec(colour.trim());
  if (hex) {
    const h = hex[1];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  const fn = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(colour.trim());
  if (fn) return [Number(fn[1]), Number(fn[2]), Number(fn[3])];
  throw new Error(`gen-tokens: cannot parse colour "${colour}"`);
}

export function luminance(colour: string): number {
  const [r, g, b] = rgb(colour);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** Contrast ratio rounded to 2 decimals, identical to the mocks' _tokens.js so the numbers match design.md 2.1. */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
}

// ---------------------------------------------------------------- validation
export function validate(t: DesignTokens): void {
  const scale = new Set(t.type.sizes);
  for (const [name, st] of Object.entries(t.type.scale)) {
    if (!scale.has(st.size)) {
      throw new Error(`gen-tokens: type style "${name}" has size ${st.size}, which is not in the scale {${t.type.sizes.join(',')}} (N7)`);
    }
    if (st.size < 12) throw new Error(`gen-tokens: type style "${name}" is below the 12 sp floor`);
    if (st.line < st.size) throw new Error(`gen-tokens: type style "${name}" has line ${st.line} < size ${st.size}`);
  }
  const floor = Math.min(...t.type.sizes);
  for (const [k, v] of Object.entries(t.type.chart)) {
    if (typeof v === 'number' && v < floor) throw new Error(`gen-tokens: chart text "${k}" (${v}) is below the ${floor} floor`);
  }
  for (const [fg, bg] of t.contrastPairs) {
    if (!t.color[fg]) throw new Error(`gen-tokens: contrast pair names unknown colour "${fg}"`);
    if (!t.color[bg]) throw new Error(`gen-tokens: contrast pair names unknown colour "${bg}"`);
  }
  if ('bannerStrip' in t.size) throw new Error('gen-tokens: size.bannerStrip must not exist (M6: strip = measured banner + 2 x bannerPadding)');
  if (t.size.bannerPadding !== 16) throw new Error('gen-tokens: size.bannerPadding must be 16 (M6)');
}

export function contrastReport(t: DesignTokens): ContrastReport {
  const pairs: ContrastRow[] = [];
  let failures = 0;
  for (const [fg, bg, min] of t.contrastPairs) {
    const row: ContrastRow = { fg, bg, min, light: contrastRatio(t.color[fg].light, t.color[bg].light), dark: contrastRatio(t.color[fg].dark, t.color[bg].dark) };
    if (row.light < min) failures++;
    if (row.dark < min) failures++;
    pairs.push(row);
  }
  return { pairs, failures };
}

// ---------------------------------------------------------------- emitters
const camel = (s: string): string => s.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase());
const q = (s: string): string => `'${s.replace(/'/g, "\\'")}'`;

function tsTokens(t: DesignTokens): string {
  const colourNames = Object.keys(t.color);
  const styleNames = Object.keys(t.type.scale);
  const out: string[] = [];
  out.push('// GENERATED by packages/content/scripts/gen-tokens.ts from packages/content/ui/design-tokens.json.');
  out.push('// Do not edit: run `npx tsx packages/content/scripts/gen-tokens.ts` (test/tokens-generated.test.ts asserts this file is current).');
  out.push('// design.md 2: one palette, one type pairing, hairlines instead of shadows; nothing renders below 12 sp.');
  out.push('');
  out.push(`export type ThemeName = ${THEMES.map(q).join(' | ')};`);
  out.push(`export const THEMES: readonly ThemeName[] = [${THEMES.map(q).join(', ')}];`);
  out.push('');
  out.push(`export type ColorToken = ${colourNames.map((n) => q(camel(n))).join(' | ')};`);
  out.push('');
  out.push('export const colors: Record<ThemeName, Record<ColorToken, string>> = {');
  for (const theme of THEMES) {
    out.push(`  ${theme}: {`);
    for (const n of colourNames) out.push(`    ${camel(n)}: ${q(t.color[n][theme])},`);
    out.push('  },');
  }
  out.push('};');
  out.push('');
  out.push('/** What each colour is for (design.md 2.1); kept so reviewers can grep usage against intent. */');
  out.push('export const colorUse: Record<ColorToken, string> = {');
  for (const n of colourNames) out.push(`  ${camel(n)}: ${q(t.color[n].use ?? '')},`);
  out.push('};');
  out.push('');
  out.push(`export type FontFamilyRole = ${Object.keys(t.type.families).map((k) => q(camel(k))).join(' | ')};`);
  out.push('export const fontFamilies: Record<FontFamilyRole, string> = {');
  for (const [k, v] of Object.entries(t.type.families)) out.push(`  ${camel(k)}: ${q(v)},`);
  out.push('};');
  out.push('');
  out.push('/** Every size an sp value may take; the generator rejects anything else (N7). */');
  out.push(`export const TYPE_SIZES = [${t.type.sizes.join(', ')}] as const;`);
  out.push('export type TypeSize = (typeof TYPE_SIZES)[number];');
  out.push(`export const FONT_FLOOR: TypeSize = ${Math.min(...t.type.sizes)};`);
  out.push('');
  out.push(`export type TypeStyleName = ${styleNames.map((n) => q(camel(n))).join(' | ')};`);
  out.push('export interface TypeStyle {');
  out.push('  size: TypeSize;');
  out.push('  line: number;');
  out.push('  /** Line height for Devanagari body text (design.md 7: 28 vs 26); equals `line` for every other style. */');
  out.push('  lineDevanagari: number;');
  out.push('  weight: 400 | 600;');
  out.push(`  family: 'display' | 'body';`);
  out.push('}');
  out.push('export const type: Record<TypeStyleName, TypeStyle> = {');
  for (const n of styleNames) {
    const s = t.type.scale[n];
    out.push(`  ${camel(n)}: { size: ${s.size}, line: ${s.line}, lineDevanagari: ${s.lineDevanagari ?? s.line}, weight: ${s.weight}, family: ${q(s.family)} },`);
  }
  out.push('};');
  out.push('');
  out.push('/** Chart text in SVG user units at viewBox 320 (design.md 4), scaled by fontScale / (renderedWidth / 320). */');
  out.push(`export const chartText = { signNumeral: ${t.type.chart.signNumeral}, glyphLatin: ${t.type.chart.glyphLatin}, glyphDevanagari: ${t.type.chart.glyphDevanagari} } as const;`);
  out.push('');
  out.push('/** Spacing scale in dp: 4 · 8 · 12 · 16 · 20 · 24 · 32 (gutter 16, card padding 16, card gap 12, row padding 8, chip gap 8). */');
  out.push(`export const space = [${t.space.join(', ')}] as const;`);
  out.push('export type Space = (typeof space)[number];');
  out.push('');
  out.push(`export type RadiusToken = ${Object.keys(t.radius).map((k) => q(camel(k))).join(' | ')};`);
  out.push('export const radius: Record<RadiusToken, number> = {');
  for (const [k, v] of Object.entries(t.radius)) out.push(`  ${camel(k)}: ${v},`);
  out.push('};');
  out.push('');
  const numericSizes = Object.entries(t.size).filter(([, v]) => typeof v === 'number') as [string, number][];
  const formulaSizes = Object.entries(t.size).filter(([, v]) => typeof v === 'string') as [string, string][];
  out.push('/** Fixed chrome in dp. The banner strip has NO fixed height (M6): it is the measured banner + 2 x bannerPadding. */');
  out.push(`export type SizeToken = ${numericSizes.map(([k]) => q(camel(k))).join(' | ')};`);
  out.push('export const size: Record<SizeToken, number> = {');
  for (const [k, v] of numericSizes) out.push(`  ${camel(k)}: ${v},`);
  out.push('};');
  out.push('');
  out.push('/** Padding formulas owned by the Screen component (design.md 2.3); kept as text so the rule is not typed twice. */');
  out.push('export const sizeFormula = {');
  for (const [k, v] of formulaSizes) out.push(`  ${camel(k)}: ${q(v)},`);
  out.push('} as const;');
  out.push('');
  out.push('/** Bottom padding of scroll content above the tab bar and an optional banner strip (M6, N15). */');
  out.push('export function bottomPaddingAboveBanner(measuredBannerHeight: number | null, safeAreaBottom: number): number {');
  out.push('  const strip = measuredBannerHeight == null ? 0 : measuredBannerHeight + 2 * size.bannerPadding;');
  out.push('  return size.tabBar + strip + 16 + safeAreaBottom;');
  out.push('}');
  out.push('');
  out.push('/** Bottom padding of scroll content above a sticky CTA that reported its height with onLayout. */');
  out.push('export function bottomPaddingAboveStickyCta(ctaHeight: number, safeAreaBottom: number): number {');
  out.push('  return ctaHeight + 16 + safeAreaBottom;');
  out.push('}');
  out.push('');
  return out.join('\n');
}

const encodeHash = (hex: string): string => hex.replace('#', '%23');

function cssBlock(t: DesignTokens, theme: Theme): string {
  const c = t.color;
  const vars: string[] = [];
  for (const n of Object.keys(c)) vars.push(`--${n}:${c[n][theme]}`);
  vars.push(`--hatch:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='8' height='8'><path d='M-2 2L2 -2M0 8L8 0M6 10L10 6' stroke='${encodeHash(c['avoid-hatch'][theme])}' stroke-width='1.4'/></svg>")`);
  vars.push(`--hatch-night:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='8' height='8'><path d='M-2 2L2 -2M0 8L8 0M6 10L10 6' stroke='${encodeHash(c['night-ink'][theme])}' stroke-opacity='.85' stroke-width='1.4'/></svg>")`);
  vars.push(`--dots:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='6' height='6'><circle cx='3' cy='3' r='1.1' fill='${encodeHash(c['good-ink'][theme])}'/></svg>")`);
  vars.push(`--dots-night:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='6' height='6'><circle cx='3' cy='3' r='1.1' fill='${encodeHash(c['night-ink'][theme])}' fill-opacity='.85'/></svg>")`);
  return vars.join(';');
}

function cssTokens(t: DesignTokens): string {
  const out: string[] = [];
  out.push('/* GENERATED by packages/content/scripts/gen-tokens.ts from packages/content/ui/design-tokens.json. Do not edit. */');
  out.push('/* design.md 2 + 9: light is the first paint; dark only via the persisted toggle (html[data-theme="dark"]). No gradients, no shadows. */');
  const shared: string[] = [];
  for (const [k, v] of Object.entries(t.type.families)) shared.push(`--font-${k}:${q(v).replace(/'/g, '"')}`);
  for (const [n, s] of Object.entries(t.type.scale)) {
    shared.push(`--type-${n}-size:${s.size}px`);
    shared.push(`--type-${n}-line:${s.line}px`);
    if (s.lineDevanagari !== undefined) shared.push(`--type-${n}-line-devanagari:${s.lineDevanagari}px`);
    shared.push(`--type-${n}-weight:${s.weight}`);
  }
  shared.push(`--font-floor:${Math.min(...t.type.sizes)}px`);
  t.space.forEach((v, i) => shared.push(`--space-${i + 1}:${v}px`));
  for (const [k, v] of Object.entries(t.radius)) shared.push(`--radius-${k}:${v}px`);
  for (const [k, v] of Object.entries(t.size)) if (typeof v === 'number') shared.push(`--size-${k}:${v}px`);
  out.push(`:root{${cssBlock(t, 'light')};${shared.join(';')}}`);
  out.push(`html[data-theme="dark"]{${cssBlock(t, 'dark')}}`);
  out.push('');
  return out.join('\n');
}

// ---------------------------------------------------------------- public API
export function generate(t: DesignTokens): Generated {
  validate(t);
  const contrast = contrastReport(t);
  if (contrast.failures > 0) {
    const bad = contrast.pairs.filter((p) => p.light < p.min || p.dark < p.min).map((p) => `${p.fg}/${p.bg} >= ${p.min}: light ${p.light}, dark ${p.dark}`);
    throw new Error(`gen-tokens: ${contrast.failures} contrast failure(s): ${bad.join('; ')}`);
  }
  return { tokensTs: tsTokens(t), tokensCss: cssTokens(t), contrast };
}

export function loadTokens(path: string = PATHS.tokens): DesignTokens {
  return JSON.parse(readFileSync(path, 'utf8')) as DesignTokens;
}

export const normaliseEol = (s: string): string => s.replace(/\r\n/g, '\n');

export function contrastJson(report: ContrastReport): string {
  return JSON.stringify({ $comment: 'GENERATED by gen-tokens.ts: WCAG contrast of every contrastPairs entry in both themes (design.md 2.1).', ...report }, null, 2) + '\n';
}

/** Returns the list of output files whose committed content differs from a fresh generation. */
export function checkOutputs(g: Generated): string[] {
  const expected: [string, string][] = [
    [PATHS.tokensTs, g.tokensTs],
    [PATHS.tokensCss, g.tokensCss],
    [PATHS.contrast, contrastJson(g.contrast)],
  ];
  const stale: string[] = [];
  for (const [path, content] of expected) {
    if (!existsSync(path) || normaliseEol(readFileSync(path, 'utf8')) !== normaliseEol(content)) stale.push(path);
  }
  return stale;
}

function main(argv: string[]): number {
  const g = generate(loadTokens());
  if (argv.includes('--check')) {
    const stale = checkOutputs(g);
    if (stale.length) {
      console.error('gen-tokens --check: stale outputs:\n  ' + stale.join('\n  ') + '\nRun: npx tsx packages/content/scripts/gen-tokens.ts');
      return 1;
    }
    console.log(`gen-tokens --check: ${g.contrast.pairs.length} contrast pairs ok in both themes; tokens.ts, tokens.css and token-contrast.json are current.`);
    return 0;
  }
  writeFileSync(PATHS.tokensTs, g.tokensTs, 'utf8');
  writeFileSync(PATHS.tokensCss, g.tokensCss, 'utf8');
  writeFileSync(PATHS.contrast, contrastJson(g.contrast), 'utf8');
  console.log(`gen-tokens: wrote ${PATHS.tokensTs}, ${PATHS.tokensCss}, ${PATHS.contrast}; ${g.contrast.pairs.length} pairs, ${g.contrast.failures} failures.`);
  return 0;
}

const isCli = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) process.exit(main(process.argv.slice(2)));
