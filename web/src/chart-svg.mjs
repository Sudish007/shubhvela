// Chart as an SVG string from the engine's chart-layout output (design.md 4, 9): the SAME geometry the app's Chart
// component and the PDF chart draw, so the web chart is identical. Pure: takes a ChartLayout (engine `layout()`), returns
// markup. Two modes:
//  - 'web' (default): classes only (.frame .grid .lagna-mark .sign .signname .centre .pl .ap .badge); colours and fonts come
//    from site.css (theme-aware); text sizes are user units exposed as --fs so chart-scale.js can apply --chart-k (M1).
//  - 'standalone': inline fill / font-family / font-size attributes for renderers without CSS (OG images via resvg).
// Shared by the Node templates and the browser bundle (plain ESM, no imports).

function fmt(n) {
  return Number.isInteger(n) ? String(n) : Number(n).toFixed(2).replace(/\.?0+$/, '');
}

export function escapeXml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Light-palette defaults for standalone rendering (tokens design.md 2.1). */
export const LIGHT = {
  surface: '#FFFFFF',
  ink: '#1C1A17',
  ink2: '#5B554C',
  ink3: '#6F6960',
  accent: '#B83E18',
  indigo: '#2E2A6E',
};

/**
 * @param {object} lay   engine ChartLayout (viewBox 320)
 * @param {object} opts  { mode: 'web'|'standalone', lang, title, ariaLabel, width, height, colors, fonts: {sans, display, deva}, extraClass, attrs }
 */
export function chartSvgFromLayout(lay, opts = {}) {
  const mode = opts.mode ?? 'web';
  const lang = opts.lang ?? lay.lang ?? 'en';
  const c = { ...LIGHT, ...(opts.colors ?? {}) };
  const fonts = { sans: "'Noto Sans'", display: "'Tiro Devanagari Hindi'", deva: "'Noto Sans Devanagari'", ...(opts.fonts ?? {}) };
  const latin = lang === 'en';
  const parts = [];
  const attrs = [];
  attrs.push('xmlns="http://www.w3.org/2000/svg"', 'viewBox="0 0 320 320"');
  if (opts.width) attrs.push(`width="${fmt(opts.width)}"`);
  if (opts.height) attrs.push(`height="${fmt(opts.height)}"`);
  if (opts.x !== undefined) attrs.push(`x="${fmt(opts.x)}"`);
  if (opts.y !== undefined) attrs.push(`y="${fmt(opts.y)}"`);
  if (mode === 'web') attrs.push(`class="chart${opts.extraClass ? ' ' + opts.extraClass : ''}"`, 'role="img"');
  if (opts.ariaLabel) attrs.push(`aria-label="${escapeXml(opts.ariaLabel)}"`);
  if (opts.attrs) for (const [k, v] of Object.entries(opts.attrs)) attrs.push(`${k}="${escapeXml(v)}"`);
  parts.push(`<svg ${attrs.join(' ')}>`);
  if (opts.title) parts.push(`<title>${escapeXml(opts.title)}</title>`);

  const f = lay.frame;
  if (mode === 'web') parts.push(`<rect class="frame" x="${fmt(f.x)}" y="${fmt(f.y)}" width="${fmt(f.width)}" height="${fmt(f.height)}"/>`);
  else parts.push(`<rect x="${fmt(f.x)}" y="${fmt(f.y)}" width="${fmt(f.width)}" height="${fmt(f.height)}" fill="${c.surface}" stroke="${c.ink}" stroke-width="1.5"/>`);

  const gridD = lay.grid.map((g) => `M${fmt(g.x1)} ${fmt(g.y1)}L${fmt(g.x2)} ${fmt(g.y2)}`).join('');
  if (mode === 'web') parts.push(`<path class="grid" d="${gridD}"/>`);
  else parts.push(`<path d="${gridD}" fill="none" stroke="${c.ink}" stroke-width="1"/>`);

  if (lay.lagnaMark) {
    const m = lay.lagnaMark;
    if (mode === 'web') parts.push(`<line class="lagna-mark" x1="${fmt(m.x1)}" y1="${fmt(m.y1)}" x2="${fmt(m.x2)}" y2="${fmt(m.y2)}"/>`);
    else parts.push(`<line x1="${fmt(m.x1)}" y1="${fmt(m.y1)}" x2="${fmt(m.x2)}" y2="${fmt(m.y2)}" stroke="${c.accent}" stroke-width="2"/>`);
  }

  const text = (cls, x, y, size, anchor, content, extra = {}) => {
    if (mode === 'web') {
      return `<text class="${cls}" x="${fmt(x)}" y="${fmt(y)}" text-anchor="${anchor}" style="--fs:${fmt(size)}px">${escapeXml(content)}</text>`;
    }
    return `<text x="${fmt(x)}" y="${fmt(y)}" font-size="${fmt(size)}" text-anchor="${anchor}" fill="${extra.fill}" font-family="${extra.family}"${extra.weight ? ` font-weight="${extra.weight}"` : ''}>${escapeXml(content)}</text>`;
  };

  for (const l of lay.labels) {
    // East style: the Lagna sign's numeral is drawn in accent (`l.accent`, with the accent underline above).
    const cls = l.kind === 'centre' ? 'centre' : l.kind === 'signName' ? 'signname' : l.accent ? 'sign lagna' : 'sign';
    const family = l.kind === 'signName' && !latin ? fonts.deva : fonts.sans;
    parts.push(text(cls, l.anchorX, l.baseline, l.size, l.anchor, l.text, { fill: l.kind === 'centre' ? c.ink2 : l.accent ? c.accent : c.ink3, family }));
  }
  for (const g of lay.glyphs) {
    parts.push(
      text(`pl${g.approx ? ' ap' : ''}`, g.anchorX, g.baseline, g.size, g.anchor, g.text, {
        fill: g.approx ? c.indigo : c.ink,
        family: latin ? fonts.sans : fonts.display,
        weight: latin ? 600 : 400,
      }),
    );
  }
  for (const b of lay.badges) {
    parts.push(text('badge', b.anchorX, b.baseline, b.size, b.anchor, b.text, { fill: c.ink2, family: fonts.sans }));
  }
  parts.push('</svg>');
  return parts.join('');
}

/** Accessible summary of a chart ("House 1, Meena: Mars, Saturn. House 2, ...") from the layout houses. */
export function chartSummary(lay, names, strings) {
  return lay.houses
    .map((h) => {
      const sign = names.signs[h.sign - 1];
      if (!h.planets.length) return strings.empty.replace('{n}', String(h.n)).replace('{sign}', sign);
      return strings.house
        .replace('{n}', String(h.n))
        .replace('{sign}', sign)
        .replace('{planets}', h.planets.map((p) => names.planets[p]).join(', '));
    })
    .join(' ');
}
