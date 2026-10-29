// mark.mjs - the Shubhvela mark ("Lagna lattice") and the compositions built from it, as SVG strings.
// Everything is drawn in the Android adaptive-icon space (108 x 108 dp, 72 dp launcher window, 66 dp safe circle)
// and scaled from there. Text goes through text.mjs (opentype.js + the app's bundled TTFs) and is always a <path>.
// Flat only: two colours plus paper, no gradients, no filters, no shadows. See docs/BRAND.md.
import { fonts, textPath } from './text.mjs';

// ---------- colours (packages/content/ui/design-tokens.json, verbatim) ----------
export const T = {
  light: { paper: '#FAF7F2', surface: '#FFFFFF', ink: '#1C1A17', ink2: '#5B554C', ink3: '#6F6960', hair: '#E4DDD2', hair2: '#CFC7BA', accent: '#B83E18', night: '#2E2A6E' },
  dark: { paper: '#15130F', surface: '#1E1B17', ink: '#F2EEE7', ink2: '#C2BBAF', ink3: '#9A9387', hair: '#34302A', hair2: '#4A443B', accent: '#E8835A', night: '#6B68BC' },
};
// The launcher icon is a fixed asset: paper tile + light-theme ink and vermilion, never themed.
export const ICON = { paper: T.light.paper, ink: T.light.ink, accent: T.light.accent };

// ---------- construction grid ----------
// Square 42 x 42 dp from (33,33) to (75,75), 4 dp ink stroke; both diagonals; midpoint diamond; house 1 (the Lagna,
// the top diamond) filled vermilion under the strokes. Strokes clipped to the square's outer edge (31..77) so no
// miter tip protrudes. Visible box 46 dp, corners 32.5 dp from the centre, inside the 66 dp safe circle.
export const GRID = { c: 54, h: 21, w: 4 };
export const BOX = { top: 31, bottom: 77, left: 31, right: 77 };
export const BOX_SIZE = BOX.right - BOX.left; // 46

let uidN = 0;
export const uid = (p = 'u') => `${p}${++uidN}`;
export const r2 = (n) => Math.round(n * 1000) / 1000;

/** The mark in the 108 dp space. col = { ink, accent }; pass the same colour for both to get the silhouette. */
export function mark({ ink, accent }) {
  const { c, h, w } = GRID;
  const q = h / 2;
  const id = uid('m');
  const o = h + w / 2;
  return `<defs><clipPath id="${id}"><rect x="${c - o}" y="${c - o}" width="${2 * o}" height="${2 * o}"/></clipPath></defs>
<polygon points="${c},${c - h} ${c + q},${c - q} ${c},${c} ${c - q},${c - q}" fill="${accent}"/>
<g fill="none" stroke="${ink}" stroke-width="${w}" stroke-linejoin="miter" stroke-miterlimit="8" stroke-linecap="butt" clip-path="url(#${id})">
<rect x="${c - h}" y="${c - h}" width="${2 * h}" height="${2 * h}"/>
<line x1="${c - h}" y1="${c - h}" x2="${c + h}" y2="${c + h}"/>
<line x1="${c + h}" y1="${c - h}" x2="${c - h}" y2="${c + h}"/>
<polygon points="${c},${c - h} ${c + h},${c} ${c},${c + h} ${c - h},${c}"/>
</g>`;
}

export const svgDoc = (w, h, body, vb = `0 0 ${w} ${h}`) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${vb}">${body}</svg>`;

/** The whole 108 layer (optional paper background + mark) with its top-left at (x, y), 108 dp = size px. */
export function layer108(x, y, size, opts = {}) {
  const k = size / 108;
  const col = opts.mono ? { ink: opts.mono, accent: opts.mono } : { ink: ICON.ink, accent: ICON.accent };
  const bgRect = opts.bg ? `<rect x="0" y="0" width="108" height="108" fill="${opts.bg}"/>` : '';
  return `<g transform="translate(${r2(x)} ${r2(y)}) scale(${r2(k)})">${bgRect}${mark(col)}</g>`;
}

/** The launcher's 72 dp window of the 108 canvas, `size` px square at (x, y); optional circle mask. */
export function window72(x, y, size, opts = {}) {
  const full = (size * 108) / 72;
  const off = (full - size) / 2;
  const id = uid('w');
  const clip = opts.circle
    ? `<circle cx="${r2(x + size / 2)}" cy="${r2(y + size / 2)}" r="${r2(size / 2)}"/>`
    : `<rect x="${r2(x)}" y="${r2(y)}" width="${size}" height="${size}"/>`;
  return `<defs><clipPath id="${id}">${clip}</clipPath></defs><g clip-path="url(#${id})">${layer108(x - off, y - off, full, opts)}</g>`;
}

/** The mark alone, scaled by k (px per dp), its 108 origin at (tx, ty). */
export function markAt(theme, k, tx, ty, mono) {
  const t = T[theme];
  const col = mono ? { ink: mono, accent: mono } : { ink: t.ink, accent: t.accent };
  return `<g transform="translate(${r2(tx)} ${r2(ty)}) scale(${r2(k)})">${mark(col)}</g>`;
}

/** The mark with its visible box `boxPx` tall, box top-left at (x, y). */
export function markBox(theme, boxPx, x, y, mono) {
  const k = boxPx / BOX_SIZE;
  return markAt(theme, k, x - BOX.left * k, y - BOX.top * k, mono);
}

// ---------- type ----------
// Tiro metrics per 1 em: Devanagari head line top 0.62, e-matra top 0.91 (ASC 0.93 with margin), u-matra bottom -0.28
// (DESC 0.32), Latin cap height 0.699.
export const HEAD = 0.62, ASC = 0.93, DESC = 0.32, CAP = 0.699;
export const F = () => fonts();

