// OG image template (plan P6: 1200x630, paper background, brand mark + wordmark in Tiro, vermilion rule, page title,
// subtitle, URL; Devanagari per language; no gradients, no shadows). The template is a layer plan that render.mjs
// executes with sharp (Pango text: correct Devanagari shaping) and resvg (the brand mark geometry only).
//
// Why not SVG text through resvg: resvg 2.6 mis-shapes Devanagari (dropped spaces, misplaced matras) — verified on
// 2026-10-29 with the hi/bho kundli image — while libvips/Pango shapes it correctly.
export const OG_W = 1200;
export const OG_H = 630;
export const PAPER = '#FAF7F2';
export const INK = '#1C1A17';
export const INK2 = '#5B554C';
export const INK3 = '#6F6960';
export const ACCENT = '#B83E18';

export const FAMILY = {
  display: 'Tiro Devanagari Hindi',
  sans: 'Noto Sans',
  deva: 'Noto Sans Devanagari',
};

/** Pango markup escaping. */
export function escapeMarkup(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Layer plan for one image. Text layers carry {kind:'text', text, family, size, color, maxWidth, y, singleLine}; the
 * renderer measures each rendered text and centres it horizontally. The wordmark row is centred as a group (mark + text).
 */
export function ogTemplate({ lang, title, subtitle, url, nameDev = 'शुभवेला', name = 'Shubhvela', hasMark = true }) {
  const body = lang === 'en' ? FAMILY.sans : FAMILY.deva;
  return {
    width: OG_W,
    height: OG_H,
    background: PAPER,
    wordmark: { text: `${nameDev} · ${name}`, family: FAMILY.display, size: 92, color: INK, y: 150, markSize: 104, gap: 28, hasMark },
    rule: { x: (OG_W - 64) / 2, y: 318, width: 64, height: 4, color: ACCENT },
    layers: [
      { kind: 'text', text: title, family: FAMILY.display, size: 46, minSize: 30, color: INK, maxWidth: 1080, y: subtitle ? 372 : 400, singleLine: true },
      subtitle ? { kind: 'text', text: subtitle, family: body, size: 26, minSize: 20, color: INK2, maxWidth: 1000, y: 450, singleLine: false, maxLines: 2 } : null,
      url ? { kind: 'text', text: url, family: FAMILY.sans, size: 22, minSize: 16, color: INK3, maxWidth: 1080, y: 578, singleLine: true } : null,
    ].filter(Boolean),
  };
}
