// Chart as an SVG string for the report HTML (design.md 4, 10.6 F31): the SAME engine chart-layout the app's Chart
// component draws from, so the PDF chart has the same geometry, density modes and label rules. Colours are the light
// palette (paper/ink/accent only); fonts are the embedded faces (app/src/pdf/fonts.ts).
import { layout, type ChartData, type ChartStyle } from '@shubhvela/engine';
import type { Lang } from '../i18n';
import { colors } from '../theme/tokens';
import { PDF_FAMILY } from './fonts';

export interface ChartSvgOptions {
  lang: Lang;
  /** Rendered width in CSS px (the layout computes text sizes from it, 12 px floor). */
  width?: number;
  centreLines?: string[];
  /** Accessible title (<title>) for the SVG. */
  title?: string;
}

export function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

/** The chart in the chosen style as an inline SVG string (viewBox 0 0 320 320, width = `width` px). */
export function chartSvg(style: ChartStyle, chart: ChartData, opts: ChartSvgOptions): string {
  const width = opts.width ?? 320;
  const lay = layout(style, chart, 1, width, { lang: opts.lang, centreLines: opts.centreLines });
  const c = colors.light;
  const glyphFamily = opts.lang === 'en' ? PDF_FAMILY.sans : PDF_FAMILY.display;
  const glyphWeight = opts.lang === 'en' ? 600 : 400;
  const parts: string[] = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320" width="${fmt(width)}" height="${fmt(width)}" role="img">`);
  if (opts.title) parts.push(`<title>${escapeXml(opts.title)}</title>`);
  parts.push(`<rect x="${lay.frame.x}" y="${lay.frame.y}" width="${lay.frame.width}" height="${lay.frame.height}" fill="${c.surface}" stroke="${c.ink}" stroke-width="1.5"/>`);
  for (const g of lay.grid) parts.push(`<line x1="${fmt(g.x1)}" y1="${fmt(g.y1)}" x2="${fmt(g.x2)}" y2="${fmt(g.y2)}" stroke="${c.ink}" stroke-width="1"/>`);
  if (lay.lagnaMark) parts.push(`<line x1="${fmt(lay.lagnaMark.x1)}" y1="${fmt(lay.lagnaMark.y1)}" x2="${fmt(lay.lagnaMark.x2)}" y2="${fmt(lay.lagnaMark.y2)}" stroke="${c.accent}" stroke-width="2"/>`);
  for (const l of lay.labels) {
    const family = l.kind === 'signName' && opts.lang !== 'en' ? PDF_FAMILY.devanagari : PDF_FAMILY.sans;
    const fill = l.kind === 'centre' ? c.ink2 : c.ink3;
    parts.push(`<text x="${fmt(l.anchorX)}" y="${fmt(l.baseline)}" font-size="${fmt(l.size)}" text-anchor="${l.anchor}" fill="${fill}" font-family="'${family}'">${escapeXml(l.text)}</text>`);
  }
  for (const g of lay.glyphs) {
    parts.push(`<text x="${fmt(g.anchorX)}" y="${fmt(g.baseline)}" font-size="${fmt(g.size)}" text-anchor="${g.anchor}" fill="${g.approx ? c.indigo : c.ink}" font-family="'${glyphFamily}'" font-weight="${glyphWeight}">${escapeXml(g.text)}</text>`);
  }
  for (const b of lay.badges) {
    parts.push(`<text x="${fmt(b.anchorX)}" y="${fmt(b.baseline)}" font-size="${fmt(b.size)}" text-anchor="${b.anchor}" fill="${c.ink2}" font-family="'${PDF_FAMILY.sans}'">${escapeXml(b.text)}</text>`);
  }
  parts.push('</svg>');
  return parts.join('');
}