export function text(fontKey, str, size, x, y, fill, opts = {}) {
  const t = textPath(F()[fontKey], str, size, x, y, opts);
  return { svg: `<path d="${t.d}" fill="${fill}"/>`, width: t.width, bbox: t.bbox, x: t.x };
}
export const measure = (fontKey, str, size, opts = {}) => textPath(F()[fontKey], str, size, 0, 0, opts).width;

/** शुभवेला in Tiro, ink of the theme. */
export function devaWord(fs, x, baseline, theme, align = 'start') {
  return text('tiro', 'शुभवेला', fs, x, baseline, T[theme].ink, { align });
}

/**
 * Horizontal lockup: [mark] शुभवेला · Shubhvela on one baseline. Mark 1.1 em tall centred on the word's vertical span
 * (+0.91 .. -0.28 em), 0.4 em gap, dot in ink-3, Latin at 0.887x so Tiro's cap height meets the Devanagari head line.
 * Origin = top-left of the group's bounding box; returns { svg, w, h }.
 */
export function lockupH(theme, fs) {
  const t = T[theme];
  const markH = 1.1 * fs;
  const k = markH / BOX_SIZE;
  const markW = BOX_SIZE * k;
  const baseline = ASC * fs;
  const spanMid = baseline - ((ASC - DESC) / 2) * fs;
  const markSvg = markAt(theme, k, -BOX.left * k, spanMid - markH / 2 - BOX.top * k);
  let x = markW + 0.4 * fs;
  const dev = devaWord(fs, x, baseline, theme);
  x += dev.width + 0.26 * fs;
  const dot = text('tiro', '·', fs, x, baseline, t.ink3);
  x += dot.width + 0.26 * fs;
  const lat = text('tiro', 'Shubhvela', fs * (HEAD / CAP), x, baseline, t.ink);
  x += lat.width;
  return { svg: `${markSvg}${dev.svg}${dot.svg}${lat.svg}`, w: x, h: (ASC + DESC) * fs };
}

/** Stacked lockup: mark (1.0 em) above, 0.42 em gap, शुभवेला, then Shubhvela at 0.42 em in ink-2 with +14 % tracking.
 * Origin = top-centre (x = 0 is the axis); returns { svg, w, h }. */
export function lockupV(theme, fs) {
  const t = T[theme];
  const markH = 1.0 * fs;
  const k = markH / BOX_SIZE;
  const markW = BOX_SIZE * k;
  const markSvg = markAt(theme, k, -markW / 2 - BOX.left * k, -BOX.top * k);
  const base1 = markH + 0.42 * fs + ASC * fs;
  const dev = devaWord(fs, 0, base1, theme, 'middle');
  const fs2 = 0.42 * fs;
  const base2 = base1 + DESC * fs + 0.22 * fs + CAP * fs2;
  const lat = text('tiro', 'Shubhvela', fs2, 0, base2, t.ink2, { align: 'middle', letterSpacing: fs2 * 0.14 });
  return { svg: `${markSvg}${dev.svg}${lat.svg}`, h: base2 + 0.05 * fs2, w: Math.max(dev.width, lat.width, markW) };
}

/** Feature graphic 1024 x 500: flat paper, mark (264 px box) + शुभवेला / Shubhvela / rule / two honest lines. */
export function featureGraphic() {
  const t = T.light;
  const W = 1024, H = 500;
  const parts = [`<rect width="${W}" height="${H}" fill="${t.paper}"/>`];
  const markH = 264, k = markH / BOX_SIZE, markW = BOX_SIZE * k;
  const gap = 72;
  const l1s = "Your family's Vedic almanac", l2s = 'शुभ समय, आपके हाथ में';
  const textW = Math.max(measure('tiro', 'शुभवेला', 116), measure('sans', l1s, 31), measure('deva', l2s, 31));
  const total = markW + gap + textW;
  const left = (W - total) / 2;
  parts.push(markAt('light', k, left - BOX.left * k, (H - markH) / 2 - BOX.top * k));
  const x0 = left + markW + gap;
  parts.push(devaWord(116, x0, 212, 'light').svg);
  parts.push(text('tiro', 'Shubhvela', 46, x0 + 4, 282, t.ink2, { letterSpacing: 3 }).svg);
  parts.push(`<rect x="${r2(x0 + 4)}" y="312" width="64" height="4" fill="${t.accent}"/>`);
  parts.push(text('sans', l1s, 31, x0 + 4, 364, t.ink).svg);
  parts.push(text('deva', l2s, 31, x0 + 4, 410, t.ink2).svg);
  return svgDoc(W, H, parts.join(''));
}

/** Open Graph base 1200 x 630: flat paper, horizontal lockup centred, rule, one line. The web run overlays nothing. */
export function ogBase() {
  const t = T.light;
  const W = 1200, H = 630;
  // the lockup fills 80 % of the width; its height follows (w ~ 9.4 em, h = 1.25 em)
  let fs = 110;
  let lk = lockupH('light', fs);
  while (lk.w > W * 0.8 && fs > 40) { fs -= 2; lk = lockupH('light', fs); }
  const parts = [`<rect width="${W}" height="${H}" fill="${t.paper}"/>`];
  const top = Math.round((H - (lk.h + 110 + 30)) / 2);
  parts.push(`<g transform="translate(${r2((W - lk.w) / 2)} ${r2(top)})">${lk.svg}</g>`);
  parts.push(`<rect x="${W / 2 - 32}" y="${top + lk.h + 44}" width="64" height="4" fill="${t.accent}"/>`);
  parts.push(text('sans', "Your family's Vedic almanac · offline, computed on your phone", 30, W / 2, top + lk.h + 110, t.ink2, { align: 'middle' }).svg);
  return svgDoc(W, H, parts.join(''));
}
